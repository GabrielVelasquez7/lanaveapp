import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useSystemCommissions } from '@/hooks/useSystemCommissions';
import { formatCurrency } from '@/lib/utils';
import { formatDateForDB } from '@/lib/dateUtils';
import { format, startOfWeek, endOfWeek, addWeeks } from 'date-fns';
import { es } from 'date-fns/locale';
import { CalendarIcon, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Users, DollarSign, Award, TrendingUp, Banknote, Coins, Globe } from 'lucide-react';

interface Client {
  id: string;
  name: string;
}

interface LotterySystem {
  id: string;
  name: string;
  code: string;
}

interface ClientSystemConfig {
  commission_bs: number;
  commission_usd: number;
  participation_bs: number;
  participation_usd: number;
  lanave_participation_bs: number;
  lanave_participation_usd: number;
}

interface ClientLanaveConfig {
  lanave_participation_bs: number;
  lanave_participation_usd: number;
}

interface SystemRow {
  lottery_system_id: string;
  lottery_system_name: string;
  sales_bs: number;
  sales_usd: number;
  prizes_bs: number;
  prizes_usd: number;
  commission_bs: number;
  commission_usd: number;
  participation_bs: number;
  participation_usd: number;
  lanave_bs: number;
  lanave_usd: number;
  final_bs: number;
  final_usd: number;
}

interface ClientRow {
  client_id: string;
  client_name: string;
  sales_bs: number;
  sales_usd: number;
  prizes_bs: number;
  prizes_usd: number;
  commission_bs: number;
  commission_usd: number;
  participation_bs: number;
  participation_usd: number;
  lanave_bs: number;
  lanave_usd: number;
  final_bs: number;
  final_usd: number;
  systems: SystemRow[];
}

const parleySystemCodes = [
  'INMEJORABLE-MULTIS-1', 'INMEJORABLE-MULTIS-2', 'INMEJORABLE-MULTIS-3', 'INMEJORABLE-MULTIS-4',
  'INMEJORABLE-5Y6', 'POLLA', 'MULTISPORT-CABALLOS-NAC', 'MULTISPORT-CABALLOS-INT', 'MULTISPORT-5Y6'
];

export const BanqueoGeneralView = () => {
  const [currencyTab, setCurrencyTab] = useState('bolivares');
  const [clients, setClients] = useState<Client[]>([]);
  const [lotteryOptions, setLotteryOptions] = useState<LotterySystem[]>([]);
  const [clientRows, setClientRows] = useState<ClientRow[]>([]);
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  const [currentWeek, setCurrentWeek] = useState<{ start: Date; end: Date }>(() => {
    const saved = localStorage.getItem('banqueo-general:currentWeek');
    if (saved) {
      const { start, end } = JSON.parse(saved);
      return { start: new Date(start), end: new Date(end) };
    }
    const now = new Date();
    return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) };
  });

  const { toast } = useToast();
  const { commissions } = useSystemCommissions();

  useEffect(() => {
    localStorage.setItem('banqueo-general:currentWeek', JSON.stringify({
      start: currentWeek.start.toISOString(),
      end: currentWeek.end.toISOString(),
    }));
  }, [currentWeek]);

  useEffect(() => {
    const fetchInitial = async () => {
      try {
        const [clientsRes, systemsRes] = await Promise.all([
          supabase.from('clients').select('id, name').eq('is_active', true).order('name'),
          supabase.from('lottery_systems').select('id, name, code, parent_system_id, has_subcategories').eq('is_active', true).order('name'),
        ]);
        if (clientsRes.error) throw clientsRes.error;
        if (systemsRes.error) throw systemsRes.error;
        setClients(clientsRes.data || []);
        const filtered = (systemsRes.data || []).filter(s => s.parent_system_id || !s.has_subcategories);
        setLotteryOptions(filtered);
      } catch (error: any) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
      }
    };
    fetchInitial();
  }, [toast]);

  useEffect(() => {
    if (clients.length === 0 || lotteryOptions.length === 0) return;
    loadAllData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clients, currentWeek, lotteryOptions.length, commissions]);

  const loadAllData = async () => {
    setLoading(true);
    try {
      const clientIds = clients.map(c => c.id);
      const weekStartStr = formatDateForDB(currentWeek.start);
      const weekEndStr = formatDateForDB(currentWeek.end);

      const [txRes, sysConfigRes, lanaveRes] = await Promise.all([
        supabase.from('banqueo_transactions').select('*').in('client_id', clientIds).eq('week_start_date', weekStartStr).eq('week_end_date', weekEndStr),
        supabase.from('client_system_participation').select('*').in('client_id', clientIds).eq('is_active', true),
        supabase.from('client_banqueo_commissions').select('*').in('client_id', clientIds).eq('is_active', true),
      ]);

      if (txRes.error) throw txRes.error;
      if (sysConfigRes.error) throw sysConfigRes.error;
      if (lanaveRes.error) throw lanaveRes.error;

      // Build per-client system config maps
      const clientSystemConfigsMap = new Map<string, Map<string, ClientSystemConfig>>();
      (sysConfigRes.data || []).forEach(cfg => {
        if (!clientSystemConfigsMap.has(cfg.client_id)) {
          clientSystemConfigsMap.set(cfg.client_id, new Map());
        }
        clientSystemConfigsMap.get(cfg.client_id)!.set(cfg.lottery_system_id, {
          commission_bs: Number(cfg.client_commission_percentage_bs || 0),
          commission_usd: Number(cfg.client_commission_percentage_usd || 0),
          participation_bs: Number(cfg.participation_percentage_bs || 0),
          participation_usd: Number(cfg.participation_percentage_usd || 0),
          lanave_participation_bs: Number(cfg.lanave_participation_percentage_bs || 0),
          lanave_participation_usd: Number(cfg.lanave_participation_percentage_usd || 0),
        });
      });

      const clientLanaveMap = new Map<string, ClientLanaveConfig>();
      (lanaveRes.data || []).forEach(cfg => {
        clientLanaveMap.set(cfg.client_id, {
          lanave_participation_bs: Number(cfg.lanave_participation_percentage_bs || 0),
          lanave_participation_usd: Number(cfg.lanave_participation_percentage_usd || 0),
        });
      });

      // Group transactions by client
      const txByClient = new Map<string, typeof txRes.data>();
      (txRes.data || []).forEach(tx => {
        if (!txByClient.has(tx.client_id)) txByClient.set(tx.client_id, []);
        txByClient.get(tx.client_id)!.push(tx);
      });

      // Build client rows
      const rows: ClientRow[] = [];
      for (const client of clients) {
        const clientTx = txByClient.get(client.id) || [];
        if (clientTx.length === 0) continue; // Skip clients with no data

        const systemsMap = new Map<string, SystemRow>();
        lotteryOptions.forEach(sys => {
          systemsMap.set(sys.id, {
            lottery_system_id: sys.id,
            lottery_system_name: sys.name,
            sales_bs: 0, sales_usd: 0, prizes_bs: 0, prizes_usd: 0,
            commission_bs: 0, commission_usd: 0,
            participation_bs: 0, participation_usd: 0,
            lanave_bs: 0, lanave_usd: 0,
            final_bs: 0, final_usd: 0,
          });
        });

        let clientTotals = {
          sales_bs: 0, sales_usd: 0, prizes_bs: 0, prizes_usd: 0,
          commission_bs: 0, commission_usd: 0,
          participation_bs: 0, participation_usd: 0,
          lanave_bs: 0, lanave_usd: 0,
          final_bs: 0, final_usd: 0,
        };

        clientTx.forEach(tx => {
          if (!tx.lottery_system_id) return;
          const row = systemsMap.get(tx.lottery_system_id);
          if (!row) return;

          const salesBs = Number(tx.sales_bs || 0);
          const salesUsd = Number(tx.sales_usd || 0);
          const prizesBs = Number(tx.prizes_bs || 0);
          const prizesUsd = Number(tx.prizes_usd || 0);

          const clientSysConfig = clientSystemConfigsMap.get(tx.client_id)?.get(tx.lottery_system_id);
          const clientLanave = clientLanaveMap.get(tx.client_id);
          const globalCommission = commissions.get(tx.lottery_system_id);

          const commPctBs = (clientSysConfig?.commission_bs && clientSysConfig.commission_bs > 0)
            ? clientSysConfig.commission_bs : (globalCommission?.commission_percentage || 0);
          const commPctUsd = (clientSysConfig?.commission_usd && clientSysConfig.commission_usd > 0)
            ? clientSysConfig.commission_usd : (globalCommission?.commission_percentage_usd || 0);

          const commBs = salesBs * (commPctBs / 100);
          const commUsd = salesUsd * (commPctUsd / 100);
          const cuadreBs = salesBs - prizesBs;
          const cuadreUsd = salesUsd - prizesUsd;
          const subtotalBs = cuadreBs - commBs;
          const subtotalUsd = cuadreUsd - commUsd;

          const partPctBs = clientSysConfig?.participation_bs || Number(tx.participation_percentage || 0);
          const partPctUsd = clientSysConfig?.participation_usd || Number(tx.participation_percentage || 0);
          const partBs = subtotalBs * (partPctBs / 100);
          const partUsd = subtotalUsd * (partPctUsd / 100);

          const lanavePctBs = clientSysConfig?.lanave_participation_bs || clientLanave?.lanave_participation_bs || 0;
          const lanavePctUsd = clientSysConfig?.lanave_participation_usd || clientLanave?.lanave_participation_usd || 0;
          const lanaveBs = subtotalBs * (lanavePctBs / 100);
          const lanaveUsd = subtotalUsd * (lanavePctUsd / 100);

          const finalBs = subtotalBs - partBs - lanaveBs;
          const finalUsd = subtotalUsd - partUsd - lanaveUsd;

          row.sales_bs += salesBs; row.sales_usd += salesUsd;
          row.prizes_bs += prizesBs; row.prizes_usd += prizesUsd;
          row.commission_bs += commBs; row.commission_usd += commUsd;
          row.participation_bs += partBs; row.participation_usd += partUsd;
          row.lanave_bs += lanaveBs; row.lanave_usd += lanaveUsd;
          row.final_bs += finalBs; row.final_usd += finalUsd;

          clientTotals.sales_bs += salesBs; clientTotals.sales_usd += salesUsd;
          clientTotals.prizes_bs += prizesBs; clientTotals.prizes_usd += prizesUsd;
          clientTotals.commission_bs += commBs; clientTotals.commission_usd += commUsd;
          clientTotals.participation_bs += partBs; clientTotals.participation_usd += partUsd;
          clientTotals.lanave_bs += lanaveBs; clientTotals.lanave_usd += lanaveUsd;
          clientTotals.final_bs += finalBs; clientTotals.final_usd += finalUsd;
        });

        rows.push({
          client_id: client.id,
          client_name: client.name,
          ...clientTotals,
          systems: Array.from(systemsMap.values()).filter(s => s.sales_bs > 0 || s.sales_usd > 0 || s.prizes_bs > 0 || s.prizes_usd > 0),
        });
      }

      setClientRows(rows);
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const navigateWeek = (direction: 'prev' | 'next') => {
    const newStart = addWeeks(currentWeek.start, direction === 'next' ? 1 : -1);
    const newEnd = endOfWeek(newStart, { weekStartsOn: 1 });
    setCurrentWeek({ start: newStart, end: newEnd });
  };

  const toggleClient = (clientId: string) => {
    setExpandedClients(prev => {
      const next = new Set(prev);
      if (next.has(clientId)) next.delete(clientId);
      else next.add(clientId);
      return next;
    });
  };

  const grandTotals = useMemo(() => {
    return clientRows.reduce(
      (acc, r) => ({
        sales_bs: acc.sales_bs + r.sales_bs,
        sales_usd: acc.sales_usd + r.sales_usd,
        prizes_bs: acc.prizes_bs + r.prizes_bs,
        prizes_usd: acc.prizes_usd + r.prizes_usd,
        commission_bs: acc.commission_bs + r.commission_bs,
        commission_usd: acc.commission_usd + r.commission_usd,
        participation_bs: acc.participation_bs + r.participation_bs,
        participation_usd: acc.participation_usd + r.participation_usd,
        lanave_bs: acc.lanave_bs + r.lanave_bs,
        lanave_usd: acc.lanave_usd + r.lanave_usd,
        final_bs: acc.final_bs + r.final_bs,
        final_usd: acc.final_usd + r.final_usd,
      }),
      { sales_bs: 0, sales_usd: 0, prizes_bs: 0, prizes_usd: 0, commission_bs: 0, commission_usd: 0, participation_bs: 0, participation_usd: 0, lanave_bs: 0, lanave_usd: 0, final_bs: 0, final_usd: 0 }
    );
  }, [clientRows]);

  const renderClientTable = (currency: 'bs' | 'usd') => {
    const cur = currency === 'bs' ? 'VES' : 'USD';
    const filteredRows = clientRows.filter(r => currency === 'bs' ? (r.sales_bs > 0 || r.prizes_bs > 0) : (r.sales_usd > 0 || r.prizes_usd > 0));

    if (filteredRows.length === 0) {
      return <p className="text-center text-muted-foreground py-8">No hay datos para esta semana</p>;
    }

    return (
      <div className="space-y-1">
        {/* Header */}
        <div className="grid grid-cols-8 gap-2 text-xs font-medium text-muted-foreground border-b pb-2 px-2">
          <div className="col-span-2">Cliente</div>
          <div className="text-center">Ventas</div>
          <div className="text-center">Premios</div>
          <div className="text-center">Comisión</div>
          <div className="text-center">Participación</div>
          <div className="text-center">Part. Lanave</div>
          <div className="text-center">A Pagar</div>
        </div>

        {/* Client rows */}
        {filteredRows.map(client => {
          const isExpanded = expandedClients.has(client.client_id);
          const sales = currency === 'bs' ? client.sales_bs : client.sales_usd;
          const prizes = currency === 'bs' ? client.prizes_bs : client.prizes_usd;
          const commission = currency === 'bs' ? client.commission_bs : client.commission_usd;
          const participation = currency === 'bs' ? client.participation_bs : client.participation_usd;
          const lanave = currency === 'bs' ? client.lanave_bs : client.lanave_usd;
          const finalTotal = currency === 'bs' ? client.final_bs : client.final_usd;

          const clientSystemsFiltered = client.systems.filter(s => 
            currency === 'bs' ? (s.sales_bs > 0 || s.prizes_bs > 0) : (s.sales_usd > 0 || s.prizes_usd > 0)
          );

          const normalSys = clientSystemsFiltered.filter(s => {
            const sys = lotteryOptions.find(l => l.id === s.lottery_system_id);
            return !sys || !parleySystemCodes.includes(sys.code);
          });
          const parleySys = clientSystemsFiltered.filter(s => {
            const sys = lotteryOptions.find(l => l.id === s.lottery_system_id);
            return sys && parleySystemCodes.includes(sys.code);
          });

          return (
            <div key={client.client_id}>
              <div
                className="grid grid-cols-8 gap-2 items-center text-sm py-2 px-2 rounded-md hover:bg-muted/50 cursor-pointer border-b"
                onClick={() => toggleClient(client.client_id)}
              >
                <div className="col-span-2 font-semibold flex items-center gap-1">
                  {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                  {client.client_name}
                </div>
                <div className="text-center font-mono text-xs">{formatCurrency(sales, cur)}</div>
                <div className="text-center font-mono text-xs">{formatCurrency(prizes, cur)}</div>
                <div className="text-center font-mono text-xs font-bold bg-yellow-500/20 rounded">{formatCurrency(commission, cur)}</div>
                <div className="text-center font-mono text-xs font-bold bg-emerald-500/20 rounded">{formatCurrency(participation, cur)}</div>
                <div className="text-center font-mono text-xs font-bold bg-orange-500/20 rounded">{formatCurrency(lanave, cur)}</div>
                <div className="text-center font-mono text-xs font-bold text-primary">{formatCurrency(finalTotal, cur)}</div>
              </div>

              {isExpanded && clientSystemsFiltered.length > 0 && (
                <div className="ml-8 mr-2 mb-2 bg-muted/30 rounded-lg p-3 space-y-2">
                  {/* Normal systems */}
                  {normalSys.map(sys => (
                    <div key={sys.lottery_system_id} className="grid grid-cols-7 gap-2 text-xs items-center">
                      <div className="font-medium">{sys.lottery_system_name}</div>
                      <div className="text-center">{formatCurrency(currency === 'bs' ? sys.sales_bs : sys.sales_usd, cur)}</div>
                      <div className="text-center">{formatCurrency(currency === 'bs' ? sys.prizes_bs : sys.prizes_usd, cur)}</div>
                      <div className="text-center bg-yellow-500/10 rounded">{formatCurrency(currency === 'bs' ? sys.commission_bs : sys.commission_usd, cur)}</div>
                      <div className="text-center bg-emerald-500/10 rounded">{formatCurrency(currency === 'bs' ? sys.participation_bs : sys.participation_usd, cur)}</div>
                      <div className="text-center bg-orange-500/10 rounded">{formatCurrency(currency === 'bs' ? sys.lanave_bs : sys.lanave_usd, cur)}</div>
                      <div className="text-center font-bold text-primary">{formatCurrency(currency === 'bs' ? sys.final_bs : sys.final_usd, cur)}</div>
                    </div>
                  ))}

                  {/* Parley systems */}
                  {parleySys.length > 0 && (
                    <>
                      <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 rounded-lg p-2 mt-2">
                        <h4 className="text-xs font-semibold text-center">PARLEY Y CABALLOS</h4>
                      </div>
                      {parleySys.map(sys => (
                        <div key={sys.lottery_system_id} className="grid grid-cols-7 gap-2 text-xs items-center">
                          <div className="font-medium">{sys.lottery_system_name}</div>
                          <div className="text-center">{formatCurrency(currency === 'bs' ? sys.sales_bs : sys.sales_usd, cur)}</div>
                          <div className="text-center">{formatCurrency(currency === 'bs' ? sys.prizes_bs : sys.prizes_usd, cur)}</div>
                          <div className="text-center bg-yellow-500/10 rounded">{formatCurrency(currency === 'bs' ? sys.commission_bs : sys.commission_usd, cur)}</div>
                          <div className="text-center bg-emerald-500/10 rounded">{formatCurrency(currency === 'bs' ? sys.participation_bs : sys.participation_usd, cur)}</div>
                          <div className="text-center bg-orange-500/10 rounded">{formatCurrency(currency === 'bs' ? sys.lanave_bs : sys.lanave_usd, cur)}</div>
                          <div className="text-center font-bold text-primary">{formatCurrency(currency === 'bs' ? sys.final_bs : sys.final_usd, cur)}</div>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Grand totals row */}
        <div className="grid grid-cols-8 gap-2 items-center text-sm py-3 px-2 bg-muted/50 rounded-lg border-t-2 border-primary/20 font-bold mt-2">
          <div className="col-span-2 text-primary">TOTAL GENERAL</div>
          <div className="text-center font-mono text-xs text-green-600">
            {formatCurrency(currency === 'bs' ? grandTotals.sales_bs : grandTotals.sales_usd, cur)}
          </div>
          <div className="text-center font-mono text-xs text-red-600">
            {formatCurrency(currency === 'bs' ? grandTotals.prizes_bs : grandTotals.prizes_usd, cur)}
          </div>
          <div className="text-center font-mono text-xs text-yellow-600">
            {formatCurrency(currency === 'bs' ? grandTotals.commission_bs : grandTotals.commission_usd, cur)}
          </div>
          <div className="text-center font-mono text-xs text-emerald-600">
            {formatCurrency(currency === 'bs' ? grandTotals.participation_bs : grandTotals.participation_usd, cur)}
          </div>
          <div className="text-center font-mono text-xs text-orange-600">
            {formatCurrency(currency === 'bs' ? grandTotals.lanave_bs : grandTotals.lanave_usd, cur)}
          </div>
          <div className="text-center font-mono text-xs text-primary">
            {formatCurrency(currency === 'bs' ? grandTotals.final_bs : grandTotals.final_usd, cur)}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Week selector */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <CalendarIcon className="h-5 w-5 mr-2" />
            Semana
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-2">
            <Button variant="outline" size="icon" onClick={() => navigateWeek('prev')}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="text-center flex-1">
              <p className="text-sm font-medium">
                {format(currentWeek.start, "dd/MM/yyyy", { locale: es })} - {format(currentWeek.end, "dd/MM/yyyy", { locale: es })}
              </p>
            </div>
            <Button variant="outline" size="icon" onClick={() => navigateWeek('next')}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {!loading && clientRows.length > 0 && (
        <>
          {/* Totalizer cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
            <Card className="border-2 border-green-500/20 bg-gradient-to-br from-green-500/10 to-green-500/5">
              <CardContent className="pt-6">
                <div className="p-2 bg-green-500/10 rounded-lg w-fit mb-2"><DollarSign className="h-5 w-5 text-green-600" /></div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Ventas</p>
                <p className="text-xl font-bold text-green-600 font-mono">{formatCurrency(grandTotals.sales_bs, 'VES')}</p>
                <p className="text-sm font-semibold text-green-600/70 font-mono">{formatCurrency(grandTotals.sales_usd, 'USD')}</p>
              </CardContent>
            </Card>

            <Card className="border-2 border-red-500/20 bg-gradient-to-br from-red-500/10 to-red-500/5">
              <CardContent className="pt-6">
                <div className="p-2 bg-red-500/10 rounded-lg w-fit mb-2"><Award className="h-5 w-5 text-red-600" /></div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Premios</p>
                <p className="text-xl font-bold text-red-600 font-mono">{formatCurrency(grandTotals.prizes_bs, 'VES')}</p>
                <p className="text-sm font-semibold text-red-600/70 font-mono">{formatCurrency(grandTotals.prizes_usd, 'USD')}</p>
              </CardContent>
            </Card>

            <Card className="border-2 border-yellow-500/20 bg-gradient-to-br from-yellow-500/10 to-yellow-500/5">
              <CardContent className="pt-6">
                <div className="p-2 bg-yellow-500/10 rounded-lg w-fit mb-2"><Award className="h-5 w-5 text-yellow-600" /></div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Comisiones</p>
                <p className="text-xl font-bold text-yellow-600 font-mono">{formatCurrency(grandTotals.commission_bs, 'VES')}</p>
                <p className="text-sm font-semibold text-yellow-600/70 font-mono">{formatCurrency(grandTotals.commission_usd, 'USD')}</p>
              </CardContent>
            </Card>

            <Card className="border-2 border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 to-emerald-500/5">
              <CardContent className="pt-6">
                <div className="p-2 bg-emerald-500/10 rounded-lg w-fit mb-2"><TrendingUp className="h-5 w-5 text-emerald-600" /></div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Com. Participación</p>
                <p className="text-xl font-bold text-emerald-600 font-mono">{formatCurrency(grandTotals.participation_bs, 'VES')}</p>
                <p className="text-sm font-semibold text-emerald-600/70 font-mono">{formatCurrency(grandTotals.participation_usd, 'USD')}</p>
              </CardContent>
            </Card>

            <Card className="border-2 border-purple-500/20 bg-gradient-to-br from-purple-500/10 to-purple-500/5">
              <CardContent className="pt-6">
                <div className="p-2 bg-purple-500/10 rounded-lg w-fit mb-2"><Banknote className="h-5 w-5 text-purple-600" /></div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Ganancia por Banqueo</p>
                <p className="text-xl font-bold text-purple-600 font-mono">
                  {formatCurrency((grandTotals.sales_bs - grandTotals.prizes_bs) + grandTotals.commission_bs + grandTotals.participation_bs, 'VES')}
                </p>
                <p className="text-sm font-semibold text-purple-600/70 font-mono">
                  {formatCurrency((grandTotals.sales_usd - grandTotals.prizes_usd) + grandTotals.commission_usd + grandTotals.participation_usd, 'USD')}
                </p>
              </CardContent>
            </Card>

            <Card className="border-2 border-orange-500/20 bg-gradient-to-br from-orange-500/10 to-orange-500/5">
              <CardContent className="pt-6">
                <div className="p-2 bg-orange-500/10 rounded-lg w-fit mb-2"><Coins className="h-5 w-5 text-orange-600" /></div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Part. Lanave</p>
                <p className="text-xl font-bold text-orange-600 font-mono">{formatCurrency(grandTotals.lanave_bs, 'VES')}</p>
                <p className="text-sm font-semibold text-orange-600/70 font-mono">{formatCurrency(grandTotals.lanave_usd, 'USD')}</p>
              </CardContent>
            </Card>
          </div>

          {/* Currency tabs with client table */}
          <Tabs value={currencyTab} onValueChange={setCurrencyTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="bolivares">Bolívares</TabsTrigger>
              <TabsTrigger value="dolares">Dólares</TabsTrigger>
            </TabsList>

            <TabsContent value="bolivares">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Globe className="h-5 w-5" />
                    Vista General - Bolívares
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {renderClientTable('bs')}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="dolares">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Globe className="h-5 w-5" />
                    Vista General - Dólares
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {renderClientTable('usd')}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}

      {!loading && clientRows.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No hay datos de banqueo para esta semana
          </CardContent>
        </Card>
      )}

      {loading && (
        <div className="flex items-center justify-center p-8">
          <p className="text-muted-foreground">Cargando datos generales...</p>
        </div>
      )}
    </div>
  );
};
