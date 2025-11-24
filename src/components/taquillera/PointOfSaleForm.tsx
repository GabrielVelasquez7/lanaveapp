import { getTodayVenezuela, formatDateForDB } from '@/lib/dateUtils';
import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { formatCurrency } from '@/lib/utils';
import { Edit2, Trash2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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
  
  // Calculate mobile payments (assuming there's a way to distinguish received vs paid)
  // For now, treating all mobile payments as received
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

const posSchema = z.object({
  amount_bs: z.number().min(0, 'Monto debe ser positivo'),
});

type POSForm = z.infer<typeof posSchema>;

interface PointOfSaleFormProps {
  dateRange?: {
    from: Date;
    to: Date;
  };
}

export const PointOfSaleForm = ({ dateRange }: PointOfSaleFormProps) => {
  const [loading, setLoading] = useState(false);
  const [currentAmount, setCurrentAmount] = useState<number>(0);
  const [hasEntry, setHasEntry] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [currentPosId, setCurrentPosId] = useState<string | null>(null);
  const [isApproved, setIsApproved] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  const form = useForm<POSForm>({
    resolver: zodResolver(posSchema),
    defaultValues: {
      amount_bs: 0,
    },
  });

  useEffect(() => {
    fetchCurrentPOS();
  }, [user, dateRange]);

  const fetchCurrentPOS = async () => {
    if (!user || !dateRange) return;

    try {
      // Use the selected date from dateRange
      const targetDate = formatDateForDB(dateRange.from);
      
      // Get session for the selected date
      const { data: session } = await supabase
        .from('daily_sessions')
        .select('id')
        .eq('user_id', user.id)
        .eq('session_date', targetDate)
        .maybeSingle();

      if (session) {
        const { data: posData } = await supabase
          .from('point_of_sale')
          .select('id, amount_bs')
          .eq('session_id', session.id)
          .maybeSingle();

        if (posData) {
          setCurrentPosId(posData.id);
          setCurrentAmount(Number(posData.amount_bs));
          setHasEntry(true);
          form.setValue('amount_bs', Number(posData.amount_bs));
        } else {
          setCurrentPosId(null);
          setHasEntry(false);
          setCurrentAmount(0);
        }
        
        // Verificar si el cuadre está aprobado
        const { data: cuadreSummary } = await supabase
          .from('daily_cuadres_summary')
          .select('encargada_status')
          .eq('session_id', session.id)
          .maybeSingle();
        
        setIsApproved(cuadreSummary?.encargada_status === 'aprobado');
      } else {
        setIsApproved(false);
      }
    } catch (error) {
      console.error('Error fetching POS data:', error);
    }
  };

  const onSubmit = async (data: POSForm) => {
    if (!user || !dateRange) return;
    
    // No permitir guardar si está aprobado
    if (isApproved) {
      toast({
        title: 'Cuadre Aprobado',
        description: 'Este cuadre ya fue aprobado y no se puede modificar',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      // Use the selected date from dateRange
      const targetDate = formatDateForDB(dateRange.from);
      
      let { data: session, error: sessionError } = await supabase
        .from('daily_sessions')
        .select('id')
        .eq('user_id', user.id)
        .eq('session_date', targetDate)
        .maybeSingle();

      if (!session) {
        // Session doesn't exist, create it
        const { data: newSession, error: createError } = await supabase
          .from('daily_sessions')
          .insert({
            user_id: user.id,
            session_date: targetDate,
          })
          .select('id')
          .single();

        if (createError) throw createError;
        session = newSession;
      } else if (sessionError) {
        throw sessionError;
      }

      if (hasEntry && currentPosId) {
        // Update existing entry
        const { error } = await supabase
          .from('point_of_sale')
          .update({
            amount_bs: data.amount_bs,
          })
          .eq('id', currentPosId);

        if (error) throw error;
      } else {
        // Create new entry
        const { data: newPos, error } = await supabase
          .from('point_of_sale')
          .insert({
            session_id: session.id,
            amount_bs: data.amount_bs,
          })
          .select('id')
          .single();

        if (error) throw error;
        setCurrentPosId(newPos.id);
        setHasEntry(true);
      }

      setCurrentAmount(data.amount_bs);
      setIsEditing(false);

      // Update or create daily_cuadres_summary
      await updateDailyCuadresSummary(session.id, user.id, targetDate);

      toast({
        title: 'Éxito',
        description: 'Punto de venta actualizado correctamente',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Error al actualizar punto de venta',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!currentPosId || !user) return;

    try {
      const { error } = await supabase
        .from('point_of_sale')
        .delete()
        .eq('id', currentPosId);

      if (error) throw error;

      // Get session to update summary
      const targetDate = formatDateForDB(dateRange?.from || new Date());
      const { data: session } = await supabase
        .from('daily_sessions')
        .select('id')
        .eq('user_id', user.id)
        .eq('session_date', targetDate)
        .maybeSingle();

      if (session) {
        await updateDailyCuadresSummary(session.id, user.id, targetDate);
      }

      setCurrentPosId(null);
      setCurrentAmount(0);
      setHasEntry(false);
      form.setValue('amount_bs', 0);

      toast({
        title: 'Éxito',
        description: 'Punto de venta eliminado correctamente',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Error al eliminar punto de venta',
        variant: 'destructive',
      });
    } finally {
      setDeleteDialogOpen(false);
    }
  };

  const handleEdit = () => {
    setIsEditing(true);
  };

  return (
    <>
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar registro de punto de venta?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. El registro será eliminado permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Punto de Venta del Día</span>
            {hasEntry && !isEditing && (
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleEdit}
                  disabled={isApproved}
                >
                  <Edit2 className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setDeleteDialogOpen(true)}
                  disabled={isApproved}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {hasEntry && !isEditing ? (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">Monto registrado:</p>
                <p className="text-2xl font-bold text-primary">
                  {formatCurrency(currentAmount, 'VES')}
                </p>
              </div>
            </div>
          ) : (
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="amount_bs">Monto Total (Bs)</Label>
                <Input
                  type="text"
                  placeholder="0,00"
                  defaultValue={currentAmount > 0 ? formatCurrency(currentAmount, 'VES').replace('Bs ', '') : ''}
                  onBlur={(e) => {
                    const cleanValue = e.target.value.replace(/[^\d,]/g, '');
                    const numValue = parseFloat(cleanValue.replace(',', '.')) || 0;
                    form.setValue('amount_bs', numValue);
                    e.target.value = numValue > 0 ? numValue.toLocaleString('es-VE', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    }) : '';
                  }}
                  onChange={(e) => {
                    const cleanValue = e.target.value.replace(/[^\d,]/g, '');
                    const numValue = parseFloat(cleanValue.replace(',', '.')) || 0;
                    form.setValue('amount_bs', numValue);
                  }}
                  disabled={isApproved}
                  readOnly={isApproved}
                />
              </div>

              <div className="flex gap-2">
                <Button type="submit" disabled={loading || isApproved} className="flex-1">
                  {loading ? 'Guardando...' : isApproved ? 'Cuadre Aprobado - No se puede modificar' : hasEntry ? 'Actualizar Monto' : 'Registrar Monto'}
                </Button>
                {isEditing && (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isApproved}
                    onClick={() => {
                      setIsEditing(false);
                      form.setValue('amount_bs', currentAmount);
                    }}
                  >
                    Cancelar
                  </Button>
                )}
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </>
  );
};