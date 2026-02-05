import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
 import { Button } from "@/components/ui/button";
 import { Textarea } from "@/components/ui/textarea";
import { formatCurrency } from "@/lib/utils";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
 import { Pencil, Check, X } from "lucide-react";

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
   const [editingId, setEditingId] = useState<string | null>(null);
   const [editDescription, setEditDescription] = useState<string>("");
  const [localPrizes, setLocalPrizes] = useState(prizes);

  // Keep local state in sync with props
   if (prizes !== localPrizes && !updatingId && !editingId) {
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

   const handleStartEdit = (prize: PendingPrizeDetail) => {
     setEditingId(prize.id);
     setEditDescription(prize.description || "");
   };
 
   const handleCancelEdit = () => {
     setEditingId(null);
     setEditDescription("");
   };
 
   const handleSaveDescription = async (prize: PendingPrizeDetail) => {
     setUpdatingId(prize.id);
     try {
       const { error } = await supabase
         .from("pending_prizes")
         .update({ description: editDescription })
         .eq("id", prize.id);
 
       if (error) throw error;
 
       // Update local state
       setLocalPrizes(prev => 
         prev.map(p => p.id === prize.id ? { ...p, description: editDescription } : p)
       );
 
       toast({
         title: "✓ Descripción actualizada",
         description: "La descripción del premio ha sido actualizada",
       });
 
       setEditingId(null);
       setEditDescription("");
       onPaidChange?.();
     } catch (error: any) {
       console.error("Error updating description:", error);
       toast({
         title: "Error",
         description: error.message || "Error al actualizar la descripción",
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
         <div className="flex items-center gap-2 text-xs text-muted-foreground bg-primary/10 px-3 py-2 rounded-lg border border-primary/20">
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
                 className={prize.is_paid ? "bg-primary/5" : ""}
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
                       <Badge variant="outline" className="bg-primary/10 text-primary text-[10px]">
                        Pagado
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className={`font-medium ${prize.is_paid ? "line-through opacity-60" : ""}`}>
                  {format(new Date(prize.date), "dd/MM/yyyy")}
                </TableCell>
                 <TableCell className={`max-w-xs ${prize.is_paid ? "line-through opacity-60" : ""}`}>
                   {editingId === prize.id ? (
                     <div className="flex items-center gap-2">
                       <Textarea
                         value={editDescription}
                         onChange={(e) => setEditDescription(e.target.value)}
                         placeholder="Detalles del premio..."
                         rows={2}
                         className="min-h-[60px] text-sm"
                         disabled={updatingId === prize.id}
                       />
                       <div className="flex flex-col gap-1">
                         <Button
                           size="icon"
                           variant="ghost"
                            className="h-7 w-7 text-primary hover:text-primary/80 hover:bg-primary/10"
                           onClick={() => handleSaveDescription(prize)}
                           disabled={updatingId === prize.id}
                         >
                           <Check className="h-4 w-4" />
                         </Button>
                         <Button
                           size="icon"
                           variant="ghost"
                           className="h-7 w-7 text-muted-foreground hover:text-destructive"
                           onClick={handleCancelEdit}
                           disabled={updatingId === prize.id}
                         >
                           <X className="h-4 w-4" />
                         </Button>
                       </div>
                     </div>
                   ) : (
                     <div className="flex items-center gap-2 group">
                       <span className="truncate">{prize.description || "Sin descripción"}</span>
                       <Button
                         size="icon"
                         variant="ghost"
                         className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                         onClick={() => handleStartEdit(prize)}
                       >
                         <Pencil className="h-3 w-3" />
                       </Button>
                     </div>
                   )}
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
