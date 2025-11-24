import { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { VentasPremiosBolivares } from './VentasPremiosBolivares';
import { VentasPremiosDolares } from './VentasPremiosDolares';
import { Edit } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { formatDateForDB } from '@/lib/dateUtils';

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
}

interface VentasPremiosManagerProps {
  onSuccess?: () => void;
  dateRange?: {
    from: Date;
    to: Date;
  };
}

export const VentasPremiosManager = ({ onSuccess, dateRange }: VentasPremiosManagerProps) => {
  const [activeTab, setActiveTab] = useState('bolivares');
  const [lotteryOptions, setLotteryOptions] = useState<LotterySystem[]>([]);
  const [loading, setLoading] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [isApproved, setIsApproved] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  const form = useForm<VentasPremiosForm>({
    resolver: zodResolver(ventasPremiosSchema),
    defaultValues: {
      systems: [],
    },
  });

  // Cargar sistemas de lotería y datos existentes
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Cargar solo sistemas principales (sin subcategorías)
        const { data: systems, error: systemsError } = await supabase
          .from('lottery_systems')
          .select('id, name, code')
          .eq('is_active', true)
          .is('parent_system_id', null)
          .order('name');

        if (systemsError) throw systemsError;

        setLotteryOptions(systems || []);
        
        // Inicializar formulario con todos los sistemas
        const systemsData: SystemEntry[] = (systems || []).map(system => ({
          lottery_system_id: system.id,
          lottery_system_name: system.name,
          sales_bs: 0,
          sales_usd: 0,
          prizes_bs: 0,
          prizes_usd: 0,
        }));

        // Cargar datos existentes del rango de fechas
        await loadDateRangeData(systemsData);

      } catch (error: any) {
        console.error('❌ Error en fetchData:', error);
        toast({
          title: 'Error',
          description: error.message || 'No se pudieron cargar los datos',
          variant: 'destructive',
        });
      }
    };

    fetchData();
  }, [user, toast, dateRange]);

  const loadDateRangeData = async (defaultSystems: SystemEntry[]) => {
    if (!user || !dateRange) return;

    const fromDate = formatDateForDB(dateRange.from);
    const toDate = formatDateForDB(dateRange.to);
    
    console.log('🔍 VENTAS-PREMIOS DEBUG - Fechas:', { fromDate, toDate, dateRange });
    
    try {
      // Buscar sesiones en el rango de fechas
      const { data: sessions } = await supabase
        .from('daily_sessions')
        .select('id')
        .eq('user_id', user.id)
        .gte('session_date', fromDate)
        .lte('session_date', toDate);

      console.log('🔍 VENTAS-PREMIOS DEBUG - Sessions encontradas:', sessions);

      if (sessions && sessions.length > 0) {
        const sessionIds = sessions.map(s => s.id);
        
        // Cargar transacciones existentes de todas las sesiones
        const [salesResult, prizesResult] = await Promise.all([
          supabase
            .from('sales_transactions')
            .select('lottery_system_id, amount_bs, amount_usd')
            .in('session_id', sessionIds),
          supabase
            .from('prize_transactions')
            .select('lottery_system_id, amount_bs, amount_usd')
            .in('session_id', sessionIds)
        ]);

        // Combinar datos existentes con sistemas por defecto
        const systemsWithData = defaultSystems.map(system => {
          const salesData = salesResult.data?.filter(s => s.lottery_system_id === system.lottery_system_id) || [];
          const prizesData = prizesResult.data?.filter(p => p.lottery_system_id === system.lottery_system_id) || [];

          return {
            ...system,
            sales_bs: salesData.reduce((sum, s) => sum + Number(s.amount_bs || 0), 0),
            sales_usd: salesData.reduce((sum, s) => sum + Number(s.amount_usd || 0), 0),
            prizes_bs: prizesData.reduce((sum, p) => sum + Number(p.amount_bs || 0), 0),
            prizes_usd: prizesData.reduce((sum, p) => sum + Number(p.amount_usd || 0), 0),
          };
        });

        form.setValue('systems', systemsWithData);
        
        // Si hay datos, activar modo edición solo si es un solo día
        const isSingleDay = fromDate === toDate;
        const hasData = systemsWithData.some(s => 
          s.sales_bs > 0 || s.sales_usd > 0 || s.prizes_bs > 0 || s.prizes_usd > 0
        );
        setEditMode(hasData && isSingleDay);
        
        // Establecer session ID solo si es un día único y tiene sesión
        if (isSingleDay && sessions.length === 1) {
          const sessionId = sessions[0].id;
          setCurrentSessionId(sessionId);
          
          // Verificar si el cuadre está aprobado
          const { data: cuadreSummary } = await supabase
            .from('daily_cuadres_summary')
            .select('encargada_status')
            .eq('session_id', sessionId)
            .maybeSingle();
          
          setIsApproved(cuadreSummary?.encargada_status === 'aprobado');
        } else {
          setCurrentSessionId(null);
          setIsApproved(false);
        }
      } else {
        form.setValue('systems', defaultSystems);
        setEditMode(false);
        setCurrentSessionId(null);
      }
    } catch (error) {
      console.error('Error loading date range data:', error);
      form.setValue('systems', defaultSystems);
      setEditMode(false);
      setCurrentSessionId(null);
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

  const handleSubmit = async () => {
    console.log('🔍 INICIANDO SUBMIT - Función ejecutándose...');
    
    if (!user || !dateRange) {
      console.error('❌ No hay usuario o dateRange');
      return;
    }
    
    // No permitir guardar si está aprobado
    if (isApproved) {
      toast({
        title: 'Cuadre Aprobado',
        description: 'Este cuadre ya fue aprobado y no se puede modificar',
        variant: 'destructive',
      });
      return;
    }

    // Solo permitir guardar si es un solo día
    const fromDate = formatDateForDB(dateRange.from);
    const toDate = formatDateForDB(dateRange.to);
    
    if (fromDate !== toDate) {
      toast({
        title: 'Error',
        description: 'Solo puedes guardar cambios para un día específico. Selecciona una fecha única.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    console.log('🔍 LOADING SET TO TRUE');

    try {
      // Obtener datos del formulario
      const data = form.getValues();
      console.log('🔍 DATOS DEL FORMULARIO:', data);

      let sessionId = currentSessionId;

      // Crear sesión si no existe
      if (!sessionId) {
        console.log('🔍 CREANDO NUEVA SESIÓN...');
        const { data: newSession, error: createError } = await supabase
          .from('daily_sessions')
          .insert({
            user_id: user.id,
            session_date: fromDate,
          })
          .select('id')
          .single();

        if (createError) throw createError;
        sessionId = newSession.id;
        setCurrentSessionId(sessionId);
        console.log('🔍 SESIÓN CREADA:', sessionId);
      }

      // Si estamos en modo edición, eliminar transacciones existentes
      if (editMode && sessionId) {
        console.log('🔍 ELIMINANDO TRANSACCIONES EXISTENTES...');
        await Promise.all([
          supabase.from('sales_transactions').delete().eq('session_id', sessionId),
          supabase.from('prize_transactions').delete().eq('session_id', sessionId)
        ]);
      }

      // Filtrar sistemas con datos
      const systemsWithData = data.systems.filter(
        system => system.sales_bs > 0 || system.sales_usd > 0 || system.prizes_bs > 0 || system.prizes_usd > 0
      );

      console.log('🔍 SISTEMAS CON DATOS:', systemsWithData);

      if (systemsWithData.length === 0) {
        toast({
          title: 'Error',
          description: 'Debe ingresar al menos un monto',
          variant: 'destructive',
        });
        return;
      }

      // Preparar datos de ventas y premios
      const salesData = systemsWithData
        .filter(system => system.sales_bs > 0 || system.sales_usd > 0)
        .map(system => ({
          session_id: sessionId,
          lottery_system_id: system.lottery_system_id,
          amount_bs: system.sales_bs,
          amount_usd: system.sales_usd,
        }));

      const prizesData = systemsWithData
        .filter(system => system.prizes_bs > 0 || system.prizes_usd > 0)
        .map(system => ({
          session_id: sessionId,
          lottery_system_id: system.lottery_system_id,
          amount_bs: system.prizes_bs,
          amount_usd: system.prizes_usd,
        }));

      console.log('🔍 DATOS A INSERTAR:', { 
        salesDataLength: salesData.length, 
        prizesDataLength: prizesData.length,
        salesData,
        prizesData 
      });

      // Insertar datos de transacciones
      const promises = [];
      if (salesData.length > 0) {
        promises.push(supabase.from('sales_transactions').insert(salesData));
      }
      if (prizesData.length > 0) {
        promises.push(supabase.from('prize_transactions').insert(prizesData));
      }

      if (promises.length > 0) {
        const results = await Promise.all(promises);
        const errors = results.filter(r => r.error);
        
        if (errors.length > 0) {
          console.error('❌ Error en transacciones:', errors[0].error);
          throw new Error(errors[0].error?.message);
        }
      }

      // Calcular totales para el resumen
      const currentTotals = systemsWithData.reduce(
        (acc, system) => ({
          sales_bs: acc.sales_bs + (system.sales_bs || 0),
          sales_usd: acc.sales_usd + (system.sales_usd || 0),
          prizes_bs: acc.prizes_bs + (system.prizes_bs || 0),
          prizes_usd: acc.prizes_usd + (system.prizes_usd || 0),
        }),
        { sales_bs: 0, sales_usd: 0, prizes_bs: 0, prizes_usd: 0 }
      );

      console.log('🔍 LLEGANDO A GUARDAR RESUMEN - currentTotals:', currentTotals);
      
      // Guardar resumen en daily_cuadres_summary
      const summaryData = {
        session_id: sessionId,
        user_id: user.id,
        session_date: fromDate,
        agency_id: user.user_metadata?.agency_id || null,
        total_sales_bs: currentTotals.sales_bs,
        total_sales_usd: currentTotals.sales_usd,
        total_prizes_bs: currentTotals.prizes_bs,
        total_prizes_usd: currentTotals.prizes_usd,
      };

      console.log('🔍 GUARDANDO SUMMARY - Datos:', summaryData);

      // Insertar o actualizar resumen
      if (editMode) {
        const { data: summaryResult, error: updateSummaryError } = await supabase
          .from('daily_cuadres_summary')
          .upsert(summaryData, {
            onConflict: 'session_id'
          })
          .select();
        
        console.log('🔍 SUMMARY UPSERT RESULT:', { data: summaryResult, error: updateSummaryError });
        
        if (updateSummaryError) {
          console.error('❌ Error updating summary:', updateSummaryError);
          throw new Error(`Error actualizando resumen: ${updateSummaryError.message}`);
        }
      } else {
        const { data: summaryResult, error: insertSummaryError } = await supabase
          .from('daily_cuadres_summary')
          .upsert(summaryData, {
            onConflict: 'session_id'
          })
          .select();
        
        console.log('🔍 SUMMARY UPSERT RESULT:', { data: summaryResult, error: insertSummaryError });
        
        if (insertSummaryError) {
          console.error('❌ Error upserting summary:', insertSummaryError);
          throw new Error(`Error guardando resumen: ${insertSummaryError.message}`);
        }
      }

      toast({
        title: 'Éxito',
        description: editMode 
          ? 'Cuadre actualizado correctamente'
          : `Registradas ${salesData.length} ventas y ${prizesData.length} premios correctamente`,
      });

      setEditMode(true);
      onSuccess?.();

    } catch (error: any) {
      console.error('❌ ERROR GENERAL:', error);
      toast({
        title: 'Error',
        description: error.message || 'Error al procesar las transacciones',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
      console.log('🔍 LOADING SET TO FALSE');
    }
  };

  const totals = calculateTotals();

  return (
    <div className="space-y-6">
      {/* Resumen de totales */}
      <Card className="bg-muted/50">
        <CardHeader>
          <CardTitle className="flex items-center">
            <span>Resumen del Cuadre {editMode && <Edit className="h-4 w-4 ml-2" />}</span>
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

      {/* Tabs para diferentes secciones */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="bolivares">Ventas/Premios Bs</TabsTrigger>
          <TabsTrigger value="dolares">Ventas/Premios USD</TabsTrigger>
        </TabsList>

        <TabsContent value="bolivares" className="space-y-4">
          <VentasPremiosBolivares 
            form={form} 
            lotteryOptions={lotteryOptions}
            isApproved={isApproved}
          />
        </TabsContent>

        <TabsContent value="dolares" className="space-y-4">
          <VentasPremiosDolares 
            form={form} 
            lotteryOptions={lotteryOptions}
            isApproved={isApproved}
          />
        </TabsContent>
      </Tabs>

      {/* Botón de guardar */}
      <div className="flex justify-center">
        <Button 
          onClick={handleSubmit}
          disabled={loading || isApproved} 
          size="lg"
          className="min-w-[200px]"
        >
          {loading ? 'Procesando...' : isApproved ? 'Cuadre Aprobado - No se puede modificar' : editMode ? 'Actualizar Cuadre' : 'Registrar Cuadre'}
        </Button>
      </div>
    </div>
  );
};