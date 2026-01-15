import { useState, useEffect, useMemo } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChevronDown, ChevronUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { PerSystemTotals } from "@/hooks/useWeeklyCuadre";
import type { CommissionRate } from "@/hooks/useSystemCommissions";

interface Props {
  data: PerSystemTotals[];
  commissions: Map<string, CommissionRate>;
}

interface LotterySystem {
  id: string;
  name: string;
  parent_system_id: string | null;
  has_subcategories: boolean | null;
}

interface ProcessedSystem {
  system_id: string;
  system_name: string;
  sales_bs: number;
  sales_usd: number;
  prizes_bs: number;
  prizes_usd: number;
  hasSubcategories: boolean;
  subcategories: PerSystemTotals[];
}

export function AdminPerSystemTable({ data, commissions }: Props) {
  const [lotterySystems, setLotterySystems] = useState<LotterySystem[]>([]);
  const [expandedSystems, setExpandedSystems] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fetchLotterySystems = async () => {
      const { data: systems, error } = await supabase
        .from("lottery_systems")
        .select("id, name, parent_system_id, has_subcategories")
        .eq("is_active", true);

      if (!error && systems) {
        setLotterySystems(systems);
      }
    };
    fetchLotterySystems();
  }, []);

  const toggleSystem = (systemId: string) => {
    const newExpanded = new Set(expandedSystems);
    if (newExpanded.has(systemId)) {
      newExpanded.delete(systemId);
    } else {
      newExpanded.add(systemId);
    }
    setExpandedSystems(newExpanded);
  };

  // Process data to group subcategories under their parents
  const processedData = useMemo(() => {
    if (!lotterySystems.length || !data?.length) return [];

    const systemIdToParentMap = new Map<string, string>();
    const parentSystemsMap = new Map<string, ProcessedSystem>();

    // Build mapping: subcategory -> parent
    lotterySystems.forEach((sys) => {
      if (sys.parent_system_id) {
        systemIdToParentMap.set(sys.id, sys.parent_system_id);
      }
    });

    // Initialize parent systems
    lotterySystems.forEach((sys) => {
      if (!sys.parent_system_id) {
        parentSystemsMap.set(sys.id, {
          system_id: sys.id,
          system_name: sys.name,
          sales_bs: 0,
          sales_usd: 0,
          prizes_bs: 0,
          prizes_usd: 0,
          hasSubcategories: sys.has_subcategories || false,
          subcategories: [],
        });
      }
    });

    // Process data - aggregate subcategories into parents
    data.forEach((sys) => {
      const parentId = systemIdToParentMap.get(sys.system_id);

      if (parentId) {
        // This is a subcategory
        const parent = parentSystemsMap.get(parentId);
        if (parent) {
          // Add to parent totals
          parent.sales_bs += sys.sales_bs;
          parent.sales_usd += sys.sales_usd;
          parent.prizes_bs += sys.prizes_bs;
          parent.prizes_usd += sys.prizes_usd;

          // Add to subcategories list
          const existingSubcat = parent.subcategories.find(s => s.system_id === sys.system_id);
          if (existingSubcat) {
            existingSubcat.sales_bs += sys.sales_bs;
            existingSubcat.sales_usd += sys.sales_usd;
            existingSubcat.prizes_bs += sys.prizes_bs;
            existingSubcat.prizes_usd += sys.prizes_usd;
          } else {
            parent.subcategories.push({ ...sys });
          }
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

    // Filter systems with activity and sort
    return Array.from(parentSystemsMap.values())
      .filter(sys => sys.sales_bs > 0 || sys.sales_usd > 0 || sys.prizes_bs > 0 || sys.prizes_usd > 0)
      .sort((a, b) => a.system_name.localeCompare(b.system_name));
  }, [data, lotterySystems]);

  // Calculate totals from processed data
  const totalsBs = useMemo(() => {
    return processedData.reduce(
      (acc, sys) => {
        const cuadre_bs = sys.sales_bs - sys.prizes_bs;
        
        // Calculate commission from subcategories if has them, otherwise from parent
        let comision_bs = 0;
        if (sys.hasSubcategories && sys.subcategories.length > 0) {
          comision_bs = sys.subcategories.reduce((sum, sub) => {
            const subCommission = commissions.get(sub.system_id);
            return sum + (subCommission ? sub.sales_bs * (subCommission.commission_percentage / 100) : 0);
          }, 0);
        } else {
          const commission = commissions.get(sys.system_id);
          comision_bs = commission ? sys.sales_bs * (commission.commission_percentage / 100) : 0;
        }

        const subtotal_bs = cuadre_bs - comision_bs;

        acc.sales_bs += sys.sales_bs;
        acc.prizes_bs += sys.prizes_bs;
        acc.comision_bs += comision_bs;
        acc.subtotal_bs += subtotal_bs;
        return acc;
      },
      { sales_bs: 0, prizes_bs: 0, comision_bs: 0, subtotal_bs: 0 }
    );
  }, [processedData, commissions]);

  const totalsUsd = useMemo(() => {
    return processedData.reduce(
      (acc, sys) => {
        const cuadre_usd = sys.sales_usd - sys.prizes_usd;
        
        // Calculate commission from subcategories if has them, otherwise from parent
        let comision_usd = 0;
        if (sys.hasSubcategories && sys.subcategories.length > 0) {
          comision_usd = sys.subcategories.reduce((sum, sub) => {
            const subCommission = commissions.get(sub.system_id);
            return sum + (subCommission ? sub.sales_usd * (subCommission.commission_percentage_usd / 100) : 0);
          }, 0);
        } else {
          const commission = commissions.get(sys.system_id);
          comision_usd = commission ? sys.sales_usd * (commission.commission_percentage_usd / 100) : 0;
        }

        const subtotal_usd = cuadre_usd - comision_usd;

        acc.sales_usd += sys.sales_usd;
        acc.prizes_usd += sys.prizes_usd;
        acc.comision_usd += comision_usd;
        acc.subtotal_usd += subtotal_usd;
        return acc;
      },
      { sales_usd: 0, prizes_usd: 0, comision_usd: 0, subtotal_usd: 0 }
    );
  }, [processedData, commissions]);

  if (!data?.length) return null;

  const renderBolivaresTable = () => (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Sistema</TableHead>
            <TableHead className="text-right">Ventas Bs</TableHead>
            <TableHead className="text-right">Premios Bs</TableHead>
            <TableHead className="text-right">Cuadre Bs</TableHead>
            <TableHead className="text-right">% Comisión</TableHead>
            <TableHead className="text-right bg-yellow-500/20">Comisión Bs</TableHead>
            <TableHead className="text-right font-semibold">SUB TOTAL Bs</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {processedData.map((sys) => {
            const cuadre_bs = sys.sales_bs - sys.prizes_bs;
            const hasSubs = sys.hasSubcategories && sys.subcategories.length > 0;
            const isExpanded = expandedSystems.has(sys.system_id);

            // Calculate commission
            let comision_bs = 0;
            let commission_percentage_bs = 0;

            if (hasSubs) {
              comision_bs = sys.subcategories.reduce((sum, sub) => {
                const subCommission = commissions.get(sub.system_id);
                return sum + (subCommission ? sub.sales_bs * (subCommission.commission_percentage / 100) : 0);
              }, 0);
              commission_percentage_bs = -1; // Indicates "varies"
            } else {
              const commission = commissions.get(sys.system_id);
              commission_percentage_bs = commission?.commission_percentage || 0;
              comision_bs = sys.sales_bs * (commission_percentage_bs / 100);
            }

            const subtotal_bs = cuadre_bs - comision_bs;

            return (
              <>
                <TableRow 
                  key={sys.system_id} 
                  className={hasSubs ? "cursor-pointer hover:bg-muted/50" : ""}
                  onClick={hasSubs ? () => toggleSystem(sys.system_id) : undefined}
                >
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {hasSubs && (
                        isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                      )}
                      {sys.system_name}
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-mono">{formatCurrency(sys.sales_bs, "VES")}</TableCell>
                  <TableCell className="text-right font-mono">{formatCurrency(sys.prizes_bs, "VES")}</TableCell>
                  <TableCell className="text-right font-mono font-semibold">{formatCurrency(cuadre_bs, "VES")}</TableCell>
                  <TableCell className="text-right font-mono">
                    {commission_percentage_bs === -1 ? "Varía" : `${commission_percentage_bs.toFixed(2)}%`}
                  </TableCell>
                  <TableCell className="text-right font-mono font-bold bg-yellow-500/20">
                    {formatCurrency(comision_bs, "VES")}
                  </TableCell>
                  <TableCell className="text-right font-mono font-semibold text-primary">
                    {formatCurrency(subtotal_bs, "VES")}
                  </TableCell>
                </TableRow>
                {hasSubs && isExpanded && sys.subcategories.map((sub) => {
                  const subCuadre = sub.sales_bs - sub.prizes_bs;
                  const subCommission = commissions.get(sub.system_id);
                  const subCommissionPct = subCommission?.commission_percentage || 0;
                  const subComisionBs = sub.sales_bs * (subCommissionPct / 100);
                  const subSubtotal = subCuadre - subComisionBs;

                  return (
                    <TableRow key={sub.system_id} className="bg-muted/20">
                      <TableCell className="font-medium pl-10 text-muted-foreground">
                        ↳ {sub.system_name}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">{formatCurrency(sub.sales_bs, "VES")}</TableCell>
                      <TableCell className="text-right font-mono text-sm">{formatCurrency(sub.prizes_bs, "VES")}</TableCell>
                      <TableCell className="text-right font-mono text-sm">{formatCurrency(subCuadre, "VES")}</TableCell>
                      <TableCell className="text-right font-mono text-sm">{subCommissionPct.toFixed(2)}%</TableCell>
                      <TableCell className="text-right font-mono text-sm bg-yellow-500/10">
                        {formatCurrency(subComisionBs, "VES")}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm text-primary/70">
                        {formatCurrency(subSubtotal, "VES")}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </>
            );
          })}
          <TableRow className="bg-muted/50 font-bold">
            <TableCell className="font-semibold">Totales</TableCell>
            <TableCell className="text-right font-mono font-semibold">{formatCurrency(totalsBs.sales_bs, "VES")}</TableCell>
            <TableCell className="text-right font-mono font-semibold">{formatCurrency(totalsBs.prizes_bs, "VES")}</TableCell>
            <TableCell className="text-right font-mono font-semibold">{formatCurrency(totalsBs.sales_bs - totalsBs.prizes_bs, "VES")}</TableCell>
            <TableCell className="text-right font-mono font-semibold">-</TableCell>
            <TableCell className="text-right font-mono font-bold bg-yellow-500/20">
              {formatCurrency(totalsBs.comision_bs, "VES")}
            </TableCell>
            <TableCell className="text-right font-mono font-semibold text-primary">
              {formatCurrency(totalsBs.subtotal_bs, "VES")}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );

  const renderDolaresTable = () => (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Sistema</TableHead>
            <TableHead className="text-right">Ventas USD</TableHead>
            <TableHead className="text-right">Premios USD</TableHead>
            <TableHead className="text-right">Cuadre USD</TableHead>
            <TableHead className="text-right">% Comisión</TableHead>
            <TableHead className="text-right bg-yellow-500/20">Comisión USD</TableHead>
            <TableHead className="text-right font-semibold">SUB TOTAL USD</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {processedData.map((sys) => {
            const cuadre_usd = sys.sales_usd - sys.prizes_usd;
            const hasSubs = sys.hasSubcategories && sys.subcategories.length > 0;
            const isExpanded = expandedSystems.has(sys.system_id);

            // Calculate commission
            let comision_usd = 0;
            let commission_percentage_usd = 0;

            if (hasSubs) {
              comision_usd = sys.subcategories.reduce((sum, sub) => {
                const subCommission = commissions.get(sub.system_id);
                return sum + (subCommission ? sub.sales_usd * (subCommission.commission_percentage_usd / 100) : 0);
              }, 0);
              commission_percentage_usd = -1; // Indicates "varies"
            } else {
              const commission = commissions.get(sys.system_id);
              commission_percentage_usd = commission?.commission_percentage_usd || 0;
              comision_usd = sys.sales_usd * (commission_percentage_usd / 100);
            }

            const subtotal_usd = cuadre_usd - comision_usd;

            return (
              <>
                <TableRow 
                  key={sys.system_id} 
                  className={hasSubs ? "cursor-pointer hover:bg-muted/50" : ""}
                  onClick={hasSubs ? () => toggleSystem(sys.system_id) : undefined}
                >
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {hasSubs && (
                        isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                      )}
                      {sys.system_name}
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-mono">{formatCurrency(sys.sales_usd, "USD")}</TableCell>
                  <TableCell className="text-right font-mono">{formatCurrency(sys.prizes_usd, "USD")}</TableCell>
                  <TableCell className="text-right font-mono font-semibold">{formatCurrency(cuadre_usd, "USD")}</TableCell>
                  <TableCell className="text-right font-mono">
                    {commission_percentage_usd === -1 ? "Varía" : `${commission_percentage_usd.toFixed(2)}%`}
                  </TableCell>
                  <TableCell className="text-right font-mono font-bold bg-yellow-500/20">
                    {formatCurrency(comision_usd, "USD")}
                  </TableCell>
                  <TableCell className="text-right font-mono font-semibold text-primary">
                    {formatCurrency(subtotal_usd, "USD")}
                  </TableCell>
                </TableRow>
                {hasSubs && isExpanded && sys.subcategories.map((sub) => {
                  const subCuadre = sub.sales_usd - sub.prizes_usd;
                  const subCommission = commissions.get(sub.system_id);
                  const subCommissionPct = subCommission?.commission_percentage_usd || 0;
                  const subComisionUsd = sub.sales_usd * (subCommissionPct / 100);
                  const subSubtotal = subCuadre - subComisionUsd;

                  return (
                    <TableRow key={sub.system_id} className="bg-muted/20">
                      <TableCell className="font-medium pl-10 text-muted-foreground">
                        ↳ {sub.system_name}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">{formatCurrency(sub.sales_usd, "USD")}</TableCell>
                      <TableCell className="text-right font-mono text-sm">{formatCurrency(sub.prizes_usd, "USD")}</TableCell>
                      <TableCell className="text-right font-mono text-sm">{formatCurrency(subCuadre, "USD")}</TableCell>
                      <TableCell className="text-right font-mono text-sm">{subCommissionPct.toFixed(2)}%</TableCell>
                      <TableCell className="text-right font-mono text-sm bg-yellow-500/10">
                        {formatCurrency(subComisionUsd, "USD")}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm text-primary/70">
                        {formatCurrency(subSubtotal, "USD")}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </>
            );
          })}
          <TableRow className="bg-muted/50 font-bold">
            <TableCell className="font-semibold">Totales</TableCell>
            <TableCell className="text-right font-mono font-semibold">{formatCurrency(totalsUsd.sales_usd, "USD")}</TableCell>
            <TableCell className="text-right font-mono font-semibold">{formatCurrency(totalsUsd.prizes_usd, "USD")}</TableCell>
            <TableCell className="text-right font-mono font-semibold">{formatCurrency(totalsUsd.sales_usd - totalsUsd.prizes_usd, "USD")}</TableCell>
            <TableCell className="text-right font-mono font-semibold">-</TableCell>
            <TableCell className="text-right font-mono font-bold bg-yellow-500/20">
              {formatCurrency(totalsUsd.comision_usd, "USD")}
            </TableCell>
            <TableCell className="text-right font-mono font-semibold text-primary">
              {formatCurrency(totalsUsd.subtotal_usd, "USD")}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );

  return (
    <Tabs defaultValue="bolivares" className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="bolivares">Bolívares</TabsTrigger>
        <TabsTrigger value="dolares">Dólares</TabsTrigger>
      </TabsList>

      <TabsContent value="bolivares" className="mt-4">
        {renderBolivaresTable()}
      </TabsContent>

      <TabsContent value="dolares" className="mt-4">
        {renderDolaresTable()}
      </TabsContent>
    </Tabs>
  );
}
