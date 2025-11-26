import { UseFormReturn } from 'react-hook-form';
import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils';
import type { VentasPremiosForm, SystemEntry } from './VentasPremiosEncargada';

interface LotterySystem {
  id: string;
  name: string;
  code: string;
}

interface VentasPremiosBolivaresEncargadaProps {
  form: UseFormReturn<VentasPremiosForm>;
  lotteryOptions: LotterySystem[];
}

export const VentasPremiosBolivaresEncargada = ({ form, lotteryOptions }: VentasPremiosBolivaresEncargadaProps) => {
  const systems = form.watch('systems');
  const [inputValues, setInputValues] = useState<Record<string, string>>({});

  // Códigos de sistemas de Parley y Caballos
  const parleySystemCodes = [
    'INMEJORABLE-MULTIS-1', 'INMEJORABLE-MULTIS-2', 'INMEJORABLE-MULTIS-3', 'INMEJORABLE-MULTIS-4',
    'INMEJORABLE-5Y6', 'POLLA', 'MULTISPORT-CABALLOS-NAC', 'MULTISPORT-CABALLOS-INT', 'MULTISPORT-5Y6'
  ];

  // Agrupar sistemas por sistema padre
  const groupSystemsByParent = (systemsList: typeof systems) => {
    const grouped = new Map<string, { parent: SystemEntry | null; children: SystemEntry[] }>();
    const standalone: SystemEntry[] = [];

    systemsList.forEach(system => {
      if (system.parent_system_id) {
        // Es una subcategoría
        const parentId = system.parent_system_id;
        if (!grouped.has(parentId)) {
          grouped.set(parentId, { parent: null, children: [] });
        }
        grouped.get(parentId)!.children.push(system);
      } else {
        // Verificar si tiene subcategorías
        const hasChildren = systemsList.some(s => s.parent_system_id === system.lottery_system_id);
        if (hasChildren) {
          // Es un sistema padre
          if (!grouped.has(system.lottery_system_id)) {
            grouped.set(system.lottery_system_id, { parent: system, children: [] });
          }
          grouped.get(system.lottery_system_id)!.parent = system;
        } else {
          // Sistema standalone
          standalone.push(system);
        }
      }
    });

    return { grouped, standalone };
  };

  // Filtrar sistemas normales y de parley
  const normalSystems = systems.filter(system => {
    const lotterySystem = lotteryOptions.find(l => l.id === system.lottery_system_id);
    return !lotterySystem || !parleySystemCodes.includes(lotterySystem.code);
  });

  const parleySystems = systems.filter(system => {
    const lotterySystem = lotteryOptions.find(l => l.id === system.lottery_system_id);
    return lotterySystem && parleySystemCodes.includes(lotterySystem.code);
  });

  const normalGrouped = groupSystemsByParent(normalSystems);
  const parleyGrouped = groupSystemsByParent(parleySystems);

  // Sincroniza los inputs cuando cambian los valores del formulario (agencia/fecha/sync)
  useEffect(() => {
    if (!systems || systems.length === 0) {
      setInputValues({});
      return;
    }

    const newInputValues: Record<string, string> = {};
    let sistemasConDatos = 0;
    
    systems.forEach((system) => {
      const id = system.lottery_system_id;
      const salesKey = `${id}-sales_bs`;
      const prizesKey = `${id}-prizes_bs`;

      // Mostrar valores si son mayores a 0 (incluyendo decimales)
      const salesBs = Number(system.sales_bs || 0);
      const prizesBs = Number(system.prizes_bs || 0);

      if (salesBs > 0 || prizesBs > 0) {
        sistemasConDatos++;
      }

      newInputValues[salesKey] = salesBs > 0
        ? salesBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : '';

      newInputValues[prizesKey] = prizesBs > 0
        ? prizesBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : '';
    });
    
    setInputValues(newInputValues);
  }, [systems]);

  const parseInputValue = (value: string): number => {
    if (!value || value.trim() === '') return 0;
    const cleanValue = value.replace(/[^\d.,]/g, '');
    const normalizedValue = cleanValue.replace(',', '.');
    const num = parseFloat(normalizedValue);
    return isNaN(num) ? 0 : num;
  };

  const handleInputChange = (systemId: string, index: number, field: 'sales_bs' | 'prizes_bs', value: string) => {
    const key = `${systemId}-${field}`;
    setInputValues(prev => ({ ...prev, [key]: value }));
  };

  const handleInputBlur = (systemId: string, index: number, field: 'sales_bs' | 'prizes_bs') => {
    const key = `${systemId}-${field}`;
    const value = inputValues[key] || '';
    const numValue = parseInputValue(value);
    
    // Actualizar el formulario
    form.setValue(`systems.${index}.${field}`, numValue, { shouldDirty: true, shouldValidate: false });
    
    // Formatear el valor en el input solo si es mayor que 0
    const formattedValue = numValue > 0 ? numValue.toLocaleString('es-VE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }) : '';
    
    setInputValues(prev => ({ ...prev, [key]: formattedValue }));
  };

  const calculateTotals = () => {
    return systems.reduce(
      (acc, system) => ({
        sales_bs: acc.sales_bs + (system.sales_bs || 0),
        prizes_bs: acc.prizes_bs + (system.prizes_bs || 0),
      }),
      { sales_bs: 0, prizes_bs: 0 }
    );
  };

  const calculateNormalTotals = () => {
    return normalSystems.reduce(
      (acc, system) => ({
        sales_bs: acc.sales_bs + (system.sales_bs || 0),
        prizes_bs: acc.prizes_bs + (system.prizes_bs || 0),
      }),
      { sales_bs: 0, prizes_bs: 0 }
    );
  };

  const calculateParleyTotals = () => {
    return parleySystems.reduce(
      (acc, system) => ({
        sales_bs: acc.sales_bs + (system.sales_bs || 0),
        prizes_bs: acc.prizes_bs + (system.prizes_bs || 0),
      }),
      { sales_bs: 0, prizes_bs: 0 }
    );
  };

  const totals = calculateTotals();
  const normalTotals = calculateNormalTotals();
  const parleyTotals = calculateParleyTotals();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ventas y Premios en Bolívares</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4">
          <div className="grid grid-cols-4 gap-2 text-sm font-medium text-muted-foreground border-b pb-2">
            <div>Sistema</div>
            <div className="text-center">Ventas Bs</div>
            <div className="text-center">Premios Bs</div>
            <div className="text-center">Cuadre Bs</div>
          </div>

          {/* Sistemas agrupados con monto padre */}
          {Array.from(normalGrouped.grouped.entries()).map(([parentId, group]) => {
            const parentSystem = group.parent;
            const children = group.children;
            
            // Si hay monto padre, mostrar casilla superior
            const hasParentAmount = children.some(c => 
              (c.parent_sales_bs || 0) > 0 || (c.parent_prizes_bs || 0) > 0
            );
            
            if (!hasParentAmount && !parentSystem) {
              // No hay monto padre ni sistema padre visible, mostrar solo hijos
              return children.map((system) => {
                const systemCuadre = (system.sales_bs || 0) - (system.prizes_bs || 0);
                const index = systems.findIndex(s => s.lottery_system_id === system.lottery_system_id);
                
                return (
                  <div key={system.lottery_system_id} className="grid grid-cols-4 gap-2 items-center">
                    <div className="font-medium text-sm">
                      {system.lottery_system_name}
                    </div>
                    
                    <Input
                      type="text"
                      placeholder="0,00"
                      value={inputValues[`${system.lottery_system_id}-sales_bs`] || ''}
                      onChange={(e) => handleInputChange(system.lottery_system_id, index, 'sales_bs', e.target.value)}
                      onBlur={() => handleInputBlur(system.lottery_system_id, index, 'sales_bs')}
                      className="text-center"
                    />
                    
                    <Input
                      type="text"
                      placeholder="0,00"
                      value={inputValues[`${system.lottery_system_id}-prizes_bs`] || ''}
                      onChange={(e) => handleInputChange(system.lottery_system_id, index, 'prizes_bs', e.target.value)}
                      onBlur={() => handleInputBlur(system.lottery_system_id, index, 'prizes_bs')}
                      className="text-center"
                    />
                    
                    <div className={`text-center font-medium ${systemCuadre >= 0 ? 'text-success' : 'text-destructive'}`}>
                      {formatCurrency(systemCuadre, 'VES')}
                    </div>
                  </div>
                );
              });
            }
            
            // Obtener monto padre (todas las subcategorías tienen el mismo monto padre, tomar solo el primero)
            const parentSalesBs = children[0]?.parent_sales_bs || 0;
            const parentPrizesBs = children[0]?.parent_prizes_bs || 0;
            const rawParentName = parentSystem?.lottery_system_name || children[0]?.lottery_system_name || 'Sistema Padre';
            // Limpiar el nombre quitando "FIGURAS" y cualquier guión o espacio relacionado
            const parentName = rawParentName.replace(/\s*-\s*FIGURAS\s*/gi, '').replace(/\s*FIGURAS\s*/gi, '').trim();
            
            return (
              <div key={parentId} className="space-y-2 border rounded-lg p-3 bg-muted/20">
                {/* Casilla del monto padre (solo lectura) */}
                {hasParentAmount && (
                  <div className="grid grid-cols-4 gap-2 items-center bg-background/50 rounded p-2 border-2 border-dashed border-primary/30">
                    <div className="font-semibold text-sm text-primary">
                      {parentName} (Monto Taquillera)
                    </div>
                    <div className="text-center font-medium text-muted-foreground">
                      {formatCurrency(parentSalesBs, 'VES')}
                    </div>
                    <div className="text-center font-medium text-muted-foreground">
                      {formatCurrency(parentPrizesBs, 'VES')}
                    </div>
                    <div className="text-center font-medium text-muted-foreground">
                      {formatCurrency(parentSalesBs - parentPrizesBs, 'VES')}
                    </div>
                  </div>
                )}
                
                {/* Subcategorías (editables) */}
                {children.map((system) => {
                  const systemCuadre = (system.sales_bs || 0) - (system.prizes_bs || 0);
                  const index = systems.findIndex(s => s.lottery_system_id === system.lottery_system_id);
                  
                  return (
                    <div key={system.lottery_system_id} className="grid grid-cols-4 gap-2 items-center pl-4">
                      <div className="font-medium text-sm">
                        {system.lottery_system_name}
                      </div>
                      
                      <Input
                        type="text"
                        placeholder="0,00"
                        value={inputValues[`${system.lottery_system_id}-sales_bs`] || ''}
                        onChange={(e) => handleInputChange(system.lottery_system_id, index, 'sales_bs', e.target.value)}
                        onBlur={() => handleInputBlur(system.lottery_system_id, index, 'sales_bs')}
                        className="text-center"
                      />
                      
                      <Input
                        type="text"
                        placeholder="0,00"
                        value={inputValues[`${system.lottery_system_id}-prizes_bs`] || ''}
                        onChange={(e) => handleInputChange(system.lottery_system_id, index, 'prizes_bs', e.target.value)}
                        onBlur={() => handleInputBlur(system.lottery_system_id, index, 'prizes_bs')}
                        className="text-center"
                      />
                      
                      <div className={`text-center font-medium ${systemCuadre >= 0 ? 'text-success' : 'text-destructive'}`}>
                        {formatCurrency(systemCuadre, 'VES')}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
          
          {/* Sistemas standalone (sin padre) */}
          {normalGrouped.standalone.map((system) => {
            const systemCuadre = (system.sales_bs || 0) - (system.prizes_bs || 0);
            const index = systems.findIndex(s => s.lottery_system_id === system.lottery_system_id);
            
            return (
              <div key={system.lottery_system_id} className="grid grid-cols-4 gap-2 items-center">
                <div className="font-medium text-sm">
                  {system.lottery_system_name}
                </div>
                
                <Input
                  type="text"
                  placeholder="0,00"
                  value={inputValues[`${system.lottery_system_id}-sales_bs`] || ''}
                  onChange={(e) => handleInputChange(system.lottery_system_id, index, 'sales_bs', e.target.value)}
                  onBlur={() => handleInputBlur(system.lottery_system_id, index, 'sales_bs')}
                  className="text-center"
                />
                
                <Input
                  type="text"
                  placeholder="0,00"
                  value={inputValues[`${system.lottery_system_id}-prizes_bs`] || ''}
                  onChange={(e) => handleInputChange(system.lottery_system_id, index, 'prizes_bs', e.target.value)}
                  onBlur={() => handleInputBlur(system.lottery_system_id, index, 'prizes_bs')}
                  className="text-center"
                />
                
                <div className={`text-center font-medium ${systemCuadre >= 0 ? 'text-success' : 'text-destructive'}`}>
                  {formatCurrency(systemCuadre, 'VES')}
                </div>
              </div>
            );
          })}
        </div>

        {/* Sección de Parley y Caballos */}
        {parleySystems.length > 0 && (
          <div className="mt-6 pt-6 border-t space-y-4">
            <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 rounded-lg p-3">
              <h3 className="text-lg font-semibold text-center">PARLEY Y CABALLOS</h3>
            </div>
            
            <div className="grid gap-4">
              <div className="grid grid-cols-4 gap-2 text-sm font-medium text-muted-foreground border-b pb-2">
                <div>Sistema</div>
                <div className="text-center">Ventas Bs</div>
                <div className="text-center">Premios Bs</div>
                <div className="text-center">Cuadre Bs</div>
              </div>

              {parleySystems.map((system) => {
                const systemCuadre = (system.sales_bs || 0) - (system.prizes_bs || 0);
                const index = systems.findIndex(s => s.lottery_system_id === system.lottery_system_id);
                
                return (
                  <div key={system.lottery_system_id} className="grid grid-cols-4 gap-2 items-center">
                    <div className="font-medium text-sm">
                      {system.lottery_system_name}
                    </div>
                    
                    <Input
                      type="text"
                      placeholder="0,00"
                      value={inputValues[`${system.lottery_system_id}-sales_bs`] || ''}
                      onChange={(e) => handleInputChange(system.lottery_system_id, index, 'sales_bs', e.target.value)}
                      onBlur={() => handleInputBlur(system.lottery_system_id, index, 'sales_bs')}
                      className="text-center"
                    />
                    
                    <Input
                      type="text"
                      placeholder="0,00"
                      value={inputValues[`${system.lottery_system_id}-prizes_bs`] || ''}
                      onChange={(e) => handleInputChange(system.lottery_system_id, index, 'prizes_bs', e.target.value)}
                      onBlur={() => handleInputBlur(system.lottery_system_id, index, 'prizes_bs')}
                      className="text-center"
                    />
                    
                    <div className={`text-center font-medium ${systemCuadre >= 0 ? 'text-success' : 'text-destructive'}`}>
                      {formatCurrency(systemCuadre, 'VES')}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Totales Generales para Bolívares */}
        <Card className="bg-muted/30">
          <CardContent className="pt-6">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-sm text-muted-foreground">Total Ventas</p>
                <p className="text-xl font-bold text-success">
                  {formatCurrency(totals.sales_bs, 'VES')}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Premios</p>
                <p className="text-xl font-bold text-destructive">
                  {formatCurrency(totals.prizes_bs, 'VES')}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Cuadre Total</p>
                <p className={`text-xl font-bold ${(totals.sales_bs - totals.prizes_bs) >= 0 ? 'text-success' : 'text-destructive'}`}>
                  {formatCurrency(totals.sales_bs - totals.prizes_bs, 'VES')}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </CardContent>
    </Card>
  );
};