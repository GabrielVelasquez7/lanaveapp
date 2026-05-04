import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/components/ui/use-toast';
import { formatCurrency } from '@/lib/utils';
import { Plus, Trash2, Edit2, DollarSign, ChevronDown, ChevronRight, Zap } from 'lucide-react';
import { format } from 'date-fns';
import { posCommissionsService, type CommissionRow } from '@/services/posCommissionsService';

interface WeeklyExpense {
  id: string;
  group_id: string | null;
  group_name: string;
  category: 'gasto_operativo' | 'deuda' | 'otros';
  description: string;
  amount_bs: number;
  amount_usd: number;
  created_at: string;
  week_start_date?: string;
  week_end_date?: string;
  is_fixed?: boolean;
  agency_id?: string | null;
  pos_sales_bs?: number; // monto de ventas POS que originó esta comisión
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
  agencyId?: string; // Optional: filter payroll by agency
}

export function WeeklyBankExpensesManager({ weekStart, weekEnd, onExpensesChange, agencyId }: WeeklyBankExpensesManagerProps) {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  
  const isAdmin = profile?.role === 'administrador';
  const isEncargada = profile?.role === 'encargada';

  const [expenses, setExpenses] = useState<WeeklyExpense[]>([]);
  const [groups, setGroups] = useState<AgencyGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<WeeklyExpense | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [expenseToDelete, setExpenseToDelete] = useState<string | null>(null);
  const [payrollTotal, setPayrollTotal] = useState<{ bs: number; usd: number }>({ bs: 0, usd: 0 });
  const [payrollByAgency, setPayrollByAgency] = useState<{ 
    agencyName: string; 
    total_bs: number; 
    total_usd: number;
    employees: { name: string; total_bs: number; total_usd: number }[];
  }[]>([]);
  const [expandedAgencies, setExpandedAgencies] = useState<Record<string, boolean>>({});

  // POS Commissions (encargada generates from live data)
  const [posCommissionRows, setPosCommissionRows] = useState<CommissionRow[]>([]);
  const [posBcvRate, setPosBcvRate] = useState('');
  const [posGenerating, setPosGenerating] = useState(false);

  const fetchLivePosCommissions = async () => {
    try {
      const [rows, suggestedBcv] = await Promise.all([
        posCommissionsService.getLiveCommissionsForWeek(weekStart, weekEnd),
        posCommissionsService.fetchSuggestedBcv(weekStart),
      ]);
      // Filtrar por agencia si aplica
      const filtered = agencyId ? rows.filter(r => r.agency_id === agencyId) : rows;
      setPosCommissionRows(filtered);
      // Pre-cargar la tasa BCV si está disponible y el campo está vacío
      if (suggestedBcv && !posBcvRate) {
        setPosBcvRate(String(suggestedBcv));
      }
    } catch (e) {
      console.error('Error fetching live POS commissions:', e);
    }
  };

  const handleGeneratePosCommissions = async () => {
    if (!user) return;
    const bcv = Number(posBcvRate);
    if (!bcv || bcv <= 0) {
      toast({ title: 'Tasa BCV requerida', description: 'Ingresa la tasa BCV actual antes de guardar.', variant: 'destructive' });
      return;
    }
    const pending = posCommissionRows.filter(r => r.needs_split);
    if (pending.length > 0) {
      toast({
        title: 'Datos incompletos',
        description: `Debes registrar el split para: ${pending.map(r => r.bank_name).join(', ')}. Ve a Comisiones POS para configurarlo.`,
        variant: 'destructive',
      });
      return;
    }
    setPosGenerating(true);
    try {
      const res = await posCommissionsService.generateCommissions({
        weekStart,
        weekEnd,
        bcvRate: bcv,
        rows: posCommissionRows,
        userId: user.id,
      });
      toast({ title: '✓ Comisiones POS guardadas', description: `${res.inserted} comisiones registradas como gastos fijos.` });
      // Refresh expenses list
      await fetchExpenses();
      onExpensesChange();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setPosGenerating(false);
    }
  };

  const [formData, setFormData] = useState<{ 
    group_id: string;
    description: string;
    amount_bs: string;
    is_fixed: boolean;
  }>({
    group_id: '',
    description: '',
    amount_bs: '',
    is_fixed: false,
  });

  useEffect(() => {
    initializeGroups();
  }, []);

  useEffect(() => {
    if (groups.length > 0) {
      fetchExpenses();
      fetchPayroll();
      if (isEncargada) fetchLivePosCommissions();
    }
  }, [weekStart, weekEnd, groups, agencyId]);

  const fetchPayroll = async () => {
    try {
      const startStr = format(weekStart, 'yyyy-MM-dd');
      
      // Fetch payroll joined with employees to get agency info
      let query = supabase
        .from('weekly_payroll')
        .select('total_bs, total_usd, employees(name, agency_id, agencies(name))')
        .eq('week_start_date', startStr);

      // If filtering by agency, only get employees of that agency
      if (agencyId) {
        query = query.eq('employees.agency_id', agencyId);
      }

      const { data: payrollData, error } = await query;

      if (error) throw error;

      // Aggregate total — only count entries where employees match (non-null when filtered)
      const filteredData = agencyId
        ? (payrollData || []).filter((e: any) => e.employees?.agency_id === agencyId)
        : (payrollData || []);

      const total = filteredData.reduce(
        (acc, entry) => ({
          bs: acc.bs + Number(entry.total_bs || 0),
          usd: acc.usd + Number(entry.total_usd || 0),
        }),
        { bs: 0, usd: 0 }
      );

      // Group by agency
      const agencyMap = new Map<string, { 
        agencyName: string; 
        total_bs: number; 
        total_usd: number;
        employees: { name: string; total_bs: number; total_usd: number }[];
      }>();
      
      filteredData.forEach((entry: any) => {
        const agencyName = entry.employees?.agencies?.name || 'Sin agencia';
        const employeeName = entry.employees?.name || 'Desconocido';
        const entryBs = Number(entry.total_bs || 0);
        const entryUsd = Number(entry.total_usd || 0);

        const existing = agencyMap.get(agencyName) || { 
          agencyName, 
          total_bs: 0, 
          total_usd: 0,
          employees: []
        };

        existing.total_bs += entryBs;
        existing.total_usd += entryUsd;
        existing.employees.push({
          name: employeeName,
          total_bs: entryBs,
          total_usd: entryUsd
        });

        agencyMap.set(agencyName, existing);
      });

      const byAgency = Array.from(agencyMap.values()).sort((a, b) => a.agencyName.localeCompare(b.agencyName));

      setPayrollTotal(total);
      setPayrollByAgency(byAgency);
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

      // Obtener gastos de la semana actual
      const { data: expensesData, error } = await supabase
        .from('weekly_bank_expenses')
        .select('*, agency_groups(name)')
        .eq('week_start_date', startStr)
        .eq('week_end_date', endStr)
        .order('created_at', { ascending: false });

      if (error) throw error;

      let fetchedExpenses = expensesData || [];

      // Obtener todos los gastos fijos (group_id === null o description con prefijo [FIJO])
      // para mostrarlos en todas las semanas
      const { data: fixedExpensesData, error: fixedError } = await supabase
        .from('weekly_bank_expenses')
        .select('*, agency_groups(name)')
        .or('group_id.is.null,description.ilike.[FIJO]%')
        .order('created_at', { ascending: false });

      if (!fixedError && fixedExpensesData) {
        // Filtrar las comisiones POS auto-generadas para que no se copien a semanas futuras
        const validFixedData = fixedExpensesData.filter(e => !e.description.startsWith('Comisión POS '));
        
        // Agrupar gastos fijos por descripción y grupo para tomar el más reciente
        const fixedExpensesMap = new Map<string, any>();
        validFixedData.forEach(exp => {
          const key = `${exp.group_id || 'global'}_${exp.description}`;
          if (!fixedExpensesMap.has(key)) {
            fixedExpensesMap.set(key, exp);
          } else {
            const existing = fixedExpensesMap.get(key);
            if (new Date(exp.created_at) > new Date(existing.created_at)) {
              fixedExpensesMap.set(key, exp);
            }
          }
        });

        // Agregar gastos fijos que no están en la semana actual
        fixedExpensesMap.forEach((fixedExp) => {
          const existsInCurrentWeek = fetchedExpenses.some(exp => 
            exp.description === fixedExp.description && 
            exp.group_id === fixedExp.group_id && 
            exp.week_start_date === startStr
          );
          
          if (!existsInCurrentWeek) {
            // Crear una copia del gasto fijo para mostrar en la semana actual
            // Usar el ID original pero marcar que pertenece a otra semana
            fetchedExpenses.push({
              ...fixedExp,
              week_start_date: fixedExp.week_start_date || startStr,
              week_end_date: fixedExp.week_end_date || endStr,
              // Mantener el ID original para poder identificarlo
            });
          }
        });
      }
      
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
            const formatted = refreshedData
              .filter(exp => Number(exp.amount_bs || 0) > 0)
              .map(exp => {
                const isGroupFixed = exp.description.startsWith('[FIJO] ');
                const cleanDesc = isGroupFixed ? exp.description.substring(7) : exp.description;
                return {
                  id: exp.id,
                  group_id: exp.group_id,
                  group_name: exp.group_id ? (exp.agency_groups as any)?.name || 'Grupo desconocido' : 'GLOBAL',
                  category: exp.category,
                  description: cleanDesc,
                  amount_bs: Number(exp.amount_bs || 0),
                  amount_usd: Number(exp.amount_usd || 0),
                  created_at: exp.created_at,
                  week_start_date: exp.week_start_date,
                  week_end_date: exp.week_end_date,
                  is_fixed: isGroupFixed || exp.group_id === null,
                  agency_id: exp.agency_id,
                };
              });
            setExpenses(formatted);
          }
          setLoading(false);
          return;
        }
      }

      const formatted = fetchedExpenses
        .filter(exp => Number(exp.amount_bs || 0) > 0)
        .map(exp => {
          const isGroupFixed = exp.description.startsWith('[FIJO] ');
          const cleanDesc = isGroupFixed ? exp.description.substring(7) : exp.description;
          return {
            id: exp.id,
            group_id: exp.group_id,
            group_name: exp.group_id ? (exp.agency_groups as any)?.name || 'Grupo desconocido' : 'GLOBAL',
            category: exp.category,
            description: cleanDesc,
            amount_bs: Number(exp.amount_bs || 0),
            amount_usd: Number(exp.amount_usd || 0),
            created_at: exp.created_at,
            week_start_date: exp.week_start_date,
            week_end_date: exp.week_end_date,
            is_fixed: isGroupFixed || exp.group_id === null,
            agency_id: exp.agency_id,
          };
        });

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
        description: 'Por favor completa la descripción y el monto en Bs',
        variant: 'destructive',
      });
      return;
    }

    try {
      const startStr = format(weekStart, 'yyyy-MM-dd');
      const endStr = format(weekEnd, 'yyyy-MM-dd');

      // Determinar si es gasto fijo:
      // 1. Si está editando, usar la función isExpenseFixed para mantener consistencia
      // 2. Si es nuevo gasto, usar el valor del switch formData.is_fixed
      const isFixed = editingExpense 
        ? isExpenseFixed(editingExpense)
        : formData.is_fixed || isFixedCommission(formData.description);

      // La encargada NO puede editar gastos fijos en Bs
      if (isEncargada && editingExpense && isFixed) {
        toast({
          title: 'Error',
          description: 'No puedes editar gastos fijos. Solo el administrador puede hacerlo.',
          variant: 'destructive',
        });
        return;
      }

      const isGlobalFixed = isFixed && (formData.group_id === 'global' || !formData.group_id);
      const isGroupFixed = isFixed && !isGlobalFixed;
      const rawDescription = isGroupFixed ? `[FIJO] ${formData.description}` : formData.description;

      const expenseData = {
        group_id: isGlobalFixed ? null : formData.group_id,
        agency_id: null,
        week_start_date: startStr,
        week_end_date: endStr,
        category: 'otros' as const,
        description: rawDescription,
        amount_bs: Number(formData.amount_bs || 0),
        // No incluimos amount_usd - cada moneda es independiente
        created_by: user?.id,
      };

      if (editingExpense) {
        // Para gastos fijos: solo actualizar el registro de la semana actual
        // NO modificar semanas pasadas ni futuras
        if (isFixed) {
          // Verificar si el gasto que se está editando pertenece a la semana actual
          const expenseWeekStart = editingExpense.week_start_date || editingExpense.created_at?.split('T')[0];
          
          if (expenseWeekStart === startStr) {
            // El gasto pertenece a la semana actual, actualizar ese registro
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
            // El gasto pertenece a otra semana, crear uno nuevo para la semana actual
            // Esto permite modificar el monto solo para esta semana sin afectar otras
            const { error: insertError } = await supabase
              .from('weekly_bank_expenses')
              .insert([expenseData]);

            if (insertError) throw insertError;

            toast({
              title: 'Éxito',
              description: 'Gasto fijo actualizado para esta semana',
            });
          }
        } else {
          // El gasto NO es fijo, actualizar normalmente solo el registro actual
          const { error } = await supabase
            .from('weekly_bank_expenses')
            .update(expenseData)
            .eq('id', editingExpense.id);

          if (error) throw error;

          toast({
            title: 'Éxito',
            description: 'Gasto actualizado correctamente',
          });
        }
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

      setFormData({ group_id: '', description: '', amount_bs: '', is_fixed: false });
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

  const handleDeleteClick = (id: string) => {
    // Verificar si es un gasto fijo y el usuario es encargada
    const expense = expenses.find(exp => exp.id === id);
    if (expense && isExpenseFixed(expense) && isEncargada) {
      toast({
        title: 'Error',
        description: 'No puedes eliminar gastos fijos. Solo el administrador puede hacerlo.',
        variant: 'destructive',
      });
      return;
    }
    setExpenseToDelete(id);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!expenseToDelete) return;

    try {
      // Buscar el gasto que se va a eliminar para verificar si es fijo
      const expenseToRemove = expenses.find(exp => exp.id === expenseToDelete);
      
      if (expenseToRemove && isExpenseFixed(expenseToRemove)) {
        const rawDescription = expenseToRemove.is_fixed && expenseToRemove.group_id !== null 
          ? `[FIJO] ${expenseToRemove.description}` 
          : expenseToRemove.description;

        let deleteQuery = supabase
          .from('weekly_bank_expenses')
          .delete()
          .eq('description', rawDescription);

        if (expenseToRemove.group_id === null) {
          deleteQuery = deleteQuery.is('group_id', null);
        } else {
          deleteQuery = deleteQuery.eq('group_id', expenseToRemove.group_id);
        }

        const { error } = await deleteQuery;

        if (error) throw error;

        toast({
          title: 'Éxito',
          description: 'Gasto fijo eliminado correctamente de todas las semanas',
        });
      } else {
        // Si es un gasto regular, eliminar solo el registro actual
        const { error } = await supabase
          .from('weekly_bank_expenses')
          .delete()
          .eq('id', expenseToDelete);

        if (error) throw error;

        toast({
          title: 'Éxito',
          description: 'Gasto eliminado correctamente',
        });
      }

      fetchExpenses();
      onExpensesChange();
    } catch (error) {
      console.error('Error deleting expense:', error);
      toast({
        title: 'Error',
        description: 'Error al eliminar el gasto',
        variant: 'destructive',
      });
    } finally {
      setDeleteDialogOpen(false);
      setExpenseToDelete(null);
    }
  };

  // Función helper para determinar si un gasto es fijo (por flag o por descripción fija)
  const isExpenseFixed = (expense: WeeklyExpense) => {
    return expense.is_fixed || isFixedCommission(expense.description);
  };

  const handleEdit = (expense: WeeklyExpense) => {
    // La encargada NO puede editar gastos fijos en Bs
    if (isEncargada && isExpenseFixed(expense)) {
      toast({
        title: 'Error',
        description: 'No puedes editar gastos fijos. Solo el administrador puede hacerlo.',
        variant: 'destructive',
      });
      return;
    }
    
    setEditingExpense(expense);
    const isFixed = isExpenseFixed(expense);
    setFormData({
      group_id: expense.group_id || 'global',
      description: expense.description,
      amount_bs: expense.amount_bs.toString(),
      is_fixed: isFixed,
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
  // Un gasto es fijo si:
  // 1. is_fixed es verdadero (ya incluye [FIJO] o group_id === null) O
  // 2. Su descripción está en la lista de comisiones fijas
  const isPosExpense = (exp: WeeklyExpense) => exp.description?.startsWith('Comisión POS ') || false;
  const allPosExpenses = expenses.filter(exp => isPosExpense(exp));
  const posExpenses = agencyId ? allPosExpenses.filter(exp => exp.agency_id === agencyId) : allPosExpenses;

  const fixedExpenses = expenses.filter(exp => isExpenseFixed(exp) && !isPosExpense(exp));
  const regularExpenses = expenses.filter(exp => !isExpenseFixed(exp) && !isPosExpense(exp));
  
  // Incluir nómina en gastos fijos
  const totalFixedBs = fixedExpenses.reduce((sum, exp) => sum + exp.amount_bs, 0) + payrollTotal.bs;
  const totalFixedUsd = fixedExpenses.reduce((sum, exp) => sum + exp.amount_usd, 0) + payrollTotal.usd;
  const totalPosBs = posExpenses.reduce((sum, exp) => sum + exp.amount_bs, 0);
  const totalPosUsd = posExpenses.reduce((sum, exp) => sum + exp.amount_usd, 0);
  const totalRegularBs = regularExpenses.reduce((sum, exp) => sum + exp.amount_bs, 0);
  const totalRegularUsd = regularExpenses.reduce((sum, exp) => sum + exp.amount_usd, 0);
  const totalExpenses = totalFixedBs + totalPosBs + totalRegularBs;

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
              setFormData({ group_id: '', description: '', amount_bs: '', is_fixed: false });
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
              <form onSubmit={handleSubmit} noValidate className="space-y-4">
                {!editingExpense && (
                  <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border">
                    <div className="space-y-0.5">
                      <Label htmlFor="is-fixed" className="text-sm font-medium">
                        Gasto Fijo (Repetir cada semana)
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Ej: Alquiler, internet. Aparecerá automáticamente en este grupo todas las semanas.
                      </p>
                    </div>
                    <Switch
                      id="is-fixed"
                      checked={formData.is_fixed}
                      onCheckedChange={(checked) => {
                        setFormData({ 
                          ...formData, 
                          is_fixed: checked
                        });
                      }}
                    />
                  </div>
                )}
                
                {editingExpense && isExpenseFixed(editingExpense) ? (
                  <>
                    <div>
                      <Label>Descripción</Label>
                      <Input
                        value={formData.description}
                        disabled
                        className="bg-muted"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Los gastos fijos no pueden ser modificados por la encargada
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <Label>Grupo</Label>
                      <Select 
                        disabled={editingExpense && isExpenseFixed(editingExpense)}
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
                      <Label>Descripción</Label>
                      <Textarea
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        placeholder="Describe el gasto..."
                        rows={3}
                        disabled={editingExpense && isExpenseFixed(editingExpense)}
                      />
                    </div>
                  </>
                )}

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
            {/* ── GASTOS FIJOS ── */}
            <Accordion type="single" collapsible defaultValue="fixed-expenses">
              <AccordionItem value="fixed-expenses" className="border rounded-lg overflow-hidden">
                <AccordionTrigger className="px-4 py-3 hover:no-underline bg-muted/30 hover:bg-muted/50 transition-colors">
                  <div className="flex items-center justify-between w-full pr-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="font-bold text-xs tracking-wider">COMISIONES FIJAS</Badge>
                      <span className="text-xs text-muted-foreground">{fixedExpenses.length} conceptos</span>
                    </div>
                    <span className="font-bold text-red-600 font-mono text-sm">
                      {formatCurrency(fixedExpenses.reduce((sum, exp) => sum + exp.amount_bs, 0), 'VES')}
                    </span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-0 pb-0">
                  {fixedExpenses.length === 0 ? (
                    <div className="text-center py-6 text-sm text-muted-foreground bg-muted/10">
                      No hay gastos fijos registrados
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/20">
                          <TableHead className="pl-4">Descripción</TableHead>
                          <TableHead className="text-right">Monto (Bs)</TableHead>
                          {isAdmin && <TableHead className="text-right pr-4 w-20">Acción</TableHead>}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {fixedExpenses.map((expense) => (
                          <TableRow key={expense.id} className="hover:bg-muted/20">
                            <TableCell className="text-sm pl-4">{expense.description}</TableCell>
                            <TableCell className="text-right font-mono font-semibold text-red-600">
                              {formatCurrency(expense.amount_bs, 'VES')}
                            </TableCell>
                            {isAdmin && (
                              <TableCell className="text-right pr-4">
                                <div className="flex gap-1 justify-end">
                                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleEdit(expense)}>
                                    <Edit2 className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleDeleteClick(expense.id)}>
                                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                  </Button>
                                </div>
                              </TableCell>
                            )}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            {/* ── COMISIONES POS ── */}
            <Accordion type="single" collapsible defaultValue="pos-expenses">
              <AccordionItem value="pos-expenses" className="border rounded-lg overflow-hidden">
                <AccordionTrigger className="px-4 py-3 hover:no-underline bg-muted/30 hover:bg-muted/50 transition-colors">
                  <div className="flex items-center justify-between w-full pr-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="font-bold text-xs tracking-wider bg-blue-100 text-blue-800 hover:bg-blue-200">POS / PUNTO DE VENTA</Badge>
                      <span className="text-xs text-muted-foreground">{posExpenses.length} conceptos</span>
                    </div>
                    <span className="font-bold text-blue-600 font-mono text-sm">
                      {formatCurrency(totalPosBs, 'VES')}
                    </span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-0 pb-0">
                  {posExpenses.length === 0 ? (
                    <div className="text-center py-6 text-sm text-muted-foreground bg-muted/10">
                      No hay comisiones de punto de venta registradas
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/20">
                          <TableHead className="pl-4">Descripción</TableHead>
                          <TableHead className="text-right">Monto (Bs)</TableHead>
                          {isAdmin && <TableHead className="text-right pr-4 w-20">Acción</TableHead>}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {posExpenses.map((expense) => (
                          <TableRow key={expense.id} className="hover:bg-muted/20">
                            <TableCell className="text-sm pl-4">
                              <span>{expense.description}</span>
                              {expense.pos_sales_bs !== undefined && (
                                <span className="ml-2 text-xs text-muted-foreground font-normal">
                                  (ventas: {formatCurrency(expense.pos_sales_bs, 'VES')})
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="text-right font-mono font-semibold text-blue-600">
                              {formatCurrency(expense.amount_bs, 'VES')}
                            </TableCell>
                            {isAdmin && (
                              <TableCell className="text-right pr-4">
                                <div className="flex gap-1 justify-end">
                                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleEdit(expense)}>
                                    <Edit2 className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleDeleteClick(expense.id)}>
                                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                  </Button>
                                </div>
                              </TableCell>
                            )}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            {/* ── NÓMINA SEMANAL ── */}
            <Accordion type="single" collapsible defaultValue="payroll">
              <AccordionItem value="payroll" className="border rounded-lg overflow-hidden">
                <AccordionTrigger className="px-4 py-3 hover:no-underline bg-muted/30 hover:bg-muted/50 transition-colors">
                  <div className="flex items-center justify-between w-full pr-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="font-bold text-xs tracking-wider">NÓMINA</Badge>
                      <span className="text-xs text-muted-foreground">
                        {payrollByAgency.length > 0
                          ? agencyId
                            ? 'agencia específica'
                            : `${payrollByAgency.length} agencia${payrollByAgency.length !== 1 ? 's' : ''}`
                          : 'Sin datos'}
                      </span>
                    </div>
                    <span className="font-bold text-red-600 font-mono text-sm">
                      {formatCurrency(payrollTotal.bs, 'VES')}
                    </span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-0 pb-0">
                  {payrollByAgency.length === 0 ? (
                    <div className="text-center py-6 text-sm text-muted-foreground bg-muted/10">
                      No hay nómina registrada para esta semana
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/20">
                          <TableHead className="pl-4">Agencia</TableHead>
                          <TableHead className="text-right pr-4">Total (Bs)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {payrollByAgency.map((agency) => (
                          <React.Fragment key={agency.agencyName}>
                            <TableRow 
                              className="hover:bg-muted/20 cursor-pointer"
                              onClick={() => setExpandedAgencies(prev => ({ ...prev, [agency.agencyName]: !prev[agency.agencyName] }))}
                            >
                              <TableCell className="pl-4">
                                <div className="flex items-center gap-2">
                                  {expandedAgencies[agency.agencyName] ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                                  <span className="font-medium text-sm">{agency.agencyName}</span>
                                </div>
                              </TableCell>
                              <TableCell className="text-right font-mono font-semibold text-red-600 pr-4">
                                {formatCurrency(agency.total_bs, 'VES')}
                              </TableCell>
                            </TableRow>
                            {expandedAgencies[agency.agencyName] && agency.employees.map((emp, idx) => (
                              <TableRow key={`${agency.agencyName}-emp-${idx}`} className="bg-muted/5">
                                <TableCell className="pl-10 text-xs text-muted-foreground">
                                  ↳ {emp.name}
                                </TableCell>
                                <TableCell className="text-right font-mono text-xs text-muted-foreground pr-4">
                                  {formatCurrency(emp.total_bs, 'VES')}
                                </TableCell>
                              </TableRow>
                            ))}
                          </React.Fragment>
                        ))}
                        {payrollByAgency.length > 1 && (
                          <TableRow className="bg-muted/30 border-t-2">
                            <TableCell className="pl-4 font-semibold">Total Nómina</TableCell>
                            <TableCell className="text-right font-mono font-bold text-red-600 pr-4">
                              {formatCurrency(payrollTotal.bs, 'VES')}
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  )}
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            {/* Gastos Regulares */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-muted-foreground">GASTOS ADICIONALES</h3>
                {regularExpenses.length > 0 && (
                  <span className="text-sm font-bold text-red-600">
                    {formatCurrency(totalRegularBs, 'VES')}
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
                      <TableHead>Descripción</TableHead>
                      <TableHead className="text-right">Monto</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {regularExpenses.map((expense) => (
                      <TableRow key={expense.id}>
                        <TableCell className="font-medium">{expense.group_name}</TableCell>
                        <TableCell className="text-sm">{expense.description}</TableCell>
                        <TableCell className="text-right font-semibold text-red-600">
                          {formatCurrency(expense.amount_bs, 'VES')}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-1 justify-end">
                            <Button size="icon" variant="ghost" onClick={() => handleEdit(expense)}>
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="ghost" onClick={() => handleDeleteClick(expense.id)}>
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

      {/* Dialog de confirmación para eliminar */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar eliminación</DialogTitle>
            <DialogDescription>
              ¿Estás seguro de eliminar este gasto? Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleConfirmDelete}>
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}