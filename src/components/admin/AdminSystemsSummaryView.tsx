import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChevronLeft, ChevronRight, Calculator, ChevronDown, ChevronUp, DollarSign, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useWeeklyCuadre, type WeekBoundaries } from "@/hooks/useWeeklyCuadre";
import { useSystemCommissions } from "@/hooks/useSystemCommissions";
import { formatCurrency } from "@/lib/utils";
import { format, addDays, startOfWeek, endOfWeek } from "date-fns";
import { es } from "date-fns/locale";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface SystemSummary {
  system_id: string;
  system_name: string;
  sales_bs: number;
  sales_usd: number;
  prizes_bs: number;
  prizes_usd: number;
  commission_percentage_bs: number;
  commission_percentage_usd: number;
  utility_percentage_bs: number;
  utility_percentage_usd: number;
  total_bs: number;
  total_usd: number;
  hasSubcategories: boolean;
  subcategories?: SystemSummary[]; // Subcategorías individuales
}

interface LotterySystem {
  id: string;
  name: string;
  parent_system_id: string | null;
  has_subcategories: boolean | null;
}

export function AdminSystemsSummaryView() {
  const [currentWeek, setCurrentWeek] = useState<WeekBoundaries | null>(null);
  const [currency, setCurrency] = useState<"bs" | "usd">("bs");
  const [expandedSystems, setExpandedSystems] = useState<Set<string>>(new Set());
  const [lotterySystems, setLotterySystems] = useState<LotterySystem[]>([]);
  const { summaries, loading: summariesLoading } = useWeeklyCuadre(currentWeek);
  const { commissions, loading: commissionsLoading } = useSystemCommissions();

  const toggleSystem = (systemId: string) => {
    const newExpanded = new Set(expandedSystems);
    if (newExpanded.has(systemId)) {
      newExpanded.delete(systemId);
    } else {
      newExpanded.add(systemId);
    }
    setExpandedSystems(newExpanded);
  };

  useEffect(() => {
    // Calculate current week starting on Monday
    const today = new Date();
    const weekStart = startOfWeek(today, { weekStartsOn: 1 }); // 1 = Monday
    const weekEnd = endOfWeek(today, { weekStartsOn: 1 });

    setCurrentWeek({
      start: weekStart,
      end: weekEnd,
    });

    // Fetch lottery systems to filter subcategories
    const fetchLotterySystems = async () => {
      const { data, error } = await supabase
        .from("lottery_systems")
        .select("id, name, parent_system_id, has_subcategories")
        .eq("is_active", true);

      if (error) {
        console.error("Error fetching lottery systems:", error);
      } else {
        setLotterySystems(data || []);
      }
    };

    fetchLotterySystems();
  }, []);

  const navigateWeek = (direction: "prev" | "next") => {
    if (!currentWeek) return;

    const daysToAdd = direction === "next" ? 7 : -7;
    const newStart = addDays(currentWeek.start, daysToAdd);
    const newEnd = addDays(currentWeek.end, daysToAdd);

    setCurrentWeek({ start: newStart, end: newEnd });
  };

  // Aggregate data by system across all agencies, keeping parent and subcategory data separate
  const systemsData = useMemo(() => {
    const parentSystemsMap = new Map<string, SystemSummary>();
    const subcategoriesMap = new Map<string, SystemSummary[]>(); // parent_id -> subcategories
    const systemIdToParentMap = new Map<string, string>();

    // Build mapping: subcategory -> parent and get parent systems
    lotterySystems.forEach((sys) => {
      if (sys.parent_system_id) {
        systemIdToParentMap.set(sys.id, sys.parent_system_id);
      }
    });

    // Initialize parent systems
    lotterySystems.forEach((sys) => {
      if (!sys.parent_system_id) {
        const commission = commissions.get(sys.id);
        parentSystemsMap.set(sys.id, {
          system_id: sys.id,
          system_name: sys.name,
          sales_bs: 0,
          sales_usd: 0,
          prizes_bs: 0,
          prizes_usd: 0,
          commission_percentage_bs: commission?.commission_percentage || 0,
          commission_percentage_usd: commission?.commission_percentage_usd || 0,
          utility_percentage_bs: commission?.utility_percentage || 0,
          utility_percentage_usd: commission?.utility_percentage_usd || 0,
          total_bs: 0,
          total_usd: 0,
          hasSubcategories: sys.has_subcategories || false,
          subcategories: [],
        });
      }
    });

    // Process summaries data
    summaries.forEach((summary) => {
      summary.per_system.forEach((sys) => {
        const parentId = systemIdToParentMap.get(sys.system_id);
        
        if (parentId) {
          // This is a subcategory - add to parent and to subcategories list
          const parent = parentSystemsMap.get(parentId);
          if (parent) {
            // Add to parent totals
            parent.sales_bs += sys.sales_bs;
            parent.sales_usd += sys.sales_usd;
            parent.prizes_bs += sys.prizes_bs;
            parent.prizes_usd += sys.prizes_usd;

            // Add to subcategories list
            if (!subcategoriesMap.has(parentId)) {
              subcategoriesMap.set(parentId, []);
            }
            
            const subcategoryList = subcategoriesMap.get(parentId)!;
            let subcategory = subcategoryList.find(s => s.system_id === sys.system_id);
            
            if (!subcategory) {
              // Get commission for the subcategory (individual commission)
              const subCommission = commissions.get(sys.system_id);
              subcategory = {
                system_id: sys.system_id,
                system_name: sys.system_name,
                sales_bs: 0,
                sales_usd: 0,
                prizes_bs: 0,
                prizes_usd: 0,
                commission_percentage_bs: subCommission?.commission_percentage || 0,
                commission_percentage_usd: subCommission?.commission_percentage_usd || 0,
                utility_percentage_bs: subCommission?.utility_percentage || 0,
                utility_percentage_usd: subCommission?.utility_percentage_usd || 0,
                total_bs: 0,
                total_usd: 0,
                hasSubcategories: false,
              };
              subcategoryList.push(subcategory);
            }
            
            subcategory.sales_bs += sys.sales_bs;
            subcategory.sales_usd += sys.sales_usd;
            subcategory.prizes_bs += sys.prizes_bs;
            subcategory.prizes_usd += sys.prizes_usd;
          }
        } else {
          // This is a parent system or system without subcategories
          const parent = parentSystemsMap.get(sys.system_id);
          if (parent) {
            parent.sales_bs += sys.sales_bs;
            parent.sales_usd += sys.sales_usd;
            parent.prizes_bs += sys.prizes_bs;
            parent.prizes_usd += sys.prizes_usd;
          }
        }
      });
    });

    // Calculate totals with commission applied
    // El porcentaje se aplica sobre las ventas, no sobre (ventas - premios)
    parentSystemsMap.forEach((system) => {
      system.total_bs = system.sales_bs * (system.commission_percentage_bs / 100);
      system.total_usd = system.sales_usd * (system.commission_percentage_usd / 100);
      
      // Add subcategories to parent
      if (system.hasSubcategories) {
        const subcats = subcategoriesMap.get(system.system_id) || [];
        subcats.forEach((sub) => {
          sub.total_bs = sub.sales_bs * (sub.commission_percentage_bs / 100);
          sub.total_usd = sub.sales_usd * (sub.commission_percentage_usd / 100);
        });
        system.subcategories = subcats.sort((a, b) => a.system_name.localeCompare(b.system_name));
      }
    });

    return Array.from(parentSystemsMap.values()).sort((a, b) => a.system_name.localeCompare(b.system_name));
  }, [summaries, commissions, lotterySystems]);

  // Calculate grand totals
  const grandTotals = useMemo(() => {
    return systemsData.reduce(
      (acc, sys) => {
        const subtotal_bs = sys.sales_bs - sys.prizes_bs - sys.total_bs;
        const subtotal_usd = sys.sales_usd - sys.prizes_usd - sys.total_usd;
        const participation_bs = subtotal_bs * (sys.utility_percentage_bs / 100);
        const participation_usd = subtotal_usd * (sys.utility_percentage_usd / 100);
        const final_total_bs = subtotal_bs - participation_bs;
        const final_total_usd = subtotal_usd - participation_usd;

        acc.sales_bs += sys.sales_bs;
        acc.sales_usd += sys.sales_usd;
        acc.prizes_bs += sys.prizes_bs;
        acc.prizes_usd += sys.prizes_usd;
        acc.commission_bs += sys.total_bs; // total_bs es la comisión
        acc.commission_usd += sys.total_usd; // total_usd es la comisión
        acc.subtotal_bs += subtotal_bs;
        acc.subtotal_usd += subtotal_usd;
        acc.participation_bs += participation_bs;
        acc.participation_usd += participation_usd;
        acc.final_total_bs += final_total_bs;
        acc.final_total_usd += final_total_usd;
        return acc;
      },
      { 
        sales_bs: 0, sales_usd: 0, prizes_bs: 0, prizes_usd: 0, 
        commission_bs: 0, commission_usd: 0, 
        subtotal_bs: 0, subtotal_usd: 0,
        participation_bs: 0, participation_usd: 0,
        final_total_bs: 0, final_total_usd: 0
      }
    );
  }, [systemsData]);

  const loading = summariesLoading || commissionsLoading;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <h2 className="text-xl font-semibold">Cargando resumen de sistemas...</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Resumen por Sistemas</h1>
          <p className="text-muted-foreground">Ventas y premios agregados por sistema aplicando % BS</p>
        </div>
      </div>

      {currentWeek && (
        <>
          {/* Cuadros de resumen de utilidades */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Ganancia por Utilidad en Bolívares */}
            <Card className="border-2 border-purple-500/20 bg-gradient-to-br from-purple-500/10 to-purple-500/5">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between mb-2">
                  <div className="p-2 bg-purple-500/10 rounded-lg">
                    <DollarSign className="h-5 w-5 text-purple-600" />
                  </div>
                </div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                  Ganancia por Utilidad (Bs)
                </p>
                <p className="text-2xl font-bold text-purple-600 font-mono">
                  {formatCurrency(grandTotals.participation_bs, "VES")}
                </p>
              </CardContent>
            </Card>

            {/* Ganancia por Utilidad en Dólares */}
            <Card className="border-2 border-blue-500/20 bg-gradient-to-br from-blue-500/10 to-blue-500/5">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between mb-2">
                  <div className="p-2 bg-blue-500/10 rounded-lg">
                    <DollarSign className="h-5 w-5 text-blue-600" />
                  </div>
                </div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                  Ganancia por Utilidad (USD)
                </p>
                <p className="text-2xl font-bold text-blue-600 font-mono">
                  {formatCurrency(grandTotals.participation_usd, "USD")}
                </p>
              </CardContent>
            </Card>

            {/* Total de Utilidades */}
            <Card className="border-2 border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 to-emerald-500/5">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between mb-2">
                  <div className="p-2 bg-emerald-500/10 rounded-lg">
                    <TrendingUp className="h-5 w-5 text-emerald-600" />
                  </div>
                </div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                  Total Utilidades
                </p>
                <div className="space-y-0.5">
                  <p className="text-xl font-bold text-emerald-600 font-mono">
                    {formatCurrency(grandTotals.participation_bs, "VES")}
                  </p>
                  <p className="text-sm font-semibold text-emerald-600/70 font-mono">
                    {formatCurrency(grandTotals.participation_usd, "USD")}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <Button variant="outline" size="sm" onClick={() => navigateWeek("prev")}>
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Anterior
                </Button>
                <CardTitle className="text-center">
                  {format(currentWeek.start, "d 'de' MMMM", { locale: es })} -{" "}
                  {format(currentWeek.end, "d 'de' MMMM, yyyy", { locale: es })}
                </CardTitle>
                <Button variant="outline" size="sm" onClick={() => navigateWeek("next")}>
                  Siguiente
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
              <Tabs value={currency} onValueChange={(value) => setCurrency(value as "bs" | "usd")} className="w-full mt-4">
                <TabsList className="grid w-full max-w-md mx-auto grid-cols-2">
                  <TabsTrigger value="bs">Bolívares</TabsTrigger>
                  <TabsTrigger value="usd">Dólares</TabsTrigger>
                </TabsList>
              </Tabs>
            </CardHeader>
            <CardContent>
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="font-bold">Sistema</TableHead>
                    <TableHead className="text-right font-bold">{currency === "bs" ? "Ventas Bs" : "Ventas USD"}</TableHead>
                    <TableHead className="text-right font-bold">{currency === "bs" ? "Premios Bs" : "Premios USD"}</TableHead>
                    <TableHead className="text-right font-bold">% Comisión</TableHead>
                    <TableHead className="text-right font-bold bg-yellow-500/20">{currency === "bs" ? "Comisión Bs" : "Comisión USD"}</TableHead>
                    <TableHead className="text-right font-bold">% Participación</TableHead>
                    <TableHead className="text-right font-bold bg-purple-500/20">{currency === "bs" ? "Participación Bs" : "Participación USD"}</TableHead>
                     <TableHead className="text-right font-bold font-semibold">{currency === "bs" ? "SUB TOTAL Bs" : "SUB TOTAL USD"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {systemsData.map((sys) => {
                    const sales = currency === "bs" ? sys.sales_bs : sys.sales_usd;
                    const prizes = currency === "bs" ? sys.prizes_bs : sys.prizes_usd;
                    const net = sales - prizes;
                    const commission = currency === "bs" ? sys.total_bs : sys.total_usd;
                    const subtotal = net - commission;
                    const commissionPercentage = currency === "bs" ? sys.commission_percentage_bs : sys.commission_percentage_usd;
                    const utilityPercentage = currency === "bs" ? sys.utility_percentage_bs : sys.utility_percentage_usd;
                    const participation = subtotal * (utilityPercentage / 100);
                    const finalTotal = subtotal - participation;
                    const isExpanded = expandedSystems.has(sys.system_id);
                    const hasSubs = sys.hasSubcategories && sys.subcategories && sys.subcategories.length > 0;

                    return (
                      <>
                        <TableRow key={sys.system_id} className={hasSubs ? "cursor-pointer hover:bg-muted/50" : ""}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              {hasSubs && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => toggleSystem(sys.system_id)}
                                  className="h-6 w-6 p-0"
                                >
                                  {isExpanded ? (
                                    <ChevronDown className="h-4 w-4" />
                                  ) : (
                                    <ChevronRight className="h-4 w-4" />
                                  )}
                                </Button>
                              )}
                              {!hasSubs && <span className="w-6" />}
                              <span>{sys.system_name}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-mono text-green-600">
                            {currency === "bs" ? formatCurrency(sales, "VES") : formatCurrency(sales, "USD")}
                          </TableCell>
                          <TableCell className="text-right font-mono text-red-600">
                            {currency === "bs" ? formatCurrency(prizes, "VES") : formatCurrency(prizes, "USD")}
                          </TableCell>
                          <TableCell className="text-right font-mono text-muted-foreground">
                            {commissionPercentage.toFixed(2)}%
                          </TableCell>
                          <TableCell className="text-right font-mono font-bold bg-yellow-500/20">
                            {currency === "bs" ? formatCurrency(commission, "VES") : formatCurrency(commission, "USD")}
                          </TableCell>
                          <TableCell className="text-right font-mono text-muted-foreground">
                            {utilityPercentage.toFixed(2)}%
                          </TableCell>
                          <TableCell className="text-right font-mono font-bold bg-purple-500/20">
                            {currency === "bs" ? formatCurrency(participation, "VES") : formatCurrency(participation, "USD")}
                          </TableCell>
                          <TableCell className="text-right font-mono font-semibold text-primary">
                            {currency === "bs" ? formatCurrency(subtotal, "VES") : formatCurrency(subtotal, "USD")}
                          </TableCell>
                        </TableRow>
                        {/* Subcategorías */}
                        {hasSubs && isExpanded && sys.subcategories?.map((sub) => {
                          const subSales = currency === "bs" ? sub.sales_bs : sub.sales_usd;
                          const subPrizes = currency === "bs" ? sub.prizes_bs : sub.prizes_usd;
                          const subNet = subSales - subPrizes;
                          const subCommission = currency === "bs" ? sub.total_bs : sub.total_usd;
                          const subSubtotal = subNet - subCommission;
                          const subCommissionPercentage = currency === "bs" ? sub.commission_percentage_bs : sub.commission_percentage_usd;

                          return (
                            <TableRow key={sub.system_id} className="bg-muted/30">
                              <TableCell className="font-medium pl-12 text-sm text-muted-foreground">
                                {sub.system_name}
                              </TableCell>
                              <TableCell className="text-right font-mono text-green-600 text-sm">
                                {currency === "bs" ? formatCurrency(subSales, "VES") : formatCurrency(subSales, "USD")}
                              </TableCell>
                              <TableCell className="text-right font-mono text-red-600 text-sm">
                                {currency === "bs" ? formatCurrency(subPrizes, "VES") : formatCurrency(subPrizes, "USD")}
                              </TableCell>
                              <TableCell className="text-right font-mono text-muted-foreground text-sm">
                                {subCommissionPercentage.toFixed(2)}%
                              </TableCell>
                              <TableCell className="text-right font-mono font-bold bg-yellow-500/20 text-sm">
                                {currency === "bs" ? formatCurrency(subCommission, "VES") : formatCurrency(subCommission, "USD")}
                              </TableCell>
                              <TableCell className="text-right text-sm">-</TableCell>
                              <TableCell className="text-right text-sm">-</TableCell>
                              <TableCell className="text-right font-mono font-semibold text-primary text-sm">
                                {currency === "bs" ? formatCurrency(subSubtotal, "VES") : formatCurrency(subSubtotal, "USD")}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </>
                    );
                  })}

                  {/* Fila de totales */}
                  <TableRow className="bg-primary/10 font-bold border-t-2">
                    <TableCell className="font-bold">TOTALES</TableCell>
                    <TableCell className="text-right font-mono text-green-600">
                      {currency === "bs" ? formatCurrency(grandTotals.sales_bs, "VES") : formatCurrency(grandTotals.sales_usd, "USD")}
                    </TableCell>
                    <TableCell className="text-right font-mono text-red-600">
                      {currency === "bs" ? formatCurrency(grandTotals.prizes_bs, "VES") : formatCurrency(grandTotals.prizes_usd, "USD")}
                    </TableCell>
                    <TableCell className="text-right">-</TableCell>
                    <TableCell className="text-right font-mono font-bold bg-yellow-500/20">
                      {currency === "bs" ? formatCurrency(grandTotals.commission_bs, "VES") : formatCurrency(grandTotals.commission_usd, "USD")}
                    </TableCell>
                    <TableCell className="text-right">-</TableCell>
                    <TableCell className="text-right font-mono font-bold bg-purple-500/20">
                      {currency === "bs" ? formatCurrency(grandTotals.participation_bs, "VES") : formatCurrency(grandTotals.participation_usd, "USD")}
                    </TableCell>
                    <TableCell className="text-right font-mono font-semibold text-primary">
                      {currency === "bs" ? formatCurrency(grandTotals.subtotal_bs, "VES") : formatCurrency(grandTotals.subtotal_usd, "USD")}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>

            {systemsData.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No hay datos disponibles para esta semana
              </div>
            )}
          </CardContent>
        </Card>
        </>
      )}
    </div>
  );
}
