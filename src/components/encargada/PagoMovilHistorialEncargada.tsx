import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { formatDateForDB } from '@/lib/dateUtils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Edit2, Save, X, Trash2, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { format } from 'date-fns';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface MobilePayment {
  id: string;
  amount_bs: number;
  reference_number: string;
  description?: string;
  created_at: string;
}

interface PagoMovilHistorialEncargadaProps {
  refreshKey?: number;
  selectedAgency: string;
  selectedDate: Date;
}

export const PagoMovilHistorialEncargada = ({ refreshKey, selectedAgency, selectedDate }: PagoMovilHistorialEncargadaProps) => {
  const [payments, setPayments] = useState<MobilePayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<MobilePayment>>({});
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchPayments = async () => {
    if (!selectedAgency || !selectedDate) return;

    try {
      const dateStr = formatDateForDB(selectedDate);
      
      // Buscar sesiones de taquilleros de esta agencia para esta fecha
      const { data: taquilleras } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('agency_id', selectedAgency)
        .eq('role', 'taquillero')
        .eq('is_active', true);

      let sessionIds: string[] = [];
      if (taquilleras && taquilleras.length > 0) {
        const taquilleraIds = taquilleras.map(t => t.user_id);
        const { data: sessions } = await supabase
          .from('daily_sessions')
          .select('id')
          .eq('session_date', dateStr)
          .in('user_id', taquilleraIds);
        
        sessionIds = sessions?.map(s => s.id) || [];
      }
      
      // Buscar pagos móviles por agency_id O por session_id
      const queries = [
        supabase
          .from('mobile_payments')
          .select('*')
          .eq('agency_id', selectedAgency)
          .eq('transaction_date', dateStr)
      ];
      
      if (sessionIds.length > 0) {
        queries.push(
          supabase
            .from('mobile_payments')
            .select('*')
            .in('session_id', sessionIds)
        );
      }
      
      const results = await Promise.all(queries);
      const allPayments: any[] = [];
      
      results.forEach((result) => {
        if (result.error) throw result.error;
        if (result.data) {
          allPayments.push(...result.data);
        }
      });
      
      // Eliminar duplicados y asegurar que todos tengan agency_id
      const uniquePayments = Array.from(
        new Map(allPayments.map((item) => [item.id || `${item.reference_number}_${item.amount_bs}_${item.created_at}`, item])).values()
      ).map(payment => {
        // Si el pago viene de una sesión de taquillera y no tiene agency_id, asignarlo
        if (!payment.agency_id && payment.session_id) {
          return { ...payment, agency_id: selectedAgency };
        }
        return payment;
      });

      // Actualizar en la base de datos los que no tienen agency_id
      const paymentsWithoutAgency = uniquePayments.filter(p => !p.agency_id && p.session_id);
      if (paymentsWithoutAgency.length > 0) {
        const paymentIds = paymentsWithoutAgency.map(p => p.id);
        await supabase
          .from('mobile_payments')
          .update({ agency_id: selectedAgency })
          .in('id', paymentIds);
      }

      setPayments(uniquePayments);
    } catch (error: any) {
      console.error('Error fetching mobile payments:', error);
      toast({
        title: 'Error',
        description: 'Error al cargar los pagos móviles',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Limpiar datos anteriores
    setPayments([]);
    setLoading(true);
    
    if (selectedAgency && selectedDate) {
      fetchPayments();
    }
    
    // Cleanup
    return () => {
      setLoading(false);
    };
  }, [selectedAgency, selectedDate, refreshKey]);

  const handleEdit = (payment: MobilePayment) => {
    setEditingId(payment.id);
    setEditForm({
      reference_number: payment.reference_number,
      amount_bs: Math.abs(payment.amount_bs), // Show as positive for editing
      description: payment.description?.replace('[RECIBIDO] ', '').replace('[PAGADO] ', '') || '',
    });
  };

  const handleSave = async (id: string) => {
    const originalPayment = payments.find(p => p.id === id);
    if (!originalPayment) return;

    try {
      // Maintain the original sign (positive for received, negative for paid)
      const finalAmount = originalPayment.amount_bs < 0 
        ? -Math.abs(editForm.amount_bs || 0)
        : Math.abs(editForm.amount_bs || 0);

      // Maintain the original prefix in description
      const isReceived = originalPayment.amount_bs >= 0;
      const prefix = isReceived ? '[RECIBIDO]' : '[PAGADO]';
      const finalDescription = editForm.description 
        ? `${prefix} ${editForm.description}`
        : prefix;

      const { error } = await supabase
        .from('mobile_payments')
        .update({
          reference_number: editForm.reference_number,
          amount_bs: finalAmount,
          description: finalDescription,
        })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Éxito',
        description: 'Pago móvil actualizado correctamente',
      });

      setEditingId(null);
      setEditForm({});
      fetchPayments();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Error al actualizar el pago móvil',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;

    try {
      const { error } = await supabase
        .from('mobile_payments')
        .delete()
        .eq('id', deleteId);

      if (error) throw error;

      toast({
        title: 'Pago móvil eliminado',
        description: 'El pago móvil ha sido eliminado correctamente',
      });

      setDeleteId(null);
      fetchPayments();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Error al eliminar el pago móvil',
        variant: 'destructive',
      });
    }
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditForm({});
  };

  const isReceived = (amount: number) => amount >= 0;
  const getPaymentType = (amount: number, description?: string) => {
    if (isReceived(amount)) {
      return { label: 'Recibido', icon: ArrowDownLeft, variant: 'default' as const };
    } else {
      return { label: 'Pagado', icon: ArrowUpRight, variant: 'secondary' as const };
    }
  };

  if (loading) {
    return <div className="text-center py-4">Cargando pagos móviles...</div>;
  }

  if (payments.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No hay pagos móviles registrados para {format(selectedDate, 'dd/MM/yyyy')}
      </div>
    );
  }

  // Calculate totals
  const totalReceived = payments
    .filter(p => p.amount_bs >= 0)
    .reduce((sum, p) => sum + p.amount_bs, 0);
  
  const totalPaid = payments
    .filter(p => p.amount_bs < 0)
    .reduce((sum, p) => sum + Math.abs(p.amount_bs), 0);

  const paymentToDelete = payments.find(p => p.id === deleteId);

  return (
    <div className="space-y-4">
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este pago móvil?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminará permanentemente el pago móvil de{' '}
              <span className="font-semibold">
                {Math.abs(paymentToDelete?.amount_bs || 0).toLocaleString('es-VE', { style: 'currency', currency: 'VES' })}
              </span>
              {' '}(Ref: {paymentToDelete?.reference_number}).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Recibido</p>
                <p className="text-lg font-semibold text-green-600">
                  {totalReceived.toLocaleString('es-VE', {
                    style: 'currency',
                    currency: 'VES',
                    minimumFractionDigits: 2,
                  })}
                </p>
              </div>
              <ArrowDownLeft className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Pagado</p>
                <p className="text-lg font-semibold text-red-600">
                  {totalPaid.toLocaleString('es-VE', {
                    style: 'currency',
                    currency: 'VES',
                    minimumFractionDigits: 2,
                  })}
                </p>
              </div>
              <ArrowUpRight className="h-8 w-8 text-red-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Balance Neto</p>
                <p className="text-lg font-semibold">
                  {(totalReceived - totalPaid).toLocaleString('es-VE', {
                    style: 'currency',
                    currency: 'VES',
                    minimumFractionDigits: 2,
                  })}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Payments list */}
      {payments.map((payment) => {
        const paymentType = getPaymentType(payment.amount_bs, payment.description);
        const PaymentIcon = paymentType.icon;

        return (
          <Card key={payment.id}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <PaymentIcon className="h-4 w-4" />
                  <Badge variant={paymentType.variant}>
                    {paymentType.label}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    Ref: {editingId === payment.id ? (
                      <Input
                        value={editForm.reference_number || ''}
                        onChange={(e) => setEditForm({ ...editForm, reference_number: e.target.value })}
                        className="h-6 w-32 inline-block"
                      />
                    ) : (
                      payment.reference_number
                    )}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {editingId === payment.id ? (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleSave(payment.id)}
                      >
                        <Save className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleCancel}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEdit(payment)}
                      >
                        <Edit2 className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setDeleteId(payment.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Monto</Label>
                  {editingId === payment.id ? (
                    <Input
                      type="number"
                      step="0.01"
                      value={editForm.amount_bs === undefined ? '' : String(editForm.amount_bs)}
                      onChange={(e) => {
                        const raw = e.target.value;
                        const parsed = raw === '' ? undefined : (parseFloat(raw) || 0);
                        setEditForm({ ...editForm, amount_bs: parsed });
                      }}
                      className="h-8 mt-1"
                    />
                  ) : (
                    <p className={`font-medium ${isReceived(payment.amount_bs) ? 'text-green-600' : 'text-red-600'}`}>
                      {Math.abs(payment.amount_bs).toLocaleString('es-VE', {
                        style: 'currency',
                        currency: 'VES',
                        minimumFractionDigits: 2,
                      })}
                    </p>
                  )}
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Descripción</Label>
                  {editingId === payment.id ? (
                    <Textarea
                      value={editForm.description || ''}
                      onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                      className="h-8 mt-1 resize-none"
                      rows={1}
                    />
                  ) : (
                    <p className="text-sm">
                      {payment.description?.replace('[RECIBIDO] ', '').replace('[PAGADO] ', '') || 'Sin descripción'}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};