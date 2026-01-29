import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency } from "@/lib/utils";
import { format, startOfWeek } from "date-fns";
import { es } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { Calculator, CheckCircle2, XCircle, Save, TrendingUp, TrendingDown, ChevronDown, ChevronRight } from "lucide-react";
import { formatDateForDB } from "@/lib/dateUtils";
import { CuadreReviewDialog } from "./CuadreReviewDialog";
interface CuadreGeneralEncargadaProps {
  selectedAgency: string;
  selectedDate: Date;
  refreshKey?: number;
}
interface CuadreData {
  // Sales & Prizes from encargada_cuadre_details
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

  // Pending prizes
  pendingPrizes: number;

  // Daily closure data (editable fields)
  cashAvailable: number;
  cashAvailableUsd: number;
  closureConfirmed: boolean;
  closureNotes: string;

  // Exchange rate
  exchangeRate: number;

  // Additional fields for cuadre
  applyExcessUsd: boolean;
  additionalAmountBs: number;
  additionalAmountUsd: number;
  additionalNotes: string;
}
export const CuadreGeneralEncargada = ({
  selectedAgency,
  selectedDate,
  refreshKey = 0
}: CuadreGeneralEncargadaProps) => {
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
    pendingPrizes: 0,
    cashAvailable: 0,
    cashAvailableUsd: 0,
    closureConfirmed: false,
    closureNotes: "",
    exchangeRate: 36.0,
    applyExcessUsd: true,
    additionalAmountBs: 0,
    additionalAmountUsd: 0,
    additionalNotes: ""
  });

  // Input states for editable fields
  const [exchangeRateInput, setExchangeRateInput] = useState<string>("36.00");
  const [cashAvailableInput, setCashAvailableInput] = useState<string>("0");
  const [cashAvailableUsdInput, setCashAvailableUsdInput] = useState<string>("0");
  const [pendingPrizesInput, setPendingPrizesInput] = useState<string>("0");
  const [pendingPrizesUsdInput, setPendingPrizesUsdInput] = useState<string>("0");
  const [closureNotesInput, setClosureNotesInput] = useState<string>("");
  const [additionalAmountBsInput, setAdditionalAmountBsInput] = useState<string>("0");
  const [additionalAmountUsdInput, setAdditionalAmountUsdInput] = useState<string>("0");
  const [additionalNotesInput, setAdditionalNotesInput] = useState<string>("");
  const [applyExcessUsdSwitch, setApplyExcessUsdSwitch] = useState<boolean>(true);

  // Track if user has manually edited fields
  const [fieldsEditedByUser, setFieldsEditedByUser] = useState({
    exchangeRate: false,
    cashAvailable: false,
    cashAvailableUsd: false
  });

  // State for collapsible dropdowns
  const [gastosOpen, setGastosOpen] = useState(false);
  const [deudasOpen, setDeudasOpen] = useState(false);

  // Review status tracking
  const [reviewStatus, setReviewStatus] = useState<string | null>(null);
  const [reviewedBy, setReviewedBy] = useState<string | null>(null);
  const [reviewedAt, setReviewedAt] = useState<string | null>(null);
  const [reviewObservations, setReviewObservations] = useState<string | null>(null);
  const [agencyName, setAgencyName] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Refs para controlar la carga de datos y evitar sobrescritura
  const hasLoadedFromStorageRef = useRef(false);
  const lastLoadedKeyRef = useRef<string | null>(null);
  const isFetchingRef = useRef(false);
  
  const {
    user
  } = useAuth();
  const {
    toast
  } = useToast();

  // Función para obtener la clave de almacenamiento
  const getStorageKey = useCallback(() => {
    if (!user || !selectedAgency || !selectedDate) return null;
    return `enc:cuadre-general:${user.id}:${selectedAgency}:${formatDateForDB(selectedDate)}`;
  }, [user, selectedAgency, selectedDate]);

  // 1. PRIMERO: Cargar valores persistidos desde localStorage ANTES del fetch
  useEffect(() => {
    const storageKey = getStorageKey();
    if (!storageKey) {
      hasLoadedFromStorageRef.current = false;
      return;
    }

    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          // Aplicar valores guardados
          if (parsed.exchangeRateInput !== undefined) {
            setExchangeRateInput(parsed.exchangeRateInput);
          }
          if (parsed.cashAvailableInput !== undefined) {
            setCashAvailableInput(parsed.cashAvailableInput);
          }
          if (parsed.cashAvailableUsdInput !== undefined) {
            setCashAvailableUsdInput(parsed.cashAvailableUsdInput);
          }
          if (parsed.pendingPrizesInput !== undefined) {
            setPendingPrizesInput(parsed.pendingPrizesInput);
          }
          if (parsed.pendingPrizesUsdInput !== undefined) {
            setPendingPrizesUsdInput(parsed.pendingPrizesUsdInput);
          }
          if (parsed.closureNotesInput !== undefined) {
            setClosureNotesInput(parsed.closureNotesInput);
          }
          if (parsed.additionalAmountBsInput !== undefined) {
            setAdditionalAmountBsInput(parsed.additionalAmountBsInput);
          }
          if (parsed.additionalAmountUsdInput !== undefined) {
            setAdditionalAmountUsdInput(parsed.additionalAmountUsdInput);
          }
          if (parsed.additionalNotesInput !== undefined) {
            setAdditionalNotesInput(parsed.additionalNotesInput);
          }
          if (parsed.applyExcessUsdSwitch !== undefined) {
            setApplyExcessUsdSwitch(parsed.applyExcessUsdSwitch);
          }
          
          // Marcar campos como editados para evitar sobrescritura
          setFieldsEditedByUser({
            exchangeRate: parsed.exchangeRateInput !== undefined,
            cashAvailable: parsed.cashAvailableInput !== undefined,
            cashAvailableUsd: parsed.cashAvailableUsdInput !== undefined,
          });
          
          hasLoadedFromStorageRef.current = true;
        } else {
          hasLoadedFromStorageRef.current = false;
        }
      } else {
        hasLoadedFromStorageRef.current = false;
      }
    } catch (error) {
      console.error('Error loading persisted data:', error);
      hasLoadedFromStorageRef.current = false;
    }
  }, [getStorageKey]);

  // 2. Guardar valores en localStorage cuando cambian
  useEffect(() => {
    const storageKey = getStorageKey();
    if (!storageKey) return;

    const dataToSave = {
      exchangeRateInput,
      cashAvailableInput,
      cashAvailableUsdInput,
      pendingPrizesInput,
      pendingPrizesUsdInput,
      closureNotesInput,
      additionalAmountBsInput,
      additionalAmountUsdInput,
      additionalNotesInput,
      applyExcessUsdSwitch,
      fieldsEditedByUser,
    };

    try {
      localStorage.setItem(storageKey, JSON.stringify(dataToSave));
    } catch (error) {
      console.error('Error saving persisted data:', error);
    }
  }, [getStorageKey, exchangeRateInput, cashAvailableInput, cashAvailableUsdInput, pendingPrizesInput, pendingPrizesUsdInput, closureNotesInput, additionalAmountBsInput, additionalAmountUsdInput, additionalNotesInput, applyExcessUsdSwitch, fieldsEditedByUser]);

  // 3. SEGUNDO: Fetch de datos (respetando lo cargado desde localStorage)
  useEffect(() => {
    const currentKey = `${selectedAgency}:${formatDateForDB(selectedDate)}`;
    const keyChanged = lastLoadedKeyRef.current !== currentKey;
    
    if (keyChanged) {
      // Resetear flags al cambiar de agencia/fecha
      lastLoadedKeyRef.current = currentKey;
      hasLoadedFromStorageRef.current = false;
      setFieldsEditedByUser({
        exchangeRate: false,
        cashAvailable: false,
        cashAvailableUsd: false
      });
    }
    
    if (user && selectedAgency && selectedDate) {
      fetchCuadreData();
    }
  }, [user, selectedAgency, selectedDate, refreshKey]);
  const fetchCuadreData = async () => {
    if (!user || !selectedAgency || !selectedDate) return;
    
    // Evitar múltiples llamadas simultáneas
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    
    // Verificar si hay datos persistidos en localStorage
    const storageKey = getStorageKey();
    const shouldPreserveInputs = hasLoadedFromStorageRef.current;
    
    try {
      setLoading(true);
      const dateStr = formatDateForDB(selectedDate);

      // 1. PRIORIDAD 1: FUENTE PRINCIPAL - encargada_cuadre_details (datos ya modificados)
      const {
        data: detailsData,
        error: detailsError
      } = await supabase.from("encargada_cuadre_details").select("sales_bs, sales_usd, prizes_bs, prizes_usd").eq("agency_id", selectedAgency).eq("session_date", dateStr).eq("user_id", user.id); // Datos de esta encargada

      if (detailsError) throw detailsError;
      let totalSales = {
        bs: 0,
        usd: 0
      };
      let totalPrizes = {
        bs: 0,
        usd: 0
      };

      // Si hay datos de encargada, usarlos
      if (detailsData && detailsData.length > 0) {
        totalSales = {
          bs: detailsData.reduce((sum, d) => sum + Number(d.sales_bs || 0), 0),
          usd: detailsData.reduce((sum, d) => sum + Number(d.sales_usd || 0), 0)
        };
        totalPrizes = {
          bs: detailsData.reduce((sum, d) => sum + Number(d.prizes_bs || 0), 0),
          usd: detailsData.reduce((sum, d) => sum + Number(d.prizes_usd || 0), 0)
        };
      } else {
        // PRIORIDAD 2: Si no hay datos de encargada, buscar de taquilleras
        // Encontrar taquilleras de esta agencia
        const {
          data: taquilleras
        } = await supabase.from("profiles").select("user_id").eq("agency_id", selectedAgency).eq("role", "taquillero").eq("is_active", true);
        if (taquilleras && taquilleras.length > 0) {
          const taquilleraIds = taquilleras.map(t => t.user_id);

          // Buscar sesiones de esas taquilleras
          const {
            data: sessions
          } = await supabase.from("daily_sessions").select("id").eq("session_date", dateStr).in("user_id", taquilleraIds);
          if (sessions && sessions.length > 0) {
            const sessionIds = sessions.map(s => s.id);

            // Obtener transacciones consolidadas
            const [salesResult, prizesResult] = await Promise.all([supabase.from("sales_transactions").select("amount_bs, amount_usd").in("session_id", sessionIds), supabase.from("prize_transactions").select("amount_bs, amount_usd").in("session_id", sessionIds)]);
            if (salesResult.data) {
              totalSales = {
                bs: salesResult.data.reduce((sum, s) => sum + Number(s.amount_bs || 0), 0),
                usd: salesResult.data.reduce((sum, s) => sum + Number(s.amount_usd || 0), 0)
              };
            }
            if (prizesResult.data) {
              totalPrizes = {
                bs: prizesResult.data.reduce((sum, p) => sum + Number(p.amount_bs || 0), 0),
                usd: prizesResult.data.reduce((sum, p) => sum + Number(p.amount_usd || 0), 0)
              };
            }
          }
        }
      }

      // 2. OBTENER SESIONES DE TAQUILLERAS PARA BUSCAR DATOS ADICIONALES (gastos, pagos móviles, punto de venta)
      // Siempre buscar sesiones de taquilleras para obtener todos los datos que hayan registrado
      let taquilleraSessionIds: string[] = [];
      const {
        data: taquilleras
      } = await supabase.from("profiles").select("user_id").eq("agency_id", selectedAgency).eq("role", "taquillero").eq("is_active", true);
      if (taquilleras && taquilleras.length > 0) {
        const taquilleraIds = taquilleras.map(t => t.user_id);
        const {
          data: sessions
        } = await supabase.from("daily_sessions").select("id").eq("session_date", dateStr).in("user_id", taquilleraIds);
        if (sessions && sessions.length > 0) {
          taquilleraSessionIds = sessions.map(s => s.id);
        }
      }

      // 3. DATOS COMPLEMENTARIOS - Buscar tanto por agency_id como por session_id
      const expensesQueries = [supabase.from("expenses").select("amount_bs, amount_usd, category, description, created_at").eq("agency_id", selectedAgency).eq("transaction_date", dateStr)];
      const mobileQueries = [supabase.from("mobile_payments").select("amount_bs, reference_number, description").eq("agency_id", selectedAgency).eq("transaction_date", dateStr)];
      const posQueries = [supabase.from("point_of_sale").select("amount_bs").eq("agency_id", selectedAgency).eq("transaction_date", dateStr)];

      // Si hay sesiones de taquilleras, también buscar por session_id
      if (taquilleraSessionIds.length > 0) {
        expensesQueries.push(supabase.from("expenses").select("amount_bs, amount_usd, category, description, created_at").in("session_id", taquilleraSessionIds));
        mobileQueries.push(supabase.from("mobile_payments").select("amount_bs, reference_number, description").in("session_id", taquilleraSessionIds));
        posQueries.push(supabase.from("point_of_sale").select("amount_bs").in("session_id", taquilleraSessionIds));
      }

      // Ejecutar todas las consultas
      const [expensesResults, mobileResults, posResults, summaryResult, agencyResult] = await Promise.all([Promise.all(expensesQueries), Promise.all(mobileQueries), Promise.all(posQueries),
      // Buscar resumen: primero por agency_id (encargada), luego por session_id (taquilleras)
      (async () => {
        // Prioridad 1: Resumen de encargada (session_id = null)
        const {
          data: encargadaSummary
        } = await supabase.from("daily_cuadres_summary").select("cash_available_bs, cash_available_usd, exchange_rate, closure_notes, daily_closure_confirmed, notes, pending_prizes, excess_usd, diferencia_final, encargada_status, encargada_observations, encargada_reviewed_at, encargada_reviewed_by").eq("agency_id", selectedAgency).eq("session_date", dateStr).is("session_id", null).maybeSingle();

        // Si no hay resumen de encargada y hay sesiones de taquilleras, buscar resumen de taquilleras
        if (!encargadaSummary && taquilleraSessionIds.length > 0) {
          const {
            data: taquilleraSummaries
          } = await supabase.from("daily_cuadres_summary").select("cash_available_bs, cash_available_usd, exchange_rate, closure_notes, daily_closure_confirmed, notes, pending_prizes, excess_usd, diferencia_final, encargada_status, encargada_observations, encargada_reviewed_at, encargada_reviewed_by").in("session_id", taquilleraSessionIds).eq("session_date", dateStr).order("created_at", {
            ascending: false
          }).limit(1);
          if (taquilleraSummaries && taquilleraSummaries.length > 0) {
            return {
              data: taquilleraSummaries[0],
              error: null
            };
          }
        }
        return {
          data: encargadaSummary,
          error: null
        };
      })(), supabase.from("agencies").select("name").eq("id", selectedAgency).single()]);

      // Consolidar resultados de gastos (puede haber duplicados, usar Set para evitar)
      const allExpenses: any[] = [];
      expensesResults.forEach(result => {
        if (result.error) throw result.error;
        if (result.data) {
          allExpenses.push(...result.data);
        }
      });
      // Eliminar duplicados por id si existe, o por combinación única
      const uniqueExpenses = Array.from(new Map(allExpenses.map(item => [item.id || `${item.description}_${item.amount_bs}_${item.created_at}`, item])).values());

      // Consolidar resultados de pagos móviles
      const allMobilePayments: any[] = [];
      mobileResults.forEach(result => {
        if (result.error) throw result.error;
        if (result.data) {
          allMobilePayments.push(...result.data);
        }
      });
      // Asegurar que todos tengan agency_id (los de taquilleras pueden no tenerlo)
      const uniqueMobilePayments = Array.from(new Map(allMobilePayments.map(item => [item.id || `${item.reference_number}_${item.amount_bs}_${item.created_at}`, item])).values()).map(payment => {
        if (!payment.agency_id) {
          return {
            ...payment,
            agency_id: selectedAgency
          };
        }
        return payment;
      });

      // Consolidar resultados de punto de venta
      const allPos: any[] = [];
      posResults.forEach(result => {
        if (result.error) throw result.error;
        if (result.data) {
          allPos.push(...result.data);
        }
      });
      // Asegurar que todos tengan agency_id (los de taquilleras pueden no tenerlo)
      const uniquePos = Array.from(new Map(allPos.map(item => [item.id || `${item.amount_bs}_${item.created_at}`, item])).values()).map(pos => {
        if (!pos.agency_id) {
          return {
            ...pos,
            agency_id: selectedAgency
          };
        }
        return pos;
      });
      if (agencyResult.error) throw agencyResult.error;

      // Set agency name and review status
      setAgencyName(agencyResult.data?.name || "");
      setReviewStatus(summaryResult.data?.encargada_status || "pendiente");
      setReviewObservations(summaryResult.data?.encargada_observations || null);
      setReviewedAt(summaryResult.data?.encargada_reviewed_at || null);
      setReviewedBy(summaryResult.data?.encargada_reviewed_by || null);

      // 4. PROCESAR GASTOS Y DEUDAS
      const expensesList = uniqueExpenses;
      const gastosList = expensesList.filter(e => e.category === "gasto_operativo");
      const deudasList = expensesList.filter(e => e.category === "deuda");
      const totalGastos = {
        bs: gastosList.reduce((sum, g) => sum + Number(g.amount_bs || 0), 0),
        usd: gastosList.reduce((sum, g) => sum + Number(g.amount_usd || 0), 0)
      };
      const totalDeudas = {
        bs: deudasList.reduce((sum, d) => sum + Number(d.amount_bs || 0), 0),
        usd: deudasList.reduce((sum, d) => sum + Number(d.amount_usd || 0), 0)
      };

      // 5. PROCESAR PAGOS MÓVILES
      const mobileList = uniqueMobilePayments;
      const pagoMovilRecibidos = mobileList.filter(m => Number(m.amount_bs || 0) > 0).reduce((sum, m) => sum + Number(m.amount_bs), 0);
      const pagoMovilPagados = Math.abs(mobileList.filter(m => Number(m.amount_bs || 0) < 0).reduce((sum, m) => sum + Number(m.amount_bs), 0));

      // 6. PROCESAR PUNTO DE VENTA
      const totalPointOfSale = uniquePos.reduce((sum, p) => sum + Number(p.amount_bs || 0), 0);

      // 7. CAMPOS EDITABLES DEL RESUMEN
      const summaryData = summaryResult.data;
      const exchangeRate = summaryData?.exchange_rate || 36.0;
      const cashAvailable = summaryData?.cash_available_bs || 0;
      const cashAvailableUsd = summaryData?.cash_available_usd || 0;
      const closureNotes = summaryData?.closure_notes || "";
      const closureConfirmed = summaryData?.daily_closure_confirmed || false;
      const pendingPrizesFromSummary = Number(summaryData?.pending_prizes || 0);
      setPendingPrizesInput(pendingPrizesFromSummary.toString());

      // Parse notes field for additional data
      let additionalAmountBs = 0;
      let additionalAmountUsd = 0;
      let additionalNotes = "";
      let applyExcessUsd = true;
      if (summaryData?.notes) {
        try {
          const notesData = JSON.parse(summaryData.notes);
          additionalAmountBs = Number(notesData.additionalAmountBs || 0);
          additionalAmountUsd = Number(notesData.additionalAmountUsd || 0);
          additionalNotes = notesData.additionalNotes || "";
          applyExcessUsd = notesData.applyExcessUsd !== undefined ? notesData.applyExcessUsd : true;
        } catch {
          // If notes is not JSON, treat as legacy text
          additionalNotes = summaryData.notes;
        }
      }

      // 8. ACTUALIZAR ESTADO
      setCuadre({
        totalSales,
        totalPrizes,
        totalGastos,
        totalDeudas,
        gastosDetails: gastosList as any,
        deudasDetails: deudasList as any,
        pagoMovilRecibidos,
        pagoMovilPagados,
        totalPointOfSale,
        pendingPrizes: pendingPrizesFromSummary,
        cashAvailable,
        cashAvailableUsd,
        exchangeRate,
        closureConfirmed,
        closureNotes,
        applyExcessUsd,
        additionalAmountBs,
        additionalAmountUsd,
        additionalNotes
      });

      // Update input fields only if user hasn't edited them AND not preserving from localStorage
      if (!shouldPreserveInputs) {
        if (!fieldsEditedByUser.exchangeRate) {
          setExchangeRateInput(exchangeRate.toString());
        }
        if (!fieldsEditedByUser.cashAvailable) {
          setCashAvailableInput(cashAvailable.toString());
        }
        if (!fieldsEditedByUser.cashAvailableUsd) {
          setCashAvailableUsdInput(cashAvailableUsd.toString());
        }
        setPendingPrizesInput(pendingPrizesFromSummary.toString());
        setClosureNotesInput(closureNotes);
        setAdditionalAmountBsInput(additionalAmountBs.toString());
        setAdditionalAmountUsdInput(additionalAmountUsd.toString());
        setAdditionalNotesInput(additionalNotes);
        setApplyExcessUsdSwitch(applyExcessUsd);
      }
      // Si hay datos persistidos, mantener los valores de localStorage (ya se cargaron antes)
    } catch (error: any) {
      console.error("❌ Error en CuadreGeneralEncargada:", error);
      toast({
        title: "Error",
        description: error.message || "Error al cargar el cuadre",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  };
  const saveDailyClosure = async () => {
    if (!user || !selectedAgency || !selectedDate) {
      toast({
        title: "Error",
        description: "Usuario, agencia o fecha no válidos",
        variant: "destructive"
      });
      return;
    }
    try {
      setSaving(true);
      const dateStr = formatDateForDB(selectedDate);
      const inputExchangeRate = parseFloat(exchangeRateInput) || 36.0;
      const inputCashAvailableBs = parseFloat(cashAvailableInput) || 0;
      const inputCashAvailableUsd = parseFloat(cashAvailableUsdInput) || 0;
      const inputAdditionalAmountBs = parseFloat(additionalAmountBsInput) || 0;
      const inputAdditionalAmountUsd = parseFloat(additionalAmountUsdInput) || 0;

      // Calculate balance
      const balance_bs = cuadre.totalSales.bs - cuadre.totalPrizes.bs - cuadre.totalGastos.bs - cuadre.totalDeudas.bs + cuadre.pagoMovilRecibidos - cuadre.pagoMovilPagados + cuadre.totalPointOfSale;

      // Calculate total en banco
      const totalBancoBs = cuadre.pagoMovilRecibidos + cuadre.totalPointOfSale - cuadre.pagoMovilPagados;

      // Store additional data in notes field as JSON
      const notesData = {
        additionalAmountBs: inputAdditionalAmountBs,
        additionalAmountUsd: inputAdditionalAmountUsd,
        additionalNotes: additionalNotesInput,
        applyExcessUsd: applyExcessUsdSwitch
      };

      // Calculate cierre values similar to UI
      const cuadreVentasPremiosBs = cuadre.totalSales.bs - cuadre.totalPrizes.bs;
      const cuadreVentasPremiosUsd = cuadre.totalSales.usd - cuadre.totalPrizes.usd;
      const inputPendingPrizes = parseFloat(pendingPrizesInput) || 0;
      const excessUsd = Math.abs(cuadreVentasPremiosUsd - inputCashAvailableUsd) - inputAdditionalAmountUsd;
      const sumatoriaBolivares = inputCashAvailableBs + totalBancoBs + cuadre.totalDeudas.bs + cuadre.totalGastos.bs + (applyExcessUsdSwitch ? excessUsd * inputExchangeRate : 0) - inputAdditionalAmountBs;
      const diferenciaCierre = sumatoriaBolivares - cuadreVentasPremiosBs;
      const diferenciaFinal = diferenciaCierre - inputPendingPrizes;
      const summaryData = {
        user_id: user.id,
        agency_id: selectedAgency,
        session_date: dateStr,
        session_id: null,
        // Indica que es nivel agencia (encargada)
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
        total_banco_bs: totalBancoBs,
        pending_prizes: inputPendingPrizes,
        balance_before_pending_prizes_bs: diferenciaCierre,
        diferencia_final: diferenciaFinal,
        balance_bs: diferenciaFinal,
        // mantener compatibilidad
        excess_usd: excessUsd,
        // Guardar excedente USD
        exchange_rate: inputExchangeRate,
        cash_available_bs: inputCashAvailableBs,
        cash_available_usd: inputCashAvailableUsd,
        closure_notes: closureNotesInput,
        notes: JSON.stringify(notesData),
        daily_closure_confirmed: true,
        is_closed: true,
        // Auto-aprobar al guardar
        encargada_status: "aprobado",
        encargada_reviewed_by: user.id,
        encargada_reviewed_at: new Date().toISOString()
      };

      // Deterministic merge to avoid ON CONFLICT affecting row twice
      const {
        data: existingSummary,
        error: findSummaryError
      } = await supabase.from("daily_cuadres_summary").select("id").eq("user_id", user.id).eq("agency_id", selectedAgency).eq("session_date", dateStr).is("session_id", null).maybeSingle();
      if (findSummaryError) throw findSummaryError;
      let error = null as any;
      if (existingSummary?.id) {
        const {
          error: updateErr
        } = await supabase.from("daily_cuadres_summary").update(summaryData).eq("id", existingSummary.id);
        error = updateErr || null;
      } else {
        const {
          error: insertErr
        } = await supabase.from("daily_cuadres_summary").insert(summaryData);
        error = insertErr || null;
      }
      if (error) throw error;

      // Guardar datos en encargada_cuadre_details para que aparezcan en Resumen por Sistemas
      // Obtener transacciones de ventas y premios por sistema para consolidar
      const {
        data: taquillerasForDetails
      } = await supabase.from("profiles").select("user_id").eq("agency_id", selectedAgency).eq("role", "taquillero").eq("is_active", true);
      const taquilleraIdsForDetails = taquillerasForDetails?.map(t => t.user_id) || [];
      let sessionIdsForDetails: string[] = [];
      if (taquilleraIdsForDetails.length > 0) {
        const {
          data: sessionsForDetails
        } = await supabase.from("daily_sessions").select("id").eq("session_date", dateStr).in("user_id", taquilleraIdsForDetails);
        sessionIdsForDetails = sessionsForDetails?.map(s => s.id) || [];
      }

      // Obtener todas las transacciones de ventas y premios por sistema
      const [salesResult, prizesResult] = await Promise.all([sessionIdsForDetails.length > 0 ? supabase.from("sales_transactions").select("lottery_system_id, amount_bs, amount_usd").in("session_id", sessionIdsForDetails) : Promise.resolve({
        data: [],
        error: null
      }), sessionIdsForDetails.length > 0 ? supabase.from("prize_transactions").select("lottery_system_id, amount_bs, amount_usd").in("session_id", sessionIdsForDetails) : Promise.resolve({
        data: [],
        error: null
      })]);

      // Obtener sistemas de lotería activos
      const {
        data: allSystems
      } = await supabase.from("lottery_systems").select("id, name, parent_system_id").eq("is_active", true);

      // Consolidar datos por sistema (agrupando subcategorías con padre)
      const systemDataMap = new Map<string, {
        sales_bs: number;
        sales_usd: number;
        prizes_bs: number;
        prizes_usd: number;
      }>();

      // Procesar ventas
      salesResult.data?.forEach(sale => {
        if (!sale.lottery_system_id) return;
        const system = allSystems?.find(s => s.id === sale.lottery_system_id);
        const systemKey = system?.parent_system_id || sale.lottery_system_id;
        const existing = systemDataMap.get(systemKey) || {
          sales_bs: 0,
          sales_usd: 0,
          prizes_bs: 0,
          prizes_usd: 0
        };
        existing.sales_bs += Number(sale.amount_bs || 0);
        existing.sales_usd += Number(sale.amount_usd || 0);
        systemDataMap.set(systemKey, existing);
      });

      // Procesar premios
      prizesResult.data?.forEach(prize => {
        if (!prize.lottery_system_id) return;
        const system = allSystems?.find(s => s.id === prize.lottery_system_id);
        const systemKey = system?.parent_system_id || prize.lottery_system_id;
        const existing = systemDataMap.get(systemKey) || {
          sales_bs: 0,
          sales_usd: 0,
          prizes_bs: 0,
          prizes_usd: 0
        };
        existing.prizes_bs += Number(prize.amount_bs || 0);
        existing.prizes_usd += Number(prize.amount_usd || 0);
        systemDataMap.set(systemKey, existing);
      });

      // Si hay datos de encargada_cuadre_details existentes, usarlos (tienen prioridad)
      const {
        data: existingDetails
      } = await supabase.from("encargada_cuadre_details").select("lottery_system_id, sales_bs, sales_usd, prizes_bs, prizes_usd").eq("agency_id", selectedAgency).eq("session_date", dateStr).eq("user_id", user.id);

      // Combinar datos: si hay datos modificados por encargada, usarlos; si no, usar consolidados
      const detailsToSave = Array.from(systemDataMap.entries()).map(([systemId, data]) => {
        const existingDetail = existingDetails?.find(d => d.lottery_system_id === systemId);
        return {
          user_id: user.id,
          agency_id: selectedAgency,
          session_date: dateStr,
          lottery_system_id: systemId,
          sales_bs: existingDetail ? Number(existingDetail.sales_bs || 0) : data.sales_bs,
          sales_usd: existingDetail ? Number(existingDetail.sales_usd || 0) : data.sales_usd,
          prizes_bs: existingDetail ? Number(existingDetail.prizes_bs || 0) : data.prizes_bs,
          prizes_usd: existingDetail ? Number(existingDetail.prizes_usd || 0) : data.prizes_usd
        };
      });

      // Eliminar detalles existentes y guardar nuevos
      if (detailsToSave.length > 0) {
        await supabase.from("encargada_cuadre_details").delete().eq("agency_id", selectedAgency).eq("session_date", dateStr).eq("user_id", user.id);
        const {
          error: detailsError
        } = await supabase.from("encargada_cuadre_details").insert(detailsToSave);
        if (detailsError) {
          console.error("Error guardando encargada_cuadre_details:", detailsError);
          // No lanzar error, solo loguear, ya que el cuadre principal ya se guardó
        }
      }

      // Obtener todas las sesiones de taquilleras de esta agencia para esta fecha
      const {
        data: taquilleras
      } = await supabase.from("profiles").select("user_id").eq("agency_id", selectedAgency).eq("role", "taquillero").eq("is_active", true);
      const taquilleraIds = taquilleras?.map(t => t.user_id) || [];
      let sessionIds: string[] = [];
      if (taquilleraIds.length > 0) {
        const {
          data: sessions
        } = await supabase.from("daily_sessions").select("id").eq("session_date", dateStr).in("user_id", taquilleraIds);
        sessionIds = sessions?.map(s => s.id) || [];
      }

      // Actualizar TODOS los cuadres: tanto el de encargada (session_id = null) como los de taquilleras
      const approvalUpdates = [
      // Cuadre de encargada (ya está actualizado arriba, pero por si acaso)
      supabase.from("daily_cuadres_summary").update({
        encargada_status: "aprobado",
        encargada_observations: null,
        encargada_reviewed_by: user.id,
        encargada_reviewed_at: new Date().toISOString()
      }).eq("session_date", dateStr).eq("agency_id", selectedAgency).is("session_id", null)];

      // Cuadres de taquilleras - marcar como aprobado
      if (sessionIds.length > 0) {
        approvalUpdates.push(supabase.from("daily_cuadres_summary").update({
          encargada_status: "aprobado",
          encargada_observations: null,
          encargada_reviewed_by: user.id,
          encargada_reviewed_at: new Date().toISOString()
        }).eq("session_date", dateStr).eq("agency_id", selectedAgency).in("session_id", sessionIds));
      }
      const approvalResults = await Promise.all(approvalUpdates);
      const approvalErrors = approvalResults.filter(r => r.error);
      if (approvalErrors.length > 0) {
        console.error("Error actualizando estado de aprobación:", approvalErrors[0].error);
        // No lanzar error aquí, solo loguear, ya que el cuadre principal ya se guardó
      }

      // Actualizar estado de revisión inmediatamente
      setReviewStatus("aprobado");
      setReviewObservations(null);
      setReviewedAt(new Date().toISOString());
      setReviewedBy(user.id);

      // Reset edit flags so inputs update with saved values
      setFieldsEditedByUser({
        exchangeRate: false,
        cashAvailable: false,
        cashAvailableUsd: false
      });
      
      // Limpiar localStorage después de guardar exitosamente
      const storageKey = getStorageKey();
      if (storageKey) {
        try {
          localStorage.removeItem(storageKey);
          hasLoadedFromStorageRef.current = false;
        } catch (e) {
          // Ignorar errores de limpieza
        }
      }
      
      toast({
        title: "Éxito",
        description: `Cierre diario guardado y aprobado correctamente${sessionIds.length > 0 ? `. Se aprobaron ${sessionIds.length} cuadre(s) de taquillera(s)` : ''}`
      });

      // Disparar evento para actualizar BankBalanceWeekly
      const sessionDate = new Date(dateStr + 'T00:00:00');
      const weekStart = startOfWeek(sessionDate, {
        weekStartsOn: 1
      }); // Lunes de la semana
      const weekStartStr = format(weekStart, 'yyyy-MM-dd');
      window.dispatchEvent(new CustomEvent('cuadre-saved', {
        detail: {
          agency_id: selectedAgency,
          session_date: dateStr,
          week_start_date: weekStartStr
        }
      }));

      // Reload data
      await fetchCuadreData();
    } catch (error: any) {
      console.error("Error saving closure:", error);
      toast({
        title: "Error",
        description: error.message || "Error al guardar el cierre",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };
  const handleRejectCuadre = async (observations: string) => {
    if (!user || !selectedAgency || !selectedDate) return;
    try {
      const dateStr = formatDateForDB(selectedDate);

      // Obtener todas las sesiones de taquilleras de esta agencia para esta fecha
      const {
        data: taquilleras
      } = await supabase.from("profiles").select("user_id").eq("agency_id", selectedAgency).eq("role", "taquillero").eq("is_active", true);
      const taquilleraIds = taquilleras?.map(t => t.user_id) || [];
      let sessionIds: string[] = [];
      if (taquilleraIds.length > 0) {
        const {
          data: sessions
        } = await supabase.from("daily_sessions").select("id").eq("session_date", dateStr).in("user_id", taquilleraIds);
        sessionIds = sessions?.map(s => s.id) || [];
      }

      // Actualizar TODOS los cuadres: tanto el de encargada (session_id = null) como los de taquilleras
      const updates = [
      // Cuadre de encargada
      supabase.from("daily_cuadres_summary").update({
        encargada_status: "rechazado",
        encargada_observations: observations,
        encargada_reviewed_by: user.id,
        encargada_reviewed_at: new Date().toISOString()
      }).eq("session_date", dateStr).eq("agency_id", selectedAgency).is("session_id", null)];

      // Cuadres de taquilleras
      if (sessionIds.length > 0) {
        updates.push(supabase.from("daily_cuadres_summary").update({
          encargada_status: "rechazado",
          encargada_observations: observations,
          encargada_reviewed_by: user.id,
          encargada_reviewed_at: new Date().toISOString()
        }).eq("session_date", dateStr).eq("agency_id", selectedAgency).in("session_id", sessionIds));
      }
      const results = await Promise.all(updates);
      const errors = results.filter(r => r.error);
      if (errors.length > 0) {
        throw errors[0].error;
      }
      setReviewStatus("rechazado");
      setReviewObservations(observations);
      setReviewedAt(new Date().toISOString());
      setReviewedBy(user.id);
      toast({
        title: "❌ Cuadre Rechazado",
        description: `El cuadre ha sido rechazado${sessionIds.length > 0 ? ` y se notificó a ${sessionIds.length} taquillera(s)` : ''}`,
        variant: "destructive"
      });
    } catch (error: any) {
      console.error("Error rejecting cuadre:", error);
      toast({
        title: "Error",
        description: error.message || "Error al rechazar el cuadre",
        variant: "destructive"
      });
    }
  };
  if (loading) {
    return <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <Calculator className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p>Calculando resumen general...</p>
        </div>
      </div>;
  }

  // Check if there's any data
  const hasData = cuadre.totalSales.bs > 0 || cuadre.totalSales.usd > 0 || cuadre.totalPrizes.bs > 0 || cuadre.totalPrizes.usd > 0 || cuadre.totalGastos.bs > 0 || cuadre.totalGastos.usd > 0 || cuadre.pagoMovilRecibidos > 0 || cuadre.pagoMovilPagados > 0 || cuadre.totalPointOfSale > 0;
  if (!hasData) {
    return <Card className="border-2 border-dashed">
        <CardContent className="pt-8 pb-8">
          <div className="text-center text-muted-foreground space-y-2">
            <Calculator className="h-12 w-12 mx-auto opacity-50" />
            <p className="text-lg font-medium">No hay datos registrados</p>
            <p className="text-sm">No se encontraron ventas, premios ni gastos para esta agencia y fecha.</p>
            <p className="text-xs mt-4">Los datos deben ser registrados en la pestaña "Ventas/Premios" primero.</p>
          </div>
        </CardContent>
      </Card>;
  }

  // Calculate main cuadre (Sales - Prizes)
  const cuadreVentasPremios = {
    bs: cuadre.totalSales.bs - cuadre.totalPrizes.bs,
    usd: cuadre.totalSales.usd - cuadre.totalPrizes.usd
  };

  // Calculate bank total (Mobile received + POS - Mobile paid)
  const totalBanco = cuadre.pagoMovilRecibidos + cuadre.totalPointOfSale - cuadre.pagoMovilPagados;

  // Leer valores directamente de los inputs (que vienen de localStorage)
  const inputExchangeRate = parseFloat(exchangeRateInput) || 36.0;
  const inputCashAvailableBs = parseFloat(cashAvailableInput) || 0;
  const inputCashAvailableUsd = parseFloat(cashAvailableUsdInput) || 0;
  const inputPendingPrizes = parseFloat(pendingPrizesInput) || 0;
  const inputPendingPrizesUsd = parseFloat(pendingPrizesUsdInput) || 0;
  
  // Additional amounts from notes
  const additionalAmountBs = parseFloat(additionalAmountBsInput) || 0;
  const additionalAmountUsd = parseFloat(additionalAmountUsdInput) || 0;

  // Calculate USD sumatoria (without additional amount) - usar valores de inputs
  const sumatoriaUsd = inputCashAvailableUsd + cuadre.totalDeudas.usd + cuadre.totalGastos.usd;
  const diferenciaInicialUsd = sumatoriaUsd - cuadreVentasPremios.usd;
  const diferenciaAntesDeduccionesUsd = diferenciaInicialUsd - additionalAmountUsd;
  const diferenciaFinalUsd = diferenciaAntesDeduccionesUsd - inputPendingPrizesUsd; // Restar premios por pagar USD

  // USD excess is the difference before pending prizes (for Bs conversion)
  const excessUsd = diferenciaAntesDeduccionesUsd;

  // Bolivares Closure Formula - usar valores de inputs para los cálculos
  const sumatoriaBolivares = inputCashAvailableBs + totalBanco + cuadre.totalDeudas.bs + cuadre.totalGastos.bs + (applyExcessUsdSwitch ? excessUsd * inputExchangeRate : 0) - additionalAmountBs;
  const diferenciaCierre = sumatoriaBolivares - cuadreVentasPremios.bs;
  const diferenciaFinal = diferenciaCierre - inputPendingPrizes; // Subtract pending prizes AFTER closure difference
  const isCuadreBalanced = Math.abs(diferenciaFinal) <= 100; // Allow 100 Bs tolerance

  return <div className="space-y-6">
      {/* Title and Review Status */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Cuadre General</h2>
            <p className="text-sm text-muted-foreground">
              {agencyName} - {format(selectedDate, "d 'de' MMMM 'de' yyyy", {
              locale: es
            })}
            </p>
          </div>

          <CuadreReviewDialog currentStatus={reviewStatus} reviewedBy={reviewedBy} reviewedAt={reviewedAt} currentObservations={reviewObservations} onReject={handleRejectCuadre} disabled={!hasData} />
        </div>

        {cuadre.closureConfirmed && <Badge variant="default" className="flex items-center gap-1 w-fit">
            <CheckCircle2 className="h-3 w-3" />
            Cuadre Confirmado por Taquillera
          </Badge>}
      </div>

      {/* Exchange Rate Display */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="pt-4">
          <div className="text-center space-y-2">
            <div className="text-lg">💱</div>
            <p className="text-sm text-muted-foreground">
              Tasa del día: <span className="font-bold">{inputExchangeRate.toFixed(2)} Bs por USD</span>
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Editable Fields */}
      <Card className="border-2 border-primary/30 bg-gradient-to-br from-primary/5 to-accent/10">
        <CardHeader className="pb-4">
          <CardTitle className="text-primary flex items-center gap-2">
            <Save className="h-5 w-5" />
            Configuración del Cuadre
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Main Fields */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="exchange-rate" className="font-semibold">
                Tasa BCV (Bs/$)
              </Label>
              <Input id="exchange-rate" type="number" step="0.01" value={exchangeRateInput} onChange={e => {
              setExchangeRateInput(e.target.value);
              setFieldsEditedByUser(prev => ({
                ...prev,
                exchangeRate: true
              }));
              const rate = parseFloat(e.target.value) || 36.0;
              setCuadre(prev => ({
                ...prev,
                exchangeRate: rate
              }));
            }} className="text-center font-mono text-lg" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cash-bs" className="font-semibold">
                Efectivo Disponible (Bs)
              </Label>
              <Input id="cash-bs" type="number" step="0.01" value={cashAvailableInput} onChange={e => {
              setCashAvailableInput(e.target.value);
              setFieldsEditedByUser(prev => ({
                ...prev,
                cashAvailable: true
              }));
              const amount = parseFloat(e.target.value) || 0;
              setCuadre(prev => ({
                ...prev,
                cashAvailable: amount
              }));
            }} className="text-center font-mono text-lg" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cash-usd" className="font-semibold">
                Efectivo Disponible (USD)
              </Label>
              <Input id="cash-usd" type="number" step="0.01" value={cashAvailableUsdInput} onChange={e => {
              setCashAvailableUsdInput(e.target.value);
              setFieldsEditedByUser(prev => ({
                ...prev,
                cashAvailableUsd: true
              }));
              const amount = parseFloat(e.target.value) || 0;
              setCuadre(prev => ({
                ...prev,
                cashAvailableUsd: amount
              }));
            }} className="text-center font-mono text-lg" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="pending-prizes" className="font-semibold">
                Premios por Pagar (Bs)
              </Label>
              <Input id="pending-prizes" type="number" step="0.01" value={pendingPrizesInput} onChange={e => {
                setPendingPrizesInput(e.target.value);
                const amount = parseFloat(e.target.value) || 0;
                setCuadre(prev => ({
                  ...prev,
                  pendingPrizes: amount
                }));
              }} className="text-center font-mono text-lg" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="pending-prizes-usd" className="font-semibold">
                Premios por Pagar (USD)
              </Label>
              <Input id="pending-prizes-usd" type="number" step="0.01" value={pendingPrizesUsdInput} onChange={e => {
                setPendingPrizesUsdInput(e.target.value);
              }} className="text-center font-mono text-lg" />
            </div>
          </div>

          <div className="space-y-2">
            <Textarea id="closure-notes" value={closureNotesInput} onChange={e => setClosureNotesInput(e.target.value)} placeholder="Observaciones del día..." className="min-h-[80px]" />
          </div>

          <Separator className="my-4" />

          {/* Additional Adjustments Section */}
          <div className="space-y-4 p-4 rounded-lg bg-card border border-border">
            <h4 className="font-semibold flex items-center gap-2">
              <Calculator className="h-4 w-4" />
              Ajustes Adicionales del Cuadre
            </h4>

            {/* Apply Excess USD Switch */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-accent/20 border border-accent/40">
              <div className="space-y-1">
                <Label htmlFor="apply-excess-usd" className="font-medium cursor-pointer">
                  Aplicar excedente USD a bolívares
                </Label>
                <p className="text-xs text-muted-foreground">
                  {applyExcessUsdSwitch 
                    ? `Suma ${formatCurrency(excessUsd * inputExchangeRate, "VES")} al cuadre de Bs`
                    : "No se aplicará conversión del excedente USD"}
                </p>
              </div>
              <Switch
                id="apply-excess-usd"
                checked={applyExcessUsdSwitch}
                onCheckedChange={setApplyExcessUsdSwitch}
              />
            </div>


            {/* Additional Amounts */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="additional-amount-bs" className="font-medium">
                  Monto Adicional (Bs)
                </Label>
                <Input id="additional-amount-bs" type="number" step="0.01" value={additionalAmountBsInput} onChange={e => {
                setAdditionalAmountBsInput(e.target.value);
                const amount = parseFloat(e.target.value) || 0;
                setCuadre(prev => ({
                  ...prev,
                  additionalAmountBs: amount
                }));
              }} placeholder="Ej: dinero que se debía" className="font-mono" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="additional-amount-usd" className="font-medium">
                  Monto Adicional (USD)
                </Label>
                <Input id="additional-amount-usd" type="number" step="0.01" value={additionalAmountUsdInput} onChange={e => {
                setAdditionalAmountUsdInput(e.target.value);
                const amount = parseFloat(e.target.value) || 0;
                setCuadre(prev => ({
                  ...prev,
                  additionalAmountUsd: amount
                }));
              }} placeholder="Ej: dinero que se debía" className="font-mono" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="additional-notes" className="font-medium">
                Descripción del Monto Adicional
              </Label>
              <Textarea id="additional-notes" value={additionalNotesInput} onChange={e => {
              setAdditionalNotesInput(e.target.value);
              setCuadre(prev => ({
                ...prev,
                additionalNotes: e.target.value
              }));
            }} placeholder="Ej: Dinero que se debía de días anteriores..." className="min-h-[60px]" />
            </div>
          </div>

          <Button onClick={saveDailyClosure} disabled={saving} className="w-full mt-4" size="lg">
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Guardando..." : "Guardar todo el cuadre"}
          </Button>
        </CardContent>
      </Card>

      {/* Resumen Consolidado - Indicadores Principales */}
      <Card className="border-2 border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Indicadores Principales
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Cuadre Ventas-Premios Bs */}
            <div className="relative p-5 rounded-xl bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-2 border-blue-500/20">
              <div className="flex items-start justify-between mb-2">
                <div className="p-2 bg-blue-500/10 rounded-lg">
                  <TrendingUp className="h-5 w-5 text-blue-600" />
                </div>
              </div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Cuadre (V-P) Bs</p>
              <p className="text-2xl font-bold text-blue-600 font-mono">
                {formatCurrency(cuadreVentasPremios.bs, "VES")}
              </p>
            </div>

            {/* Cuadre Ventas-Premios USD */}
            <div className="relative p-5 rounded-xl bg-gradient-to-br from-purple-500/10 to-purple-500/5 border-2 border-purple-500/20">
              <div className="flex items-start justify-between mb-2">
                <div className="p-2 bg-purple-500/10 rounded-lg">
                  <TrendingUp className="h-5 w-5 text-purple-600" />
                </div>
              </div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Cuadre (V-P) USD</p>
              <p className="text-2xl font-bold text-purple-600 font-mono">
                {formatCurrency(cuadreVentasPremios.usd, "USD")}
              </p>
            </div>

            {/* Total en Banco */}
            <div className="relative p-5 rounded-xl bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border-2 border-emerald-500/20">
              <div className="flex items-start justify-between mb-2">
                <div className="p-2 bg-emerald-500/10 rounded-lg">
                  <TrendingUp className="h-5 w-5 text-emerald-600" />
                </div>
              </div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Total en Banco</p>
              <p className="text-2xl font-bold text-emerald-600 font-mono">{formatCurrency(totalBanco, "VES")}</p>
            </div>

            {/* Premios por Pagar */}
            <div className="relative p-5 rounded-xl bg-gradient-to-br from-amber-500/10 to-amber-500/5 border-2 border-amber-500/20">
              <div className="flex items-start justify-between mb-2">
                <div className="p-2 bg-amber-500/10 rounded-lg">
                  <TrendingDown className="h-5 w-5 text-amber-600" />
                </div>
              </div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                Premios por Pagar
              </p>
              <p className="text-2xl font-bold text-amber-600 font-mono">
                {formatCurrency(inputPendingPrizes, "VES")}
              </p>
            </div>
          </div>

          <Separator className="my-6" />

          {/* Desglose Ventas/Premios - Layout compacto */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <TrendingUp className="h-3.5 w-3.5" />
                Ventas
              </h4>
              <div className="space-y-2 pl-1">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Bolívares</span>
                  <span className="font-mono font-semibold text-sm">{formatCurrency(cuadre.totalSales.bs, "VES")}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Dólares</span>
                  <span className="font-mono font-semibold text-sm">
                    {formatCurrency(cuadre.totalSales.usd, "USD")}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <TrendingDown className="h-3.5 w-3.5" />
                Premios
              </h4>
              <div className="space-y-2 pl-1">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Bolívares</span>
                  <span className="font-mono font-semibold text-sm">
                    {formatCurrency(cuadre.totalPrizes.bs, "VES")}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Dólares</span>
                  <span className="font-mono font-semibold text-sm">
                    {formatCurrency(cuadre.totalPrizes.usd, "USD")}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                Desglose Banco
              </h4>
              <div className="space-y-2 pl-1">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">P. Móvil Recibido</span>
                  <span className="font-mono font-semibold text-sm text-emerald-600">
                    {formatCurrency(cuadre.pagoMovilRecibidos, "VES")}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Punto de Venta</span>
                  <span className="font-mono font-semibold text-sm text-blue-600">
                    {formatCurrency(cuadre.totalPointOfSale, "VES")}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">P. Móvil Pagado</span>
                  <span className="font-mono font-semibold text-sm text-red-600">
                    -{formatCurrency(cuadre.pagoMovilPagados, "VES")}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Closure Formula Card - Bolivares */}
      <Card className="border-2 border-primary/20 overflow-hidden">
        <CardHeader className="bg-gradient-to-br from-background via-muted/30 to-background pb-4">
          <CardTitle className="text-primary flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Resumen en Bolívares
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
              <div className="space-y-4">
                <h4 className="font-semibold text-sm h-5 flex items-center">Sumatoria:</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors">
                    <span>Efectivo del día:</span>
                    <span className="font-mono font-medium">{formatCurrency(inputCashAvailableBs, "VES")}</span>
                  </div>
                  <div className="flex justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors">
                    <span>Total en banco:</span>
                    <span className="font-mono font-medium">{formatCurrency(totalBanco, "VES")}</span>
                  </div>
                  <Collapsible open={deudasOpen} onOpenChange={setDeudasOpen}>
                    <CollapsibleTrigger asChild>
                      <div className="flex justify-between items-center cursor-pointer hover:bg-muted/50 rounded-lg px-2 py-2 transition-colors">
                        <span className="flex items-center gap-1">
                          {deudasOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                          Deudas:
                        </span>
                        <span className="font-mono font-medium">{formatCurrency(cuadre.totalDeudas.bs, "VES")}</span>
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="ml-4 mt-2 space-y-1 text-xs">
                        {cuadre.deudasDetails.length > 0 ? cuadre.deudasDetails.map((deuda, index) => <div key={index} className="flex justify-between items-center py-1 px-2 bg-muted/30 rounded">
                              <div className="flex-1">
                                <span className="text-muted-foreground">{deuda.description}</span>
                                <div className="text-xs text-muted-foreground">
                                  {format(new Date(deuda.created_at), "dd/MM/yyyy")}
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="font-mono">{formatCurrency(deuda.amount_bs, "VES")}</div>
                                {deuda.amount_usd > 0 && <div className="text-xs text-muted-foreground font-mono">
                                    {formatCurrency(deuda.amount_usd, "USD")}
                                  </div>}
                              </div>
                            </div>) : <div className="text-muted-foreground text-center py-2">No hay deudas registradas</div>}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                  <Collapsible open={gastosOpen} onOpenChange={setGastosOpen}>
                    <CollapsibleTrigger asChild>
                      <div className="flex justify-between items-center cursor-pointer hover:bg-muted/50 rounded-lg px-2 py-2 transition-colors">
                        <span className="flex items-center gap-1">
                          {gastosOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                          Gastos:
                        </span>
                        <span className="font-mono font-medium">{formatCurrency(cuadre.totalGastos.bs, "VES")}</span>
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="ml-4 mt-2 space-y-1 text-xs">
                        {cuadre.gastosDetails.length > 0 ? cuadre.gastosDetails.map((gasto, index) => <div key={index} className="flex justify-between items-center py-1 px-2 bg-muted/30 rounded">
                              <div className="flex-1">
                                <span className="text-muted-foreground">{gasto.description}</span>
                                <div className="text-xs text-muted-foreground">
                                  {format(new Date(gasto.created_at), "dd/MM/yyyy")}
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="font-mono">{formatCurrency(gasto.amount_bs, "VES")}</div>
                                {gasto.amount_usd > 0 && <div className="text-xs text-muted-foreground font-mono">
                                    {formatCurrency(gasto.amount_usd, "USD")}
                                  </div>}
                              </div>
                            </div>) : <div className="text-muted-foreground text-center py-2">No hay gastos registrados</div>}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                  <div className="flex justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors">
                    <span>Excedente USD → Bs (x{inputExchangeRate.toFixed(2)}):</span>
                    <span className="font-mono font-medium">
                      {applyExcessUsdSwitch ? formatCurrency(excessUsd * inputExchangeRate, "VES") : formatCurrency(0, "VES")}
                    </span>
                  </div>
                  {additionalAmountBs > 0 && <div className="flex justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors">
                      <span>Menos: Monto adicional (Bs):</span>
                      <span className="font-mono font-medium text-destructive">-{formatCurrency(additionalAmountBs, "VES")}</span>
                    </div>}
                  <Separator className="my-2" />
                  <div className="flex justify-between font-bold text-lg p-3 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20">
                    <span>Total Sumatoria:</span>
                    <span className="font-mono">{formatCurrency(sumatoriaBolivares, "VES")}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-semibold text-sm h-5 flex items-center">Comparación:</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors">
                    <span>Sumatoria:</span>
                    <span className="font-mono font-medium">{formatCurrency(sumatoriaBolivares, "VES")}</span>
                  </div>
                  <div className="flex justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors">
                    <span>Cuadre (V-P):</span>
                    <span className="font-mono font-medium">{formatCurrency(cuadreVentasPremios.bs, "VES")}</span>
                  </div>
                  <div className="flex justify-between text-sm text-muted-foreground p-2 rounded-lg hover:bg-muted/50 transition-colors">
                    <span>Diferencia inicial:</span>
                    <span className="font-mono font-medium">{formatCurrency(diferenciaCierre, "VES")}</span>
                  </div>
                  <div className="flex justify-between text-sm text-muted-foreground p-2 rounded-lg hover:bg-muted/50 transition-colors">
                    <span>Menos: Premios por pagar:</span>
                    <span className="font-mono font-medium">-{formatCurrency(inputPendingPrizes, "VES")}</span>
                  </div>
                  <Separator className="my-3" />

                  {/* Resultado Final - Destacado */}
                  <div className={`relative p-5 rounded-xl border-2 ${isCuadreBalanced ? "bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border-emerald-500/30" : "bg-gradient-to-br from-red-500/10 to-red-500/5 border-red-500/30"}`}>
                    <div className="flex items-start justify-between mb-2">
                      <div className={`p-2 rounded-lg ${isCuadreBalanced ? "bg-emerald-500/10" : "bg-red-500/10"}`}>
                        {isCuadreBalanced ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : <XCircle className="h-5 w-5 text-red-600" />}
                      </div>
                    </div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                      Diferencia Final
                    </p>
                    <p className={`text-3xl font-bold font-mono ${isCuadreBalanced ? "text-emerald-600" : "text-red-600"}`}>
                      {formatCurrency(diferenciaFinal, "VES")}
                    </p>
                    <p className={`text-xs mt-2 font-medium ${isCuadreBalanced ? "text-emerald-600" : "text-red-600"}`}>
                      {isCuadreBalanced ? "¡Cuadre Perfecto!" : "Diferencia encontrada"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* USD Closure Formula Card */}
      <Card className="border-2 border-purple-200 overflow-hidden">
        <CardHeader className="bg-gradient-to-br from-purple-50/50 via-purple-100/30 to-purple-50/50 pb-4">
          <CardTitle className="text-purple-700 flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Resumen en Dólares (USD)
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
              <div className="space-y-4">
                <h4 className="font-semibold text-sm h-5 flex items-center">Sumatoria:</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors">
                    <span>Efectivo disponible:</span>
                    <span className="font-mono font-medium">{formatCurrency(inputCashAvailableUsd, "USD")}</span>
                  </div>
                  <div className="flex justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors">
                    <span>Deudas:</span>
                    <span className="font-mono font-medium">{formatCurrency(cuadre.totalDeudas.usd, "USD")}</span>
                  </div>
                  <div className="flex justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors">
                    <span>Gastos:</span>
                    <span className="font-mono font-medium">{formatCurrency(cuadre.totalGastos.usd, "USD")}</span>
                  </div>
                  <Separator className="my-2" />
                  <div className="flex justify-between font-bold text-lg p-3 rounded-xl bg-gradient-to-br from-purple-500/10 to-purple-500/5 border border-purple-500/20">
                    <span>Total Sumatoria:</span>
                    <span className="font-mono">{formatCurrency(sumatoriaUsd, "USD")}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-semibold text-sm h-5 flex items-center">Comparación:</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors">
                    <span>Sumatoria:</span>
                    <span className="font-mono font-medium">{formatCurrency(sumatoriaUsd, "USD")}</span>
                  </div>
                  <div className="flex justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors">
                    <span>Cuadre (V-P):</span>
                    <span className="font-mono font-medium">{formatCurrency(cuadreVentasPremios.usd, "USD")}</span>
                  </div>
                  <div className="flex justify-between text-sm text-muted-foreground p-2 rounded-lg hover:bg-muted/50 transition-colors">
                    <span>Diferencia inicial:</span>
                    <span className="font-mono font-medium">{formatCurrency(diferenciaInicialUsd, "USD")}</span>
                  </div>
                  {additionalAmountUsd > 0 && <div className="flex justify-between text-sm text-muted-foreground p-2 rounded-lg hover:bg-muted/50 transition-colors">
                      <span>Menos: Monto adicional:</span>
                      <span className="font-mono font-medium">-{formatCurrency(additionalAmountUsd, "USD")}</span>
                    </div>}
                  <div className="flex justify-between text-sm text-muted-foreground p-2 rounded-lg hover:bg-muted/50 transition-colors">
                    <span>Menos: Premios por pagar:</span>
                    <span className="font-mono font-medium">-{formatCurrency(inputPendingPrizesUsd, "USD")}</span>
                  </div>
                  <Separator className="my-3" />

                  {/* Resultado Final USD */}
                  <div className={`relative p-5 rounded-xl border-2 ${Math.abs(diferenciaFinalUsd) <= 5 ? "bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border-emerald-500/30" : "bg-gradient-to-br from-red-500/10 to-red-500/5 border-red-500/30"}`}>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                      Diferencia Final
                    </p>
                    <p className={`text-3xl font-bold font-mono ${Math.abs(diferenciaFinalUsd) <= 5 ? "text-emerald-600" : "text-red-600"}`}>
                      {formatCurrency(diferenciaFinalUsd, "USD")}
                    </p>
                  </div>

                  {applyExcessUsdSwitch && <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                      <p className="text-xs text-blue-700 dark:text-blue-400">
                        El exceso USD se convierte a Bs y se suma al cuadre de Bolívares
                      </p>
                    </div>}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Closure Notes Display */}
      {cuadre.closureNotes && <Card className="border-l-4 border-l-blue-500">
          <CardHeader>
            <CardTitle className="text-sm text-blue-700">Notas del Cierre</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{cuadre.closureNotes}</p>
          </CardContent>
        </Card>}
    </div>;
};