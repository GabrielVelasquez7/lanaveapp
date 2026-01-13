import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { ExpenseDetail } from "@/hooks/useWeeklyCuadre";

interface Props {
  expenses: ExpenseDetail[];
  title: string;
  onPaidChange?: () => void;
}

export function ExpensesTable({ expenses, title, onPaidChange }: Props) {
  const { toast } = useToast();
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [localExpenses, setLocalExpenses] = useState(expenses);

  // Keep local state in sync with props
  if (expenses !== localExpenses && !updatingId) {
    setLocalExpenses(expenses);
  }

  const handleTogglePaid = async (expense: ExpenseDetail) => {
    setUpdatingId(expense.id);
    try {
      const { error } = await supabase
        .from("expenses")
        .update({ is_paid: !expense.is_paid })
        .eq("id", expense.id);

      if (error) throw error;

      // Update local state
      setLocalExpenses(prev => 
        prev.map(e => e.id === expense.id ? { ...e, is_paid: !e.is_paid } : e)
      );

      toast({
        title: !expense.is_paid ? "✓ Marcado como pagado" : "Desmarcado",
        description: !expense.is_paid 
          ? "El monto se ha descontado del cuadre semanal" 
          : "El monto se ha vuelto a sumar al cuadre",
      });

      // Notify parent to refresh data
      onPaidChange?.();
    } catch (error: any) {
      console.error("Error updating paid status:", error);
      toast({
        title: "Error",
        description: error.message || "Error al actualizar el estado de pago",
        variant: "destructive"
      });
    } finally {
      setUpdatingId(null);
    }
  };

  if (localExpenses.length === 0) {
    return (
      <div className="text-center py-4 text-muted-foreground">
        No hay {title.toLowerCase()} registrados esta semana
      </div>
    );
  }

  // Calculate totals for unpaid items only
  const unpaidTotal = {
    bs: localExpenses.filter(e => !e.is_paid).reduce((sum, e) => sum + e.amount_bs, 0),
    usd: localExpenses.filter(e => !e.is_paid).reduce((sum, e) => sum + e.amount_usd, 0),
  };
  const allTotal = {
    bs: localExpenses.reduce((sum, e) => sum + e.amount_bs, 0),
    usd: localExpenses.reduce((sum, e) => sum + e.amount_usd, 0),
  };
  const paidCount = localExpenses.filter(e => e.is_paid).length;

  return (
    <div className="space-y-3">
      {paidCount > 0 && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-emerald-500/10 px-3 py-2 rounded-lg border border-emerald-500/20">
          <span>✓ {paidCount} {title.toLowerCase()} pagado{paidCount > 1 ? 's' : ''} y descontado{paidCount > 1 ? 's' : ''} del cuadre</span>
        </div>
      )}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">Pagado</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Descripción</TableHead>
              <TableHead className="text-right">Bolívares</TableHead>
              <TableHead className="text-right">Dólares</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {localExpenses.map((expense) => (
              <TableRow 
                key={expense.id}
                className={expense.is_paid ? "bg-emerald-500/5" : ""}
              >
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id={`expense-${expense.id}`}
                      checked={expense.is_paid}
                      disabled={updatingId === expense.id}
                      onCheckedChange={() => handleTogglePaid(expense)}
                    />
                    {expense.is_paid && (
                      <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 text-[10px]">
                        Pagado
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className={`font-medium ${expense.is_paid ? "line-through opacity-60" : ""}`}>
                  {format(new Date(expense.date), "dd/MM/yyyy")}
                </TableCell>
                <TableCell className={`max-w-xs truncate ${expense.is_paid ? "line-through opacity-60" : ""}`}>
                  {expense.description || "Sin descripción"}
                </TableCell>
                <TableCell className={`text-right font-mono ${expense.is_paid ? "line-through opacity-60" : ""}`}>
                  {formatCurrency(expense.amount_bs, "VES")}
                </TableCell>
                <TableCell className={`text-right font-mono ${expense.is_paid ? "line-through opacity-60" : ""}`}>
                  {formatCurrency(expense.amount_usd, "USD")}
                </TableCell>
              </TableRow>
            ))}
            {/* Total row - Pending only */}
            <TableRow className="bg-primary/5 font-bold">
              <TableCell colSpan={3}>
                Total Pendiente
              </TableCell>
              <TableCell className="text-right font-mono">
                {formatCurrency(unpaidTotal.bs, "VES")}
              </TableCell>
              <TableCell className="text-right font-mono">
                {formatCurrency(unpaidTotal.usd, "USD")}
              </TableCell>
            </TableRow>
            {/* Show all total if there are paid items */}
            {paidCount > 0 && (
              <TableRow className="bg-muted/30 text-muted-foreground text-sm">
                <TableCell colSpan={3}>
                  Total General (incluyendo pagados)
                </TableCell>
                <TableCell className="text-right font-mono">
                  {formatCurrency(allTotal.bs, "VES")}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {formatCurrency(allTotal.usd, "USD")}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
