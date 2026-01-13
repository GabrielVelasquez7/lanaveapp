import { useState, useEffect, useMemo, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { BanqueoVentasPremiosBolivares } from '@/components/admin/BanqueoVentasPremiosBolivares';
import { BanqueoVentasPremiosDolares } from '@/components/admin/BanqueoVentasPremiosDolares';
import { useSystemCommissions } from '@/hooks/useSystemCommissions';
import { Building2, CalendarIcon, DollarSign, ChevronLeft, ChevronRight, Users, TrendingUp, Award, Coins, Banknote, Trash2 } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { formatDateForDB } from '@/lib/dateUtils';
import { format, startOfWeek, endOfWeek, addWeeks } from 'date-fns';
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

const banqueoSchema = z.object({
  systems: z.array(systemEntrySchema),
});

export type BanqueoForm = z.infer<typeof banqueoSchema>;
export type SystemEntry = z.infer<typeof systemEntrySchema>;

interface LotterySystem {
  id: string;
  name: string;
  code: string;
}

interface Client {
  id: string;
  name: string;
}

export const BanqueoEncargada = () => {
  const [currencyTab, setCurrencyTab] = useState('bolivares');
  const [commissionView, setCommissionView] = useState<'agencies' | 'clients'>('clients');
  const [lotteryOptions, setLotteryOptions] = useState<LotterySystem[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [agencies, setAgencies] = useState<Client[]>([]);
  const [participationPercentage, setParticipationPercentage] = useState<number>(0);
  const [participation2Percentage, setParticipation2Percentage] = useState<number>(0);
  const [clientPaymentStatus, setClientPaymentStatus] = useState<Map<string, { paid_bs: boolean; paid_usd: boolean }>>(new Map());
  const [clientLanaveParticipation, setClientLanaveParticipation] = useState<Map<string, { lanave_participation_bs: number; lanave_participation_usd: number }>>(new Map());
  const [clientSystemConfigs, setClientSystemConfigs] = useState<Map<string, Map<string, { commission_bs: number; commission_usd: number; participation_bs: number; participation_usd: number; lanave_participation_bs: number; lanave_participation_usd: number }>>>(new Map());
  const [banqueoConfigLoading, setBanqueoConfigLoading] = useState(true);
  
  // Persistir cliente y semana seleccionada en localStorage
  const [selectedClient, setSelectedClient] = useState<string>(() => {
    const saved = localStorage.getItem('banqueo:selectedClient');
    return saved || '';
  });
  
  const [currentWeek, setCurrentWeek] = useState<{ start: Date; end: Date }>(() => {
    const saved = localStorage.getItem('banqueo:currentWeek');
    if (saved) {
      const { start, end } = JSON.parse(saved);
      return { start: new Date(start), end: new Date(end) };
    }
    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
    return { start: weekStart, end: weekEnd };
  });
  
  const [loading, setLoading] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();
  const { commissions, loading: commissionsLoading } = useSystemCommissions();

  // Guardar cliente seleccionado en localStorage cuando cambie
  useEffect(() => {
    if (selectedClient) {
      localStorage.setItem('banqueo:selectedClient', selectedClient);
    }
  }, [selectedClient]);

  // Guardar semana seleccionada en localStorage cuando cambie
  useEffect(() => {
    localStorage.setItem('banqueo:currentWeek', JSON.stringify({
      start: currentWeek.start.toISOString(),
      end: currentWeek.end.toISOString(),
    }));
  }, [currentWeek]);

  const form = useForm<BanqueoForm>({
    resolver: zodResolver(banqueoSchema),
    defaultValues: {
      systems: [],
    },
  });

  // Persist form by user + client + week to avoid losing values on navigation/tab switch
  const persistKey = user && selectedClient 
    ? `banqueo-enc:form:${user.id}:${selectedClient}:${format(currentWeek.start, 'yyyy-MM-dd')}` 
    : null;
  const { clearDraft } = useFormPersist<BanqueoForm>(persistKey, form);

  // Track if we've loaded data for the current client+week to avoid overwriting persisted values
  const lastLoadedKeyRef = useRef<string | null>(null);

  // Cargar comisiones de banqueo
  useEffect(() => {
    const fetchBanqueoConfig = async () => {
      try {
        setBanqueoConfigLoading(true);
        const { data, error } = await supabase
          .from('banqueo_commission_config')
          .select('client_commission_percentage, lanave_commission_percentage')
          .limit(1)
          .maybeSingle();

        if (error) throw error;

        if (data) {
          setParticipationPercentage(Number(data.client_commission_percentage) || 0);
          setParticipation2Percentage(Number(data.lanave_commission_percentage) || 0);
        }
      } catch (error: any) {
        console.error('Error loading banqueo config:', error);
        toast({
          title: 'Error',
          description: 'No se pudieron cargar las comisiones de banqueo',
          variant: 'destructive',
        });
      } finally {
        setBanqueoConfigLoading(false);
      }
    };

    fetchBanqueoConfig();
  }, [toast]);

  // Cargar clientes, agencias y sistemas de lotería
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        // Cargar clientes
        const { data: clientsData, error: clientsError } = await supabase
          .from('clients')
          .select('id, name')
          .eq('is_active', true)
          .order('name');

        if (clientsError) throw clientsError;
        setClients(clientsData || []);

        // Cargar agencias
        const { data: agenciesData, error: agenciesError } = await supabase
          .from('agencies')
          .select('id, name')
          .eq('is_active', true)
          .order('name');

        if (agenciesError) throw agenciesError;
        setAgencies(agenciesData || []);

        // Cargar sistemas de lotería (solo subcategorías y padres sin hijos)
        const { data: systemsData, error: systemsError } = await supabase
          .from('lottery_systems')
          .select('id, name, code, parent_system_id, has_subcategories')
          .eq('is_active', true)
          .order('name');

        if (systemsError) throw systemsError;
        
        // Filtrar: mostrar subcategorías y padres que no tienen subcategorías
        const filteredSystems = (systemsData || []).filter(system => {
          // Si es subcategoría, mostrar
          if (system.parent_system_id) return true;
          // Si es padre, solo mostrar si no tiene subcategorías
          return !system.has_subcategories;
        });
        
        setLotteryOptions(filteredSystems);
      } catch (error: any) {
        toast({
          title: 'Error',
          description: error.message || 'No se pudieron cargar los datos iniciales',
          variant: 'destructive',
        });
      }
    };

    fetchInitialData();
  }, [toast]);

  // Cargar datos cuando cambie el cliente o la semana
  // Usa lastLoadedKeyRef para evitar recargar datos innecesariamente
  useEffect(() => {
    if (!selectedClient || !currentWeek || lotteryOptions.length === 0) return;

    const currentKey = `${selectedClient}:${format(currentWeek.start, 'yyyy-MM-dd')}`;
    const keyChanged = lastLoadedKeyRef.current !== currentKey;

    if (keyChanged) {
      // Resetear el formulario antes de cargar nuevos datos
      const emptySystemsData: SystemEntry[] = lotteryOptions.map(system => ({
        lottery_system_id: system.id,
        lottery_system_name: system.name,
        sales_bs: 0,
        sales_usd: 0,
        prizes_bs: 0,
        prizes_usd: 0,
      }));
      form.reset({ systems: emptySystemsData });
      
      lastLoadedKeyRef.current = currentKey;
      loadClientData();
      loadClientCommissionData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClient, currentWeek, lotteryOptions.length]);

  // Cargar comisiones y participaciones del cliente
  const loadClientCommissionData = async () => {
    if (!selectedClient) return;

    try {
      // Cargar participación de Lanave del cliente
      const { data: lanaveData, error: lanaveError } = await supabase
        .from('client_banqueo_commissions')
        .select('*')
        .eq('client_id', selectedClient)
        .eq('is_active', true)
        .maybeSingle();

      if (lanaveError) throw lanaveError;

      if (lanaveData) {
        const newLanaveParticipation = new Map(clientLanaveParticipation);
        newLanaveParticipation.set(selectedClient, {
          lanave_participation_bs: Number(lanaveData.lanave_participation_percentage_bs || 0),
          lanave_participation_usd: Number(lanaveData.lanave_participation_percentage_usd || 0),
        });
        setClientLanaveParticipation(newLanaveParticipation);
        // Actualizar participación de Lanave si existe configuración del cliente
        setParticipation2Percentage(Number(lanaveData.lanave_participation_percentage_bs || participation2Percentage));
      }

      // Cargar comisiones y participaciones por sistema del cliente
      // Cargar comisiones y participaciones por sistema del cliente - solo para sistemas ACTIVOS
      const { data: systemConfigsData, error: systemConfigsError } = await supabase
        .from('client_system_participation')
        .select('*, lottery_systems!inner(id, is_active)')
        .eq('client_id', selectedClient)
        .eq('is_active', true)
        .eq('lottery_systems.is_active', true);

      if (systemConfigsError) throw systemConfigsError;

      const systemConfigsMap = new Map<string, { commission_bs: number; commission_usd: number; participation_bs: number; participation_usd: number; lanave_participation_bs: number; lanave_participation_usd: number }>();
      systemConfigsData?.forEach((config) => {
        systemConfigsMap.set(config.lottery_system_id, {
          commission_bs: Number(config.client_commission_percentage_bs || 0),
          commission_usd: Number(config.client_commission_percentage_usd || 0),
          participation_bs: Number(config.participation_percentage_bs || 0),
          participation_usd: Number(config.participation_percentage_usd || 0),
          lanave_participation_bs: Number(config.lanave_participation_percentage_bs || 0),
          lanave_participation_usd: Number(config.lanave_participation_percentage_usd || 0),
        });
      });

      const newClientSystemConfigs = new Map(clientSystemConfigs);
      newClientSystemConfigs.set(selectedClient, systemConfigsMap);
      setClientSystemConfigs(newClientSystemConfigs);
    } catch (error: any) {
      console.error('Error loading client commission data:', error);
    }
  };

  // Cargar estado de pago de todos los clientes cuando cambie la semana
  useEffect(() => {
    if (currentWeek) {
      loadAllClientsPaymentStatus();
    }
  }, [currentWeek]);

  const loadAllClientsPaymentStatus = async () => {
    const weekStartStr = formatDateForDB(currentWeek.start);
    const weekEndStr = formatDateForDB(currentWeek.end);
    
    try {
      const { data, error } = await supabase
        .from('banqueo_transactions')
        .select('client_id, paid_bs, paid_usd')
        .eq('week_start_date', weekStartStr)
        .eq('week_end_date', weekEndStr);

      if (error) throw error;

      const statusMap = new Map<string, { paid_bs: boolean; paid_usd: boolean }>();
      data?.forEach(transaction => {
        if (!statusMap.has(transaction.client_id)) {
          statusMap.set(transaction.client_id, {
            paid_bs: transaction.paid_bs,
            paid_usd: transaction.paid_usd
          });
        }
      });

      setClientPaymentStatus(statusMap);
    } catch (error: any) {
      console.error('Error loading payment status:', error);
    }
  };

  const loadClientData = async () => {
    if (!user || !selectedClient || !currentWeek) return;

    const weekStartStr = formatDateForDB(currentWeek.start);
    const weekEndStr = formatDateForDB(currentWeek.end);
    
    // Verificar si hay valores persistidos en localStorage SOLO para esta semana
    const storageKey = `banqueo-enc:form:${user.id}:${selectedClient}:${format(currentWeek.start, 'yyyy-MM-dd')}`;
    
    // Primero verificar si ya hay datos registrados en BD
    const { data: existingTransactions } = await supabase
      .from('banqueo_transactions')
      .select('id, paid_bs, paid_usd')
      .eq('client_id', selectedClient)
      .eq('week_start_date', weekStartStr)
      .eq('week_end_date', weekEndStr)
      .limit(1);
    
    const hasDataInDB = existingTransactions && existingTransactions.length > 0;
    
    // Si hay datos en BD, limpiar localStorage para esta semana (ya está registrado)
    if (hasDataInDB) {
      try {
        localStorage.removeItem(storageKey);
      } catch (e) {
        // Ignore
      }
      // Actualizar estado de pago del cliente
      setClientPaymentStatus(prev => {
        const newMap = new Map(prev);
        newMap.set(selectedClient, {
          paid_bs: existingTransactions[0].paid_bs || false,
          paid_usd: existingTransactions[0].paid_usd || false
        });
        return newMap;
      });
    }
    
    // Solo usar localStorage si NO hay datos en BD
    let hasPersistedData = false;
    if (!hasDataInDB) {
      try {
        const persisted = localStorage.getItem(storageKey);
        if (persisted) {
          const parsed = JSON.parse(persisted);
          if (parsed && parsed.systems && Array.isArray(parsed.systems) && parsed.systems.length > 0) {
            hasPersistedData = parsed.systems.some((s: SystemEntry) => 
              (s.sales_bs || 0) > 0 || (s.sales_usd || 0) > 0 || (s.prizes_bs || 0) > 0 || (s.prizes_usd || 0) > 0
            );
          }
        }
      } catch (e) {
        // Ignore localStorage errors
      }
    }

    // Si hay datos persistidos y NO hay datos en BD, usar localStorage
    if (hasPersistedData && !hasDataInDB) {
      setEditMode(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    
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

      // Buscar datos existentes de banqueo_transactions
      const { data: transactions, error: transactionsError } = await supabase
        .from('banqueo_transactions')
        .select('*')
        .eq('client_id', selectedClient)
        .eq('week_start_date', weekStartStr)
        .eq('week_end_date', weekEndStr);

      if (transactionsError) {
        console.error('Error buscando transacciones:', transactionsError);
        throw transactionsError;
      }

      if (transactions && transactions.length > 0) {
        // Hay datos existentes, cargarlos en el formulario
        const systemsWithData = systemsData.map(system => {
          const transaction = transactions.find(t => t.lottery_system_id === system.lottery_system_id);
          if (transaction) {
            return {
              ...system,
              sales_bs: Number(transaction.sales_bs || 0),
              sales_usd: Number(transaction.sales_usd || 0),
              prizes_bs: Number(transaction.prizes_bs || 0),
              prizes_usd: Number(transaction.prizes_usd || 0),
            };
          }
          return system;
        });

        // Cargar participation_percentage y participation2_percentage del primer registro
        if (transactions[0]?.participation_percentage) {
          setParticipationPercentage(Number(transactions[0].participation_percentage) || 0);
        }
        if (transactions[0]?.participation2_percentage) {
          setParticipation2Percentage(Number(transactions[0].participation2_percentage) || 0);
        }

        // Actualizar estado de pago del cliente
        if (transactions[0]) {
          setClientPaymentStatus(prev => {
            const newMap = new Map(prev);
            newMap.set(selectedClient, {
              paid_bs: transactions[0].paid_bs || false,
              paid_usd: transactions[0].paid_usd || false
            });
            return newMap;
          });
        }

        form.setValue('systems', systemsWithData);
        setEditMode(true);
      } else {
        // No hay datos, inicializar vacío
        form.setValue('systems', systemsData);
        setEditMode(false);
      }
    } catch (error: any) {
      console.error('Error loading client data:', error);
      toast({
        title: 'Error',
        description: error.message || 'Error al cargar los datos del cliente',
        variant: 'destructive',
      });
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
    } finally {
      setLoading(false);
    }
  };

  const systems = form.watch('systems');
  const totals = useMemo(() => {
    type TotalsType = {
      sales_bs: number;
      sales_usd: number;
      prizes_bs: number;
      prizes_usd: number;
      cuadre_bs: number;
      cuadre_usd: number;
      commission_bs: number;
      commission_usd: number;
      subtotal_bs: number;
      subtotal_usd: number;
      participation_bs: number;
      participation_usd: number;
      lanave_participation_bs: number;
      lanave_participation_usd: number;
      final_total_bs: number;
      final_total_usd: number;
    };
    
    const clientSystemConfigsMap = selectedClient ? clientSystemConfigs.get(selectedClient) : null;
    const clientLanaveConfig = selectedClient ? clientLanaveParticipation.get(selectedClient) : null;
    
    return systems.reduce<TotalsType>(
      (acc, system) => {
        const salesBs = system.sales_bs || 0;
        const salesUsd = system.sales_usd || 0;
        const prizesBs = system.prizes_bs || 0;
        const prizesUsd = system.prizes_usd || 0;
        const cuadreBs = salesBs - prizesBs;
        const cuadreUsd = salesUsd - prizesUsd;
        
        // Usar comisión del sistema (ya configurada en sistemas)
        const commissionRate = commissions.get(system.lottery_system_id);
        const commissionPercentageBs = commissionRate?.commission_percentage || 0;
        const commissionPercentageUsd = commissionRate?.commission_percentage_usd || 0;
        const commissionBs = salesBs * (commissionPercentageBs / 100);
        const commissionUsd = salesUsd * (commissionPercentageUsd / 100);
        const subtotalBs = cuadreBs - commissionBs;
        const subtotalUsd = cuadreUsd - commissionUsd;
        
        // Usar participación específica del sistema del cliente si existe, sino usar la global
        const systemConfig = clientSystemConfigsMap?.get(system.lottery_system_id);
        const participationPercentageBs = systemConfig?.participation_bs || participationPercentage;
        const participationPercentageUsd = systemConfig?.participation_usd || participationPercentage;
        const participationBs = subtotalBs * (participationPercentageBs / 100);
        const participationUsd = subtotalUsd * (participationPercentageUsd / 100);
        
        // Calcular participación de Lanave por sistema
        const lanavePercentageBs = systemConfig?.lanave_participation_bs || clientLanaveConfig?.lanave_participation_bs || 0;
        const lanavePercentageUsd = systemConfig?.lanave_participation_usd || clientLanaveConfig?.lanave_participation_usd || 0;
        const lanaveParticipationBs = subtotalBs * (lanavePercentageBs / 100);
        const lanaveParticipationUsd = subtotalUsd * (lanavePercentageUsd / 100);
        
        const finalTotalBs = subtotalBs - participationBs;
        const finalTotalUsd = subtotalUsd - participationUsd;
        
        return {
          sales_bs: acc.sales_bs + salesBs,
          sales_usd: acc.sales_usd + salesUsd,
          prizes_bs: acc.prizes_bs + prizesBs,
          prizes_usd: acc.prizes_usd + prizesUsd,
          cuadre_bs: acc.cuadre_bs + cuadreBs,
          cuadre_usd: acc.cuadre_usd + cuadreUsd,
          commission_bs: acc.commission_bs + commissionBs,
          commission_usd: acc.commission_usd + commissionUsd,
          subtotal_bs: acc.subtotal_bs + subtotalBs,
          subtotal_usd: acc.subtotal_usd + subtotalUsd,
          participation_bs: acc.participation_bs + participationBs,
          participation_usd: acc.participation_usd + participationUsd,
          lanave_participation_bs: acc.lanave_participation_bs + lanaveParticipationBs,
          lanave_participation_usd: acc.lanave_participation_usd + lanaveParticipationUsd,
          final_total_bs: acc.final_total_bs + finalTotalBs,
          final_total_usd: acc.final_total_usd + finalTotalUsd,
        };
      },
      { 
        sales_bs: 0, sales_usd: 0, prizes_bs: 0, prizes_usd: 0,
        cuadre_bs: 0, cuadre_usd: 0,
        commission_bs: 0, commission_usd: 0,
        subtotal_bs: 0, subtotal_usd: 0,
        participation_bs: 0, participation_usd: 0,
        lanave_participation_bs: 0, lanave_participation_usd: 0,
        final_total_bs: 0, final_total_usd: 0
      }
    );
  }, [systems, commissions, participationPercentage, selectedClient, clientSystemConfigs, clientLanaveParticipation]);

  const onSubmit = async (data: BanqueoForm) => {
    if (!user || !selectedClient || !currentWeek) return;

    const weekStartStr = formatDateForDB(currentWeek.start);
    const weekEndStr = formatDateForDB(currentWeek.end);

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

      // Eliminar transacciones existentes para esta semana y cliente
      await supabase
        .from('banqueo_transactions')
        .delete()
        .eq('client_id', selectedClient)
        .eq('week_start_date', weekStartStr)
        .eq('week_end_date', weekEndStr);

      // Insertar nuevas transacciones por sistema
      const currentPaymentStatus = clientPaymentStatus.get(selectedClient) || { paid_bs: false, paid_usd: false };
      const transactionsData = systemsWithData.map(system => ({
        client_id: selectedClient,
        week_start_date: weekStartStr,
        week_end_date: weekEndStr,
        lottery_system_id: system.lottery_system_id,
        sales_bs: system.sales_bs,
        sales_usd: system.sales_usd,
        prizes_bs: system.prizes_bs,
        prizes_usd: system.prizes_usd,
        participation_percentage: participationPercentage,
        participation2_percentage: selectedClient ? (clientLanaveParticipation.get(selectedClient)?.lanave_participation_bs || participation2Percentage) : participation2Percentage,
        paid_bs: currentPaymentStatus.paid_bs,
        paid_usd: currentPaymentStatus.paid_usd,
        created_by: user.id,
      }));

      const { error: insertError } = await supabase
        .from('banqueo_transactions')
        .insert(transactionsData);

      if (insertError) throw insertError;

      // Limpiar localStorage después de registrar exitosamente
      clearDraft();
      
      toast({
        title: 'Éxito',
        description: editMode 
          ? 'Datos de banqueo actualizados correctamente'
          : 'Datos de banqueo registrados correctamente',
      });

      setEditMode(true);

    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Error al procesar los datos de banqueo',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const navigateWeek = (direction: 'prev' | 'next') => {
    const newStart = addWeeks(currentWeek.start, direction === 'next' ? 1 : -1);
    const newEnd = endOfWeek(newStart, { weekStartsOn: 1 });
    // Reset lastLoadedKey para forzar recarga de datos
    lastLoadedKeyRef.current = null;
    setCurrentWeek({ start: newStart, end: newEnd });
  };

  // Función para limpiar todos los datos de localStorage de banqueo (encargada)
  const handleClearAllDrafts = () => {
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('banqueo-enc:form:')) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
      
      // Recargar datos
      lastLoadedKeyRef.current = null;
      if (selectedClient && currentWeek && lotteryOptions.length > 0) {
        loadClientData();
      }
      
      toast({
        title: 'Limpieza completada',
        description: `Se limpiaron ${keysToRemove.length} borradores guardados`,
      });
    } catch (e) {
      toast({
        title: 'Error',
        description: 'No se pudieron limpiar los borradores',
        variant: 'destructive',
      });
    }
  };

  const selectedClientName = clients.find(c => c.id === selectedClient)?.name || '';

  const handlePaymentStatusChange = async (clientId: string, field: 'paid_bs' | 'paid_usd', value: boolean) => {
    const weekStartStr = formatDateForDB(currentWeek.start);
    const weekEndStr = formatDateForDB(currentWeek.end);

    try {
      // Actualizar en la base de datos
      const { error } = await supabase
        .from('banqueo_transactions')
        .update({ [field]: value })
        .eq('client_id', clientId)
        .eq('week_start_date', weekStartStr)
        .eq('week_end_date', weekEndStr);

      if (error) throw error;

      // Actualizar estado local
      setClientPaymentStatus(prev => {
        const newMap = new Map(prev);
        const current = newMap.get(clientId) || { paid_bs: false, paid_usd: false };
        newMap.set(clientId, { ...current, [field]: value });
        return newMap;
      });

      toast({
        title: 'Éxito',
        description: 'Estado de pago actualizado',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Error al actualizar estado de pago',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Tabla de Estado de Pagos por Cliente */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Users className="h-5 w-5 mr-2" />
            Estado de Pagos - Semana {format(currentWeek.start, "dd/MM", { locale: es })} - {format(currentWeek.end, "dd/MM/yyyy", { locale: es })}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 font-medium">Cliente</th>
                  <th className="text-center py-3 px-4 font-medium">Pagado BS</th>
                  <th className="text-center py-3 px-4 font-medium">Pagado USD</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((client) => {
                  const status = clientPaymentStatus.get(client.id) || { paid_bs: false, paid_usd: false };
                  return (
                    <tr key={client.id} className="border-b hover:bg-muted/50">
                      <td className="py-3 px-4 font-medium">{client.name}</td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center">
                          <Switch
                            checked={status.paid_bs}
                            onCheckedChange={(checked) => handlePaymentStatusChange(client.id, 'paid_bs', checked)}
                          />
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center">
                          <Switch
                            checked={status.paid_usd}
                            onCheckedChange={(checked) => handlePaymentStatusChange(client.id, 'paid_usd', checked)}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Selectores de Cliente y Semana */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Building2 className="h-5 w-5 mr-2" />
              Seleccionar Cliente
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={selectedClient} onValueChange={setSelectedClient}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecciona un cliente" />
              </SelectTrigger>
              <SelectContent>
                {clients.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.name}
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
              Semana
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => navigateWeek('prev')}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="text-center flex-1">
                <p className="text-sm font-medium">
                  {format(currentWeek.start, "dd/MM/yyyy", { locale: es })} - {format(currentWeek.end, "dd/MM/yyyy", { locale: es })}
                </p>
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={() => navigateWeek('next')}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Botón limpiar borradores */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Trash2 className="h-5 w-5 mr-2" />
              Limpiar Borradores
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              onClick={handleClearAllDrafts}
              className="w-full"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Limpiar todo
            </Button>
            <p className="text-xs text-muted-foreground mt-2">
              Elimina datos no guardados
            </p>
          </CardContent>
        </Card>
      </div>

      {selectedClient && (
        <div className="space-y-6">
          {/* Totalizadores con estilo estándar */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
            {/* Ventas */}
            <Card className="border-2 border-green-500/20 bg-gradient-to-br from-green-500/10 to-green-500/5">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between mb-2">
                  <div className="p-2 bg-green-500/10 rounded-lg">
                    <DollarSign className="h-5 w-5 text-green-600" />
                  </div>
                </div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                  Ventas
                </p>
                <div className="space-y-0.5">
                  <p className="text-xl font-bold text-green-600 font-mono">
                    {formatCurrency(totals.sales_bs, 'VES')}
                  </p>
                  <p className="text-sm font-semibold text-green-600/70 font-mono">
                    {formatCurrency(totals.sales_usd, 'USD')}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Premios */}
            <Card className="border-2 border-red-500/20 bg-gradient-to-br from-red-500/10 to-red-500/5">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between mb-2">
                  <div className="p-2 bg-red-500/10 rounded-lg">
                    <Award className="h-5 w-5 text-red-600" />
                  </div>
                </div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                  Premios
                </p>
                <div className="space-y-0.5">
                  <p className="text-xl font-bold text-red-600 font-mono">
                    {formatCurrency(totals.prizes_bs, 'VES')}
                  </p>
                  <p className="text-sm font-semibold text-red-600/70 font-mono">
                    {formatCurrency(totals.prizes_usd, 'USD')}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Comisiones */}
            <Card className="border-2 border-yellow-500/20 bg-gradient-to-br from-yellow-500/10 to-yellow-500/5">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between mb-2">
                  <div className="p-2 bg-yellow-500/10 rounded-lg">
                    <Award className="h-5 w-5 text-yellow-600" />
                  </div>
                </div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                  Comisiones
                </p>
                <div className="space-y-0.5">
                  <p className="text-xl font-bold text-yellow-600 font-mono">
                    {formatCurrency(totals.commission_bs, 'VES')}
                  </p>
                  <p className="text-sm font-semibold text-yellow-600/70 font-mono">
                    {formatCurrency(totals.commission_usd, 'USD')}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Comisión de Participación */}
            <Card className="border-2 border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 to-emerald-500/5">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between mb-2">
                  <div className="p-2 bg-emerald-500/10 rounded-lg">
                    <TrendingUp className="h-5 w-5 text-emerald-600" />
                  </div>
                </div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                  Comisión de Participación
                </p>
                <div className="space-y-0.5">
                  <p className="text-xl font-bold text-emerald-600 font-mono">
                    {formatCurrency(totals.participation_bs, 'VES')}
                  </p>
                  <p className="text-sm font-semibold text-emerald-600/70 font-mono">
                    {formatCurrency(totals.participation_usd, 'USD')}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Ganancia por Banqueo */}
            <Card className="border-2 border-purple-500/20 bg-gradient-to-br from-purple-500/10 to-purple-500/5">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between mb-2">
                  <div className="p-2 bg-purple-500/10 rounded-lg">
                    <Banknote className="h-5 w-5 text-purple-600" />
                  </div>
                </div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                  Ganancia por Banqueo
                </p>
                <div className="space-y-0.5">
                  <p className="text-xl font-bold text-purple-600 font-mono">
                    {formatCurrency((totals.sales_bs - totals.prizes_bs) + totals.commission_bs + totals.participation_bs, 'VES')}
                  </p>
                  <p className="text-sm font-semibold text-purple-600/70 font-mono">
                    {formatCurrency((totals.sales_usd - totals.prizes_usd) + totals.commission_usd + totals.participation_usd, 'USD')}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Participación de Lanave */}
            <Card className="border-2 border-orange-500/20 bg-gradient-to-br from-orange-500/10 to-orange-500/5">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between mb-2">
                  <div className="p-2 bg-orange-500/10 rounded-lg">
                    <Coins className="h-5 w-5 text-orange-600" />
                  </div>
                </div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                  Participación de Lanave
                </p>
                <div className="space-y-0.5">
                  <p className="text-xl font-bold text-orange-600 font-mono">
                    {formatCurrency(totals.lanave_participation_bs, 'VES')}
                  </p>
                  <p className="text-sm font-semibold text-orange-600/70 font-mono">
                    {formatCurrency(totals.lanave_participation_usd, 'USD')}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

      
          {/* Tabs combinados de Ventas/Premios */}
          <Tabs value={currencyTab} onValueChange={setCurrencyTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="bolivares">Ventas/Premios Bs</TabsTrigger>
              <TabsTrigger value="dolares">Ventas/Premios USD</TabsTrigger>
            </TabsList>

            <TabsContent value="bolivares" className="space-y-4">
              <BanqueoVentasPremiosBolivares 
                form={form} 
                lotteryOptions={lotteryOptions}
                commissions={commissions}
                participationPercentage={participationPercentage}
                clientSystemConfigs={selectedClient ? clientSystemConfigs.get(selectedClient) : null}
                clientLanaveParticipation={selectedClient ? clientLanaveParticipation.get(selectedClient) : null}
              />
            </TabsContent>

            <TabsContent value="dolares" className="space-y-4">
              <BanqueoVentasPremiosDolares 
                form={form} 
                lotteryOptions={lotteryOptions}
                commissions={commissions}
                participationPercentage={participationPercentage}
                clientSystemConfigs={selectedClient ? clientSystemConfigs.get(selectedClient) : null}
                clientLanaveParticipation={selectedClient ? clientLanaveParticipation.get(selectedClient) : null}
              />
            </TabsContent>
          </Tabs>
        </div>
      )}

      {/* Botón de guardar */}
      {selectedClient && (
        <div className="flex justify-center">
          <Button 
            onClick={form.handleSubmit(onSubmit)} 
            disabled={loading} 
            size="lg"
            className="min-w-[200px]"
          >
            {loading ? 'Procesando...' : editMode ? 'Actualizar Banqueo' : 'Registrar Banqueo'}
          </Button>
        </div>
      )}
    </div>
  );
};
