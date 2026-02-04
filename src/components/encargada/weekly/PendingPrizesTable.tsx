import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface PendingPrizeDetail {
  id: string;
  date: string;
  amount_bs: number;
  amount_usd: number;
  description?: string;
  is_paid: boolean;
}

interface Props {
  prizes: PendingPrizeDetail[];
  onPaidChange?: () => void;
}

export function PendingPrizesTable({ prizes, onPaidChange }: Props) {
  const { toast } = useToast();
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [localPrizes, setLocalPrizes] = useState(prizes);

  // Keep local state in sync with props
  if (prizes !== localPrizes && !updatingId) {
    setLocalPrizes(prizes);
  }

  const handleTogglePaid = async (prize: PendingPrizeDetail) => {
    setUpdatingId(prize.id);
    try {
      const { error } = await supabase
        .from("pending_prizes")
        .update({ is_paid: !prize.is_paid })
        .eq("id", prize.id);

      if (error) throw error;

      // Update local state
      setLocalPrizes(prev => 
        prev.map(p => p.id === prize.id ? { ...p, is_paid: !p.is_paid } : p)
      );

      toast({
        title: !prize.is_paid ? "✓ Marcado como pagado" : "Desmarcado",
        description: !prize.is_paid 
          ? "El premio ha sido marcado como pagado" 
          : "El premio se ha vuelto a marcar como pendiente",
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

  if (localPrizes.length === 0) {
    return (
      <div className="text-center py-4 text-muted-foreground">
        No hay premios por pagar registrados esta semana
      </div>
    );
  }

  // Calculate totals for unpaid items only
  const unpaidTotal = {
    bs: localPrizes.filter(p => !p.is_paid).reduce((sum, p) => sum + p.amount_bs, 0),
    usd: localPrizes.filter(p => !p.is_paid).reduce((sum, p) => sum + p.amount_usd, 0),
  };
  const allTotal = {
    bs: localPrizes.reduce((sum, p) => sum + p.amount_bs, 0),
    usd: localPrizes.reduce((sum, p) => sum + p.amount_usd, 0),
  };
  const paidCount = localPrizes.filter(p => p.is_paid).length;

  return (
    <div className="space-y-3">
      {paidCount > 0 && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-emerald-500/10 px-3 py-2 rounded-lg border border-emerald-500/20">
          <span>✓ {paidCount} premio{paidCount > 1 ? 's' : ''} pagado{paidCount > 1 ? 's' : ''}</span>
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
            {localPrizes.map((prize) => (
              <TableRow 
                key={prize.id}
                className={prize.is_paid ? "bg-emerald-500/5" : ""}
              >
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id={`prize-${prize.id}`}
                      checked={prize.is_paid}
                      disabled={updatingId === prize.id}
                      onCheckedChange={() => handleTogglePaid(prize)}
                    />
                    {prize.is_paid && (
                      <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 text-[10px]">
                        Pagado
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className={`font-medium ${prize.is_paid ? "line-through opacity-60" : ""}`}>
                  {format(new Date(prize.date), "dd/MM/yyyy")}
                </TableCell>
                <TableCell className={`max-w-xs truncate ${prize.is_paid ? "line-through opacity-60" : ""}`}>
                  {prize.description || "Sin descripción"}
                </TableCell>
                <TableCell className={`text-right font-mono ${prize.is_paid ? "line-through opacity-60" : ""}`}>
                  {formatCurrency(prize.amount_bs, "VES")}
                </TableCell>
                <TableCell className={`text-right font-mono ${prize.is_paid ? "line-through opacity-60" : ""}`}>
                  {formatCurrency(prize.amount_usd, "USD")}
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
