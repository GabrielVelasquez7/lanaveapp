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

interface BanqueoVentasPremiosBolivaresProps {
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

export const BanqueoVentasPremiosBolivares = ({
  form, 
  lotteryOptions, 
  commissions,
  participationPercentage,
  clientSystemConfigs,
  clientLanaveParticipation
}: BanqueoVentasPremiosBolivaresProps) => {
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
    if (!value || value.trim() === '') return 0;

    // Remover caracteres que no sean dígitos, puntos o comas
    const cleanValue = value.replace(/[^\d.,]/g, '');

    // Para formato es-VE: punto es separador de miles, coma es separador decimal
    if (cleanValue.includes(',')) {
      // Tomar la última coma como separador decimal
      const lastCommaIndex = cleanValue.lastIndexOf(',');
      const beforeComma = cleanValue.substring(0, lastCommaIndex);
      const afterComma = cleanValue.substring(lastCommaIndex + 1);

      // Remover todos los puntos (separadores de miles) en la parte entera
      const integerPart = beforeComma.replace(/\./g, '');
      const normalizedValue = `${integerPart}.${afterComma}`;
      const num = parseFloat(normalizedValue);
      return isNaN(num) ? 0 : num;
    }

    // Si no hay coma pero sí puntos, pueden ser miles o decimal
    if (cleanValue.includes('.')) {
      const lastDotIndex = cleanValue.lastIndexOf('.');
      const afterDot = cleanValue.substring(lastDotIndex + 1);

      // Si después del último punto hay 1 o 2 dígitos, tratarlo como decimal
      if (afterDot.length > 0 && afterDot.length <= 2) {
        const beforeDot = cleanValue.substring(0, lastDotIndex).replace(/\./g, '');
        const normalizedValue = `${beforeDot}.${afterDot}`;
        const num = parseFloat(normalizedValue);
        return isNaN(num) ? 0 : num;
      }

      // Si no, tratar todos los puntos como separadores de miles
      const normalizedValue = cleanValue.replace(/\./g, '');
      const num = parseFloat(normalizedValue);
      return isNaN(num) ? 0 : num;
    }

    // Sin separadores, número entero simple
    const num = parseFloat(cleanValue);
    return isNaN(num) ? 0 : num;
  };

  // Sincronizar inputValues cuando cambian los sistemas del formulario
  useEffect(() => {
    const systemsKey = systems.map(s => `${s.lottery_system_id}-${s.sales_bs}-${s.prizes_bs}`).join(',');

    // Detectar si todos los sistemas están en cero (formulario reseteado)
    const allZero = systems.every(s => 
      (s.sales_bs || 0) === 0 && (s.prizes_bs || 0) === 0
    );

    // Si todos están en cero o el key cambió, actualizar los inputs
    if (allZero || isInitialMount.current || previousSystemsRef.current !== systemsKey) {
      const newInputValues: Record<string, string> = {};

      systems.forEach((system) => {
        const id = system.lottery_system_id;
        const salesKey = `${id}-sales_bs`;
        const prizesKey = `${id}-prizes_bs`;

        // Si todos están en cero, limpiar los inputs
        if (allZero) {
          newInputValues[salesKey] = '';
          newInputValues[prizesKey] = '';
        } else {
          newInputValues[salesKey] = (system.sales_bs || 0) > 0
            ? (system.sales_bs as number).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
            : '';

          newInputValues[prizesKey] = (system.prizes_bs || 0) > 0
            ? (system.prizes_bs as number).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
            : '';
        }
      });

      setInputValues(newInputValues);
      previousSystemsRef.current = systemsKey;
      isInitialMount.current = false;
    }
  }, [systems]);

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

  const calculateSystemTotals = (system: any) => {
    const sales = system.sales_bs || 0;
    const prizes = system.prizes_bs || 0;
    const cuadre = sales - prizes;
    
    // Usar comisión específica del cliente por sistema si existe, sino usar la global del sistema
    const systemConfig = clientSystemConfigs?.get(system.lottery_system_id);
    const commissionRate = commissions.get(system.lottery_system_id);
    const commissionPercentage = systemConfig?.commission_bs !== undefined && systemConfig.commission_bs > 0 
      ? systemConfig.commission_bs 
      : (commissionRate?.commission_percentage || 0);
    const commission = sales * (commissionPercentage / 100);
    const subtotal = cuadre - commission;
    
    // Usar participación específica del sistema del cliente si existe, sino usar la global
    const participationPercentageValue = systemConfig?.participation_bs || participationPercentage;
    const participation = subtotal * (participationPercentageValue / 100);
    
    // Calcular participación de Lanave por sistema
    const lanaveParticipationPercentage = systemConfig?.lanave_participation_bs || clientLanaveParticipation?.lanave_participation_bs || 0;
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
    return normalSystems.reduce<SystemTotals>(
      (acc, system) => {
        const sales = system.sales_bs || 0;
        const prizes = system.prizes_bs || 0;
        const totals = calculateSystemTotals(system);
        
        return {
          sales_bs: (acc.sales_bs || 0) + sales,
          prizes_bs: (acc.prizes_bs || 0) + prizes,
          cuadre: acc.cuadre + totals.cuadre,
          commission: acc.commission + totals.commission,
          subtotal: acc.subtotal + totals.subtotal,
          participation: acc.participation + totals.participation,
          lanaveParticipation: acc.lanaveParticipation + totals.lanaveParticipation,
          finalTotal: acc.finalTotal + totals.finalTotal,
        };
      },
      { sales_bs: 0, prizes_bs: 0, cuadre: 0, commission: 0, subtotal: 0, participation: 0, lanaveParticipation: 0, finalTotal: 0 }
    );
  };

  const totals = calculateTotals();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ventas y Premios en Bolívares</CardTitle>
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
                  placeholder="0,00"
                  value={inputValues[`${system.lottery_system_id}-sales_bs`] || ''}
                  onChange={(e) => handleInputChange(system.lottery_system_id, index, 'sales_bs', e.target.value)}
                  onBlur={() => handleInputBlur(system.lottery_system_id, index, 'sales_bs')}
                  className="text-center h-8"
                />
                
                <Input
                  type="text"
                  placeholder="0,00"
                  value={inputValues[`${system.lottery_system_id}-prizes_bs`] || ''}
                  onChange={(e) => handleInputChange(system.lottery_system_id, index, 'prizes_bs', e.target.value)}
                  onBlur={() => handleInputBlur(system.lottery_system_id, index, 'prizes_bs')}
                  className="text-center h-8"
                />
                
                <div className="text-center text-muted-foreground text-xs">
                  {calcs.commissionPercentage.toFixed(2)}%
                </div>
                
                <div className="text-center font-bold bg-yellow-500/20 text-xs">
                  {formatCurrency(calcs.commission, 'VES')}
                </div>
                
                <div className="text-center text-muted-foreground text-xs">
                  {calcs.participationPercentageValue.toFixed(2)}%
                </div>
                
                <div className="text-center font-bold bg-emerald-500/20 text-xs">
                  {formatCurrency(calcs.participation, 'VES')}
                </div>
                
                <div className="text-center text-muted-foreground text-xs">
                  {calcs.lanaveParticipationPercentage.toFixed(2)}%
                </div>
                
                <div className="text-center font-bold bg-orange-500/20 text-xs">
                  {formatCurrency(calcs.lanaveParticipation, 'VES')}
                </div>
                
                <div className="text-center font-bold text-primary text-xs">
                  {formatCurrency(calcs.finalTotal, 'VES')}
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
                      placeholder="0,00"
                      value={inputValues[`${system.lottery_system_id}-sales_bs`] || ''}
                      onChange={(e) => handleInputChange(system.lottery_system_id, index, 'sales_bs', e.target.value)}
                      onBlur={() => handleInputBlur(system.lottery_system_id, index, 'sales_bs')}
                      className="text-center h-8"
                    />
                    
                    <Input
                      type="text"
                      placeholder="0,00"
                      value={inputValues[`${system.lottery_system_id}-prizes_bs`] || ''}
                      onChange={(e) => handleInputChange(system.lottery_system_id, index, 'prizes_bs', e.target.value)}
                      onBlur={() => handleInputBlur(system.lottery_system_id, index, 'prizes_bs')}
                      className="text-center h-8"
                    />
                    
                    <div className="text-center text-muted-foreground text-xs">
                      {calcs.commissionPercentage.toFixed(2)}%
                    </div>
                    
                    <div className="text-center font-bold bg-yellow-500/20 text-xs">
                      {formatCurrency(calcs.commission, 'VES')}
                    </div>
                    
                    <div className="text-center text-muted-foreground text-xs">
                      {calcs.participationPercentageValue.toFixed(2)}%
                    </div>
                    
                    <div className="text-center font-bold bg-emerald-500/20 text-xs">
                      {formatCurrency(calcs.participation, 'VES')}
                    </div>
                    
                    <div className="text-center text-muted-foreground text-xs">
                      {calcs.lanaveParticipationPercentage.toFixed(2)}%
                    </div>
                    
                    <div className="text-center font-bold bg-orange-500/20 text-xs">
                      {formatCurrency(calcs.lanaveParticipation, 'VES')}
                    </div>
                    
                    <div className="text-center font-bold text-primary text-xs">
                      {formatCurrency(calcs.finalTotal, 'VES')}
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
                <p className="text-sm text-muted-foreground">Monto Comisión</p>
                <p className="text-xl font-bold text-yellow-600">
                  {formatCurrency(totals.commission, 'VES')}
                </p>
              </div>
              {Math.abs(totals.participation) > 0.00001 && (
                <div>
                  <p className="text-sm text-muted-foreground whitespace-nowrap">Com. Participación</p>
                  <p className="text-xl font-bold text-emerald-600">
                    {formatCurrency(totals.participation, 'VES')}
                  </p>
                </div>
              )}
              <div>
                <p className="text-sm text-muted-foreground">A Pagar</p>
                <p className="text-xl font-bold text-cyan-600">
                  {formatCurrency(totals.subtotal, 'VES')}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Part. Lanave</p>
                <p className="text-xl font-bold text-orange-600">
                  {formatCurrency(totals.lanaveParticipation, 'VES')}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Final</p>
                <p className="text-xl font-bold text-primary">
                  {formatCurrency(totals.finalTotal, 'VES')}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

      </CardContent>
    </Card>
  );
};

