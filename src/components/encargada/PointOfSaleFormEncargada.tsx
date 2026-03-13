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
import { formatDateForDB } from '@/lib/dateUtils';
import { format } from 'date-fns';

const posSchema = z.object({
  amount_bs: z.number().min(0, 'Monto debe ser positivo'),
});

type POSForm = z.infer<typeof posSchema>;

interface PointOfSaleFormEncargadaProps {
  selectedAgency: string;
  selectedDate: Date;
  onSuccess?: () => void;
}

export const PointOfSaleFormEncargada = ({ selectedAgency, selectedDate, onSuccess }: PointOfSaleFormEncargadaProps) => {
  const [loading, setLoading] = useState(false);
  const [encargadaAmount, setEncargadaAmount] = useState<number>(0);
  const [taquilleraTotal, setTaquilleraTotal] = useState<number>(0);
  const [encargadaRecordId, setEncargadaRecordId] = useState<string | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  const form = useForm<POSForm>({
    resolver: zodResolver(posSchema),
    defaultValues: {
      amount_bs: 0,
    },
  });

  useEffect(() => {
    // Reset state on prop change
    setEncargadaAmount(0);
    setTaquilleraTotal(0);
    setEncargadaRecordId(null);
    form.reset({ amount_bs: 0 });

    if (selectedAgency && selectedDate) {
      fetchPOSData();
    }
  }, [selectedAgency, selectedDate]);

  const fetchPOSData = async () => {
    if (!selectedAgency || !selectedDate) return;

    try {
      const dateStr = formatDateForDB(selectedDate);

      // 1. Get the encargada's own agency-level record (session_id IS NULL)
      const { data: agencyRecord } = await supabase
        .from('point_of_sale')
        .select('id, amount_bs')
        .eq('agency_id', selectedAgency)
        .eq('transaction_date', dateStr)
        .is('session_id', null)
        .maybeSingle();

      if (agencyRecord) {
        setEncargadaRecordId(agencyRecord.id);
        setEncargadaAmount(Number(agencyRecord.amount_bs));
        form.setValue('amount_bs', Number(agencyRecord.amount_bs));
      }

      // 2. Get taquillera POS records via sessions
      const { data: taquilleras } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('agency_id', selectedAgency)
        .eq('role', 'taquillero')
        .eq('is_active', true);

      if (taquilleras && taquilleras.length > 0) {
        const taquilleraIds = taquilleras.map(t => t.user_id);
        const { data: sessions } = await supabase
          .from('daily_sessions')
          .select('id')
          .eq('session_date', dateStr)
          .in('user_id', taquilleraIds);

        const sessionIds = sessions?.map(s => s.id) || [];

        if (sessionIds.length > 0) {
          const { data: taqPosRecords } = await supabase
            .from('point_of_sale')
            .select('amount_bs')
            .in('session_id', sessionIds);

          const total = taqPosRecords?.reduce((sum, r) => sum + Number(r.amount_bs || 0), 0) || 0;
          setTaquilleraTotal(total);

          // If encargada hasn't set her own value yet, pre-fill with taquillera total
          if (!agencyRecord && total > 0) {
            form.setValue('amount_bs', total);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching POS data:', error);
    }
  };

  const onSubmit = async (data: POSForm) => {
    if (!user || !selectedAgency || !selectedDate) return;

    setLoading(true);
    try {
      const dateStr = formatDateForDB(selectedDate);

      if (encargadaRecordId) {
        // Update existing encargada record
        const { error } = await supabase
          .from('point_of_sale')
          .update({ amount_bs: data.amount_bs })
          .eq('id', encargadaRecordId);

        if (error) throw error;
      } else {
        // Create new encargada record (agency-level, no session_id)
        const { data: newRecord, error } = await supabase
          .from('point_of_sale')
          .insert({
            agency_id: selectedAgency,
            transaction_date: dateStr,
            amount_bs: data.amount_bs,
            session_id: null,
          })
          .select('id')
          .single();

        if (error) throw error;
        setEncargadaRecordId(newRecord.id);
      }

      setEncargadaAmount(data.amount_bs);

      toast({
        title: 'Éxito',
        description: 'Punto de venta actualizado correctamente',
      });

      onSuccess?.();
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

  const hasEncargadaRecord = encargadaRecordId !== null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Punto de Venta - {format(selectedDate, 'dd/MM/yyyy')}</CardTitle>
      </CardHeader>
      <CardContent>
        {taquilleraTotal > 0 && (
          <div className="mb-4 p-3 bg-muted/50 rounded-lg border">
            <p className="text-sm text-muted-foreground">Monto reportado por taquilleras:</p>
            <p className="text-lg font-semibold">
              {formatCurrency(taquilleraTotal, 'VES')}
            </p>
          </div>
        )}

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="amount_bs">Monto Total (Bs)</Label>
            <Input
              type="text"
              placeholder="0,00"
              defaultValue={encargadaAmount > 0 ? formatCurrency(encargadaAmount, 'VES').replace('Bs ', '') : ''}
              key={`${selectedAgency}-${formatDateForDB(selectedDate)}-${encargadaAmount}`}
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
            />
          </div>

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? 'Guardando...' : hasEncargadaRecord ? 'Actualizar Monto' : 'Registrar Monto'}
          </Button>

          {encargadaAmount > 0 && (
            <div className="mt-4 p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">Monto actual (encargada):</p>
              <p className="text-xl font-bold text-primary">
                {formatCurrency(encargadaAmount, 'VES')}
              </p>
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  );
};
