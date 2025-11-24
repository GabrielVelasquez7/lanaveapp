import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { formatDateForDB } from '@/lib/dateUtils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Edit2, Save, X, Trash2 } from 'lucide-react';
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

interface Expense {
  id: string;
  category: 'deuda' | 'gasto_operativo' | 'otros';
  description: string;
  amount_bs: number;
  amount_usd: number;
  created_at: string;
}

interface GastosHistorialEncargadaProps {
  refreshKey?: number;
  selectedAgency: string;
  selectedDate: Date;
}

export const GastosHistorialEncargada = ({ refreshKey, selectedAgency, selectedDate }: GastosHistorialEncargadaProps) => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Expense>>({});
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchExpenses = async () => {
    if (!selectedAgency || !selectedDate) return;

    try {
      const dateStr = formatDateForDB(selectedDate);
      
      // Buscar taquilleras de esta agencia
      const { data: taquilleras } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('agency_id', selectedAgency)
        .eq('role', 'taquillero')
        .eq('is_active', true);

      const taquilleraIds = taquilleras?.map(t => t.user_id) || [];
      
      // Buscar sesiones de taquilleras
      let sessionIds: string[] = [];
      if (taquilleraIds.length > 0) {
        const { data: sessions } = await supabase
          .from('daily_sessions')
          .select('id')
          .eq('session_date', dateStr)
          .in('user_id', taquilleraIds);
        sessionIds = sessions?.map(s => s.id) || [];
      }

      // Buscar gastos: primero por agency_id, luego por session_id
      const queries = [
        supabase
          .from('expenses')
          .select('*')
          .eq('agency_id', selectedAgency)
          .eq('transaction_date', dateStr)
      ];

      if (sessionIds.length > 0) {
        queries.push(
          supabase
            .from('expenses')
            .select('*')
            .in('session_id', sessionIds)
        );
      }

      const results = await Promise.all(queries);
      
      // Consolidar resultados y eliminar duplicados
      const allExpenses: any[] = [];
      results.forEach(result => {
        if (result.error) throw result.error;
        if (result.data) {
          allExpenses.push(...result.data);
        }
      });

      // Eliminar duplicados por id
      const uniqueExpenses = Array.from(
        new Map(allExpenses.map(item => [item.id, item])).values()
      );

      console.log('🔍 GASTOS ENCARGADA - Cargados:', {
        total: uniqueExpenses.length,
        porAgency: results[0]?.data?.length || 0,
        porSession: results[1]?.data?.length || 0
      });

      setExpenses(uniqueExpenses);
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
    // Limpiar datos anteriores
    setExpenses([]);
    setLoading(true);
    
    if (selectedAgency && selectedDate) {
      fetchExpenses();
    }
    
    // Cleanup
    return () => {
      setLoading(false);
    };
  }, [selectedAgency, selectedDate, refreshKey]);

  const handleEdit = (expense: Expense) => {
    setEditingId(expense.id);
    setEditForm({
      description: expense.description,
      amount_bs: expense.amount_bs,
      amount_usd: expense.amount_usd,
    });
  };

  const handleSave = async (id: string) => {
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

  const handleDelete = async () => {
    if (!deleteId) return;

    try {
      const { error } = await supabase
        .from('expenses')
        .delete()
        .eq('id', deleteId);

      if (error) throw error;

      toast({
        title: 'Gasto eliminado',
        description: 'El gasto ha sido eliminado correctamente',
      });

      setDeleteId(null);
      fetchExpenses();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Error al eliminar el gasto',
        variant: 'destructive',
      });
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
        No hay gastos registrados para {format(selectedDate, 'dd/MM/yyyy')}
      </div>
    );
  }

  const expenseToDelete = expenses.find(e => e.id === deleteId);

  return (
    <div className="space-y-4">
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este gasto?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminará permanentemente el gasto de{' '}
              <span className="font-semibold">
                {expenseToDelete?.amount_bs.toLocaleString('es-VE', { style: 'currency', currency: 'VES' })}
              </span>
              {' '}({getCategoryLabel(expenseToDelete?.category || '')}).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
                      onClick={() => handleEdit(expense)}
                    >
                      <Edit2 className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setDeleteId(expense.id)}
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
  );
};