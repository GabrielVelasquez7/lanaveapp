import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Separator } from "@/components/ui/separator";
import { DollarSign, TrendingDown, TrendingUp, Building2, ListTree } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import type { AgencyWeeklySummary } from "@/hooks/useWeeklyCuadre";
import type { CommissionRate } from "@/hooks/useSystemCommissions";
import { AdminPerSystemTable } from "./AdminPerSystemTable";

interface Props {
  summary: AgencyWeeklySummary;
  commissions: Map<string, CommissionRate>;
}

export function AdminAgencyWeeklyCard({ summary, commissions }: Props) {
  const depositBs = summary.deposit_bs ?? 0;
  const totalBancoConDeposito = summary.total_banco_bs + depositBs;

  const hasActivity =
    summary.total_sales_bs > 0 ||
    summary.total_sales_usd > 0 ||
    summary.total_prizes_bs > 0 ||
    summary.total_prizes_usd > 0 ||
    summary.total_deudas_bs > 0 ||
    summary.total_gastos_bs > 0 ||
    summary.total_banco_bs > 0 ||
    depositBs !== 0;

  // Calculate total commissions
  const totalCommissions = summary.per_system.reduce((acc, sys) => {
    const commission = commissions.get(sys.system_id);
    
    if (commission) {
      acc.bs += sys.sales_bs * (commission.commission_percentage / 100);
      acc.usd += sys.sales_usd * (commission.commission_percentage_usd / 100);
    }
    
    return acc;
  }, { bs: 0, usd: 0 });

  // Config closure data
  const finalDiff = summary.weekly_config_final_difference ?? 0;
  const isCuadreBalanced = Math.abs(finalDiff) <= 100;
  const excessUsd = summary.weekly_config_excess_usd ?? 0;

  return (
    <Card className="overflow-hidden border-2 hover:shadow-lg transition-shadow">
      <CardHeader className="bg-gradient-to-br from-background via-muted/30 to-background pb-4">
        <div className="flex justify-between items-center">
          <div className="space-y-1">
            <CardTitle className="text-2xl flex items-center gap-2 font-bold">
              <Building2 className="h-6 w-6 text-primary" />
              {summary.agency_name}
            </CardTitle>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="font-medium">Tasa Domingo:</span>
              <span className="font-mono font-bold text-foreground">
                {formatCurrency(summary.sunday_exchange_rate, "VES")}
              </span>
            </div>
          </div>
          {!hasActivity && (
            <Badge variant="secondary" className="text-xs">
              Sin datos
            </Badge>
          )}
        </div>
      </CardHeader>

      {hasActivity && (
        <CardContent className="pt-6 space-y-6">
          {/* Indicadores principales - Grid limpio */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Total Cuadre */}
            <div className="relative p-5 rounded-xl bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-2 border-blue-500/20">
              <div className="flex items-start justify-between mb-2">
                <div className="p-2 bg-blue-500/10 rounded-lg">
                  <TrendingUp className="h-5 w-5 text-blue-600" />
                </div>
              </div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                Total Cuadre
              </p>
              <div className="space-y-0.5">
                <p className="text-2xl font-bold text-blue-600 font-mono">
                  {formatCurrency(summary.total_cuadre_bs, "VES")}
                </p>
                <p className="text-sm font-semibold text-blue-600/70 font-mono">
                  {formatCurrency(summary.total_cuadre_usd, "USD")}
                </p>
              </div>
            </div>

            {/* Total Comisiones */}
            <div className="relative p-5 rounded-xl bg-gradient-to-br from-yellow-500/10 to-yellow-500/5 border-2 border-yellow-500/20">
              <div className="flex items-start justify-between mb-2">
                <div className="p-2 bg-yellow-500/10 rounded-lg">
                  <DollarSign className="h-5 w-5 text-yellow-600" />
                </div>
              </div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                Total Comisiones
              </p>
              <div className="space-y-0.5">
                <p className="text-xl font-bold text-yellow-600 font-mono">
                  {formatCurrency(totalCommissions.bs, "VES")}
                </p>
                <p className="text-sm font-semibold text-yellow-600/70 font-mono">
                  {formatCurrency(totalCommissions.usd, "USD")}
                </p>
              </div>
            </div>

            {/* Total en banco */}
            <div className="relative p-5 rounded-xl bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border-2 border-emerald-500/20">
              <div className="flex items-start justify-between mb-2">
                <div className="p-2 bg-emerald-500/10 rounded-lg">
                  <DollarSign className="h-5 w-5 text-emerald-600" />
                </div>
              </div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                Total en Banco
              </p>
              <p className="text-2xl font-bold text-emerald-600 font-mono">
                {formatCurrency(totalBancoConDeposito, "VES")}
              </p>
              {depositBs !== 0 && (
                <p className="text-xs text-emerald-600/70 mt-1 font-mono">
                  Depósito: {formatCurrency(depositBs, "VES")}
                </p>
              )}
            </div>
          </div>

          <Separator />

          {/* Ganancias Netas - Destacado */}
          <Card className="bg-gradient-to-br from-purple-500/10 via-purple-500/5 to-background border-2 border-purple-500/30">
            <CardContent className="pt-6">
              <h3 className="text-lg font-bold text-purple-700 mb-4 flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Ganancias Netas
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Total Bruto (Comisiones)
                  </p>
                  <div className="space-y-0.5">
                    <p className="text-xl font-bold text-purple-600 font-mono">
                      {formatCurrency(totalCommissions.bs, "VES")}
                    </p>
                    <p className="text-sm font-semibold text-purple-600/70 font-mono">
                      {formatCurrency(totalCommissions.usd, "USD")}
                    </p>
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Total Gastos
                  </p>
                  <div className="space-y-0.5">
                    <p className="text-xl font-bold text-red-600 font-mono">
                      -{formatCurrency(summary.total_gastos_bs, "VES")}
                    </p>
                    <p className="text-sm font-semibold text-red-600/70 font-mono">
                      -{formatCurrency(summary.total_gastos_usd || 0, "USD")}
                    </p>
                  </div>
                </div>
                <div className="space-y-2 p-4 bg-purple-500/10 rounded-lg border border-purple-500/20">
                  <p className="text-xs font-bold text-purple-700 uppercase tracking-wide">
                    Total Neto
                  </p>
                  <div className="space-y-0.5">
                    <p className="text-2xl font-bold text-purple-700 font-mono">
                      {formatCurrency(totalCommissions.bs - summary.total_gastos_bs, "VES")}
                    </p>
                    <p className="text-sm font-semibold text-purple-700/70 font-mono">
                      {formatCurrency(totalCommissions.usd - (summary.total_gastos_usd || 0), "USD")}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Separator />

          {/* Ventas y Premios - Layout compacto */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <TrendingUp className="h-3.5 w-3.5" />
                Ventas
              </h4>
              <div className="space-y-2 pl-1">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Bolívares</span>
                  <span className="font-mono font-semibold text-sm">
                    {formatCurrency(summary.total_sales_bs, "VES")}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Dólares</span>
                  <span className="font-mono font-semibold text-sm">
                    {formatCurrency(summary.total_sales_usd, "USD")}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <TrendingDown className="h-3.5 w-3.5" />
                Premios
              </h4>
              <div className="space-y-2 pl-1">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Bolívares</span>
                  <span className="font-mono font-semibold text-sm">
                    {formatCurrency(summary.total_prizes_bs, "VES")}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Dólares</span>
                  <span className="font-mono font-semibold text-sm">
                    {formatCurrency(summary.total_prizes_usd, "USD")}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Acordeones para detalles */}
          <Accordion type="single" collapsible className="space-y-2">
            {/* Detalle por sistema */}
            <AccordionItem value="sistemas" className="border rounded-lg px-4">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-2">
                  <ListTree className="h-4 w-4" />
                  <span className="font-semibold">Detalle por Sistema (con Comisiones)</span>
                  <Badge variant="secondary" className="ml-2 text-xs">
                    {summary.per_system.length}
                  </Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-4">
                <AdminPerSystemTable data={summary.per_system} commissions={commissions} />
              </AccordionContent>
            </AccordionItem>

            {/* Cierre Semanal de la Encargada */}
            <AccordionItem value="cierre-encargada" className="border rounded-lg px-4">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-teal-600" />
                  <span className="font-semibold">Cierre Semanal (Encargada)</span>
                  {!summary.weekly_config_saved ? (
                    <Badge variant="outline" className="ml-2 text-xs text-muted-foreground">
                      Pendiente
                    </Badge>
                  ) : (
                    <Badge
                      variant={isCuadreBalanced ? "default" : "destructive"}
                      className="ml-2 text-xs"
                    >
                      {isCuadreBalanced ? "Cuadrado ✓" : "Descuadrado"}
                    </Badge>
                  )}
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-4">
                {!summary.weekly_config_saved ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    La encargada aún no ha guardado el cierre semanal.
                  </p>
                ) : (
                  <div className="space-y-5">
                    {/* Tasa BCV */}
                    <div className="flex justify-between items-center p-2 rounded hover:bg-accent/40 transition-colors">
                      <span className="text-sm font-medium text-muted-foreground">Tasa BCV usada</span>
                      <span className="font-mono font-bold">
                        {formatCurrency(summary.weekly_config_exchange_rate ?? 0, "VES")} / USD
                      </span>
                    </div>

                    <Separator />

                    {/* Efectivo disponible */}
                    <div className="space-y-2">
                      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Efectivo Disponible
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-center">
                          <p className="text-xs text-muted-foreground mb-1">Bolívares</p>
                          <p className="font-mono font-bold text-emerald-700">
                            {formatCurrency(summary.weekly_config_cash_bs ?? 0, "VES")}
                          </p>
                        </div>
                        <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-center">
                          <p className="text-xs text-muted-foreground mb-1">Dólares</p>
                          <p className="font-mono font-bold text-blue-700">
                            {formatCurrency(summary.weekly_config_cash_usd ?? 0, "USD")}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Montos Adicionales */}
                    {((summary.weekly_config_additional_bs ?? 0) !== 0 ||
                      (summary.weekly_config_additional_usd ?? 0) !== 0 ||
                      summary.weekly_config_additional_notes) && (
                      <div className="space-y-2">
                        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                          Montos Adicionales
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                          {(summary.weekly_config_additional_bs ?? 0) !== 0 && (
                            <div className="p-3 rounded-lg bg-orange-500/10 border border-orange-500/20 text-center">
                              <p className="text-xs text-muted-foreground mb-1">Bs</p>
                              <p className="font-mono font-bold text-orange-700">
                                {formatCurrency(summary.weekly_config_additional_bs ?? 0, "VES")}
                              </p>
                            </div>
                          )}
                          {(summary.weekly_config_additional_usd ?? 0) !== 0 && (
                            <div className="p-3 rounded-lg bg-orange-500/10 border border-orange-500/20 text-center">
                              <p className="text-xs text-muted-foreground mb-1">USD</p>
                              <p className="font-mono font-bold text-orange-700">
                                {formatCurrency(summary.weekly_config_additional_usd ?? 0, "USD")}
                              </p>
                            </div>
                          )}
                        </div>
                        {summary.weekly_config_additional_notes && (
                          <p className="text-xs text-muted-foreground italic px-1">
                            📝 {summary.weekly_config_additional_notes}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Excedente USD */}
                    <div className="flex justify-between items-center p-3 rounded-lg bg-accent/30 border border-border">
                      <span className="text-sm font-medium">Excedente USD</span>
                      <span
                        className={`font-mono font-bold ${
                          Math.abs(excessUsd) <= 1 ? "text-green-600" : "text-amber-600"
                        }`}
                      >
                        {formatCurrency(excessUsd, "USD")}
                      </span>
                    </div>

                    {/* Aplicar excedente USD */}
                    <div className="flex justify-between items-center p-2 rounded hover:bg-accent/40 transition-colors">
                      <span className="text-sm font-medium text-muted-foreground">
                        Aplica excedente USD a Bs
                      </span>
                      <Badge variant={summary.weekly_config_apply_excess_usd ? "default" : "secondary"}>
                        {summary.weekly_config_apply_excess_usd ? "Sí" : "No"}
                      </Badge>
                    </div>

                    <Separator />

                    {/* Diferencia Final */}
                    <div
                      className={`flex justify-between items-center p-4 rounded-xl font-bold text-lg border-2 ${
                        isCuadreBalanced
                          ? "bg-gradient-to-r from-green-500/20 to-green-500/10 border-green-500/40"
                          : "bg-gradient-to-r from-red-500/20 to-red-500/10 border-red-500/40"
                      }`}
                    >
                      <span>Diferencia Final</span>
                      <span
                        className={`font-mono text-xl ${
                          isCuadreBalanced ? "text-green-600" : "text-red-600"
                        }`}
                      >
                        {formatCurrency(finalDiff, "VES")}
                      </span>
                    </div>

                    {/* Notas de cierre */}
                    {summary.weekly_config_closure_notes && (
                      <div className="p-3 rounded-lg bg-muted/50 border border-border space-y-1">
                        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                          Observaciones de la encargada
                        </p>
                        <p className="text-sm">{summary.weekly_config_closure_notes}</p>
                      </div>
                    )}
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      )}
    </Card>
  );
}
