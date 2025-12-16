import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/ui/use-toast";
import { formatCurrency } from "@/lib/utils";
import { Plus, Trash2, Edit2, DollarSign } from "lucide-react";
import { format } from "date-fns";

interface WeeklyExpenseUsd {
  id: string;
  group_id: string | null;
  group_name: string;
  category: "gasto_operativo" | "deuda" | "otros";
  description: string;
  amount_usd: number;
  created_at: string;
}

interface AgencyGroup {
  id: string;
  name: string;
  description: string;
}

interface WeeklyBankExpensesUsdManagerProps {
  weekStart: Date;
  weekEnd: Date;
  onExpensesChange: () => void;
}

export function WeeklyBankExpensesUsdManager({
  weekStart,
  weekEnd,
  onExpensesChange,
}: WeeklyBankExpensesUsdManagerProps) {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  
  const isAdmin = profile?.role === 'administrador';
  const isEncargada = profile?.role === 'encargada';

  const [expenses, setExpenses] = useState<WeeklyExpenseUsd[]>([]);
  const [groups, setGroups] = useState<AgencyGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<WeeklyExpenseUsd | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [expenseToDelete, setExpenseToDelete] = useState<string | null>(null);
  const [payrollTotal, setPayrollTotal] = useState(0);

  const [formData, setFormData] = useState<{
    group_id: string;
    category: "gasto_operativo" | "deuda" | "otros";
    description: string;
    amount_usd: string;
    is_fixed: boolean;
  }>({
    group_id: "",
    category: "gasto_operativo",
    description: "",
    amount_usd: "",
    is_fixed: false,
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
      const startStr = format(weekStart, "yyyy-MM-dd");

      const { data: payrollData, error } = await supabase
        .from("weekly_payroll")
        .select("total_usd")
        .eq("week_start_date", startStr);

      if (error) throw error;

      const total = (payrollData || []).reduce((acc, entry) => acc + Number(entry.total_usd || 0), 0);

      setPayrollTotal(total);
    } catch (error) {
      console.error("Error fetching payroll:", error);
    }
  };

  const initializeGroups = async () => {
    try {
      const { data: existingGroups, error: fetchError } = await supabase
        .from("agency_groups")
        .select("*")
        .order("name");

      if (fetchError) throw fetchError;

      if (!existingGroups || existingGroups.length === 0) {
        const defaultGroups = [
          {
            name: "GRUPO 1",
            description: "CEMENTERIO, PANTEON, AV.SUCRE, SAN MARTIN, CAPITOLIO, VICTORIA 2, VICTORIA 1, BARALT",
          },
          { name: "GRUPO 2", description: "CANDELARIA" },
          { name: "GRUPO 3", description: "BOCONO" },
        ];

        const { data: newGroups, error: insertError } = await supabase
          .from("agency_groups")
          .insert(defaultGroups)
          .select();

        if (insertError) throw insertError;
        setGroups(newGroups || []);
      } else {
        setGroups(existingGroups);
      }
    } catch (error) {
      console.error("Error initializing groups:", error);
    }
  };

  const fetchExpenses = async () => {
    try {
      setLoading(true);
      const startStr = format(weekStart, "yyyy-MM-dd");
      const endStr = format(weekEnd, "yyyy-MM-dd");

      const { data: fetchedExpenses, error } = await supabase
        .from("weekly_bank_expenses")
        .select(
          `
          *,
          agency_groups (
            id,
            name
          )
        `,
        )
        .eq("week_start_date", startStr)
        .eq("week_end_date", endStr)
        .order("created_at", { ascending: false });

      if (error) throw error;

      if (!fetchedExpenses || fetchedExpenses.length === 0) {
        setExpenses([]);
        setLoading(false);
        return;
      }

      const formatted = fetchedExpenses
        .filter((exp) => Number(exp.amount_usd || 0) > 0) // Only show expenses with USD amounts
        .map((exp) => ({
          id: exp.id,
          group_id: exp.group_id,
          group_name: exp.group_id ? (exp.agency_groups as any)?.name || "Grupo desconocido" : "GLOBAL",
          category: exp.category,
          description: exp.description,
          amount_usd: Number(exp.amount_usd || 0),
          created_at: exp.created_at,
        }));

      setExpenses(formatted);
    } catch (error) {
      console.error("Error fetching expenses:", error);
      toast({
        title: "Error",
        description: "Error al cargar gastos semanales en USD",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.description.trim() || !formData.amount_usd) {
      toast({
        title: "Error",
        description: "Por favor completa todos los campos",
        variant: "destructive",
      });
      return;
    }

    try {
      const startStr = format(weekStart, "yyyy-MM-dd");
      const endStr = format(weekEnd, "yyyy-MM-dd");

      // Determinar si es gasto fijo:
      // 1. Si está editando, usar la función isFixedExpense para mantener consistencia
      // 2. Si es nuevo gasto, usar el valor del switch formData.is_fixed
      const isFixed = editingExpense
        ? isFixedExpense(editingExpense.description)
        : formData.is_fixed || isFixedExpense(formData.description);

      // Si es encargada editando un gasto fijo, solo actualizar montos
      if (isEncargada && editingExpense && isFixed) {
        const expenseData = {
          amount_usd: Number(formData.amount_usd),
        };
        
        const { error } = await supabase.from("weekly_bank_expenses").update(expenseData).eq("id", editingExpense.id);

        if (error) throw error;

        toast({
          title: "Éxito",
          description: "Monto actualizado correctamente",
        });

        setFormData({ group_id: "", category: "gasto_operativo", description: "", amount_usd: "", is_fixed: false });
        setEditingExpense(null);
        setDialogOpen(false);
        fetchExpenses();
        onExpensesChange();
        return;
      }

      const expenseData = {
        group_id: isFixed ? null : formData.group_id === "global" || !formData.group_id ? null : formData.group_id,
        agency_id: null,
        week_start_date: startStr,
        week_end_date: endStr,
        category: isFixed ? "otros" : formData.category,
        description: isFixed && editingExpense ? editingExpense.description : formData.description,
        amount_bs: 0,
        amount_usd: Number(formData.amount_usd),
        created_by: user?.id,
      };

      if (editingExpense) {
        const { error } = await supabase.from("weekly_bank_expenses").update(expenseData).eq("id", editingExpense.id);

        if (error) throw error;

        toast({
          title: "Éxito",
          description: "Gasto actualizado correctamente",
        });
      } else {
        const { error } = await supabase.from("weekly_bank_expenses").insert([expenseData]);

        if (error) throw error;

        toast({
          title: "Éxito",
          description: "Gasto registrado correctamente",
        });
      }

      setFormData({ group_id: "", category: "gasto_operativo", description: "", amount_usd: "", is_fixed: false });
      setEditingExpense(null);
      setDialogOpen(false);
      fetchExpenses();
      onExpensesChange();
    } catch (error) {
      console.error("Error saving expense:", error);
      toast({
        title: "Error",
        description: "Error al guardar el gasto",
        variant: "destructive",
      });
    }
  };

  const handleDeleteClick = (id: string) => {
    // Verificar si es un gasto fijo y el usuario es encargada
    const expense = expenses.find(exp => exp.id === id);
    if (expense && isFixedExpense(expense.description) && isEncargada) {
      toast({
        title: "Error",
        description: "No puedes eliminar gastos fijos. Solo el administrador puede hacerlo.",
        variant: "destructive",
      });
      return;
    }
    setExpenseToDelete(id);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!expenseToDelete) return;

    try {
      const { error } = await supabase.from("weekly_bank_expenses").delete().eq("id", expenseToDelete);

      if (error) throw error;

      toast({
        title: "Éxito",
        description: "Gasto eliminado correctamente",
      });

      fetchExpenses();
      onExpensesChange();
    } catch (error) {
      console.error("Error deleting expense:", error);
      toast({
        title: "Error",
        description: "Error al eliminar el gasto",
        variant: "destructive",
      });
    } finally {
      setDeleteDialogOpen(false);
      setExpenseToDelete(null);
    }
  };

  const handleEdit = (expense: WeeklyExpenseUsd) => {
    setEditingExpense(expense);
    const isFixed = isFixedExpense(expense.description);
    setFormData({
      group_id: expense.group_id || "global",
      category: expense.category as any,
      description: expense.description,
      amount_usd: expense.amount_usd.toString(),
      is_fixed: isFixed,
    });
    setDialogOpen(true);
  };

  const isFixedExpense = (description: string) => {
    const fixedExpenses = [
      "Comisión P/M Pagados",
      "Comisión Puntos Bancamiga",
      "Comisión Semanal 1$ Punto Bancamiga",
      "Comisión Puntos Banesco",
      "Comisión Diaria Mantenimiento Banesco",
      "Comisión Punto Venezuela",
      "Comisión Diaria Mantenimiento Venezuela",
      "Comisión Cierre Punto BNC",
      "Comisión Diaria Mantenimiento BNC",
    ];
    return fixedExpenses.includes(description);
  };

  const fixedExpenses = expenses.filter((exp) => isFixedExpense(exp.description));
  const regularExpenses = expenses.filter((exp) => !isFixedExpense(exp.description));

  const totalFixed = fixedExpenses.reduce((sum, exp) => sum + exp.amount_usd, 0) + payrollTotal;
  const totalRegular = regularExpenses.reduce((sum, exp) => sum + exp.amount_usd, 0);
  const totalExpenses = totalFixed + totalRegular;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Gastos Fijos Semanales (USD)
          </CardTitle>
          <Dialog
            open={dialogOpen}
            onOpenChange={(open) => {
              setDialogOpen(open);
              if (!open) {
                setEditingExpense(null);
                setFormData({ group_id: "", category: "gasto_operativo", description: "", amount_usd: "", is_fixed: false });
              }
            }}
          >
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Agregar Gasto
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{editingExpense ? "Editar Gasto" : "Agregar Gasto Semanal (USD)"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                {isAdmin && !editingExpense && (
                  <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border">
                    <div className="space-y-0.5">
                      <Label htmlFor="is-fixed-usd" className="text-sm font-medium">
                        Gasto Fijo
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Los gastos fijos se aplican globalmente a todas las agencias
                      </p>
                    </div>
                    <Switch
                      id="is-fixed-usd"
                      checked={formData.is_fixed}
                      onCheckedChange={(checked) => {
                        setFormData({ 
                          ...formData, 
                          is_fixed: checked,
                          group_id: checked ? 'global' : formData.group_id
                        });
                      }}
                    />
                  </div>
                )}

                {isEncargada && editingExpense && isFixedExpense(editingExpense.description) && (
                  <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
                    <p className="text-sm text-blue-800 dark:text-blue-200">
                      <strong>Nota:</strong> Solo puedes modificar el monto de este gasto fijo. La descripción solo puede ser modificada por el administrador.
                    </p>
                  </div>
                )}
                
                {!isEncargada || !editingExpense || !isFixedExpense(editingExpense.description) ? (
                  <>
                    <div>
                      <Label>Grupo</Label>
                      <Select
                        disabled={formData.is_fixed || (editingExpense && isFixedExpense(editingExpense.description)) || (isEncargada && editingExpense && isFixedExpense(editingExpense.description))}
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
                        disabled={isEncargada && editingExpense && isFixedExpense(editingExpense.description)}
                      />
                      {isEncargada && editingExpense && isFixedExpense(editingExpense.description) && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Solo el administrador puede modificar la descripción de gastos fijos
                        </p>
                      )}
                    </div>
                  </>
                ) : null}

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

                <div className="flex gap-2 justify-end">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit">{editingExpense ? "Actualizar" : "Guardar"}</Button>
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
            {/* GASTOS FIJOS */}
            <Accordion type="single" collapsible defaultValue="fixed-expenses">
              <AccordionItem value="fixed-expenses" className="border rounded-lg">
                <AccordionTrigger className="px-4 hover:no-underline">
                  <div className="flex items-center justify-between w-full pr-4">
                    <div className="flex items-center gap-3">
                      <Badge variant="secondary" className="font-semibold">
                        GASTOS FIJOS
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {fixedExpenses.length} gastos fijos + Nómina
                      </span>
                    </div>
                    <span className="font-bold text-red-600">{formatCurrency(totalFixed, "USD")}</span>
                  </div>
                </AccordionTrigger>

                {/* FIX: Aquí va el AccordionContent correcto */}
                <AccordionContent>
                  <Separator />

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-semibold text-muted-foreground">GASTOS FIJOS</h4>
                      <span className="font-bold text-red-600">
                        {formatCurrency(
                          fixedExpenses.reduce((sum, exp) => sum + exp.amount_usd, 0),
                          "USD",
                        )}
                      </span>
                    </div>

                    {fixedExpenses.length === 0 ? (
                      <div className="text-center py-4 text-sm text-muted-foreground border rounded-lg bg-muted/20">
                        No hay gastos fijos registrados
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
                                {formatCurrency(expense.amount_usd, "USD")}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex gap-1 justify-end">
                                  <Button size="icon" variant="ghost" onClick={() => handleEdit(expense)}>
                                    <Edit2 className="h-4 w-4" />
                                  </Button>
                                  {isAdmin && (
                                    <Button size="icon" variant="ghost" onClick={() => handleDeleteClick(expense.id)}>
                                      <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                  )}
                                </div>
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

            {/* GASTOS REGULARES */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-muted-foreground">GASTOS ADICIONALES</h3>
                {regularExpenses.length > 0 && (
                  <span className="text-sm font-bold text-red-600">{formatCurrency(totalRegular, "USD")}</span>
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
                          {formatCurrency(expense.amount_usd, "USD")}
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

            {/* TOTAL GENERAL */}
            <div className="flex justify-end border-t pt-4">
              <div className="text-right">
                <p className="text-sm text-muted-foreground mb-1">Total Gastos Semanales</p>
                <p className="text-2xl font-bold text-red-600">{formatCurrency(totalExpenses, "USD")}</p>
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
