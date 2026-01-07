import { getTodayVenezuela, formatDateForDB } from '@/lib/dateUtils';
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
import { useCuadreLock } from '@/hooks/useCuadreLock';
import { Plus } from 'lucide-react';
import { format } from 'date-fns';

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

const gastoSchema = z.object({
  category: z.literal('gasto_operativo'),
  description: z.string().min(1, 'Descripción es requerida'),
  amount_bs: z.number().min(0, 'Monto debe ser positivo'),
  amount_usd: z.number().min(0, 'Monto debe ser positivo'),
});

type GastoForm = z.infer<typeof gastoSchema>;

interface GastosOperativosFormProps {
  onSuccess?: () => void;
  selectedAgency?: string;
  selectedDate?: Date;
}

export const GastosOperativosForm = ({ onSuccess, selectedAgency: propSelectedAgency, selectedDate: propSelectedDate }: GastosOperativosFormProps) => {
  const [loading, setLoading] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [agencies, setAgencies] = useState<any[]>([]);
  const [amountBsInput, setAmountBsInput] = useState<string>('');
  const [amountUsdInput, setAmountUsdInput] = useState<string>('');
  
  // Use props if provided, otherwise fallback to internal state
  const selectedAgency = propSelectedAgency || '';
  const selectedDate = propSelectedDate || new Date();
  const { user } = useAuth();
  const { toast } = useToast();
  
  // Usar hook de bloqueo - solo aplicar si no hay agencia seleccionada (modo taquillera)
  const { isLocked, isApproved } = useCuadreLock({
    userId: user?.id,
    dateRange: propSelectedDate ? { from: propSelectedDate, to: propSelectedDate } : undefined,
    selectedAgency: propSelectedAgency,
    isTaquillera: userProfile?.role === 'taquillera' || !userProfile,
  });

  const form = useForm<GastoForm>({
    resolver: zodResolver(gastoSchema),
    defaultValues: {
      category: 'gasto_operativo',
      amount_bs: 0,
      amount_usd: 0,
      description: '',
    },
  });

  const parseInputValueBs = (value: string): number => {
    if (!value || value.trim() === '') return 0;

    const cleanValue = value.replace(/[^\d.,]/g, '');

    // Formato es-VE: coma decimal, punto de miles
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

  // Load user profile and agencies for encargadas
  useEffect(() => {
    const loadUserData = async () => {
      if (!user) return;

      // Get user profile to check role
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, agency_id')
        .eq('user_id', user.id)
        .single();

      setUserProfile(profile);

      // If user is encargada, load agencies
      if (profile?.role === 'encargada') {
        const { data: agenciesData } = await supabase
          .from('agencies')
          .select('id, name')
          .eq('is_active', true)
          .order('name');
        
        setAgencies(agenciesData || []);
      }
    };

    loadUserData();
  }, [user]);

  const onSubmit = async (data: GastoForm) => {
    if (!user || !userProfile) return;

    const isAgencyMode = Boolean(propSelectedAgency && propSelectedDate);

    // No permitir agregar si está bloqueado (solo para modo taquillera)
    if (!isAgencyMode && isLocked) {
      toast({
        title: isApproved ? 'Cuadre Aprobado' : 'Cuadre Pendiente de Revisión',
        description: isApproved
          ? 'Este cuadre ya fue aprobado y no se puede modificar'
          : 'Este cuadre está pendiente de revisión y no se puede modificar',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      if (isAgencyMode) {
        // Encargada (o modo "por agencia") - insertar con agency_id y transaction_date
        if (!selectedAgency) {
          toast({
            title: 'Error',
            description: 'Debes seleccionar una agencia',
            variant: 'destructive',
          });
          return;
        }

        const { error } = await supabase.from('expenses').insert({
          agency_id: selectedAgency,
          transaction_date: format(selectedDate, 'yyyy-MM-dd'),
          category: data.category,
          description: data.description,
          amount_bs: data.amount_bs,
          amount_usd: data.amount_usd,
          session_id: null,
        });

        if (error) throw error;
      } else {
        // Taquillera workflow - use session_id with selected date
        const sessionDate = propSelectedDate ? formatDateForDB(propSelectedDate) : getTodayVenezuela();

        let { data: session, error: sessionError } = await supabase
          .from('daily_sessions')
          .select('id')
          .eq('user_id', user.id)
          .eq('session_date', sessionDate)
          .maybeSingle();

        if (!session) {
          const { data: newSession, error: createError } = await supabase
            .from('daily_sessions')
            .insert({
              user_id: user.id,
              session_date: sessionDate,
            })
            .select('id')
            .single();

          if (createError) throw createError;
          session = newSession;
        }

        const { error } = await supabase.from('expenses').insert({
          session_id: session.id,
          transaction_date: sessionDate, // importante para registrar fechas anteriores
          category: data.category,
          description: data.description,
          amount_bs: data.amount_bs,
          amount_usd: data.amount_usd,
        });

        if (error) throw error;
      }

      toast({
        title: 'Éxito',
        description: 'Gasto operativo registrado correctamente',
      });

      // Reset form
      form.reset({
        category: 'gasto_operativo',
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
        description: error.message || 'Error al registrar el gasto',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const subcategoryOptions = [
    { value: 'mantenimiento', label: 'Mantenimiento' },
    { value: 'suministros', label: 'Suministros' },
    { value: 'servicios', label: 'Servicios' },
    { value: 'transporte', label: 'Transporte' },
    { value: 'otros', label: 'Otros' },
  ];

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-6">

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label htmlFor="subcategory">Tipo de Gasto</Label>
          <Select disabled={isLocked}>
            <SelectTrigger disabled={isLocked}>
              <SelectValue placeholder="Selecciona el tipo" />
            </SelectTrigger>
            <SelectContent>
              {subcategoryOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Descripción</Label>
          <Input
            placeholder="Describe el gasto operativo..."
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
        <Plus className="h-4 w-4 mr-2" />
        {loading ? 'Registrando...' : isLocked ? (isApproved ? 'Cuadre Aprobado - No se puede modificar' : 'Cuadre Pendiente de Revisión') : 'Agregar Gasto Operativo'}
      </Button>
    </form>
  );
};