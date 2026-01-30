import { useState, useEffect, useCallback, useRef } from 'react';
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
import { Edit, Building2, CalendarIcon, DollarSign, Receipt, Smartphone, HandCoins, CreditCard } from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';
import { formatDateForDB, parseDateFromDB } from '@/lib/dateUtils';
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
    if (saved) {
      return parseDateFromDB(saved);
    }
    return new Date();
  });
  const [loading, setLoading] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [currentCuadreId, setCurrentCuadreId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [dataVersion, setDataVersion] = useState(0); // Incrementar al cargar datos para forzar re-sync de hijos

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

  // Guardar fecha seleccionada en localStorage cuando cambie (formato YYYY-MM-DD para evitar problemas de zona horaria)
  useEffect(() => {
    localStorage.setItem('encargada:selectedDate', formatDateForDB(selectedDate));
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
    clearDraft,
    skipNextRestore
  } = useFormPersist<VentasPremiosForm>(persistKey, form);

  // Track if we've loaded data for the current agency+date to avoid overwriting persisted values
  const lastLoadedKeyRef = useRef<string | null>(null);

  // Función para cargar sistemas de lotería desde la BD
  const fetchLotterySystems = useCallback(async () => {
    try {
      const systemsResult = await supabase
        .from('lottery_systems')
        .select('id, name, code, has_subcategories, parent_system_id')
        .eq('is_active', true)
        .order('name');
      
      if (systemsResult.error) throw systemsResult.error;

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
          // Mostrar subcategorías en lugar del padre, incluyendo parent_system_id
          return subcategories
            .filter(sub => sub.parent_system_id === parent.id)
            .map(sub => ({
              ...sub,
              parent_system_id: sub.parent_system_id // Asegurar que se incluya
            }));
        }
        // Sistema normal sin subcategorías
        return [parent];
      });
      setLotteryOptions(expandedSystems);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'No se pudieron cargar los sistemas de lotería',
        variant: 'destructive'
      });
    }
  }, [toast]);

  // Cargar agencias y sistemas de lotería
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const agenciesResult = await supabase
          .from('agencies')
          .select('id, name')
          .eq('is_active', true)
          .order('name');
        
        if (agenciesResult.error) throw agenciesResult.error;
        setAgencies(agenciesResult.data || []);

        // Cargar sistemas de lotería
        await fetchLotterySystems();

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
  }, [user, toast, fetchLotterySystems]);


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
      
      // Calcular montos directos de la subcategoría (solo transacciones con ID de la subcategoría)
      const directSalesBs = systemSales.reduce((sum, s) => sum + Number(s.amount_bs || 0), 0);
      const directSalesUsd = systemSales.reduce((sum, s) => sum + Number(s.amount_usd || 0), 0);
      const directPrizesBs = systemPrizes.reduce((sum, p) => sum + Number(p.amount_bs || 0), 0);
      const directPrizesUsd = systemPrizes.reduce((sum, p) => sum + Number(p.amount_usd || 0), 0);
      
      // Obtener montos del padre (si existen) - estos van solo en campos informativos
      const parentSalesBs = parentSales?.bs || 0;
      const parentSalesUsd = parentSales?.usd || 0;
      const parentPrizesBs = parentPrizes?.bs || 0;
      const parentPrizesUsd = parentPrizes?.usd || 0;
      
      // Los campos editables SOLO muestran transacciones directas de la subcategoría
      // Los montos del padre van en los campos informativos para mostrar "Monto Taquillera"
      return {
        lottery_system_id: system.lottery_system_id,
        lottery_system_name: system.lottery_system_name,
        sales_bs: directSalesBs,
        sales_usd: directSalesUsd,
        prizes_bs: directPrizesBs,
        prizes_usd: directPrizesUsd,
        // Montos padre (solo lectura, informativos) - se muestran en la fila "Monto Taquillera"
        // Esto permite que se muestre igual que otros sistemas con subcategorías
        parent_sales_bs: parentSalesBs,
        parent_sales_usd: parentSalesUsd,
        parent_prizes_bs: parentPrizesBs,
        parent_prizes_usd: parentPrizesUsd,
        parent_system_id: parentId || undefined
      };
    });
  };

  // Helper: Actualizar formulario con datos
  const updateFormWithData = useCallback((data: SystemEntry[], isEdited: boolean, cuadreId: string | null = null) => {
    // Limpiar borrador y evitar que se restaure después de cargar datos de BD
    clearDraft();
    skipNextRestore();
    
    // IMPORTANTE: Usar form.reset para establecer los valores
    form.reset({ systems: data });
    
    // Forzar re-sincronización de componentes hijos incrementando dataVersion
    setDataVersion(v => v + 1);
    
    // Verificar que los valores se aplicaron correctamente
    const appliedSystems = form.getValues('systems');
    const conDatos = appliedSystems.filter(s => s.sales_bs > 0 || s.prizes_bs > 0 || s.sales_usd > 0 || s.prizes_usd > 0).length;
    console.log('[updateFormWithData] Valores aplicados al formulario:', {
      dataCount: data.length,
      appliedCount: appliedSystems.length,
      conDatos,
      sample: appliedSystems.filter(s => s.sales_bs > 0 || s.prizes_bs > 0).slice(0, 3).map(s => ({
        name: s.lottery_system_name,
        sales_bs: s.sales_bs,
        prizes_bs: s.prizes_bs
      }))
    });
    
    setEditMode(isEdited);
    setCurrentCuadreId(cuadreId);
  }, [form, clearDraft, skipNextRestore]);
  const loadAgencyData = useCallback(async () => {
    if (!user || !selectedDate || !selectedAgency || lotteryOptions.length === 0) return;
    const dateStr = formatDateForDB(selectedDate);
    
    setLoading(true);
    
    try {
      // Inicializar formulario con todos los sistemas, incluyendo parent_system_id
      const systemsData: SystemEntry[] = lotteryOptions.map(system => ({
        lottery_system_id: system.id,
        lottery_system_name: system.name,
        sales_bs: 0,
        sales_usd: 0,
        prizes_bs: 0,
        prizes_usd: 0,
        parent_system_id: system.parent_system_id || undefined
      }));

      // PRIORIDAD 1: Buscar datos ya guardados por la encargada en encargada_cuadre_details
      const { data: details } = await supabase
        .from('encargada_cuadre_details')
        .select('*')
        .eq('agency_id', selectedAgency)
        .eq('session_date', dateStr)
        .eq('user_id', user.id);
      // NOTA IMPORTANTE:
      // Aunque existan datos en encargada_cuadre_details, necesitamos también los montos
      // informativos "Monto Taquillera" (parent_sales_*/parent_prizes_*) que vienen de
      // sales_transactions/prize_transactions.
      // Por eso SIEMPRE construimos una base desde transacciones de taquilleras y luego
      // sobre-escribimos con los valores guardados por la encargada.

      // Buscar datos de taquilleras para mostrar como referencia (base)
      const { data: taquilleras } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('agency_id', selectedAgency)
        .eq('role', 'taquillero')
        .eq('is_active', true);

      let referenceData: SystemEntry[] = systemsData;

      if (taquilleras && taquilleras.length > 0) {
        const taquilleraIds = taquilleras.map(t => t.user_id);
        const { data: sessions } = await supabase
          .from('daily_sessions')
          .select('id')
          .eq('session_date', dateStr)
          .in('user_id', taquilleraIds);

        if (sessions && sessions.length > 0) {
          const sessionIds = sessions.map(s => s.id);
          const [salesResult, prizesResult] = await Promise.all([
            supabase.from('sales_transactions').select('lottery_system_id, amount_bs, amount_usd').in('session_id', sessionIds),
            supabase.from('prize_transactions').select('lottery_system_id, amount_bs, amount_usd').in('session_id', sessionIds)
          ]);

          referenceData = consolidateTransactions(systemsData, salesResult.data, prizesResult.data);
        }
      }

      // Si hay datos guardados por la encargada, mezclarlos SOBRE la base de taquillera.
      // Esto evita que sistemas no editados queden en 0 y asegura que siga apareciendo
      // la fila "Monto Taquillera" para sistemas con subcategorías.
      if (details && details.length > 0) {
        const detailsMap = new Map<string, any>();
        details.forEach(d => detailsMap.set(d.lottery_system_id, d));

        const mergedData = referenceData.map(system => {
          const detail = detailsMap.get(system.lottery_system_id);
          if (!detail) return system;
          return {
            ...system, // Preserva parent_sales_*, parent_prizes_*, parent_system_id
            sales_bs: Number(detail.sales_bs || 0),
            sales_usd: Number(detail.sales_usd || 0),
            prizes_bs: Number(detail.prizes_bs || 0),
            prizes_usd: Number(detail.prizes_usd || 0)
          };
        });

        console.log('[loadAgencyData] Datos mezclados encargada + taquillera:', {
          detailsCount: details.length,
          mergedCount: mergedData.length,
          conDatos: mergedData.filter(s => s.sales_bs > 0 || s.prizes_bs > 0 || s.sales_usd > 0 || s.prizes_usd > 0).length,
          sample: mergedData.slice(0, 5).map(s => ({
            name: s.lottery_system_name,
            sales_bs: s.sales_bs,
            prizes_bs: s.prizes_bs,
            parent_sales_bs: s.parent_sales_bs
          }))
        });

        updateFormWithData(mergedData, true, details[0]?.id || null);
        return;
      }

      // Si NO hay datos de encargada, usar la base (taquillera o ceros)
      updateFormWithData(referenceData, false);
    } catch (error) {
      console.error('Error loading agency data:', error);
      // Solo establecer valores por defecto si no hay datos en el formulario
      const currentSystems = form.getValues('systems');
      if (!currentSystems || currentSystems.length === 0) {
        const systemsData: SystemEntry[] = lotteryOptions.map(system => ({
          lottery_system_id: system.id,
          lottery_system_name: system.name,
          sales_bs: 0,
          sales_usd: 0,
          prizes_bs: 0,
          prizes_usd: 0,
          parent_system_id: system.parent_system_id || undefined
        }));
        form.reset({ systems: systemsData });
      }
      setEditMode(false);
      setCurrentCuadreId(null);
    } finally {
      setLoading(false);
    }
  }, [user, selectedDate, selectedAgency, lotteryOptions, form, clearDraft, skipNextRestore, parentSystemMap, parentSystemReverseMap]);

  // Recargar sistemas cuando se cambia a la pestaña de ventas-premios
  useEffect(() => {
    if (mainTab === 'ventas-premios') {
      fetchLotterySystems();
    }
  }, [mainTab, fetchLotterySystems]);

  // Forzar recarga de datos al volver a la pestaña de ventas-premios
  // Esto se hace en un useEffect separado para evitar loops con loadAgencyData
  const previousMainTabRef = useRef<string>(mainTab);
  useEffect(() => {
    if (previousMainTabRef.current !== mainTab && mainTab === 'ventas-premios') {
      // Acabamos de volver a la pestaña de ventas-premios
      // Forzar recarga de datos desde BD para asegurar que los inputs muestren los datos persistidos
      if (selectedAgency && lotteryOptions.length > 0) {
        lastLoadedKeyRef.current = null; // Forzar recarga
        loadAgencyData();
      }
    }
    previousMainTabRef.current = mainTab;
  }, [mainTab, selectedAgency, lotteryOptions.length, loadAgencyData]);

  // Cargar datos cuando cambie la agencia o la fecha
  // Usa lastLoadedKeyRef para evitar recargar datos innecesariamente cuando el componente se re-renderiza
  useEffect(() => {
    if (!selectedAgency || lotteryOptions.length === 0 || !selectedDate) return;

    const currentKey = `${selectedAgency}:${format(selectedDate, 'yyyy-MM-dd')}`;
    const keyChanged = lastLoadedKeyRef.current !== currentKey;

    // Solo cargar datos si cambió la agencia o la fecha
    if (keyChanged) {
      lastLoadedKeyRef.current = currentKey;
      setEditMode(false);
      setCurrentCuadreId(null);
      // NO hacer form.reset aquí - dejar que loadAgencyData maneje los datos
      // para que useFormPersist pueda restaurar datos persistidos primero
      loadAgencyData();
    }
  }, [selectedAgency, selectedDate, lotteryOptions.length, loadAgencyData]);

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
      // Validación: al menos un monto distinto de 0
      const hasAnyAmount = data.systems.some(system => system.sales_bs > 0 || system.sales_usd > 0 || system.prizes_bs > 0 || system.prizes_usd > 0);
      if (!hasAnyAmount) {
        toast({
          title: 'Error',
          description: 'Debe ingresar al menos un monto',
          variant: 'destructive'
        });
        return;
      }

      // Preparar datos de detalles por sistema
      // IMPORTANTE: Guardar TODOS los sistemas del formulario.
      // Si solo guardamos los que están "con data", al recargar (prioridad 1) los demás
      // quedan en 0 y el usuario siente que “se perdió” la información.
      const detailsData = data.systems.map(system => ({
        user_id: user.id,
        agency_id: selectedAgency,
        session_date: dateStr,
        lottery_system_id: system.lottery_system_id,
        sales_bs: Number(system.sales_bs) || 0,
        sales_usd: Number(system.sales_usd) || 0,
        prizes_bs: Number(system.prizes_bs) || 0,
        prizes_usd: Number(system.prizes_usd) || 0
      }));
      
      const conDatosCount = detailsData.filter(d => d.sales_bs > 0 || d.prizes_bs > 0 || d.sales_usd > 0 || d.prizes_usd > 0).length;
      console.log('[onSubmit] Preparando guardado:', {
        totalSystems: detailsData.length,
        conDatos: conDatosCount
      });

      // Eliminar detalles existentes para evitar duplicados
      await supabase.from('encargada_cuadre_details').delete().eq('agency_id', selectedAgency).eq('session_date', dateStr).eq('user_id', user.id);

      // Insertar nuevos detalles
      const {
        error: detailsError
      } = await supabase.from('encargada_cuadre_details').insert(detailsData);
      if (detailsError) throw detailsError;

      // Calcular totales para el resumen
      const totals = data.systems.reduce((acc, system) => ({
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

      // NOTA:
      // Antes se volvía a guardar encargada_cuadre_details consolidando subcategorías al sistema padre.
      // Eso hacía que, al recargar, los inputs (que usan IDs de subcategorías) quedaran vacíos.
      // Ya guardamos arriba (detailsData) con los mismos lottery_system_id que usa el formulario, que es lo correcto.

      toast({
        title: 'Éxito',
        description: editMode ? 'Cuadre actualizado correctamente' : 'Cuadre registrado correctamente'
      });

      // Limpiar borrador tras guardar
      clearDraft();
      setEditMode(true);

      // Recargar desde BD para que el formulario quede exactamente con lo persistido
      // (esto evita “borrados” visuales por desincronización entre inputValues y RHF).
      lastLoadedKeyRef.current = null;
      await loadAgencyData();
      
      // Incrementar refreshKey para actualizar otros componentes dependientes (resumen, etc.)
      setRefreshKey(prev => prev + 1);
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
              
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="bolivares">Ventas/Premios Bs</TabsTrigger>
                  <TabsTrigger value="dolares">Ventas/Premios USD</TabsTrigger>
                </TabsList>

                <TabsContent value="bolivares" className="space-y-4">
                  <VentasPremiosBolivaresEncargada key={`bs-${dataVersion}`} form={form} lotteryOptions={lotteryOptions} />
                </TabsContent>

                <TabsContent value="dolares" className="space-y-4">
                  <VentasPremiosDolaresEncargada key={`usd-${dataVersion}`} form={form} lotteryOptions={lotteryOptions} />
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
    </div>;
};