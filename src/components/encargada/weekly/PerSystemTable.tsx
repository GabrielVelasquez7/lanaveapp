import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import type { PerSystemTotals } from "@/hooks/useWeeklyCuadre";
import { Edit, Save, X } from "lucide-react";
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
  const [editMode, setEditMode] = useState(false);
  const [editedData, setEditedData] = useState<PerSystemTotals[]>(data);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const handleEdit = () => {
    setEditedData(data);
    setNotes("");
    setEditMode(true);
  };

  const handleCancel = () => {
    setEditedData(data);
    setNotes("");
    setEditMode(false);
  };

  const handleSave = async () => {
    if (!user) {
      toast.error("Usuario no autenticado");
      return;
    }

    setSaving(true);
    try {
      await saveSystemTotals({
        agencyId,
        weekStart,
        weekEnd,
        systems: editedData,
        userId: user.id,
        notes,
      });
      toast.success("Totales actualizados correctamente");
      setEditMode(false);
      onSave?.();
    } catch (error: any) {
      toast.error(error.message || "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const updateSystem = (idx: number, field: keyof PerSystemTotals, value: number) => {
    const newData = [...editedData];
    (newData[idx] as any)[field] = value;
    setEditedData(newData);
  };

  if (!data?.length) return null;

  const totals = editedData.reduce(
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
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        {!editMode ? (
          <Button variant="outline" onClick={handleEdit} size="sm">
            <Edit className="h-4 w-4 mr-2" />
            Editar Totales
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleCancel} size="sm" disabled={saving}>
              <X className="h-4 w-4 mr-2" />
              Cancelar
            </Button>
            <Button onClick={handleSave} size="sm" disabled={saving}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? "Guardando..." : "Guardar Cambios"}
            </Button>
          </div>
        )}
      </div>

      {editMode && (
        <div className="space-y-2">
          <Label>Notas del ajuste (opcional)</Label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Razón del ajuste manual..."
            rows={2}
          />
        </div>
      )}

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Sistema</TableHead>
              <TableHead className="text-right">Ventas Bs</TableHead>
              <TableHead className="text-right">Ventas USD</TableHead>
              <TableHead className="text-right">Premios Bs</TableHead>
              <TableHead className="text-right">Premios USD</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {editedData.map((s, idx) => (
              <TableRow key={s.system_id}>
                <TableCell className="font-medium">
                  {s.system_name}
                  {s.is_adjusted && (
                    <Badge variant="secondary" className="ml-2 text-xs">
                      Ajustado
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {editMode ? (
                    <Input
                      type="number"
                      step="0.01"
                      value={s.sales_bs}
                      onChange={(e) => updateSystem(idx, "sales_bs", parseFloat(e.target.value) || 0)}
                      className="text-right font-mono w-32 ml-auto"
                    />
                  ) : (
                    <span className="font-mono">{formatCurrency(s.sales_bs, "VES")}</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {editMode ? (
                    <Input
                      type="number"
                      step="0.01"
                      value={s.sales_usd}
                      onChange={(e) => updateSystem(idx, "sales_usd", parseFloat(e.target.value) || 0)}
                      className="text-right font-mono w-32 ml-auto"
                    />
                  ) : (
                    <span className="font-mono">{formatCurrency(s.sales_usd, "USD")}</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {editMode ? (
                    <Input
                      type="number"
                      step="0.01"
                      value={s.prizes_bs}
                      onChange={(e) => updateSystem(idx, "prizes_bs", parseFloat(e.target.value) || 0)}
                      className="text-right font-mono w-32 ml-auto"
                    />
                  ) : (
                    <span className="font-mono">{formatCurrency(s.prizes_bs, "VES")}</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {editMode ? (
                    <Input
                      type="number"
                      step="0.01"
                      value={s.prizes_usd}
                      onChange={(e) => updateSystem(idx, "prizes_usd", parseFloat(e.target.value) || 0)}
                      className="text-right font-mono w-32 ml-auto"
                    />
                  ) : (
                    <span className="font-mono">{formatCurrency(s.prizes_usd, "USD")}</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
            <TableRow>
              <TableCell className="font-semibold">Totales</TableCell>
              <TableCell className="text-right font-mono font-semibold">{formatCurrency(totals.sales_bs, "VES")}</TableCell>
              <TableCell className="text-right font-mono font-semibold">{formatCurrency(totals.sales_usd, "USD")}</TableCell>
              <TableCell className="text-right font-mono font-semibold">{formatCurrency(totals.prizes_bs, "VES")}</TableCell>
              <TableCell className="text-right font-mono font-semibold">{formatCurrency(totals.prizes_usd, "USD")}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
