import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useSystemCommissions } from '@/hooks/useSystemCommissions';
import { formatCurrency } from '@/lib/utils';
import { formatDateForDB } from '@/lib/dateUtils';
import { format, startOfWeek, endOfWeek, addWeeks } from 'date-fns';
import { es } from 'date-fns/locale';
import { CalendarIcon, ChevronLeft, ChevronRight, Users, DollarSign, Award, TrendingUp, Banknote, Coins } from 'lucide-react';

interface ClientGroup {
  id: string;
  name: string;
}

interface ClientInGroup {
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

// Per-system aggregated row with full calculations
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

const parleySystemCodes = [
  'INMEJORABLE-MULTIS-1', 'INMEJORABLE-MULTIS-2', 'INMEJORABLE-MULTIS-3', 'INMEJORABLE-MULTIS-4',
  'INMEJORABLE-5Y6', 'POLLA', 'MULTISPORT-CABALLOS-NAC', 'MULTISPORT-CABALLOS-INT', 'MULTISPORT-5Y6'
];

export const BanqueoGroupView = () => {
  const [currencyTab, setCurrencyTab] = useState('bolivares');
  const [clientGroups, setClientGroups] = useState<ClientGroup[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string>('');
  const [clientsInGroup, setClientsInGroup] = useState<ClientInGroup[]>([]);
  const [lotteryOptions, setLotteryOptions] = useState<LotterySystem[]>([]);
  const [systemRows, setSystemRows] = useState<SystemRow[]>([]);
  const [loading, setLoading] = useState(false);

  const [currentWeek, setCurrentWeek] = useState<{ start: Date; end: Date }>(() => {
    const saved = localStorage.getItem('banqueo-group:currentWeek');
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
    localStorage.setItem('banqueo-group:currentWeek', JSON.stringify({
      start: currentWeek.start.toISOString(),
      end: currentWeek.end.toISOString(),
    }));
  }, [currentWeek]);

  useEffect(() => {
    const fetchInitial = async () => {
      try {
        const [groupsRes, systemsRes] = await Promise.all([
          supabase.from('agency_groups').select('id, name').eq('is_client_group', true).order('name'),
          supabase.from('lottery_systems').select('id, name, code, parent_system_id, has_subcategories').eq('is_active', true).order('name'),
        ]);
        if (groupsRes.error) throw groupsRes.error;
        if (systemsRes.error) throw systemsRes.error;
        setClientGroups(groupsRes.data || []);
        const filtered = (systemsRes.data || []).filter(s => s.parent_system_id || !s.has_subcategories);
        setLotteryOptions(filtered);
      } catch (error: any) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
      }
    };
    fetchInitial();
  }, [toast]);

  useEffect(() => {
    if (!selectedGroup || lotteryOptions.length === 0) return;
    loadGroupData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedGroup, currentWeek, lotteryOptions.length, commissions]);

  const loadGroupData = async () => {
    setLoading(true);
    try {
      const { data: clients, error: clientsError } = await supabase
        .from('clients')
        .select('id, name')
        .eq('group_id', selectedGroup)
        .eq('is_active', true)
        .order('name');
      if (clientsError) throw clientsError;
      setClientsInGroup(clients || []);

      if (!clients || clients.length === 0) {
        setSystemRows([]);
        setLoading(false);
        return;
      }

      const clientIds = clients.map(c => c.id);
      const weekStartStr = formatDateForDB(currentWeek.start);
      const weekEndStr = formatDateForDB(currentWeek.end);

      // Load transactions, per-client system configs, and lanave configs in parallel
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

      // Build per-client lanave config
      const clientLanaveMap = new Map<string, ClientLanaveConfig>();
      (lanaveRes.data || []).forEach(cfg => {
        clientLanaveMap.set(cfg.client_id, {
          lanave_participation_bs: Number(cfg.lanave_participation_percentage_bs || 0),
          lanave_participation_usd: Number(cfg.lanave_participation_percentage_usd || 0),
        });
      });

      // Initialize system rows
      const rowsMap = new Map<string, SystemRow>();
      lotteryOptions.forEach(sys => {
        rowsMap.set(sys.id, {
          lottery_system_id: sys.id,
          lottery_system_name: sys.name,
          sales_bs: 0, sales_usd: 0, prizes_bs: 0, prizes_usd: 0,
          commission_bs: 0, commission_usd: 0,
          participation_bs: 0, participation_usd: 0,
          lanave_bs: 0, lanave_usd: 0,
          final_bs: 0, final_usd: 0,
        });
      });

      // Process each transaction: calculate per-client commissions then aggregate
      (txRes.data || []).forEach(tx => {
        if (!tx.lottery_system_id) return;
        const row = rowsMap.get(tx.lottery_system_id);
        if (!row) return;

        const salesBs = Number(tx.sales_bs || 0);
        const salesUsd = Number(tx.sales_usd || 0);
        const prizesBs = Number(tx.prizes_bs || 0);
        const prizesUsd = Number(tx.prizes_usd || 0);

        const clientSysConfig = clientSystemConfigsMap.get(tx.client_id)?.get(tx.lottery_system_id);
        const clientLanave = clientLanaveMap.get(tx.client_id);
        const globalCommission = commissions.get(tx.lottery_system_id);

        // Commission %
        const commPctBs = (clientSysConfig?.commission_bs && clientSysConfig.commission_bs > 0)
          ? clientSysConfig.commission_bs
          : (globalCommission?.commission_percentage || 0);
        const commPctUsd = (clientSysConfig?.commission_usd && clientSysConfig.commission_usd > 0)
          ? clientSysConfig.commission_usd
          : (globalCommission?.commission_percentage_usd || 0);

        const commBs = salesBs * (commPctBs / 100);
        const commUsd = salesUsd * (commPctUsd / 100);

        const cuadreBs = salesBs - prizesBs;
        const cuadreUsd = salesUsd - prizesUsd;
        const subtotalBs = cuadreBs - commBs;
        const subtotalUsd = cuadreUsd - commUsd;

        // Participation %
        const partPctBs = clientSysConfig?.participation_bs || Number(tx.participation_percentage || 0);
        const partPctUsd = clientSysConfig?.participation_usd || Number(tx.participation_percentage || 0);
        const partBs = subtotalBs * (partPctBs / 100);
        const partUsd = subtotalUsd * (partPctUsd / 100);

        // Lanave %
        const lanavePctBs = clientSysConfig?.lanave_participation_bs || clientLanave?.lanave_participation_bs || 0;
        const lanavePctUsd = clientSysConfig?.lanave_participation_usd || clientLanave?.lanave_participation_usd || 0;
        const lanaveBs = subtotalBs * (lanavePctBs / 100);
        const lanaveUsd = subtotalUsd * (lanavePctUsd / 100);

        const finalBs = subtotalBs - partBs - lanaveBs;
        const finalUsd = subtotalUsd - partUsd - lanaveUsd;

        row.sales_bs += salesBs;
        row.sales_usd += salesUsd;
        row.prizes_bs += prizesBs;
        row.prizes_usd += prizesUsd;
        row.commission_bs += commBs;
        row.commission_usd += commUsd;
        row.participation_bs += partBs;
        row.participation_usd += partUsd;
        row.lanave_bs += lanaveBs;
        row.lanave_usd += lanaveUsd;
        row.final_bs += finalBs;
        row.final_usd += finalUsd;
      });

      setSystemRows(Array.from(rowsMap.values()));
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

  // Separate normal vs parley
  const normalSystems = systemRows.filter(s => {
    const sys = lotteryOptions.find(l => l.id === s.lottery_system_id);
    return !sys || !parleySystemCodes.includes(sys.code);
  });

  const parleySystems = systemRows.filter(s => {
    const sys = lotteryOptions.find(l => l.id === s.lottery_system_id);
    return sys && parleySystemCodes.includes(sys.code);
  });

  const totals = useMemo(() => {
    return systemRows.reduce(
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
  }, [systemRows]);

  const selectedGroupName = clientGroups.find(g => g.id === selectedGroup)?.name || '';

  const renderSystemsGrid = (systems: SystemRow[], currency: 'bs' | 'usd') => {
    const hasData = systems.some(s => currency === 'bs' ? (s.sales_bs > 0 || s.prizes_bs > 0) : (s.sales_usd > 0 || s.prizes_usd > 0));
    if (!hasData) return null;

    const cur = currency === 'bs' ? 'VES' : 'USD';

    return (
      <div className="grid gap-4">
        <div className="grid grid-cols-7 gap-2 text-xs font-medium text-muted-foreground border-b pb-2">
          <div>Sistema</div>
          <div className="text-center">Ventas</div>
          <div className="text-center">Premios</div>
          <div className="text-center">Comisión</div>
          <div className="text-center">Participación</div>
          <div className="text-center">Part. Lanave</div>
          <div className="text-center">Total Final</div>
        </div>
        {systems.map(row => {
          const sales = currency === 'bs' ? row.sales_bs : row.sales_usd;
          const prizes = currency === 'bs' ? row.prizes_bs : row.prizes_usd;
          const commission = currency === 'bs' ? row.commission_bs : row.commission_usd;
          const participation = currency === 'bs' ? row.participation_bs : row.participation_usd;
          const lanave = currency === 'bs' ? row.lanave_bs : row.lanave_usd;
          const finalTotal = currency === 'bs' ? row.final_bs : row.final_usd;

          if (sales === 0 && prizes === 0) return null;

          return (
            <div key={row.lottery_system_id} className="grid grid-cols-7 gap-2 items-center text-sm">
              <div className="font-medium text-xs">{row.lottery_system_name}</div>
              <div className="text-center text-xs">{formatCurrency(sales, cur)}</div>
              <div className="text-center text-xs">{formatCurrency(prizes, cur)}</div>
              <div className="text-center font-bold bg-yellow-500/20 text-xs">{formatCurrency(commission, cur)}</div>
              <div className="text-center font-bold bg-emerald-500/20 text-xs">{formatCurrency(participation, cur)}</div>
              <div className="text-center font-bold bg-orange-500/20 text-xs">{formatCurrency(lanave, cur)}</div>
              <div className="text-center font-bold text-primary text-xs">{formatCurrency(finalTotal, cur)}</div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderTotalsCard = (currency: 'bs' | 'usd') => {
    const cur = currency === 'bs' ? 'VES' : 'USD';
    const sales = currency === 'bs' ? totals.sales_bs : totals.sales_usd;
    const prizes = currency === 'bs' ? totals.prizes_bs : totals.prizes_usd;
    const commission = currency === 'bs' ? totals.commission_bs : totals.commission_usd;
    const participation = currency === 'bs' ? totals.participation_bs : totals.participation_usd;
    const subtotal = (sales - prizes) - commission;
    const lanave = currency === 'bs' ? totals.lanave_bs : totals.lanave_usd;
    const finalTotal = currency === 'bs' ? totals.final_bs : totals.final_usd;

    const showParticipation = Math.abs(participation) > 0.00001;

    return (
      <Card className="bg-muted/30">
        <CardContent className="pt-6">
          <div className={`grid gap-4 text-center ${showParticipation ? 'grid-cols-7' : 'grid-cols-6'}`}>
            <div>
              <p className="text-sm text-muted-foreground">Total Ventas</p>
              <p className="text-xl font-bold text-green-600">{formatCurrency(sales, cur)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Premios</p>
              <p className="text-xl font-bold text-destructive">{formatCurrency(prizes, cur)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Monto Comisión</p>
              <p className="text-xl font-bold text-yellow-600">{formatCurrency(commission, cur)}</p>
            </div>
            {showParticipation && (
              <div>
                <p className="text-sm text-muted-foreground whitespace-nowrap">Com. Participación</p>
                <p className="text-xl font-bold text-emerald-600">{formatCurrency(participation, cur)}</p>
              </div>
            )}
            <div>
              <p className="text-sm text-muted-foreground">A Pagar</p>
              <p className="text-xl font-bold text-cyan-600">{formatCurrency(subtotal - participation, cur)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Part. Lanave</p>
              <p className="text-xl font-bold text-orange-600">{formatCurrency(lanave, cur)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Final</p>
              <p className="text-xl font-bold text-primary">{formatCurrency(finalTotal, cur)}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      {/* Selectores */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Users className="h-5 w-5 mr-2" />
              Seleccionar Grupo de Clientes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={selectedGroup} onValueChange={setSelectedGroup}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecciona un grupo" />
              </SelectTrigger>
              <SelectContent>
                {clientGroups.map(group => (
                  <SelectItem key={group.id} value={group.id}>{group.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedGroup && clientsInGroup.length > 0 && (
              <p className="text-xs text-muted-foreground mt-2">
                Clientes: {clientsInGroup.map(c => c.name).join(', ')}
              </p>
            )}
          </CardContent>
        </Card>

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
      </div>

      {selectedGroup && !loading && (
        <>
          {/* Totalizadores - mismos que BanqueoManager */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
            <Card className="border-2 border-green-500/20 bg-gradient-to-br from-green-500/10 to-green-500/5">
              <CardContent className="pt-6">
                <div className="p-2 bg-green-500/10 rounded-lg w-fit mb-2"><DollarSign className="h-5 w-5 text-green-600" /></div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Ventas</p>
                <p className="text-xl font-bold text-green-600 font-mono">{formatCurrency(totals.sales_bs, 'VES')}</p>
                <p className="text-sm font-semibold text-green-600/70 font-mono">{formatCurrency(totals.sales_usd, 'USD')}</p>
              </CardContent>
            </Card>

            <Card className="border-2 border-red-500/20 bg-gradient-to-br from-red-500/10 to-red-500/5">
              <CardContent className="pt-6">
                <div className="p-2 bg-red-500/10 rounded-lg w-fit mb-2"><Award className="h-5 w-5 text-red-600" /></div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Premios</p>
                <p className="text-xl font-bold text-red-600 font-mono">{formatCurrency(totals.prizes_bs, 'VES')}</p>
                <p className="text-sm font-semibold text-red-600/70 font-mono">{formatCurrency(totals.prizes_usd, 'USD')}</p>
              </CardContent>
            </Card>

            <Card className="border-2 border-yellow-500/20 bg-gradient-to-br from-yellow-500/10 to-yellow-500/5">
              <CardContent className="pt-6">
                <div className="p-2 bg-yellow-500/10 rounded-lg w-fit mb-2"><Award className="h-5 w-5 text-yellow-600" /></div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Comisiones</p>
                <p className="text-xl font-bold text-yellow-600 font-mono">{formatCurrency(totals.commission_bs, 'VES')}</p>
                <p className="text-sm font-semibold text-yellow-600/70 font-mono">{formatCurrency(totals.commission_usd, 'USD')}</p>
              </CardContent>
            </Card>

            <Card className="border-2 border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 to-emerald-500/5">
              <CardContent className="pt-6">
                <div className="p-2 bg-emerald-500/10 rounded-lg w-fit mb-2"><TrendingUp className="h-5 w-5 text-emerald-600" /></div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Com. Participación</p>
                <p className="text-xl font-bold text-emerald-600 font-mono">{formatCurrency(totals.participation_bs, 'VES')}</p>
                <p className="text-sm font-semibold text-emerald-600/70 font-mono">{formatCurrency(totals.participation_usd, 'USD')}</p>
              </CardContent>
            </Card>

            <Card className="border-2 border-purple-500/20 bg-gradient-to-br from-purple-500/10 to-purple-500/5">
              <CardContent className="pt-6">
                <div className="p-2 bg-purple-500/10 rounded-lg w-fit mb-2"><Banknote className="h-5 w-5 text-purple-600" /></div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Ganancia por Banqueo</p>
                <p className="text-xl font-bold text-purple-600 font-mono">
                  {formatCurrency((totals.sales_bs - totals.prizes_bs) + totals.commission_bs + totals.participation_bs, 'VES')}
                </p>
                <p className="text-sm font-semibold text-purple-600/70 font-mono">
                  {formatCurrency((totals.sales_usd - totals.prizes_usd) + totals.commission_usd + totals.participation_usd, 'USD')}
                </p>
              </CardContent>
            </Card>

            <Card className="border-2 border-orange-500/20 bg-gradient-to-br from-orange-500/10 to-orange-500/5">
              <CardContent className="pt-6">
                <div className="p-2 bg-orange-500/10 rounded-lg w-fit mb-2"><Coins className="h-5 w-5 text-orange-600" /></div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Part. Lanave</p>
                <p className="text-xl font-bold text-orange-600 font-mono">{formatCurrency(totals.lanave_bs, 'VES')}</p>
                <p className="text-sm font-semibold text-orange-600/70 font-mono">{formatCurrency(totals.lanave_usd, 'USD')}</p>
              </CardContent>
            </Card>
          </div>

          {/* Tabs Bs / USD - misma estructura que BanqueoManager */}
          <Tabs value={currencyTab} onValueChange={setCurrencyTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="bolivares">Ventas/Premios Bs</TabsTrigger>
              <TabsTrigger value="dolares">Ventas/Premios USD</TabsTrigger>
            </TabsList>

            <TabsContent value="bolivares">
              <Card>
                <CardHeader>
                  <CardTitle>Ventas y Premios en Bolívares - {selectedGroupName}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {renderSystemsGrid(normalSystems, 'bs')}

                  {parleySystems.some(s => s.sales_bs > 0 || s.prizes_bs > 0) && (
                    <div className="mt-6 pt-6 border-t space-y-4">
                      <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 rounded-lg p-3">
                        <h3 className="text-lg font-semibold text-center">PARLEY Y CABALLOS</h3>
                      </div>
                      {renderSystemsGrid(parleySystems, 'bs')}
                    </div>
                  )}

                  {renderTotalsCard('bs')}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="dolares">
              <Card>
                <CardHeader>
                  <CardTitle>Ventas y Premios en Dólares - {selectedGroupName}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {renderSystemsGrid(normalSystems, 'usd')}

                  {parleySystems.some(s => s.sales_usd > 0 || s.prizes_usd > 0) && (
                    <div className="mt-6 pt-6 border-t space-y-4">
                      <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 rounded-lg p-3">
                        <h3 className="text-lg font-semibold text-center">PARLEY Y CABALLOS</h3>
                      </div>
                      {renderSystemsGrid(parleySystems, 'usd')}
                    </div>
                  )}

                  {renderTotalsCard('usd')}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}

      {loading && (
        <div className="flex items-center justify-center p-8">
          <p className="text-muted-foreground">Cargando datos del grupo...</p>
        </div>
      )}
    </div>
  );
};
