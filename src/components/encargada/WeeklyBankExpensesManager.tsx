import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/components/ui/use-toast';
import { formatCurrency } from '@/lib/utils';
import { Plus, Trash2, Edit2, DollarSign } from 'lucide-react';
import { format } from 'date-fns';

interface WeeklyExpense {
  id: string;
  group_id: string | null;
  group_name: string;
  category: 'gasto_operativo' | 'deuda' | 'otros';
  description: string;
  amount_bs: number;
  created_at: string;
}

interface AgencyGroup {
  id: string;
  name: string;
  description: string;
}

interface WeeklyBankExpensesManagerProps {
  weekStart: Date;
  weekEnd: Date;
  onExpensesChange: () => void;
}

export function WeeklyBankExpensesManager({ weekStart, weekEnd, onExpensesChange }: WeeklyBankExpensesManagerProps) {
  const { user } = useAuth();
  const { toast } = useToast();

  const [expenses, setExpenses] = useState<WeeklyExpense[]>([]);
  const [groups, setGroups] = useState<AgencyGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<WeeklyExpense | null>(null);
  const [payrollTotal, setPayrollTotal] = useState<{ bs: number; usd: number }>({ bs: 0, usd: 0 });

  const [formData, setFormData] = useState<{ 
    group_id: string;
    category: 'gasto_operativo' | 'deuda' | 'otros';
    description: string;
    amount_bs: string;
  }>({
    group_id: '',
    category: 'gasto_operativo',
    description: '',
    amount_bs: '',
  });

  useEffect(() => {
    initializeGroups();
  }, []);

  useEffect(() => {
    if (groups.length > 0) {
      fetchExpenses();
      fetchPayroll();
    }
  }, [weekStart, weekEnd, groups]);

  const fetchPayroll = async () => {
    try {
      const startStr = format(weekStart, 'yyyy-MM-dd');
      
      const { data: payrollData, error } = await supabase
        .from('weekly_payroll')
        .select('total_bs, total_usd')
        .eq('week_start_date', startStr);

      if (error) throw error;

      const total = (payrollData || []).reduce(
        (acc, entry) => ({
          bs: acc.bs + Number(entry.total_bs || 0),
          usd: acc.usd + Number(entry.total_usd || 0),
        }),
        { bs: 0, usd: 0 }
      );

      setPayrollTotal(total);
    } catch (error) {
      console.error('Error fetching payroll:', error);
    }
  };

  const initializeGroups = async () => {
    try {
      // Check if groups exist
      const { data: existingGroups, error: fetchError } = await supabase
        .from('agency_groups')
        .select('*')
        .order('name');

      if (fetchError) throw fetchError;

      if (!existingGroups || existingGroups.length === 0) {
        // Create default groups
        const defaultGroups = [
          { name: 'GRUPO 1', description: 'CEMENTERIO, PANTEON, AV.SUCRE, SAN MARTIN, CAPITOLIO, VICTORIA 2, VICTORIA 1, BARALT' },
          { name: 'GRUPO 2', description: 'CANDELARIA' },
          { name: 'GRUPO 3', description: 'PARQUE CENTRAL' }
        ];

        const { data: newGroups, error: insertError } = await supabase
          .from('agency_groups')
          .insert(defaultGroups)
          .select();

        if (insertError) {
          console.error('Error creating groups:', insertError);
        } else {
          setGroups(newGroups || []);
        }
      } else {
        setGroups(existingGroups);
      }
    } catch (error) {
      console.error('Error initializing groups:', error);
    }
  };

  const fetchExpenses = async () => {
    try {
      setLoading(true);
      const startStr = format(weekStart, 'yyyy-MM-dd');
      const endStr = format(weekEnd, 'yyyy-MM-dd');

      const { data: expensesData, error } = await supabase
        .from('weekly_bank_expenses')
        .select('*, agency_groups(name)')
        .eq('week_start_date', startStr)
        .eq('week_end_date', endStr)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const fetchedExpenses = expensesData || [];
      
      // Fixed commission expenses that should always exist
      const fixedCommissions = [
        'Comisión P/M Pagados',
        'Comisión Puntos Bancamiga',
        'Comisión Semanal 1$ Punto Bancamiga',
        'Comisión Puntos Banesco',
        'Comisión Diaria Mantenimiento Banesco',
        'Comisión Punto Venezuela',
        'Comisión Diaria Mantenimiento Venezuela',
        'Comisión Cierre Punto BNC',
        'Comisión Diaria Mantenimiento BNC'
      ];
      
      // Check which commissions are missing using normalized comparison
      const normalize = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').trim().toLowerCase();
      const existingSet = new Set((fetchedExpenses as any[]).map(e => normalize(e.description)));
      const missingCommissions = fixedCommissions.filter(
        (comm) => !existingSet.has(normalize(comm))
      );
      
      // Create missing commissions (always GLOBAL)
      if (missingCommissions.length > 0 && user?.id) {
        const newCommissions = missingCommissions.map(description => ({
          group_id: null as string | null,
          agency_id: null as string | null,
          week_start_date: startStr,
          week_end_date: endStr,
          category: 'otros' as const,
          description,
          amount_bs: 0,
          created_by: user.id
        }));
        
        const { error: insertError } = await supabase
          .from('weekly_bank_expenses')
          .insert(newCommissions);
        
        if (insertError) {
          console.error('Error creating fixed commissions:', insertError);
        } else {
          // Refetch to get the complete list
          const { data: refreshedData } = await supabase
            .from('weekly_bank_expenses')
            .select('*, agency_groups(name)')
            .eq('week_start_date', startStr)
            .eq('week_end_date', endStr)
            .order('created_at', { ascending: false });
          
          if (refreshedData) {
            const formatted = refreshedData.map(exp => ({
              id: exp.id,
              group_id: exp.group_id,
              group_name: exp.group_id ? (exp.agency_groups as any)?.name || 'Grupo desconocido' : 'GLOBAL',
              category: exp.category,
              description: exp.description,
              amount_bs: Number(exp.amount_bs),
              created_at: exp.created_at,
            }));
            setExpenses(formatted);
          }
          setLoading(false);
          return;
        }
      }

      const formatted = fetchedExpenses.map(exp => ({
        id: exp.id,
        group_id: exp.group_id,
        group_name: exp.group_id ? (exp.agency_groups as any)?.name || 'Grupo desconocido' : 'GLOBAL',
        category: exp.category,
        description: exp.description,
        amount_bs: Number(exp.amount_bs),
        created_at: exp.created_at,
      }));

      setExpenses(formatted);
    } catch (error) {
      console.error('Error fetching expenses:', error);
      toast({
        title: 'Error',
        description: 'Error al cargar gastos semanales',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.description.trim() || !formData.amount_bs) {
      toast({
        title: 'Error',
        description: 'Por favor completa todos los campos',
        variant: 'destructive',
      });
      return;
    }

    try {
      const startStr = format(weekStart, 'yyyy-MM-dd');
      const endStr = format(weekEnd, 'yyyy-MM-dd');

      const isFixed = editingExpense ? isFixedCommission(editingExpense.description) : isFixedCommission(formData.description);

      const expenseData = {
        group_id: isFixed ? null : (formData.group_id === 'global' || !formData.group_id ? null : formData.group_id),
        agency_id: null,
        week_start_date: startStr,
        week_end_date: endStr,
        category: isFixed ? 'otros' : formData.category,
        description: isFixed && editingExpense ? editingExpense.description : formData.description,
        amount_bs: Number(formData.amount_bs),
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
          description: 'Gasto actualizado correctamente',
        });
      } else {
        const { error } = await supabase
          .from('weekly_bank_expenses')
          .insert([expenseData]);

        if (error) throw error;

        toast({
          title: 'Éxito',
          description: 'Gasto registrado correctamente',
        });
      }

      setFormData({ group_id: '', category: 'gasto_operativo', description: '', amount_bs: '' });
      setEditingExpense(null);
      setDialogOpen(false);
      fetchExpenses();
      onExpensesChange();
    } catch (error) {
      console.error('Error saving expense:', error);
      toast({
        title: 'Error',
        description: 'Error al guardar el gasto',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar este gasto?')) return;

    try {
      const { error } = await supabase
        .from('weekly_bank_expenses')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Éxito',
        description: 'Gasto eliminado correctamente',
      });

      fetchExpenses();
      onExpensesChange();
    } catch (error) {
      console.error('Error deleting expense:', error);
      toast({
        title: 'Error',
        description: 'Error al eliminar el gasto',
        variant: 'destructive',
      });
    }
  };

  const handleEdit = (expense: WeeklyExpense) => {
    setEditingExpense(expense);
    setFormData({
      group_id: expense.group_id || 'global',
      category: expense.category as any,
      description: expense.description,
      amount_bs: expense.amount_bs.toString(),
    });
    setDialogOpen(true);
  };

  // Check if a description is a fixed commission
  const isFixedCommission = (description: string) => {
    const fixedCommissions = [
      'Comisión P/M Pagados',
      'Comisión Puntos Bancamiga',
      'Comisión Semanal 1$ Punto Bancamiga',
      'Comisión Puntos Banesco',
      'Comisión Diaria Mantenimiento Banesco',
      'Comisión Punto Venezuela',
      'Comisión Diaria Mantenimiento Venezuela',
      'Comisión Cierre Punto BNC',
      'Comisión Diaria Mantenimiento BNC'
    ];
    return fixedCommissions.includes(description);
  };

  // Separar comisiones fijas de gastos regulares
  const fixedExpenses = expenses.filter(exp => isFixedCommission(exp.description));
  const regularExpenses = expenses.filter(exp => !isFixedCommission(exp.description));
  
  // Incluir nómina en gastos fijos
  const totalFixed = fixedExpenses.reduce((sum, exp) => sum + exp.amount_bs, 0) + payrollTotal.bs;
  const totalRegular = regularExpenses.reduce((sum, exp) => sum + exp.amount_bs, 0);
  const totalExpenses = totalFixed + totalRegular;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Gastos Fijos Semanales
          </CardTitle>
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) {
              setEditingExpense(null);
              setFormData({ group_id: '', category: 'gasto_operativo', description: '', amount_bs: '' });
            }
          }}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Agregar Gasto
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{editingExpense ? 'Editar Gasto' : 'Agregar Gasto Semanal'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label>Grupo</Label>
                  <Select 
                    disabled={!!(editingExpense && isFixedCommission(editingExpense.description))}
                    value={formData.group_id} 
                    onValueChange={(val) => setFormData({ ...formData, group_id: val })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar grupo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="global">GLOBAL - Todos los grupos</SelectItem>
                      {groups.map((group) => (
                        <SelectItem key={group.id} value={group.id}>
                          {group.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Categoría</Label>
                  <Select 
                    disabled={!!(editingExpense && isFixedCommission(editingExpense.description))}
                    value={formData.category}
                    onValueChange={(val: 'gasto_operativo' | 'deuda' | 'otros') => setFormData({ ...formData, category: val })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gasto_operativo">Gastos Operativos</SelectItem>
                      <SelectItem value="deuda">Deudas</SelectItem>
                      <SelectItem value="otros">Otros</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Descripción</Label>
                  <Textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Describe el gasto..."
                    rows={3}
                    disabled={editingExpense && isFixedCommission(editingExpense.description)}
                  />
                  {editingExpense && isFixedCommission(editingExpense.description) && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Las comisiones fijas no pueden cambiar su descripción
                    </p>
                  )}
                </div>

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
          <div className="text-center py-4 text-muted-foreground">Cargando gastos...</div>
        ) : (
          <div className="space-y-6">
            {/* Gastos Fijos (Comisiones + Nómina) */}
            <Accordion type="single" collapsible defaultValue="fixed-expenses">
              <AccordionItem value="fixed-expenses" className="border rounded-lg">
                <AccordionTrigger className="px-4 hover:no-underline">
                  <div className="flex items-center justify-between w-full pr-4">
                    <div className="flex items-center gap-3">
                      <Badge variant="secondary" className="font-semibold">GASTOS FIJOS</Badge>
                      <span className="text-sm text-muted-foreground">
                        {fixedExpenses.length} comisiones + Nómina
                      </span>
                    </div>
                    <span className="font-bold text-red-600">
                      {formatCurrency(totalFixed, 'VES')}
                    </span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4 space-y-4">
                  {/* Nómina */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-semibold text-muted-foreground">NÓMINA</h4>
                      <span className="font-bold text-red-600">
                        {formatCurrency(payrollTotal.bs, 'VES')}
                      </span>
                    </div>
                    {payrollTotal.bs > 0 ? (
                      <div className="bg-muted/30 rounded-lg p-3 border border-dashed">
                        <div className="flex justify-between items-center">
                          <span className="text-sm">Total Nómina Semanal</span>
                          <div className="text-right">
                            <div className="font-semibold text-red-600">
                              {formatCurrency(payrollTotal.bs, 'VES')}
                            </div>
                            {payrollTotal.usd > 0 && (
                              <div className="text-xs text-muted-foreground">
                                {formatCurrency(payrollTotal.usd, 'USD')}
                              </div>
                            )}
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                          Este monto se resta automáticamente como gasto fijo
                        </p>
                      </div>
                    ) : (
                      <div className="text-center py-4 text-sm text-muted-foreground border rounded-lg bg-muted/20">
                        No hay nómina registrada para esta semana
                      </div>
                    )}
                  </div>

                  <Separator />

                  {/* Comisiones Fijas */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-semibold text-muted-foreground">COMISIONES FIJAS</h4>
                      <span className="font-bold text-red-600">
                        {formatCurrency(fixedExpenses.reduce((sum, exp) => sum + exp.amount_bs, 0), 'VES')}
                      </span>
                    </div>
                    {fixedExpenses.length === 0 ? (
                      <div className="text-center py-4 text-sm text-muted-foreground border rounded-lg bg-muted/20">
                        No hay comisiones registradas
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Descripción</TableHead>
                            <TableHead className="text-right">Monto</TableHead>
                            <TableHead className="text-right w-24">Acciones</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {fixedExpenses.map((expense) => (
                            <TableRow key={expense.id}>
                              <TableCell className="text-sm">{expense.description}</TableCell>
                              <TableCell className="text-right font-semibold text-red-600">
                                {formatCurrency(expense.amount_bs, 'VES')}
                              </TableCell>
                              <TableCell className="text-right">
                                <Button size="icon" variant="ghost" onClick={() => handleEdit(expense)}>
                                  <Edit2 className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            {/* Gastos Regulares */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-muted-foreground">GASTOS ADICIONALES</h3>
                {regularExpenses.length > 0 && (
                  <span className="text-sm font-bold text-red-600">
                    {formatCurrency(totalRegular, 'VES')}
                  </span>
                )}
              </div>
              {regularExpenses.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground border rounded-lg bg-muted/20">
                  No hay gastos adicionales para esta semana
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Grupo</TableHead>
                      <TableHead>Categoría</TableHead>
                      <TableHead>Descripción</TableHead>
                      <TableHead className="text-right">Monto</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {regularExpenses.map((expense) => (
                      <TableRow key={expense.id}>
                        <TableCell className="font-medium">{expense.group_name}</TableCell>
                        <TableCell className="text-sm">
                          {expense.category === 'gasto_operativo' ? 'Gastos Operativos' : expense.category === 'deuda' ? 'Deudas' : 'Otros'}
                        </TableCell>
                        <TableCell className="text-sm">{expense.description}</TableCell>
                        <TableCell className="text-right font-semibold text-red-600">
                          {formatCurrency(expense.amount_bs, 'VES')}
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
              )}
            </div>

            {/* Total General */}
            <div className="flex justify-end border-t pt-4">
              <div className="text-right">
                <p className="text-sm text-muted-foreground mb-1">Total Gastos Semanales</p>
                <p className="text-2xl font-bold text-red-600">{formatCurrency(totalExpenses, 'VES')}</p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}