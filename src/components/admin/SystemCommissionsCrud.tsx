import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
interface BanqueoCommissionConfig {
  id: string;
  client_commission_percentage: number;
  lanave_commission_percentage: number;
}
interface Client {
  id: string;
  name: string;
}
interface ClientBanqueoCommission {
  id?: string;
  client_id: string;
  lanave_participation_percentage_bs: number;
  lanave_participation_percentage_usd: number;
}
interface ClientSystemParticipation {
  id?: string;
  client_id: string;
  lottery_system_id: string;
  client_commission_percentage_bs: number;
  client_commission_percentage_usd: number;
  participation_percentage_bs: number;
  participation_percentage_usd: number;
  lanave_participation_percentage_bs: number;
  lanave_participation_percentage_usd: number;
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
    utilityUsd: ""
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [banqueoConfig, setBanqueoConfig] = useState<BanqueoCommissionConfig | null>(null);
  const [editingBanqueo, setEditingBanqueo] = useState(false);
  const [banqueoEditValues, setBanqueoEditValues] = useState({
    clientCommission: "",
    lanaveCommission: ""
  });
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [clientLanaveParticipation, setClientLanaveParticipation] = useState<ClientBanqueoCommission | null>(null);
  const [editingLanaveParticipation, setEditingLanaveParticipation] = useState(false);
  const [lanaveParticipationValues, setLanaveParticipationValues] = useState({
    participationBs: "",
    participationUsd: ""
  });
  const [clientParticipations, setClientParticipations] = useState<Map<string, ClientSystemParticipation>>(new Map());
  const [editingParticipationId, setEditingParticipationId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("bolivares");
  const [participationEditValues, setParticipationEditValues] = useState({
    commissionBs: "",
    commissionUsd: "",
    participationBs: "",
    participationUsd: "",
    lanaveParticipationBs: "",
    lanaveParticipationUsd: ""
  });
  const {
    toast
  } = useToast();
  useEffect(() => {
    fetchData();
  }, []);
  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch lottery systems (exclude parent systems with subcategories)
      const {
        data: systemsData,
        error: systemsError
      } = await supabase.from("lottery_systems").select("id, name, code, is_active, has_subcategories").order("name");
      if (systemsError) throw systemsError;

      // Fetch commission rates
      const {
        data: ratesData,
        error: ratesError
      } = await supabase.from("system_commission_rates").select("*");
      if (ratesError) throw ratesError;

      // Fetch banqueo commission config
      const {
        data: banqueoData,
        error: banqueoError
      } = await supabase.from("banqueo_commission_config").select("*").limit(1).maybeSingle();
      if (banqueoError) throw banqueoError;

      // Fetch clients
      const {
        data: clientsData,
        error: clientsError
      } = await supabase.from("clients").select("id, name").eq("is_active", true).order("name");
      if (clientsError) throw clientsError;
      setClients(clientsData || []);

      // Filter out parent systems that have subcategories
      const filteredSystems = (systemsData || []).filter(system => !system.has_subcategories);
      setSystems(filteredSystems);
      const commissionsMap = new Map<string, CommissionRate>();
      ratesData?.forEach(rate => {
        commissionsMap.set(rate.lottery_system_id, rate);
      });
      setCommissions(commissionsMap);
      if (banqueoData) {
        setBanqueoConfig(banqueoData);
        setBanqueoEditValues({
          clientCommission: banqueoData.client_commission_percentage.toString(),
          lanaveCommission: banqueoData.lanave_commission_percentage.toString()
        });
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los datos",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Load client commission and participations when client is selected
  useEffect(() => {
    if (selectedClientId) {
      loadClientCommissionData();
    } else {
      setClientLanaveParticipation(null);
      setClientParticipations(new Map());
    }
  }, [selectedClientId]);
  const loadClientCommissionData = async () => {
    if (!selectedClientId) return;
    try {
      // Load client lanave participation
      const {
        data: lanaveData,
        error: lanaveError
      } = await supabase.from("client_banqueo_commissions").select("*").eq("client_id", selectedClientId).eq("is_active", true).maybeSingle();
      if (lanaveError) throw lanaveError;
      if (lanaveData) {
        setClientLanaveParticipation(lanaveData);
        setLanaveParticipationValues({
          participationBs: lanaveData.lanave_participation_percentage_bs?.toString() || "0",
          participationUsd: lanaveData.lanave_participation_percentage_usd?.toString() || "0"
        });
      } else {
        setClientLanaveParticipation(null);
        setLanaveParticipationValues({
          participationBs: "0",
          participationUsd: "0"
        });
      }

      // Load client system commissions and participations
      const {
        data: participationsData,
        error: participationsError
      } = await supabase.from("client_system_participation").select("*").eq("client_id", selectedClientId).eq("is_active", true);
      if (participationsError) throw participationsError;
      const participationsMap = new Map<string, ClientSystemParticipation>();
      participationsData?.forEach(part => {
        participationsMap.set(part.lottery_system_id, {
          id: part.id,
          client_id: part.client_id,
          lottery_system_id: part.lottery_system_id,
          client_commission_percentage_bs: Number(part.client_commission_percentage_bs || 0),
          client_commission_percentage_usd: Number(part.client_commission_percentage_usd || 0),
          participation_percentage_bs: Number(part.participation_percentage_bs || 0),
          participation_percentage_usd: Number(part.participation_percentage_usd || 0),
          lanave_participation_percentage_bs: Number(part.lanave_participation_percentage_bs || 0),
          lanave_participation_percentage_usd: Number(part.lanave_participation_percentage_usd || 0)
        });
      });
      setClientParticipations(participationsMap);
    } catch (error) {
      console.error("Error loading client commission data:", error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los datos del cliente",
        variant: "destructive"
      });
    }
  };
  const handleSaveLanaveParticipation = async () => {
    if (!selectedClientId) return;
    const participationBs = parseFloat(lanaveParticipationValues.participationBs);
    const participationUsd = parseFloat(lanaveParticipationValues.participationUsd);
    if (isNaN(participationBs) || participationBs < 0 || participationBs > 100) {
      toast({
        title: "Error de validación",
        description: "La participación Bs debe estar entre 0 y 100",
        variant: "destructive"
      });
      return;
    }
    if (isNaN(participationUsd) || participationUsd < 0 || participationUsd > 100) {
      toast({
        title: "Error de validación",
        description: "La participación USD debe estar entre 0 y 100",
        variant: "destructive"
      });
      return;
    }
    try {
      setSaving(true);
      const {
        error
      } = await supabase.from("client_banqueo_commissions").upsert({
        id: clientLanaveParticipation?.id,
        client_id: selectedClientId,
        lanave_participation_percentage_bs: participationBs,
        lanave_participation_percentage_usd: participationUsd,
        is_active: true
      });
      if (error) throw error;
      toast({
        title: "Éxito",
        description: "Participación de Lanave guardada correctamente"
      });
      await loadClientCommissionData();
      setEditingLanaveParticipation(false);
    } catch (error) {
      console.error("Error saving lanave participation:", error);
      toast({
        title: "Error",
        description: "No se pudo guardar la participación de Lanave",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };
  const handleEditParticipation = (systemId: string) => {
    const existing = clientParticipations.get(systemId);
    const systemCommission = commissions.get(systemId);
    setEditingParticipationId(systemId);
    setParticipationEditValues({
      commissionBs: existing?.client_commission_percentage_bs?.toString() || systemCommission?.commission_percentage?.toString() || "0",
      commissionUsd: existing?.client_commission_percentage_usd?.toString() || systemCommission?.commission_percentage_usd?.toString() || "0",
      participationBs: existing?.participation_percentage_bs.toString() || "0",
      participationUsd: existing?.participation_percentage_usd.toString() || "0",
      lanaveParticipationBs: existing?.lanave_participation_percentage_bs?.toString() || clientLanaveParticipation?.lanave_participation_percentage_bs?.toString() || "0",
      lanaveParticipationUsd: existing?.lanave_participation_percentage_usd?.toString() || clientLanaveParticipation?.lanave_participation_percentage_usd?.toString() || "0"
    });
  };
  const handleSaveParticipation = async (systemId: string) => {
    if (!selectedClientId) return;
    const commissionBs = parseFloat(participationEditValues.commissionBs);
    const commissionUsd = parseFloat(participationEditValues.commissionUsd);
    const participationBs = parseFloat(participationEditValues.participationBs);
    const participationUsd = parseFloat(participationEditValues.participationUsd);
    const lanaveParticipationBs = parseFloat(participationEditValues.lanaveParticipationBs);
    const lanaveParticipationUsd = parseFloat(participationEditValues.lanaveParticipationUsd);
    if (isNaN(commissionBs) || commissionBs < 0 || commissionBs > 100) {
      toast({
        title: "Error de validación",
        description: "La comisión Bs debe estar entre 0 y 100",
        variant: "destructive"
      });
      return;
    }
    if (isNaN(commissionUsd) || commissionUsd < 0 || commissionUsd > 100) {
      toast({
        title: "Error de validación",
        description: "La comisión USD debe estar entre 0 y 100",
        variant: "destructive"
      });
      return;
    }
    if (isNaN(participationBs) || participationBs < 0 || participationBs > 100) {
      toast({
        title: "Error de validación",
        description: "La participación Bs debe estar entre 0 y 100",
        variant: "destructive"
      });
      return;
    }
    if (isNaN(participationUsd) || participationUsd < 0 || participationUsd > 100) {
      toast({
        title: "Error de validación",
        description: "La participación USD debe estar entre 0 y 100",
        variant: "destructive"
      });
      return;
    }
    if (isNaN(lanaveParticipationBs) || lanaveParticipationBs < 0 || lanaveParticipationBs > 100) {
      toast({
        title: "Error de validación",
        description: "La participación LaNave Bs debe estar entre 0 y 100",
        variant: "destructive"
      });
      return;
    }
    if (isNaN(lanaveParticipationUsd) || lanaveParticipationUsd < 0 || lanaveParticipationUsd > 100) {
      toast({
        title: "Error de validación",
        description: "La participación LaNave USD debe estar entre 0 y 100",
        variant: "destructive"
      });
      return;
    }
    try {
      setSaving(true);
      const existing = clientParticipations.get(systemId);
      const {
        error
      } = await supabase.from("client_system_participation").upsert({
        id: existing?.id,
        client_id: selectedClientId,
        lottery_system_id: systemId,
        client_commission_percentage_bs: commissionBs,
        client_commission_percentage_usd: commissionUsd,
        participation_percentage_bs: participationBs,
        participation_percentage_usd: participationUsd,
        lanave_participation_percentage_bs: lanaveParticipationBs,
        lanave_participation_percentage_usd: lanaveParticipationUsd,
        is_active: true
      });
      if (error) {
        console.error("Error details:", error);
        throw error;
      }
      toast({
        title: "Éxito",
        description: "Configuración guardada correctamente"
      });
      await loadClientCommissionData();
      setEditingParticipationId(null);
      setParticipationEditValues({
        commissionBs: "",
        commissionUsd: "",
        participationBs: "",
        participationUsd: "",
        lanaveParticipationBs: "",
        lanaveParticipationUsd: ""
      });
    } catch (error: any) {
      console.error("Error saving participation:", error);
      toast({
        title: "Error",
        description: error.message || "No se pudo guardar la configuración",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };
  const handleEdit = (systemId: string) => {
    const existing = commissions.get(systemId);
    setEditingId(systemId);
    setEditValues({
      commission: existing?.commission_percentage.toString() || "0",
      utility: existing?.utility_percentage.toString() || "0",
      commissionUsd: existing?.commission_percentage_usd.toString() || "0",
      utilityUsd: existing?.utility_percentage_usd.toString() || "0"
    });
  };
  const handleCancel = () => {
    setEditingId(null);
    setEditValues({
      commission: "",
      utility: "",
      commissionUsd: "",
      utilityUsd: ""
    });
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
        variant: "destructive"
      });
      return;
    }
    if (isNaN(utility) || utility < 0 || utility > 100) {
      toast({
        title: "Error de validación",
        description: "El porcentaje de utilidad Bs debe estar entre 0 y 100",
        variant: "destructive"
      });
      return;
    }
    if (isNaN(commissionUsd) || commissionUsd < 0 || commissionUsd > 100) {
      toast({
        title: "Error de validación",
        description: "El porcentaje de comisión USD debe estar entre 0 y 100",
        variant: "destructive"
      });
      return;
    }
    if (isNaN(utilityUsd) || utilityUsd < 0 || utilityUsd > 100) {
      toast({
        title: "Error de validación",
        description: "El porcentaje de utilidad USD debe estar entre 0 y 100",
        variant: "destructive"
      });
      return;
    }
    try {
      setSaving(true);
      const existing = commissions.get(systemId);
      let newId = existing?.id;
      
      if (existing?.id) {
        // Update existing
        const { error } = await supabase.from("system_commission_rates").update({
          commission_percentage: commission,
          utility_percentage: utility,
          commission_percentage_usd: commissionUsd,
          utility_percentage_usd: utilityUsd
        }).eq("id", existing.id);
        if (error) throw error;
      } else {
        // Insert new
        const { data, error } = await supabase.from("system_commission_rates").insert({
          lottery_system_id: systemId,
          commission_percentage: commission,
          utility_percentage: utility,
          commission_percentage_usd: commissionUsd,
          utility_percentage_usd: utilityUsd,
          is_active: true
        }).select('id').single();
        if (error) throw error;
        newId = data?.id;
      }
      
      // Update local state instead of fetching all data
      const updatedCommissions = new Map(commissions);
      updatedCommissions.set(systemId, {
        id: newId,
        lottery_system_id: systemId,
        commission_percentage: commission,
        utility_percentage: utility,
        commission_percentage_usd: commissionUsd,
        utility_percentage_usd: utilityUsd,
        is_active: true
      });
      setCommissions(updatedCommissions);
      
      toast({
        title: "Éxito",
        description: "Comisión guardada correctamente"
      });
      handleCancel();
    } catch (error) {
      console.error("Error saving commission:", error);
      toast({
        title: "Error",
        description: "No se pudo guardar la comisión",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };
  if (loading) {
    return <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>;
  }
  return <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold">Comisiones de Sistemas</h2>
        <p className="text-sm text-muted-foreground">
          Configure los porcentajes de comisión y utilidad para cada sistema de lotería
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="bolivares">Bolívares</TabsTrigger>
          <TabsTrigger value="dolares">Dólares</TabsTrigger>
          <TabsTrigger value="banqueos">Banqueos</TabsTrigger>
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
                {systems.map(system => {
                const commission = commissions.get(system.id);
                const isEditing = editingId === system.id;
                return <TableRow key={system.id}>
                      <TableCell className="font-medium">{system.name}</TableCell>
                      <TableCell className="text-right">
                        {isEditing ? <Input type="number" min="0" max="100" step="0.01" value={editValues.commission || ''} onChange={e => setEditValues({
                      ...editValues,
                      commission: e.target.value === '' ? '' : e.target.value
                    })} className="w-28 text-right" placeholder="0.00" /> : <span className="font-mono">
                            {commission?.commission_percentage.toFixed(2) || "0.00"}%
                          </span>}
                      </TableCell>
                      <TableCell className="text-right">
                        {isEditing ? <Input type="number" min="0" max="100" step="0.01" value={editValues.utility || ''} onChange={e => setEditValues({
                      ...editValues,
                      utility: e.target.value === '' ? '' : e.target.value
                    })} className="w-28 text-right" placeholder="0.00" /> : <span className="font-mono">
                            {commission?.utility_percentage.toFixed(2) || "0.00"}%
                          </span>}
                      </TableCell>
                      <TableCell>
                        {commission ? <Badge variant="default" className="bg-emerald-600">
                            Configurado
                          </Badge> : <Badge variant="secondary">Sin configurar</Badge>}
                      </TableCell>
                      <TableCell className="text-right">
                        {isEditing ? <div className="flex justify-end gap-2">
                            <Button size="sm" onClick={() => handleSave(system.id)} disabled={saving}>
                              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                            </Button>
                            <Button size="sm" variant="outline" onClick={handleCancel} disabled={saving}>
                              <X className="h-4 w-4" />
                            </Button>
                          </div> : <Button size="sm" variant="outline" onClick={() => handleEdit(system.id)}>
                            <Pencil className="h-4 w-4" />
                          </Button>}
                      </TableCell>
                    </TableRow>;
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
                {systems.map(system => {
                const commission = commissions.get(system.id);
                const isEditing = editingId === system.id;
                return <TableRow key={system.id}>
                      <TableCell className="font-medium">{system.name}</TableCell>
                      <TableCell className="text-right">
                        {isEditing ? <Input type="number" min="0" max="100" step="0.01" value={editValues.commissionUsd || ''} onChange={e => setEditValues({
                      ...editValues,
                      commissionUsd: e.target.value === '' ? '' : e.target.value
                    })} className="w-28 text-right" placeholder="0.00" /> : <span className="font-mono">
                            {commission?.commission_percentage_usd.toFixed(2) || "0.00"}%
                          </span>}
                      </TableCell>
                      <TableCell className="text-right">
                        {isEditing ? <Input type="number" min="0" max="100" step="0.01" value={editValues.utilityUsd || ''} onChange={e => setEditValues({
                      ...editValues,
                      utilityUsd: e.target.value === '' ? '' : e.target.value
                    })} className="w-28 text-right" placeholder="0.00" /> : <span className="font-mono">
                            {commission?.utility_percentage_usd.toFixed(2) || "0.00"}%
                          </span>}
                      </TableCell>
                      <TableCell>
                        {commission ? <Badge variant="default" className="bg-emerald-600">
                            Configurado
                          </Badge> : <Badge variant="secondary">Sin configurar</Badge>}
                      </TableCell>
                      <TableCell className="text-right">
                        {isEditing ? <div className="flex justify-end gap-2">
                            <Button size="sm" onClick={() => handleSave(system.id)} disabled={saving}>
                              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                            </Button>
                            <Button size="sm" variant="outline" onClick={handleCancel} disabled={saving}>
                              <X className="h-4 w-4" />
                            </Button>
                          </div> : <Button size="sm" variant="outline" onClick={() => handleEdit(system.id)}>
                            <Pencil className="h-4 w-4" />
                          </Button>}
                      </TableCell>
                    </TableRow>;
              })}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="banqueos" className="mt-4 space-y-6">
          {/* Configuración Global (Legacy - mantener por compatibilidad) */}
          <div className="rounded-md border p-6">
            <h3 className="text-lg font-semibold mb-4">Configuración Global de Banqueo</h3>
            <p className="text-sm text-muted-foreground mb-6">
              Configuración global por defecto (se usa si no hay configuración específica del cliente)
            </p>
            
            <div className="space-y-4 max-w-md">
              <div className="space-y-2">
                <Label htmlFor="client-commission">Comisión de participación del cliente (%)</Label>
                {editingBanqueo ? <Input id="client-commission" type="number" min="0" max="100" step="0.01" value={banqueoEditValues.clientCommission} onChange={e => setBanqueoEditValues({
                ...banqueoEditValues,
                clientCommission: e.target.value
              })} className="text-right" placeholder="0.00" /> : <div className="flex items-center justify-between rounded-md border px-3 py-2">
                    <span className="font-mono text-sm">
                      {banqueoConfig?.client_commission_percentage.toFixed(2) || "0.00"}%
                    </span>
                  </div>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="lanave-commission">Comisión de participación de lanave (%)</Label>
                {editingBanqueo ? <Input id="lanave-commission" type="number" min="0" max="100" step="0.01" value={banqueoEditValues.lanaveCommission} onChange={e => setBanqueoEditValues({
                ...banqueoEditValues,
                lanaveCommission: e.target.value
              })} className="text-right" placeholder="0.00" /> : <div className="items-center justify-between rounded-md border px-3 py-2 flex flex-row">
                    <span className="font-mono text-sm">
                      {banqueoConfig?.lanave_commission_percentage.toFixed(2) || "0.00"}%
                    </span>
                  </div>}
              </div>

              <div className="flex gap-2 pt-4">
                {editingBanqueo ? <>
                    <Button onClick={async () => {
                  const clientCommission = parseFloat(banqueoEditValues.clientCommission);
                  const lanaveCommission = parseFloat(banqueoEditValues.lanaveCommission);
                  if (isNaN(clientCommission) || clientCommission < 0 || clientCommission > 100) {
                    toast({
                      title: "Error de validación",
                      description: "La comisión del cliente debe estar entre 0 y 100",
                      variant: "destructive"
                    });
                    return;
                  }
                  if (isNaN(lanaveCommission) || lanaveCommission < 0 || lanaveCommission > 100) {
                    toast({
                      title: "Error de validación",
                      description: "La comisión de lanave debe estar entre 0 y 100",
                      variant: "destructive"
                    });
                    return;
                  }
                  try {
                    setSaving(true);
                    const {
                      error
                    } = await supabase.from("banqueo_commission_config").upsert({
                      id: banqueoConfig?.id,
                      client_commission_percentage: clientCommission,
                      lanave_commission_percentage: lanaveCommission
                    });
                    if (error) throw error;
                    toast({
                      title: "Éxito",
                      description: "Comisiones de banqueo guardadas correctamente"
                    });
                    await fetchData();
                    setEditingBanqueo(false);
                  } catch (error) {
                    console.error("Error saving banqueo config:", error);
                    toast({
                      title: "Error",
                      description: "No se pudieron guardar las comisiones de banqueo",
                      variant: "destructive"
                    });
                  } finally {
                    setSaving(false);
                  }
                }} disabled={saving}>
                      {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                      Guardar
                    </Button>
                    <Button variant="outline" onClick={() => {
                  setEditingBanqueo(false);
                  if (banqueoConfig) {
                    setBanqueoEditValues({
                      clientCommission: banqueoConfig.client_commission_percentage.toString(),
                      lanaveCommission: banqueoConfig.lanave_commission_percentage.toString()
                    });
                  }
                }} disabled={saving}>
                      <X className="h-4 w-4 mr-2" />
                      Cancelar
                    </Button>
                  </> : <Button variant="outline" onClick={() => setEditingBanqueo(true)}>
                    <Pencil className="h-4 w-4 mr-2" />
                    Editar
                  </Button>}
              </div>
            </div>
          </div>

          {/* Configuración por Cliente */}
          <div className="rounded-md border p-6">
            <h3 className="text-lg font-semibold mb-4">Comisiones de Banqueo por Cliente</h3>
            <p className="text-sm text-muted-foreground mb-6">
              Configure las comisiones y participaciones específicas para cada cliente
            </p>

            <div className="space-y-6">
              {/* Selector de Cliente */}
              <div className="space-y-2">
                <Label htmlFor="select-client" className="text-base font-semibold">Seleccionar Cliente</Label>
                <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                  <SelectTrigger id="select-client" className="w-full h-12 text-base">
                    <SelectValue placeholder="Seleccione un cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map(client => <SelectItem key={client.id} value={client.id}>
                        {client.name}
                      </SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {selectedClientId && <>
                  {/* Participación de Lanave (Única por cliente) */}
                  <div className="space-y-4 border rounded-lg p-4 bg-purple-50/50 mb-6">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold text-purple-900">Participación de Lanave</h4>
                      <Badge variant="outline" className="text-xs">Única por cliente</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Porcentaje de participación de Lanave (aplica a todos los sistemas del cliente)
                    </p>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="lanave-participation-bs" className="text-sm">Participación Bs (%)</Label>
                        {editingLanaveParticipation ? <Input id="lanave-participation-bs" type="number" min="0" max="100" step="0.01" value={lanaveParticipationValues.participationBs} onChange={e => setLanaveParticipationValues({
                      ...lanaveParticipationValues,
                      participationBs: e.target.value
                    })} className="text-right" placeholder="0.00" /> : <div className="flex items-center justify-between rounded-md border px-3 py-2 bg-white">
                            <span className="font-mono text-sm font-semibold">
                              {clientLanaveParticipation?.lanave_participation_percentage_bs?.toFixed(2) || "0.00"}%
                            </span>
                          </div>}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="lanave-participation-usd" className="text-sm">Participación USD (%)</Label>
                        {editingLanaveParticipation ? <Input id="lanave-participation-usd" type="number" min="0" max="100" step="0.01" value={lanaveParticipationValues.participationUsd} onChange={e => setLanaveParticipationValues({
                      ...lanaveParticipationValues,
                      participationUsd: e.target.value
                    })} className="text-right" placeholder="0.00" /> : <div className="flex items-center justify-between rounded-md border px-3 py-2 bg-white">
                            <span className="font-mono text-sm font-semibold">
                              {clientLanaveParticipation?.lanave_participation_percentage_usd?.toFixed(2) || "0.00"}%
                            </span>
                          </div>}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {editingLanaveParticipation ? <>
                          <Button onClick={handleSaveLanaveParticipation} disabled={saving} size="sm">
                            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                            Guardar
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => {
                      setEditingLanaveParticipation(false);
                      if (clientLanaveParticipation) {
                        setLanaveParticipationValues({
                          participationBs: clientLanaveParticipation.lanave_participation_percentage_bs?.toString() || "0",
                          participationUsd: clientLanaveParticipation.lanave_participation_percentage_usd?.toString() || "0"
                        });
                      }
                    }} disabled={saving}>
                            <X className="h-4 w-4 mr-2" />
                            Cancelar
                          </Button>
                        </> : <Button variant="outline" size="sm" onClick={() => setEditingLanaveParticipation(true)}>
                          <Pencil className="h-4 w-4 mr-2" />
                          Editar
                        </Button>}
                    </div>
                  </div>

                  {/* Comisión y Participación del Cliente por Sistema */}
                  <div className="space-y-4 border rounded-lg p-4 bg-green-50/50">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold text-green-900">Comisión y Participación del Cliente por Sistema</h4>
                      <Badge variant="outline" className="text-xs">Varía por sistema</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Comisión del cliente y su participación que pueden variar según el sistema de lotería (los valores por defecto se toman de la configuración de sistemas)
                    </p>
                    <div className="rounded-md border bg-white">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Sistema</TableHead>
                            <TableHead className="text-right">% Comisión Bs</TableHead>
                            <TableHead className="text-right">% Comisión USD</TableHead>
                            <TableHead className="text-right">% Participación Bs</TableHead>
                            <TableHead className="text-right">% Participación USD</TableHead>
                            <TableHead className="text-right">% Part. LaNave Bs</TableHead>
                            <TableHead className="text-right">% Part. LaNave USD</TableHead>
                            <TableHead className="text-right">Acciones</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {systems.map(system => {
                        const participation = clientParticipations.get(system.id);
                        const systemCommission = commissions.get(system.id);
                        const isEditing = editingParticipationId === system.id;
                        return <TableRow key={system.id}>
                                <TableCell className="font-medium">{system.name}</TableCell>
                                <TableCell className="text-right">
                                  {isEditing ? <Input type="number" min="0" max="100" step="0.01" value={participationEditValues.commissionBs} onChange={e => setParticipationEditValues({
                              ...participationEditValues,
                              commissionBs: e.target.value
                            })} className="w-28 text-right" placeholder="0.00" /> : <span className="font-mono">
                                      {participation?.client_commission_percentage_bs?.toFixed(2) || systemCommission?.commission_percentage?.toFixed(2) || "0.00"}%
                                    </span>}
                                </TableCell>
                                <TableCell className="text-right">
                                  {isEditing ? <Input type="number" min="0" max="100" step="0.01" value={participationEditValues.commissionUsd} onChange={e => setParticipationEditValues({
                              ...participationEditValues,
                              commissionUsd: e.target.value
                            })} className="w-28 text-right" placeholder="0.00" /> : <span className="font-mono">
                                      {participation?.client_commission_percentage_usd?.toFixed(2) || systemCommission?.commission_percentage_usd?.toFixed(2) || "0.00"}%
                                    </span>}
                                </TableCell>
                                <TableCell className="text-right">
                                  {isEditing ? <Input type="number" min="0" max="100" step="0.01" value={participationEditValues.participationBs} onChange={e => setParticipationEditValues({
                              ...participationEditValues,
                              participationBs: e.target.value
                            })} className="w-28 text-right" placeholder="0.00" /> : <span className="font-mono">
                                      {participation?.participation_percentage_bs.toFixed(2) || "0.00"}%
                                    </span>}
                                </TableCell>
                                <TableCell className="text-right">
                                  {isEditing ? <Input type="number" min="0" max="100" step="0.01" value={participationEditValues.participationUsd} onChange={e => setParticipationEditValues({
                              ...participationEditValues,
                              participationUsd: e.target.value
                            })} className="w-28 text-right" placeholder="0.00" /> : <span className="font-mono">
                                      {participation?.participation_percentage_usd.toFixed(2) || "0.00"}%
                                    </span>}
                                </TableCell>
                                <TableCell className="text-right">
                                  {isEditing ? <Input type="number" min="0" max="100" step="0.01" value={participationEditValues.lanaveParticipationBs} onChange={e => setParticipationEditValues({
                              ...participationEditValues,
                              lanaveParticipationBs: e.target.value
                            })} className="w-28 text-right" placeholder="0.00" /> : <span className="font-mono">
                                      {participation?.lanave_participation_percentage_bs?.toFixed(2) || clientLanaveParticipation?.lanave_participation_percentage_bs?.toFixed(2) || "0.00"}%
                                    </span>}
                                </TableCell>
                                <TableCell className="text-right">
                                  {isEditing ? <Input type="number" min="0" max="100" step="0.01" value={participationEditValues.lanaveParticipationUsd} onChange={e => setParticipationEditValues({
                              ...participationEditValues,
                              lanaveParticipationUsd: e.target.value
                            })} className="w-28 text-right" placeholder="0.00" /> : <span className="font-mono">
                                      {participation?.lanave_participation_percentage_usd?.toFixed(2) || clientLanaveParticipation?.lanave_participation_percentage_usd?.toFixed(2) || "0.00"}%
                                    </span>}
                                </TableCell>
                                <TableCell className="text-right">
                                  {isEditing ? <div className="flex justify-end gap-2">
                                      <Button size="sm" onClick={() => handleSaveParticipation(system.id)} disabled={saving}>
                                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                      </Button>
                                      <Button size="sm" variant="outline" onClick={() => {
                                setEditingParticipationId(null);
                                setParticipationEditValues({
                                  commissionBs: "",
                                  commissionUsd: "",
                                  participationBs: "",
                                  participationUsd: "",
                                  lanaveParticipationBs: "",
                                  lanaveParticipationUsd: ""
                                });
                              }} disabled={saving}>
                                        <X className="h-4 w-4" />
                                      </Button>
                                    </div> : <Button size="sm" variant="outline" onClick={() => handleEditParticipation(system.id)}>
                                      <Pencil className="h-4 w-4" />
                                    </Button>}
                                </TableCell>
                              </TableRow>;
                      })}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </>}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>;
}