import { UseFormReturn } from 'react-hook-form';
import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils';
import type { BanqueoForm } from './BanqueoManager';
import type { CommissionRate } from '@/hooks/useSystemCommissions';

interface LotterySystem {
  id: string;
  name: string;
  code: string;
}

interface BanqueoVentasPremiosDolaresProps {
  form: UseFormReturn<BanqueoForm>;
  lotteryOptions: LotterySystem[];
  commissions: Map<string, CommissionRate>;
  participationPercentage: number;
  clientSystemConfigs?: Map<string, { commission_bs: number; commission_usd: number; participation_bs: number; participation_usd: number; lanave_participation_bs?: number; lanave_participation_usd?: number }> | null;
  clientLanaveParticipation?: { lanave_participation_bs: number; lanave_participation_usd: number } | null;
}

interface SystemTotals {
  sales_bs?: number;
  sales_usd?: number;
  prizes_bs?: number;
  prizes_usd?: number;
  cuadre: number;
  commission: number;
  subtotal: number;
  participation: number;
  lanaveParticipation: number;
  finalTotal: number;
}

export const BanqueoVentasPremiosDolares = ({
  form, 
  lotteryOptions, 
  commissions,
  participationPercentage,
  clientSystemConfigs,
  clientLanaveParticipation
}: BanqueoVentasPremiosDolaresProps) => {
  const systems = form.watch('systems');
  const [inputValues, setInputValues] = useState<Record<string, string>>({});
  const isInitialMount = useRef(true);
  const previousSystemsRef = useRef<string>('');

  // Códigos de sistemas de Parley y Caballos
  const parleySystemCodes = [
    'INMEJORABLE-MULTIS-1', 'INMEJORABLE-MULTIS-2', 'INMEJORABLE-MULTIS-3', 'INMEJORABLE-MULTIS-4',
    'INMEJORABLE-5Y6', 'POLLA', 'MULTISPORT-CABALLOS-NAC', 'MULTISPORT-CABALLOS-INT', 'MULTISPORT-5Y6'
  ];

  // Filtrar sistemas normales y de parley
  const normalSystems = systems.filter(system => {
    const lotterySystem = lotteryOptions.find(l => l.id === system.lottery_system_id);
    return !lotterySystem || !parleySystemCodes.includes(lotterySystem.code);
  });

  const parleySystems = systems.filter(system => {
    const lotterySystem = lotteryOptions.find(l => l.id === system.lottery_system_id);
    return lotterySystem && parleySystemCodes.includes(lotterySystem.code);
  });

  const parseInputValue = (value: string): number => {
    if (!value || value.trim() === "") return 0;
    
    // Remover todos los caracteres que no sean dígitos, puntos o comas
    const cleanValue = value.replace(/[^\d.,]/g, "");
    
    // Para formato en-US: coma es separador de miles, punto es separador decimal
    // Si hay punto, es el separador decimal
    if (cleanValue.includes(".")) {
      // Remover todas las comas (separadores de miles) y mantener el punto
      const normalizedValue = cleanValue.replace(/,/g, "");
      const num = parseFloat(normalizedValue);
      return isNaN(num) ? 0 : num;
    }
    
    // Si hay coma pero no punto, determinar si es separador de miles o decimal
    if (cleanValue.includes(",")) {
      // Si la coma está en las últimas 3 posiciones (ej: "1223,50"), es decimal
      // Si no, es separador de miles
      const lastCommaIndex = cleanValue.lastIndexOf(",");
      const afterComma = cleanValue.substring(lastCommaIndex + 1);
      
      // Si después de la última coma hay 1 o 2 dígitos, es decimal
      if (afterComma.length <= 2 && afterComma.length > 0) {
        // Es decimal: remover otras comas y reemplazar la última por punto
        const beforeLastComma = cleanValue.substring(0, lastCommaIndex).replace(/,/g, "");
        const normalizedValue = `${beforeLastComma}.${afterComma}`;
        const num = parseFloat(normalizedValue);
        return isNaN(num) ? 0 : num;
      } else {
        // Es separador de miles: remover todas las comas
        const normalizedValue = cleanValue.replace(/,/g, "");
        const num = parseFloat(normalizedValue);
        return isNaN(num) ? 0 : num;
      }
    }
    
    // Si no hay puntos ni comas, es un número entero
    const num = parseFloat(cleanValue);
    return isNaN(num) ? 0 : num;
  };

  // Sincronizar inputValues cuando cambian los sistemas del formulario
  useEffect(() => {
    const systemsKey = systems.map(s => `${s.lottery_system_id}-${s.sales_usd}-${s.prizes_usd}`).join(',');
    
    // Detectar si todos los sistemas están en cero (formulario reseteado)
    const allZero = systems.every(s => 
      (s.sales_usd || 0) === 0 && (s.prizes_usd || 0) === 0
    );

    // Si todos están en cero o el key cambió, actualizar los inputs
    if (allZero || isInitialMount.current || previousSystemsRef.current !== systemsKey) {
      const newInputValues: Record<string, string> = {};
      
      systems.forEach((system) => {
        const id = system.lottery_system_id;
        const salesKey = `${id}-sales_usd`;
        const prizesKey = `${id}-prizes_usd`;

        // Si todos están en cero, limpiar los inputs
        if (allZero) {
          newInputValues[salesKey] = '';
          newInputValues[prizesKey] = '';
        } else {
          newInputValues[salesKey] = (system.sales_usd || 0) > 0
            ? (system.sales_usd as number).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
            : "";

          newInputValues[prizesKey] = (system.prizes_usd || 0) > 0
            ? (system.prizes_usd as number).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
            : "";
        }
      });
      
      setInputValues(newInputValues);
      previousSystemsRef.current = systemsKey;
      isInitialMount.current = false;
    }
  }, [systems]);

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

  const calculateSystemTotals = (system: any) => {
    const sales = system.sales_usd || 0;
    const prizes = system.prizes_usd || 0;
    const cuadre = sales - prizes;
    
    // Usar comisión específica del cliente por sistema si existe, sino usar la global del sistema
    const systemConfig = clientSystemConfigs?.get(system.lottery_system_id);
    const commissionRate = commissions.get(system.lottery_system_id);
    const commissionPercentage = systemConfig?.commission_usd !== undefined && systemConfig.commission_usd > 0 
      ? systemConfig.commission_usd 
      : (commissionRate?.commission_percentage_usd || 0);
    const commission = sales * (commissionPercentage / 100);
    const subtotal = cuadre - commission;
    
    // Usar participación específica del sistema del cliente si existe, sino usar la global
    const participationPercentageValue = systemConfig?.participation_usd || participationPercentage;
    const participation = subtotal * (participationPercentageValue / 100);
    
    // Calcular participación de Lanave por sistema
    const lanaveParticipationPercentage = systemConfig?.lanave_participation_usd || clientLanaveParticipation?.lanave_participation_usd || 0;
    const lanaveParticipation = subtotal * (lanaveParticipationPercentage / 100);
    
    const finalTotal = subtotal - participation - lanaveParticipation;
    
    return {
      cuadre,
      commissionPercentage,
      commission,
      subtotal,
      participation,
      participationPercentageValue,
      lanaveParticipationPercentage,
      lanaveParticipation,
      finalTotal
    };
  };

  const calculateTotals = (): SystemTotals => {
    return systems.reduce<SystemTotals>(
      (acc, system) => {
        const sales = system.sales_usd || 0;
        const prizes = system.prizes_usd || 0;
        const totals = calculateSystemTotals(system);
        
        return {
          sales_usd: (acc.sales_usd || 0) + sales,
          prizes_usd: (acc.prizes_usd || 0) + prizes,
          cuadre: acc.cuadre + totals.cuadre,
          commission: acc.commission + totals.commission,
          subtotal: acc.subtotal + totals.subtotal,
          participation: acc.participation + totals.participation,
          lanaveParticipation: acc.lanaveParticipation + totals.lanaveParticipation,
          finalTotal: acc.finalTotal + totals.finalTotal,
        };
      },
      { sales_usd: 0, prizes_usd: 0, cuadre: 0, commission: 0, subtotal: 0, participation: 0, lanaveParticipation: 0, finalTotal: 0 }
    );
  };

  const totals = calculateTotals();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ventas y Premios en Dólares</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4">
          <div className="grid grid-cols-10 gap-2 text-xs font-medium text-muted-foreground border-b pb-2">
            <div>Sistema</div>
            <div className="text-center">Ventas</div>
            <div className="text-center">Premios</div>
            <div className="text-center">% Comisión</div>
            <div className="text-center">Comisión</div>
            <div className="text-center">% Participación</div>
            <div className="text-center">Participación</div>
            <div className="text-center">% Part. Lanave</div>
            <div className="text-center">Part. Lanave</div>
            <div className="text-center">Total Final</div>
          </div>

          {normalSystems.map((system) => {
            const index = systems.findIndex(s => s.lottery_system_id === system.lottery_system_id);
            const calcs = calculateSystemTotals(system);
            
            return (
              <div key={system.lottery_system_id} className="grid grid-cols-10 gap-2 items-center text-sm">
                <div className="font-medium text-xs">
                  {system.lottery_system_name}
                </div>
                
                <Input
                  type="text"
                  placeholder="0.00"
                  value={inputValues[`${system.lottery_system_id}-sales_usd`] || ''}
                  onChange={(e) => handleInputChange(system.lottery_system_id, index, 'sales_usd', e.target.value)}
                  onBlur={() => handleInputBlur(system.lottery_system_id, index, 'sales_usd')}
                  className="text-center h-8"
                />
                
                <Input
                  type="text"
                  placeholder="0.00"
                  value={inputValues[`${system.lottery_system_id}-prizes_usd`] || ''}
                  onChange={(e) => handleInputChange(system.lottery_system_id, index, 'prizes_usd', e.target.value)}
                  onBlur={() => handleInputBlur(system.lottery_system_id, index, 'prizes_usd')}
                  className="text-center h-8"
                />
                
                <div className="text-center text-muted-foreground text-xs">
                  {calcs.commissionPercentage.toFixed(2)}%
                </div>
                
                <div className="text-center font-bold bg-yellow-500/20 text-xs">
                  {formatCurrency(calcs.commission, 'USD')}
                </div>
                
                <div className="text-center text-muted-foreground text-xs">
                  {calcs.participationPercentageValue.toFixed(2)}%
                </div>
                
                <div className="text-center font-bold bg-emerald-500/20 text-xs">
                  {formatCurrency(calcs.participation, 'USD')}
                </div>
                
                <div className="text-center text-muted-foreground text-xs">
                  {calcs.lanaveParticipationPercentage.toFixed(2)}%
                </div>
                
                <div className="text-center font-bold bg-orange-500/20 text-xs">
                  {formatCurrency(calcs.lanaveParticipation, 'USD')}
                </div>
                
                <div className="text-center font-bold text-primary text-xs">
                  {formatCurrency(calcs.finalTotal, 'USD')}
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
              <div className="grid grid-cols-10 gap-2 text-xs font-medium text-muted-foreground border-b pb-2">
                <div>Sistema</div>
                <div className="text-center">Ventas</div>
                <div className="text-center">Premios</div>
                <div className="text-center">% Comisión</div>
                <div className="text-center">Comisión</div>
                <div className="text-center">% Participación</div>
                <div className="text-center">Participación</div>
                <div className="text-center">% Part. Lanave</div>
                <div className="text-center">Part. Lanave</div>
                <div className="text-center">Total Final</div>
              </div>

              {parleySystems.map((system) => {
                const index = systems.findIndex(s => s.lottery_system_id === system.lottery_system_id);
                const calcs = calculateSystemTotals(system);
                
                return (
                  <div key={system.lottery_system_id} className="grid grid-cols-10 gap-2 items-center text-sm">
                    <div className="font-medium text-xs">
                      {system.lottery_system_name}
                    </div>
                    
                    <Input
                      type="text"
                      placeholder="0.00"
                      value={inputValues[`${system.lottery_system_id}-sales_usd`] || ''}
                      onChange={(e) => handleInputChange(system.lottery_system_id, index, 'sales_usd', e.target.value)}
                      onBlur={() => handleInputBlur(system.lottery_system_id, index, 'sales_usd')}
                      className="text-center h-8"
                    />
                    
                    <Input
                      type="text"
                      placeholder="0.00"
                      value={inputValues[`${system.lottery_system_id}-prizes_usd`] || ''}
                      onChange={(e) => handleInputChange(system.lottery_system_id, index, 'prizes_usd', e.target.value)}
                      onBlur={() => handleInputBlur(system.lottery_system_id, index, 'prizes_usd')}
                      className="text-center h-8"
                    />
                    
                    <div className="text-center text-muted-foreground text-xs">
                      {calcs.commissionPercentage.toFixed(2)}%
                    </div>
                    
                    <div className="text-center font-bold bg-yellow-500/20 text-xs">
                      {formatCurrency(calcs.commission, 'USD')}
                    </div>
                    
                    <div className="text-center text-muted-foreground text-xs">
                      {calcs.participationPercentageValue.toFixed(2)}%
                    </div>
                    
                    <div className="text-center font-bold bg-emerald-500/20 text-xs">
                      {formatCurrency(calcs.participation, 'USD')}
                    </div>
                    
                    <div className="text-center text-muted-foreground text-xs">
                      {calcs.lanaveParticipationPercentage.toFixed(2)}%
                    </div>
                    
                    <div className="text-center font-bold bg-orange-500/20 text-xs">
                      {formatCurrency(calcs.lanaveParticipation, 'USD')}
                    </div>
                    
                    <div className="text-center font-bold text-primary text-xs">
                      {formatCurrency(calcs.finalTotal, 'USD')}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Totales Generales */}
        <Card className="bg-muted/30">
          <CardContent className="pt-6">
            <div className={`grid gap-4 text-center ${Math.abs(totals.participation) > 0.00001 ? 'grid-cols-7' : 'grid-cols-6'}`}>
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
                <p className="text-sm text-muted-foreground">Monto Comisión</p>
                <p className="text-xl font-bold text-yellow-600">
                  {formatCurrency(totals.commission, 'USD')}
                </p>
              </div>
              {Math.abs(totals.participation) > 0.00001 && (
                <div>
                  <p className="text-sm text-muted-foreground whitespace-nowrap">Com. Participación</p>
                  <p className="text-xl font-bold text-emerald-600">
                    {formatCurrency(totals.participation, 'USD')}
                  </p>
                </div>
              )}
              <div>
                <p className="text-sm text-muted-foreground">A Pagar</p>
                <p className="text-xl font-bold text-cyan-600">
                  {formatCurrency(totals.subtotal - totals.participation, 'USD')}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Part. Lanave</p>
                <p className="text-xl font-bold text-orange-600">
                  {formatCurrency(totals.lanaveParticipation, 'USD')}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Final</p>
                <p className="text-xl font-bold text-primary">
                  {formatCurrency(totals.finalTotal, 'USD')}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

      </CardContent>
    </Card>
  );
};

