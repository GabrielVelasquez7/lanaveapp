import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Pencil, Save, X, Loader2 } from "lucide-react";

interface LotterySystem {
  id: string;
  name: string;
  code: string;
  is_active: boolean;
}

interface CommissionRate {
  id?: string;
  lottery_system_id: string;
  commission_percentage: number;
  utility_percentage: number;
  commission_percentage_usd: number;
  utility_percentage_usd: number;
  is_active: boolean;
}

export function SystemCommissionsCrud() {
  const [systems, setSystems] = useState<LotterySystem[]>([]);
  const [commissions, setCommissions] = useState<Map<string, CommissionRate>>(new Map());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<{ 
    commission: string; 
    utility: string;
    commissionUsd: string;
    utilityUsd: string;
  }>({
    commission: "",
    utility: "",
    commissionUsd: "",
    utilityUsd: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch lottery systems (exclude parent systems with subcategories)
      const { data: systemsData, error: systemsError } = await supabase
        .from("lottery_systems")
        .select("id, name, code, is_active, has_subcategories")
        .order("name");

      if (systemsError) throw systemsError;

      // Fetch commission rates
      const { data: ratesData, error: ratesError } = await supabase
        .from("system_commission_rates")
        .select("*");

      if (ratesError) throw ratesError;

      // Filter out parent systems that have subcategories
      const filteredSystems = (systemsData || []).filter(system => !system.has_subcategories);
      setSystems(filteredSystems);

      const commissionsMap = new Map<string, CommissionRate>();
      ratesData?.forEach((rate) => {
        commissionsMap.set(rate.lottery_system_id, rate);
      });
      setCommissions(commissionsMap);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los datos",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (systemId: string) => {
    const existing = commissions.get(systemId);
    setEditingId(systemId);
    setEditValues({
      commission: existing?.commission_percentage.toString() || "0",
      utility: existing?.utility_percentage.toString() || "0",
      commissionUsd: existing?.commission_percentage_usd.toString() || "0",
      utilityUsd: existing?.utility_percentage_usd.toString() || "0",
    });
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditValues({ commission: "", utility: "", commissionUsd: "", utilityUsd: "" });
  };

  const handleSave = async (systemId: string) => {
    const commission = parseFloat(editValues.commission);
    const utility = parseFloat(editValues.utility);
    const commissionUsd = parseFloat(editValues.commissionUsd);
    const utilityUsd = parseFloat(editValues.utilityUsd);

    if (isNaN(commission) || commission < 0 || commission > 100) {
      toast({
        title: "Error de validación",
        description: "El porcentaje de comisión Bs debe estar entre 0 y 100",
        variant: "destructive",
      });
      return;
    }

    if (isNaN(utility) || utility < 0 || utility > 100) {
      toast({
        title: "Error de validación",
        description: "El porcentaje de utilidad Bs debe estar entre 0 y 100",
        variant: "destructive",
      });
      return;
    }

    if (isNaN(commissionUsd) || commissionUsd < 0 || commissionUsd > 100) {
      toast({
        title: "Error de validación",
        description: "El porcentaje de comisión USD debe estar entre 0 y 100",
        variant: "destructive",
      });
      return;
    }

    if (isNaN(utilityUsd) || utilityUsd < 0 || utilityUsd > 100) {
      toast({
        title: "Error de validación",
        description: "El porcentaje de utilidad USD debe estar entre 0 y 100",
        variant: "destructive",
      });
      return;
    }

    try {
      setSaving(true);

      const existing = commissions.get(systemId);

      if (existing?.id) {
        // Update existing
        const { error } = await supabase
          .from("system_commission_rates")
          .update({
            commission_percentage: commission,
            utility_percentage: utility,
            commission_percentage_usd: commissionUsd,
            utility_percentage_usd: utilityUsd,
          })
          .eq("id", existing.id);

        if (error) throw error;
      } else {
        // Insert new
        const { error } = await supabase
          .from("system_commission_rates")
          .insert({
            lottery_system_id: systemId,
            commission_percentage: commission,
            utility_percentage: utility,
            commission_percentage_usd: commissionUsd,
            utility_percentage_usd: utilityUsd,
            is_active: true,
          });

        if (error) throw error;
      }

      toast({
        title: "Éxito",
        description: "Comisión guardada correctamente",
      });

      await fetchData();
      handleCancel();
    } catch (error) {
      console.error("Error saving commission:", error);
      toast({
        title: "Error",
        description: "No se pudo guardar la comisión",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold">Comisiones de Sistemas</h2>
        <p className="text-sm text-muted-foreground">
          Configure los porcentajes de comisión y utilidad para cada sistema de lotería
        </p>
      </div>

      <Tabs defaultValue="bolivares" className="w-full">
        <TabsList>
          <TabsTrigger value="bolivares">Bolívares</TabsTrigger>
          <TabsTrigger value="dolares">Dólares</TabsTrigger>
        </TabsList>

        <TabsContent value="bolivares" className="mt-4">
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sistema</TableHead>
                  <TableHead className="text-right">% Comisión</TableHead>
                  <TableHead className="text-right">% Participación</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {systems.map((system) => {
                  const commission = commissions.get(system.id);
                  const isEditing = editingId === system.id;

                  return (
                    <TableRow key={system.id}>
                      <TableCell className="font-medium">{system.name}</TableCell>
                      <TableCell className="text-right">
                        {isEditing ? (
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            step="0.01"
                            value={editValues.commission || ''}
                            onChange={(e) =>
                              setEditValues({ ...editValues, commission: e.target.value === '' ? '' : e.target.value })
                            }
                            className="w-28 text-right"
                            placeholder="0.00"
                          />
                        ) : (
                          <span className="font-mono">
                            {commission?.commission_percentage.toFixed(2) || "0.00"}%
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {isEditing ? (
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            step="0.01"
                            value={editValues.utility || ''}
                            onChange={(e) =>
                              setEditValues({ ...editValues, utility: e.target.value === '' ? '' : e.target.value })
                            }
                            className="w-28 text-right"
                            placeholder="0.00"
                          />
                        ) : (
                          <span className="font-mono">
                            {commission?.utility_percentage.toFixed(2) || "0.00"}%
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {commission ? (
                          <Badge variant="default" className="bg-emerald-600">
                            Configurado
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Sin configurar</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {isEditing ? (
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              onClick={() => handleSave(system.id)}
                              disabled={saving}
                            >
                              {saving ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Save className="h-4 w-4" />
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={handleCancel}
                              disabled={saving}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEdit(system.id)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="dolares" className="mt-4">
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sistema</TableHead>
                  <TableHead className="text-right">% Comisión</TableHead>
                  <TableHead className="text-right">% Participación</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {systems.map((system) => {
                  const commission = commissions.get(system.id);
                  const isEditing = editingId === system.id;

                  return (
                    <TableRow key={system.id}>
                      <TableCell className="font-medium">{system.name}</TableCell>
                      <TableCell className="text-right">
                        {isEditing ? (
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            step="0.01"
                            value={editValues.commissionUsd || ''}
                            onChange={(e) =>
                              setEditValues({ ...editValues, commissionUsd: e.target.value === '' ? '' : e.target.value })
                            }
                            className="w-28 text-right"
                            placeholder="0.00"
                          />
                        ) : (
                          <span className="font-mono">
                            {commission?.commission_percentage_usd.toFixed(2) || "0.00"}%
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {isEditing ? (
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            step="0.01"
                            value={editValues.utilityUsd || ''}
                            onChange={(e) =>
                              setEditValues({ ...editValues, utilityUsd: e.target.value === '' ? '' : e.target.value })
                            }
                            className="w-28 text-right"
                            placeholder="0.00"
                          />
                        ) : (
                          <span className="font-mono">
                            {commission?.utility_percentage_usd.toFixed(2) || "0.00"}%
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {commission ? (
                          <Badge variant="default" className="bg-emerald-600">
                            Configurado
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Sin configurar</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {isEditing ? (
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              onClick={() => handleSave(system.id)}
                              disabled={saving}
                            >
                              {saving ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Save className="h-4 w-4" />
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={handleCancel}
                              disabled={saving}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEdit(system.id)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
