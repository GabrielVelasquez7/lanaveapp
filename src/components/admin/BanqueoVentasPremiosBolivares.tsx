import { UseFormReturn } from 'react-hook-form';
import { useState, useEffect } from 'react';
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
  onParticipationChange: (value: number) => void;
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
  finalTotal: number;
}

export const BanqueoVentasPremiosBolivares = ({
  form, 
  lotteryOptions, 
  commissions,
  participationPercentage,
  onParticipationChange 
}: BanqueoVentasPremiosBolivaresProps) => {
  const systems = form.watch('systems');
  const [inputValues, setInputValues] = useState<Record<string, string>>({});

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

  // Sincroniza los inputs cuando cambian los valores del formulario
  useEffect(() => {
    const newInputValues: Record<string, string> = {};
    systems.forEach((system) => {
      const id = system.lottery_system_id;
      const salesKey = `${id}-sales_bs`;
      const prizesKey = `${id}-prizes_bs`;

      newInputValues[salesKey] = (system.sales_bs || 0) > 0
        ? (system.sales_bs as number).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : '';

      newInputValues[prizesKey] = (system.prizes_bs || 0) > 0
        ? (system.prizes_bs as number).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
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

  const calculateSystemTotals = (system: any) => {
    const sales = system.sales_bs || 0;
    const prizes = system.prizes_bs || 0;
    const cuadre = sales - prizes;
    
    const commissionRate = commissions.get(system.lottery_system_id);
    const commissionPercentage = commissionRate?.commission_percentage || 0;
    const commission = sales * (commissionPercentage / 100);
    const subtotal = cuadre - commission;
    const participation = subtotal * (participationPercentage / 100);
    const finalTotal = subtotal - participation;
    
    return {
      cuadre,
      commissionPercentage,
      commission,
      subtotal,
      participation,
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
          finalTotal: acc.finalTotal + totals.finalTotal,
        };
      },
      { sales_bs: 0, prizes_bs: 0, cuadre: 0, commission: 0, subtotal: 0, participation: 0, finalTotal: 0 }
    );
  };

  const totals = calculateTotals();

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Ventas y Premios en Bolívares</CardTitle>
          <div className="flex items-center gap-2">
            <label className="text-sm text-muted-foreground">% Participación:</label>
            <Input
              type="number"
              step="0.01"
              min="0"
              max="100"
              value={participationPercentage}
              onChange={(e) => onParticipationChange(parseFloat(e.target.value) || 0)}
              className="w-20 text-center"
            />
            <span className="text-sm">%</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4">
          <div className="grid grid-cols-8 gap-2 text-xs font-medium text-muted-foreground border-b pb-2">
            <div>Sistema</div>
            <div className="text-center">Ventas</div>
            <div className="text-center">Premios</div>
            <div className="text-center">Cuadre</div>
            <div className="text-center">% Comisión</div>
            <div className="text-center">Comisión</div>
            <div className="text-center">% Participación</div>
            <div className="text-center">Total Final</div>
          </div>

          {normalSystems.map((system) => {
            const index = systems.findIndex(s => s.lottery_system_id === system.lottery_system_id);
            const calcs = calculateSystemTotals(system);
            
            return (
              <div key={system.lottery_system_id} className="grid grid-cols-8 gap-2 items-center text-sm">
                <div className="font-medium">
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
                
                <div className={`text-center font-semibold ${calcs.cuadre >= 0 ? 'text-success' : 'text-destructive'}`}>
                  {formatCurrency(calcs.cuadre, 'VES')}
                </div>
                
                <div className="text-center text-muted-foreground">
                  {calcs.commissionPercentage.toFixed(2)}%
                </div>
                
                <div className="text-center font-bold bg-yellow-500/20">
                  {formatCurrency(calcs.commission, 'VES')}
                </div>
                
                <div className="text-center text-muted-foreground">
                  {participationPercentage.toFixed(2)}%
                </div>
                
                <div className="text-center font-bold text-primary">
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
              <div className="grid grid-cols-8 gap-2 text-xs font-medium text-muted-foreground border-b pb-2">
                <div>Sistema</div>
                <div className="text-center">Ventas</div>
                <div className="text-center">Premios</div>
                <div className="text-center">Cuadre</div>
                <div className="text-center">% Comisión</div>
                <div className="text-center">Comisión</div>
                <div className="text-center">% Participación</div>
                <div className="text-center">Total Final</div>
              </div>

              {parleySystems.map((system) => {
                const index = systems.findIndex(s => s.lottery_system_id === system.lottery_system_id);
                const calcs = calculateSystemTotals(system);
                
                return (
                  <div key={system.lottery_system_id} className="grid grid-cols-8 gap-2 items-center text-sm">
                    <div className="font-medium">
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
                    
                    <div className={`text-center font-semibold ${calcs.cuadre >= 0 ? 'text-success' : 'text-destructive'}`}>
                      {formatCurrency(calcs.cuadre, 'VES')}
                    </div>
                    
                    <div className="text-center text-muted-foreground">
                      {calcs.commissionPercentage.toFixed(2)}%
                    </div>
                    
                    <div className="text-center font-bold bg-yellow-500/20">
                      {formatCurrency(calcs.commission, 'VES')}
                    </div>
                    
                    <div className="text-center text-muted-foreground">
                      {participationPercentage.toFixed(2)}%
                    </div>
                    
                    <div className="text-center font-bold text-primary">
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
            <div className="grid grid-cols-4 gap-4 text-center">
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
                <p className={`text-xl font-bold ${totals.cuadre >= 0 ? 'text-success' : 'text-destructive'}`}>
                  {formatCurrency(totals.cuadre, 'VES')}
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

