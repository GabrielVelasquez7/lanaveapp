import { format } from 'date-fns';
import { getTodayVenezuela } from '@/lib/dateUtils';

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
import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { CreditCard } from 'lucide-react';

const deudaSchema = z.object({
  category: z.literal('deuda'),
  description: z.string().min(1, 'Descripción es requerida'),
  amount_bs: z.number().min(0, 'Monto debe ser positivo'),
  amount_usd: z.number().min(0, 'Monto debe ser positivo'),
});

type DeudaForm = z.infer<typeof deudaSchema>;

interface DeudasFormProps {
  onSuccess?: () => void;
  selectedAgency?: string;
  selectedDate?: Date;
}

export const DeudasForm = ({ onSuccess, selectedAgency: propSelectedAgency, selectedDate: propSelectedDate }: DeudasFormProps) => {
  const [loading, setLoading] = useState(false);
  const [isCuadreClosed, setIsCuadreClosed] = useState(false);
  const [encargadaStatus, setEncargadaStatus] = useState<string | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();
  const [amountBsInput, setAmountBsInput] = useState<string>('');
  const [amountUsdInput, setAmountUsdInput] = useState<string>('');

  // Calcular si está bloqueado: cerrado Y no rechazado
  const isLocked = isCuadreClosed && encargadaStatus !== 'rechazado';
  const isApproved = encargadaStatus === 'aprobado';

  const form = useForm<DeudaForm>({
    resolver: zodResolver(deudaSchema),
    defaultValues: {
      category: 'deuda',
      amount_bs: 0,
      amount_usd: 0,
      description: '',
    },
  });

  const parseInputValueBs = (value: string): number => {
    if (!value || value.trim() === '') return 0;

    const cleanValue = value.replace(/[^\d.,]/g, '');

    if (cleanValue.includes(',')) {
      const lastCommaIndex = cleanValue.lastIndexOf(',');
      const beforeComma = cleanValue.substring(0, lastCommaIndex);
      const afterComma = cleanValue.substring(lastCommaIndex + 1);

      const integerPart = beforeComma.replace(/\./g, '');
      const normalizedValue = `${integerPart}.${afterComma}`;
      const num = parseFloat(normalizedValue);
      return isNaN(num) ? 0 : num;
    }

    if (cleanValue.includes('.')) {
      const lastDotIndex = cleanValue.lastIndexOf('.');
      const afterDot = cleanValue.substring(lastDotIndex + 1);

      if (afterDot.length > 0 && afterDot.length <= 2) {
        const beforeDot = cleanValue.substring(0, lastDotIndex).replace(/\./g, '');
        const normalizedValue = `${beforeDot}.${afterDot}`;
        const num = parseFloat(normalizedValue);
        return isNaN(num) ? 0 : num;
      }

      const normalizedValue = cleanValue.replace(/\./g, '');
      const num = parseFloat(normalizedValue);
      return isNaN(num) ? 0 : num;
    }

    const num = parseFloat(cleanValue);
    return isNaN(num) ? 0 : num;
  };

  const parseInputValueUsd = (value: string): number => {
    if (!value || value.trim() === '') return 0;

    const cleanValue = value.replace(/[^\d.,]/g, '');

    if (cleanValue.includes('.')) {
      const normalizedValue = cleanValue.replace(/,/g, '');
      const num = parseFloat(normalizedValue);
      return isNaN(num) ? 0 : num;
    }

    if (cleanValue.includes(',')) {
      const lastCommaIndex = cleanValue.lastIndexOf(',');
      const afterComma = cleanValue.substring(lastCommaIndex + 1);

      if (afterComma.length > 0 && afterComma.length <= 2) {
        const beforeLastComma = cleanValue.substring(0, lastCommaIndex).replace(/,/g, '');
        const normalizedValue = `${beforeLastComma}.${afterComma}`;
        const num = parseFloat(normalizedValue);
        return isNaN(num) ? 0 : num;
      }

      const normalizedValue = cleanValue.replace(/,/g, '');
      const num = parseFloat(normalizedValue);
      return isNaN(num) ? 0 : num;
    }

    const num = parseFloat(cleanValue);
    return isNaN(num) ? 0 : num;
  };

  // Verificar estado de bloqueo cuando cambie la fecha o el usuario
  useEffect(() => {
    const checkLockStatus = async () => {
      if (!user || propSelectedAgency) {
        setIsCuadreClosed(false);
        setEncargadaStatus(null);
        return;
      }
      
      const today = getTodayVenezuela();
      const { data: session } = await supabase
        .from('daily_sessions')
        .select('id')
        .eq('user_id', user.id)
        .eq('session_date', today)
        .maybeSingle();
      
      if (session) {
        const { data: cuadreSummary } = await supabase
          .from('daily_cuadres_summary')
          .select('encargada_status, is_closed')
          .eq('session_id', session.id)
          .maybeSingle();
        
        setEncargadaStatus(cuadreSummary?.encargada_status || null);
        setIsCuadreClosed(cuadreSummary?.is_closed === true);
      } else {
        setEncargadaStatus(null);
        setIsCuadreClosed(false);
      }
    };
    
    checkLockStatus();
  }, [user, propSelectedDate]);

  const onSubmit = async (data: DeudaForm) => {
    if (!user) return;
    
    // No permitir agregar si está bloqueado (solo para taquilleras)
    if (!propSelectedAgency && isLocked) {
      toast({
        title: isApproved ? 'Cuadre Aprobado' : 'Cuadre Pendiente de Revisión',
        description: isApproved ? 'Este cuadre ya fue aprobado y no se puede modificar' : 'Este cuadre está pendiente de revisión y no se puede modificar',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      // Check if we have props (encargada mode) or need session (taquillera mode)
      if (propSelectedAgency && propSelectedDate) {
        // Encargada workflow - insert directly with agency_id and transaction_date
        const { error } = await supabase
          .from('expenses')
          .insert({
            agency_id: propSelectedAgency,
            transaction_date: format(propSelectedDate, 'yyyy-MM-dd'),
            category: data.category,
            description: data.description,
            amount_bs: data.amount_bs,
            amount_usd: data.amount_usd,
            session_id: null, // Encargada doesn't have sessions
          });

        if (error) throw error;
      } else {
        // Taquillera workflow - use session_id (existing logic)
        const today = getTodayVenezuela();
        
        let { data: session, error: sessionError } = await supabase
          .from('daily_sessions')
          .select('id')
          .eq('user_id', user.id)
          .eq('session_date', today)
          .maybeSingle();

        if (!session) {
          // Session doesn't exist, create it
          const { data: newSession, error: createError } = await supabase
            .from('daily_sessions')
            .insert({
              user_id: user.id,
              session_date: today,
            })
            .select('id')
            .single();

          if (createError) throw createError;
          session = newSession;
        }

        // Now insert the debt
        const { error } = await supabase
          .from('expenses')
          .insert({
            session_id: session.id,
            category: data.category,
            description: data.description,
            amount_bs: data.amount_bs,
            amount_usd: data.amount_usd,
          });

        if (error) throw error;
      }

      toast({
        title: 'Éxito',
        description: 'Deuda registrada correctamente',
      });

      // Reset only description and amounts, keep category
      form.reset({
        category: 'deuda',
        description: '',
        amount_bs: 0,
        amount_usd: 0,
      });
      setAmountBsInput('');
      setAmountUsdInput('');
      
      onSuccess?.();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Error al registrar la deuda',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const deudaTypes = [
    { value: 'proveedor', label: 'Proveedor' },
    { value: 'prestamo', label: 'Préstamo' },
    { value: 'credito', label: 'Crédito' },
    { value: 'otros', label: 'Otros' },
  ];

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label htmlFor="debt-type">Tipo de Deuda</Label>
          <Select disabled={isLocked}>
            <SelectTrigger disabled={isLocked}>
              <SelectValue placeholder="Selecciona el tipo" />
            </SelectTrigger>
            <SelectContent>
              {deudaTypes.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Descripción</Label>
          <Input
            placeholder="Describe la deuda..."
            {...form.register('description')}
            disabled={isLocked}
            readOnly={isLocked}
          />
          {form.formState.errors.description && (
            <p className="text-sm text-destructive mt-1">{form.formState.errors.description.message}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Monto Bs</CardTitle>
          </CardHeader>
          <CardContent>
            <Input
              type="text"
              placeholder="0,00"
              value={amountBsInput}
              onChange={(e) => setAmountBsInput(e.target.value)}
              onBlur={() => {
                const num = parseInputValueBs(amountBsInput);
                form.setValue('amount_bs', num, { shouldValidate: true });
                setAmountBsInput(
                  num > 0
                    ? num.toLocaleString('es-VE', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })
                    : ''
                );
              }}
              disabled={isLocked}
              readOnly={isLocked}
            />
            {form.formState.errors.amount_bs && (
              <p className="text-sm text-destructive mt-1">{form.formState.errors.amount_bs.message}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Monto USD</CardTitle>
          </CardHeader>
          <CardContent>
            <Input
              type="text"
              placeholder="0.00"
              value={amountUsdInput}
              onChange={(e) => setAmountUsdInput(e.target.value)}
              onBlur={() => {
                const num = parseInputValueUsd(amountUsdInput);
                form.setValue('amount_usd', num, { shouldValidate: true });
                setAmountUsdInput(
                  num > 0
                    ? num.toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })
                    : ''
                );
              }}
              disabled={isLocked}
              readOnly={isLocked}
            />
            {form.formState.errors.amount_usd && (
              <p className="text-sm text-destructive mt-1">{form.formState.errors.amount_usd.message}</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Button type="submit" disabled={loading || isLocked} className="w-full">
        <CreditCard className="h-4 w-4 mr-2" />
        {loading ? 'Registrando...' : isLocked ? (isApproved ? 'Cuadre Aprobado - No se puede modificar' : 'Cuadre Pendiente de Revisión') : 'Agregar Deuda'}
      </Button>
    </form>
  );
};
