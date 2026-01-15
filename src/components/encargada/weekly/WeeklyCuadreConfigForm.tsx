import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Save, Calculator, Landmark } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { format } from "date-fns";
import type { AgencyWeeklySummary } from "@/hooks/useWeeklyCuadre";

interface WeeklyCuadreConfigFormProps {
  summary: AgencyWeeklySummary;
  weekStart: Date;
  weekEnd: Date;
  onSuccess?: () => void;
}

export function WeeklyCuadreConfigForm({
  summary,
  weekStart,
  weekEnd,
  onSuccess,
}: WeeklyCuadreConfigFormProps) {
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const { user } = useAuth();

  // Input states for editable fields
  const [exchangeRateInput, setExchangeRateInput] = useState<string>("36.00");
  const [cashAvailableInput, setCashAvailableInput] = useState<string>("0");
  const [cashAvailableUsdInput, setCashAvailableUsdInput] = useState<string>("0");
  const [closureNotesInput, setClosureNotesInput] = useState<string>("");
  const [additionalAmountBsInput, setAdditionalAmountBsInput] = useState<string>("0");
  const [additionalAmountUsdInput, setAdditionalAmountUsdInput] = useState<string>("0");
  const [additionalNotesInput, setAdditionalNotesInput] = useState<string>("");
  const [depositBsInput, setDepositBsInput] = useState<string>("0");
  const [applyExcessUsdSwitch, setApplyExcessUsdSwitch] = useState<boolean>(true);

  // Ref to track if we've already initialized from storage/db for this key
  const initializedKeyRef = useRef<string | null>(null);

  // Persistence key based on agency and week
  const persistKey = user?.id 
    ? `weekly-cuadre-config:${user.id}:${summary.agency_id}:${format(weekStart, 'yyyy-MM-dd')}` 
    : null;

  // Persist form data to localStorage on changes
  const persistData = useCallback(() => {
    if (!persistKey || loadingData) return;
    const data = {
      exchangeRateInput,
      cashAvailableInput,
      cashAvailableUsdInput,
      closureNotesInput,
      additionalAmountBsInput,
      additionalAmountUsdInput,
      additionalNotesInput,
      applyExcessUsdSwitch,
      depositBsInput,
    };
    try {
      localStorage.setItem(persistKey, JSON.stringify(data));
    } catch (e) {
      // Ignore localStorage errors
    }
  }, [persistKey, loadingData, exchangeRateInput, cashAvailableInput, cashAvailableUsdInput, closureNotesInput, additionalAmountBsInput, additionalAmountUsdInput, additionalNotesInput, applyExcessUsdSwitch, depositBsInput]);

  // Save to localStorage on every change (only after initial load)
  useEffect(() => {
    if (!loadingData && initializedKeyRef.current === persistKey) {
      persistData();
    }
  }, [persistData, loadingData, persistKey]);

  // Clear persisted data after successful save
  const clearPersistedData = useCallback(() => {
    if (!persistKey) return;
    try {
      localStorage.removeItem(persistKey);
      // Reset initialized ref so next load comes from DB
      initializedKeyRef.current = null;
    } catch (e) {
      // Ignore
    }
  }, [persistKey]);

  // Load data only when the agency/week changes, not on every remount
  useEffect(() => {
    const currentKey = persistKey;
    
    // Skip if already initialized for this key (prevents reload on tab switch)
    if (initializedKeyRef.current === currentKey) {
      setLoadingData(false);
      return;
    }
    
    loadExistingConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persistKey]);

  const loadExistingConfig = async () => {
    try {
      setLoadingData(true);
      const weekStartStr = format(weekStart, "yyyy-MM-dd");
      const weekEndStr = format(weekEnd, "yyyy-MM-dd");
      const storageKey = persistKey;
      
      // Check for persisted data first
      if (storageKey) {
        try {
          const persisted = localStorage.getItem(storageKey);
          if (persisted) {
            const parsed = JSON.parse(persisted);
            // Check if there's meaningful data (any non-default value)
            const hasData = parsed.cashAvailableInput !== "0" || 
                           parsed.cashAvailableUsdInput !== "0" ||
                           parsed.additionalAmountBsInput !== "0" ||
                           parsed.additionalAmountUsdInput !== "0" ||
                           parsed.depositBsInput !== "0" ||
                           parsed.closureNotesInput ||
                           parsed.additionalNotesInput ||
                           (parsed.exchangeRateInput && parsed.exchangeRateInput !== "36.00");
            
            if (hasData) {
              // Restore from persisted data
              setExchangeRateInput(parsed.exchangeRateInput || "36.00");
              setCashAvailableInput(parsed.cashAvailableInput || "0");
              setCashAvailableUsdInput(parsed.cashAvailableUsdInput || "0");
              setClosureNotesInput(parsed.closureNotesInput || "");
              setAdditionalAmountBsInput(parsed.additionalAmountBsInput || "0");
              setAdditionalAmountUsdInput(parsed.additionalAmountUsdInput || "0");
              setAdditionalNotesInput(parsed.additionalNotesInput || "");
              setApplyExcessUsdSwitch(parsed.applyExcessUsdSwitch ?? true);
              setDepositBsInput(parsed.depositBsInput || "0");
              // Mark as initialized for this key
              initializedKeyRef.current = storageKey;
              return; // Don't load from DB, use persisted data
            }
          }
        } catch (e) {
          // Ignore localStorage errors
        }
      }

      const { data, error } = await supabase
        .from("weekly_cuadre_config")
        .select("*")
        .eq("agency_id", summary.agency_id)
        .eq("week_start_date", weekStartStr)
        .eq("week_end_date", weekEndStr)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setExchangeRateInput(Number(data.exchange_rate).toFixed(2));
        setCashAvailableInput(Number(data.cash_available_bs).toFixed(2));
        setCashAvailableUsdInput(Number(data.cash_available_usd).toFixed(2));
        setClosureNotesInput(data.closure_notes || "");
        setAdditionalAmountBsInput(Number(data.additional_amount_bs || 0).toFixed(2));
        setAdditionalAmountUsdInput(Number(data.additional_amount_usd || 0).toFixed(2));
        setAdditionalNotesInput(data.additional_notes || "");
        setApplyExcessUsdSwitch(data.apply_excess_usd ?? true);
        setDepositBsInput(Number(data.deposit_bs || 0).toFixed(2));
      }
      
      // Mark as initialized for this key
      initializedKeyRef.current = storageKey;
    } catch (error) {
      console.error("Error loading config:", error);
    } finally {
      setLoadingData(false);
    }
  };

  const handleSave = async () => {
    if (!user?.id) {
      toast.error("Usuario no autenticado");
      return;
    }

    try {
      setLoading(true);
      const weekStartStr = format(weekStart, "yyyy-MM-dd");
      const weekEndStr = format(weekEnd, "yyyy-MM-dd");

      const exchangeRate = parseFloat(exchangeRateInput) || 36;
      const cashAvailableBs = parseFloat(cashAvailableInput) || 0;
      const cashAvailableUsd = parseFloat(cashAvailableUsdInput) || 0;
      const additionalAmountBs = parseFloat(additionalAmountBsInput) || 0;
      const additionalAmountUsd = parseFloat(additionalAmountUsdInput) || 0;
      const depositBs = parseFloat(depositBsInput) || 0;

      // Calculate excess USD and final difference (same logic as daily cuadre)
      const sumatoriaUsd = cashAvailableUsd + summary.total_deudas_usd + summary.total_gastos_usd;
      const diferenciaInicialUsd = sumatoriaUsd - summary.total_cuadre_usd;
      const diferenciaFinalUsd = diferenciaInicialUsd - additionalAmountUsd;
      const excessUsd = diferenciaFinalUsd;

      // Calculate Bolivares sumatoria (deposit is added to bank total)
      const totalBancoConDeposito = summary.total_banco_bs + depositBs;
      const sumatoriaBolivares =
        cashAvailableBs +
        totalBancoConDeposito +
        summary.total_deudas_bs +
        summary.total_gastos_bs +
        (applyExcessUsdSwitch ? excessUsd * exchangeRate : 0) -
        additionalAmountBs;

      const diferenciaCierre = sumatoriaBolivares - summary.total_cuadre_bs;
      const diferenciaFinal = diferenciaCierre - summary.premios_por_pagar_bs;

      const configData = {
        agency_id: summary.agency_id,
        week_start_date: weekStartStr,
        week_end_date: weekEndStr,
        exchange_rate: exchangeRate,
        cash_available_bs: cashAvailableBs,
        cash_available_usd: cashAvailableUsd,
        closure_notes: closureNotesInput,
        additional_amount_bs: additionalAmountBs,
        additional_amount_usd: additionalAmountUsd,
        additional_notes: additionalNotesInput,
        apply_excess_usd: applyExcessUsdSwitch,
        deposit_bs: depositBs,
        excess_usd: excessUsd,
        final_difference: diferenciaFinal,
        created_by: user.id,
      };

      const { data: savedRows, error } = await supabase
        .from("weekly_cuadre_config")
        .upsert(configData, {
          onConflict: "agency_id,week_start_date,week_end_date",
        })
        .select("id, deposit_bs");

      if (error) throw error;
      if (!savedRows || savedRows.length === 0) {
        throw new Error("No se pudo confirmar el guardado de la configuración semanal");
      }

      // Clear persisted data after successful save
      clearPersistedData();

      // Notificar a otras vistas (ej: Bolívares en Banco) para refrescar si están en la misma semana
      window.dispatchEvent(
        new CustomEvent("cuadre-saved", {
          detail: {
            week_start_date: weekStartStr,
            week_end_date: weekEndStr,
            agency_id: summary.agency_id,
          },
        })
      );

      toast.success("Configuración guardada correctamente");
      onSuccess?.();
    } catch (error: any) {
      console.error("Error saving config:", error);
      toast.error(error.message || "Error al guardar la configuración");
    } finally {
      setLoading(false);
    }
  };

  if (loadingData) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-muted-foreground">Cargando configuración...</p>
        </CardContent>
      </Card>
    );
  }

  // Parse numeric values for calculations
  const exchangeRate = parseFloat(exchangeRateInput) || 36;
  const cashAvailableBs = parseFloat(cashAvailableInput) || 0;
  const cashAvailableUsd = parseFloat(cashAvailableUsdInput) || 0;
  const additionalAmountBs = parseFloat(additionalAmountBsInput) || 0;
  const additionalAmountUsd = parseFloat(additionalAmountUsdInput) || 0;
  const depositBs = parseFloat(depositBsInput) || 0;

  // Calculate excess USD (same formula as daily cuadre)
  const sumatoriaUsd = cashAvailableUsd + summary.total_deudas_usd + summary.total_gastos_usd;
  const diferenciaInicialUsd = sumatoriaUsd - summary.total_cuadre_usd;
  const diferenciaFinalUsd = diferenciaInicialUsd - additionalAmountUsd;
  const excessUsd = diferenciaFinalUsd;

  // Calculate Bolivares sumatoria (deposit is added to bank total)
  const totalBancoConDeposito = summary.total_banco_bs + depositBs;
  const sumatoriaBolivares =
    cashAvailableBs +
    totalBancoConDeposito +
    summary.total_deudas_bs +
    summary.total_gastos_bs +
    (applyExcessUsdSwitch ? excessUsd * exchangeRate : 0) -
    additionalAmountBs;

  const diferenciaCierre = sumatoriaBolivares - summary.total_cuadre_bs;
  const diferenciaFinal = diferenciaCierre - summary.premios_por_pagar_bs;
  const isCuadreBalanced = Math.abs(diferenciaFinal) <= 100;

  return (
    <div className="space-y-6">
      {/* Exchange Rate Display */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="pt-4">
          <div className="text-center space-y-2">
            <div className="text-lg">💱</div>
            <p className="text-sm text-muted-foreground">
              Tasa del Domingo: <span className="font-bold">{summary.sunday_exchange_rate.toFixed(2)} Bs por USD</span>
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Editable Fields */}
      <Card className="border-2 border-primary/30 bg-gradient-to-br from-primary/5 to-accent/10">
        <CardHeader className="pb-4">
          <CardTitle className="text-primary flex items-center gap-2">
            <Save className="h-5 w-5" />
            Configuración del Cuadre Semanal
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Main Fields */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="exchange-rate" className="font-semibold">
                Tasa BCV (Bs/$)
              </Label>
              <Input
                id="exchange-rate"
                type="number"
                step="0.01"
                value={exchangeRateInput}
                onChange={(e) => setExchangeRateInput(e.target.value)}
                className="text-center font-mono text-lg"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cash-bs" className="font-semibold">
                Efectivo Disponible (Bs)
              </Label>
              <Input
                id="cash-bs"
                type="number"
                step="0.01"
                value={cashAvailableInput}
                onChange={(e) => setCashAvailableInput(e.target.value)}
                className="text-center font-mono text-lg"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cash-usd" className="font-semibold">
                Efectivo Disponible (USD)
              </Label>
              <Input
                id="cash-usd"
                type="number"
                step="0.01"
                value={cashAvailableUsdInput}
                onChange={(e) => setCashAvailableUsdInput(e.target.value)}
                className="text-center font-mono text-lg"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Textarea
              id="closure-notes"
              value={closureNotesInput}
              onChange={(e) => setClosureNotesInput(e.target.value)}
              placeholder="Observaciones de la semana..."
              className="min-h-[80px]"
            />
          </div>

          <Separator className="my-4" />

          {/* Additional Adjustments Section */}
          <div className="space-y-4 p-4 rounded-lg bg-card border border-border">
            <h4 className="font-semibold flex items-center gap-2">
              <Calculator className="h-4 w-4" />
              Ajustes Adicionales del Cuadre
            </h4>

            {/* Apply Excess USD Switch */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-accent/20 border border-accent/40">
              <div className="space-y-1">
                <Label htmlFor="apply-excess-usd" className="font-medium cursor-pointer">
                  Aplicar excedente USD a bolívares
                </Label>
                <p className="text-xs text-muted-foreground">
                  Incluir la diferencia de USD convertida en el cálculo de Bs
                </p>
              </div>
              <Switch
                id="apply-excess-usd"
                checked={applyExcessUsdSwitch}
                onCheckedChange={setApplyExcessUsdSwitch}
              />
            </div>

            {/* Additional Amounts */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="additional-amount-bs" className="font-medium">
                  Monto Adicional (Bs)
                </Label>
                <Input
                  id="additional-amount-bs"
                  type="number"
                  step="0.01"
                  value={additionalAmountBsInput}
                  onChange={(e) => setAdditionalAmountBsInput(e.target.value)}
                  placeholder="Ej: dinero que se debía"
                  className="font-mono"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="additional-amount-usd" className="font-medium">
                  Monto Adicional (USD)
                </Label>
                <Input
                  id="additional-amount-usd"
                  type="number"
                  step="0.01"
                  value={additionalAmountUsdInput}
                  onChange={(e) => setAdditionalAmountUsdInput(e.target.value)}
                  placeholder="Ej: dinero que se debía"
                  className="font-mono"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="additional-notes" className="font-medium">
                Descripción del Monto Adicional
              </Label>
              <Textarea
                id="additional-notes"
                value={additionalNotesInput}
                onChange={(e) => setAdditionalNotesInput(e.target.value)}
                placeholder="Ej: Dinero que se debía de semanas anteriores..."
                className="min-h-[60px]"
              />
            </div>

            {/* Deposit Section */}
            <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30 space-y-3">
              <h5 className="font-semibold text-emerald-700 flex items-center gap-2">
                <Landmark className="h-4 w-4" />
                Depósito Bancario
              </h5>
              <div className="space-y-2">
                <Label htmlFor="deposit-bs" className="font-medium">
                  Depósito (Bs)
                </Label>
                <Input
                  id="deposit-bs"
                  type="number"
                  step="0.01"
                  value={depositBsInput}
                  onChange={(e) => setDepositBsInput(e.target.value)}
                  placeholder="Monto depositado en banco..."
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground">
                  Este monto se sumará al total en banco de la semana
                </p>
              </div>
            </div>
          </div>

          <Button onClick={handleSave} disabled={loading} className="w-full mt-4" size="lg">
            <Save className="h-4 w-4 mr-2" />
            {loading ? "Guardando..." : "Guardar Configuración Semanal"}
          </Button>
        </CardContent>
      </Card>

      {/* Summary Cards - Similar to daily cuadre */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Resumen en Bolívares */}
        <Card className="border-2">
          <CardHeader className="pb-3 bg-gradient-to-br from-emerald-500/10 to-emerald-500/5">
            <CardTitle className="text-lg font-bold text-emerald-700">Resumen en Bolívares</CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="space-y-3">
              <div className="flex justify-between items-center hover:bg-accent/50 p-2 rounded transition-colors">
                <span className="text-sm font-medium">Efectivo Disponible:</span>
                <span className="font-mono font-semibold">{formatCurrency(cashAvailableBs, "VES")}</span>
              </div>
              <div className="flex justify-between items-center hover:bg-accent/50 p-2 rounded transition-colors">
                <span className="text-sm font-medium">Total en Banco:</span>
                <span className="font-mono font-semibold">{formatCurrency(totalBancoConDeposito, "VES")}</span>
              </div>
              {depositBs !== 0 && (
                <div className="flex justify-between items-center hover:bg-accent/50 p-2 rounded transition-colors">
                  <span className="text-sm font-medium text-emerald-700">Depósito:</span>
                  <span className="font-mono font-semibold text-emerald-600">{formatCurrency(depositBs, "VES")}</span>
                </div>
              )}
              <div className="flex justify-between items-center hover:bg-accent/50 p-2 rounded transition-colors">
                <span className="text-sm font-medium">Deudas:</span>
                <span className="font-mono font-semibold">{formatCurrency(summary.total_deudas_bs, "VES")}</span>
              </div>
              <div className="flex justify-between items-center hover:bg-accent/50 p-2 rounded transition-colors">
                <span className="text-sm font-medium">Gastos:</span>
                <span className="font-mono font-semibold">{formatCurrency(summary.total_gastos_bs, "VES")}</span>
              </div>
              {applyExcessUsdSwitch && (
                <div className="flex justify-between items-center hover:bg-accent/50 p-2 rounded transition-colors">
                  <span className="text-sm font-medium">Excedente USD convertido:</span>
                  <span className="font-mono font-semibold">
                    {formatCurrency(excessUsd * exchangeRate, "VES")}
                  </span>
                </div>
              )}
              {additionalAmountBs !== 0 && (
                <div className="flex justify-between items-center hover:bg-accent/50 p-2 rounded transition-colors">
                  <span className="text-sm font-medium">Menos: Monto Adicional:</span>
                  <span className="font-mono font-semibold text-destructive">-{formatCurrency(additionalAmountBs, "VES")}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between items-center hover:bg-accent/50 p-2 rounded transition-colors">
                <span className="text-sm font-bold">Sumatoria Bs:</span>
                <span className="font-mono font-bold text-base">{formatCurrency(sumatoriaBolivares, "VES")}</span>
              </div>
              <div className="flex justify-between items-center hover:bg-accent/50 p-2 rounded transition-colors">
                <span className="text-sm font-bold">Cuadre (V-P) Bs:</span>
                <span className="font-mono font-bold text-base">{formatCurrency(summary.total_cuadre_bs, "VES")}</span>
              </div>
              <Separator className="my-2" />
              <div className="flex justify-between items-center p-3 rounded-lg bg-gradient-to-r from-blue-500/10 to-blue-500/5 border border-blue-500/20">
                <span className="font-bold">Diferencia de Cierre:</span>
                <span
                  className={`font-mono font-bold text-lg ${
                    diferenciaCierre >= 0 ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {formatCurrency(diferenciaCierre, "VES")}
                </span>
              </div>
              <div className="flex justify-between items-center hover:bg-accent/50 p-2 rounded transition-colors">
                <span className="text-sm font-medium">Premios por Pagar:</span>
                <span className="font-mono font-semibold">-{formatCurrency(summary.premios_por_pagar_bs, "VES")}</span>
              </div>
              <Separator className="my-2" />
              <div
                className={`flex justify-between items-center p-4 rounded-lg font-bold text-xl ${
                  isCuadreBalanced
                    ? "bg-gradient-to-r from-green-500/20 to-green-500/10 border-2 border-green-500/30"
                    : "bg-gradient-to-r from-red-500/20 to-red-500/10 border-2 border-red-500/30"
                }`}
              >
                <span>Diferencia Final:</span>
                <span className={`font-mono ${isCuadreBalanced ? "text-green-600" : "text-red-600"}`}>
                  {formatCurrency(diferenciaFinal, "VES")}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Resumen en Dólares */}
        <Card className="border-2">
          <CardHeader className="pb-3 bg-gradient-to-br from-blue-500/10 to-blue-500/5">
            <CardTitle className="text-lg font-bold text-blue-700">Resumen en Dólares</CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="space-y-3">
              <div className="flex justify-between items-center hover:bg-accent/50 p-2 rounded transition-colors">
                <span className="text-sm font-medium">Efectivo Disponible:</span>
                <span className="font-mono font-semibold">{formatCurrency(cashAvailableUsd, "USD")}</span>
              </div>
              <div className="flex justify-between items-center hover:bg-accent/50 p-2 rounded transition-colors">
                <span className="text-sm font-medium">Deudas:</span>
                <span className="font-mono font-semibold">{formatCurrency(summary.total_deudas_usd, "USD")}</span>
              </div>
              <div className="flex justify-between items-center hover:bg-accent/50 p-2 rounded transition-colors">
                <span className="text-sm font-medium">Gastos:</span>
                <span className="font-mono font-semibold">{formatCurrency(summary.total_gastos_usd, "USD")}</span>
              </div>
              <Separator />
              <div className="flex justify-between items-center hover:bg-accent/50 p-2 rounded transition-colors">
                <span className="text-sm font-bold">Sumatoria USD:</span>
                <span className="font-mono font-bold text-base">{formatCurrency(sumatoriaUsd, "USD")}</span>
              </div>
              <div className="flex justify-between items-center hover:bg-accent/50 p-2 rounded transition-colors">
                <span className="text-sm font-bold">Cuadre (V-P) USD:</span>
                <span className="font-mono font-bold text-base">{formatCurrency(summary.total_cuadre_usd, "USD")}</span>
              </div>
              <Separator className="my-2" />
              <div className="flex justify-between items-center p-3 rounded-lg bg-gradient-to-r from-blue-500/10 to-blue-500/5 border border-blue-500/20">
                <span className="font-bold">Diferencia Inicial USD:</span>
                <span
                  className={`font-mono font-bold text-lg ${
                    diferenciaInicialUsd >= 0 ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {formatCurrency(diferenciaInicialUsd, "USD")}
                </span>
              </div>
              {additionalAmountUsd !== 0 && (
                <div className="flex justify-between items-center hover:bg-accent/50 p-2 rounded transition-colors">
                  <span className="text-sm font-medium">Monto Adicional:</span>
                  <span className="font-mono font-semibold">-{formatCurrency(additionalAmountUsd, "USD")}</span>
                </div>
              )}
              <Separator className="my-2" />
              <div
                className={`flex justify-between items-center p-4 rounded-lg font-bold text-xl ${
                  Math.abs(excessUsd) <= 1
                    ? "bg-gradient-to-r from-green-500/20 to-green-500/10 border-2 border-green-500/30"
                    : "bg-gradient-to-r from-amber-500/20 to-amber-500/10 border-2 border-amber-500/30"
                }`}
              >
                <span>Excedente USD:</span>
                <span className={`font-mono ${Math.abs(excessUsd) <= 1 ? "text-green-600" : "text-amber-600"}`}>
                  {formatCurrency(excessUsd, "USD")}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
