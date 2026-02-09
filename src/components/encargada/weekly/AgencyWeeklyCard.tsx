import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DollarSign, TrendingDown, TrendingUp, Building2, ListTree, Receipt, AlertCircle, Settings, Gift } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import type { AgencyWeeklySummary } from "@/hooks/useWeeklyCuadre";
import { PerSystemTable } from "./PerSystemTable";
import { ExpensesTable } from "./ExpensesTable";
import { PendingPrizesTable } from "./PendingPrizesTable";
import { WeeklyCuadreConfigForm } from "./WeeklyCuadreConfigForm";
import { GastosManagerEncargada } from "../GastosManagerEncargada";

interface Props {
  summary: AgencyWeeklySummary;
  weekStart: Date;
  weekEnd: Date;
  onConfigSuccess?: () => void;
  saveSystemTotals: (params: {
    agencyId: string;
    weekStart: Date;
    weekEnd: Date;
    systems: any[];
    userId: string;
    notes?: string;
  }) => Promise<void>;
}

export function AgencyWeeklyCard({ summary, weekStart, weekEnd, onConfigSuccess, saveSystemTotals }: Props) {
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
        <CardContent className="pt-6">
          <Tabs defaultValue="resumen" className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-6">
              <TabsTrigger value="resumen">Resumen</TabsTrigger>
              <TabsTrigger value="registrar">
                <Receipt className="h-4 w-4 mr-2" />
                Registrar
              </TabsTrigger>
              <TabsTrigger value="config">
                <Settings className="h-4 w-4 mr-2" />
                Configuración
              </TabsTrigger>
            </TabsList>

            <TabsContent value="resumen" className="space-y-6">
              {/* Indicadores principales - Grid limpio */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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

                {/* Deudas */}
                <div className="relative p-5 rounded-xl bg-gradient-to-br from-red-500/10 to-red-500/5 border-2 border-red-500/20">
                  <div className="flex items-start justify-between mb-2">
                    <div className="p-2 bg-red-500/10 rounded-lg">
                      <AlertCircle className="h-5 w-5 text-red-600" />
                    </div>
                    <Badge variant="destructive" className="text-[10px] h-5">
                      {summary.deudas_details.length}
                    </Badge>
                  </div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                    Deudas
                  </p>
                  <div className="space-y-0.5">
                    <p className="text-xl font-bold text-red-600 font-mono">
                      {formatCurrency(summary.total_deudas_bs, "VES")}
                    </p>
                    {summary.total_deudas_usd > 0 && (
                      <p className="text-sm font-semibold text-red-600/70 font-mono">
                        {formatCurrency(summary.total_deudas_usd, "USD")}
                      </p>
                    )}
                  </div>
                </div>

                {/* Gastos */}
                <div className="relative p-5 rounded-xl bg-gradient-to-br from-orange-500/10 to-orange-500/5 border-2 border-orange-500/20">
                  <div className="flex items-start justify-between mb-2">
                    <div className="p-2 bg-orange-500/10 rounded-lg">
                      <Receipt className="h-5 w-5 text-orange-600" />
                    </div>
                    <Badge variant="outline" className="text-[10px] h-5 border-orange-500/50 text-orange-600">
                      {summary.gastos_details.length}
                    </Badge>
                  </div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                    Gastos
                  </p>
                  <div className="space-y-0.5">
                    <p className="text-xl font-bold text-orange-600 font-mono">
                      {formatCurrency(summary.total_gastos_bs, "VES")}
                    </p>
                    {summary.total_gastos_usd > 0 && (
                      <p className="text-sm font-semibold text-orange-600/70 font-mono">
                        {formatCurrency(summary.total_gastos_usd, "USD")}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <Separator />

              {/* Ventas y Premios - Layout compacto */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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

                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <Gift className="h-3.5 w-3.5" />
                    Premios por Pagar
                  </h4>
                  <div className="space-y-2 pl-1">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Bolívares</span>
                      <span className="font-mono font-semibold text-sm">
                        {formatCurrency(summary.premios_por_pagar_bs, "VES")}
                      </span>
                    </div>
                    {summary.premios_por_pagar_usd > 0 && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Dólares</span>
                        <span className="font-mono font-semibold text-sm">
                          {formatCurrency(summary.premios_por_pagar_usd, "USD")}
                        </span>
                      </div>
                    )}
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
                      <span className="font-semibold">Detalle por Sistema</span>
                      <Badge variant="secondary" className="ml-2 text-xs">
                        {summary.per_system.length}
                      </Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pt-4">
                    <PerSystemTable
                      data={summary.per_system}
                      agencyId={summary.agency_id}
                      weekStart={weekStart}
                      weekEnd={weekEnd}
                      onSave={onConfigSuccess}
                      saveSystemTotals={saveSystemTotals}
                    />
                  </AccordionContent>
                </AccordionItem>

                {/* Gastos operativos */}
                <AccordionItem value="gastos" className="border rounded-lg px-4">
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center gap-2">
                      <Receipt className="h-4 w-4 text-orange-600" />
                      <span className="font-semibold">Gastos Operativos</span>
                      <Badge variant="outline" className="ml-2 text-xs border-orange-500/50 text-orange-600">
                        {summary.gastos_details.length}
                      </Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pt-4">
                    <ExpensesTable expenses={summary.gastos_details} title="Gastos" onPaidChange={onConfigSuccess} />
                  </AccordionContent>
                </AccordionItem>

                {/* Deudas */}
                <AccordionItem value="deudas" className="border rounded-lg px-4">
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-red-600" />
                      <span className="font-semibold">Deudas</span>
                      <Badge variant="destructive" className="ml-2 text-xs">
                        {summary.deudas_details.length}
                      </Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pt-4">
                    <ExpensesTable expenses={summary.deudas_details} title="Deudas" onPaidChange={onConfigSuccess} />
                  </AccordionContent>
                </AccordionItem>

                {/* Premios por pagar */}
                <AccordionItem value="premios-por-pagar" className="border rounded-lg px-4">
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center gap-2">
                      <Gift className="h-4 w-4 text-purple-600" />
                      <span className="font-semibold">Premios por Pagar</span>
                      <Badge variant="outline" className="ml-2 text-xs border-purple-500/50 text-purple-600">
                        {summary.premios_por_pagar_details.length}
                      </Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pt-4">
                    <PendingPrizesTable prizes={summary.premios_por_pagar_details} onPaidChange={onConfigSuccess} />
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </TabsContent>

            <TabsContent value="registrar" className="space-y-6">
              <GastosManagerEncargada
                selectedAgency={summary.agency_id}
                selectedDate={new Date(weekStart)}
                onSuccess={onConfigSuccess}
              />
            </TabsContent>

            <TabsContent value="config">
              <WeeklyCuadreConfigForm
                summary={summary}
                weekStart={weekStart}
                weekEnd={weekEnd}
                onSuccess={onConfigSuccess}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      )}
    </Card>
  );
}
