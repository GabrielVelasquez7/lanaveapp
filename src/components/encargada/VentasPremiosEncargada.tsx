import { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { VentasPremiosBolivaresEncargada } from './VentasPremiosBolivaresEncargada';
import { VentasPremiosDolaresEncargada } from './VentasPremiosDolaresEncargada';
import { GastosManagerEncargada } from './GastosManagerEncargada';
import { PagoMovilManagerEncargada } from './PagoMovilManagerEncargada';
import { PointOfSaleFormEncargada } from './PointOfSaleFormEncargada';
import { CuadreGeneralEncargada } from './CuadreGeneralEncargada';
import { Edit, Building2, CalendarIcon, DollarSign, Receipt, Smartphone, HandCoins, CreditCard, RefreshCw, Loader2 } from 'lucide-react';
import { SystemSyncManager, SystemSyncResult } from './SystemSyncManager';
import { formatCurrency, cn } from '@/lib/utils';
import { formatDateForDB } from '@/lib/dateUtils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useFormPersist } from '@/hooks/useFormPersist';
const systemEntrySchema = z.object({
  lottery_system_id: z.string(),
  lottery_system_name: z.string(),
  sales_bs: z.number().min(0),
  sales_usd: z.number().min(0),
  prizes_bs: z.number().min(0),
  prizes_usd: z.number().min(0),
  // Montos padre (solo lectura, informativos)
  parent_sales_bs: z.number().min(0).optional(),
  parent_sales_usd: z.number().min(0).optional(),
  parent_prizes_bs: z.number().min(0).optional(),
  parent_prizes_usd: z.number().min(0).optional(),
  parent_system_id: z.string().optional() // ID del sistema padre si es subcategoría
});
const ventasPremiosSchema = z.object({
  systems: z.array(systemEntrySchema)
});
export type VentasPremiosForm = z.infer<typeof ventasPremiosSchema>;
export type SystemEntry = z.infer<typeof systemEntrySchema>;
interface LotterySystem {
  id: string;
  name: string;
  code: string;
  has_subcategories?: boolean;
  parent_system_id?: string | null;
}
interface Agency {
  id: string;
  name: string;
}
interface VentasPremiosEncargadaProps {
  // No props needed, component handles its own date selection
}
export const VentasPremiosEncargada = ({}: VentasPremiosEncargadaProps) => {
  const [mainTab, setMainTab] = useState('ventas-premios');
  const [activeTab, setActiveTab] = useState('bolivares');
  const [lotteryOptions, setLotteryOptions] = useState<LotterySystem[]>([]);
  const [allLotterySystems, setAllLotterySystems] = useState<LotterySystem[]>([]); // Todos los sistemas (padres + subcategorías)
  const [parentSystemMap, setParentSystemMap] = useState<Map<string, string>>(new Map()); // Map<subcategory_id, parent_id>
  const [parentSystemReverseMap, setParentSystemReverseMap] = useState<Map<string, string[]>>(new Map()); // Map<parent_id, [subcategory_ids]
  const [parentSystemNameMap, setParentSystemNameMap] = useState<Map<string, string>>(new Map()); // Map<parent_id, parent_name>
  const [agencies, setAgencies] = useState<Agency[]>([]);

  // Persistir agencia y fecha seleccionada en localStorage
  const [selectedAgency, setSelectedAgency] = useState<string>(() => {
    const saved = localStorage.getItem('encargada:selectedAgency');
    return saved || '';
  });
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    const saved = localStorage.getItem('encargada:selectedDate');
    return saved ? new Date(saved) : new Date();
  });
  const [loading, setLoading] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [currentCuadreId, setCurrentCuadreId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // System sync states
  const [isSystemSyncModalOpen, setIsSystemSyncModalOpen] = useState(false);
  const [isUpdatingFields, setIsUpdatingFields] = useState(false);
  const {
    user
  } = useAuth();
  const {
    toast
  } = useToast();

  // Guardar agencia seleccionada en localStorage cuando cambie
  useEffect(() => {
    if (selectedAgency) {
      localStorage.setItem('encargada:selectedAgency', selectedAgency);
    }
  }, [selectedAgency]);

  // Guardar fecha seleccionada en localStorage cuando cambie
  useEffect(() => {
    localStorage.setItem('encargada:selectedDate', selectedDate.toISOString());
  }, [selectedDate]);
  const form = useForm<VentasPremiosForm>({
    resolver: zodResolver(ventasPremiosSchema),
    defaultValues: {
      systems: []
    }
  });

  // Persist form by user + agency + date to avoid losing values on navigation/tab switch
  const persistKey = user ? `enc:ventas-premios:${user.id}:${selectedAgency || 'na'}:${format(selectedDate, 'yyyy-MM-dd')}` : null;
  const {
    clearDraft
  } = useFormPersist<VentasPremiosForm>(persistKey, form);

  // Cargar agencias y sistemas de lotería
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const [agenciesResult, systemsResult] = await Promise.all([supabase.from('agencies').select('id, name').eq('is_active', true).order('name'), supabase.from('lottery_systems').select('id, name, code, has_subcategories, parent_system_id').eq('is_active', true).order('name')]);
        if (agenciesResult.error) throw agenciesResult.error;
        if (systemsResult.error) throw systemsResult.error;
        setAgencies(agenciesResult.data || []);

        // Guardar todos los sistemas
        const allSystems = systemsResult.data || [];
        setAllLotterySystems(allSystems);
        const parentSystems = allSystems.filter(s => !s.parent_system_id);
        const subcategories = allSystems.filter(s => s.parent_system_id);

        // Crear mapa de subcategorías -> sistema padre
        const parentMap = new Map<string, string>();
        const reverseMap = new Map<string, string[]>();
        const parentNameMap = new Map<string, string>();
        subcategories.forEach(sub => {
          if (sub.parent_system_id) {
            parentMap.set(sub.id, sub.parent_system_id);
            if (!reverseMap.has(sub.parent_system_id)) {
              reverseMap.set(sub.parent_system_id, []);
            }
            reverseMap.get(sub.parent_system_id)!.push(sub.id);

            // Guardar nombre del padre
            const parent = allSystems.find(s => s.id === sub.parent_system_id);
            if (parent && !parentNameMap.has(sub.parent_system_id)) {
              parentNameMap.set(sub.parent_system_id, parent.name);
            }
          }
        });
        setParentSystemMap(parentMap);
        setParentSystemReverseMap(reverseMap);
        setParentSystemNameMap(parentNameMap);

        // Expandir: reemplazar padres con subcategorías por sus hijos
        const expandedSystems: LotterySystem[] = parentSystems.flatMap(parent => {
          if (parent.has_subcategories) {
            // Mostrar subcategorías en lugar del padre
            return subcategories.filter(sub => sub.parent_system_id === parent.id);
          }
          // Sistema normal sin subcategorías
          return [parent];
        });
        setLotteryOptions(expandedSystems);

        // Seleccionar agencia por defecto solo si no hay una guardada
        if (agenciesResult.data && agenciesResult.data.length > 0 && !selectedAgency) {
          const saved = localStorage.getItem('encargada:selectedAgency');
          setSelectedAgency(saved || agenciesResult.data[0].id);
        }
      } catch (error: any) {
        toast({
          title: 'Error',
          description: error.message || 'No se pudieron cargar los datos iniciales',
          variant: 'destructive'
        });
      }
    };
    fetchInitialData();
  }, [user, toast]);

  // Cargar datos cuando cambie la agencia o la fecha
  useEffect(() => {
    if (selectedAgency && lotteryOptions.length > 0 && selectedDate) {
      // Resetear estado antes de cargar nuevos datos
      setLoading(true);
      setEditMode(false);
      setCurrentCuadreId(null);
      form.reset({
        systems: []
      });
      loadAgencyData();
    }

    // Cleanup function
    return () => {
      setLoading(false);
    };
  }, [selectedAgency, selectedDate, lotteryOptions]);

  // Helper: Consolidar transacciones por sistema de lotería
  // Separa montos padre (solo lectura) de montos de subcategorías (editables)
  const consolidateTransactions = (systemsData: SystemEntry[], sales: any[] | null, prizes: any[] | null): SystemEntry[] => {
    // Identificar todos los IDs de sistemas padre que tienen subcategorías
    const parentSystemIds = new Set<string>();
    parentSystemReverseMap.forEach((subIds, parentId) => {
      parentSystemIds.add(parentId);
    });

    // Agrupar transacciones del sistema padre (no de subcategorías)
    const parentSalesMap = new Map<string, {
      bs: number;
      usd: number;
    }>();
    const parentPrizesMap = new Map<string, {
      bs: number;
      usd: number;
    }>();
    sales?.forEach(sale => {
      // Si la transacción tiene el ID de un sistema padre (no subcategoría)
      if (parentSystemIds.has(sale.lottery_system_id)) {
        const current = parentSalesMap.get(sale.lottery_system_id) || {
          bs: 0,
          usd: 0
        };
        parentSalesMap.set(sale.lottery_system_id, {
          bs: current.bs + Number(sale.amount_bs || 0),
          usd: current.usd + Number(sale.amount_usd || 0)
        });
      }
    });
    prizes?.forEach(prize => {
      // Si la transacción tiene el ID de un sistema padre (no subcategoría)
      if (parentSystemIds.has(prize.lottery_system_id)) {
        const current = parentPrizesMap.get(prize.lottery_system_id) || {
          bs: 0,
          usd: 0
        };
        parentPrizesMap.set(prize.lottery_system_id, {
          bs: current.bs + Number(prize.amount_bs || 0),
          usd: current.usd + Number(prize.amount_usd || 0)
        });
      }
    });
    return systemsData.map(system => {
      const parentId = parentSystemMap.get(system.lottery_system_id);

      // Si es subcategoría, obtener montos del sistema padre
      const parentSales = parentId ? parentSalesMap.get(parentId) : null;
      const parentPrizes = parentId ? parentPrizesMap.get(parentId) : null;

      // Buscar SOLO transacciones directas de esta subcategoría (no del padre)
      // Excluir transacciones que tienen el ID del sistema padre
      const systemSales = sales?.filter(s => s.lottery_system_id === system.lottery_system_id && !parentSystemIds.has(s.lottery_system_id)) || [];
      const systemPrizes = prizes?.filter(p => p.lottery_system_id === system.lottery_system_id && !parentSystemIds.has(p.lottery_system_id)) || [];
      return {
        lottery_system_id: system.lottery_system_id,
        lottery_system_name: system.lottery_system_name,
        sales_bs: systemSales.reduce((sum, s) => sum + Number(s.amount_bs || 0), 0),
        sales_usd: systemSales.reduce((sum, s) => sum + Number(s.amount_usd || 0), 0),
        prizes_bs: systemPrizes.reduce((sum, p) => sum + Number(p.amount_bs || 0), 0),
        prizes_usd: systemPrizes.reduce((sum, p) => sum + Number(p.amount_usd || 0), 0),
        // Montos padre (solo lectura, informativos)
        parent_sales_bs: parentSales?.bs || 0,
        parent_sales_usd: parentSales?.usd || 0,
        parent_prizes_bs: parentPrizes?.bs || 0,
        parent_prizes_usd: parentPrizes?.usd || 0,
        parent_system_id: parentId || undefined
      };
    });
  };

  // Helper: Actualizar formulario con datos
  const updateFormWithData = (data: SystemEntry[], isEdited: boolean, cuadreId: string | null = null) => {
    clearDraft();
    form.reset({
      systems: data
    });
    form.setValue('systems', data, {
      shouldDirty: false,
      shouldValidate: false
    });
    setEditMode(isEdited);
    setCurrentCuadreId(cuadreId);
  };
  const loadAgencyData = async () => {
    if (!user || !selectedDate || !selectedAgency) return;
    const dateStr = formatDateForDB(selectedDate);
    try {
      // Inicializar formulario con todos los sistemas
      const systemsData: SystemEntry[] = lotteryOptions.map(system => ({
        lottery_system_id: system.id,
        lottery_system_name: system.name,
        sales_bs: 0,
        sales_usd: 0,
        prizes_bs: 0,
        prizes_usd: 0
      }));

      // PRIORIDAD 1: Buscar datos ya modificados por encargada
      const {
        data: details
      } = await supabase.from('encargada_cuadre_details').select('*').eq('agency_id', selectedAgency).eq('session_date', dateStr).eq('user_id', user.id);
      if (details && details.length > 0) {
        const systemsWithData = systemsData.map(system => {
          const detail = details.find(d => d.lottery_system_id === system.lottery_system_id);
          return {
            ...system,
            sales_bs: detail ? Number(detail.sales_bs || 0) : 0,
            sales_usd: detail ? Number(detail.sales_usd || 0) : 0,
            prizes_bs: detail ? Number(detail.prizes_bs || 0) : 0,
            prizes_usd: detail ? Number(detail.prizes_usd || 0) : 0
          };
        });
        updateFormWithData(systemsWithData, true, details[0]?.id || null);
        return;
      }

      // PRIORIDAD 2: Buscar datos de taquilleras
      const {
        data: taquilleras
      } = await supabase.from('profiles').select('user_id').eq('agency_id', selectedAgency).eq('role', 'taquillero').eq('is_active', true);
      if (!taquilleras || taquilleras.length === 0) {
        updateFormWithData(systemsData, false);
        return;
      }
      const taquilleraIds = taquilleras.map(t => t.user_id);
      const {
        data: sessions
      } = await supabase.from('daily_sessions').select('id').eq('session_date', dateStr).in('user_id', taquilleraIds);
      if (!sessions || sessions.length === 0) {
        updateFormWithData(systemsData, false);
        return;
      }
      const sessionIds = sessions.map(s => s.id);

      // Obtener todas las transacciones en paralelo
      const [salesResult, prizesResult] = await Promise.all([supabase.from('sales_transactions').select('lottery_system_id, amount_bs, amount_usd').in('session_id', sessionIds), supabase.from('prize_transactions').select('lottery_system_id, amount_bs, amount_usd').in('session_id', sessionIds)]);

      // Debug: Ver qué IDs tenemos
      const salesIds = salesResult.data?.map(s => s.lottery_system_id) || [];
      const prizesIds = prizesResult.data?.map(p => p.lottery_system_id) || [];
      const systemIds = systemsData.map(s => s.lottery_system_id);
      console.log('🔍 Debug consolidación:', {
        sistemasDisponibles: systemIds.length,
        idsSistemas: systemIds.slice(0, 3),
        ventasEncontradas: salesResult.data?.length || 0,
        idsVentas: [...new Set(salesIds)],
        premiosEncontrados: prizesResult.data?.length || 0,
        idsPremios: [...new Set(prizesIds)],
        muestraVentas: salesResult.data?.slice(0, 2),
        muestraPremios: prizesResult.data?.slice(0, 2)
      });

      // Consolidar y actualizar formulario
      const consolidatedData = consolidateTransactions(systemsData, salesResult.data, prizesResult.data);
      const sistemasConDatos = consolidatedData.filter(s => s.sales_bs > 0 || s.sales_usd > 0 || s.prizes_bs > 0 || s.prizes_usd > 0);
      console.log('✅ Datos cargados:', {
        sesiones: sessions.length,
        ventas: salesResult.data?.length || 0,
        premios: prizesResult.data?.length || 0,
        sistemasConDatos: sistemasConDatos.length,
        detalleSistemas: sistemasConDatos.map(s => ({
          sistema: s.lottery_system_name,
          ventasBs: s.sales_bs,
          ventasUsd: s.sales_usd,
          premiosBs: s.prizes_bs,
          premiosUsd: s.prizes_usd
        }))
      });
      updateFormWithData(consolidatedData, false);
    } catch (error) {
      console.error('Error loading agency data:', error);
      const systemsData: SystemEntry[] = lotteryOptions.map(system => ({
        lottery_system_id: system.id,
        lottery_system_name: system.name,
        sales_bs: 0,
        sales_usd: 0,
        prizes_bs: 0,
        prizes_usd: 0
      }));
      form.reset({
        systems: systemsData
      });
      setEditMode(false);
      setCurrentCuadreId(null);
    } finally {
      setLoading(false);
    }
  };
  const [mobilePaymentsData, setMobilePaymentsData] = useState({
    received: 0,
    paid: 0,
    pos: 0
  });
  const calculateTotals = useCallback(() => {
    const systems = form.watch('systems');
    return systems.reduce((acc, system) => ({
      sales_bs: acc.sales_bs + (system.sales_bs || 0),
      sales_usd: acc.sales_usd + (system.sales_usd || 0),
      prizes_bs: acc.prizes_bs + (system.prizes_bs || 0),
      prizes_usd: acc.prizes_usd + (system.prizes_usd || 0)
    }), {
      sales_bs: 0,
      sales_usd: 0,
      prizes_bs: 0,
      prizes_usd: 0
    });
  }, [form]);

  // Cargar datos de pagos móviles y punto de venta desde daily_cuadres_summary
  useEffect(() => {
    const loadMobilePaymentsAndPOS = async () => {
      if (!selectedAgency || !selectedDate || !user) return;
      try {
        const dateStr = formatDateForDB(selectedDate);
        const {
          data: summary
        } = await supabase.from('daily_cuadres_summary').select('total_mobile_payments_bs, total_pos_bs').eq('agency_id', selectedAgency).eq('session_date', dateStr).is('session_id', null).eq('user_id', user.id).maybeSingle();
        if (summary) {
          const mobileAmount = Number(summary.total_mobile_payments_bs || 0);
          setMobilePaymentsData({
            received: mobileAmount > 0 ? mobileAmount : 0,
            paid: mobileAmount < 0 ? Math.abs(mobileAmount) : 0,
            pos: Number(summary.total_pos_bs || 0)
          });
        } else {
          setMobilePaymentsData({
            received: 0,
            paid: 0,
            pos: 0
          });
        }
      } catch (error) {
        console.error('Error loading mobile payments and POS:', error);
        setMobilePaymentsData({
          received: 0,
          paid: 0,
          pos: 0
        });
      }
    };
    loadMobilePaymentsAndPOS();
  }, [selectedAgency, selectedDate, user, refreshKey]);

  // Cargar datos de pagos móviles y punto de venta desde daily_cuadres_summary
  useEffect(() => {
    const loadMobilePaymentsAndPOS = async () => {
      if (!selectedAgency || !selectedDate || !user) return;
      try {
        const dateStr = formatDateForDB(selectedDate);
        const {
          data: summary
        } = await supabase.from('daily_cuadres_summary').select('total_mobile_payments_bs, total_pos_bs').eq('agency_id', selectedAgency).eq('session_date', dateStr).is('session_id', null).eq('user_id', user.id).maybeSingle();
        if (summary) {
          const mobileAmount = Number(summary.total_mobile_payments_bs || 0);
          setMobilePaymentsData({
            received: mobileAmount > 0 ? mobileAmount : 0,
            paid: mobileAmount < 0 ? Math.abs(mobileAmount) : 0,
            pos: Number(summary.total_pos_bs || 0)
          });
        } else {
          setMobilePaymentsData({
            received: 0,
            paid: 0,
            pos: 0
          });
        }
      } catch (error) {
        console.error('Error loading mobile payments and POS:', error);
        setMobilePaymentsData({
          received: 0,
          paid: 0,
          pos: 0
        });
      }
    };
    loadMobilePaymentsAndPOS();
  }, [selectedAgency, selectedDate, user, refreshKey]);
  const onSubmit = async (data: VentasPremiosForm) => {
    if (!user || !selectedDate || !selectedAgency) return;
    const dateStr = formatDateForDB(selectedDate);
    setLoading(true);
    try {
      // Filtrar sistemas con datos
      const systemsWithData = data.systems.filter(system => system.sales_bs > 0 || system.sales_usd > 0 || system.prizes_bs > 0 || system.prizes_usd > 0);
      if (systemsWithData.length === 0) {
        toast({
          title: 'Error',
          description: 'Debe ingresar al menos un monto',
          variant: 'destructive'
        });
        return;
      }

      // Preparar datos de detalles por sistema
      const detailsData = systemsWithData.map(system => ({
        user_id: user.id,
        agency_id: selectedAgency,
        session_date: dateStr,
        lottery_system_id: system.lottery_system_id,
        sales_bs: system.sales_bs,
        sales_usd: system.sales_usd,
        prizes_bs: system.prizes_bs,
        prizes_usd: system.prizes_usd
      }));

      // Eliminar detalles existentes para evitar duplicados
      await supabase.from('encargada_cuadre_details').delete().eq('agency_id', selectedAgency).eq('session_date', dateStr).eq('user_id', user.id);

      // Insertar nuevos detalles
      const {
        error: detailsError
      } = await supabase.from('encargada_cuadre_details').insert(detailsData);
      if (detailsError) throw detailsError;

      // Calcular totales para el resumen
      const totals = systemsWithData.reduce((acc, system) => ({
        sales_bs: acc.sales_bs + system.sales_bs,
        sales_usd: acc.sales_usd + system.sales_usd,
        prizes_bs: acc.prizes_bs + system.prizes_bs,
        prizes_usd: acc.prizes_usd + system.prizes_usd
      }), {
        sales_bs: 0,
        sales_usd: 0,
        prizes_bs: 0,
        prizes_usd: 0
      });

      // Actualizar resumen agregado
      const summaryRow = {
        user_id: user.id,
        agency_id: selectedAgency,
        session_date: dateStr,
        session_id: null,
        total_sales_bs: totals.sales_bs,
        total_sales_usd: totals.sales_usd,
        total_prizes_bs: totals.prizes_bs,
        total_prizes_usd: totals.prizes_usd,
        balance_bs: totals.sales_bs - totals.prizes_bs,
        cash_available_bs: 0,
        cash_available_usd: 0,
        exchange_rate: 36
      };

      // Deterministic merge to avoid ON CONFLICT affecting row twice
      const {
        data: existingSummary,
        error: findSummaryError
      } = await supabase.from('daily_cuadres_summary').select('id').eq('user_id', user.id).eq('agency_id', selectedAgency).eq('session_date', dateStr).is('session_id', null).maybeSingle();
      if (findSummaryError) throw findSummaryError;
      let summaryError = null as any;
      if (existingSummary?.id) {
        const {
          error: updateErr
        } = await supabase.from('daily_cuadres_summary').update(summaryRow).eq('id', existingSummary.id);
        summaryError = updateErr || null;
      } else {
        const {
          error: insertErr
        } = await supabase.from('daily_cuadres_summary').insert(summaryRow);
        summaryError = insertErr || null;
      }
      if (summaryError) throw summaryError;

      // Guardar datos en encargada_cuadre_details para que aparezcan en Resumen por Sistemas
      // Estos son los valores FINALES que la encargada está aprobando (modificados o precargados)
      const systemsToSave = data.systems.filter(
        s => s.sales_bs > 0 || s.sales_usd > 0 || s.prizes_bs > 0 || s.prizes_usd > 0
      );

      if (systemsToSave.length > 0) {
        // Obtener información de sistemas padre para agrupar correctamente
        const { data: allSystems } = await supabase
          .from('lottery_systems')
          .select('id, parent_system_id')
          .eq('is_active', true);

        // Agrupar por sistema padre si es necesario
        const systemDataMap = new Map<string, { sales_bs: number; sales_usd: number; prizes_bs: number; prizes_usd: number }>();
        
        systemsToSave.forEach(system => {
          const systemInfo = allSystems?.find(s => s.id === system.lottery_system_id);
          const systemKey = systemInfo?.parent_system_id || system.lottery_system_id;
          
          const existing = systemDataMap.get(systemKey) || { sales_bs: 0, sales_usd: 0, prizes_bs: 0, prizes_usd: 0 };
          existing.sales_bs += Number(system.sales_bs || 0);
          existing.sales_usd += Number(system.sales_usd || 0);
          existing.prizes_bs += Number(system.prizes_bs || 0);
          existing.prizes_usd += Number(system.prizes_usd || 0);
          systemDataMap.set(systemKey, existing);
        });

        const detailsToSave = Array.from(systemDataMap.entries()).map(([systemId, data]) => ({
          user_id: user.id,
          agency_id: selectedAgency,
          session_date: dateStr,
          lottery_system_id: systemId,
          sales_bs: data.sales_bs,
          sales_usd: data.sales_usd,
          prizes_bs: data.prizes_bs,
          prizes_usd: data.prizes_usd,
        }));

        // Eliminar detalles existentes y guardar nuevos
        await supabase
          .from('encargada_cuadre_details')
          .delete()
          .eq('agency_id', selectedAgency)
          .eq('session_date', dateStr)
          .eq('user_id', user.id);

        if (detailsToSave.length > 0) {
          const { error: detailsError } = await supabase
            .from('encargada_cuadre_details')
            .insert(detailsToSave);

          if (detailsError) {
            console.error('Error guardando encargada_cuadre_details:', detailsError);
            // No lanzar error, solo loguear
          }
        }
      }

      toast({
        title: 'Éxito',
        description: editMode ? 'Cuadre actualizado correctamente' : 'Cuadre registrado correctamente'
      });

      // Limpiar borrador tras guardar
      clearDraft();
      setEditMode(true);

      // NO recargar datos, mantener los valores en el formulario para que sean visibles
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Error al procesar los cuadres',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };
  const refreshData = () => {
    loadAgencyData();
  };
  const handleSyncSystems = () => {
    if (!selectedAgency || !selectedDate) {
      toast({
        title: "Error",
        description: "Selecciona una agencia y fecha primero",
        variant: "destructive"
      });
      return;
    }
    setIsSystemSyncModalOpen(true);
  };
  const handleSyncSuccess = async (results: SystemSyncResult[]) => {
    setIsUpdatingFields(true);
    console.log('Sync results received:', results);

    // Map system codes to update form values
    const systemCodeToLotterySystem: Record<string, LotterySystem | undefined> = {
      'MAXPLAY': lotteryOptions.find(s => s.code === 'MAXPLAY'),
      // Handle both SOURCE and SOURCES codes
      'SOURCES': lotteryOptions.find(s => s.code === 'SOURCES') || lotteryOptions.find(s => s.code === 'SOURCE'),
      'SOURCE': lotteryOptions.find(s => s.code === 'SOURCE'),
      'PREMIER': lotteryOptions.find(s => s.code === 'PREMIER')
    };

    // Get current form values
    const currentSystems = form.getValues('systems');
    const updatedSystems = Array.isArray(currentSystems) ? [...currentSystems] : [];

    // Process each successful sync result
    results.forEach(result => {
      if (!result.success || !result.agencyResults) return;
      const codeKey = (result.systemCode || '').toUpperCase();
      const lotterySystem = systemCodeToLotterySystem[codeKey];
      if (!lotterySystem) return;

      // Find data for the current agency (by name match)
      const currentAgencyResult = result.agencyResults.find(agencyResult => {
        const agency = agencies.find(a => a.name === agencyResult.name);
        return agency?.id === selectedAgency;
      });
      if (currentAgencyResult) {
        // Update the corresponding system in the form
        const systemIndex = updatedSystems.findIndex(s => s.lottery_system_id === lotterySystem.id);
        const salesBs = Number(currentAgencyResult.sales) || 0;
        const prizesBs = Number(currentAgencyResult.prizes) || 0;
        if (systemIndex !== -1) {
          updatedSystems[systemIndex] = {
            ...updatedSystems[systemIndex],
            sales_bs: salesBs,
            prizes_bs: prizesBs
          };
        } else {
          // Ensure an entry exists if it wasn't initialized yet
          updatedSystems.push({
            lottery_system_id: lotterySystem.id,
            lottery_system_name: lotterySystem.name,
            sales_bs: salesBs,
            sales_usd: 0,
            prizes_bs: prizesBs,
            prizes_usd: 0
          });
        }
      }
    });

    // Update form with all synchronized data and mark as dirty to re-render
    form.setValue('systems', updatedSystems as any, {
      shouldDirty: true,
      shouldValidate: false
    });

    // Show summary toast
    const successfulSyncs = results.filter(r => r.success);
    if (successfulSyncs.length > 0) {
      toast({
        title: 'Campos actualizados',
        description: `${successfulSyncs.map(r => r.systemName).join(', ')} sincronizados correctamente. Revisa los valores y guarda cuando estés listo.`
      });
    }
    setIsUpdatingFields(false);
  };
  const totals = calculateTotals();
  const selectedAgencyName = agencies.find(a => a.id === selectedAgency)?.name || '';
  return <div className="space-y-6">
      {/* Selectores de Agencia y Fecha */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Building2 className="h-5 w-5 mr-2" />
              Seleccionar Agencia
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={selectedAgency} onValueChange={setSelectedAgency}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecciona una agencia" />
              </SelectTrigger>
              <SelectContent>
                {agencies.map(agency => <SelectItem key={agency.id} value={agency.id}>
                    {agency.name}
                  </SelectItem>)}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <CalendarIcon className="h-5 w-5 mr-2" />
              Seleccionar Fecha
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !selectedDate && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {selectedDate ? format(selectedDate, "PPP", {
                  locale: es
                }) : "Seleccionar fecha"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={selectedDate} onSelect={date => date && setSelectedDate(date)} initialFocus className={cn("p-3 pointer-events-auto")} />
              </PopoverContent>
            </Popover>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <RefreshCw className="h-5 w-5 mr-2" />
              Sincronización de Sistemas
            </CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-center h-full">
            <Button onClick={handleSyncSystems} disabled={!selectedAgency || !selectedDate} className="w-full">
              <RefreshCw className="h-4 w-4 mr-2" />
              Sincronizar Sistemas
            </Button>
          </CardContent>
        </Card>
      </div>

      {selectedAgency && <Tabs value={mainTab} onValueChange={setMainTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="ventas-premios" className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Ventas/Premios
            </TabsTrigger>
            <TabsTrigger value="gastos" className="flex items-center gap-2">
              <Receipt className="h-4 w-4" />
              Gastos
            </TabsTrigger>
            <TabsTrigger value="pago-movil" className="flex items-center gap-2">
              <Smartphone className="h-4 w-4" />
              Pago Móvil
            </TabsTrigger>
            <TabsTrigger value="punto-venta" className="flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Punto Venta
            </TabsTrigger>
            <TabsTrigger value="resumen" className="flex items-center gap-2">
              <CalendarIcon className="h-4 w-4" />
              Resumen
            </TabsTrigger>
          </TabsList>

          <TabsContent value="ventas-premios" className="space-y-6">
            {/* Resumen de totales */}
            <Card className="bg-muted/50">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <span>Resumen del Cuadre - {selectedAgencyName} {editMode && <Edit className="h-4 w-4 ml-2" />}</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                  <div>
                    <p className="text-sm text-muted-foreground">Ventas Bs</p>
                    <p className="text-xl font-bold text-success">
                      {formatCurrency(totals.sales_bs, 'VES')}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Premios Bs</p>
                    <p className="text-xl font-bold text-destructive">
                      {formatCurrency(totals.prizes_bs, 'VES')}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Ventas USD</p>
                    <p className="text-xl font-bold text-success">
                      {formatCurrency(totals.sales_usd, 'USD')}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Premios USD</p>
                    <p className="text-xl font-bold text-destructive">
                      {formatCurrency(totals.prizes_usd, 'USD')}
                    </p>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-center">
                    <div>
                      <p className="text-sm text-muted-foreground">Cuadre Bs</p>
                      <p className={`text-2xl font-bold ${totals.sales_bs - totals.prizes_bs >= 0 ? 'text-success' : 'text-destructive'}`}>
                        {formatCurrency(totals.sales_bs - totals.prizes_bs, 'VES')}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Cuadre USD</p>
                      <p className={`text-2xl font-bold ${totals.sales_usd - totals.prizes_usd >= 0 ? 'text-success' : 'text-destructive'}`}>
                        {formatCurrency(totals.sales_usd - totals.prizes_usd, 'USD')}
                      </p>
                    </div>
                  </div>
                  
                </div>
              </CardContent>
            </Card>

            {/* Sub-tabs para ventas/premios */}
            <div className="relative">
              {isUpdatingFields && <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-10 rounded-lg">
                  <div className="text-center p-6">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto mb-3 text-primary" />
                    <p className="text-sm font-medium text-foreground">Actualizando campos con datos de MaxPlayGo</p>
                    <p className="text-xs text-muted-foreground mt-1">Por favor espere...</p>
                  </div>
                </div>}
              
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="bolivares">Ventas/Premios Bs</TabsTrigger>
                  <TabsTrigger value="dolares">Ventas/Premios USD</TabsTrigger>
                </TabsList>

                <TabsContent value="bolivares" className="space-y-4">
                  <VentasPremiosBolivaresEncargada form={form} lotteryOptions={lotteryOptions} />
                </TabsContent>

                <TabsContent value="dolares" className="space-y-4">
                  <VentasPremiosDolaresEncargada form={form} lotteryOptions={lotteryOptions} />
                </TabsContent>
              </Tabs>
            </div>

            {/* Botón de guardar */}
            <div className="flex justify-center">
              <Button onClick={form.handleSubmit(onSubmit)} disabled={loading} size="lg" className="min-w-[200px]">
                {loading ? 'Procesando...' : editMode ? 'Actualizar Cuadre' : 'Registrar Cuadre'}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="gastos" className="space-y-6">
            <GastosManagerEncargada onSuccess={refreshData} selectedAgency={selectedAgency} selectedDate={selectedDate} />
          </TabsContent>

          <TabsContent value="pago-movil" className="space-y-6">
            <PagoMovilManagerEncargada onSuccess={refreshData} selectedAgency={selectedAgency} selectedDate={selectedDate} />
          </TabsContent>

          <TabsContent value="punto-venta" className="space-y-6">
            <PointOfSaleFormEncargada selectedAgency={selectedAgency} selectedDate={selectedDate} onSuccess={refreshData} />
          </TabsContent>

          <TabsContent value="resumen" className="space-y-6">
            <CuadreGeneralEncargada selectedAgency={selectedAgency} selectedDate={selectedDate} />
          </TabsContent>
        </Tabs>}

      {/* System Sync Manager Modal */}
      {selectedAgency && selectedDate && <SystemSyncManager isOpen={isSystemSyncModalOpen} onClose={() => setIsSystemSyncModalOpen(false)} targetDate={format(selectedDate, 'dd-MM-yyyy')} onSuccess={handleSyncSuccess} />}
    </div>;
};