import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChevronDown, ChevronUp, DollarSign, TrendingUp, RefreshCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSystemCommissions } from "@/hooks/useSystemCommissions";
import { formatCurrency } from "@/lib/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Label } from "@/components/ui/label";

interface SystemData {
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
  subcategories?: SystemData[];
}

interface LotterySystem {
  id: string;
  name: string;
  parent_system_id: string | null;
  has_subcategories: boolean | null;
}

const STORAGE_KEY = 'admin_systems_summary_manual_data';

export function AdminSystemsSummaryManual() {
  const [currency, setCurrency] = useState<"bs" | "usd">("bs");
  const [expandedSystems, setExpandedSystems] = useState<Set<string>>(new Set());
  const [lotterySystems, setLotterySystems] = useState<LotterySystem[]>([]);
  const [systemsData, setSystemsData] = useState<SystemData[]>([]);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [inputValues, setInputValues] = useState<Record<string, string>>({});
  const { commissions, loading: commissionsLoading } = useSystemCommissions();

  // Parse input value from formatted string to number
  const parseInputValue = (value: string): number => {
    if (!value || value.trim() === "") return 0;
    
    const cleanValue = value.replace(/[^\d.,]/g, "");
    
    if (cleanValue.includes(",")) {
      const normalizedValue = cleanValue.replace(/\./g, "").replace(",", ".");
      const num = parseFloat(normalizedValue);
      return isNaN(num) ? 0 : num;
    }
    
    if (cleanValue.includes(".")) {
      const lastDotIndex = cleanValue.lastIndexOf(".");
      const afterDot = cleanValue.substring(lastDotIndex + 1);
      
      if (afterDot.length <= 2 && afterDot.length > 0) {
        const beforeLastDot = cleanValue.substring(0, lastDotIndex).replace(/\./g, "");
        const normalizedValue = `${beforeLastDot}.${afterDot}`;
        const num = parseFloat(normalizedValue);
        return isNaN(num) ? 0 : num;
      } else {
        const normalizedValue = cleanValue.replace(/\./g, "");
        const num = parseFloat(normalizedValue);
        return isNaN(num) ? 0 : num;
      }
    }
    
    const num = parseFloat(cleanValue);
    return isNaN(num) ? 0 : num;
  };

  // Format number to display string
  const formatNumber = (value: number): string => {
    if (value === 0) return "";
    return value.toLocaleString("es-VE", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  // Get input key for a system/field combination
  const getInputKey = (systemId: string, field: string, isSubcategory: boolean = false): string => {
    return `${systemId}-${field}-${currency}${isSubcategory ? '-sub' : ''}`;
  };

  // Initialize input values when systemsData changes
  useEffect(() => {
    if (systemsData.length > 0) {
      const newInputValues: Record<string, string> = {};
      systemsData.forEach((sys) => {
        if (!sys.hasSubcategories) {
          const salesValue = currency === "bs" ? sys.sales_bs : sys.sales_usd;
          const prizesValue = currency === "bs" ? sys.prizes_bs : sys.prizes_usd;
          newInputValues[getInputKey(sys.system_id, "sales")] = formatNumber(salesValue);
          newInputValues[getInputKey(sys.system_id, "prizes")] = formatNumber(prizesValue);
        }
        if (sys.subcategories) {
          sys.subcategories.forEach((sub) => {
            const subSalesValue = currency === "bs" ? sub.sales_bs : sub.sales_usd;
            const subPrizesValue = currency === "bs" ? sub.prizes_bs : sub.prizes_usd;
            newInputValues[getInputKey(sub.system_id, "sales", true)] = formatNumber(subSalesValue);
            newInputValues[getInputKey(sub.system_id, "prizes", true)] = formatNumber(subPrizesValue);
          });
        }
      });
      setInputValues(newInputValues);
    }
  }, [systemsData, currency]);

  const toggleSystem = (systemId: string) => {
    const newExpanded = new Set(expandedSystems);
    if (newExpanded.has(systemId)) {
      newExpanded.delete(systemId);
    } else {
      newExpanded.add(systemId);
    }
    setExpandedSystems(newExpanded);
  };

  // Guardar datos en localStorage cuando cambien
  useEffect(() => {
    if (dataLoaded && systemsData.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(systemsData));
    }
  }, [systemsData, dataLoaded]);

  useEffect(() => {
    const fetchLotterySystems = async () => {
      const { data, error } = await supabase
        .from("lottery_systems")
        .select("id, name, parent_system_id, has_subcategories")
        .eq("is_active", true);

      if (error) {
        console.error("Error fetching lottery systems:", error);
      } else {
        setLotterySystems(data || []);
        initializeSystemsData(data || []);
      }
    };

    fetchLotterySystems();
  }, []);

  // Update commission percentages when commissions are loaded
  useEffect(() => {
    if (lotterySystems.length > 0 && commissions.size > 0) {
      setSystemsData((prevData) => {
        return prevData.map((sys) => {
          const commission = commissions.get(sys.system_id);
          const updated = {
            ...sys,
            commission_percentage_bs: commission?.commission_percentage || 0,
            commission_percentage_usd: commission?.commission_percentage_usd || 0,
            utility_percentage_bs: commission?.utility_percentage || 0,
            utility_percentage_usd: commission?.utility_percentage_usd || 0,
          };
          
          // Recalculate totals if sales exist
          if (!updated.hasSubcategories) {
            updated.total_bs = updated.sales_bs * (updated.commission_percentage_bs / 100);
            updated.total_usd = updated.sales_usd * (updated.commission_percentage_usd / 100);
          }
          
          // Update subcategories
          if (updated.subcategories) {
            updated.subcategories = updated.subcategories.map((sub) => {
              const subCommission = commissions.get(sub.system_id);
              const updatedSub = {
                ...sub,
                commission_percentage_bs: subCommission?.commission_percentage || 0,
                commission_percentage_usd: subCommission?.commission_percentage_usd || 0,
              };
              // Recalculate subcategory totals if sales exist
              updatedSub.total_bs = updatedSub.sales_bs * (updatedSub.commission_percentage_bs / 100);
              updatedSub.total_usd = updatedSub.sales_usd * (updatedSub.commission_percentage_usd / 100);
              return updatedSub;
            });
            
            // Recalculate parent totals from subcategories
            if (updated.hasSubcategories && updated.subcategories) {
              updated.sales_bs = updated.subcategories.reduce((sum, s) => sum + s.sales_bs, 0);
              updated.sales_usd = updated.subcategories.reduce((sum, s) => sum + s.sales_usd, 0);
              updated.prizes_bs = updated.subcategories.reduce((sum, s) => sum + s.prizes_bs, 0);
              updated.prizes_usd = updated.subcategories.reduce((sum, s) => sum + s.prizes_usd, 0);
              updated.total_bs = updated.sales_bs * (updated.commission_percentage_bs / 100);
              updated.total_usd = updated.sales_usd * (updated.commission_percentage_usd / 100);
            }
          }
          
          return updated;
        });
      });
    }
  }, [commissions, lotterySystems]);

  const initializeSystemsData = (systems: LotterySystem[], forceEmpty: boolean = false) => {
    const parentSystems = systems.filter((s) => !s.parent_system_id);
    const subcategoriesMap = new Map<string, LotterySystem[]>();

    systems.forEach((sys) => {
      if (sys.parent_system_id) {
        if (!subcategoriesMap.has(sys.parent_system_id)) {
          subcategoriesMap.set(sys.parent_system_id, []);
        }
        subcategoriesMap.get(sys.parent_system_id)!.push(sys);
      }
    });

    // Intentar cargar datos guardados del localStorage (solo si no forzamos vacío)
    let savedSystemsMap = new Map<string, { sales_bs: number; sales_usd: number; prizes_bs: number; prizes_usd: number }>();
    let savedSubcategoriesMap = new Map<string, { sales_bs: number; sales_usd: number; prizes_bs: number; prizes_usd: number }>();

    if (!forceEmpty) {
      const savedData = localStorage.getItem(STORAGE_KEY);
      if (savedData) {
        try {
          const parsed: SystemData[] = JSON.parse(savedData);
          parsed.forEach((sys) => {
            savedSystemsMap.set(sys.system_id, {
              sales_bs: sys.sales_bs,
              sales_usd: sys.sales_usd,
              prizes_bs: sys.prizes_bs,
              prizes_usd: sys.prizes_usd,
            });
            if (sys.subcategories) {
              sys.subcategories.forEach((sub) => {
                savedSubcategoriesMap.set(sub.system_id, {
                  sales_bs: sub.sales_bs,
                  sales_usd: sub.sales_usd,
                  prizes_bs: sub.prizes_bs,
                  prizes_usd: sub.prizes_usd,
                });
              });
            }
          });
        } catch (e) {
          console.error("Error parsing saved data:", e);
        }
      }
    }

    const initialData: SystemData[] = parentSystems.map((sys) => {
      const commission = commissions.get(sys.id);
      const subcats = subcategoriesMap.get(sys.id) || [];
      const savedParent = savedSystemsMap.get(sys.id);

      const subcategories = subcats.map((sub) => {
        const subCommission = commissions.get(sub.id);
        const savedSub = savedSubcategoriesMap.get(sub.id);
        const subData = {
          system_id: sub.id,
          system_name: sub.name,
          sales_bs: savedSub?.sales_bs || 0,
          sales_usd: savedSub?.sales_usd || 0,
          prizes_bs: savedSub?.prizes_bs || 0,
          prizes_usd: savedSub?.prizes_usd || 0,
          commission_percentage_bs: subCommission?.commission_percentage || 0,
          commission_percentage_usd: subCommission?.commission_percentage_usd || 0,
          utility_percentage_bs: 0,
          utility_percentage_usd: 0,
          total_bs: 0,
          total_usd: 0,
          hasSubcategories: false,
        };
        subData.total_bs = subData.sales_bs * (subData.commission_percentage_bs / 100);
        subData.total_usd = subData.sales_usd * (subData.commission_percentage_usd / 100);
        return subData;
      });

      // Calculate parent totals from subcategories if it has them
      const hasSubcats = sys.has_subcategories || false;
      let sales_bs = hasSubcats ? subcategories.reduce((sum, s) => sum + s.sales_bs, 0) : (savedParent?.sales_bs || 0);
      let sales_usd = hasSubcats ? subcategories.reduce((sum, s) => sum + s.sales_usd, 0) : (savedParent?.sales_usd || 0);
      let prizes_bs = hasSubcats ? subcategories.reduce((sum, s) => sum + s.prizes_bs, 0) : (savedParent?.prizes_bs || 0);
      let prizes_usd = hasSubcats ? subcategories.reduce((sum, s) => sum + s.prizes_usd, 0) : (savedParent?.prizes_usd || 0);

      const parentData = {
        system_id: sys.id,
        system_name: sys.name,
        sales_bs,
        sales_usd,
        prizes_bs,
        prizes_usd,
        commission_percentage_bs: commission?.commission_percentage || 0,
        commission_percentage_usd: commission?.commission_percentage_usd || 0,
        utility_percentage_bs: commission?.utility_percentage || 0,
        utility_percentage_usd: commission?.utility_percentage_usd || 0,
        total_bs: 0,
        total_usd: 0,
        hasSubcategories: hasSubcats,
        subcategories,
      };
      parentData.total_bs = parentData.sales_bs * (parentData.commission_percentage_bs / 100);
      parentData.total_usd = parentData.sales_usd * (parentData.commission_percentage_usd / 100);

      return parentData;
    });

    setSystemsData(initialData.sort((a, b) => a.system_name.localeCompare(b.system_name)));
    setDataLoaded(true);
  };

  const updateSystemValue = (
    systemId: string,
    field: keyof SystemData,
    value: number,
    isSubcategory: boolean = false,
    parentId?: string,
  ) => {
    setSystemsData((prevData) => {
      return prevData.map((sys) => {
        if (isSubcategory && sys.system_id === parentId && sys.subcategories) {
          const updatedSubs = sys.subcategories.map((sub) => {
            if (sub.system_id === systemId) {
              const updated = { ...sub, [field]: value };
              updated.total_bs = updated.sales_bs * (updated.commission_percentage_bs / 100);
              updated.total_usd = updated.sales_usd * (updated.commission_percentage_usd / 100);
              return updated;
            }
            return sub;
          });

          // Recalculate parent totals
          const parentUpdated = { ...sys, subcategories: updatedSubs };
          parentUpdated.sales_bs = updatedSubs.reduce((sum, s) => sum + s.sales_bs, 0);
          parentUpdated.sales_usd = updatedSubs.reduce((sum, s) => sum + s.sales_usd, 0);
          parentUpdated.prizes_bs = updatedSubs.reduce((sum, s) => sum + s.prizes_bs, 0);
          parentUpdated.prizes_usd = updatedSubs.reduce((sum, s) => sum + s.prizes_usd, 0);
          parentUpdated.total_bs = parentUpdated.sales_bs * (parentUpdated.commission_percentage_bs / 100);
          parentUpdated.total_usd = parentUpdated.sales_usd * (parentUpdated.commission_percentage_usd / 100);

          return parentUpdated;
        } else if (!isSubcategory && sys.system_id === systemId) {
          const updated = { ...sys, [field]: value };
          if (!updated.hasSubcategories) {
            updated.total_bs = updated.sales_bs * (updated.commission_percentage_bs / 100);
            updated.total_usd = updated.sales_usd * (updated.commission_percentage_usd / 100);
          }
          return updated;
        }
        return sys;
      });
    });
  };

  const resetAllValues = () => {
    localStorage.removeItem(STORAGE_KEY);
    setDataLoaded(false);
    setInputValues({});
    initializeSystemsData(lotterySystems, true);
  };

  // Handle input change (just update the display value)
  const handleInputChange = (key: string, value: string) => {
    setInputValues((prev) => ({ ...prev, [key]: value }));
  };

  // Handle input blur (parse and update the actual data)
  const handleInputBlur = (
    systemId: string,
    field: "sales" | "prizes",
    isSubcategory: boolean = false,
    parentId?: string
  ) => {
    const key = getInputKey(systemId, field, isSubcategory);
    const value = inputValues[key] || "";
    const numValue = parseInputValue(value);

    const dataField = currency === "bs" 
      ? (field === "sales" ? "sales_bs" : "prizes_bs")
      : (field === "sales" ? "sales_usd" : "prizes_usd");

    updateSystemValue(systemId, dataField as keyof SystemData, numValue, isSubcategory, parentId);

    // Format the value
    const formattedValue = formatNumber(numValue);
    setInputValues((prev) => ({ ...prev, [key]: formattedValue }));
  };

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
        acc.commission_bs += sys.total_bs;
        acc.commission_usd += sys.total_usd;
        acc.subtotal_bs += subtotal_bs;
        acc.subtotal_usd += subtotal_usd;
        acc.participation_bs += participation_bs;
        acc.participation_usd += participation_usd;
        acc.final_total_bs += final_total_bs;
        acc.final_total_usd += final_total_usd;
        return acc;
      },
      {
        sales_bs: 0,
        sales_usd: 0,
        prizes_bs: 0,
        prizes_usd: 0,
        commission_bs: 0,
        commission_usd: 0,
        subtotal_bs: 0,
        subtotal_usd: 0,
        participation_bs: 0,
        participation_usd: 0,
        final_total_bs: 0,
        final_total_usd: 0,
      },
    );
  }, [systemsData]);

  if (commissionsLoading) {
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
          <h1 className="text-3xl font-bold text-foreground">Resumen Operadoras</h1>
          <p className="text-muted-foreground">Ingresa ventas y premios manualmente para visualizar resultados</p>
        </div>
        <Button onClick={resetAllValues} variant="outline" size="sm">
          <RefreshCcw className="h-4 w-4 mr-2" />
          Limpiar Todo
        </Button>
      </div>

      {/* Cuadros de resumen de utilidades */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-2 border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 to-emerald-500/5">
          <CardContent className="pt-6">
            <div className="flex items-start justify-between mb-2">
              <div className="p-2 bg-emerald-500/10 rounded-lg">
                <TrendingUp className="h-5 w-5 text-emerald-600" />
              </div>
            </div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">GANANCIA TOTAL</p>
            <div className="space-y-0.5">
              <p className="text-xl font-bold text-emerald-600 font-mono">
                {formatCurrency(grandTotals.commission_bs + grandTotals.participation_bs, "VES")}
              </p>
              <p className="text-sm font-semibold text-emerald-600/70 font-mono">
                {formatCurrency(grandTotals.commission_usd + grandTotals.participation_usd, "USD")}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 border-yellow-500/20 bg-gradient-to-br from-yellow-500/10 to-yellow-500/5">
          <CardContent className="pt-6">
            <div className="flex items-start justify-between mb-2">
              <div className="p-2 bg-yellow-500/10 rounded-lg">
                <DollarSign className="h-5 w-5 text-yellow-600" />
              </div>
            </div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
              GANANCIA POR COMISIÓN
            </p>
            <div className="space-y-0.5">
              <p className="text-xl font-bold text-yellow-600 font-mono">
                {formatCurrency(grandTotals.commission_bs, "VES")}
              </p>
              <p className="text-sm font-semibold text-yellow-600/70 font-mono">
                {formatCurrency(grandTotals.commission_usd, "USD")}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 border-purple-500/20 bg-gradient-to-br from-purple-500/10 to-purple-500/5">
          <CardContent className="pt-6">
            <div className="flex items-start justify-between mb-2">
              <div className="p-2 bg-purple-500/10 rounded-lg">
                <DollarSign className="h-5 w-5 text-purple-600" />
              </div>
            </div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">GANANCIA POR PARTICIPACIÓN</p>
            <div className="space-y-0.5">
              <p className="text-xl font-bold text-purple-600 font-mono">
                {formatCurrency(grandTotals.participation_bs, "VES")}
              </p>
              <p className="text-sm font-semibold text-purple-600/70 font-mono">
                {formatCurrency(grandTotals.participation_usd, "USD")}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Datos Manuales</CardTitle>
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
                  <TableHead className="text-right font-bold">Sistema</TableHead>
                  <TableHead className="text-right font-bold">
                    {currency === "bs" ? "Ventas Bs" : "Ventas USD"}
                  </TableHead>
                  <TableHead className="text-right font-bold">
                    {currency === "bs" ? "Premios Bs" : "Premios USD"}
                  </TableHead>
                  <TableHead className="text-right font-bold">% Comisión</TableHead>
                  <TableHead className="text-right font-bold bg-yellow-500/20">
                    {currency === "bs" ? "Comisión Bs" : "Comisión USD"}
                  </TableHead>
                  <TableHead className="text-right font-bold">% Participación</TableHead>
                  <TableHead className="text-right font-bold bg-purple-500/20">
                    {currency === "bs" ? "Participación Bs" : "Participación USD"}
                  </TableHead>
                  <TableHead className="text-right font-bold font-semibold">
                    {currency === "bs" ? "SUB TOTAL Bs" : "SUB TOTAL USD"}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {systemsData.map((sys) => {
                  const sales = currency === "bs" ? sys.sales_bs : sys.sales_usd;
                  const prizes = currency === "bs" ? sys.prizes_bs : sys.prizes_usd;
                  const net = sales - prizes;
                  const commission = currency === "bs" ? sys.total_bs : sys.total_usd;
                  const subtotal = net - commission;
                  const commissionPercentage =
                    currency === "bs" ? sys.commission_percentage_bs : sys.commission_percentage_usd;
                  const utilityPercentage = currency === "bs" ? sys.utility_percentage_bs : sys.utility_percentage_usd;
                  const participation = subtotal * (utilityPercentage / 100);
                  const finalTotal = subtotal - participation;
                  const isExpanded = expandedSystems.has(sys.system_id);

                  return (
                    <>
                      <TableRow key={sys.system_id} className="hover:bg-muted/50">
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {sys.hasSubcategories && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => toggleSystem(sys.system_id)}
                                className="h-6 w-6 p-0"
                              >
                                {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                              </Button>
                            )}
                            {sys.system_name}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          {!sys.hasSubcategories && (
                            <Input
                              type="text"
                              placeholder="0,00"
                              value={inputValues[getInputKey(sys.system_id, "sales")] || ""}
                              onChange={(e) =>
                                handleInputChange(getInputKey(sys.system_id, "sales"), e.target.value)
                              }
                              onBlur={() => handleInputBlur(sys.system_id, "sales")}
                              className="w-32 text-right"
                            />
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {!sys.hasSubcategories && (
                            <Input
                              type="text"
                              placeholder="0,00"
                              value={inputValues[getInputKey(sys.system_id, "prizes")] || ""}
                              onChange={(e) =>
                                handleInputChange(getInputKey(sys.system_id, "prizes"), e.target.value)
                              }
                              onBlur={() => handleInputBlur(sys.system_id, "prizes")}
                              className="w-32 text-right"
                            />
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {!sys.hasSubcategories && (
                            <span className="font-mono">{commissionPercentage.toFixed(2)}%</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right bg-yellow-500/10">
                          {!sys.hasSubcategories && (
                            <span className="font-mono">
                              {formatCurrency(commission, currency === "bs" ? "VES" : "USD")}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {!sys.hasSubcategories && (
                            <span className="font-mono">{utilityPercentage.toFixed(2)}%</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right bg-purple-500/10">
                          {!sys.hasSubcategories && (
                            <span className="font-mono">
                              {formatCurrency(participation, currency === "bs" ? "VES" : "USD")}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {!sys.hasSubcategories && (
                            <span
                              className={`font-mono font-semibold ${subtotal >= 0 ? "text-blue-600" : "text-red-600"}`}
                            >
                              {formatCurrency(subtotal, currency === "bs" ? "VES" : "USD")}
                            </span>
                          )}
                        </TableCell>
                      </TableRow>

                      {/* Subcategories */}
                      {isExpanded &&
                        sys.subcategories &&
                        sys.subcategories.map((sub) => {
                          const subSales = currency === "bs" ? sub.sales_bs : sub.sales_usd;
                          const subPrizes = currency === "bs" ? sub.prizes_bs : sub.prizes_usd;
                          const subNet = subSales - subPrizes;
                          const subCommission = currency === "bs" ? sub.total_bs : sub.total_usd;
                          const subSubtotal = subNet - subCommission;
                          const subCommissionPercentage =
                            currency === "bs" ? sub.commission_percentage_bs : sub.commission_percentage_usd;

                          return (
                            <TableRow key={sub.system_id} className="bg-muted/30 hover:bg-muted/50">
                              <TableCell className="font-medium pl-12">
                                <span className="text-sm text-muted-foreground">↳</span> {sub.system_name}
                              </TableCell>
                              <TableCell className="text-right">
                                <Input
                                  type="text"
                                  placeholder="0,00"
                                  value={inputValues[getInputKey(sub.system_id, "sales", true)] || ""}
                                  onChange={(e) =>
                                    handleInputChange(getInputKey(sub.system_id, "sales", true), e.target.value)
                                  }
                                  onBlur={() => handleInputBlur(sub.system_id, "sales", true, sys.system_id)}
                                  className="w-32 text-right text-sm"
                                />
                              </TableCell>
                              <TableCell className="text-right">
                                <Input
                                  type="text"
                                  placeholder="0,00"
                                  value={inputValues[getInputKey(sub.system_id, "prizes", true)] || ""}
                                  onChange={(e) =>
                                    handleInputChange(getInputKey(sub.system_id, "prizes", true), e.target.value)
                                  }
                                  onBlur={() => handleInputBlur(sub.system_id, "prizes", true, sys.system_id)}
                                  className="w-32 text-right text-sm"
                                />
                              </TableCell>
                              <TableCell className="text-right font-mono text-sm">
                                {subCommissionPercentage.toFixed(2)}%
                              </TableCell>
                              <TableCell className="text-right font-mono text-sm bg-yellow-500/10">
                                {formatCurrency(subCommission, currency === "bs" ? "VES" : "USD")}
                              </TableCell>
                              <TableCell className="text-right font-mono text-sm">-</TableCell>
                              <TableCell className="text-right font-mono text-sm">-</TableCell>
                              <TableCell
                                className={`text-right font-mono font-semibold text-sm ${subSubtotal >= 0 ? "text-blue-600" : "text-red-600"}`}
                              >
                                {formatCurrency(subSubtotal, currency === "bs" ? "VES" : "USD")}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                    </>
                  );
                })}

                {/* Grand Totals Row */}
                <TableRow className="font-bold bg-primary/5 border-t-2 border-primary">
                  <TableCell className="text-primary">TOTALES</TableCell>
                  <TableCell className="text-right font-mono text-primary">
                    {formatCurrency(
                      currency === "bs" ? grandTotals.sales_bs : grandTotals.sales_usd,
                      currency === "bs" ? "VES" : "USD",
                    )}
                  </TableCell>
                  <TableCell className="text-right font-mono text-red-600">
                    {formatCurrency(
                      currency === "bs" ? grandTotals.prizes_bs : grandTotals.prizes_usd,
                      currency === "bs" ? "VES" : "USD",
                    )}
                  </TableCell>
                  <TableCell></TableCell>
                  <TableCell className="text-right font-mono bg-yellow-500/20">
                    {formatCurrency(
                      currency === "bs" ? grandTotals.commission_bs : grandTotals.commission_usd,
                      currency === "bs" ? "VES" : "USD",
                    )}
                  </TableCell>
                  <TableCell></TableCell>
                  <TableCell className="text-right font-mono bg-purple-500/20">
                    {formatCurrency(
                      currency === "bs" ? grandTotals.participation_bs : grandTotals.participation_usd,
                      currency === "bs" ? "VES" : "USD",
                    )}
                  </TableCell>
                  <TableCell className="text-right font-mono text-blue-600">
                    {formatCurrency(
                      currency === "bs" ? grandTotals.subtotal_bs : grandTotals.subtotal_usd,
                      currency === "bs" ? "VES" : "USD",
                    )}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
