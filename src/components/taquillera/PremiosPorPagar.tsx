import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/utils';
import { formatDateForDB, getStartOfDayVenezuela, fromVenezuelaTime } from '@/lib/dateUtils';
import { Plus, Minus, Save } from 'lucide-react';
import { useCuadreLock } from '@/hooks/useCuadreLock';

interface Premio {
  id?: string;
  amount: string;
  description: string;
}

interface PremiosPorPagarProps {
  onSuccess?: () => void;
  mode: 'pending' | 'paid'; // pending = por pagar, paid = pagados
  dateRange?: {
    from: Date;
    to: Date;
  };
  overrideUserId?: string; // Para que la encargada pueda gestionar premios de otras taquilleras
}

// Helper function to update daily_cuadres_summary similar to PagoMovil components
const updateDailyCuadresSummary = async (sessionId: string) => {
  // Get session info
  const { data: session } = await supabase
    .from('daily_sessions')
    .select('*')
    .eq('id', sessionId)
    .single();

  if (!session) return;

  // Fetch all data for this session
  const [salesData, prizesData, expensesData, mobilePaymentsData, posData, pendingPrizesData] = await Promise.all([
    supabase.from('sales_transactions').select('amount_bs, amount_usd').eq('session_id', sessionId),
    supabase.from('prize_transactions').select('amount_bs, amount_usd').eq('session_id', sessionId),
    supabase.from('expenses').select('amount_bs, amount_usd, category').eq('session_id', sessionId),
    supabase.from('mobile_payments').select('amount_bs').eq('session_id', sessionId),
    supabase.from('point_of_sale').select('amount_bs').eq('session_id', sessionId),
    supabase.from('pending_prizes').select('amount_bs, is_paid').eq('session_id', sessionId),
  ]);

  // Calculate totals
  const totalSales = { 
    bs: salesData.data?.reduce((sum, item) => sum + Number(item.amount_bs || 0), 0) || 0,
    usd: salesData.data?.reduce((sum, item) => sum + Number(item.amount_usd || 0), 0) || 0,
  };

  const totalPrizes = { 
    bs: prizesData.data?.reduce((sum, item) => sum + Number(item.amount_bs || 0), 0) || 0,
    usd: prizesData.data?.reduce((sum, item) => sum + Number(item.amount_usd || 0), 0) || 0,
  };

  const totalExpensesOperational = expensesData.data?.filter(e => e.category === 'gasto_operativo')
    .reduce((sum, item) => sum + Number(item.amount_bs || 0), 0) || 0;
  const totalExpensesDebt = expensesData.data?.filter(e => e.category === 'deuda')
    .reduce((sum, item) => sum + Number(item.amount_bs || 0), 0) || 0;
  const totalExpensesUsd = expensesData.data?.reduce((sum, item) => sum + Number(item.amount_usd || 0), 0) || 0;

  const totalMobilePayments = mobilePaymentsData.data?.reduce((sum, item) => sum + Number(item.amount_bs || 0), 0) || 0;
  const totalPos = posData.data?.reduce((sum, item) => sum + Number(item.amount_bs || 0), 0) || 0;

  // Calculate pending prizes totals
  const pendingPrizesTotal = pendingPrizesData.data?.filter(p => !p.is_paid)
    .reduce((sum, item) => sum + Number(item.amount_bs || 0), 0) || 0;

  // Calculate balance
  const cuadreVentasPremios = totalSales.bs - totalPrizes.bs;
  const totalBanco = totalMobilePayments + totalPos;
  const excessUsd = session.cash_available_usd - (totalSales.usd - totalPrizes.usd);
  const sumatoriaBolivares = session.cash_available_bs + totalBanco + totalExpensesDebt + totalExpensesOperational + (excessUsd * session.exchange_rate);
  const balanceBeforePending = sumatoriaBolivares - cuadreVentasPremios;
  const finalBalance = balanceBeforePending - pendingPrizesTotal;

  // Get user's agency_id
  const { data: profile } = await supabase
    .from('profiles')
    .select('agency_id')
    .eq('user_id', session.user_id)
    .single();

  // Update summary
  await supabase
    .from('daily_cuadres_summary')
    .upsert({
      session_id: sessionId,
      user_id: session.user_id,
      session_date: session.session_date,
      agency_id: profile?.agency_id,
      total_sales_bs: totalSales.bs,
      total_sales_usd: totalSales.usd,
      total_prizes_bs: totalPrizes.bs,
      total_prizes_usd: totalPrizes.usd,
      total_expenses_bs: totalExpensesOperational + totalExpensesDebt,
      total_expenses_usd: totalExpensesUsd,
      total_debt_bs: totalExpensesDebt,
      total_debt_usd: totalExpensesUsd,
      total_mobile_payments_bs: totalMobilePayments,
      total_pos_bs: totalPos,
      cash_available_bs: session.cash_available_bs,
      cash_available_usd: session.cash_available_usd,
      exchange_rate: session.exchange_rate,
      pending_prizes: pendingPrizesTotal,
      balance_before_pending_prizes_bs: balanceBeforePending,
      balance_bs: finalBalance,
      excess_usd: excessUsd,
      diferencia_final: finalBalance,
      is_closed: session.is_closed,
      daily_closure_confirmed: session.daily_closure_confirmed,
    }, { onConflict: 'session_id' });
};

export const PremiosPorPagar = ({ onSuccess, mode, dateRange, overrideUserId }: PremiosPorPagarProps) => {
  const [premios, setPremios] = useState<Premio[]>([{ amount: '', description: '' }]);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();
  
  // Usar el user_id override si está disponible (para encargadas), si no usar el usuario actual
  const effectiveUserId = overrideUserId || user?.id;
  
  const { isLocked, isApproved } = useCuadreLock({
    userId: effectiveUserId,
    dateRange,
    selectedAgency: overrideUserId ? 'override' : undefined, // Si hay override, no bloquear
    isTaquillera: !overrideUserId,
  });

  const addPremio = () => {
    setPremios([...premios, { amount: '', description: '' }]);
  };

  const removePremio = (index: number) => {
    if (premios.length > 1) {
      setPremios(premios.filter((_, i) => i !== index));
    }
  };

  const updatePremio = (index: number, field: keyof Premio, value: string) => {
    const updatedPremios = [...premios];
    updatedPremios[index] = { ...updatedPremios[index], [field]: value };
    setPremios(updatedPremios);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!effectiveUserId || !dateRange) {
      toast({
        title: 'Error',
        description: 'Usuario o fecha no válidos',
        variant: 'destructive',
      });
      return;
    }
    
    // No permitir guardar si está bloqueado
    if (isLocked) {
      toast({
        title: isApproved ? 'Cuadre Aprobado' : 'Cuadre Pendiente de Revisión',
        description: 'Este cuadre no se puede modificar',
        variant: 'destructive',
      });
      return;
    }

    const validPremios = premios.filter(p => p.amount && parseFloat(p.amount) > 0);
    
    if (validPremios.length === 0) {
      toast({
        title: 'Error',
        description: 'Debe agregar al menos un premio válido',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const currentDate = formatDateForDB(dateRange.from);
      
      // Get or create daily session
      let { data: session } = await supabase
        .from('daily_sessions')
        .select('id')
        .eq('user_id', effectiveUserId)
        .eq('session_date', currentDate)
        .single();

      if (!session) {
        const { data: newSession, error: createError } = await supabase
          .from('daily_sessions')
          .insert({
            user_id: effectiveUserId,
            session_date: currentDate,
            cash_available_bs: 0,
            cash_available_usd: 0,
            exchange_rate: 36.00,
          })
          .select('id')
          .single();

        if (createError) throw createError;
        session = newSession;
      }

      // Prepare premio data
      const prizeTimestamp = fromVenezuelaTime(getStartOfDayVenezuela(dateRange.from));
      const premioData = validPremios.map(premio => ({
        session_id: session.id,
        amount_bs: parseFloat(premio.amount),
        description: premio.description || '',
        is_paid: mode === 'paid',
        created_at: prizeTimestamp.toISOString(),
        updated_at: prizeTimestamp.toISOString(),
      }));

      // Insert premios
      const { error: insertError } = await supabase
        .from('pending_prizes')
        .insert(premioData);

      if (insertError) throw insertError;

      // Update daily cuadres summary
      await updateDailyCuadresSummary(session.id);

      toast({
        title: 'Éxito',
        description: `${mode === 'pending' ? 'Premios por pagar' : 'Premios pagados'} registrados correctamente`,
      });

      // Reset form
      setPremios([{ amount: '', description: '' }]);
      onSuccess?.();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Error al registrar los premios',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const totalAmount = premios.reduce((sum, premio) => {
    const amount = parseFloat(premio.amount) || 0;
    return sum + amount;
  }, 0);

  const title = mode === 'pending' ? 'Premios por Pagar' : 'Premios Pagados';
  const description = mode === 'pending' 
    ? 'Registra los premios pendientes de pago' 
    : 'Registra los premios que ya fueron pagados';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          {title}
          {totalAmount > 0 && (
            <Badge variant="secondary">
              Total: {formatCurrency(totalAmount)}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <p className="text-sm text-muted-foreground mb-4">
            {description}
          </p>
          
          {premios.map((premio, index) => (
            <div key={index}>
              {index > 0 && <Separator className="my-4" />}
              
              <div className="flex items-start gap-4">
                <div className="flex-1 space-y-3">
                  <div>
                    <Label htmlFor={`amount-${index}`}>Monto (Bs)</Label>
                    <Input
                      id={`amount-${index}`}
                      type="number"
                      step="0.01"
                      value={premio.amount}
                      onChange={(e) => updatePremio(index, 'amount', e.target.value)}
                      placeholder="0.00"
                      required
                      disabled={isLocked}
                      readOnly={isLocked}
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor={`description-${index}`}>Descripción</Label>
                    <Textarea
                      id={`description-${index}`}
                      value={premio.description}
                      onChange={(e) => updatePremio(index, 'description', e.target.value)}
                      placeholder="Detalles del premio..."
                      rows={2}
                      disabled={isLocked}
                      readOnly={isLocked}
                    />
                  </div>
                </div>
                
                <div className="flex gap-2 pt-6">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addPremio}
                    disabled={isLocked}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                  
                  {premios.length > 1 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => removePremio(index)}
                      disabled={isLocked}
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
          
          <Separator />
          
          <Button
            type="submit"
            disabled={loading || totalAmount === 0 || isLocked}
            className="w-full"
          >
            <Save className="h-4 w-4 mr-2" />
            {loading ? 'Guardando...' : isLocked ? (isApproved ? 'Cuadre Aprobado - No se puede modificar' : 'Cuadre Pendiente de Revisión') : `Guardar ${title}`}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};