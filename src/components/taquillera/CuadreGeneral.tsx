import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { formatCurrency } from '@/lib/utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { Calculator, CheckCircle2, XCircle, Save, TrendingUp, TrendingDown, ChevronDown, ChevronRight } from 'lucide-react';
import { formatDateForDB } from '@/lib/dateUtils';
interface CuadreGeneralProps {
  refreshKey?: number;
  dateRange?: {
    from: Date;
    to: Date;
  };
}
interface CuadreData {
  // Sales & Prizes
  totalSales: {
    bs: number;
    usd: number;
  };
  totalPrizes: {
    bs: number;
    usd: number;
  };

  // Expenses separated by category
  totalGastos: {
    bs: number;
    usd: number;
  };
  totalDeudas: {
    bs: number;
    usd: number;
  };

  // Detailed expenses for dropdowns
  gastosDetails: Array<{
    description: string;
    amount_bs: number;
    amount_usd: number;
    created_at: string;
  }>;
  deudasDetails: Array<{
    description: string;
    amount_bs: number;
    amount_usd: number;
    created_at: string;
  }>;

  // Mobile payments separated
  pagoMovilRecibidos: number;
  pagoMovilPagados: number;

  // Point of sale
  totalPointOfSale: number;

  // Daily closure data
  cashAvailable: number;
  cashAvailableUsd: number;
  closureConfirmed: boolean;
  closureNotes: string;
  premiosPorPagar: number;

  // Exchange rate
  exchangeRate: number;

  // Additional adjustments
  applyExcessUsd: boolean;
  additionalAmountBs: number;
  additionalAmountUsd: number;
  additionalNotes: string;

  // Session info
  sessionId?: string;

  // Encargada feedback
  encargadaFeedback?: {
    encargada_status?: string;
    encargada_observations?: string;
    encargada_reviewed_at?: string;
  } | null;
}
export const CuadreGeneral = ({
  refreshKey = 0,
  dateRange
}: CuadreGeneralProps) => {
  const [cuadre, setCuadre] = useState<CuadreData>({
    totalSales: {
      bs: 0,
      usd: 0
    },
    totalPrizes: {
      bs: 0,
      usd: 0
    },
    totalGastos: {
      bs: 0,
      usd: 0
    },
    totalDeudas: {
      bs: 0,
      usd: 0
    },
    gastosDetails: [],
    deudasDetails: [],
    pagoMovilRecibidos: 0,
    pagoMovilPagados: 0,
    totalPointOfSale: 0,
    cashAvailable: 0,
    cashAvailableUsd: 0,
    closureConfirmed: false,
    closureNotes: '',
    premiosPorPagar: 0,
    exchangeRate: 36.00,
    applyExcessUsd: true,
    additionalAmountBs: 0,
    additionalAmountUsd: 0,
    additionalNotes: ''
  });

  // Temporary string states for input fields
  const [exchangeRateInput, setExchangeRateInput] = useState<string>('36.00');
  const [cashAvailableInput, setCashAvailableInput] = useState<string>('0');
  const [cashAvailableUsdInput, setCashAvailableUsdInput] = useState<string>('0');
  const [additionalAmountBsInput, setAdditionalAmountBsInput] = useState<string>('0');
  const [additionalAmountUsdInput, setAdditionalAmountUsdInput] = useState<string>('0');
  const [additionalNotesInput, setAdditionalNotesInput] = useState<string>('');
  const [applyExcessUsdSwitch, setApplyExcessUsdSwitch] = useState<boolean>(true);

  // Encargada review status
  const [encargadaStatus, setEncargadaStatus] = useState<string | null>(null);
  const [encargadaObservations, setEncargadaObservations] = useState<string | null>(null);

  // Track if user has manually edited the fields to prevent overriding them
  const [fieldsEditedByUser, setFieldsEditedByUser] = useState({
    exchangeRate: false,
    cashAvailable: false,
    cashAvailableUsd: false
  });

  // Track if we've already shown a toast for the current status to avoid duplicates
  // Usar un objeto para rastrear múltiples estados por sesión
  const lastNotifiedStatusRef = useRef<Record<string, string>>({});
  const isFetchingRef = useRef(false);

  // State for collapsible dropdowns
  const [gastosOpen, setGastosOpen] = useState(false);
  const [deudasOpen, setDeudasOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const {
    user
  } = useAuth();
  const {
    toast
  } = useToast();

  // Declarar fetchCuadreData ANTES de los useEffect que lo usan
  const fetchCuadreData = useCallback(async (skipToasts = false) => {
    if (!user || !dateRange) return;

    // Evitar múltiples llamadas simultáneas
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    try {
      setLoading(true);
      const fromDate = formatDateForDB(dateRange.from);
      const toDate = formatDateForDB(dateRange.to);

      // Get sessions in date range - using user.id (auth user ID)
      const {
        data: sessions,
        error: sessionsError
      } = await supabase.from('daily_sessions').select('id, session_date, cash_available_bs, cash_available_usd, daily_closure_confirmed, closure_notes, exchange_rate').eq('user_id', user.id).gte('session_date', fromDate).lte('session_date', toDate);
      if (sessionsError) throw sessionsError;
      const sessionIds = sessions.map(s => s.id);

      // For single day, get session data
      let sessionData = null;
      if (sessions.length === 1) {
        sessionData = sessions[0];
      }

      // Fetch all data in parallel
      const [salesData, prizesData, expensesData, mobilePaymentsData, posData, pendingPrizesData] = await Promise.all([supabase.from('sales_transactions').select('amount_bs, amount_usd').in('session_id', sessionIds), supabase.from('prize_transactions').select('amount_bs, amount_usd').in('session_id', sessionIds), supabase.from('expenses').select('amount_bs, amount_usd, category, description, created_at').in('session_id', sessionIds), supabase.from('mobile_payments').select('amount_bs, description').in('session_id', sessionIds), supabase.from('point_of_sale').select('amount_bs').in('session_id', sessionIds), supabase.from('pending_prizes').select('amount_bs, is_paid').in('session_id', sessionIds)]);

      // Check for errors
      if (salesData.error) throw salesData.error;
      if (prizesData.error) throw prizesData.error;
      if (expensesData.error) throw expensesData.error;
      if (mobilePaymentsData.error) throw mobilePaymentsData.error;
      if (posData.error) throw posData.error;
      if (pendingPrizesData.error) throw pendingPrizesData.error;

      // Calculate totals
      const totalSales = salesData.data?.reduce((acc, item) => ({
        bs: acc.bs + Number(item.amount_bs || 0),
        usd: acc.usd + Number(item.amount_usd || 0)
      }), {
        bs: 0,
        usd: 0
      }) || {
        bs: 0,
        usd: 0
      };
      const totalPrizes = prizesData.data?.reduce((acc, item) => ({
        bs: acc.bs + Number(item.amount_bs || 0),
        usd: acc.usd + Number(item.amount_usd || 0)
      }), {
        bs: 0,
        usd: 0
      }) || {
        bs: 0,
        usd: 0
      };

      // Separate expenses by category
      const gastos = expensesData.data?.filter(e => e.category === 'gasto_operativo') || [];
      const deudas = expensesData.data?.filter(e => e.category === 'deuda') || [];
      const totalGastos = gastos.reduce((acc, item) => ({
        bs: acc.bs + Number(item.amount_bs || 0),
        usd: acc.usd + Number(item.amount_usd || 0)
      }), {
        bs: 0,
        usd: 0
      });
      const totalDeudas = deudas.reduce((acc, item) => ({
        bs: acc.bs + Number(item.amount_bs || 0),
        usd: acc.usd + Number(item.amount_usd || 0)
      }), {
        bs: 0,
        usd: 0
      });

      // Separate mobile payments (positive = received, negative = paid)
      const pagoMovilRecibidos = mobilePaymentsData.data?.reduce((sum, item) => {
        const amount = Number(item.amount_bs || 0);
        return amount > 0 ? sum + amount : sum;
      }, 0) || 0;
      const pagoMovilPagados = Math.abs(mobilePaymentsData.data?.reduce((sum, item) => {
        const amount = Number(item.amount_bs || 0);
        return amount < 0 ? sum + amount : sum;
      }, 0) || 0);
      const totalPointOfSale = posData.data?.reduce((sum, item) => sum + Number(item.amount_bs || 0), 0) || 0;

      // Calculate pending prizes from new table
      const premiosPorPagarFromDB = pendingPrizesData.data?.filter(p => !p.is_paid).reduce((sum, item) => sum + Number(item.amount_bs || 0), 0) || 0;

      // Check if we have an existing cuadres summary with encargada feedback and additional data
      let encargadaFeedback = null;
      let additionalAmountBs = 0;
      let additionalAmountUsd = 0;
      let additionalNotes = '';
      let applyExcessUsd = true;
      if (sessionData?.id) {
        const {
          data: cuadreSummary
        } = await supabase.from('daily_cuadres_summary').select('encargada_status, encargada_observations, encargada_reviewed_at, notes').eq('session_id', sessionData.id).maybeSingle();
        if (cuadreSummary) {
          encargadaFeedback = cuadreSummary;

          // Parse notes field for additional data
          if (cuadreSummary.notes) {
            try {
              const notesData = JSON.parse(cuadreSummary.notes);
              additionalAmountBs = Number(notesData.additionalAmountBs || 0);
              additionalAmountUsd = Number(notesData.additionalAmountUsd || 0);
              additionalNotes = notesData.additionalNotes || '';
              applyExcessUsd = notesData.applyExcessUsd !== undefined ? notesData.applyExcessUsd : true;
            } catch {
              // If notes is not JSON, treat as legacy text
              additionalNotes = cuadreSummary.notes;
            }
          }
        }
      }
      const finalCuadre = {
        totalSales,
        totalPrizes,
        totalGastos,
        totalDeudas,
        gastosDetails: gastos,
        deudasDetails: deudas,
        pagoMovilRecibidos,
        pagoMovilPagados,
        totalPointOfSale,
        cashAvailable: sessionData ? Number(sessionData.cash_available_bs || 0) : 0,
        cashAvailableUsd: sessionData ? Number(sessionData.cash_available_usd || 0) : 0,
        closureConfirmed: sessionData ? sessionData.daily_closure_confirmed || false : false,
        closureNotes: sessionData ? sessionData.closure_notes || '' : '',
        premiosPorPagar: premiosPorPagarFromDB,
        exchangeRate: sessionData ? Number(sessionData.exchange_rate || 36.00) : 36.00,
        applyExcessUsd,
        additionalAmountBs,
        additionalAmountUsd,
        additionalNotes,
        sessionId: sessionData?.id,
        encargadaFeedback
      };
      setCuadre(finalCuadre);
      setAdditionalAmountBsInput(additionalAmountBs.toString());
      setAdditionalAmountUsdInput(additionalAmountUsd.toString());
      setAdditionalNotesInput(additionalNotes);
      setApplyExcessUsdSwitch(applyExcessUsd);

      // Set encargada review status - solo para la fecha actual
      if (encargadaFeedback && sessionData?.id) {
        const newStatus = encargadaFeedback.encargada_status || null;
        setEncargadaStatus(newStatus);
        setEncargadaObservations(encargadaFeedback.encargada_observations || null);

        // Mostrar toast al cargar si hay un estado de rechazado/aprobado y no se ha mostrado antes
        if (!skipToasts && newStatus && (newStatus === 'rechazado' || newStatus === 'aprobado')) {
          const statusKey = `${sessionData.id}-${newStatus}`;
          if (!lastNotifiedStatusRef.current[statusKey]) {
            lastNotifiedStatusRef.current[statusKey] = newStatus;
            const sessionDate = sessionData.session_date ? new Date(sessionData.session_date) : dateRange.from;
            const dateFormatted = format(sessionDate, "dd 'de' MMMM, yyyy", {
              locale: es
            });
            if (newStatus === 'rechazado') {
              toast({
                title: '❌ Cuadre Rechazado',
                description: `Tu cuadre del ${dateFormatted} fue rechazado por la encargada.${encargadaFeedback.encargada_observations ? ` Observaciones: ${encargadaFeedback.encargada_observations}` : ''}`,
                variant: 'destructive',
                duration: 10000
              });
            } else if (newStatus === 'aprobado') {
              toast({
                title: '✅ Cuadre Aprobado',
                description: `Tu cuadre del ${dateFormatted} ha sido aprobado por la encargada.`,
                duration: 5000
              });
            }
          }
        }
      } else {
        // Limpiar el estado si no hay feedback para esta fecha
        setEncargadaStatus(null);
        setEncargadaObservations(null);
      }

      // Update input states only if user hasn't edited them manually
      if (!fieldsEditedByUser.exchangeRate) {
        setExchangeRateInput(finalCuadre.exchangeRate.toString());
      }
      if (!fieldsEditedByUser.cashAvailable) {
        setCashAvailableInput(finalCuadre.cashAvailable.toString());
      }
      if (!fieldsEditedByUser.cashAvailableUsd) {
        setCashAvailableUsdInput(finalCuadre.cashAvailableUsd.toString());
      }
    } catch (error) {
      console.error('Error fetching cuadre data:', error);
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, [user, dateRange]);

  // Solo recargar cuando cambia refreshKey o dateRange, no en cada render
  useEffect(() => {
    if (user && dateRange) {
      // Limpiar estados de encargada al cambiar de fecha
      setEncargadaStatus(null);
      setEncargadaObservations(null);
      // Limpiar referencias de notificaciones al cambiar de fecha para permitir nuevas notificaciones
      lastNotifiedStatusRef.current = {};
      fetchCuadreData(false); // skipToasts = false para mostrar notificación al cargar si hay estado
    }
  }, [user, refreshKey, dateRange?.from?.getTime(), dateRange?.to?.getTime()]);

  // La suscripción en tiempo real ahora está en TaquilleraDashboard para que funcione desde cualquier lugar

  const saveDailyClosure = async () => {
    if (!user || !dateRange) {
      toast({
        title: 'Error',
        description: 'Usuario o fecha no válidos',
        variant: 'destructive'
      });
      return;
    }
    setSaving(true);
    try {
      let sessionId = cuadre.sessionId;

      // Si no hay sesión, crear una para el día actual
      if (!sessionId) {
        const currentDate = formatDateForDB(dateRange.from);
        const {
          data: newSession,
          error: createError
        } = await supabase.from('daily_sessions').insert({
          user_id: user.id,
          session_date: currentDate,
          cash_available_bs: cuadre.cashAvailable,
          cash_available_usd: cuadre.cashAvailableUsd,
          exchange_rate: cuadre.exchangeRate,
          daily_closure_confirmed: cuadre.closureConfirmed,
          closure_notes: cuadre.closureNotes,
          is_closed: false
        }).select('id').single();
        if (createError) throw createError;
        sessionId = newSession.id;

        // Actualizar el cuadre con el nuevo sessionId
        setCuadre(prev => ({
          ...prev,
          sessionId
        }));
      } else {
        // Si la sesión ya existe, actualizarla
        const {
          error
        } = await supabase.from('daily_sessions').update({
          cash_available_bs: cuadre.cashAvailable,
          cash_available_usd: cuadre.cashAvailableUsd,
          daily_closure_confirmed: cuadre.closureConfirmed,
          closure_notes: cuadre.closureNotes,
          exchange_rate: cuadre.exchangeRate
        }).eq('id', sessionId);
        if (error) throw error;
      }

      // Get session info to update daily_cuadres_summary
      const {
        data: sessionInfo
      } = await supabase.from('daily_sessions').select('user_id, session_date').eq('id', sessionId).single();
      if (sessionInfo) {
        // Calculate the important values for closure
        const cuadreVentasPremios = {
          bs: cuadre.totalSales.bs - cuadre.totalPrizes.bs,
          usd: cuadre.totalSales.usd - cuadre.totalPrizes.usd
        };

        // Calculate USD excess
        const inputAdditionalAmountBs = parseFloat(additionalAmountBsInput) || 0;
        const inputAdditionalAmountUsd = parseFloat(additionalAmountUsdInput) || 0;
        const excessUsd = Math.abs(cuadreVentasPremios.usd - cuadre.cashAvailableUsd) - inputAdditionalAmountUsd;

        // Calculate bank total and closure difference
        const totalBanco = cuadre.pagoMovilRecibidos + cuadre.totalPointOfSale - cuadre.pagoMovilPagados;
        const sumatoriaBolivares = cuadre.cashAvailable + totalBanco + cuadre.totalDeudas.bs + cuadre.totalGastos.bs + (applyExcessUsdSwitch ? excessUsd * cuadre.exchangeRate : 0) + inputAdditionalAmountBs;
        const diferenciaCierre = sumatoriaBolivares - cuadreVentasPremios.bs;
        const diferenciaFinal = diferenciaCierre - cuadre.premiosPorPagar;

        // Store additional data in notes field as JSON
        const notesData = {
          additionalAmountBs: inputAdditionalAmountBs,
          additionalAmountUsd: inputAdditionalAmountUsd,
          additionalNotes: additionalNotesInput,
          applyExcessUsd: applyExcessUsdSwitch
        };

        // Get user's agency_id from profile
        let agencyId = null;
        const {
          data: profile
        } = await supabase.from('profiles').select('agency_id').eq('user_id', user.id).single();
        agencyId = profile?.agency_id;

        // Also update daily_cuadres_summary with calculated values
        // Si estaba rechazado y el taquillero guarda de nuevo, resetear a pendiente
        const payload: any = {
          session_id: sessionId,
          user_id: sessionInfo.user_id,
          session_date: sessionInfo.session_date,
          agency_id: agencyId,
          total_sales_bs: cuadre.totalSales.bs,
          total_sales_usd: cuadre.totalSales.usd,
          total_prizes_bs: cuadre.totalPrizes.bs,
          total_prizes_usd: cuadre.totalPrizes.usd,
          total_expenses_bs: cuadre.totalGastos.bs + cuadre.totalDeudas.bs,
          total_expenses_usd: cuadre.totalGastos.usd + cuadre.totalDeudas.usd,
          total_debt_bs: cuadre.totalDeudas.bs,
          total_debt_usd: cuadre.totalDeudas.usd,
          total_mobile_payments_bs: cuadre.pagoMovilRecibidos - cuadre.pagoMovilPagados,
          total_pos_bs: cuadre.totalPointOfSale,
          total_banco_bs: totalBanco,
          cash_available_bs: cuadre.cashAvailable,
          cash_available_usd: cuadre.cashAvailableUsd,
          exchange_rate: cuadre.exchangeRate,
          balance_before_pending_prizes_bs: diferenciaCierre,
          balance_bs: diferenciaFinal,
          is_closed: true,
          daily_closure_confirmed: cuadre.closureConfirmed,
          excess_usd: excessUsd,
          diferencia_final: diferenciaFinal,
          pending_prizes: cuadre.premiosPorPagar,
          closure_notes: cuadre.closureNotes,
          notes: JSON.stringify(notesData),
          // Si estaba rechazado y el taquillero guarda de nuevo, resetear a pendiente (null)
          encargada_status: null,
          encargada_observations: null,
          encargada_reviewed_by: null,
          encargada_reviewed_at: null
        };
        await supabase.from('daily_cuadres_summary').upsert(payload, {
          onConflict: 'session_id'
        });
      }
      toast({
        title: 'Éxito',
        description: 'Cierre diario guardado correctamente'
      });

      // Refrescar los datos
      fetchCuadreData();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Error al guardar el cierre',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };
  if (loading) {
    return <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <Calculator className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p>Calculando cuadre general...</p>
        </div>
      </div>;
  }

  // Calculate main cuadre (Sales - Prizes)
  const cuadreVentasPremios = {
    bs: cuadre.totalSales.bs - cuadre.totalPrizes.bs,
    usd: cuadre.totalSales.usd - cuadre.totalPrizes.usd
  };

  // Calculate bank total (Mobile received + POS - Mobile paid)
  const totalBanco = cuadre.pagoMovilRecibidos + cuadre.totalPointOfSale - cuadre.pagoMovilPagados;

  // Get additional amounts
  const inputAdditionalAmountBs = parseFloat(additionalAmountBsInput) || 0;
  const inputAdditionalAmountUsd = parseFloat(additionalAmountUsdInput) || 0;

  // Calculate USD excess (difference) for BS formula
  const excessUsd = Math.abs(cuadreVentasPremios.usd - cuadre.cashAvailableUsd) - inputAdditionalAmountUsd;

  // Bolivares Closure Formula
  const sumatoriaBolivares = cuadre.cashAvailable + totalBanco + cuadre.totalDeudas.bs + cuadre.totalGastos.bs + (applyExcessUsdSwitch ? excessUsd * cuadre.exchangeRate : 0) + inputAdditionalAmountBs;
  const diferenciaCierre = sumatoriaBolivares - cuadreVentasPremios.bs;
  const diferenciaFinal = diferenciaCierre - cuadre.premiosPorPagar;
  const isCuadreBalanced = Math.abs(diferenciaFinal) <= 100; // Allow 100 Bs tolerance

  const isSingleDay = dateRange && format(dateRange.from, 'yyyy-MM-dd') === format(dateRange.to, 'yyyy-MM-dd');

  // Verificar si el cuadre está aprobado
  const isApproved = encargadaStatus === 'aprobado';
  return <div className="space-y-6">
      {/* Title and Status */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-2xl font-bold">
          Cuadre Diario
          {isSingleDay && dateRange && <span className="text-muted-foreground"> - {format(dateRange.from, "dd 'de' MMMM, yyyy", {
            locale: es
          })}</span>}
        </h2>
        
        <div className="flex items-center gap-2">
          {encargadaStatus && <Badge variant={encargadaStatus === 'aprobado' ? 'default' : encargadaStatus === 'rechazado' ? 'destructive' : 'secondary'} className={encargadaStatus === 'aprobado' ? 'bg-green-600' : ''}>
              {encargadaStatus === 'aprobado' ? '✓ Aprobado' : encargadaStatus === 'rechazado' ? '✗ Rechazado' : 'Pendiente'}
            </Badge>}
          
          {cuadre.closureConfirmed && <Badge variant="default" className="flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" />
              Cuadre Confirmado
            </Badge>}
        </div>
      </div>

      {/* Encargada Feedback Section */}
      {encargadaStatus === 'rechazado' && encargadaObservations && <Card className="border-2 border-destructive bg-destructive/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-destructive">Observaciones de la Encargada</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-sm p-3 bg-background/50 rounded border">
              {encargadaObservations}
            </p>
          </CardContent>
        </Card>}

      {/* Daily Closure Section - Only for single day */}
      {isSingleDay && <Card className="border-2 border-accent/20">
          <CardContent className="space-y-4 pt-6">
            {/* Exchange Rate Section */}
            <div className="grid grid-cols-1 gap-4 mb-4">
              <Card className="bg-primary/5 border-primary/20">
                <CardContent className="pt-4">
                  <div className="flex items-center gap-3 max-w-md mx-auto">
                    <div className="text-lg">💱</div>
                    <div className="flex-1 space-y-1">
                      <Input id="exchange-rate" type="number" step="0.01" min="0" placeholder="36.00" value={exchangeRateInput} onChange={e => {
                    setExchangeRateInput(e.target.value);
                    setFieldsEditedByUser(prev => ({
                      ...prev,
                      exchangeRate: true
                    }));
                    const rate = parseFloat(e.target.value);
                    if (!isNaN(rate) && rate > 0) {
                      setCuadre(prev => ({
                        ...prev,
                        exchangeRate: rate
                      }));
                    }
                  }} onBlur={e => {
                    if (e.target.value === '' || parseFloat(e.target.value) <= 0) {
                      setExchangeRateInput('36.00');
                      setCuadre(prev => ({
                        ...prev,
                        exchangeRate: 36.00
                      }));
                    }
                  }} className="text-center font-medium h-9" disabled={isApproved} readOnly={isApproved} />
                      <p className="text-xs text-muted-foreground text-center">
                        Tasa del día (Bs por USD)
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cash-available" className="text-sm">Efectivo disponible del día</Label>
                <div className="relative">
                  <Input id="cash-available" type="number" step="0.01" placeholder="0.00" value={cashAvailableInput} onChange={e => {
                setCashAvailableInput(e.target.value);
                setFieldsEditedByUser(prev => ({
                  ...prev,
                  cashAvailable: true
                }));
                const amount = parseFloat(e.target.value);
                if (!isNaN(amount) && amount >= 0) {
                  setCuadre(prev => ({
                    ...prev,
                    cashAvailable: amount
                  }));
                }
              }} onBlur={e => {
                if (e.target.value === '' || parseFloat(e.target.value) < 0) {
                  setCashAvailableInput('0');
                  setCuadre(prev => ({
                    ...prev,
                    cashAvailable: 0
                  }));
                }
              }} className="pr-10" disabled={isApproved} readOnly={isApproved} />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    Bs
                  </span>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="cash-available-usd" className="text-sm">Efectivo disponible en USD</Label>
                <div className="relative">
                  <Input id="cash-available-usd" type="number" step="0.01" placeholder="0.00" value={cashAvailableUsdInput} onChange={e => {
                setCashAvailableUsdInput(e.target.value);
                setFieldsEditedByUser(prev => ({
                  ...prev,
                  cashAvailableUsd: true
                }));
                const amount = parseFloat(e.target.value);
                if (!isNaN(amount) && amount >= 0) {
                  setCuadre(prev => ({
                    ...prev,
                    cashAvailableUsd: amount
                  }));
                }
              }} onBlur={e => {
                if (e.target.value === '' || parseFloat(e.target.value) < 0) {
                  setCashAvailableUsdInput('0');
                  setCuadre(prev => ({
                    ...prev,
                    cashAvailableUsd: 0
                  }));
                }
              }} className="pr-10" disabled={isApproved} readOnly={isApproved} />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    $
                  </span>
                </div>
              </div>
            </div>

            {/* Ajustes Adicionales */}
            <Card className="bg-accent/5 border-accent/20">
              <CardHeader>
                <CardTitle className="text-base">Ajustes Adicionales</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="additional-bs" className="text-sm">Monto adicional Bs</Label>
                    <div className="relative">
                      <Input id="additional-bs" type="number" step="0.01" placeholder="0.00" value={additionalAmountBsInput} onChange={e => setAdditionalAmountBsInput(e.target.value)} className="pr-10" disabled={isApproved} readOnly={isApproved} />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                        Bs
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="additional-usd" className="text-sm">Monto adicional USD</Label>
                    <div className="relative">
                      <Input id="additional-usd" type="number" step="0.01" placeholder="0.00" value={additionalAmountUsdInput} onChange={e => setAdditionalAmountUsdInput(e.target.value)} className="pr-10" disabled={isApproved} readOnly={isApproved} />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                        $
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="additional-notes" className="text-sm">Notas de ajustes</Label>
                  <Textarea id="additional-notes" placeholder="Explicación de los ajustes adicionales..." value={additionalNotesInput} onChange={e => setAdditionalNotesInput(e.target.value)} rows={2} className="resize-none" disabled={isApproved} readOnly={isApproved} />
                </div>
              </CardContent>
            </Card>
          </CardContent>
        </Card>}

      {/* Detailed Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-success flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Pago Móvil Recibidos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold text-success">
              {formatCurrency(cuadre.pagoMovilRecibidos, 'VES')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-destructive flex items-center gap-2">
              <TrendingDown className="h-4 w-4" />
              Pago Móvil Pagados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold text-destructive">
              {formatCurrency(cuadre.pagoMovilPagados, 'VES')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-primary">
              Punto de Venta
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold text-primary">
              {formatCurrency(cuadre.totalPointOfSale, 'VES')}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Closure Formula Card */}
      <Card className="border-2 border-primary/20 border-l-4 border-l-primary">
        <CardHeader>
          <CardTitle className="text-primary">Resumen en Bolívares</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
              <div className="space-y-4">
                <h4 className="font-semibold text-sm h-5 flex items-center">Sumatoria:</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Efectivo del día:</span>
                    <span className="font-medium">{formatCurrency(cuadre.cashAvailable, 'VES')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total en banco:</span>
                    <span className="font-medium">{formatCurrency(totalBanco, 'VES')}</span>
                  </div>
                  <Collapsible open={deudasOpen} onOpenChange={setDeudasOpen}>
                    <CollapsibleTrigger asChild>
                      <div className="flex justify-between items-center cursor-pointer hover:bg-muted/50 rounded px-2 py-1 transition-colors">
                        <span className="flex items-center gap-1">
                          {deudasOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                          Deudas:
                        </span>
                        <span className="font-medium">{formatCurrency(cuadre.totalDeudas.bs, 'VES')}</span>
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="ml-4 mt-2 space-y-1 text-xs">
                        {cuadre.deudasDetails.length > 0 ? cuadre.deudasDetails.map((deuda, index) => <div key={index} className="flex justify-between items-center py-1 px-2 bg-muted/30 rounded">
                              <div className="flex-1">
                                <span className="text-muted-foreground">{deuda.description}</span>
                                <div className="text-xs text-muted-foreground">
                                  {format(new Date(deuda.created_at), 'dd/MM/yyyy')}
                                </div>
                              </div>
                              <div className="text-right">
                                <div>{formatCurrency(deuda.amount_bs, 'VES')}</div>
                                {deuda.amount_usd > 0 && <div className="text-xs text-muted-foreground">{formatCurrency(deuda.amount_usd, 'USD')}</div>}
                              </div>
                            </div>) : <div className="text-muted-foreground text-center py-2">No hay deudas registradas</div>}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                  <Collapsible open={gastosOpen} onOpenChange={setGastosOpen}>
                    <CollapsibleTrigger asChild>
                      <div className="flex justify-between items-center cursor-pointer hover:bg-muted/50 rounded px-2 py-1 transition-colors">
                        <span className="flex items-center gap-1">
                          {gastosOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                          Gastos:
                        </span>
                        <span className="font-medium">{formatCurrency(cuadre.totalGastos.bs, 'VES')}</span>
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="ml-4 mt-2 space-y-1 text-xs">
                        {cuadre.gastosDetails.length > 0 ? cuadre.gastosDetails.map((gasto, index) => <div key={index} className="flex justify-between items-center py-1 px-2 bg-muted/30 rounded">
                              <div className="flex-1">
                                <span className="text-muted-foreground">{gasto.description}</span>
                                <div className="text-xs text-muted-foreground">
                                  {format(new Date(gasto.created_at), 'dd/MM/yyyy')}
                                </div>
                              </div>
                              <div className="text-right">
                                <div>{formatCurrency(gasto.amount_bs, 'VES')}</div>
                                {gasto.amount_usd > 0 && <div className="text-xs text-muted-foreground">{formatCurrency(gasto.amount_usd, 'USD')}</div>}
                              </div>
                            </div>) : <div className="text-muted-foreground text-center py-2">No hay gastos registrados</div>}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                  {applyExcessUsdSwitch && <div className="flex justify-between">
                      <span>Excedente USD → Bs (x{cuadre.exchangeRate.toFixed(2)}):</span>
                      <span className="font-medium">{formatCurrency(excessUsd * cuadre.exchangeRate, 'VES')}</span>
                    </div>}
                  {inputAdditionalAmountBs > 0 && <div className="flex justify-between">
                      <span>Monto adicional Bs:</span>
                      <span className="font-medium">{formatCurrency(inputAdditionalAmountBs, 'VES')}</span>
                    </div>}
                  <Separator />
                  <div className="flex justify-between font-bold">
                    <span>Total Sumatoria:</span>
                    <span>{formatCurrency(sumatoriaBolivares, 'VES')}</span>
                  </div>
                </div>
              </div>
              
              <div className="space-y-4">
                <h4 className="font-semibold text-sm h-5 flex items-center">Comparación:</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Sumatoria:</span>
                    <span className="font-medium">{formatCurrency(sumatoriaBolivares, 'VES')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Cuadre (V-P):</span>
                    <span className="font-medium">{formatCurrency(cuadreVentasPremios.bs, 'VES')}</span>
                  </div>
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Diferencia inicial:</span>
                    <span className="font-medium">{formatCurrency(diferenciaCierre, 'VES')}</span>
                  </div>
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Menos: Premios por pagar:</span>
                    <span className="font-medium">-{formatCurrency(cuadre.premiosPorPagar, 'VES')}</span>
                  </div>
                  <Separator className="my-3" />
                  <div className="flex justify-between font-bold text-xl mb-4">
                    <span>Diferencia Final:</span>
                    <span className={`${isCuadreBalanced ? 'text-success' : 'text-destructive'}`}>
                      {formatCurrency(diferenciaFinal, 'VES')}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 justify-center mt-4">
                    {isCuadreBalanced ? <Badge variant="default" className="flex items-center gap-2 px-4 py-2 text-base">
                        <CheckCircle2 className="h-4 w-4" />
                        ¡Cuadre Perfecto!
                      </Badge> : <Badge variant="destructive" className="flex items-center gap-2 px-4 py-2 text-base">
                        <XCircle className="h-4 w-4" />
                        Diferencia encontrada
                      </Badge>}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* USD Closure Formula Card */}
      <Card className="border-2 border-accent/20 border-l-4 border-l-accent">
        <CardHeader>
          <CardTitle className="text-accent">Resumen en Dólares (USD)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
              <div className="space-y-4">
                <h4 className="font-semibold text-sm h-5 flex items-center">Sumatoria USD:</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Efectivo en dólares:</span>
                    <span className="font-medium">{formatCurrency(cuadre.cashAvailableUsd, 'USD')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Gastos en USD:</span>
                    <span className="font-medium">{formatCurrency(cuadre.totalGastos.usd, 'USD')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Deudas en USD:</span>
                    <span className="font-medium">{formatCurrency(cuadre.totalDeudas.usd, 'USD')}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between font-bold">
                    <span>Total Sumatoria USD:</span>
                    <span>{formatCurrency(cuadre.cashAvailableUsd + cuadre.totalGastos.usd + cuadre.totalDeudas.usd, 'USD')}</span>
                  </div>
                </div>
              </div>
              
              <div className="space-y-4">
                <h4 className="font-semibold text-sm h-5 flex items-center">Comparación USD:</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Sumatoria USD:</span>
                    <span className="font-medium">{formatCurrency(cuadre.cashAvailableUsd + cuadre.totalGastos.usd + cuadre.totalDeudas.usd, 'USD')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Cuadre USD (V-P):</span>
                    <span className="font-medium">{formatCurrency(cuadreVentasPremios.usd, 'USD')}</span>
                  </div>
                  <Separator className="my-3" />
                  <div className="flex justify-between font-bold text-xl mb-4">
                    <span>Diferencia USD:</span>
                    <span className={cuadre.cashAvailableUsd + cuadre.totalGastos.usd + cuadre.totalDeudas.usd - cuadreVentasPremios.usd === 0 ? 'text-success' : 'text-accent'}>
                      {formatCurrency(cuadre.cashAvailableUsd + cuadre.totalGastos.usd + cuadre.totalDeudas.usd - cuadreVentasPremios.usd, 'USD')}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 justify-center mt-4">
                    {cuadre.cashAvailableUsd + cuadre.totalGastos.usd + cuadre.totalDeudas.usd - cuadreVentasPremios.usd === 0 ? <Badge variant="default" className="flex items-center gap-2 px-4 py-2 text-base">
                        <CheckCircle2 className="h-4 w-4" />
                        ¡Cuadre Perfecto!
                      </Badge> : <Badge variant="secondary" className="flex items-center gap-2 px-5 py-3 text-lg font-semibold">
                        💰 Excedente USD → Bs
                      </Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground text-center mt-3">
                    El excedente en USD se convierte a bolívares según la tasa del día.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Confirmation Section - Only for single day */}
      {isSingleDay && <Card className="border-2 border-accent/20">
          <CardContent className="space-y-4 pt-6">
            <div className="flex items-center justify-center">
              <div className="flex items-center space-x-2">
                <Switch id="closure-confirmed" checked={cuadre.closureConfirmed} onCheckedChange={checked => setCuadre(prev => ({
              ...prev,
              closureConfirmed: checked
            }))} />
                <Label htmlFor="closure-confirmed">
                  ¿Confirmas que el cuadre está correcto?
                </Label>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="closure-notes">Notas del cierre (opcional)</Label>
              <Textarea id="closure-notes" placeholder="Agregar observaciones sobre el cierre del día..." value={cuadre.closureNotes} onChange={e => setCuadre(prev => ({
            ...prev,
            closureNotes: e.target.value
          }))} rows={3} disabled={isApproved} readOnly={isApproved} />
            </div>
            
            <Button onClick={saveDailyClosure} disabled={saving || isApproved} className="w-full" size="lg">
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Guardando...' : isApproved ? 'Cuadre Aprobado - No se puede modificar' : 'Guardar Cierre Diario'}
            </Button>
          </CardContent>
        </Card>}
    </div>;
};