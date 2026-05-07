import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, Eye, FileText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/components/ui/use-toast';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown } from 'lucide-react';

interface WeeklyHistory {
  week_start_date: string;
  week_end_date: string;
  total_sales_bs: number;
  total_sales_usd: number;
  total_prizes_bs: number;
  total_prizes_usd: number;
  total_balance_bs: number;
  total_balance_usd: number;
  total_sessions: number;
  is_weekly_closed: boolean;
  weekly_closure_notes: string;
  created_at: string;
}

interface DailyDetail {
  session_date: string;
  total_sales_bs: number;
  total_sales_usd: number;
  total_prizes_bs: number;
  total_prizes_usd: number;
  balance_bs: number;
  lottery_system_id: string;
  lottery_system_name?: string;
}

export function WeeklyCuadreHistory() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [history, setHistory] = useState<WeeklyHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedWeek, setSelectedWeek] = useState<WeeklyHistory | null>(null);
  const [weekDetails, setWeekDetails] = useState<DailyDetail[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);

  useEffect(() => {
    if (user) {
      fetchHistory();
    }
  }, [user]);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      // Get all closed weeks from daily_cuadres_summary
      const { data, error } = await supabase
        .from('daily_cuadres_summary')
        .select(`
          week_start_date,
          week_end_date,
          weekly_closure_notes,
          total_sales_bs,
          total_sales_usd,
          total_prizes_bs,
          total_prizes_usd,
          balance_bs,
          created_at
        `)
        .eq('user_id', user?.id)
        .eq('is_weekly_closed', true)
        .is('session_id', null) // Solo datos de encargada
        .not('week_start_date', 'is', null)
        .order('week_start_date', { ascending: false });

      if (error) throw error;

      // Group by week and calculate totals
      const weeklyData: { [key: string]: WeeklyHistory } = {};
      
      data?.forEach(cuadre => {
        const weekKey = `${cuadre.week_start_date}_${cuadre.week_end_date}`;
        
        if (!weeklyData[weekKey]) {
          weeklyData[weekKey] = {
            week_start_date: cuadre.week_start_date,
            week_end_date: cuadre.week_end_date,
            total_sales_bs: 0,
            total_sales_usd: 0,
            total_prizes_bs: 0,
            total_prizes_usd: 0,
            total_balance_bs: 0,
            total_balance_usd: 0,
            total_sessions: 0,
            is_weekly_closed: true,
            weekly_closure_notes: cuadre.weekly_closure_notes || '',
            created_at: cuadre.created_at,
          };
        }
        
        weeklyData[weekKey].total_sales_bs += Number(cuadre.total_sales_bs || 0);
        weeklyData[weekKey].total_sales_usd += Number(cuadre.total_sales_usd || 0);
        weeklyData[weekKey].total_prizes_bs += Number(cuadre.total_prizes_bs || 0);
        weeklyData[weekKey].total_prizes_usd += Number(cuadre.total_prizes_usd || 0);
        weeklyData[weekKey].total_balance_bs += Number(cuadre.balance_bs || 0);
        weeklyData[weekKey].total_sessions += 1;
      });

      // Calculate balance USD
      Object.values(weeklyData).forEach(week => {
        week.total_balance_usd = week.total_sales_usd - week.total_prizes_usd;
      });

      setHistory(Object.values(weeklyData));
    } catch (error: any) {
      console.error('[HistorialSemanal] Error obteniendo historial:', error);
      toast({
        title: "Error",
        description: "No se pudo cargar el histórico",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchWeekDetails = async (week: WeeklyHistory) => {
    setLoadingDetails(true);
    try {
      const { data, error } = await supabase
        .from('daily_cuadres_summary')
        .select(`
          session_date,
          total_sales_bs,
          total_sales_usd,
          total_prizes_bs,
          total_prizes_usd,
          balance_bs,
          lottery_system_id,
          lottery_systems(name)
        `)
        .eq('user_id', user?.id)
        .is('session_id', null) // Solo datos de encargada
        .eq('week_start_date', week.week_start_date)
        .eq('week_end_date', week.week_end_date)
        .order('session_date');

      if (error) throw error;

      const details: DailyDetail[] = (data || []).map(item => ({
        session_date: item.session_date,
        total_sales_bs: Number(item.total_sales_bs || 0),
        total_sales_usd: Number(item.total_sales_usd || 0),
        total_prizes_bs: Number(item.total_prizes_bs || 0),
        total_prizes_usd: Number(item.total_prizes_usd || 0),
        balance_bs: Number(item.balance_bs || 0),
        lottery_system_id: item.lottery_system_id,
        lottery_system_name: (item.lottery_systems as any)?.name || 'Sistema desconocido',
      }));

      setWeekDetails(details);
    } catch (error: any) {
      console.error('[HistorialSemanal] Error obteniendo detalles de semana:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los detalles de la semana",
        variant: "destructive",
      });
    } finally {
      setLoadingDetails(false);
    }
  };

  const openWeekDetails = (week: WeeklyHistory) => {
    setSelectedWeek(week);
    fetchWeekDetails(week);
  };

  const formatCurrency = (amount: number, currency: 'bs' | 'usd') => {
    if (currency === 'usd') {
      return `$${Number(amount).toLocaleString('es-VE')}`;
    }
    return `${Number(amount).toLocaleString('es-VE')} Bs`;
  };

  if (loading) {
    return <div className="p-6">Cargando histórico...</div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Histórico de Cuadres Semanales
          </CardTitle>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No hay cuadres semanales registrados
            </p>
          ) : (
            <div className="space-y-4">
              {history.map((week, index) => (
                <Card key={`${week.week_start_date}_${week.week_end_date}_${index}`} className="border-l-4 border-l-primary">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="font-semibold">
                          Semana del {format(new Date(week.week_start_date), 'dd MMM', { locale: es })} al {format(new Date(week.week_end_date), 'dd MMM yyyy', { locale: es })}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {week.total_sessions} sistema(s) registrado(s)
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="default">
                          Cerrada
                        </Badge>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="outline" size="sm" onClick={() => openWeekDetails(week)}>
                              <Eye className="h-4 w-4 mr-1" />
                              Ver Detalles
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                            <DialogHeader>
                              <DialogTitle>
                                Detalles - Semana del {selectedWeek && format(new Date(selectedWeek.week_start_date), 'dd MMM', { locale: es })} al {selectedWeek && format(new Date(selectedWeek.week_end_date), 'dd MMM yyyy', { locale: es })}
                              </DialogTitle>
                            </DialogHeader>
                            {selectedWeek && (
                              <div className="space-y-6">
                                {/* Weekly Summary */}
                                <Card>
                                  <CardHeader>
                                    <CardTitle className="text-lg">Resumen Semanal</CardTitle>
                                  </CardHeader>
                                  <CardContent>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                                      <div className="text-center">
                                        <p className="text-sm text-muted-foreground">Ventas Bs</p>
                                        <p className="text-xl font-bold text-green-600">
                                          {formatCurrency(selectedWeek.total_sales_bs, 'bs')}
                                        </p>
                                      </div>
                                      <div className="text-center">
                                        <p className="text-sm text-muted-foreground">Ventas USD</p>
                                        <p className="text-xl font-bold text-green-600">
                                          {formatCurrency(selectedWeek.total_sales_usd, 'usd')}
                                        </p>
                                      </div>
                                      <div className="text-center">
                                        <p className="text-sm text-muted-foreground">Premios Bs</p>
                                        <p className="text-xl font-bold text-red-600">
                                          {formatCurrency(selectedWeek.total_prizes_bs, 'bs')}
                                        </p>
                                      </div>
                                      <div className="text-center">
                                        <p className="text-sm text-muted-foreground">Premios USD</p>
                                        <p className="text-xl font-bold text-red-600">
                                          {formatCurrency(selectedWeek.total_prizes_usd, 'usd')}
                                        </p>
                                      </div>
                                    </div>
                                    
                                    <div className="grid grid-cols-2 gap-4 mb-4">
                                      <div className="text-center p-3 bg-muted rounded-lg">
                                        <p className="text-sm text-muted-foreground">Balance Bs</p>
                                        <p className={`text-2xl font-bold ${Number(selectedWeek.total_balance_bs) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                          {formatCurrency(selectedWeek.total_balance_bs, 'bs')}
                                        </p>
                                      </div>
                                      <div className="text-center p-3 bg-muted rounded-lg">
                                        <p className="text-sm text-muted-foreground">Balance USD</p>
                                        <p className={`text-2xl font-bold ${Number(selectedWeek.total_balance_usd) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                          {formatCurrency(selectedWeek.total_balance_usd, 'usd')}
                                        </p>
                                      </div>
                                    </div>

                                    {selectedWeek.weekly_closure_notes && (
                                      <div className="mt-4 p-3 bg-muted rounded-lg">
                                        <p className="text-sm text-muted-foreground mb-1">Notas de Cierre:</p>
                                        <p className="text-sm">{selectedWeek.weekly_closure_notes}</p>
                                      </div>
                                    )}
                                  </CardContent>
                                </Card>

                                {/* Daily Details */}
                                <Card>
                                  <CardHeader>
                                    <CardTitle className="text-lg">Desglose por Sistema y Fecha</CardTitle>
                                  </CardHeader>
                                  <CardContent>
                                    {loadingDetails ? (
                                      <p className="text-center py-4">Cargando detalles...</p>
                                    ) : (
                                      <div className="space-y-2">
                                        {weekDetails.map((detail, idx) => (
                                          <div key={idx} className="p-3 bg-muted rounded-lg">
                                            <div className="flex items-center justify-between mb-2">
                                              <div>
                                                <p className="font-medium">{detail.lottery_system_name}</p>
                                                <p className="text-sm text-muted-foreground">
                                                  {format(new Date(detail.session_date), 'dd/MM/yyyy')}
                                                </p>
                                              </div>
                                              <div className="text-right">
                                                <p className={`text-sm font-medium ${Number(detail.balance_bs) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                  Balance: {formatCurrency(detail.balance_bs, 'bs')}
                                                </p>
                                              </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4 text-sm">
                                              <div>
                                                <p className="text-muted-foreground">Ventas:</p>
                                                <p className="font-medium text-green-600">
                                                  {formatCurrency(detail.total_sales_bs, 'bs')} / {formatCurrency(detail.total_sales_usd, 'usd')}
                                                </p>
                                              </div>
                                              <div>
                                                <p className="text-muted-foreground">Premios:</p>
                                                <p className="font-medium text-red-600">
                                                  {formatCurrency(detail.total_prizes_bs, 'bs')} / {formatCurrency(detail.total_prizes_usd, 'usd')}
                                                </p>
                                              </div>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </CardContent>
                                </Card>
                              </div>
                            )}
                          </DialogContent>
                        </Dialog>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                      <div className="text-center">
                        <p className="text-muted-foreground">Ventas Bs</p>
                        <p className="font-semibold text-green-600">
                          {formatCurrency(week.total_sales_bs, 'bs')}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-muted-foreground">Ventas USD</p>
                        <p className="font-semibold text-green-600">
                          {formatCurrency(week.total_sales_usd, 'usd')}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-muted-foreground">Premios Bs</p>
                        <p className="font-semibold text-red-600">
                          {formatCurrency(week.total_prizes_bs, 'bs')}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-muted-foreground">Premios USD</p>
                        <p className="font-semibold text-red-600">
                          {formatCurrency(week.total_prizes_usd, 'usd')}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-muted-foreground">Balance Total</p>
                        <p className={`font-semibold ${Number(week.total_balance_bs) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatCurrency(week.total_balance_bs, 'bs')}
                        </p>
                        <p className={`text-xs ${Number(week.total_balance_usd) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatCurrency(week.total_balance_usd, 'usd')}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}