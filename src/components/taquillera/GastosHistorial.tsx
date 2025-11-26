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
import { Edit2, Save, X, Trash2 } from 'lucide-react';
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

interface Expense {
  id: string;
  category: 'deuda' | 'gasto_operativo' | 'otros';
  description: string;
  amount_bs: number;
  amount_usd: number;
  created_at: string;
}

interface GastosHistorialProps {
  refreshKey?: number;
  dateRange?: {
    from: Date;
    to: Date;
  };
}

export const GastosHistorial = ({ refreshKey, dateRange }: GastosHistorialProps) => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Expense>>({});
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [expenseToDelete, setExpenseToDelete] = useState<string | null>(null);
  const [isApproved, setIsApproved] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchExpenses = async () => {
    if (!user || !dateRange) return;

    try {
      const fromDate = formatDateForDB(dateRange.from);
      const toDate = formatDateForDB(dateRange.to);
      const { data: sessions } = await supabase
        .from('daily_sessions')
        .select('id')
        .eq('user_id', user.id)
        .gte('session_date', fromDate)
        .lte('session_date', toDate);

      if (!sessions || sessions.length === 0) {
        setExpenses([]);
        return;
      }

      const sessionIds = sessions.map(s => s.id);

      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .in('session_id', sessionIds)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setExpenses(data || []);
      
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
      console.error('Error fetching expenses:', error);
      toast({
        title: 'Error',
        description: 'Error al cargar los gastos',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user && dateRange) {
      fetchExpenses();
    }
  }, [user, refreshKey, dateRange]);

  const handleEdit = (expense: Expense) => {
    setEditingId(expense.id);
    setEditForm({
      description: expense.description,
      amount_bs: expense.amount_bs,
      amount_usd: expense.amount_usd,
    });
  };

  const handleSave = async (id: string) => {
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
      const { error } = await supabase
        .from('expenses')
        .update({
          description: editForm.description,
          amount_bs: editForm.amount_bs,
          amount_usd: editForm.amount_usd,
        })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Éxito',
        description: 'Gasto actualizado correctamente',
      });

      setEditingId(null);
      setEditForm({});
      fetchExpenses();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Error al actualizar el gasto',
        variant: 'destructive',
      });
    }
  };

  const confirmDelete = (id: string) => {
    setExpenseToDelete(id);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!expenseToDelete) return;
    
    // No permitir eliminar si está aprobado
    if (isApproved) {
      toast({
        title: 'Cuadre Aprobado',
        description: 'Este cuadre ya fue aprobado y no se puede modificar',
        variant: 'destructive',
      });
      setDeleteDialogOpen(false);
      setExpenseToDelete(null);
      return;
    }

    try {
      const { error } = await supabase
        .from('expenses')
        .delete()
        .eq('id', expenseToDelete);

      if (error) throw error;

      toast({
        title: 'Éxito',
        description: 'Gasto eliminado correctamente',
      });

      fetchExpenses();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Error al eliminar el gasto',
        variant: 'destructive',
      });
    } finally {
      setDeleteDialogOpen(false);
      setExpenseToDelete(null);
    }
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditForm({});
  };

  const getCategoryLabel = (category: string) => {
    const labels = {
      deuda: 'Deuda',
      gasto_operativo: 'Gasto Operativo',
      otros: 'Otros',
    };
    return labels[category as keyof typeof labels] || category;
  };

  const getCategoryColor = (category: string) => {
    const colors = {
      deuda: 'destructive',
      gasto_operativo: 'secondary',
      otros: 'outline',
    };
    return colors[category as keyof typeof colors] || 'outline';
  };

  if (loading) {
    return <div className="text-center py-4">Cargando gastos...</div>;
  }

  if (expenses.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No hay gastos registrados para hoy
      </div>
    );
  }

  return (
    <>
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar gasto?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. El gasto será eliminado permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="space-y-4">
        {expenses.map((expense) => (
        <Card key={expense.id}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm">
                  {editingId === expense.id ? (
                    <Input
                      value={editForm.description || ''}
                      onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                      className="h-8"
                      disabled={isApproved}
                      readOnly={isApproved}
                    />
                  ) : (
                    expense.description
                  )}
                </CardTitle>
                <Badge variant={getCategoryColor(expense.category) as any}>
                  {getCategoryLabel(expense.category)}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                {editingId === expense.id ? (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleSave(expense.id)}
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
                      onClick={() => handleEdit(expense)}
                      disabled={isApproved}
                    >
                      <Edit2 className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => confirmDelete(expense.id)}
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
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs text-muted-foreground">Bolívares</Label>
                {editingId === expense.id ? (
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
                  <p className="font-medium">
                    {expense.amount_bs.toLocaleString('es-VE', {
                      style: 'currency',
                      currency: 'VES',
                      minimumFractionDigits: 2,
                    })}
                  </p>
                )}
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Dólares</Label>
                {editingId === expense.id ? (
                  <Input
                    type="number"
                    step="0.01"
                    value={editForm.amount_usd || 0}
                    onChange={(e) => setEditForm({ ...editForm, amount_usd: parseFloat(e.target.value) || 0 })}
                    className="h-8 mt-1"
                    disabled={isApproved}
                    readOnly={isApproved}
                  />
                ) : (
                  <p className="font-medium">
                    ${expense.amount_usd.toFixed(2)}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
        ))}
      </div>
    </>
  );
};