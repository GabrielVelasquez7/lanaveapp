import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency } from "@/lib/utils";
import type { PerSystemTotals } from "@/hooks/useWeeklyCuadre";
import { Pencil, Save, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface Props {
  data: PerSystemTotals[];
  agencyId: string;
  weekStart: Date;
  weekEnd: Date;
  onSave?: () => void;
  saveSystemTotals: (params: {
    agencyId: string;
    weekStart: Date;
    weekEnd: Date;
    systems: PerSystemTotals[];
    userId: string;
    notes?: string;
  }) => Promise<void>;
}

export function PerSystemTable({ data, agencyId, weekStart, weekEnd, onSave, saveSystemTotals }: Props) {
  const { user } = useAuth();
  const [editingSystem, setEditingSystem] = useState<string | null>(null);
  const [editedValues, setEditedValues] = useState<PerSystemTotals | null>(null);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const handleEditClick = (system: PerSystemTotals) => {
    setEditedValues({ ...system });
    setNotes("");
    setEditingSystem(system.system_id);
  };

  const handleCancel = () => {
    setEditingSystem(null);
    setEditedValues(null);
    setNotes("");
  };

  const handleSave = async () => {
    if (!user || !editedValues) {
      toast.error("Usuario no autenticado");
      return;
    }

    setSaving(true);
    try {
      // Save only the edited system
      await saveSystemTotals({
        agencyId,
        weekStart,
        weekEnd,
        systems: [editedValues],
        userId: user.id,
        notes,
      });
      toast.success("Sistema actualizado correctamente");
      handleCancel();
      onSave?.();
    } catch (error: any) {
      toast.error(error.message || "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const updateField = (field: keyof PerSystemTotals, value: number) => {
    if (editedValues) {
      setEditedValues({ ...editedValues, [field]: value });
    }
  };

  if (!data?.length) return null;

  const totals = data.reduce(
    (acc, s) => {
      acc.sales_bs += s.sales_bs;
      acc.sales_usd += s.sales_usd;
      acc.prizes_bs += s.prizes_bs;
      acc.prizes_usd += s.prizes_usd;
      return acc;
    },
    { sales_bs: 0, sales_usd: 0, prizes_bs: 0, prizes_usd: 0 }
  );

  return (
    <>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Sistema</TableHead>
              <TableHead className="text-right">Ventas Bs</TableHead>
              <TableHead className="text-right">Ventas USD</TableHead>
              <TableHead className="text-right">Premios Bs</TableHead>
              <TableHead className="text-right">Premios USD</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((s) => (
              <TableRow key={s.system_id} className="group">
                <TableCell className="font-medium">
                  {s.system_name}
                  {s.is_adjusted && (
                    <Badge variant="secondary" className="ml-2 text-xs">
                      Ajustado
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-right font-mono">{formatCurrency(s.sales_bs, "VES")}</TableCell>
                <TableCell className="text-right font-mono">{formatCurrency(s.sales_usd, "USD")}</TableCell>
                <TableCell className="text-right font-mono">{formatCurrency(s.prizes_bs, "VES")}</TableCell>
                <TableCell className="text-right font-mono">{formatCurrency(s.prizes_usd, "USD")}</TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 opacity-0 group-hover:opacity-100 hover:opacity-100 transition-opacity"
                    onClick={() => handleEditClick(s)}
                    title="Editar sistema"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            <TableRow>
              <TableCell className="font-semibold">Totales</TableCell>
              <TableCell className="text-right font-mono font-semibold">{formatCurrency(totals.sales_bs, "VES")}</TableCell>
              <TableCell className="text-right font-mono font-semibold">{formatCurrency(totals.sales_usd, "USD")}</TableCell>
              <TableCell className="text-right font-mono font-semibold">{formatCurrency(totals.prizes_bs, "VES")}</TableCell>
              <TableCell className="text-right font-mono font-semibold">{formatCurrency(totals.prizes_usd, "USD")}</TableCell>
              <TableCell></TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>

      {/* Edit Dialog */}
      <Dialog open={editingSystem !== null} onOpenChange={(open) => !open && handleCancel()}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar Sistema: {editedValues?.system_name}</DialogTitle>
            <DialogDescription>
              Ajusta los totales semanales para este sistema. Los cambios se registrarán con tu usuario.
            </DialogDescription>
          </DialogHeader>

          {editedValues && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="sales_bs">Ventas Bs</Label>
                  <Input
                    id="sales_bs"
                    type="number"
                    step="0.01"
                    value={editedValues.sales_bs}
                    onChange={(e) => updateField("sales_bs", parseFloat(e.target.value) || 0)}
                    className="text-right font-mono"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sales_usd">Ventas USD</Label>
                  <Input
                    id="sales_usd"
                    type="number"
                    step="0.01"
                    value={editedValues.sales_usd}
                    onChange={(e) => updateField("sales_usd", parseFloat(e.target.value) || 0)}
                    className="text-right font-mono"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="prizes_bs">Premios Bs</Label>
                  <Input
                    id="prizes_bs"
                    type="number"
                    step="0.01"
                    value={editedValues.prizes_bs}
                    onChange={(e) => updateField("prizes_bs", parseFloat(e.target.value) || 0)}
                    className="text-right font-mono"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="prizes_usd">Premios USD</Label>
                  <Input
                    id="prizes_usd"
                    type="number"
                    step="0.01"
                    value={editedValues.prizes_usd}
                    onChange={(e) => updateField("prizes_usd", parseFloat(e.target.value) || 0)}
                    className="text-right font-mono"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notas del ajuste (opcional)</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Razón del ajuste manual..."
                  rows={3}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={handleCancel} disabled={saving}>
              <X className="h-4 w-4 mr-2" />
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? "Guardando..." : "Guardar Cambios"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
