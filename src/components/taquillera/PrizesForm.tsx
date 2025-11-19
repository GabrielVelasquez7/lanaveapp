import { getTodayVenezuela } from '@/lib/dateUtils';
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
import { Textarea } from '@/components/ui/textarea';

const prizeSchema = z.object({
  lottery_system_id: z.string().min(1, 'Selecciona un sistema'),
  amount_bs: z.number().min(0, 'Monto debe ser positivo'),
  amount_usd: z.number().min(0, 'Monto debe ser positivo'),
  winner_info: z.string().optional(),
});

type PrizeForm = z.infer<typeof prizeSchema>;

interface LotterySystem {
  id: string;
  name: string;
  code: string;
}

export const PrizesForm = () => {
  const [lotteryOptions, setLotteryOptions] = useState<LotterySystem[]>([]);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  const form = useForm<PrizeForm>({
    resolver: zodResolver(prizeSchema),
    defaultValues: {
      amount_bs: 0,
      amount_usd: 0,
      winner_info: '',
    },
  });

  useEffect(() => {
    const fetchLotteryOptions = async () => {
      const { data, error } = await supabase
        .from('lottery_systems')
        .select('id, name, code')
        .eq('is_active', true)
        .order('name');

      if (error) {
        toast({
          title: 'Error',
          description: 'No se pudieron cargar los sistemas',
          variant: 'destructive',
        });
      } else {
        setLotteryOptions(data || []);
      }
    };

    fetchLotteryOptions();
  }, [toast]);

  const onSubmit = async (data: PrizeForm) => {
    if (!user) return;

    setLoading(true);
    try {
      // First, ensure we have a daily session for today
      const today = getTodayVenezuela();
      
      let { data: session, error: sessionError } = await supabase
        .from('daily_sessions')
        .select('id')
        .eq('user_id', user.id)
        .eq('session_date', today)
        .single();

      if (sessionError && sessionError.code === 'PGRST116') {
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
      } else if (sessionError) {
        throw sessionError;
      }

      // Now insert the prize transaction
      const { error } = await supabase
        .from('prize_transactions')
        .insert({
          session_id: session.id,
          lottery_system_id: data.lottery_system_id,
          amount_bs: data.amount_bs,
          amount_usd: data.amount_usd,
        });

      if (error) throw error;

      toast({
        title: 'Éxito',
        description: 'Premio registrado correctamente',
      });

      form.reset();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Error al registrar el premio',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label htmlFor="lottery_system_id">Sistema de Lotería</Label>
          <Select
            value={form.watch('lottery_system_id')}
            onValueChange={(value) => form.setValue('lottery_system_id', value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecciona un sistema" />
            </SelectTrigger>
            <SelectContent>
              {lotteryOptions.map((system) => (
                <SelectItem key={system.id} value={system.id}>
                  {system.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {form.formState.errors.lottery_system_id && (
            <p className="text-sm text-destructive mt-1">{form.formState.errors.lottery_system_id.message}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Premio Bs</CardTitle>
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
            <CardTitle className="text-sm">Premio USD</CardTitle>
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

      <div className="space-y-2">
        <Label htmlFor="winner_info">Información del Ganador (opcional)</Label>
        <Input
          placeholder="Nombre, número, etc..."
          {...form.register('winner_info')}
        />
      </div>

      <Button type="submit" disabled={loading} className="w-full">
        {loading ? 'Registrando...' : 'Registrar Premio'}
      </Button>
    </form>
  );
};