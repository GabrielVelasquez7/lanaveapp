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

interface VentasPremiosDolaresEncargadaProps {
  form: UseFormReturn<VentasPremiosForm>;
  lotteryOptions: LotterySystem[];
}

export const VentasPremiosDolaresEncargada = ({ form, lotteryOptions }: VentasPremiosDolaresEncargadaProps) => {
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
      const salesKey = `${id}-sales_usd`;
      const prizesKey = `${id}-prizes_usd`;

      // Mostrar valores si son mayores a 0 (incluyendo decimales)
      const salesUsd = Number(system.sales_usd || 0);
      const prizesUsd = Number(system.prizes_usd || 0);

      if (salesUsd > 0 || prizesUsd > 0) {
        sistemasConDatos++;
      }

      newInputValues[salesKey] = salesUsd > 0
        ? salesUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : '';

      newInputValues[prizesKey] = prizesUsd > 0
        ? prizesUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : '';
    });
    
    setInputValues(newInputValues);
    
    if (sistemasConDatos > 0) {
      console.log('📊 USD actualizados:', sistemasConDatos, 'sistemas con datos');
    }
  }, [systems]);

  const parseInputValue = (value: string): number => {
    if (!value || value.trim() === '') return 0;
    const cleanValue = value.replace(/[^\d.,]/g, '');
    const normalizedValue = cleanValue.replace(',', '.');
    const num = parseFloat(normalizedValue);
    return isNaN(num) ? 0 : num;
  };

  const handleInputChange = (systemId: string, index: number, field: 'sales_usd' | 'prizes_usd', value: string) => {
    const key = `${systemId}-${field}`;
    setInputValues(prev => ({ ...prev, [key]: value }));
  };

  const handleInputBlur = (systemId: string, index: number, field: 'sales_usd' | 'prizes_usd') => {
    const key = `${systemId}-${field}`;
    const value = inputValues[key] || '';
    const numValue = parseInputValue(value);
    
    // Actualizar el formulario
    form.setValue(`systems.${index}.${field}`, numValue, { shouldDirty: true, shouldValidate: false });
    
    // Formatear el valor en el input solo si es mayor que 0
    const formattedValue = numValue > 0 ? numValue.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }) : '';
    
    setInputValues(prev => ({ ...prev, [key]: formattedValue }));
  };

  const calculateTotals = () => {
    return systems.reduce(
      (acc, system) => ({
        sales_usd: acc.sales_usd + (system.sales_usd || 0),
        prizes_usd: acc.prizes_usd + (system.prizes_usd || 0),
      }),
      { sales_usd: 0, prizes_usd: 0 }
    );
  };

  const calculateNormalTotals = () => {
    return normalSystems.reduce(
      (acc, system) => ({
        sales_usd: acc.sales_usd + (system.sales_usd || 0),
        prizes_usd: acc.prizes_usd + (system.prizes_usd || 0),
      }),
      { sales_usd: 0, prizes_usd: 0 }
    );
  };

  const calculateParleyTotals = () => {
    return parleySystems.reduce(
      (acc, system) => ({
        sales_usd: acc.sales_usd + (system.sales_usd || 0),
        prizes_usd: acc.prizes_usd + (system.prizes_usd || 0),
      }),
      { sales_usd: 0, prizes_usd: 0 }
    );
  };

  const totals = calculateTotals();
  const normalTotals = calculateNormalTotals();
  const parleyTotals = calculateParleyTotals();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ventas y Premios en Dólares</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4">
          <div className="grid grid-cols-4 gap-2 text-sm font-medium text-muted-foreground border-b pb-2">
            <div>Sistema</div>
            <div className="text-center">Ventas USD</div>
            <div className="text-center">Premios USD</div>
            <div className="text-center">Cuadre USD</div>
          </div>

          {/* Sistemas agrupados con monto padre */}
          {Array.from(normalGrouped.grouped.entries()).map(([parentId, group]) => {
            const parentSystem = group.parent;
            const children = group.children;
            
            // Si hay monto padre, mostrar casilla superior
            const hasParentAmount = children.some(c => 
              (c.parent_sales_usd || 0) > 0 || (c.parent_prizes_usd || 0) > 0
            );
            
            if (!hasParentAmount && !parentSystem) {
              // No hay monto padre ni sistema padre visible, mostrar solo hijos
              return children.map((system) => {
                const systemCuadre = (system.sales_usd || 0) - (system.prizes_usd || 0);
                const index = systems.findIndex(s => s.lottery_system_id === system.lottery_system_id);
                
                return (
                  <div key={system.lottery_system_id} className="grid grid-cols-4 gap-2 items-center">
                    <div className="font-medium text-sm">
                      {system.lottery_system_name}
                    </div>
                    
                    <Input
                      type="text"
                      placeholder="0.00"
                      value={inputValues[`${system.lottery_system_id}-sales_usd`] || ''}
                      onChange={(e) => handleInputChange(system.lottery_system_id, index, 'sales_usd', e.target.value)}
                      onBlur={() => handleInputBlur(system.lottery_system_id, index, 'sales_usd')}
                      className="text-center"
                    />
                    
                    <Input
                      type="text"
                      placeholder="0.00"
                      value={inputValues[`${system.lottery_system_id}-prizes_usd`] || ''}
                      onChange={(e) => handleInputChange(system.lottery_system_id, index, 'prizes_usd', e.target.value)}
                      onBlur={() => handleInputBlur(system.lottery_system_id, index, 'prizes_usd')}
                      className="text-center"
                    />
                    
                    <div className={`text-center font-medium ${systemCuadre >= 0 ? 'text-success' : 'text-destructive'}`}>
                      {formatCurrency(systemCuadre, 'USD')}
                    </div>
                  </div>
                );
              });
            }
            
            // Calcular totales del monto padre
            const parentSalesUsd = children.reduce((sum, c) => sum + (c.parent_sales_usd || 0), 0);
            const parentPrizesUsd = children.reduce((sum, c) => sum + (c.parent_prizes_usd || 0), 0);
            const parentName = parentSystem?.lottery_system_name || children[0]?.lottery_system_name || 'Sistema Padre';
            
            return (
              <div key={parentId} className="space-y-2 border rounded-lg p-3 bg-muted/20">
                {/* Casilla del monto padre (solo lectura) */}
                {hasParentAmount && (
                  <div className="grid grid-cols-4 gap-2 items-center bg-background/50 rounded p-2 border-2 border-dashed border-primary/30">
                    <div className="font-semibold text-sm text-primary">
                      {parentName} (Monto Taquillera)
                    </div>
                    <div className="text-center font-medium text-muted-foreground">
                      {formatCurrency(parentSalesUsd, 'USD')}
                    </div>
                    <div className="text-center font-medium text-muted-foreground">
                      {formatCurrency(parentPrizesUsd, 'USD')}
                    </div>
                    <div className="text-center font-medium text-muted-foreground">
                      {formatCurrency(parentSalesUsd - parentPrizesUsd, 'USD')}
                    </div>
                  </div>
                )}
                
                {/* Subcategorías (editables) */}
                {children.map((system) => {
                  const systemCuadre = (system.sales_usd || 0) - (system.prizes_usd || 0);
                  const index = systems.findIndex(s => s.lottery_system_id === system.lottery_system_id);
                  
                  return (
                    <div key={system.lottery_system_id} className="grid grid-cols-4 gap-2 items-center pl-4">
                      <div className="font-medium text-sm">
                        {system.lottery_system_name}
                      </div>
                      
                      <Input
                        type="text"
                        placeholder="0.00"
                        value={inputValues[`${system.lottery_system_id}-sales_usd`] || ''}
                        onChange={(e) => handleInputChange(system.lottery_system_id, index, 'sales_usd', e.target.value)}
                        onBlur={() => handleInputBlur(system.lottery_system_id, index, 'sales_usd')}
                        className="text-center"
                      />
                      
                      <Input
                        type="text"
                        placeholder="0.00"
                        value={inputValues[`${system.lottery_system_id}-prizes_usd`] || ''}
                        onChange={(e) => handleInputChange(system.lottery_system_id, index, 'prizes_usd', e.target.value)}
                        onBlur={() => handleInputBlur(system.lottery_system_id, index, 'prizes_usd')}
                        className="text-center"
                      />
                      
                      <div className={`text-center font-medium ${systemCuadre >= 0 ? 'text-success' : 'text-destructive'}`}>
                        {formatCurrency(systemCuadre, 'USD')}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
          
          {/* Sistemas standalone (sin padre) */}
          {normalGrouped.standalone.map((system) => {
            const systemCuadre = (system.sales_usd || 0) - (system.prizes_usd || 0);
            const index = systems.findIndex(s => s.lottery_system_id === system.lottery_system_id);
            
            return (
              <div key={system.lottery_system_id} className="grid grid-cols-4 gap-2 items-center">
                <div className="font-medium text-sm">
                  {system.lottery_system_name}
                </div>
                
                <Input
                  type="text"
                  placeholder="0.00"
                  value={inputValues[`${system.lottery_system_id}-sales_usd`] || ''}
                  onChange={(e) => handleInputChange(system.lottery_system_id, index, 'sales_usd', e.target.value)}
                  onBlur={() => handleInputBlur(system.lottery_system_id, index, 'sales_usd')}
                  className="text-center"
                />
                
                <Input
                  type="text"
                  placeholder="0.00"
                  value={inputValues[`${system.lottery_system_id}-prizes_usd`] || ''}
                  onChange={(e) => handleInputChange(system.lottery_system_id, index, 'prizes_usd', e.target.value)}
                  onBlur={() => handleInputBlur(system.lottery_system_id, index, 'prizes_usd')}
                  className="text-center"
                />
                
                <div className={`text-center font-medium ${systemCuadre >= 0 ? 'text-success' : 'text-destructive'}`}>
                  {formatCurrency(systemCuadre, 'USD')}
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
                <div className="text-center">Ventas USD</div>
                <div className="text-center">Premios USD</div>
                <div className="text-center">Cuadre USD</div>
              </div>

              {parleySystems.map((system) => {
                const systemCuadre = (system.sales_usd || 0) - (system.prizes_usd || 0);
                const index = systems.findIndex(s => s.lottery_system_id === system.lottery_system_id);
                
                return (
                  <div key={system.lottery_system_id} className="grid grid-cols-4 gap-2 items-center">
                    <div className="font-medium text-sm">
                      {system.lottery_system_name}
                    </div>
                    
                    <Input
                      type="text"
                      placeholder="0.00"
                      value={inputValues[`${system.lottery_system_id}-sales_usd`] || ''}
                      onChange={(e) => handleInputChange(system.lottery_system_id, index, 'sales_usd', e.target.value)}
                      onBlur={() => handleInputBlur(system.lottery_system_id, index, 'sales_usd')}
                      className="text-center"
                    />
                    
                    <Input
                      type="text"
                      placeholder="0.00"
                      value={inputValues[`${system.lottery_system_id}-prizes_usd`] || ''}
                      onChange={(e) => handleInputChange(system.lottery_system_id, index, 'prizes_usd', e.target.value)}
                      onBlur={() => handleInputBlur(system.lottery_system_id, index, 'prizes_usd')}
                      className="text-center"
                    />
                    
                    <div className={`text-center font-medium ${systemCuadre >= 0 ? 'text-success' : 'text-destructive'}`}>
                      {formatCurrency(systemCuadre, 'USD')}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Totales Generales para Dólares */}
        <Card className="bg-muted/30">
          <CardContent className="pt-6">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-sm text-muted-foreground">Total Ventas</p>
                <p className="text-xl font-bold text-success">
                  {formatCurrency(totals.sales_usd, 'USD')}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Premios</p>
                <p className="text-xl font-bold text-destructive">
                  {formatCurrency(totals.prizes_usd, 'USD')}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Cuadre Total</p>
                <p className={`text-xl font-bold ${(totals.sales_usd - totals.prizes_usd) >= 0 ? 'text-success' : 'text-destructive'}`}>
                  {formatCurrency(totals.sales_usd - totals.prizes_usd, 'USD')}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </CardContent>
    </Card>
  );
};