import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
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

interface MobilePayment {
  id: string;
  amount_bs: number;
  reference_number: string;
  description?: string;
  created_at: string;
}

interface PagoMovilHistorialProps {
  refreshKey?: number;
  dateRange?: {
    from: Date;
    to: Date;
  };
}

export const PagoMovilHistorial = ({ refreshKey, dateRange }: PagoMovilHistorialProps) => {
  const [payments, setPayments] = useState<MobilePayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<MobilePayment>>({});
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [paymentToDelete, setPaymentToDelete] = useState<string | null>(null);
  const [isApproved, setIsApproved] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchPayments = async () => {
    if (!user || !dateRange) return;

    try {
      const fromDate = formatDateForDB(dateRange.from);
      const toDate = formatDateForDB(dateRange.to);
      
      console.log('🔍 PAGOS MÓVILES DEBUG - Fechas:', { fromDate, toDate, dateRange });
      
      const { data: sessions } = await supabase
        .from('daily_sessions')
        .select('id')
        .eq('user_id', user.id)
        .gte('session_date', fromDate)
        .lte('session_date', toDate);

      console.log('🔍 PAGOS MÓVILES DEBUG - Sessions encontradas:', sessions);

      if (!sessions || sessions.length === 0) {
        setPayments([]);
        return;
      }

      const sessionIds = sessions.map(s => s.id);

      const { data, error } = await supabase
        .from('mobile_payments')
        .select('*')
        .in('session_id', sessionIds)
        .order('created_at', { ascending: false });

      console.log('🔍 PAGOS MÓVILES DEBUG - Payments encontrados:', { data, error });

      if (error) throw error;
      setPayments(data || []);
      
      // Verificar si el cuadre está aprobado (solo para un solo día)
      if (fromDate === toDate && sessions.length === 1) {
        const { data: cuadreSummary } = await supabase
          .from('daily_cuadres_summary')
          .select('encargada_status')
          .eq('session_id', sessions[0].id)
          .maybeSingle();
        
        setIsApproved(cuadreSummary?.encargada_status === 'aprobado');
      } else {
        setIsApproved(false);
      }
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
    if (user && dateRange) {
      fetchPayments();
    }
  }, [user, refreshKey, dateRange]);

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
    
    // No permitir guardar si está aprobado
    if (isApproved) {
      toast({
        title: 'Cuadre Aprobado',
        description: 'Este cuadre ya fue aprobado y no se puede modificar',
        variant: 'destructive',
      });
      return;
    }

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

  const confirmDelete = (id: string) => {
    setPaymentToDelete(id);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!paymentToDelete) return;
    
    // No permitir eliminar si está aprobado
    if (isApproved) {
      toast({
        title: 'Cuadre Aprobado',
        description: 'Este cuadre ya fue aprobado y no se puede modificar',
        variant: 'destructive',
      });
      setDeleteDialogOpen(false);
      setPaymentToDelete(null);
      return;
    }

    try {
      const { error } = await supabase
        .from('mobile_payments')
        .delete()
        .eq('id', paymentToDelete);

      if (error) throw error;

      toast({
        title: 'Éxito',
        description: 'Pago móvil eliminado correctamente',
      });

      fetchPayments();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Error al eliminar el pago móvil',
        variant: 'destructive',
      });
    } finally {
      setDeleteDialogOpen(false);
      setPaymentToDelete(null);
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
        No hay pagos móviles registrados para hoy
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

  return (
    <>
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar pago móvil?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. El pago móvil será eliminado permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="space-y-4">
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
                        disabled={isApproved}
                        readOnly={isApproved}
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
                        disabled={isApproved}
                      >
                        <Save className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleCancel}
                        disabled={isApproved}
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
                        disabled={isApproved}
                      >
                        <Edit2 className="h-3 w-3" />
                      </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => confirmDelete(payment.id)}
                      disabled={isApproved}
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
                      value={editForm.amount_bs || 0}
                      onChange={(e) => setEditForm({ ...editForm, amount_bs: parseFloat(e.target.value) || 0 })}
                      className="h-8 mt-1"
                      disabled={isApproved}
                      readOnly={isApproved}
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
                      disabled={isApproved}
                      readOnly={isApproved}
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
    </>
  );
};