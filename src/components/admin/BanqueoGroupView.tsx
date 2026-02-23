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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

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

interface AggregatedSystemData {
  lottery_system_id: string;
  lottery_system_name: string;
  sales_bs: number;
  sales_usd: number;
  prizes_bs: number;
  prizes_usd: number;
  // Per-client breakdown
  clientBreakdown: {
    client_name: string;
    sales_bs: number;
    sales_usd: number;
    prizes_bs: number;
    prizes_usd: number;
  }[];
}

// Códigos de sistemas de Parley y Caballos
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
  const [aggregatedData, setAggregatedData] = useState<AggregatedSystemData[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedSystems, setExpandedSystems] = useState<Set<string>>(new Set());
  
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

  // Save week to localStorage
  useEffect(() => {
    localStorage.setItem('banqueo-group:currentWeek', JSON.stringify({
      start: currentWeek.start.toISOString(),
      end: currentWeek.end.toISOString(),
    }));
  }, [currentWeek]);

  // Load initial data
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

  // Load clients and transactions when group or week changes
  useEffect(() => {
    if (!selectedGroup || lotteryOptions.length === 0) return;
    loadGroupData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedGroup, currentWeek, lotteryOptions.length]);

  const loadGroupData = async () => {
    setLoading(true);
    try {
      // Get clients in the selected group
      const { data: clients, error: clientsError } = await supabase
        .from('clients')
        .select('id, name')
        .eq('group_id', selectedGroup)
        .eq('is_active', true)
        .order('name');

      if (clientsError) throw clientsError;
      setClientsInGroup(clients || []);

      if (!clients || clients.length === 0) {
        setAggregatedData([]);
        setLoading(false);
        return;
      }

      const clientIds = clients.map(c => c.id);
      const weekStartStr = formatDateForDB(currentWeek.start);
      const weekEndStr = formatDateForDB(currentWeek.end);

      // Get all banqueo transactions for these clients in this week
      const { data: transactions, error: txError } = await supabase
        .from('banqueo_transactions')
        .select('*')
        .in('client_id', clientIds)
        .eq('week_start_date', weekStartStr)
        .eq('week_end_date', weekEndStr);

      if (txError) throw txError;

      // Build client name map
      const clientMap = new Map(clients.map(c => [c.id, c.name]));

      // Aggregate by system
      const systemMap = new Map<string, AggregatedSystemData>();

      // Initialize all systems
      lotteryOptions.forEach(sys => {
        systemMap.set(sys.id, {
          lottery_system_id: sys.id,
          lottery_system_name: sys.name,
          sales_bs: 0,
          sales_usd: 0,
          prizes_bs: 0,
          prizes_usd: 0,
          clientBreakdown: [],
        });
      });

      // Aggregate transactions
      (transactions || []).forEach(tx => {
        if (!tx.lottery_system_id) return;
        const sys = systemMap.get(tx.lottery_system_id);
        if (!sys) return;

        sys.sales_bs += Number(tx.sales_bs || 0);
        sys.sales_usd += Number(tx.sales_usd || 0);
        sys.prizes_bs += Number(tx.prizes_bs || 0);
        sys.prizes_usd += Number(tx.prizes_usd || 0);

        sys.clientBreakdown.push({
          client_name: clientMap.get(tx.client_id) || 'Desconocido',
          sales_bs: Number(tx.sales_bs || 0),
          sales_usd: Number(tx.sales_usd || 0),
          prizes_bs: Number(tx.prizes_bs || 0),
          prizes_usd: Number(tx.prizes_usd || 0),
        });
      });

      setAggregatedData(Array.from(systemMap.values()));
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

  const toggleExpanded = (systemId: string) => {
    setExpandedSystems(prev => {
      const next = new Set(prev);
      if (next.has(systemId)) next.delete(systemId);
      else next.add(systemId);
      return next;
    });
  };

  // Separate normal vs parley systems
  const normalSystems = aggregatedData.filter(s => {
    const sys = lotteryOptions.find(l => l.id === s.lottery_system_id);
    return !sys || !parleySystemCodes.includes(sys.code);
  });

  const parleySystems = aggregatedData.filter(s => {
    const sys = lotteryOptions.find(l => l.id === s.lottery_system_id);
    return sys && parleySystemCodes.includes(sys.code);
  });

  // Totals
  const totals = useMemo(() => {
    return aggregatedData.reduce(
      (acc, sys) => ({
        sales_bs: acc.sales_bs + sys.sales_bs,
        sales_usd: acc.sales_usd + sys.sales_usd,
        prizes_bs: acc.prizes_bs + sys.prizes_bs,
        prizes_usd: acc.prizes_usd + sys.prizes_usd,
      }),
      { sales_bs: 0, sales_usd: 0, prizes_bs: 0, prizes_usd: 0 }
    );
  }, [aggregatedData]);

  const selectedGroupName = clientGroups.find(g => g.id === selectedGroup)?.name || '';

  const renderSystemsTable = (systems: AggregatedSystemData[], currency: 'bs' | 'usd') => {
    const filteredSystems = systems.filter(s => 
      currency === 'bs' 
        ? (s.sales_bs > 0 || s.prizes_bs > 0)
        : (s.sales_usd > 0 || s.prizes_usd > 0)
    );

    if (filteredSystems.length === 0) {
      return <p className="text-sm text-muted-foreground text-center py-4">Sin datos registrados</p>;
    }

    const currencyCode = currency === 'bs' ? 'VES' : 'USD';

    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Sistema</TableHead>
            <TableHead className="text-right">Ventas</TableHead>
            <TableHead className="text-right">Premios</TableHead>
            <TableHead className="text-right">Cuadre</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredSystems.map(sys => {
            const sales = currency === 'bs' ? sys.sales_bs : sys.sales_usd;
            const prizes = currency === 'bs' ? sys.prizes_bs : sys.prizes_usd;
            const cuadre = sales - prizes;
            const isExpanded = expandedSystems.has(sys.lottery_system_id);
            const hasBreakdown = sys.clientBreakdown.length > 1;

            return (
              <>
                <TableRow 
                  key={sys.lottery_system_id} 
                  className={hasBreakdown ? 'cursor-pointer hover:bg-muted/70' : ''}
                  onClick={() => hasBreakdown && toggleExpanded(sys.lottery_system_id)}
                >
                  <TableCell className="font-medium">
                    {hasBreakdown && (
                      <span className="mr-1">{isExpanded ? '▼' : '▶'}</span>
                    )}
                    {sys.lottery_system_name}
                    {hasBreakdown && (
                      <span className="text-xs text-muted-foreground ml-2">
                        ({sys.clientBreakdown.length} clientes)
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-mono text-green-600">
                    {formatCurrency(sales, currencyCode)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-red-600">
                    {formatCurrency(prizes, currencyCode)}
                  </TableCell>
                  <TableCell className={`text-right font-mono font-bold ${cuadre >= 0 ? 'text-primary' : 'text-destructive'}`}>
                    {formatCurrency(cuadre, currencyCode)}
                  </TableCell>
                </TableRow>
                {isExpanded && sys.clientBreakdown.map((cb, idx) => {
                  const cbSales = currency === 'bs' ? cb.sales_bs : cb.sales_usd;
                  const cbPrizes = currency === 'bs' ? cb.prizes_bs : cb.prizes_usd;
                  const cbCuadre = cbSales - cbPrizes;
                  if (cbSales === 0 && cbPrizes === 0) return null;
                  return (
                    <TableRow key={`${sys.lottery_system_id}-${idx}`} className="bg-muted/30">
                      <TableCell className="pl-8 text-sm text-muted-foreground">
                        ↳ {cb.client_name}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm text-green-600/70">
                        {formatCurrency(cbSales, currencyCode)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm text-red-600/70">
                        {formatCurrency(cbPrizes, currencyCode)}
                      </TableCell>
                      <TableCell className={`text-right font-mono text-sm ${cbCuadre >= 0 ? 'text-primary/70' : 'text-destructive/70'}`}>
                        {formatCurrency(cbCuadre, currencyCode)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </>
            );
          })}
        </TableBody>
      </Table>
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
                  <SelectItem key={group.id} value={group.id}>
                    {group.name}
                  </SelectItem>
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
          {/* Totalizadores */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="border-2 border-green-500/20 bg-gradient-to-br from-green-500/10 to-green-500/5">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between mb-2">
                  <div className="p-2 bg-green-500/10 rounded-lg">
                    <DollarSign className="h-5 w-5 text-green-600" />
                  </div>
                </div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Ventas</p>
                <div className="space-y-0.5">
                  <p className="text-xl font-bold text-green-600 font-mono">{formatCurrency(totals.sales_bs, 'VES')}</p>
                  <p className="text-sm font-semibold text-green-600/70 font-mono">{formatCurrency(totals.sales_usd, 'USD')}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-2 border-red-500/20 bg-gradient-to-br from-red-500/10 to-red-500/5">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between mb-2">
                  <div className="p-2 bg-red-500/10 rounded-lg">
                    <Award className="h-5 w-5 text-red-600" />
                  </div>
                </div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Premios</p>
                <div className="space-y-0.5">
                  <p className="text-xl font-bold text-red-600 font-mono">{formatCurrency(totals.prizes_bs, 'VES')}</p>
                  <p className="text-sm font-semibold text-red-600/70 font-mono">{formatCurrency(totals.prizes_usd, 'USD')}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-2 border-blue-500/20 bg-gradient-to-br from-blue-500/10 to-blue-500/5">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between mb-2">
                  <div className="p-2 bg-blue-500/10 rounded-lg">
                    <TrendingUp className="h-5 w-5 text-blue-600" />
                  </div>
                </div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Cuadre Bs</p>
                <div className="space-y-0.5">
                  <p className={`text-xl font-bold font-mono ${(totals.sales_bs - totals.prizes_bs) >= 0 ? 'text-blue-600' : 'text-destructive'}`}>
                    {formatCurrency(totals.sales_bs - totals.prizes_bs, 'VES')}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-2 border-purple-500/20 bg-gradient-to-br from-purple-500/10 to-purple-500/5">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between mb-2">
                  <div className="p-2 bg-purple-500/10 rounded-lg">
                    <Banknote className="h-5 w-5 text-purple-600" />
                  </div>
                </div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Cuadre USD</p>
                <div className="space-y-0.5">
                  <p className={`text-xl font-bold font-mono ${(totals.sales_usd - totals.prizes_usd) >= 0 ? 'text-purple-600' : 'text-destructive'}`}>
                    {formatCurrency(totals.sales_usd - totals.prizes_usd, 'USD')}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Tabs Bs / USD */}
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
                <CardContent>
                  {normalSystems.length > 0 && renderSystemsTable(normalSystems, 'bs')}
                  
                  {parleySystems.filter(s => s.sales_bs > 0 || s.prizes_bs > 0).length > 0 && (
                    <div className="mt-6 pt-6 border-t">
                      <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 rounded-lg p-3 mb-4">
                        <h3 className="text-lg font-semibold text-center">PARLEY Y CABALLOS</h3>
                      </div>
                      {renderSystemsTable(parleySystems, 'bs')}
                    </div>
                  )}

                  {/* Totales Bs */}
                  <Card className="bg-muted/30 mt-4">
                    <CardContent className="pt-6">
                      <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                          <p className="text-sm text-muted-foreground">Total Ventas</p>
                          <p className="text-xl font-bold text-green-600">{formatCurrency(totals.sales_bs, 'VES')}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Total Premios</p>
                          <p className="text-xl font-bold text-red-600">{formatCurrency(totals.prizes_bs, 'VES')}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Total Cuadre</p>
                          <p className={`text-xl font-bold ${(totals.sales_bs - totals.prizes_bs) >= 0 ? 'text-primary' : 'text-destructive'}`}>
                            {formatCurrency(totals.sales_bs - totals.prizes_bs, 'VES')}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="dolares">
              <Card>
                <CardHeader>
                  <CardTitle>Ventas y Premios en Dólares - {selectedGroupName}</CardTitle>
                </CardHeader>
                <CardContent>
                  {normalSystems.length > 0 && renderSystemsTable(normalSystems, 'usd')}

                  {parleySystems.filter(s => s.sales_usd > 0 || s.prizes_usd > 0).length > 0 && (
                    <div className="mt-6 pt-6 border-t">
                      <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 rounded-lg p-3 mb-4">
                        <h3 className="text-lg font-semibold text-center">PARLEY Y CABALLOS</h3>
                      </div>
                      {renderSystemsTable(parleySystems, 'usd')}
                    </div>
                  )}

                  {/* Totales USD */}
                  <Card className="bg-muted/30 mt-4">
                    <CardContent className="pt-6">
                      <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                          <p className="text-sm text-muted-foreground">Total Ventas</p>
                          <p className="text-xl font-bold text-green-600">{formatCurrency(totals.sales_usd, 'USD')}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Total Premios</p>
                          <p className="text-xl font-bold text-red-600">{formatCurrency(totals.prizes_usd, 'USD')}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Total Cuadre</p>
                          <p className={`text-xl font-bold ${(totals.sales_usd - totals.prizes_usd) >= 0 ? 'text-primary' : 'text-destructive'}`}>
                            {formatCurrency(totals.sales_usd - totals.prizes_usd, 'USD')}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
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
