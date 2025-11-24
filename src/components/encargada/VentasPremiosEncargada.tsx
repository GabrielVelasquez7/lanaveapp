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
});

const ventasPremiosSchema = z.object({
  systems: z.array(systemEntrySchema),
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
  
  // System sync states
  const [isSystemSyncModalOpen, setIsSystemSyncModalOpen] = useState(false);
  const [isUpdatingFields, setIsUpdatingFields] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

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
      systems: [],
    },
  });

  // Persist form by user + agency + date to avoid losing values on navigation/tab switch
  const persistKey = user ? `enc:ventas-premios:${user.id}:${selectedAgency || 'na'}:${format(selectedDate, 'yyyy-MM-dd')}` : null;
  const { clearDraft } = useFormPersist<VentasPremiosForm>(persistKey, form);

  // Cargar agencias y sistemas de lotería
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const [agenciesResult, systemsResult] = await Promise.all([
          supabase
            .from('agencies')
            .select('id, name')
            .eq('is_active', true)
            .order('name'),
          supabase
            .from('lottery_systems')
            .select('id, name, code, has_subcategories, parent_system_id')
            .eq('is_active', true)
            .order('name')
        ]);

        if (agenciesResult.error) throw agenciesResult.error;
        if (systemsResult.error) throw systemsResult.error;

        setAgencies(agenciesResult.data || []);
        
        // Expandir sistemas con subcategorías para la encargada
        const allSystems = systemsResult.data || [];
        const parentSystems = allSystems.filter(s => !s.parent_system_id);
        const subcategories = allSystems.filter(s => s.parent_system_id);
        
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
          variant: 'destructive',
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
      form.reset({ systems: [] });
      
      loadAgencyData();
    }
    
    // Cleanup function
    return () => {
      setLoading(false);
    };
  }, [selectedAgency, selectedDate, lotteryOptions]);

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
        prizes_usd: 0,
      }));

      // ========== PASO 1: PRIORIDAD 1 - Buscar datos YA MODIFICADOS por encargada ==========
      let { data: details } = await supabase
        .from('encargada_cuadre_details')
        .select('*')
        .eq('agency_id', selectedAgency)
        .eq('session_date', dateStr)
        .eq('user_id', user.id); // Datos de ESTA encargada específicamente

      // ========== PASO 2: Si hay datos de encargada, usarlos directamente ==========
      if (details && details.length > 0) {
        console.log('✅ Cargando datos ya modificados por encargada:', details.length);
        
        const systemsWithData = systemsData.map(system => {
          const detail = details?.find(d => d.lottery_system_id === system.lottery_system_id);
          return {
            ...system,
            sales_bs: detail ? Number(detail.sales_bs || 0) : 0,
            sales_usd: detail ? Number(detail.sales_usd || 0) : 0,
            prizes_bs: detail ? Number(detail.prizes_bs || 0) : 0,
            prizes_usd: detail ? Number(detail.prizes_usd || 0) : 0,
          };
        });

        form.setValue('systems', systemsWithData);
        setEditMode(true); // Ya fueron editados
        setCurrentCuadreId(details[0]?.id || null);
        return; // Salir aquí
      }

      // ========== PASO 3: PRIORIDAD 2 - No hay datos de encargada, buscar de TAQUILLERAS ==========
      console.log('🔍 No hay datos de encargada, buscando datos de taquilleras...');

      // 3a. Encontrar TODAS las taquilleras de esta agencia
      const { data: taquilleras, error: taquillerasError } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('agency_id', selectedAgency)
        .eq('role', 'taquillero')
        .eq('is_active', true);

      if (taquillerasError) {
        console.error('Error buscando taquilleras:', taquillerasError);
        throw taquillerasError;
      }

      if (!taquilleras || taquilleras.length === 0) {
        console.log('⚠️ No hay taquilleras asignadas a esta agencia');
        form.setValue('systems', systemsData); // Inicializar vacío
        setEditMode(false);
        setCurrentCuadreId(null);
        return;
      }

      console.log(`📋 Encontradas ${taquilleras.length} taquillera(s) en esta agencia:`, {
        taquilleras: taquilleras.map(t => t.user_id),
        agencia: selectedAgency,
        fecha: dateStr
      });

      const taquilleraIds = taquilleras.map(t => t.user_id);

      // 3b. Buscar TODAS las sesiones de esas taquilleras para esta fecha
      // IMPORTANTE: Buscar sesiones sin importar si están cerradas o no
      const { data: sessions, error: sessionsError } = await supabase
        .from('daily_sessions')
        .select('id, user_id, is_closed')
        .eq('session_date', dateStr)
        .in('user_id', taquilleraIds); // Múltiples taquilleras

      if (sessionsError) {
        console.error('Error buscando sesiones:', sessionsError);
        throw sessionsError;
      }

      if (!sessions || sessions.length === 0) {
        console.log('⚠️ No hay sesiones de taquilleras para esta fecha');
        form.setValue('systems', systemsData); // Inicializar vacío
        setEditMode(false);
        setCurrentCuadreId(null);
        return;
      }

      console.log(`📅 Encontradas ${sessions.length} sesión(es) para esta fecha:`, {
        cerradas: sessions.filter(s => s.is_closed).length,
        abiertas: sessions.filter(s => !s.is_closed).length
      });

      const sessionIds = sessions.map(s => s.id);

      // 3c. Obtener TODAS las transacciones de ventas de TODAS las sesiones
      const { data: sales, error: salesError } = await supabase
        .from('sales_transactions')
        .select('lottery_system_id, amount_bs, amount_usd')
        .in('session_id', sessionIds); // Todas las sesiones

      if (salesError) {
        console.error('Error obteniendo ventas:', salesError);
        throw salesError;
      }

      // 3d. Obtener TODAS las transacciones de premios de TODAS las sesiones
      const { data: prizes, error: prizesError } = await supabase
        .from('prize_transactions')
        .select('lottery_system_id, amount_bs, amount_usd')
        .in('session_id', sessionIds); // Todas las sesiones

      if (prizesError) {
        console.error('Error obteniendo premios:', prizesError);
        throw prizesError;
      }

      // Log detallado de transacciones encontradas
      const ventasConMonto = sales?.filter(s => Number(s.amount_bs || 0) > 0 || Number(s.amount_usd || 0) > 0) || [];
      const premiosConMonto = prizes?.filter(p => Number(p.amount_bs || 0) > 0 || Number(p.amount_usd || 0) > 0) || [];
      
      console.log('💰 Transacciones encontradas:', {
        ventas: sales?.length || 0,
        ventasConMonto: ventasConMonto.length,
        premios: prizes?.length || 0,
        premiosConMonto: premiosConMonto.length,
        sessionIds: sessionIds.length,
        muestraTransacciones: ventasConMonto.slice(0, 3).map(s => ({
          sistema: s.lottery_system_id,
          bs: s.amount_bs,
          usd: s.amount_usd
        })),
        detalles: {
          ventasPorSesion: sessionIds.map(sid => ({
            sessionId: sid,
            count: sales?.filter(s => s.session_id === sid).length || 0,
            conMonto: sales?.filter(s => s.session_id === sid && (Number(s.amount_bs || 0) > 0 || Number(s.amount_usd || 0) > 0)).length || 0
          })),
          premiosPorSesion: sessionIds.map(sid => ({
            sessionId: sid,
            count: prizes?.filter(p => p.session_id === sid).length || 0,
            conMonto: prizes?.filter(p => p.session_id === sid && (Number(p.amount_bs || 0) > 0 || Number(p.amount_usd || 0) > 0)).length || 0
          }))
        }
      });

      // 3e. CONSOLIDAR: Agrupar y sumar por sistema de lotería
      const groupedData = systemsData.map(system => {
        const systemSales = sales?.filter(s => s.lottery_system_id === system.lottery_system_id) || [];
        const systemPrizes = prizes?.filter(p => p.lottery_system_id === system.lottery_system_id) || [];

        const totalSalesBs = systemSales.reduce((sum, s) => sum + Number(s.amount_bs || 0), 0);
        const totalSalesUsd = systemSales.reduce((sum, s) => sum + Number(s.amount_usd || 0), 0);
        const totalPrizesBs = systemPrizes.reduce((sum, p) => sum + Number(p.amount_bs || 0), 0);
        const totalPrizesUsd = systemPrizes.reduce((sum, p) => sum + Number(p.amount_usd || 0), 0);

        return {
          lottery_system_id: system.lottery_system_id,
          lottery_system_name: system.lottery_system_name,
          sales_bs: totalSalesBs,
          sales_usd: totalSalesUsd,
          prizes_bs: totalPrizesBs,
          prizes_usd: totalPrizesUsd,
        };
      });

      const totalSalesBs = groupedData.reduce((sum, s) => sum + s.sales_bs, 0);
      const totalPrizesBs = groupedData.reduce((sum, p) => sum + p.prizes_bs, 0);
      
      const totalSalesUsd = groupedData.reduce((sum, s) => sum + s.sales_usd, 0);
      const totalPrizesUsd = groupedData.reduce((sum, p) => sum + p.prizes_usd, 0);
      
      console.log('✅ Datos consolidados de taquilleras:', {
        sistemas: groupedData.length,
        totalSalesBs,
        totalSalesUsd,
        totalPrizesBs,
        totalPrizesUsd,
        sistemasConDatosBs: groupedData.filter(s => s.sales_bs > 0 || s.prizes_bs > 0).length,
        sistemasConDatosUsd: groupedData.filter(s => s.sales_usd > 0 || s.prizes_usd > 0).length,
        sistemasConDatos: groupedData.filter(s => s.sales_bs > 0 || s.prizes_bs > 0 || s.sales_usd > 0 || s.prizes_usd > 0).length,
        detallePorSistema: groupedData
          .filter(s => s.sales_bs > 0 || s.prizes_bs > 0 || s.sales_usd > 0 || s.prizes_usd > 0)
          .map(s => ({
            sistema: s.lottery_system_name,
            ventasBs: s.sales_bs,
            ventasUsd: s.sales_usd,
            premiosBs: s.prizes_bs,
            premiosUsd: s.prizes_usd
          }))
      });

      // Si no hay datos pero hay sesiones, mostrar advertencia
      if (totalSalesBs === 0 && totalPrizesBs === 0 && totalSalesUsd === 0 && totalPrizesUsd === 0 && sessions.length > 0) {
        console.warn('⚠️ Hay sesiones pero no hay transacciones. Verificar que las transacciones tengan session_id correcto.');
      }

      // Forzar actualización del formulario con todos los valores (Bs y USD)
      form.setValue('systems', groupedData, { shouldDirty: false, shouldValidate: false });
      
      // Forzar re-render de los componentes hijos
      form.trigger('systems');
      setEditMode(false); // No editados aún por encargada
      setCurrentCuadreId(null);

    } catch (error) {
      console.error('Error loading agency data:', error);
      const systemsData: SystemEntry[] = lotteryOptions.map(system => ({
        lottery_system_id: system.id,
        lottery_system_name: system.name,
        sales_bs: 0,
        sales_usd: 0,
        prizes_bs: 0,
        prizes_usd: 0,
      }));
      form.reset({ systems: systemsData });
      setEditMode(false);
      setCurrentCuadreId(null);
    } finally {
      setLoading(false);
    }
  };

  const calculateTotals = useCallback(() => {
    const systems = form.watch('systems');
    return systems.reduce(
      (acc, system) => ({
        sales_bs: acc.sales_bs + (system.sales_bs || 0),
        sales_usd: acc.sales_usd + (system.sales_usd || 0),
        prizes_bs: acc.prizes_bs + (system.prizes_bs || 0),
        prizes_usd: acc.prizes_usd + (system.prizes_usd || 0),
      }),
      { sales_bs: 0, sales_usd: 0, prizes_bs: 0, prizes_usd: 0 }
    );
  }, [form]);

  const onSubmit = async (data: VentasPremiosForm) => {
    if (!user || !selectedDate || !selectedAgency) return;

    const dateStr = formatDateForDB(selectedDate);

    setLoading(true);
    try {
      // Filtrar sistemas con datos
      const systemsWithData = data.systems.filter(
        system => system.sales_bs > 0 || system.sales_usd > 0 || system.prizes_bs > 0 || system.prizes_usd > 0
      );

      if (systemsWithData.length === 0) {
        toast({
          title: 'Error',
          description: 'Debe ingresar al menos un monto',
          variant: 'destructive',
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
        prizes_usd: system.prizes_usd,
      }));

      // Eliminar detalles existentes para evitar duplicados
      await supabase
        .from('encargada_cuadre_details')
        .delete()
        .eq('agency_id', selectedAgency)
        .eq('session_date', dateStr)
        .eq('user_id', user.id);

      // Insertar nuevos detalles
      const { error: detailsError } = await supabase
        .from('encargada_cuadre_details')
        .insert(detailsData);

      if (detailsError) throw detailsError;

      // Calcular totales para el resumen
      const totals = systemsWithData.reduce(
        (acc, system) => ({
          sales_bs: acc.sales_bs + system.sales_bs,
          sales_usd: acc.sales_usd + system.sales_usd,
          prizes_bs: acc.prizes_bs + system.prizes_bs,
          prizes_usd: acc.prizes_usd + system.prizes_usd,
        }),
        { sales_bs: 0, sales_usd: 0, prizes_bs: 0, prizes_usd: 0 }
      );

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
        exchange_rate: 36,
      };

      // Deterministic merge to avoid ON CONFLICT affecting row twice
      const { data: existingSummary, error: findSummaryError } = await supabase
        .from('daily_cuadres_summary')
        .select('id')
        .eq('user_id', user.id)
        .eq('agency_id', selectedAgency)
        .eq('session_date', dateStr)
        .is('session_id', null)
        .maybeSingle();

      if (findSummaryError) throw findSummaryError;

      let summaryError = null as any;
      if (existingSummary?.id) {
        const { error: updateErr } = await supabase
          .from('daily_cuadres_summary')
          .update(summaryRow)
          .eq('id', existingSummary.id);
        summaryError = updateErr || null;
      } else {
        const { error: insertErr } = await supabase
          .from('daily_cuadres_summary')
          .insert(summaryRow);
        summaryError = insertErr || null;
      }

      if (summaryError) throw summaryError;

      toast({
        title: 'Éxito',
        description: editMode 
          ? 'Cuadre actualizado correctamente'
          : 'Cuadre registrado correctamente',
      });

      // Limpiar borrador tras guardar
      clearDraft();

      setEditMode(true);
      
      // NO recargar datos, mantener los valores en el formulario para que sean visibles

    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Error al procesar los cuadres',
        variant: 'destructive',
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
        variant: "destructive",
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
      'PREMIER': lotteryOptions.find(s => s.code === 'PREMIER'),
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
        const systemIndex = updatedSystems.findIndex(
          s => s.lottery_system_id === lotterySystem.id
        );

        const salesBs = Number(currentAgencyResult.sales) || 0;
        const prizesBs = Number(currentAgencyResult.prizes) || 0;

        if (systemIndex !== -1) {
          updatedSystems[systemIndex] = {
            ...updatedSystems[systemIndex],
            sales_bs: salesBs,
            prizes_bs: prizesBs,
          };
        } else {
          // Ensure an entry exists if it wasn't initialized yet
          updatedSystems.push({
            lottery_system_id: lotterySystem.id,
            lottery_system_name: lotterySystem.name,
            sales_bs: salesBs,
            sales_usd: 0,
            prizes_bs: prizesBs,
            prizes_usd: 0,
          });
        }
      }
    });

    // Update form with all synchronized data and mark as dirty to re-render
    form.setValue('systems', updatedSystems as any, { shouldDirty: true, shouldValidate: false });

    // Show summary toast
    const successfulSyncs = results.filter(r => r.success);
    if (successfulSyncs.length > 0) {
      toast({
        title: 'Campos actualizados',
        description: `${successfulSyncs.map(r => r.systemName).join(', ')} sincronizados correctamente. Revisa los valores y guarda cuando estés listo.`,
      });
    }
    
    setIsUpdatingFields(false);
  };

  const totals = calculateTotals();
  const selectedAgencyName = agencies.find(a => a.id === selectedAgency)?.name || '';

  return (
    <div className="space-y-6">
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
                {agencies.map((agency) => (
                  <SelectItem key={agency.id} value={agency.id}>
                    {agency.name}
                  </SelectItem>
                ))}
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
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !selectedDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {selectedDate ? format(selectedDate, "PPP", { locale: es }) : "Seleccionar fecha"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => date && setSelectedDate(date)}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
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
            <Button 
              onClick={handleSyncSystems}
              disabled={!selectedAgency || !selectedDate}
              className="w-full"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Sincronizar Sistemas
            </Button>
          </CardContent>
        </Card>
      </div>

      {selectedAgency && (
        <Tabs value={mainTab} onValueChange={setMainTab} className="space-y-6">
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
                      <p className={`text-2xl font-bold ${(totals.sales_bs - totals.prizes_bs) >= 0 ? 'text-success' : 'text-destructive'}`}>
                        {formatCurrency(totals.sales_bs - totals.prizes_bs, 'VES')}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Cuadre USD</p>
                      <p className={`text-2xl font-bold ${(totals.sales_usd - totals.prizes_usd) >= 0 ? 'text-success' : 'text-destructive'}`}>
                        {formatCurrency(totals.sales_usd - totals.prizes_usd, 'USD')}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Sub-tabs para ventas/premios */}
            <div className="relative">
              {isUpdatingFields && (
                <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-10 rounded-lg">
                  <div className="text-center p-6">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto mb-3 text-primary" />
                    <p className="text-sm font-medium text-foreground">Actualizando campos con datos de MaxPlayGo</p>
                    <p className="text-xs text-muted-foreground mt-1">Por favor espere...</p>
                  </div>
                </div>
              )}
              
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="bolivares">Ventas/Premios Bs</TabsTrigger>
                  <TabsTrigger value="dolares">Ventas/Premios USD</TabsTrigger>
                </TabsList>

                <TabsContent value="bolivares" className="space-y-4">
                  <VentasPremiosBolivaresEncargada 
                    form={form} 
                    lotteryOptions={lotteryOptions}
                  />
                </TabsContent>

                <TabsContent value="dolares" className="space-y-4">
                  <VentasPremiosDolaresEncargada 
                    form={form} 
                    lotteryOptions={lotteryOptions}
                  />
                </TabsContent>
              </Tabs>
            </div>

            {/* Botón de guardar */}
            <div className="flex justify-center">
              <Button 
                onClick={form.handleSubmit(onSubmit)} 
                disabled={loading} 
                size="lg"
                className="min-w-[200px]"
              >
                {loading ? 'Procesando...' : editMode ? 'Actualizar Cuadre' : 'Registrar Cuadre'}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="gastos" className="space-y-6">
            <GastosManagerEncargada 
              onSuccess={refreshData} 
              selectedAgency={selectedAgency}
              selectedDate={selectedDate}
            />
          </TabsContent>

          <TabsContent value="pago-movil" className="space-y-6">
            <PagoMovilManagerEncargada 
              onSuccess={refreshData} 
              selectedAgency={selectedAgency}
              selectedDate={selectedDate}
            />
          </TabsContent>

          <TabsContent value="punto-venta" className="space-y-6">
            <PointOfSaleFormEncargada 
              selectedAgency={selectedAgency}
              selectedDate={selectedDate}
              onSuccess={refreshData}
            />
          </TabsContent>

          <TabsContent value="resumen" className="space-y-6">
            <CuadreGeneralEncargada 
              selectedAgency={selectedAgency}
              selectedDate={selectedDate}
            />
          </TabsContent>
        </Tabs>
      )}

      {/* System Sync Manager Modal */}
      {selectedAgency && selectedDate && (
        <SystemSyncManager
          isOpen={isSystemSyncModalOpen}
          onClose={() => setIsSystemSyncModalOpen(false)}
          targetDate={format(selectedDate, 'dd-MM-yyyy')}
          onSuccess={handleSyncSuccess}
        />
      )}
    </div>
  );
};