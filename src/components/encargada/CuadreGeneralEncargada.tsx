import { useEffect, useMemo } from "react";
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
import { calculateCuadreTotals } from "@/lib/financialMath";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Calculator, CheckCircle2, Save, TrendingUp, TrendingDown, ChevronDown, ChevronRight, AlertTriangle, Lock } from "lucide-react";
import { CuadreReviewDialog } from "./CuadreReviewDialog";
import { useCuadreGeneral } from "@/hooks/useCuadreGeneral";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

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

  const {
    loading,
    saving,
    approving,
    cuadre,
    formState,
    setFormField,
    blurFormField,
    agencyName,
    reviewStatus,
    reviewObservations,
    reviewedBy,
    reviewedAt,
    calculateTotals,
    handleSave,
    fetchCuadreData: refresh,
    taquilleraTotals,
    taquilleraIndicators,
    taqSessionIds,
  } = useCuadreGeneral(selectedAgency, selectedDate);

  // Compute full taquillera indicators using the same calculation engine.
  // MEMOIZADO: solo recalcula cuando taquilleraIndicators cambia (que solo cambia con
  // fetchedData, nunca con formState). Garantiza que el resumen de la taquillera
  // NO cambia cuando la encargada modifica sus propios campos (efectivo, tasa, etc.).
  const taqTotals = useMemo(() => {
    if (!taquilleraIndicators) return null;
    return calculateCuadreTotals({
      totalSales: taquilleraIndicators.sales,
      totalPrizes: taquilleraIndicators.prizes,
      totalGastos: taquilleraIndicators.gastos,
      totalDeudas: taquilleraIndicators.deudas,
      pagoMovilRecibidos: taquilleraIndicators.pagoMovilRecibidos,
      pagoMovilPagados: taquilleraIndicators.pagoMovilPagados,
      totalPointOfSale: taquilleraIndicators.totalPointOfSale,
      cashAvailable: taquilleraIndicators.cashBs,
      cashAvailableUsd: taquilleraIndicators.cashUsd,
      pendingPrizes: taquilleraIndicators.pendingPrizesBs,
      pendingPrizesUsd: taquilleraIndicators.pendingPrizesUsd,
      additionalAmountBs: taquilleraIndicators.additionalAmountBs,
      additionalAmountUsd: taquilleraIndicators.additionalAmountUsd,
      exchangeRate: taquilleraIndicators.exchangeRate,
      applyExcessUsd: taquilleraIndicators.applyExcessUsd,
    });
  }, [taquilleraIndicators]);

  useEffect(() => {
    if (refreshKey > 0) refresh();
  }, [refreshKey, refresh]);

  // UI-only states (collapsible sections)
  const [gastosOpen, setGastosOpen] = useState(false);
  const [deudasOpen, setDeudasOpen] = useState(false);
  const [gastosUsdOpen, setGastosUsdOpen] = useState(false);
  const [deudasUsdOpen, setDeudasUsdOpen] = useState(false);
  const [cuadreVPBsOpen, setCuadreVPBsOpen] = useState(false);
  const [cuadreVPUsdOpen, setCuadreVPUsdOpen] = useState(false);
  const [taqCuadreVPBsOpen, setTaqCuadreVPBsOpen] = useState(false);
  const [taqCuadreVPUsdOpen, setTaqCuadreVPUsdOpen] = useState(false);
  const [taqGastosBsOpen, setTaqGastosBsOpen] = useState(false);
  const [taqDeudasBsOpen, setTaqDeudasBsOpen] = useState(false);
  const [taqGastosUsdOpen, setTaqGastosUsdOpen] = useState(false);
  const [taqDeudasUsdOpen, setTaqDeudasUsdOpen] = useState(false);
  const [bancoBsOpen, setBancoBsOpen] = useState(false);
  const [bancoUsdOpen, setBancoUsdOpen] = useState(false);
  const [taqBancoBsOpen, setTaqBancoBsOpen] = useState(false);
  const [taqBancoUsdOpen, setTaqBancoUsdOpen] = useState(false);

  // Totals for UI (derived from formState via the hook)
  const uiTotals = calculateTotals();

  const handleRejectCuadre = async (observations: string) => {
    if (!selectedAgency || !selectedDate) return;
    try {
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
      refresh();

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

  const isApproved = reviewStatus === 'aprobado';
  const isRejected = reviewStatus === 'rechazado';
  const isLocked = false;

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

      {/* Floating action buttons - slide from right */}
      {!isLocked && (
        <div className="fixed right-4 top-1/3 z-50 flex flex-col gap-2 animate-in slide-in-from-right duration-300">
          <Button
            onClick={() => handleSave(false)}
            disabled={saving || approving}
            className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg rounded-full px-4 py-2 text-sm font-semibold transition-all hover:scale-105 hover:shadow-xl"
            size="sm"
          >
            <Save className="h-4 w-4 mr-1.5" />
            {saving && !approving ? "Guardando..." : "Guardar"}
          </Button>
          <Button
            onClick={() => handleSave(true)}
            disabled={saving || approving}
            className="bg-emerald-600 text-white hover:bg-emerald-700 shadow-lg rounded-full px-4 py-2 text-sm font-semibold transition-all hover:scale-105 hover:shadow-xl"
            size="sm"
          >
            <CheckCircle2 className="h-4 w-4 mr-1.5" />
            {approving ? "Procesando..." : "Aprobar"}
          </Button>
        </div>
      )}

      {/* Exchange Rate Badge */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="pt-4 text-center">
          <p className="text-sm text-muted-foreground">
            Tasa del día: <span className="font-bold">{parseFloat(formState.exchangeRate).toFixed(2)} Bs/USD</span>
          </p>
        </CardContent>
      </Card>

      {/* Editable Configuration */}
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
                value={formState.exchangeRate}
                onChange={e => setFormField('exchangeRate', e.target.value)}
                onBlur={() => blurFormField('exchangeRate')}
                disabled={isLocked}
                className="text-center font-mono"
              />
              {taquilleraIndicators && taquilleraIndicators.exchangeRate > 0 && (
                <p className="text-xs text-amber-600 dark:text-amber-400 text-center">
                  Taquillera: <span className="font-mono font-semibold">{taquilleraIndicators.exchangeRate.toFixed(2)}</span>
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Efectivo Disponible (Bs)</Label>
              <Input
                type="number" step="0.01"
                value={formState.cashAvailable}
                onChange={e => setFormField('cashAvailable', e.target.value)}
                onBlur={() => blurFormField('cashAvailable')}
                disabled={isLocked}
                className="text-center font-mono"
              />
              {taquilleraIndicators && (
                <p className="text-xs text-amber-600 dark:text-amber-400 text-center">
                  Taquillera: <span className="font-mono font-semibold">{formatCurrency(taquilleraIndicators.cashBs, 'VES')}</span>
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Efectivo Disponible (USD)</Label>
              <Input
                type="number" step="0.01"
                value={formState.cashAvailableUsd}
                onChange={e => setFormField('cashAvailableUsd', e.target.value)}
                onBlur={() => blurFormField('cashAvailableUsd')}
                disabled={isLocked}
                className="text-center font-mono"
              />
              {taquilleraIndicators && (
                <p className="text-xs text-amber-600 dark:text-amber-400 text-center">
                  Taquillera: <span className="font-mono font-semibold">{formatCurrency(taquilleraIndicators.cashUsd, 'USD')}</span>
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Premios por Pagar (Bs)</Label>
              <Input
                type="number" step="0.01"
                value={formState.pendingPrizes}
                onChange={e => setFormField('pendingPrizes', e.target.value)}
                onBlur={() => blurFormField('pendingPrizes')}
                disabled={isLocked}
                className="text-center font-mono"
              />
              {taquilleraIndicators && (
                <p className="text-xs text-amber-600 dark:text-amber-400 text-center">
                  Taquillera: <span className="font-mono font-semibold">{formatCurrency(taquilleraIndicators.pendingPrizesBs, 'VES')}</span>
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Premios por Pagar (USD)</Label>
              <Input
                type="number" step="0.01"
                value={formState.pendingPrizesUsd}
                onChange={e => setFormField('pendingPrizesUsd', e.target.value)}
                onBlur={() => blurFormField('pendingPrizesUsd')}
                disabled={isLocked}
                className="text-center font-mono"
              />
              {taquilleraIndicators && (
                <p className="text-xs text-amber-600 dark:text-amber-400 text-center">
                  Taquillera: <span className="font-mono font-semibold">{formatCurrency(taquilleraIndicators.pendingPrizesUsd, 'USD')}</span>
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Observaciones</Label>
            <Textarea
              value={formState.closureNotes}
              onChange={e => setFormField('closureNotes', e.target.value)}
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
                checked={formState.applyExcessUsd}
                onCheckedChange={v => setFormField('applyExcessUsd', v)}
                disabled={isLocked}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Monto Adicional (Bs)</Label>
                <Input
                  type="number" step="0.01"
                  value={formState.additionalAmountBs}
                  onChange={e => setFormField('additionalAmountBs', e.target.value)}
                  onBlur={() => blurFormField('additionalAmountBs')}
                  disabled={isLocked}
                />
                {taquilleraIndicators && (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    Taquillera: <span className="font-mono font-semibold">{formatCurrency(taquilleraIndicators.additionalAmountBs, 'VES')}</span>
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Monto Adicional (USD)</Label>
                <Input
                  type="number" step="0.01"
                  value={formState.additionalAmountUsd}
                  onChange={e => setFormField('additionalAmountUsd', e.target.value)}
                  onBlur={() => blurFormField('additionalAmountUsd')}
                  disabled={isLocked}
                />
                {taquilleraIndicators && (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    Taquillera: <span className="font-mono font-semibold">{formatCurrency(taquilleraIndicators.additionalAmountUsd, 'USD')}</span>
                  </p>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Nota del Ajuste</Label>
              <Textarea
                value={formState.additionalNotes}
                onChange={e => setFormField('additionalNotes', e.target.value)}
                disabled={isLocked}
                placeholder="Razón del monto adicional..."
              />
            </div>
          </div>

          {/* Buttons removed - now floating on the right side */}
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

      {/* Indicadores Principales */}
      <Card className="border-2 border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Calculator className="h-5 w-5" /> Indicadores Principales</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <IndicatorCard title="Cuadre (V-P) Bs" value={uiTotals.cuadreVentasPremios.bs} type="bs" icon={TrendingUp} color="blue" />
            <IndicatorCard title="Cuadre (V-P) USD" value={uiTotals.cuadreVentasPremios.usd} type="usd" icon={TrendingUp} color="purple" />
            <IndicatorCard title="Total en Banco" value={uiTotals.totalBanco} type="bs" icon={TrendingUp} color="emerald" />
            <IndicatorCard title="Premios por Pagar" value={parseFloat(formState.pendingPrizes) || 0} type="bs" icon={TrendingDown} color="amber" />
          </div>

          <Separator className="my-6" />

          {/* Comparación Bs */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <h4 className="font-semibold text-primary">Resumen Bolívares</h4>
              <div className="space-y-2 text-sm border p-4 rounded-lg">
                <Row label="Efectivo del día" value={parseFloat(formState.cashAvailable) || 0} type="bs" />
                <CollapsibleTotalBanco open={bancoBsOpen} setOpen={setBancoBsOpen} total={uiTotals.totalBanco} pagoMovilRecibidos={cuadre.pagoMovilRecibidos} pagoMovilPagados={cuadre.pagoMovilPagados} totalPointOfSale={cuadre.totalPointOfSale} />

                <CollapsibleSection title="Gastos" open={gastosOpen} setOpen={setGastosOpen} total={cuadre.totalGastos.bs} items={cuadre.gastosDetails.filter((g: any) => Number(g.amount_bs) > 0)} currency="bs" taqSessionIds={taqSessionIds} />
                <CollapsibleSection title="Deudas" open={deudasOpen} setOpen={setDeudasOpen} total={cuadre.totalDeudas.bs} items={cuadre.deudasDetails.filter((d: any) => Number(d.amount_bs) > 0)} currency="bs" taqSessionIds={taqSessionIds} />

                <Row label={`Excedente USD (${uiTotals.excessUsd.toFixed(2)})`} value={uiTotals.excessUsd * parseFloat(formState.exchangeRate)} type="bs" hidden={!formState.applyExcessUsd} />
                <Row label="Menos: Adicional" value={-(parseFloat(formState.additionalAmountBs) || 0)} type="bs" className="text-destructive" />

                <Separator />
                <Row label="Sumatoria Total" value={uiTotals.sumatoriaBolivares} type="bs" bold />
              </div>

              <div className="space-y-2 text-sm border p-4 rounded-lg bg-muted/30">
                <Row label="Sumatoria" value={uiTotals.sumatoriaBolivares} type="bs" />
                <CollapsibleTotalBanco open={bancoBsOpen} setOpen={setBancoBsOpen} total={uiTotals.totalBanco} pagoMovilRecibidos={cuadre.pagoMovilRecibidos} pagoMovilPagados={cuadre.pagoMovilPagados} totalPointOfSale={cuadre.totalPointOfSale} />
                <CuadreVPRow open={cuadreVPBsOpen} setOpen={setCuadreVPBsOpen} cuadre={uiTotals.cuadreVentasPremios.bs} ventas={cuadre.totalSales.bs} premios={cuadre.totalPrizes.bs} type="bs" />
                <Row label="Diferencia Cierre" value={uiTotals.sumatoriaBolivares - uiTotals.cuadreVentasPremios.bs} type="bs" />
                <Row label="Menos: Premios Pendientes" value={-(parseFloat(formState.pendingPrizes) || 0)} type="bs" />
                <Separator />
                <ResultCard value={uiTotals.diferenciaFinal} type="bs" />
              </div>
            </div>

            {/* Comparación USD */}
            <div className="space-y-4">
              <h4 className="font-semibold text-purple-600">Resumen Dólares</h4>
              <div className="space-y-2 text-sm border p-4 rounded-lg">
                <Row label="Efectivo Disponible" value={parseFloat(formState.cashAvailableUsd) || 0} type="usd" />
                <CollapsibleSection title="Gastos" open={gastosUsdOpen} setOpen={setGastosUsdOpen} total={cuadre.totalGastos.usd} items={cuadre.gastosDetails.filter((g: any) => Number(g.amount_usd) > 0)} currency="usd" taqSessionIds={taqSessionIds} />
                <CollapsibleSection title="Deudas" open={deudasUsdOpen} setOpen={setDeudasUsdOpen} total={cuadre.totalDeudas.usd} items={cuadre.deudasDetails.filter((d: any) => Number(d.amount_usd) > 0)} currency="usd" taqSessionIds={taqSessionIds} />
                <Separator />
                <Row label="Sumatoria Total" value={uiTotals.sumatoriaUsd} type="usd" bold />
              </div>

              <div className="space-y-2 text-sm border p-4 rounded-lg bg-purple-50/30">
                <Row label="Sumatoria" value={uiTotals.sumatoriaUsd} type="usd" />
                <CollapsibleTotalBanco open={bancoUsdOpen} setOpen={setBancoUsdOpen} total={uiTotals.totalBanco} pagoMovilRecibidos={cuadre.pagoMovilRecibidos} pagoMovilPagados={cuadre.pagoMovilPagados} totalPointOfSale={cuadre.totalPointOfSale} />
                <CuadreVPRow open={cuadreVPUsdOpen} setOpen={setCuadreVPUsdOpen} cuadre={uiTotals.cuadreVentasPremios.usd} ventas={cuadre.totalSales.usd} premios={cuadre.totalPrizes.usd} type="usd" />
                <Row label="Menos: Adicional" value={-(parseFloat(formState.additionalAmountUsd) || 0)} type="usd" />
                <Row label="Menos: Premios Pendientes" value={-(parseFloat(formState.pendingPrizesUsd) || 0)} type="usd" />
                <Separator />
                <ResultCard value={uiTotals.diferenciaFinalUsd} type="usd" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Indicadores Taquillera (espejo de Indicadores Principales con datos de taquillera) */}
      {taqTotals && (taquilleraTotals.sales.bs > 0 || taquilleraTotals.sales.usd > 0) && (
        <Card className="border-2 border-amber-500/30 bg-gradient-to-br from-amber-50/20 to-orange-50/10 dark:from-amber-950/10 dark:to-orange-950/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
              <Calculator className="h-5 w-5" />
              Indicadores Taquillera
            </CardTitle>
            <p className="text-xs text-muted-foreground">Resumen calculado con los datos registrados por la taquillera.</p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <IndicatorCard title="Cuadre (V-P) Bs" value={taqTotals.cuadreVentasPremios.bs} type="bs" icon={TrendingUp} color="blue" />
              <IndicatorCard title="Cuadre (V-P) USD" value={taqTotals.cuadreVentasPremios.usd} type="usd" icon={TrendingUp} color="purple" />
              <IndicatorCard title="Total en Banco" value={taqTotals.totalBanco} type="bs" icon={TrendingUp} color="emerald" />
              <IndicatorCard title="Premios por Pagar" value={taquilleraIndicators!.pendingPrizesBs} type="bs" icon={TrendingDown} color="amber" />
            </div>

            <Separator className="my-6" />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Resumen Bs - Taquillera */}
              <div className="space-y-4">
                <h4 className="font-semibold text-amber-700 dark:text-amber-400">Resumen Bolívares</h4>
                <div className="space-y-2 text-sm border border-amber-200 dark:border-amber-800 p-4 rounded-lg">
                  <Row label="Efectivo del día" value={taquilleraIndicators!.cashBs} type="bs" />
                  <CollapsibleTotalBanco open={taqBancoBsOpen} setOpen={setTaqBancoBsOpen} total={taqTotals.totalBanco} pagoMovilRecibidos={taquilleraIndicators!.pagoMovilRecibidos} pagoMovilPagados={taquilleraIndicators!.pagoMovilPagados} totalPointOfSale={taquilleraIndicators!.totalPointOfSale} />
                  <CollapsibleSection title="Gastos" open={taqGastosBsOpen} setOpen={setTaqGastosBsOpen} total={taquilleraIndicators!.gastos.bs} items={cuadre.gastosDetails.filter((g: any) => Number(g.amount_bs) > 0 && taqSessionIds.has(g.session_id))} currency="bs" taqSessionIds={taqSessionIds} />
                  <CollapsibleSection title="Deudas" open={taqDeudasBsOpen} setOpen={setTaqDeudasBsOpen} total={taquilleraIndicators!.deudas.bs} items={cuadre.deudasDetails.filter((d: any) => Number(d.amount_bs) > 0 && taqSessionIds.has(d.session_id))} currency="bs" taqSessionIds={taqSessionIds} />
                  <Row label={`Excedente USD (${taqTotals.excessUsd.toFixed(2)})`} value={taqTotals.excessUsd * taquilleraIndicators!.exchangeRate} type="bs" hidden={!taquilleraIndicators!.applyExcessUsd} />
                  <Row label="Menos: Adicional" value={-(taquilleraIndicators!.additionalAmountBs)} type="bs" className="text-destructive" />
                  <Separator />
                  <Row label="Sumatoria Total" value={taqTotals.sumatoriaBolivares} type="bs" bold />
                </div>

                <div className="space-y-2 text-sm border border-amber-200 dark:border-amber-800 p-4 rounded-lg bg-amber-50/30 dark:bg-amber-950/10">
                  <Row label="Sumatoria" value={taqTotals.sumatoriaBolivares} type="bs" />
                  <CollapsibleTotalBanco open={taqBancoBsOpen} setOpen={setTaqBancoBsOpen} total={taqTotals.totalBanco} pagoMovilRecibidos={taquilleraIndicators!.pagoMovilRecibidos} pagoMovilPagados={taquilleraIndicators!.pagoMovilPagados} totalPointOfSale={taquilleraIndicators!.totalPointOfSale} />
                  <CuadreVPRow open={taqCuadreVPBsOpen} setOpen={setTaqCuadreVPBsOpen} cuadre={taqTotals.cuadreVentasPremios.bs} ventas={taquilleraIndicators!.sales.bs} premios={taquilleraIndicators!.prizes.bs} type="bs" />
                  <Row label="Diferencia Cierre" value={taqTotals.sumatoriaBolivares - taqTotals.cuadreVentasPremios.bs} type="bs" />
                  <Row label="Menos: Premios Pendientes" value={-(taquilleraIndicators!.pendingPrizesBs)} type="bs" />
                  <Separator />
                  <ResultCard value={taqTotals.diferenciaFinal} type="bs" />
                </div>
              </div>

              {/* Resumen USD - Taquillera */}
              <div className="space-y-4">
                <h4 className="font-semibold text-purple-600">Resumen Dólares</h4>
                <div className="space-y-2 text-sm border border-amber-200 dark:border-amber-800 p-4 rounded-lg">
                  <Row label="Efectivo Disponible" value={taquilleraIndicators!.cashUsd} type="usd" />
                  <CollapsibleSection title="Gastos" open={taqGastosUsdOpen} setOpen={setTaqGastosUsdOpen} total={taquilleraIndicators!.gastos.usd} items={cuadre.gastosDetails.filter((g: any) => Number(g.amount_usd) > 0 && taqSessionIds.has(g.session_id))} currency="usd" taqSessionIds={taqSessionIds} />
                  <CollapsibleSection title="Deudas" open={taqDeudasUsdOpen} setOpen={setTaqDeudasUsdOpen} total={taquilleraIndicators!.deudas.usd} items={cuadre.deudasDetails.filter((d: any) => Number(d.amount_usd) > 0 && taqSessionIds.has(d.session_id))} currency="usd" taqSessionIds={taqSessionIds} />
                  <Separator />
                  <Row label="Sumatoria Total" value={taqTotals.sumatoriaUsd} type="usd" bold />
                </div>

                <div className="space-y-2 text-sm border border-amber-200 dark:border-amber-800 p-4 rounded-lg bg-purple-50/30">
                  <Row label="Sumatoria" value={taqTotals.sumatoriaUsd} type="usd" />
                  <CollapsibleTotalBanco open={taqBancoUsdOpen} setOpen={setTaqBancoUsdOpen} total={taqTotals.totalBanco} pagoMovilRecibidos={taquilleraIndicators!.pagoMovilRecibidos} pagoMovilPagados={taquilleraIndicators!.pagoMovilPagados} totalPointOfSale={taquilleraIndicators!.totalPointOfSale} />
                  <CuadreVPRow open={taqCuadreVPUsdOpen} setOpen={setTaqCuadreVPUsdOpen} cuadre={taqTotals.cuadreVentasPremios.usd} ventas={taquilleraIndicators!.sales.usd} premios={taquilleraIndicators!.prizes.usd} type="usd" />
                  <Row label="Menos: Adicional" value={-(taquilleraIndicators!.additionalAmountUsd)} type="usd" />
                  <Row label="Menos: Premios Pendientes" value={-(taquilleraIndicators!.pendingPrizesUsd)} type="usd" />
                  <Separator />
                  <ResultCard value={taqTotals.diferenciaFinalUsd} type="usd" />
                </div>
              </div>
            </div>
            {/* Diferencias detectadas */}
            {(Math.abs(cuadre.totalSales.bs - taquilleraTotals.sales.bs) > 0.01 || Math.abs(cuadre.totalSales.usd - taquilleraTotals.sales.usd) > 0.01 || Math.abs(cuadre.totalPrizes.bs - taquilleraTotals.prizes.bs) > 0.01 || Math.abs(cuadre.totalPrizes.usd - taquilleraTotals.prizes.usd) > 0.01) && (
              <div className="mt-4 p-3 rounded-lg border-2 border-amber-400/50 bg-amber-50/50 dark:bg-amber-950/20">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <span className="text-sm font-semibold text-amber-700 dark:text-amber-400">Diferencias detectadas</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                  <DiffBadge label="Ventas Bs" diff={cuadre.totalSales.bs - taquilleraTotals.sales.bs} type="bs" />
                  <DiffBadge label="Ventas USD" diff={cuadre.totalSales.usd - taquilleraTotals.sales.usd} type="usd" />
                  <DiffBadge label="Premios Bs" diff={cuadre.totalPrizes.bs - taquilleraTotals.prizes.bs} type="bs" />
                  <DiffBadge label="Premios USD" diff={cuadre.totalPrizes.usd - taquilleraTotals.prizes.usd} type="usd" />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

// Helper Components

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

const CollapsibleSection = ({ title, open, setOpen, total, items, currency = 'bs', taqSessionIds }: any) => {
  const isUsd = currency === 'usd';
  const currencyCode = isUsd ? 'USD' : 'VES';
  const amountKey = isUsd ? 'amount_usd' : 'amount_bs';
  const encargadaAmountKey = isUsd ? 'encargada_amount_usd' : 'encargada_amount_bs';

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <div className="flex justify-between items-center cursor-pointer hover:bg-muted/50 rounded p-1 transition-colors">
          <span className="flex items-center gap-1 text-muted-foreground">
            {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            {title}
          </span>
          <span className="font-mono">{formatCurrency(total, currencyCode)}</span>
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="ml-4 mt-1 space-y-1 text-xs text-muted-foreground border-l-2 pl-2">
          {items.length === 0 ? <p>No hay registros</p> : items.map((i: any, idx: number) => {
            const isEncargada = !i.session_id;
            return (
              <div key={idx} className="flex justify-between items-center gap-2">
                <span className="flex items-center gap-1 flex-1 min-w-0">
                  <span className="truncate">{i.description}</span>
                  <span className={`shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${
                    isEncargada
                      ? 'bg-primary/10 text-primary border-primary/30'
                      : 'bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800'
                  }`}>
                    {isEncargada ? 'Encargada' : 'Taquillera'}
                  </span>
                </span>
                <div className="flex flex-col items-end">
                  <span className="font-mono shrink-0">{formatCurrency(i[encargadaAmountKey] ?? i[amountKey], currencyCode)}</span>
                  {i[encargadaAmountKey] !== undefined && i[encargadaAmountKey] !== null && (
                    <span className="text-[9px] text-yellow-600 dark:text-yellow-500 line-through">
                      {formatCurrency(i[amountKey], currencyCode)}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};

const DiffBadge = ({ label, diff, type }: { label: string; diff: number; type: 'bs' | 'usd' }) => {
  if (Math.abs(diff) < 0.01) return null;
  const isPositive = diff > 0;
  return (
    <div className={`p-2 rounded text-center ${isPositive ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-red-100 dark:bg-red-900/30'}`}>
      <p className="text-muted-foreground">{label}</p>
      <p className={`font-mono font-bold ${isPositive ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>
        {isPositive ? '+' : ''}{formatCurrency(diff, type === 'bs' ? 'VES' : 'USD')}
      </p>
    </div>
  );
};

const CollapsibleTotalBanco = ({ open, setOpen, total, pagoMovilRecibidos, pagoMovilPagados, totalPointOfSale }: {
  open: boolean;
  setOpen: (v: boolean) => void;
  total: number;
  pagoMovilRecibidos: number;
  pagoMovilPagados: number;
  totalPointOfSale: number;
}) => (
  <Collapsible open={open} onOpenChange={setOpen}>
    <CollapsibleTrigger asChild>
      <div className="flex justify-between items-center cursor-pointer hover:bg-muted/50 rounded p-1 transition-colors">
        <span className="flex items-center gap-1 text-muted-foreground">
          {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          Total en Banco
        </span>
        <span className="font-mono">{formatCurrency(total, 'VES')}</span>
      </div>
    </CollapsibleTrigger>
    <CollapsibleContent>
      <div className="ml-4 mt-1 space-y-1 text-xs text-muted-foreground border-l-2 pl-2">
        <div className="flex justify-between">
          <span>Pago Móvil Recibidos</span>
          <span className="font-mono">{formatCurrency(pagoMovilRecibidos, 'VES')}</span>
        </div>
        {pagoMovilPagados > 0 && (
          <div className="flex justify-between">
            <span className="text-destructive">Pago Móvil Pagados</span>
            <span className="font-mono text-destructive">- {formatCurrency(pagoMovilPagados, 'VES')}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span>Punto de Venta</span>
          <span className="font-mono">{formatCurrency(totalPointOfSale, 'VES')}</span>
        </div>
      </div>
    </CollapsibleContent>
  </Collapsible>
);

const CuadreVPRow = ({ open, setOpen, cuadre, ventas, premios, type }: {
  open: boolean;
  setOpen: (v: boolean) => void;
  cuadre: number;
  ventas: number;
  premios: number;
  type: 'bs' | 'usd';
}) => {
  const curr = type === 'bs' ? 'VES' : 'USD';
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <div className="flex justify-between items-center cursor-pointer hover:bg-muted/50 rounded p-1 transition-colors">
          <span className="flex items-center gap-1 text-muted-foreground">
            {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            Cuadre (V-P)
          </span>
          <span className="font-mono">{formatCurrency(cuadre, curr)}</span>
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="ml-4 mt-1 space-y-1 text-xs text-muted-foreground border-l-2 pl-2">
          <div className="flex justify-between">
            <span>Ventas</span>
            <span className="font-mono">{formatCurrency(ventas, curr)}</span>
          </div>
          <div className="flex justify-between">
            <span>Premios</span>
            <span className="font-mono text-destructive">- {formatCurrency(premios, curr)}</span>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};