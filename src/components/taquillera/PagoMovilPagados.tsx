import { useState, useEffect } from 'react';
import { getTodayVenezuela, formatDateForDB } from '@/lib/dateUtils';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { Textarea } from '@/components/ui/textarea';
import { ArrowUpRight, Plus, Minus, Save } from 'lucide-react';

// Helper function to update daily cuadres summary
const updateDailyCuadresSummary = async (sessionId: string, userId: string, sessionDate: string) => {
  // Get all data for this session
  const [salesRes, prizesRes, posRes, expensesRes, mobilePaymentsRes, sessionRes] = await Promise.all([
    supabase.from('sales_transactions').select('amount_bs, amount_usd').eq('session_id', sessionId),
    supabase.from('prize_transactions').select('amount_bs, amount_usd').eq('session_id', sessionId),
    supabase.from('point_of_sale').select('amount_bs').eq('session_id', sessionId),
    supabase.from('expenses').select('amount_bs, amount_usd, category').eq('session_id', sessionId),
    supabase.from('mobile_payments').select('amount_bs').eq('session_id', sessionId),
    supabase.from('daily_sessions').select('cash_available_bs, cash_available_usd, exchange_rate').eq('id', sessionId).single()
  ]);

  // Calculate totals
  const totalSalesBs = salesRes.data?.reduce((sum, item) => sum + Number(item.amount_bs), 0) || 0;
  const totalSalesUsd = salesRes.data?.reduce((sum, item) => sum + Number(item.amount_usd), 0) || 0;
  const totalPrizesBs = prizesRes.data?.reduce((sum, item) => sum + Number(item.amount_bs), 0) || 0;
  const totalPrizesUsd = prizesRes.data?.reduce((sum, item) => sum + Number(item.amount_usd), 0) || 0;
  const totalPosBs = posRes.data?.reduce((sum, item) => sum + Number(item.amount_bs), 0) || 0;
  
  // Calculate expenses by category
  const gastos = expensesRes.data?.filter(exp => exp.category === 'gasto_operativo') || [];
  const deudas = expensesRes.data?.filter(exp => exp.category === 'deuda') || [];
  
  const totalGastosBs = gastos.reduce((sum, item) => sum + Number(item.amount_bs), 0);
  const totalGastosUsd = gastos.reduce((sum, item) => sum + Number(item.amount_usd), 0);
  const totalDeudasBs = deudas.reduce((sum, item) => sum + Number(item.amount_bs), 0);
  const totalDeudasUsd = deudas.reduce((sum, item) => sum + Number(item.amount_usd), 0);
  
  // Calculate mobile payments
  const totalMobilePaymentsBs = mobilePaymentsRes.data?.reduce((sum, item) => sum + Number(item.amount_bs), 0) || 0;

  const sessionData = sessionRes.data;
  const cashAvailableBs = Number(sessionData?.cash_available_bs || 0);
  const cashAvailableUsd = Number(sessionData?.cash_available_usd || 0);
  const exchangeRate = Number(sessionData?.exchange_rate || 36);

  // Calculate cuadre and balance
  const cuadreVentasPremiosBs = totalSalesBs - totalPrizesBs;
  const cuadreVentasPremiosUsd = totalSalesUsd - totalPrizesUsd;
  const balanceBs = cuadreVentasPremiosBs - totalGastosBs - totalDeudasBs + totalMobilePaymentsBs + totalPosBs;

  // Upsert the summary
  await supabase
    .from('daily_cuadres_summary')
    .upsert({
      session_id: sessionId,
      user_id: userId,
      session_date: sessionDate,
      total_sales_bs: totalSalesBs,
      total_sales_usd: totalSalesUsd,
      total_prizes_bs: totalPrizesBs,
      total_prizes_usd: totalPrizesUsd,
      total_expenses_bs: totalGastosBs + totalDeudasBs,
      total_expenses_usd: totalGastosUsd + totalDeudasUsd,
      total_debt_bs: totalDeudasBs,
      total_debt_usd: totalDeudasUsd,
      total_mobile_payments_bs: totalMobilePaymentsBs,
      total_pos_bs: totalPosBs,
      cash_available_bs: cashAvailableBs,
      cash_available_usd: cashAvailableUsd,
      exchange_rate: exchangeRate,
      balance_bs: balanceBs
    }, { onConflict: 'session_id' });
};

interface PagoPagado {
  id: string;
  amount_bs: string;
  reference_number: string;
  description: string;
}

interface PagoMovilPagadosProps {
  onSuccess?: () => void;
  selectedAgency?: string;
  selectedDate?: Date;
  dateRange?: {
    from: Date;
    to: Date;
  };
}

export const PagoMovilPagados = ({ onSuccess, selectedAgency: propSelectedAgency, selectedDate: propSelectedDate, dateRange }: PagoMovilPagadosProps) => {
  const [loading, setLoading] = useState(false);
  const [isApproved, setIsApproved] = useState(false);
  const [pagos, setPagos] = useState<PagoPagado[]>([
    { id: '1', amount_bs: '', reference_number: '', description: '' }
  ]);
  
  const { user } = useAuth();
  const { toast } = useToast();
  
  // Verificar estado de aprobación cuando cambie la fecha o el usuario
  useEffect(() => {
    const checkApprovalStatus = async () => {
      if (!user || propSelectedAgency || !dateRange) {
        setIsApproved(false);
        return;
      }
      
      const today = formatDateForDB(dateRange.from);
      const { data: session } = await supabase
        .from('daily_sessions')
        .select('id')
        .eq('user_id', user.id)
        .eq('session_date', today)
        .maybeSingle();
      
      if (session) {
        const { data: cuadreSummary } = await supabase
          .from('daily_cuadres_summary')
          .select('encargada_status')
          .eq('session_id', session.id)
          .maybeSingle();
        
        setIsApproved(cuadreSummary?.encargada_status === 'aprobado');
      } else {
        setIsApproved(false);
      }
    };
    
    checkApprovalStatus();
  }, [user, dateRange]);

  const addPago = () => {
    setPagos(prev => [...prev, { 
      id: Date.now().toString(), 
      amount_bs: '', 
      reference_number: '', 
      description: '' 
    }]);
  };

  const removePago = (id: string) => {
    if (pagos.length > 1) {
      setPagos(prev => prev.filter(p => p.id !== id));
    }
  };

  const updatePago = (id: string, field: keyof PagoPagado, value: string) => {
    setPagos(prev => prev.map(p => 
      p.id === id ? { ...p, [field]: value } : p
    ));
  };

  const onSubmit = async () => {
    if (!user) return;
    
    // No permitir guardar si está aprobado (solo para taquilleras)
    if (!propSelectedAgency && isApproved) {
      toast({
        title: 'Cuadre Aprobado',
        description: 'Este cuadre ya fue aprobado y no se puede modificar',
        variant: 'destructive',
      });
      return;
    }

    // Validate all fields
    const validPagos = pagos.filter(p => {
      if (!p.amount_bs) return false;
      // Parse Venezuelan format correctly
      const cleanAmount = p.amount_bs.replace(/\./g, '').replace(',', '.');
      return parseFloat(cleanAmount) > 0;
    });

    if (validPagos.length === 0) {
      toast({
        title: 'Error',
        description: 'Debes agregar al menos un pago válido',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      // Use the selected date if provided, otherwise use dateRange or today
      const transactionDate = propSelectedDate 
        ? format(propSelectedDate, 'yyyy-MM-dd')
        : dateRange 
        ? format(dateRange.from, 'yyyy-MM-dd') 
        : getTodayVenezuela();
      
      let sessionId = null;
      
      // If no agency is provided (taquillera mode), use session
      if (!propSelectedAgency) {
        let { data: session, error: sessionError } = await supabase
          .from('daily_sessions')
          .select('id')
          .eq('user_id', user.id)
          .eq('session_date', transactionDate)
          .maybeSingle();

        if (!session) {
          // Session doesn't exist, create it
          const { data: newSession, error: createError } = await supabase
            .from('daily_sessions')
            .insert({
              user_id: user.id,
              session_date: transactionDate,
            })
            .select('id')
            .single();

          if (createError) throw createError;
          session = newSession;
        }
        
        sessionId = session.id;
      }

      // Prepare payments for insertion (negative amounts for paid out)
      const paymentsToInsert = validPagos.map(pago => {
        // Parse Venezuelan format: remove thousand separators (.) and replace decimal (,) with (.)
        const cleanAmount = pago.amount_bs.replace(/\./g, '').replace(',', '.');
        const parsedAmount = parseFloat(cleanAmount);
        
        return {
          session_id: sessionId,
          agency_id: propSelectedAgency || null,
          transaction_date: transactionDate,
          amount_bs: -Math.abs(parsedAmount),
          reference_number: pago.reference_number,
          description: pago.description ? `[PAGADO] ${pago.description}` : '[PAGADO]',
        };
      });

      // Insert all payments
      const { error } = await supabase
        .from('mobile_payments')
        .insert(paymentsToInsert);

      if (error) throw error;

      // Update daily cuadres summary only if we have a session
      if (sessionId) {
        await updateDailyCuadresSummary(sessionId, user.id, transactionDate);
      } else if (propSelectedAgency) {
        // Encargada mode: update agency-level daily summary (session_id = null)
        const [{ data: mpData }, { data: existingSummary }] = await Promise.all([
          supabase
            .from('mobile_payments')
            .select('amount_bs')
            .eq('agency_id', propSelectedAgency)
            .eq('transaction_date', transactionDate),
          supabase
            .from('daily_cuadres_summary')
            .select('id')
            .eq('agency_id', propSelectedAgency)
            .eq('session_date', transactionDate)
            .is('session_id', null)
            .maybeSingle(),
        ]);

        const totalMobile = mpData?.reduce((sum, i) => sum + Number(i.amount_bs), 0) || 0;

        if (existingSummary) {
          await supabase
            .from('daily_cuadres_summary')
            .update({ total_mobile_payments_bs: totalMobile })
            .eq('id', existingSummary.id);
        } else {
          await supabase
            .from('daily_cuadres_summary')
            .insert({
              user_id: user.id,
              agency_id: propSelectedAgency,
              session_date: transactionDate,
              total_mobile_payments_bs: totalMobile,
            });
        }
      }

      toast({
        title: 'Éxito',
        description: `${validPagos.length} pago${validPagos.length > 1 ? 's' : ''} móvil${validPagos.length > 1 ? 'es' : ''} pagado${validPagos.length > 1 ? 's' : ''} registrado${validPagos.length > 1 ? 's' : ''} correctamente`,
      });

      // Reset form
      setPagos([{ id: '1', amount_bs: '', reference_number: '', description: '' }]);
      
      onSuccess?.();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Error al registrar los pagos móviles',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Add button */}
      <div className="flex justify-between items-center">
        <Label className="text-sm font-medium">Pagos Móviles Pagados</Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addPago}
          disabled={isApproved && !propSelectedAgency}
        >
          <Plus className="h-4 w-4 mr-1" />
          Agregar Pago
        </Button>
      </div>

      {/* Payment forms */}
      <div className="space-y-4">
        {pagos.map((pago, index) => (
          <Card key={pago.id}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Pago {index + 1}</CardTitle>
                {pagos.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removePago(pago.id)}
                    disabled={isApproved && !propSelectedAgency}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Monto (Bs)</Label>
                  <Input
                    type="text"
                    placeholder="0,00"
                    value={pago.amount_bs}
                    onChange={(e) => updatePago(pago.id, 'amount_bs', e.target.value)}
                    onBlur={(e) => {
                      const cleanValue = e.target.value.replace(/[^\d,]/g, '');
                      const numValue = parseFloat(cleanValue.replace(',', '.')) || 0;
                      const formatted = numValue > 0 ? numValue.toLocaleString('es-VE', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      }) : '';
                      updatePago(pago.id, 'amount_bs', formatted);
                    }}
                    disabled={isApproved && !propSelectedAgency}
                    readOnly={isApproved && !propSelectedAgency}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Referencia</Label>
                  <Input
                    placeholder="987654321"
                    value={pago.reference_number}
                    onChange={(e) => updatePago(pago.id, 'reference_number', e.target.value)}
                    disabled={isApproved && !propSelectedAgency}
                    readOnly={isApproved && !propSelectedAgency}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Descripción</Label>
                  <Input
                    placeholder="Premio, cliente..."
                    value={pago.description}
                    onChange={(e) => updatePago(pago.id, 'description', e.target.value)}
                    disabled={isApproved && !propSelectedAgency}
                    readOnly={isApproved && !propSelectedAgency}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Submit button */}
      <Button onClick={onSubmit} disabled={loading || (isApproved && !propSelectedAgency)} className="w-full" size="lg">
        <Save className="h-4 w-4 mr-2" />
        {loading ? 'Registrando...' : (isApproved && !propSelectedAgency) ? 'Cuadre Aprobado - No se puede modificar' : `Registrar ${pagos.length} Pago${pagos.length > 1 ? 's' : ''} Pagado${pagos.length > 1 ? 's' : ''}`}
      </Button>
    </div>
  );
};