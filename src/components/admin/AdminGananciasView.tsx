import { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChevronLeft, ChevronRight, TrendingUp, DollarSign, Receipt, Calculator, ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useWeeklyCuadre, type WeekBoundaries } from "@/hooks/useWeeklyCuadre";
import { useSystemCommissions } from "@/hooks/useSystemCommissions";
import { formatCurrency } from "@/lib/utils";
import { format, addDays, startOfWeek, endOfWeek } from "date-fns";
import { es } from "date-fns/locale";

interface WeeklyBankExpense {
  id: string;
  category: string;
  amount_bs: number;
  amount_usd: number;
  description: string;
  agency_id: string | null;
  group_id: string | null;
}

interface AgencyGroup {
  id: string;
  name: string;
  description: string | null;
  is_client_group: boolean;
}

interface Agency {
  id: string;
  name: string;
  group_id: string | null;
}

interface BanqueoTransaction {
  id: string;
  client_id: string;
  week_start_date: string;
  week_end_date: string;
  lottery_system_id: string;
  sales_bs: number;
  sales_usd: number;
  prizes_bs: number;
  prizes_usd: number;
  participation_percentage: number;
  participation2_percentage: number;
}

export function AdminGananciasView() {
  const [currentWeek, setCurrentWeek] = useState<WeekBoundaries | null>(null);
  const [bankExpenses, setBankExpenses] = useState<WeeklyBankExpense[]>([]);
  const [agencyGroups, setAgencyGroups] = useState<AgencyGroup[]>([]);
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [banqueoTransactions, setBanqueoTransactions] = useState<BanqueoTransaction[]>([]);
  const [payrollTotal, setPayrollTotal] = useState<{ bs: number; usd: number }>({ bs: 0, usd: 0 });
  const [isGlobalExpensesOpen, setIsGlobalExpensesOpen] = useState(false);
  const [isProfitDistributionOpen, setIsProfitDistributionOpen] = useState(false);
  const [currency, setCurrency] = useState<"bs" | "usd">("bs");
  const [participation2Percentage, setParticipation2Percentage] = useState<number>(30);
  const { summaries, loading: summariesLoading } = useWeeklyCuadre(currentWeek);
  const { commissions, loading: commissionsLoading } = useSystemCommissions();

  useEffect(() => {
    // Calculate current week starting on Monday
    const today = new Date();
    const weekStart = startOfWeek(today, { weekStartsOn: 1 }); // 1 = Monday
    const weekEnd = endOfWeek(today, { weekStartsOn: 1 });

    setCurrentWeek({
      start: weekStart,
      end: weekEnd,
    });
  }, []);

  useEffect(() => {
    if (currentWeek) {
      fetchBankExpenses();
      fetchAgencyGroups();
      fetchAgencies();
      fetchBanqueoTransactions();
      fetchPayroll();
    }
  }, [currentWeek]);

  // Listen for payroll updates to refresh data
  useEffect(() => {
    const handlePayrollUpdate = (event: CustomEvent) => {
      // Check if the updated payroll is for the current week
      if (currentWeek) {
        const updatedWeekStart = format(event.detail.week_start_date, "yyyy-MM-dd");
        const currentWeekStart = format(currentWeek.start, "yyyy-MM-dd");
        if (updatedWeekStart === currentWeekStart) {
          fetchPayroll();
          fetchBankExpenses(); // Also refresh bank expenses in case there are changes
        }
      }
    };

    window.addEventListener('payroll-updated', handlePayrollUpdate as EventListener);
    return () => {
      window.removeEventListener('payroll-updated', handlePayrollUpdate as EventListener);
    };
  }, [currentWeek]);

  const fetchBankExpenses = async () => {
    if (!currentWeek) return;

    try {
      const startStr = format(currentWeek.start, "yyyy-MM-dd");
      const endStr = format(currentWeek.end, "yyyy-MM-dd");

      const { data, error } = await supabase
        .from("weekly_bank_expenses")
        .select("*")
        .gte("week_start_date", startStr)
        .lte("week_end_date", endStr);

      if (error) throw error;
      setBankExpenses(data || []);
    } catch (error) {
      console.error("Error fetching bank expenses:", error);
    }
  };

  const fetchAgencyGroups = async () => {
    try {
      const { data, error } = await supabase
        .from("agency_groups")
        .select("*")
        .eq("is_client_group", false)
        .order("name");

      if (error) throw error;
      setAgencyGroups(data || []);
    } catch (error) {
      console.error("Error fetching agency groups:", error);
    }
  };

  const fetchAgencies = async () => {
    try {
      const { data, error } = await supabase.from("agencies").select("id, name, group_id").eq("is_active", true);

      if (error) throw error;
      setAgencies(data || []);
    } catch (error) {
      console.error("Error fetching agencies:", error);
    }
  };

  const fetchBanqueoTransactions = async () => {
    if (!currentWeek) return;

    try {
      const startStr = format(currentWeek.start, "yyyy-MM-dd");
      const endStr = format(currentWeek.end, "yyyy-MM-dd");

      const { data, error } = await supabase
        .from("banqueo_transactions")
        .select("*")
        .eq("week_start_date", startStr)
        .eq("week_end_date", endStr);

      if (error) throw error;
      setBanqueoTransactions(data || []);
    } catch (error) {
      console.error("Error fetching banqueo transactions:", error);
    }
  };

  const fetchPayroll = async () => {
    if (!currentWeek) return;

    try {
      const startStr = format(currentWeek.start, "yyyy-MM-dd");

      const { data, error } = await supabase
        .from("weekly_payroll")
        .select("total_bs, total_usd, employee_id, week_start_date")
        .eq("week_start_date", startStr);

      if (error) throw error;
      
      const total = (data || []).reduce(
        (acc, entry) => {
          const bs = Number(entry.total_bs || 0);
          const usd = Number(entry.total_usd || 0);
          return {
            bs: acc.bs + bs,
            usd: acc.usd + usd,
          };
        },
        { bs: 0, usd: 0 }
      );
      setPayrollTotal(total);
    } catch (error) {
      console.error("Error fetching payroll:", error);
    }
  };

  const navigateWeek = (direction: "prev" | "next") => {
    if (!currentWeek) return;

    const daysToAdd = direction === "next" ? 7 : -7;
    const newStart = addDays(currentWeek.start, daysToAdd);
    const newEnd = addDays(currentWeek.end, daysToAdd);

    setCurrentWeek({ start: newStart, end: newEnd });
  };

  // Calculate total commissions (gross profit) across all agencies
  const totalGrossProfitBs = useMemo(() => {
    return summaries.reduce((total, summary) => {
      const agencyCommissions = summary.per_system.reduce((acc, sys) => {
        const commission = commissions.get(sys.system_id);
        if (commission) {
          acc += sys.sales_bs * (commission.commission_percentage / 100);
        }
        return acc;
      }, 0);
      return total + agencyCommissions;
    }, 0);
  }, [summaries, commissions]);

  const totalGrossProfitUsd = useMemo(() => {
    return summaries.reduce((total, summary) => {
      const agencyCommissions = summary.per_system.reduce((acc, sys) => {
        const commission = commissions.get(sys.system_id);
        if (commission) {
          acc += sys.sales_usd * (commission.commission_percentage_usd / 100);
        }
        return acc;
      }, 0);
      return total + agencyCommissions;
    }, 0);
  }, [summaries, commissions]);

  // Separate into two categories: fixed expenses (global) and group-specific expenses
  // Include payroll as a fixed expense (gasto fijo global)
  // Since we removed categories, all expenses with group_id = null are considered fixed expenses
  const {
    fixedCommissionsBs,
    fixedCommissionsUsd,
    groupSpecificExpenses,
    fixedCommissionsDetails,
  } = useMemo(() => {
    // Fixed expenses are those with group_id = null (global expenses)
    const fixedExpenses = bankExpenses.filter((e) => e.group_id === null);

    // Group-specific expenses
    const groupSpec = bankExpenses.filter((e) => e.group_id !== null);

    const totalFixedBs = fixedExpenses.reduce((sum, e) => sum + Number(e.amount_bs || 0), 0);
    const totalFixedUsd = fixedExpenses.reduce((sum, e) => sum + Number(e.amount_usd || 0), 0);
    
    // Add payroll to fixed expenses (nómina como gasto fijo global)
    const totalFixedWithPayrollBs = totalFixedBs + payrollTotal.bs;
    const totalFixedWithPayrollUsd = totalFixedUsd + payrollTotal.usd;

    return {
      fixedCommissionsBs: totalFixedWithPayrollBs,
      fixedCommissionsUsd: totalFixedWithPayrollUsd,
      groupSpecificExpenses: groupSpec,
      fixedCommissionsDetails: fixedExpenses,
    };
  }, [bankExpenses, payrollTotal]);

  // Calculate total net profit (gross profit - fixed commissions)
  const totalNetProfitBs = totalGrossProfitBs - fixedCommissionsBs;
  const totalNetProfitUsd = totalGrossProfitUsd - fixedCommissionsUsd;

  // Calculate total group-specific expenses
  const totalGroupExpensesBs = useMemo(() => {
    return groupSpecificExpenses.reduce((total, expense) => total + Number(expense.amount_bs || 0), 0);
  }, [groupSpecificExpenses]);
  const groupsData = useMemo(() => {
    // Total de gastos globales (todos los gastos fijos)
    const totalGlobalExpenses = fixedCommissionsBs;

    // Total number of agencies across all groups
    const totalAgenciesCount = agencies.length;

    // Global expense per agency (divided equally)
    const globalExpensePerAgency = totalAgenciesCount > 0 ? totalGlobalExpenses / totalAgenciesCount : 0;

    return agencyGroups.map((group) => {
      // Get agencies in this group
      const groupAgencies = agencies.filter((a) => a.group_id === group.id);
      const groupAgencyIds = groupAgencies.map((a) => a.id);
      const groupAgenciesCount = groupAgencies.length;

      // Get summaries for agencies in this group
      const groupSummaries = summaries.filter((s) => groupAgencyIds.includes(s.agency_id));

      // Calculate gross profit (commissions)
      const grossProfitBs = groupSummaries.reduce((total, summary) => {
        const agencyCommissions = summary.per_system.reduce((acc, sys) => {
          const commission = commissions.get(sys.system_id);
          if (commission) {
            acc += sys.sales_bs * (commission.commission_percentage / 100);
          }
          return acc;
        }, 0);
        return total + agencyCommissions;
      }, 0);

      const grossProfitUsd = groupSummaries.reduce((total, summary) => {
        const agencyCommissions = summary.per_system.reduce((acc, sys) => {
          const commission = commissions.get(sys.system_id);
          if (commission) {
            acc += sys.sales_usd * (commission.commission_percentage_usd / 100);
          }
          return acc;
        }, 0);
        return total + agencyCommissions;
      }, 0);

      // Get group-specific expenses
      const groupExpenses = groupSpecificExpenses.filter((e) => e.group_id === group.id);
      const groupExpensesBs = groupExpenses.reduce((total, e) => total + Number(e.amount_bs || 0), 0);

      // Global expenses allocated equally per agency: globalExpensePerAgency * number of agencies in group
      const allocatedGlobalExpenses = globalExpensePerAgency * groupAgenciesCount;
      const netProfitBs = grossProfitBs - allocatedGlobalExpenses;
      const netProfitUsd = grossProfitUsd;

      // Calculate final profit (net - group-specific expenses)
      const finalProfitBs = netProfitBs - groupExpensesBs;

      // Group expenses by description (concepto)
      const expensesList: Array<{ description: string; amount: number }> = groupExpenses.map((expense) => ({
        description: expense.description,
        amount: Number(expense.amount_bs || 0),
      }));

      return {
        group,
        grossProfitBs,
        grossProfitUsd,
        allocatedGlobalExpenses,
        netProfitBs,
        netProfitUsd,
        groupExpensesBs,
        finalProfitBs,
        expensesList,
        agenciesCount: groupAgenciesCount,
      };
    });
  }, [agencyGroups, agencies, summaries, commissions, groupSpecificExpenses, fixedCommissionsBs]);

  // Calculate final profit as sum of all groups' final profits (Ganancia por Venta)
  const finalProfitBs = useMemo(() => {
    return groupsData.reduce((total, groupData) => total + groupData.finalProfitBs, 0);
  }, [groupsData]);

  // Calculate banqueo total using the formula from the totalizer: (sales - prizes) + commission + participation
  const banqueoTotal = useMemo(() => {
    let totalSalesBs = 0;
    let totalSalesUsd = 0;
    let totalPrizesBs = 0;
    let totalPrizesUsd = 0;
    let totalCommissionBs = 0;
    let totalCommissionUsd = 0;
    let totalParticipationBs = 0;
    let totalParticipationUsd = 0;

    banqueoTransactions.forEach((transaction) => {
      const salesBs = Number(transaction.sales_bs || 0);
      const salesUsd = Number(transaction.sales_usd || 0);
      const prizesBs = Number(transaction.prizes_bs || 0);
      const prizesUsd = Number(transaction.prizes_usd || 0);
      const cuadreBs = salesBs - prizesBs;
      const cuadreUsd = salesUsd - prizesUsd;

      const commissionRate = commissions.get(transaction.lottery_system_id);
      const commissionPercentageBs = commissionRate?.commission_percentage || 0;
      const commissionPercentageUsd = commissionRate?.commission_percentage_usd || 0;
      const commissionBs = salesBs * (commissionPercentageBs / 100);
      const commissionUsd = salesUsd * (commissionPercentageUsd / 100);
      const subtotalBs = cuadreBs - commissionBs;
      const subtotalUsd = cuadreUsd - commissionUsd;
      const participationPercentage = Number(transaction.participation_percentage || 0);
      const participationBs = subtotalBs * (participationPercentage / 100);
      const participationUsd = subtotalUsd * (participationPercentage / 100);

      totalSalesBs += salesBs;
      totalSalesUsd += salesUsd;
      totalPrizesBs += prizesBs;
      totalPrizesUsd += prizesUsd;
      totalCommissionBs += commissionBs;
      totalCommissionUsd += commissionUsd;
      totalParticipationBs += participationBs;
      totalParticipationUsd += participationUsd;
    });

    // Formula: (sales - prizes) + commission + participation
    const totalBs = (totalSalesBs - totalPrizesBs) + totalCommissionBs + totalParticipationBs;
    const totalUsd = (totalSalesUsd - totalPrizesUsd) + totalCommissionUsd + totalParticipationUsd;

    return {
      totalBs,
      totalUsd,
      perPersonBs: totalBs / 5,
      perPersonUsd: totalUsd / 5,
    };
  }, [banqueoTransactions, commissions]);

  // Calculate TOTAL UTILIDADES (same as AdminSystemsSummaryView)
  const totalUtilidades = useMemo(() => {
    let totalParticipationBs = 0;
    let totalParticipationUsd = 0;

    summaries.forEach((summary) => {
      summary.per_system.forEach((sys) => {
        const commission = commissions.get(sys.system_id);
        
        if (commission) {
          // Calculate subtotal: sales - prizes - commission
          const salesBs = sys.sales_bs;
          const salesUsd = sys.sales_usd;
          const prizesBs = sys.prizes_bs;
          const prizesUsd = sys.prizes_usd;
          const commissionBs = salesBs * (commission.commission_percentage / 100);
          const commissionUsd = salesUsd * (commission.commission_percentage_usd / 100);
          
          const subtotalBs = salesBs - prizesBs - commissionBs;
          const subtotalUsd = salesUsd - prizesUsd - commissionUsd;
          
          // Participation = subtotal * utility_percentage
          const participationBs = subtotalBs * (commission.utility_percentage / 100);
          const participationUsd = subtotalUsd * (commission.utility_percentage_usd / 100);
          
          totalParticipationBs += participationBs;
          totalParticipationUsd += participationUsd;
        }
      });
    });

    return {
      totalBs: totalParticipationBs,
      totalUsd: totalParticipationUsd,
    };
  }, [summaries, commissions]);

  // Calculate participation 2 profit from banqueo
  const participation2Total = useMemo(() => {
    let totalParticipation2Bs = 0;
    let totalParticipation2Usd = 0;

    banqueoTransactions.forEach((transaction) => {
      const salesBs = Number(transaction.sales_bs || 0);
      const salesUsd = Number(transaction.sales_usd || 0);
      const prizesBs = Number(transaction.prizes_bs || 0);
      const prizesUsd = Number(transaction.prizes_usd || 0);
      
      const cuadreBs = salesBs - prizesBs;
      const cuadreUsd = salesUsd - prizesUsd;

      const commissionRate = commissions.get(transaction.lottery_system_id);
      const commissionPercentageBs = commissionRate?.commission_percentage || 0;
      const commissionPercentageUsd = commissionRate?.commission_percentage_usd || 0;
      
      const commissionBs = salesBs * (commissionPercentageBs / 100);
      const commissionUsd = salesUsd * (commissionPercentageUsd / 100);
      
      const subtotalBs = cuadreBs - commissionBs;
      const subtotalUsd = cuadreUsd - commissionUsd;
      
      // Participación 2 = subtotal * porcentaje guardado en la transacción
      const participation2Percentage = Number(transaction.participation2_percentage || 0);
      totalParticipation2Bs += subtotalBs * (participation2Percentage / 100);
      totalParticipation2Usd += subtotalUsd * (participation2Percentage / 100);
    });

    return {
      totalBs: totalParticipation2Bs,
      totalUsd: totalParticipation2Usd,
    };
  }, [banqueoTransactions, commissions]);

  // Calculate total participation profit: TOTAL UTILIDADES + Participación 2
  const totalParticipationProfit = useMemo(() => {
    return {
      totalBs: totalUtilidades.totalBs + participation2Total.totalBs,
      totalUsd: totalUtilidades.totalUsd + participation2Total.totalUsd,
    };
  }, [totalUtilidades, participation2Total]);

  // Calculate total final profit: Ganancia por Venta + TOTAL UTILIDADES + Ganancia por Banqueo
  const totalFinalProfit = useMemo(() => {
    return {
      totalBs: finalProfitBs + totalUtilidades.totalBs + banqueoTotal.totalBs,
      totalUsd: totalNetProfitUsd + totalUtilidades.totalUsd + banqueoTotal.totalUsd,
    };
  }, [finalProfitBs, totalUtilidades, banqueoTotal, totalNetProfitUsd]);


  const loading = summariesLoading || commissionsLoading;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <h2 className="text-xl font-semibold">Cargando ganancias...</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Ganancias</h1>
          <p className="text-muted-foreground">Resumen de ganancias y gastos semanales</p>
        </div>
      </div>

      {currentWeek && (
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
          <CardContent className="space-y-6">
            {/* Resumen Principal */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="bg-gradient-to-br from-blue-500/10 to-background border-2 border-blue-500/30">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium text-muted-foreground">Total Neto</p>
                    <Calculator className="h-5 w-5 text-blue-600" />
                  </div>
                  <p className="text-2xl font-bold text-blue-600 font-mono">
                    {currency === "bs" ? formatCurrency(totalNetProfitBs, "VES") : formatCurrency(totalNetProfitUsd, "USD")}
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-amber-500/10 to-background border-2 border-amber-500/30">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium text-muted-foreground">Gastos Globales</p>
                    <Receipt className="h-5 w-5 text-amber-600" />
                  </div>
                  <p className="text-2xl font-bold text-amber-600 font-mono">
                    -{currency === "bs" ? formatCurrency(fixedCommissionsBs, "VES") : formatCurrency(fixedCommissionsUsd, "USD")}
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-red-500/10 to-background border-2 border-red-500/30">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium text-muted-foreground">Gastos Grupos</p>
                    <Receipt className="h-5 w-5 text-red-600" />
                  </div>
                  <p className="text-2xl font-bold text-red-600 font-mono">
                    -{currency === "bs" ? formatCurrency(totalGroupExpensesBs, "VES") : formatCurrency(0, "USD")}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Ganancia Final */}
            <Collapsible open={isProfitDistributionOpen} onOpenChange={setIsProfitDistributionOpen}>
              <Card className="bg-gradient-to-br from-purple-500/10 via-purple-500/5 to-background border-2 border-purple-500/30">
                <CardContent className="pt-6">
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" className="w-full justify-between p-0 hover:bg-transparent mb-4">
                      <h3 className="text-xl font-bold text-purple-700 flex items-center gap-2">
                        <DollarSign className="h-6 w-6" />
                        Ganancia Final
                      </h3>
                      <ChevronDown
                        className={`h-5 w-5 text-purple-700 transition-transform ${isProfitDistributionOpen ? "rotate-180" : ""}`}
                      />
                    </Button>
                  </CollapsibleTrigger>
                  <p className="text-4xl font-bold text-purple-700 font-mono mb-4">
                    {currency === "bs" ? formatCurrency(totalFinalProfit.totalBs, "VES") : formatCurrency(totalFinalProfit.totalUsd, "USD")}
                  </p>
                  
                  <CollapsibleContent>
                    <div className="mt-4 border-t border-purple-200 pt-4">
                      <Tabs defaultValue="venta" className="w-full">
                        <TabsList className="grid w-full grid-cols-3">
                          <TabsTrigger value="venta">Ganancia por Venta</TabsTrigger>
                          <TabsTrigger value="participacion">Ganancia por Participación</TabsTrigger>
                          <TabsTrigger value="banqueo">Ganancia por Banqueo</TabsTrigger>
                        </TabsList>

                        <TabsContent value="venta" className="space-y-4 mt-4">
                          <h4 className="text-sm font-medium text-muted-foreground">
                            Distribución de Ganancias por Venta ({currency === "bs" ? "Bs" : "USD"})
                          </h4>
                          <div className="flex items-center justify-between mb-4 p-4 bg-purple-500/10 border border-purple-500/20 rounded-lg">
                            <p className="text-sm font-medium text-muted-foreground">Total Ganancia por Venta:</p>
                            <p className="text-2xl font-bold text-purple-700 font-mono">
                              {(() => {
                                const totalVenta = ["Denis", "Jonathan", "Byjer", "Daniela", "Jorge"].reduce((sum, person) => {
                                  const grupo1 = groupsData[0] ? (currency === "bs" ? groupsData[0].finalProfitBs : groupsData[0].netProfitUsd) : 0;
                                  const grupo2 = groupsData[1] ? (currency === "bs" ? groupsData[1].finalProfitBs : groupsData[1].netProfitUsd) : 0;
                                  const grupo3 = groupsData[2] ? (currency === "bs" ? groupsData[2].finalProfitBs : groupsData[2].netProfitUsd) : 0;
                                  
                                  let baseShare = 0;
                                  if (person === "Denis" || person === "Jonathan") {
                                    baseShare = (grupo1 / 5) + (grupo2 / 4) + (grupo3 / 3);
                                  } else if (person === "Byjer") {
                                    baseShare = (grupo1 / 5) + (grupo3 / 3);
                                  } else if (person === "Daniela" || person === "Jorge") {
                                    baseShare = (grupo1 / 5) + (grupo2 / 4);
                                  }
                                  
                                  return sum + baseShare;
                                }, 0);
                                return currency === "bs" ? formatCurrency(totalVenta, "VES") : formatCurrency(totalVenta, "USD");
                              })()}
                            </p>
                          </div>
                          <div className="space-y-3">
                            {["Denis", "Jonathan", "Byjer", "Daniela", "Jorge"].map((person) => {
                              // Get the final profit for each group
                              const grupo1 = groupsData[0] ? (currency === "bs" ? groupsData[0].finalProfitBs : groupsData[0].netProfitUsd) : 0;
                              const grupo2 = groupsData[1] ? (currency === "bs" ? groupsData[1].finalProfitBs : groupsData[1].netProfitUsd) : 0;
                              const grupo3 = groupsData[2] ? (currency === "bs" ? groupsData[2].finalProfitBs : groupsData[2].netProfitUsd) : 0;
                              
                              // Calculate base share according to each person's formula
                              let baseShare = 0;
                              if (person === "Denis" || person === "Jonathan") {
                                // (Grupo1/5) + (Grupo2/4) + (Grupo3/3)
                                baseShare = (grupo1 / 5) + (grupo2 / 4) + (grupo3 / 3);
                              } else if (person === "Byjer") {
                                // (Grupo1/5) + (Grupo3/3)
                                baseShare = (grupo1 / 5) + (grupo3 / 3);
                              } else if (person === "Daniela" || person === "Jorge") {
                                // (Grupo1/5) + (Grupo2/4)
                                baseShare = (grupo1 / 5) + (grupo2 / 4);
                              }
                              
                              const restaPerdida = 0;
                              const sumaGanancia = 0;
                              const abonos = 0;
                              const total = baseShare - restaPerdida + sumaGanancia - abonos;
                              
                              return (
                                <Card key={person} className="bg-purple-500/5 border-purple-500/20">
                                  <CardContent className="p-4">
                                    <div className="flex items-center justify-between mb-3">
                                      <h5 className="font-bold text-lg">{person}</h5>
                                      <div className="text-right">
                                        <p className="text-xs text-muted-foreground">Total</p>
                                        <p className="text-xl font-bold text-purple-700 font-mono">
                                          {currency === "bs" ? formatCurrency(total, "VES") : formatCurrency(total, "USD")}
                                        </p>
                                      </div>
                                    </div>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                      <div>
                                        <p className="text-xs text-muted-foreground mb-1">Monto Base</p>
                                        <p className="text-sm font-semibold font-mono">
                                          {currency === "bs" ? formatCurrency(baseShare, "VES") : formatCurrency(baseShare, "USD")}
                                        </p>
                                      </div>
                                      <div>
                                        <p className="text-xs text-muted-foreground mb-1">Resta Pérdida</p>
                                        <p className="text-sm font-semibold font-mono text-red-600">
                                          -{currency === "bs" ? formatCurrency(restaPerdida, "VES") : formatCurrency(restaPerdida, "USD")}
                                        </p>
                                      </div>
                                      <div>
                                        <p className="text-xs text-muted-foreground mb-1">Suma Ganancia</p>
                                        <p className="text-sm font-semibold font-mono text-green-600">
                                          +{currency === "bs" ? formatCurrency(sumaGanancia, "VES") : formatCurrency(sumaGanancia, "USD")}
                                        </p>
                                      </div>
                                      <div>
                                        <p className="text-xs text-muted-foreground mb-1">Abonos</p>
                                        <p className="text-sm font-semibold font-mono text-amber-600">
                                          -{currency === "bs" ? formatCurrency(abonos, "VES") : formatCurrency(abonos, "USD")}
                                        </p>
                                      </div>
                                    </div>
                                  </CardContent>
                                </Card>
                              );
                            })}
                          </div>
                        </TabsContent>

                        <TabsContent value="participacion" className="space-y-4 mt-4">
                          <h4 className="text-sm font-medium text-muted-foreground">
                            Distribución de Ganancias por Participación ({currency === "bs" ? "Bs" : "USD"})
                          </h4>
                          <div className="flex items-center justify-between mb-4 p-4 bg-purple-500/10 border border-purple-500/20 rounded-lg">
                            <p className="text-sm font-medium text-muted-foreground">Total Ganancia por Participación:</p>
                            <p className="text-2xl font-bold text-purple-700 font-mono">
                              {currency === "bs" ? formatCurrency(totalParticipationProfit.totalBs, "VES") : formatCurrency(totalParticipationProfit.totalUsd, "USD")}
                            </p>
                          </div>
                          <div className="space-y-3">
                            {["Denis", "Jonathan", "Byjer", "Daniela", "Jorge"].map((person) => {
                              // Sumar TOTAL UTILIDADES + Participación 2
                              const totalParticipation = currency === "bs" 
                                ? totalParticipationProfit.totalBs
                                : totalParticipationProfit.totalUsd;
                              
                              const baseShare = totalParticipation / 5;
                              const restaPerdida = 0;
                              const sumaGanancia = 0;
                              const abonos = 0;
                              const total = baseShare - restaPerdida + sumaGanancia - abonos;
                              
                              return (
                                <Card key={person} className="bg-purple-500/5 border-purple-500/20">
                                  <CardContent className="p-4">
                                    <div className="flex items-center justify-between mb-3">
                                      <h5 className="font-bold text-lg">{person}</h5>
                                      <div className="text-right">
                                        <p className="text-xs text-muted-foreground">Total</p>
                                        <p className="text-xl font-bold text-purple-700 font-mono">
                                          {currency === "bs" ? formatCurrency(total, "VES") : formatCurrency(total, "USD")}
                                        </p>
                                      </div>
                                    </div>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                      <div>
                                        <p className="text-xs text-muted-foreground mb-1">Monto Base</p>
                                        <p className="text-sm font-semibold font-mono">
                                          {currency === "bs" ? formatCurrency(baseShare, "VES") : formatCurrency(baseShare, "USD")}
                                        </p>
                                      </div>
                                      <div>
                                        <p className="text-xs text-muted-foreground mb-1">Resta Pérdida</p>
                                        <p className="text-sm font-semibold font-mono text-red-600">
                                          -{currency === "bs" ? formatCurrency(restaPerdida, "VES") : formatCurrency(restaPerdida, "USD")}
                                        </p>
                                      </div>
                                      <div>
                                        <p className="text-xs text-muted-foreground mb-1">Suma Ganancia</p>
                                        <p className="text-sm font-semibold font-mono text-green-600">
                                          +{currency === "bs" ? formatCurrency(sumaGanancia, "VES") : formatCurrency(sumaGanancia, "USD")}
                                        </p>
                                      </div>
                                      <div>
                                        <p className="text-xs text-muted-foreground mb-1">Abonos</p>
                                        <p className="text-sm font-semibold font-mono text-amber-600">
                                          -{currency === "bs" ? formatCurrency(abonos, "VES") : formatCurrency(abonos, "USD")}
                                        </p>
                                      </div>
                                    </div>
                                  </CardContent>
                                </Card>
                              );
                            })}
                          </div>
                        </TabsContent>

                        <TabsContent value="banqueo" className="space-y-4 mt-4">
                          <h4 className="text-sm font-medium text-muted-foreground">
                            Distribución de Ganancias por Banqueo ({currency === "bs" ? "Bs" : "USD"})
                          </h4>
                          <div className="flex items-center justify-between mb-4 p-4 bg-purple-500/10 border border-purple-500/20 rounded-lg">
                            <p className="text-sm font-medium text-muted-foreground">Total Ganancia Banqueo:</p>
                            <p className="text-2xl font-bold text-purple-700 font-mono">
                              {currency === "bs" ? formatCurrency(banqueoTotal.totalBs, "VES") : formatCurrency(banqueoTotal.totalUsd, "USD")}
                            </p>
                          </div>
                          <div className="space-y-3">
                            {["Denis", "Jonathan", "Byjer", "Daniela", "Jorge"].map((person) => {
                              // Cada persona recibe el total dividido entre 5
                              const baseShare = currency === "bs" ? banqueoTotal.perPersonBs : banqueoTotal.perPersonUsd;
                              
                              const restaPerdida = 0;
                              const sumaGanancia = 0;
                              const abonos = 0;
                              const total = baseShare - restaPerdida + sumaGanancia - abonos;
                              
                              return (
                                <Card key={person} className="bg-purple-500/5 border-purple-500/20">
                                  <CardContent className="p-4">
                                    <div className="flex items-center justify-between mb-3">
                                      <h5 className="font-bold text-lg">{person}</h5>
                                      <div className="text-right">
                                        <p className="text-xs text-muted-foreground">Total</p>
                                        <p className="text-xl font-bold text-purple-700 font-mono">
                                          {currency === "bs" ? formatCurrency(total, "VES") : formatCurrency(total, "USD")}
                                        </p>
                                      </div>
                                    </div>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                      <div>
                                        <p className="text-xs text-muted-foreground mb-1">Monto Base</p>
                                        <p className="text-sm font-semibold font-mono">
                                          {currency === "bs" ? formatCurrency(baseShare, "VES") : formatCurrency(baseShare, "USD")}
                                        </p>
                                      </div>
                                      <div>
                                        <p className="text-xs text-muted-foreground mb-1">Resta Pérdida</p>
                                        <p className="text-sm font-semibold font-mono text-red-600">
                                          -{currency === "bs" ? formatCurrency(restaPerdida, "VES") : formatCurrency(restaPerdida, "USD")}
                                        </p>
                                      </div>
                                      <div>
                                        <p className="text-xs text-muted-foreground mb-1">Suma Ganancia</p>
                                        <p className="text-sm font-semibold font-mono text-green-600">
                                          +{currency === "bs" ? formatCurrency(sumaGanancia, "VES") : formatCurrency(sumaGanancia, "USD")}
                                        </p>
                                      </div>
                                      <div>
                                        <p className="text-xs text-muted-foreground mb-1">Abonos</p>
                                        <p className="text-sm font-semibold font-mono text-amber-600">
                                          -{currency === "bs" ? formatCurrency(abonos, "VES") : formatCurrency(abonos, "USD")}
                                        </p>
                                      </div>
                                    </div>
                                  </CardContent>
                                </Card>
                              );
                            })}
                          </div>
                        </TabsContent>
                      </Tabs>
                    </div>
                  </CollapsibleContent>
                </CardContent>
              </Card>
            </Collapsible>

            {/* Desglose de Gastos Globales */}
            {(fixedCommissionsDetails.length > 0 || payrollTotal.bs > 0 || payrollTotal.usd > 0) && (
              <Collapsible open={isGlobalExpensesOpen} onOpenChange={setIsGlobalExpensesOpen}>
                <Card>
                  <CardHeader>
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" className="w-full justify-between p-0 hover:bg-transparent h-auto group">
                        <CardTitle className="group-hover:text-foreground">Gastos Fijos Globales</CardTitle>
                        <ChevronDown
                          className={`h-5 w-5 transition-transform group-hover:text-foreground ${isGlobalExpensesOpen ? "rotate-180" : ""}`}
                        />
                      </Button>
                    </CollapsibleTrigger>
                  </CardHeader>
                  <CollapsibleContent>
                    <CardContent>
                      <div className="space-y-2">
                        {/* Gastos Fijos */}
                        {fixedCommissionsDetails.map((expense) => (
                          <div
                            key={expense.id}
                            className="flex items-center justify-between p-3 bg-red-500/5 border border-red-500/20 rounded-lg"
                          >
                            <div>
                              <p className="font-medium">{expense.description}</p>
                              <p className="text-xs text-muted-foreground">Gasto Fijo</p>
                            </div>
                            <div className="text-right">
                              {Number(expense.amount_bs || 0) > 0 && (
                                <span className="font-bold font-mono text-red-600 block">
                                  {formatCurrency(Number(expense.amount_bs), "VES")}
                                </span>
                              )}
                              {Number(expense.amount_usd || 0) > 0 && (
                                <span className="text-xs text-muted-foreground font-mono">
                                  {formatCurrency(Number(expense.amount_usd), "USD")}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                        
                        {/* Nómina - Siempre mostrar si hay datos de nómina registrados */}
                        {(payrollTotal.bs !== 0 || payrollTotal.usd !== 0) && (
                          <div className="flex items-center justify-between p-3 bg-red-500/5 border border-red-500/20 rounded-lg">
                            <div>
                              <p className="font-medium">Nómina Semanal</p>
                              <p className="text-xs text-muted-foreground">Gasto Fijo</p>
                            </div>
                            <div className="text-right">
                              {payrollTotal.bs !== 0 && (
                                <span className={`font-bold font-mono block ${payrollTotal.bs > 0 ? 'text-red-600' : 'text-muted-foreground'}`}>
                                  {formatCurrency(payrollTotal.bs, "VES")}
                                </span>
                              )}
                              {payrollTotal.usd !== 0 && (
                                <span className="text-xs text-muted-foreground font-mono">
                                  {formatCurrency(payrollTotal.usd, "USD")}
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                        
                        <div className="pt-2 border-t mt-2">
                          <div className="flex items-center justify-between">
                            <span className="font-bold">Total Gastos Fijos (incluye Nómina):</span>
                            <div className="text-right">
                              <span className="font-bold font-mono text-red-600 text-lg block">
                                {formatCurrency(fixedCommissionsBs, "VES")}
                              </span>
                              {fixedCommissionsUsd > 0 && (
                                <span className="text-sm font-mono text-muted-foreground">
                                  {formatCurrency(fixedCommissionsUsd, "USD")}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            )}

            {/* Desglose por Grupos */}
            {groupsData.length > 0 && (
              <div className="space-y-4">
                <h2 className="text-xl font-bold text-foreground">Desglose por Grupos</h2>
                <div className="grid grid-cols-1 gap-4">
                  {groupsData.map(
                    ({
                      group,
                      grossProfitBs,
                      grossProfitUsd,
                      allocatedGlobalExpenses,
                      netProfitBs,
                      netProfitUsd,
                      groupExpensesBs,
                      finalProfitBs,
                      expensesList,
                      agenciesCount,
                    }) => (
                      <Card key={group.id} className="border-2">
                        <CardHeader className="pb-3">
                          <CardTitle className="flex items-center justify-between">
                            <span>{group.name}</span>
                            <span className="text-sm font-normal text-muted-foreground">
                              {agenciesCount} {agenciesCount === 1 ? "agencia" : "agencias"}
                            </span>
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
                            <div className="space-y-1">
                              <p className="text-xs text-muted-foreground">Bruto</p>
                              <p className="text-sm font-bold text-green-600 font-mono">
                                {currency === "bs" ? formatCurrency(grossProfitBs, "VES") : formatCurrency(grossProfitUsd, "USD")}
                              </p>
                            </div>

                            <div className="space-y-1">
                              <p className="text-xs text-muted-foreground">Gastos Globales</p>
                              <p className="text-sm font-bold text-amber-600 font-mono">
                                -{currency === "bs" ? formatCurrency(allocatedGlobalExpenses, "VES") : formatCurrency(0, "USD")}
                              </p>
                            </div>

                            <div className="space-y-1">
                              <p className="text-xs text-muted-foreground">Neto</p>
                              <p className="text-sm font-bold text-blue-600 font-mono">
                                {currency === "bs" ? formatCurrency(netProfitBs, "VES") : formatCurrency(netProfitUsd, "USD")}
                              </p>
                            </div>

                            <div className="space-y-1">
                              <p className="text-xs text-muted-foreground">Gastos Grupo</p>
                              <p className="text-sm font-bold text-red-600 font-mono">
                                -{currency === "bs" ? formatCurrency(groupExpensesBs, "VES") : formatCurrency(0, "USD")}
                              </p>
                            </div>

                            <div className="space-y-1 bg-purple-500/10 p-2 rounded-lg">
                              <p className="text-xs font-semibold text-purple-700">Final</p>
                              <p className="text-lg font-bold text-purple-700 font-mono">
                                {currency === "bs" ? formatCurrency(finalProfitBs, "VES") : formatCurrency(netProfitUsd, "USD")}
                              </p>
                            </div>
                          </div>

                          {expensesList.length > 0 && (
                            <div className="pt-3 border-t">
                              <p className="text-xs font-semibold text-muted-foreground mb-2">
                                Gastos Específicos del Grupo:
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {expensesList.map((expense, idx) => (
                                  <div
                                    key={idx}
                                    className="flex items-center gap-2 px-3 py-1 bg-muted/50 rounded-full text-xs"
                                  >
                                    <span>{expense.description}</span>
                                    <span className="font-bold font-mono">
                                      {currency === "bs" ? formatCurrency(expense.amount, "VES") : formatCurrency(0, "USD")}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ),
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
