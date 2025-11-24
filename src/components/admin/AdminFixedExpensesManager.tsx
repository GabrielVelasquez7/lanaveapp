import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/components/ui/use-toast';
import { formatCurrency } from '@/lib/utils';
import { Plus, Trash2, Edit2, DollarSign } from 'lucide-react';
import { format, startOfWeek, endOfWeek } from 'date-fns';

interface FixedExpense {
  id: string;
  description: string;
  amount_bs: number;
  amount_usd: number;
  created_at: string;
}

export function AdminFixedExpensesManager() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [expenses, setExpenses] = useState<FixedExpense[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<FixedExpense | null>(null);
  const [currentWeek, setCurrentWeek] = useState<{ start: Date; end: Date } | null>(null);

  const [formData, setFormData] = useState<{ 
    description: string;
    amount_bs: string;
    amount_usd: string;
  }>({
    description: '',
    amount_bs: '',
    amount_usd: '',
  });

  useEffect(() => {
    // Calculate current week starting on Monday
    const today = new Date();
    const weekStart = startOfWeek(today, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(today, { weekStartsOn: 1 });
    setCurrentWeek({ start: weekStart, end: weekEnd });
  }, []);

  useEffect(() => {
    if (currentWeek) {
      fetchExpenses();
    }
  }, [currentWeek]);

  const fetchExpenses = async () => {
    if (!currentWeek) return;

    try {
      setLoading(true);
      const startStr = format(currentWeek.start, 'yyyy-MM-dd');
      const endStr = format(currentWeek.end, 'yyyy-MM-dd');

      const { data: expensesData, error } = await supabase
        .from('weekly_bank_expenses')
        .select('*')
        .eq('week_start_date', startStr)
        .eq('week_end_date', endStr)
        .is('group_id', null) // Solo gastos fijos (globales)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formatted = (expensesData || []).map(exp => ({
        id: exp.id,
        description: exp.description,
        amount_bs: Number(exp.amount_bs || 0),
        amount_usd: Number(exp.amount_usd || 0),
        created_at: exp.created_at,
      }));

      setExpenses(formatted);
    } catch (error) {
      console.error('Error fetching fixed expenses:', error);
      toast({
        title: 'Error',
        description: 'Error al cargar gastos fijos',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.description.trim() || (!formData.amount_bs && !formData.amount_usd)) {
      toast({
        title: 'Error',
        description: 'Por favor completa la descripción y al menos un monto (Bs o USD)',
        variant: 'destructive',
      });
      return;
    }

    if (!currentWeek) return;

    try {
      const startStr = format(currentWeek.start, 'yyyy-MM-dd');
      const endStr = format(currentWeek.end, 'yyyy-MM-dd');

      const expenseData = {
        group_id: null, // Siempre null para gastos fijos
        agency_id: null,
        week_start_date: startStr,
        week_end_date: endStr,
        category: 'otros' as const,
        description: formData.description,
        amount_bs: Number(formData.amount_bs || 0),
        amount_usd: Number(formData.amount_usd || 0),
        created_by: user?.id,
      };

      if (editingExpense) {
        const { error } = await supabase
          .from('weekly_bank_expenses')
          .update(expenseData)
          .eq('id', editingExpense.id);

        if (error) throw error;

        toast({
          title: 'Éxito',
          description: 'Gasto fijo actualizado correctamente',
        });
      } else {
        const { error } = await supabase
          .from('weekly_bank_expenses')
          .insert([expenseData]);

        if (error) throw error;

        toast({
          title: 'Éxito',
          description: 'Gasto fijo creado correctamente',
        });
      }

      setFormData({ description: '', amount_bs: '', amount_usd: '' });
      setEditingExpense(null);
      setDialogOpen(false);
      fetchExpenses();
    } catch (error) {
      console.error('Error saving fixed expense:', error);
      toast({
        title: 'Error',
        description: 'Error al guardar el gasto fijo',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar este gasto fijo?')) return;

    try {
      const { error } = await supabase
        .from('weekly_bank_expenses')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Éxito',
        description: 'Gasto fijo eliminado correctamente',
      });

      fetchExpenses();
    } catch (error) {
      console.error('Error deleting fixed expense:', error);
      toast({
        title: 'Error',
        description: 'Error al eliminar el gasto fijo',
        variant: 'destructive',
      });
    }
  };

  const handleEdit = (expense: FixedExpense) => {
    setEditingExpense(expense);
    setFormData({
      description: expense.description,
      amount_bs: expense.amount_bs.toString(),
      amount_usd: expense.amount_usd.toString(),
    });
    setDialogOpen(true);
  };

  const totalBs = expenses.reduce((sum, exp) => sum + exp.amount_bs, 0);
  const totalUsd = expenses.reduce((sum, exp) => sum + exp.amount_usd, 0);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Gestión de Gastos Fijos
          </CardTitle>
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) {
              setEditingExpense(null);
              setFormData({ description: '', amount_bs: '', amount_usd: '' });
            }
          }}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Agregar Gasto Fijo
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{editingExpense ? 'Editar Gasto Fijo' : 'Agregar Gasto Fijo'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} noValidate className="space-y-4">
                <div className="p-3 bg-muted/30 rounded-lg border">
                  <p className="text-xs text-muted-foreground">
                    Los gastos fijos se aplican globalmente a todas las agencias
                  </p>
                </div>

                <div>
                  <Label>Descripción</Label>
                  <Textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Describe el gasto fijo..."
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Monto (Bs)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.amount_bs}
                      onChange={(e) => setFormData({ ...formData, amount_bs: e.target.value })}
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <Label>Monto (USD)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.amount_usd}
                      onChange={(e) => setFormData({ ...formData, amount_usd: e.target.value })}
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <div className="flex gap-2 justify-end">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit">
                    {editingExpense ? 'Actualizar' : 'Guardar'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-4 text-muted-foreground">Cargando gastos fijos...</div>
        ) : (
          <div className="space-y-4">
            {currentWeek && (
              <div className="text-sm text-muted-foreground mb-4">
                Semana: {format(currentWeek.start, 'dd/MM/yyyy')} - {format(currentWeek.end, 'dd/MM/yyyy')}
              </div>
            )}

            {expenses.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground border rounded-lg bg-muted/20">
                No hay gastos fijos registrados para esta semana
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Descripción</TableHead>
                      <TableHead className="text-right">Monto (Bs)</TableHead>
                      <TableHead className="text-right">Monto (USD)</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {expenses.map((expense) => (
                      <TableRow key={expense.id}>
                        <TableCell className="text-sm">{expense.description}</TableCell>
                        <TableCell className="text-right font-semibold">
                          {formatCurrency(expense.amount_bs, 'VES')}
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {formatCurrency(expense.amount_usd, 'USD')}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-1 justify-end">
                            <Button size="icon" variant="ghost" onClick={() => handleEdit(expense)}>
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="ghost" onClick={() => handleDelete(expense.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                <div className="flex justify-end border-t pt-4">
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground mb-1">Total Gastos Fijos</p>
                    <div className="space-y-1">
                      <p className="text-lg font-bold text-red-600">
                        {formatCurrency(totalBs, 'VES')}
                      </p>
                      {totalUsd > 0 && (
                        <p className="text-lg font-bold text-red-600">
                          {formatCurrency(totalUsd, 'USD')}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

