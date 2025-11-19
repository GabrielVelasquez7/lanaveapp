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
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Plus, CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';

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
  
  // Use props if provided, otherwise fallback to internal state
  const selectedAgency = propSelectedAgency || '';
  const selectedDate = propSelectedDate || new Date();
  const { user } = useAuth();
  const { toast } = useToast();

  const form = useForm<GastoForm>({
    resolver: zodResolver(gastoSchema),
    defaultValues: {
      category: 'gasto_operativo',
      amount_bs: 0,
      amount_usd: 0,
      description: '',
    },
  });

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
        
        // Note: Agency selection is handled by parent component when props are provided
      }
    };

    loadUserData();
  }, [user]);

  const onSubmit = async (data: GastoForm) => {
    if (!user || !userProfile) return;

    setLoading(true);
    try {
      const isEncargada = userProfile.role === 'encargada';
      
      if (isEncargada) {
        // Encargada workflow - insert directly with agency_id and transaction_date
        if (!selectedAgency) {
          toast({
            title: 'Error',
            description: 'Debes seleccionar una agencia',
            variant: 'destructive',
          });
          return;
        }

        const { error } = await supabase
          .from('expenses')
          .insert({
            agency_id: selectedAgency,
            transaction_date: format(selectedDate, 'yyyy-MM-dd'),
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
        description: 'Gasto operativo registrado correctamente',
      });

      // Reset form
      form.reset({
        category: 'gasto_operativo',
        description: '',
        amount_bs: 0,
        amount_usd: 0,
      });
      
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
          <Select>
            <SelectTrigger>
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
              type="number"
              step="0.01"
              placeholder="0.00"
              {...form.register('amount_bs', { 
                valueAsNumber: true,
                onChange: (e) => {
                  const value = e.target.value === '' ? '' : parseFloat(e.target.value) || 0;
                  form.setValue('amount_bs', value === '' ? 0 : value, { shouldValidate: true });
                }
              })}
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
              type="number"
              step="0.01"
              placeholder="0.00"
              {...form.register('amount_usd', { 
                valueAsNumber: true,
                onChange: (e) => {
                  const value = e.target.value === '' ? '' : parseFloat(e.target.value) || 0;
                  form.setValue('amount_usd', value === '' ? 0 : value, { shouldValidate: true });
                }
              })}
            />
            {form.formState.errors.amount_usd && (
              <p className="text-sm text-destructive mt-1">{form.formState.errors.amount_usd.message}</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Button type="submit" disabled={loading} className="w-full">
        <Plus className="h-4 w-4 mr-2" />
        {loading ? 'Registrando...' : 'Agregar Gasto Operativo'}
      </Button>
    </form>
  );
};