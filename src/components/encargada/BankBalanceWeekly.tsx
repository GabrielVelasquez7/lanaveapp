import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/components/ui/use-toast';
import { formatCurrency } from '@/lib/utils';
import { 
  Calendar, 
  ChevronLeft, 
  ChevronRight, 
  RefreshCcw, 
  TrendingUp,
  TrendingDown,
  CreditCard,
  Landmark
} from 'lucide-react';
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks } from 'date-fns';
import { es } from 'date-fns/locale';
import { WeeklyBankExpensesManager } from './WeeklyBankExpensesManager';
import { WeeklyBankExpensesUsdManager } from './WeeklyBankExpensesUsdManager';

interface AgencyBankBalance {
  agency_id: string;
  agency_name: string;
  mobile_received: number;
  mobile_paid: number;
  pos_total: number;
  bank_balance: number;
}

export function BankBalanceWeekly() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [currentWeek, setCurrentWeek] = useState<{ start: Date; end: Date } | null>(null);
  const [selectedAgency, setSelectedAgency] = useState<string>('all');
  const [agencies, setAgencies] = useState<any[]>([]);
  const [balances, setBalances] = useState<AgencyBankBalance[]>([]);
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [totalExpensesUsd, setTotalExpensesUsd] = useState(0);
  const [totalBankUsd, setTotalBankUsd] = useState(0);

  useEffect(() => {
    if (user) {
      getCurrentWeekBoundaries();
      fetchAgencies();
    }
  }, [user]);

  useEffect(() => {
    if (currentWeek && agencies.length > 0) {
      fetchBankBalances();
    }
  }, [currentWeek, selectedAgency, agencies]);

  // Listen for payroll updates to refresh data
  useEffect(() => {
    const handlePayrollUpdate = (event: CustomEvent) => {
      // Check if the updated payroll is for the current week
      if (currentWeek) {
        const updatedWeekStart = event.detail.week_start_date;
        const currentWeekStart = format(currentWeek.start, 'yyyy-MM-dd');
        if (updatedWeekStart === currentWeekStart) {
          console.log('🔄 Actualizando datos de bolívares en banco después de guardar nómina...');
          fetchBankBalances();
        }
      }
    };

    const handleCuadreSaved = (event: CustomEvent) => {
      // Check if the saved cuadre is for the current week
      if (currentWeek) {
        const savedWeekStart = event.detail.week_start_date;
        const currentWeekStart = format(currentWeek.start, 'yyyy-MM-dd');
        if (savedWeekStart === currentWeekStart) {
          console.log('🔄 Actualizando datos de bolívares en banco después de guardar cuadre...');
          fetchBankBalances();
        }
      }
    };

    window.addEventListener('payroll-updated', handlePayrollUpdate as EventListener);
    window.addEventListener('cuadre-saved', handleCuadreSaved as EventListener);
    return () => {
      window.removeEventListener('payroll-updated', handlePayrollUpdate as EventListener);
      window.removeEventListener('cuadre-saved', handleCuadreSaved as EventListener);
    };
  }, [currentWeek]);

  const getCurrentWeekBoundaries = async () => {
    try {
      const { data, error } = await supabase.rpc('get_current_week_boundaries');
      
      if (error) throw error;
      
      if (data && data.length > 0) {
        const w = data[0];
        setCurrentWeek({
          start: new Date(w.week_start + 'T00:00:00'),
          end: new Date(w.week_end + 'T23:59:59'),
        });
      } else {
        const now = new Date();
        const weekStart = startOfWeek(now, { weekStartsOn: 1 });
        const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
        setCurrentWeek({ start: weekStart, end: weekEnd });
      }
    } catch (error) {
      console.error('Error fetching week boundaries:', error);
      toast({
        title: 'Error',
        description: 'No se pudieron obtener las fechas de la semana',
        variant: 'destructive',
      });
    }
  };

  const fetchAgencies = async () => {
    try {
      const { data, error } = await supabase
        .from('agencies')
        .select('id, name')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setAgencies(data || []);
    } catch (error) {
      console.error('Error fetching agencies:', error);
    }
  };

  const fetchBankBalances = async () => {
    if (!currentWeek) return;

    try {
      setLoading(true);

      const startStr = format(currentWeek.start, 'yyyy-MM-dd');
      const endStr = format(currentWeek.end, 'yyyy-MM-dd');

      // Asegurar que las agencias estén cargadas
      let agencyIdsToUse: string[] = [];
      if (selectedAgency !== 'all') {
        agencyIdsToUse = [selectedAgency];
      } else {
        // Si agencies aún no está cargado, cargarlo primero
        if (agencies.length === 0) {
          const { data: agenciesData, error: agenciesError } = await supabase
            .from('agencies')
            .select('id')
            .eq('is_active', true);
          
          if (agenciesError) throw agenciesError;
          agencyIdsToUse = agenciesData?.map(a => a.id) || [];
        } else {
          agencyIdsToUse = agencies.map(a => a.id);
        }
      }

      console.log('🔍 BankBalanceWeekly - Consultando balances:', {
        startStr,
        endStr,
        selectedAgency,
        agencyIdsCount: agencyIdsToUse.length,
        agencyIds: agencyIdsToUse.slice(0, 3)
      });

      // SOLO usar datos de daily_cuadres_summary cuando la encargada ya APROBÓ el cuadre
      // Estos valores ya están consolidados (taquilleras + encargada) porque cuando la encargada guarda, consolida todos los datos
      let cuadresQuery = supabase
        .from('daily_cuadres_summary')
        .select('agency_id, total_mobile_payments_bs, total_pos_bs, session_date')
        .gte('session_date', startStr)
        .lte('session_date', endStr)
        .is('session_id', null) // Solo cuadres guardados por encargada
        .eq('encargada_status', 'aprobado') // Solo cuadres aprobados
        .in('agency_id', agencyIdsToUse);

      const { data: cuadresData, error: cuadresError } = await cuadresQuery;

      if (cuadresError) throw cuadresError;

      // Consolidar datos por agencia desde daily_cuadres_summary
      // total_mobile_payments_bs puede ser positivo (recibido) o negativo (pagado)
      const agencyDataMap = new Map<string, { mobile_received: number; mobile_paid: number; pos_total: number }>();
      
      cuadresData?.forEach(cuadre => {
        if (!cuadre.agency_id) return;
        
        const existing = agencyDataMap.get(cuadre.agency_id) || { mobile_received: 0, mobile_paid: 0, pos_total: 0 };
        
        const mobileAmount = Number(cuadre.total_mobile_payments_bs || 0);
        if (mobileAmount > 0) {
          existing.mobile_received += mobileAmount;
        } else if (mobileAmount < 0) {
          existing.mobile_paid += Math.abs(mobileAmount);
        }
        
        existing.pos_total += Number(cuadre.total_pos_bs || 0);
        
        agencyDataMap.set(cuadre.agency_id, existing);
      });

      // Convertir a formato esperado para compatibilidad con el código existente
      const mobileData = Array.from(agencyDataMap.entries()).flatMap(([agencyId, data]) => {
        const items: any[] = [];
        if (data.mobile_received > 0) {
          items.push({ agency_id: agencyId, amount_bs: data.mobile_received, description: '[RECIBIDO]' });
        }
        if (data.mobile_paid > 0) {
          items.push({ agency_id: agencyId, amount_bs: -data.mobile_paid, description: '[PAGADO]' });
        }
        return items;
      });

      const posData = Array.from(agencyDataMap.entries()).map(([agencyId, data]) => ({
        agency_id: agencyId,
        amount_bs: data.pos_total
      }));

      // Fetch weekly bank expenses for total calculation
      const { data: expensesData, error: expensesError } = await supabase
        .from('weekly_bank_expenses')
        .select('amount_bs, amount_usd')
        .eq('week_start_date', startStr)
        .eq('week_end_date', endStr);

      if (expensesError) throw expensesError;

      // Fetch payroll for total calculation (nómina como gasto fijo)
      const { data: payrollData, error: payrollError } = await supabase
        .from('weekly_payroll')
        .select('total_bs, total_usd, employee_id, week_start_date')
        .eq('week_start_date', startStr);

      if (payrollError) throw payrollError;
      
      console.log('📊 Datos de nómina obtenidos en BankBalanceWeekly:');
      console.log('  📅 Semana consultada:', startStr);
      console.log('  📋 Registros encontrados:', payrollData?.length || 0);
      console.log('  📝 Detalle por registro:', payrollData?.map((p, idx) => ({
        index: idx,
        employee_id: p.employee_id,
        week_start_date: p.week_start_date,
        total_bs: Number(p.total_bs || 0),
        total_usd: Number(p.total_usd || 0)
      })));
      
      // Calcular total de gastos incluyendo nómina (Bs y USD por separado)
      const expensesTotalBs = expensesData?.reduce((sum, e) => sum + Number(e.amount_bs || 0), 0) || 0;
      const expensesTotalUsd = expensesData?.reduce((sum, e) => sum + Number(e.amount_usd || 0), 0) || 0;
      const payrollTotalBs = payrollData?.reduce((sum, p) => {
        const bs = Number(p.total_bs || 0);
        console.log(`  - Sumando nómina: employee_id=${p.employee_id}, total_bs=${bs}`);
        return sum + bs;
      }, 0) || 0;
      const payrollTotalUsd = payrollData?.reduce((sum, p) => {
        const usd = Number(p.total_usd || 0);
        console.log(`  - Sumando nómina: employee_id=${p.employee_id}, total_usd=${usd}`);
        return sum + usd;
      }, 0) || 0;
      
      console.log('💰 Totales calculados en BankBalanceWeekly:', {
        expensesTotalBs,
        expensesTotalUsd,
        payrollTotalBs,
        payrollTotalUsd
      });
      
      const totalWeeklyExpenses = expensesTotalBs + payrollTotalBs;
      const totalWeeklyExpensesUsd = expensesTotalUsd + payrollTotalUsd;

      // Get agency names
      const uniqueAgencyIds = Array.from(
        new Set([
          ...(mobileData?.map(m => m.agency_id) || []),
          ...(posData?.map(p => p.agency_id) || [])
        ])
      ).filter(Boolean);

      const { data: agencyNames } = await supabase
        .from('agencies')
        .select('id, name')
        .in('id', uniqueAgencyIds);

      // Calculate balances by agency
      const balanceMap = new Map<string, AgencyBankBalance>();

      uniqueAgencyIds.forEach(agencyId => {
        const agency = agencyNames?.find(a => a.id === agencyId);
        
        // Calculate mobile payments
        const agencyMobile = mobileData?.filter(m => m.agency_id === agencyId) || [];
        const mobileReceived = agencyMobile
          .filter(m => m.amount_bs > 0 || m.description?.includes('[RECIBIDO]'))
          .reduce((sum, m) => sum + Math.abs(Number(m.amount_bs)), 0);
        
        const mobilePaid = agencyMobile
          .filter(m => m.amount_bs < 0 || m.description?.includes('[PAGADO]'))
          .reduce((sum, m) => sum + Math.abs(Number(m.amount_bs)), 0);

        // Calculate POS
        const posTotal = posData
          ?.filter(p => p.agency_id === agencyId)
          .reduce((sum, p) => sum + Number(p.amount_bs), 0) || 0;

        const bankBalance = mobileReceived - mobilePaid + posTotal;

        balanceMap.set(agencyId, {
          agency_id: agencyId,
          agency_name: agency?.name || 'Agencia desconocida',
          mobile_received: mobileReceived,
          mobile_paid: mobilePaid,
          pos_total: posTotal,
          bank_balance: bankBalance,
        });
      });

      const balancesList = Array.from(balanceMap.values())
        .sort((a, b) => a.agency_name.localeCompare(b.agency_name));

      console.log('✅ BankBalanceWeekly - Balances calculados:', {
        totalAgencies: balancesList.length,
        sampleBalance: balancesList[0],
        totalReceived: balancesList.reduce((sum, b) => sum + b.mobile_received, 0),
        totalPaid: balancesList.reduce((sum, b) => sum + b.mobile_paid, 0),
        totalPos: balancesList.reduce((sum, b) => sum + b.pos_total, 0)
      });

      setBalances(balancesList);
      setTotalExpenses(totalWeeklyExpenses);
      setTotalExpensesUsd(totalWeeklyExpensesUsd);
      
      // Calcular balance bancario en USD (si hay datos de USD en mobile payments o POS)
      // Por ahora solo restamos los gastos en USD del balance bancario en USD
      // El balance bancario en USD se calcula como: recibido_usd - pagado_usd - gastos_usd
      setTotalBankUsd(-totalWeeklyExpensesUsd); // Negativo porque es un gasto
    } catch (error) {
      console.error('Error fetching bank balances:', error);
      toast({
        title: 'Error',
        description: 'Error al cargar los saldos bancarios',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const navigateWeek = (dir: 'prev' | 'next') => {
    if (!currentWeek) return;
    const newStart = dir === 'prev' ? subWeeks(currentWeek.start, 1) : addWeeks(currentWeek.start, 1);
    const newEnd = endOfWeek(newStart, { weekStartsOn: 1 });
    setCurrentWeek({ start: newStart, end: newEnd });
  };

  if (loading || !currentWeek) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-center">
          <RefreshCcw className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Cargando saldos bancarios...</p>
        </div>
      </div>
    );
  }

  const totalReceived = balances.reduce((sum, b) => sum + b.mobile_received, 0);
  const totalPaid = balances.reduce((sum, b) => sum + b.mobile_paid, 0);
  const totalPos = balances.reduce((sum, b) => sum + b.pos_total, 0);
  const totalBankBeforeExpenses = totalReceived - totalPaid + totalPos;
  const totalBankAfterExpenses = totalBankBeforeExpenses - totalExpenses;

  return (
    <div className="space-y-6">
      {/* Header with week navigation */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <Landmark className="h-6 w-6 text-primary" />
          <div>
            <h2 className="text-2xl font-bold">Bolívares en Bancooo</h2>
            <p className="text-sm text-muted-foreground">
              {format(currentWeek.start, "d 'de' MMMM", { locale: es })} — {format(currentWeek.end, "d 'de' MMMM 'de' yyyy", { locale: es })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => navigateWeek('prev')}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={() => navigateWeek('next')}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={fetchBankBalances} title="Refrescar datos">
            <RefreshCcw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Agency Filter */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-2">
            <Label>Filtrar por Agencia</Label>
            <Select value={selectedAgency} onValueChange={setSelectedAgency}>
              <SelectTrigger className="w-full sm:w-64">
                <SelectValue placeholder="Seleccionar agencia" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las Agencias</SelectItem>
                {agencies.map((agency) => (
                  <SelectItem key={agency.id} value={agency.id}>
                    {agency.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards - Smaller */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card className="border-2 border-green-200 bg-green-50/50">
          <CardHeader className="pb-2 pt-3">
            <CardTitle className="text-xs text-green-700 flex items-center gap-1">
              <TrendingUp className="h-3 w-3" />
              PM Recibido
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-3">
            <p className="text-lg font-bold text-green-600">
              {formatCurrency(totalReceived, 'VES')}
            </p>
          </CardContent>
        </Card>

        <Card className="border-2 border-red-200 bg-red-50/50">
          <CardHeader className="pb-2 pt-3">
            <CardTitle className="text-xs text-red-700 flex items-center gap-1">
              <TrendingDown className="h-3 w-3" />
              PM Pagado
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-3">
            <p className="text-lg font-bold text-red-600">
              {formatCurrency(totalPaid, 'VES')}
            </p>
          </CardContent>
        </Card>

        <Card className="border-2 border-blue-200 bg-blue-50/50">
          <CardHeader className="pb-2 pt-3">
            <CardTitle className="text-xs text-blue-700 flex items-center gap-1">
              <CreditCard className="h-3 w-3" />
              Punto de Venta
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-3">
            <p className="text-lg font-bold text-blue-600">
              {formatCurrency(totalPos, 'VES')}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Weekly Expenses Manager - Bolívares */}
      <WeeklyBankExpensesManager
        weekStart={currentWeek.start}
        weekEnd={currentWeek.end}
        onExpensesChange={fetchBankBalances}
      />

      {/* Weekly Expenses Manager - Dólares */}
      <WeeklyBankExpensesUsdManager
        weekStart={currentWeek.start}
        weekEnd={currentWeek.end}
        onExpensesChange={fetchBankBalances}
      />

      {/* Agency Details Table */}
      <Card>
        <CardHeader>
          <CardTitle>Detalle por Agencia</CardTitle>
        </CardHeader>
        <CardContent>
          {balances.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No hay datos bancarios para esta semana
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="font-bold">Agencia</TableHead>
                    <TableHead className="text-right font-bold text-green-700">PM Recibido</TableHead>
                    <TableHead className="text-right font-bold text-red-700">PM Pagado</TableHead>
                    <TableHead className="text-right font-bold text-blue-700">Punto Venta</TableHead>
                    <TableHead className="text-center font-bold text-muted-foreground">Banco POS</TableHead>
                    <TableHead className="text-right font-bold text-primary">Total Banco</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {balances.map((balance) => (
                    <TableRow key={balance.agency_id} className="hover:bg-muted/30">
                      <TableCell className="font-medium text-sm">{balance.agency_name}</TableCell>
                      <TableCell className="text-right text-sm font-semibold text-green-600">
                        {formatCurrency(balance.mobile_received, 'VES')}
                      </TableCell>
                      <TableCell className="text-right text-sm font-semibold text-red-600">
                        -{formatCurrency(balance.mobile_paid, 'VES')}
                      </TableCell>
                      <TableCell className="text-right text-sm font-semibold text-blue-600">
                        {formatCurrency(balance.pos_total, 'VES')}
                      </TableCell>
                      <TableCell className="text-center text-xs text-muted-foreground">
                        <span className="bg-muted px-2 py-1 rounded">-</span>
                      </TableCell>
                      <TableCell className={`text-right text-sm font-bold ${balance.bank_balance >= 0 ? 'text-primary' : 'text-destructive'}`}>
                        {formatCurrency(balance.bank_balance, 'VES')}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow className="bg-muted/50">
                    <TableCell className="font-bold">TOTALES</TableCell>
                    <TableCell className="text-right font-bold text-green-700">
                      {formatCurrency(totalReceived, 'VES')}
                    </TableCell>
                    <TableCell className="text-right font-bold text-red-700">
                      -{formatCurrency(totalPaid, 'VES')}
                    </TableCell>
                    <TableCell className="text-right font-bold text-blue-700">
                      {formatCurrency(totalPos, 'VES')}
                    </TableCell>
                    <TableCell></TableCell>
                    <TableCell className={`text-right font-bold text-lg ${totalBankBeforeExpenses >= 0 ? 'text-primary' : 'text-destructive'}`}>
                      {formatCurrency(totalBankBeforeExpenses, 'VES')}
                    </TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
              
              {/* Final Totals Summary */}
              <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="border-2 border-primary/20">
                  <CardContent className="pt-4">
                    <p className="text-xs text-muted-foreground mb-1">Total en Banco</p>
                    <p className={`text-2xl font-bold ${totalBankBeforeExpenses >= 0 ? 'text-primary' : 'text-destructive'}`}>
                      {formatCurrency(totalBankBeforeExpenses, 'VES')}
                    </p>
                  </CardContent>
                </Card>

                <Card className="border-2 border-orange-200 bg-orange-50/30">
                  <CardContent className="pt-4">
                    <p className="text-xs text-orange-700 mb-1">Gastos Fijos (incluye Nómina)</p>
                    <p className="text-2xl font-bold text-orange-600">
                      -{formatCurrency(totalExpenses, 'VES')}
                    </p>
                    {totalExpensesUsd > 0 && (
                      <p className="text-xs text-orange-600/70 mt-1 font-mono">
                        -{formatCurrency(totalExpensesUsd, 'USD')}
                      </p>
                    )}
                  </CardContent>
                </Card>

                <Card className="border-4 border-primary bg-primary/5">
                  <CardContent className="pt-4">
                    <p className="text-xs text-primary mb-1 flex items-center gap-1">
                      <Landmark className="h-3 w-3" />
                      Monto Definitivo en Banco
                    </p>
                    <p className={`text-3xl font-bold ${totalBankAfterExpenses >= 0 ? 'text-primary' : 'text-destructive'}`}>
                      {formatCurrency(totalBankAfterExpenses, 'VES')}
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}