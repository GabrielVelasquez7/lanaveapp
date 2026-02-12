import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { formatCurrency } from "@/lib/utils";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Calculator, CheckCircle2, XCircle, Save, TrendingUp, TrendingDown, ChevronDown, ChevronRight, AlertTriangle, Lock } from "lucide-react";
import { CuadreReviewDialog } from "./CuadreReviewDialog";
import { useCuadreGeneral } from "@/hooks/useCuadreGeneral";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface CuadreGeneralEncargadaProps {
  selectedAgency: string;
  selectedDate: Date;
  refreshKey?: number;
}

export const CuadreGeneralEncargada = ({
  selectedAgency,
  selectedDate,
  refreshKey = 0
}: CuadreGeneralEncargadaProps) => {
  const { toast } = useToast();

  // Use custom hook for logic
  const {
    loading,
    saving,
    approving,
    cuadre,
    agencyName,
    reviewStatus,
    reviewObservations,
    reviewedBy,
    reviewedAt,
    persistedState,
    hasLoadedFromStorage,
    saveToStorage,
    calculateTotals,
    handleSave,
    fetchCuadreData: refresh,
    taquilleraDefaults
  } = useCuadreGeneral(selectedAgency, selectedDate);

  useEffect(() => {
    if (refreshKey > 0) refresh();
  }, [refreshKey, refresh]);

  // Input states for editable fields
  const [exchangeRateInput, setExchangeRateInput] = useState<string>("36.00");
  const [cashAvailableInput, setCashAvailableInput] = useState<string>("0");
  const [cashAvailableUsdInput, setCashAvailableUsdInput] = useState<string>("0");
  const [pendingPrizesInput, setPendingPrizesInput] = useState<string>("0");
  const [pendingPrizesUsdInput, setPendingPrizesUsdInput] = useState<string>("0");
  const [closureNotesInput, setClosureNotesInput] = useState<string>("");
  const [additionalAmountBsInput, setAdditionalAmountBsInput] = useState<string>("0");
  const [additionalAmountUsdInput, setAdditionalAmountUsdInput] = useState<string>("0");
  const [additionalNotesInput, setAdditionalNotesInput] = useState<string>("");
  const [applyExcessUsdSwitch, setApplyExcessUsdSwitch] = useState<boolean>(true);

  // Track user edits
  const [fieldsEditedByUser, setFieldsEditedByUser] = useState({
    exchangeRate: false,
    cashAvailable: false,
    cashAvailableUsd: false
  });

  // UI States
  const [gastosOpen, setGastosOpen] = useState(false);
  const [deudasOpen, setDeudasOpen] = useState(false);

  // Refs to prevent overwrite loops
  const initializedRef = useRef(false);
  const lastDateRef = useRef(selectedDate.toISOString());

  // 1. Sync State: Backend/Persistence -> Local Inputs
  useEffect(() => {
    // If date changed, reset initialization
    if (lastDateRef.current !== selectedDate.toISOString()) {
      initializedRef.current = false;
      lastDateRef.current = selectedDate.toISOString();
      setFieldsEditedByUser({ exchangeRate: false, cashAvailable: false, cashAvailableUsd: false });
    }

    if (loading) return;
    
    // Don't re-initialize if already done for this date
    if (initializedRef.current) return;
    
    // Wait until taquilleraDefaults is available (data fully loaded)
    // taquilleraDefaults is null while query is still fetching
    if (!taquilleraDefaults && !hasLoadedFromStorage) return;

    // Build source: prioritize persistence, then cuadre merged with taquillera defaults
    let source: any = {};
    const usePersistence = hasLoadedFromStorage;

    if (usePersistence) {
      source = persistedState;
    } else {
      const td = taquilleraDefaults;
      
      // For exchange rate: use cuadre if explicitly set (> default 36), else taquillera's max rate
      const effectiveRate = cuadre.exchangeRate > 36 ? cuadre.exchangeRate : (td?.exchangeRate && td.exchangeRate > 0 ? td.exchangeRate : cuadre.exchangeRate);
      const effectiveCashBs = cuadre.cashAvailable > 0 ? cuadre.cashAvailable : (td?.cashBs || 0);
      const effectiveCashUsd = cuadre.cashAvailableUsd > 0 ? cuadre.cashAvailableUsd : (td?.cashUsd || 0);
      const effectiveNotes = cuadre.closureNotes || td?.closureNotes || "";
      const effectiveAddBs = cuadre.additionalAmountBs > 0 ? cuadre.additionalAmountBs : (td?.addBs || 0);
      const effectiveAddUsd = cuadre.additionalAmountUsd > 0 ? cuadre.additionalAmountUsd : (td?.addUsd || 0);
      const effectiveAddNotes = cuadre.additionalNotes || td?.addNotes || "";
      const effectivePending = cuadre.pendingPrizes > 0 ? cuadre.pendingPrizes : (td?.pendingPrizesBs || 0);
      const effectivePendingUsd = (cuadre as any).pendingPrizesUsd > 0 ? (cuadre as any).pendingPrizesUsd : (td?.pendingPrizesUsd || 0);

      source = {
        exchangeRateInput: effectiveRate.toString(),
        cashAvailableInput: effectiveCashBs.toString(),
        cashAvailableUsdInput: effectiveCashUsd.toString(),
        pendingPrizesInput: effectivePending.toString(),
        pendingPrizesUsdInput: effectivePendingUsd.toString(),
        closureNotesInput: effectiveNotes,
        additionalAmountBsInput: effectiveAddBs.toString(),
        additionalAmountUsdInput: effectiveAddUsd.toString(),
        additionalNotesInput: effectiveAddNotes,
        applyExcessUsdSwitch: cuadre.applyExcessUsd
      };
    }

    // Initialize ALL fields once
    setExchangeRateInput(source.exchangeRateInput || "36.00");
    setCashAvailableInput(source.cashAvailableInput || "0");
    setCashAvailableUsdInput(source.cashAvailableUsdInput || "0");
    setPendingPrizesInput(source.pendingPrizesInput || "0");
    setPendingPrizesUsdInput(source.pendingPrizesUsdInput || "0");
    setClosureNotesInput(source.closureNotesInput || "");
    setAdditionalAmountBsInput(source.additionalAmountBsInput || "0");
    setAdditionalAmountUsdInput(source.additionalAmountUsdInput || "0");
    setAdditionalNotesInput(source.additionalNotesInput || "");
    if (source.applyExcessUsdSwitch !== undefined) setApplyExcessUsdSwitch(source.applyExcessUsdSwitch);

    initializedRef.current = true;
  }, [loading, hasLoadedFromStorage, cuadre, persistedState, selectedDate, taquilleraDefaults]);


  // 2. Sync State: Local Inputs -> Persistence
  useEffect(() => {
    if (loading) return; // Don't save empty/loading state

    const currentInputs = {
      exchangeRateInput,
      cashAvailableInput,
      cashAvailableUsdInput,
      pendingPrizesInput,
      pendingPrizesUsdInput,
      closureNotesInput,
      additionalAmountBsInput,
      additionalAmountUsdInput,
      additionalNotesInput,
      applyExcessUsdSwitch,
      fieldsEditedByUser
    };
    saveToStorage(currentInputs);
  }, [
    exchangeRateInput, cashAvailableInput, cashAvailableUsdInput,
    pendingPrizesInput, pendingPrizesUsdInput, closureNotesInput,
    additionalAmountBsInput, additionalAmountUsdInput, additionalNotesInput,
    applyExcessUsdSwitch, fieldsEditedByUser, saveToStorage, loading
  ]);


  // Totals for UI
  const inputsForTotals = {
    exchangeRateInput,
    cashAvailableInput,
    cashAvailableUsdInput,
    pendingPrizesInput,
    pendingPrizesUsdInput,
    additionalAmountBsInput,
    additionalAmountUsdInput,
    applyExcessUsdSwitch
  };
  const uiTotals = calculateTotals(inputsForTotals);

  const handleRejectCuadre = async (observations: string) => {
    // Re-implementing reject logic locally or moving to hook? 
    // The previous implementation had it in the component. Let's keep it here but arguably it belongs in the hook.
    // For expediency, I'll inline the DB call or add it to the hook? 
    // The hook is better. But I didn't add it to the implementation plan for the hook.
    // I'll keep the logic here for now to avoid modifying the hook again unless necessary.

    if (!selectedAgency || !selectedDate) return;
    try {
      // ... existing reject logic ...
      // Actually, let's just do it here quickly. It matches the previous file's logic.
      const dateStr = format(selectedDate, 'yyyy-MM-dd');

      const { data: taquilleras } = await supabase.from("profiles")
        .select("user_id")
        .eq("agency_id", selectedAgency)
        .eq("role", "taquillero")
        .eq("is_active", true);
      const taquilleraIds = taquilleras?.map(t => t.user_id) || [];

      let sessionIds: string[] = [];
      if (taquilleraIds.length > 0) {
        const { data: sessions } = await supabase.from("daily_sessions")
          .select("id")
          .eq("session_date", dateStr)
          .in("user_id", taquilleraIds);
        sessionIds = sessions?.map(s => s.id) || [];
      }

      const updates = [
        supabase.from("daily_cuadres_summary").update({
          encargada_status: "rechazado",
          encargada_observations: observations,
          encargada_reviewed_by: (await supabase.auth.getUser()).data.user?.id,
          encargada_reviewed_at: new Date().toISOString()
        }).eq("session_date", dateStr).eq("agency_id", selectedAgency).is("session_id", null)
      ];

      if (sessionIds.length > 0) {
        updates.push(supabase.from("daily_cuadres_summary").update({
          encargada_status: "rechazado",
          encargada_observations: observations,
          encargada_reviewed_by: (await supabase.auth.getUser()).data.user?.id,
          encargada_reviewed_at: new Date().toISOString()
        }).eq("session_date", dateStr).eq("agency_id", selectedAgency).in("session_id", sessionIds));
      }

      await Promise.all(updates);
      toast({ title: "Cuadre Rechazado", description: "Se ha rechazado el cuadre.", variant: "destructive" });
      refresh(); // Refresh

    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };


  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <Calculator className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p>Cargando cuadre general...</p>
        </div>
      </div>
    );
  }

  // Check data existence
  const hasData = cuadre.totalSales.bs > 0 || cuadre.totalSales.usd > 0 ||
    cuadre.totalPrizes.bs > 0 || cuadre.totalPrizes.usd > 0 ||
    cuadre.totalGastos.bs > 0 || cuadre.totalGastos.usd > 0 ||
    cuadre.totalDeudas.bs > 0 || cuadre.totalDeudas.usd > 0 ||
    cuadre.pagoMovilRecibidos > 0 || cuadre.totalPointOfSale > 0 ||
    cuadre.pendingPrizes > 0;

  if (!hasData) {
    return (
      <Card className="border-2 border-dashed">
        <CardContent className="pt-8 pb-8">
          <div className="text-center text-muted-foreground space-y-2">
            <Calculator className="h-12 w-12 mx-auto opacity-50" />
            <p className="text-lg font-medium">No hay datos registrados</p>
            <p className="text-sm">No se encontraron ventas, premios ni gastos para esta agencia y fecha.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Determine read-only state (if approved)
  const isApproved = reviewStatus === 'aprobado';
  const isRejected = reviewStatus === 'rechazado';
  // Allow editing if pending or rejected. Lock if approved.
  const isLocked = isApproved;


  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Cuadre General</h2>
            <p className="text-sm text-muted-foreground">
              {agencyName} - {format(selectedDate, "d 'de' MMMM 'de' yyyy", { locale: es })}
            </p>
          </div>
          <CuadreReviewDialog
            currentStatus={reviewStatus}
            reviewedBy={reviewedBy}
            reviewedAt={reviewedAt}
            currentObservations={reviewObservations}
            onReject={handleRejectCuadre}
            disabled={!hasData || isApproved}
          />
        </div>
        {isApproved && (
          <Badge variant="default" className="flex items-center gap-1 w-fit bg-emerald-600 hover:bg-emerald-700">
            <CheckCircle2 className="h-3 w-3" />
            Día Cerrado y Aprobado
          </Badge>
        )}
        {isRejected && (
          <Badge variant="destructive" className="flex items-center gap-1 w-fit">
            <AlertTriangle className="h-3 w-3" />
            Cuadre Rechazado - Requiere Revisión
          </Badge>
        )}
      </div>

      {/* Exchange Rate Badge */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="pt-4 text-center">
          <p className="text-sm text-muted-foreground">
            Tasa del día: <span className="font-bold">{parseFloat(exchangeRateInput).toFixed(2)} Bs/USD</span>
          </p>
        </CardContent>
      </Card>

      {/* Editable Congifuration */}
      <Card className="border-2 border-primary/30 bg-gradient-to-br from-primary/5 to-accent/10">
        <CardHeader className="pb-4">
          <CardTitle className="text-primary flex items-center gap-2">
            <Save className="h-5 w-5" />
            Configuración y Cierre
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Tasa BCV</Label>
              <Input
                type="number" step="0.01"
                value={exchangeRateInput}
                onChange={e => { setExchangeRateInput(e.target.value); setFieldsEditedByUser(prev => ({ ...prev, exchangeRate: true })); }}
                disabled={isLocked}
                className="text-center font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label>Efectivo Disponible (Bs)</Label>
              <Input
                type="number" step="0.01"
                value={cashAvailableInput}
                onChange={e => { setCashAvailableInput(e.target.value); setFieldsEditedByUser(prev => ({ ...prev, cashAvailable: true })); }}
                disabled={isLocked}
                className="text-center font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label>Efectivo Disponible (USD)</Label>
              <Input
                type="number" step="0.01"
                value={cashAvailableUsdInput}
                onChange={e => { setCashAvailableUsdInput(e.target.value); setFieldsEditedByUser(prev => ({ ...prev, cashAvailableUsd: true })); }}
                disabled={isLocked}
                className="text-center font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Premios por Pagar (Bs)</Label>
              <Input
                type="number" step="0.01"
                value={pendingPrizesInput}
                onChange={e => setPendingPrizesInput(e.target.value)}
                disabled={isLocked}
                className="text-center font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label>Premios por Pagar (USD)</Label>
              <Input
                type="number" step="0.01"
                value={pendingPrizesUsdInput}
                onChange={e => setPendingPrizesUsdInput(e.target.value)}
                disabled={isLocked}
                className="text-center font-mono"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Observaciones</Label>
            <Textarea
              value={closureNotesInput}
              onChange={e => setClosureNotesInput(e.target.value)}
              disabled={isLocked}
              placeholder="Observaciones generales..."
            />
          </div>

          <Separator />

          {/* Ajustes Adicionales */}
          <div className="space-y-4 p-4 rounded-lg bg-card border border-border">
            <h4 className="font-semibold flex items-center gap-2">
              <Calculator className="h-4 w-4" /> Ajustes Adicionales
            </h4>
            <div className="flex items-center justify-between p-3 rounded-lg bg-accent/20 border border-accent/40">
              <div className="space-y-1">
                <Label className="font-medium">Aplicar excedente USD a Bs</Label>
                <p className="text-xs text-muted-foreground">Suma al cuadre de Bs</p>
              </div>
              <Switch
                checked={applyExcessUsdSwitch}
                onCheckedChange={setApplyExcessUsdSwitch}
                disabled={isLocked}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Monto Adicional (Bs)</Label>
                <Input
                  type="number" step="0.01"
                  value={additionalAmountBsInput}
                  onChange={e => setAdditionalAmountBsInput(e.target.value)}
                  disabled={isLocked}
                />
              </div>
              <div className="space-y-2">
                <Label>Monto Adicional (USD)</Label>
                <Input
                  type="number" step="0.01"
                  value={additionalAmountUsdInput}
                  onChange={e => setAdditionalAmountUsdInput(e.target.value)}
                  disabled={isLocked}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Nota del Ajuste</Label>
              <Textarea
                value={additionalNotesInput}
                onChange={e => setAdditionalNotesInput(e.target.value)}
                disabled={isLocked}
                placeholder="Razón del monto adicional..."
              />
            </div>
          </div>

          {/* Buttons */}
          {!isLocked && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Button
                variant="outline"
                onClick={() => handleSave(inputsForTotals, false)}
                disabled={saving || approving}
                className="w-full"
              >
                <Save className="h-4 w-4 mr-2" />
                {saving && !approving ? "Guardando..." : "Guardar Progreso"}
              </Button>
              <Button
                variant="default"
                onClick={() => handleSave(inputsForTotals, true)}
                disabled={saving || approving}
                className="w-full bg-emerald-600 hover:bg-emerald-700"
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                {approving ? "Procesando..." : "Finalizar y Aprobar Día"}
              </Button>
            </div>
          )}
          {isLocked && (
            <div className="p-4 bg-muted text-center rounded-lg border border-border">
              <p className="flex items-center justify-center gap-2 text-muted-foreground">
                <Lock className="h-4 w-4" />
                El cuadre ha sido aprobado y no se puede modificar.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Indicadores Visales (Replica of previous design) */}
      <Card className="border-2 border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Calculator className="h-5 w-5" /> Indicadores Principales</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <IndicatorCard title="Cuadre (V-P) Bs" value={uiTotals.cuadreVentasPremios.bs} type="bs" icon={TrendingUp} color="blue" />
            <IndicatorCard title="Cuadre (V-P) USD" value={uiTotals.cuadreVentasPremios.usd} type="usd" icon={TrendingUp} color="purple" />
            <IndicatorCard title="Total en Banco" value={uiTotals.totalBanco} type="bs" icon={TrendingUp} color="emerald" />
            <IndicatorCard title="Premios por Pagar" value={parseFloat(pendingPrizesInput) || 0} type="bs" icon={TrendingDown} color="amber" />
          </div>

          <Separator className="my-6" />

          {/* Comparación Bs */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <h4 className="font-semibold text-primary">Resumen Bolívares</h4>
              <div className="space-y-2 text-sm border p-4 rounded-lg">
                <Row label="Efectivo del día" value={parseFloat(cashAvailableInput) || 0} type="bs" />
                <Row label="Total en Banco" value={uiTotals.totalBanco} type="bs" />

                <CollapsibleSection title="Gastos" open={gastosOpen} setOpen={setGastosOpen} total={cuadre.totalGastos.bs} items={cuadre.gastosDetails} />
                <CollapsibleSection title="Deudas" open={deudasOpen} setOpen={setDeudasOpen} total={cuadre.totalDeudas.bs} items={cuadre.deudasDetails} />

                <Row label={`Excedente USD (${uiTotals.excessUsd.toFixed(2)})`} value={uiTotals.excessUsd * parseFloat(exchangeRateInput)} type="bs" hidden={!applyExcessUsdSwitch} />
                <Row label="Menos: Adicional" value={-(parseFloat(additionalAmountBsInput) || 0)} type="bs" className="text-destructive" />

                <Separator />
                <Row label="Sumatoria Total" value={uiTotals.sumatoriaBolivares} type="bs" bold />
              </div>

              <div className="space-y-2 text-sm border p-4 rounded-lg bg-muted/30">
                <Row label="Sumatoria" value={uiTotals.sumatoriaBolivares} type="bs" />
                <Row label="Cuadre (V-P)" value={uiTotals.cuadreVentasPremios.bs} type="bs" />
                <Row label="Diferencia Cierre" value={uiTotals.sumatoriaBolivares - uiTotals.cuadreVentasPremios.bs} type="bs" />
                <Row label="Menos: Premios Pendientes" value={-(parseFloat(pendingPrizesInput) || 0)} type="bs" />
                <Separator />
                <ResultCard value={uiTotals.diferenciaFinal} type="bs" />
              </div>
            </div>

            {/* Comparación USD */}
            <div className="space-y-4">
              <h4 className="font-semibold text-purple-600">Resumen Dólares</h4>
              <div className="space-y-2 text-sm border p-4 rounded-lg">
                <Row label="Efectivo Disponible" value={parseFloat(cashAvailableUsdInput) || 0} type="usd" />
                <Row label="Gastos" value={cuadre.totalGastos.usd} type="usd" />
                <Row label="Deudas" value={cuadre.totalDeudas.usd} type="usd" />
                <Separator />
                <Row label="Sumatoria Total" value={uiTotals.sumatoriaUsd} type="usd" bold />
              </div>

              <div className="space-y-2 text-sm border p-4 rounded-lg bg-purple-50/30">
                <Row label="Sumatoria" value={uiTotals.sumatoriaUsd} type="usd" />
                <Row label="Cuadre (V-P)" value={uiTotals.cuadreVentasPremios.usd} type="usd" />
                <Row label="Menos: Adicional" value={-(parseFloat(additionalAmountUsdInput) || 0)} type="usd" />
                <Row label="Menos: Premios Pendientes" value={-(parseFloat(pendingPrizesUsdInput) || 0)} type="usd" />
                <Separator />
                <ResultCard value={uiTotals.diferenciaFinalUsd} type="usd" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// Helper Components for Cleaner Main Component

const IndicatorCard = ({ title, value, type, icon: Icon, color }: any) => {
  const colorClasses: any = {
    blue: "text-blue-600 bg-blue-50 border-blue-100",
    purple: "text-purple-600 bg-purple-50 border-purple-100",
    emerald: "text-emerald-600 bg-emerald-50 border-emerald-100",
    amber: "text-amber-600 bg-amber-50 border-amber-100",
  };
  const c = colorClasses[color] || colorClasses.blue;
  return (
    <div className={`p-4 rounded-xl border ${c} flex flex-col justify-between`}>
      <div className="flex items-center gap-2 mb-2 opacity-80">
        <Icon className="h-4 w-4" />
        <span className="text-xs font-semibold uppercase">{title}</span>
      </div>
      <p className="text-2xl font-bold font-mono">{formatCurrency(value, type === 'bs' ? 'VES' : 'USD')}</p>
    </div>
  );
};

const Row = ({ label, value, type, bold, className, hidden }: any) => {
  if (hidden) return null;
  return (
    <div className={`flex justify-between items-center ${className}`}>
      <span className={bold ? "font-bold" : "text-muted-foreground"}>{label}</span>
      <span className={`font-mono ${bold ? "font-bold" : ""}`}>{formatCurrency(value, type === 'bs' ? 'VES' : 'USD')}</span>
    </div>
  );
};

const ResultCard = ({ value, type }: any) => {
  const isBalanced = Math.abs(value) <= (type === 'bs' ? 100 : 5);
  return (
    <div className={`p-4 rounded-lg border-2 text-center ${isBalanced ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-red-50 border-red-200 text-red-700"}`}>
      <p className="text-xs font-bold uppercase mb-1">Diferencia Final</p>
      <p className="text-3xl font-bold font-mono">{formatCurrency(value, type === 'bs' ? 'VES' : 'USD')}</p>
      <p className="text-xs mt-1">{isBalanced ? "¡Cuadre Balanceado!" : "Diferencia Encontrada"}</p>
    </div>
  );
};

const CollapsibleSection = ({ title, open, setOpen, total, items }: any) => (
  <Collapsible open={open} onOpenChange={setOpen}>
    <CollapsibleTrigger asChild>
      <div className="flex justify-between items-center cursor-pointer hover:bg-muted/50 rounded p-1 transition-colors">
        <span className="flex items-center gap-1 text-muted-foreground">
          {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          {title}
        </span>
        <span className="font-mono">{formatCurrency(total, 'VES')}</span>
      </div>
    </CollapsibleTrigger>
    <CollapsibleContent>
      <div className="ml-4 mt-1 space-y-1 text-xs text-muted-foreground border-l-2 pl-2">
        {items.length === 0 ? <p>No hay registros</p> : items.map((i: any, idx: number) => (
          <div key={idx} className="flex justify-between">
            <span>{i.description}</span>
            <span className="font-mono">{formatCurrency(i.amount_bs, 'VES')}</span>
          </div>
        ))}
      </div>
    </CollapsibleContent>
  </Collapsible>
);