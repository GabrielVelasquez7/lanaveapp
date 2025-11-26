import { useState, useEffect, useRef } from 'react';
import { useDataRefresh } from '@/hooks/useDataRefresh';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Calculator, DollarSign, Gift, LogOut, Receipt, Smartphone, CreditCard, Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { GastosManager } from './GastosManager';
import { DailySummary } from './DailySummary';
import { PagoMovilManager } from './PagoMovilManager';
import { PremiosPorPagarManager } from './PremiosPorPagarManager';
import { PointOfSaleForm } from './PointOfSaleForm';
import { SystemCuadresView } from './SystemCuadresView';
import { VentasPremiosManager } from './VentasPremiosManager';
import { CuadreGeneral } from './CuadreGeneral';
import { format, startOfWeek, endOfWeek, addDays, isToday, isSameDay, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { getVenezuelaDate, toVenezuelaTime, isFutureInVenezuela, formatDateForDB } from '@/lib/dateUtils';
import { supabase } from '@/integrations/supabase/client';

type DateRange = {
  from: Date;
  to: Date;
};

export const TaquilleraDashboard = () => {
  const { user, profile, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState('transacciones');
  const { refreshKey, triggerRefresh } = useDataRefresh();
  
  // Usar fecha local de Venezuela - siempre un solo día
  const today = getVenezuelaDate();
  const [selectedDate, setSelectedDate] = useState<Date>(today);
  
  // Mantener dateRange siempre como un solo día
  const dateRange: DateRange = {
    from: selectedDate,
    to: selectedDate,
  };
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const { toast } = useToast();

  const handleSignOut = async () => {
    await signOut();
  };

  const setToday = () => {
    const today = getVenezuelaDate();
    setSelectedDate(today);
  };

  const navigateDay = (direction: 'prev' | 'next') => {
    const days = direction === 'prev' ? -1 : 1;
    const newDate = addDays(selectedDate, days);
    
    // Evitar navegar a fechas futuras según zona horaria de Venezuela
    if (direction === 'next' && isFutureInVenezuela(newDate)) {
      toast({
        title: 'Fecha no válida',
        description: 'No puedes seleccionar fechas futuras',
        variant: 'destructive',
      });
      return;
    }
    
    // Limitar a máximo 10 días atrás
    const today = getVenezuelaDate();
    const daysBack = differenceInDays(today, newDate);
    if (daysBack > 10) {
      toast({
        title: 'Fecha no válida',
        description: 'Solo puedes ver hasta 10 días atrás',
        variant: 'destructive',
      });
      return;
    }
    
    setSelectedDate(newDate);
  };

  const validateDate = (date: Date | undefined): boolean => {
    if (!date) return false;
    
    // Verificar que no se seleccionen fechas futuras según zona horaria de Venezuela
    if (isFutureInVenezuela(date)) {
      toast({
        title: 'Fecha no válida',
        description: 'No puedes seleccionar fechas futuras',
        variant: 'destructive',
      });
      return false;
    }
    
    // Limitar a máximo 10 días atrás
    const today = getVenezuelaDate();
    const daysBack = differenceInDays(today, date);
    if (daysBack > 10) {
      toast({
        title: 'Fecha no válida',
        description: 'Solo puedes ver hasta 10 días atrás',
        variant: 'destructive',
      });
      return false;
    }
    
    return true;
  };

  const isSingleDay = isSameDay(dateRange.from, dateRange.to);
  const todayVenezuela = getVenezuelaDate();
  
  // Track notified statuses to avoid duplicates
  const lastNotifiedStatusRef = useRef<Record<string, string>>({});

  // Suscripción en tiempo real para notificaciones de cuadre rechazado/aprobado
  useEffect(() => {
    if (!user) return;

    let channel: any = null;
    
    const setupSubscription = async () => {
      // Obtener todas las sesiones del usuario (últimos 10 días)
      const tenDaysAgo = new Date();
      tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
      const fromDate = formatDateForDB(tenDaysAgo);
      
      const { data: sessions } = await supabase
        .from('daily_sessions')
        .select('id')
        .eq('user_id', user.id)
        .gte('session_date', fromDate);
      
      const sessionIds = sessions?.map(s => s.id) || [];
      
      if (sessionIds.length === 0) return;

      // Suscribirse a cambios en daily_cuadres_summary
      const channelName = `cuadre-notifications-${user.id}-${Date.now()}`;
      channel = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'daily_cuadres_summary',
          },
          async (payload) => {
            const updatedSessionId = payload.new.session_id;
            if (!sessionIds.includes(updatedSessionId)) return;
            
            const newStatus = payload.new.encargada_status;
            const oldStatus = payload.old?.encargada_status;
            const observations = payload.new.encargada_observations;
            const sessionDate = payload.new.session_date;

            // Solo mostrar notificación si el estado cambió a rechazado o aprobado
            if (newStatus !== oldStatus && (newStatus === 'rechazado' || newStatus === 'aprobado')) {
              // Verificar que no se haya notificado ya este cambio
              const statusKey = `${updatedSessionId}-${newStatus}`;
              if (lastNotifiedStatusRef.current[statusKey]) {
                return; // Ya se notificó este cambio
              }
              
              lastNotifiedStatusRef.current[statusKey] = newStatus;
              const dateFormatted = new Date(sessionDate).toLocaleDateString('es-VE');
              
              if (newStatus === 'rechazado') {
                toast({
                  title: '❌ Cuadre Rechazado',
                  description: `Tu cuadre del ${dateFormatted} fue rechazado por la encargada.${observations ? ` Observaciones: ${observations}` : ''}`,
                  variant: 'destructive',
                  duration: 10000,
                });
                
                // Cambiar a la pestaña de cuadre general y a la fecha del cuadre rechazado
                setActiveTab('cuadre-general');
                const rejectedDate = new Date(sessionDate);
                setSelectedDate(rejectedDate);
                
                // Trigger refresh para que CuadreGeneral recargue los datos
                triggerRefresh();
              } else if (newStatus === 'aprobado') {
                toast({
                  title: '✅ Cuadre Aprobado',
                  description: `Tu cuadre del ${dateFormatted} ha sido aprobado por la encargada.`,
                  duration: 5000,
                });
                
                // Cambiar a la pestaña de cuadre general y a la fecha del cuadre aprobado
                setActiveTab('cuadre-general');
                const approvedDate = new Date(sessionDate);
                setSelectedDate(approvedDate);
                
                // Trigger refresh para que CuadreGeneral recargue los datos
                triggerRefresh();
              }
            }
          }
        )
        .subscribe();
    };

    setupSubscription();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [user, toast, triggerRefresh]);

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="bg-primary border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-primary-foreground">Sistema de Cuadres</h1>
            <p className="text-primary-foreground/80">
              Bienvenida, {profile?.full_name} - {profile?.role}
            </p>
          </div>
          <Button variant="secondary" onClick={handleSignOut}>
            <LogOut className="h-4 w-4 mr-2" />
            Salir
          </Button>
        </div>
      </header>

      <main className="container mx-auto p-6">
        {/* Global Date Filter */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Filtro de Fechas</span>
              <Button
                variant={isToday(selectedDate) ? "default" : "outline"}
                size="sm"
                onClick={setToday}
              >
                Hoy
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigateDay('prev')}
                  disabled={differenceInDays(todayVenezuela, selectedDate) >= 10}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "justify-start text-left font-normal min-w-[280px]",
                        !selectedDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(selectedDate, "dd 'de' MMMM, yyyy", { locale: es })}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      initialFocus
                      mode="single"
                      defaultMonth={selectedDate}
                      selected={selectedDate}
                      disabled={(date) => {
                        // Deshabilitar fechas futuras
                        if (isFutureInVenezuela(date)) return true;
                        // Deshabilitar fechas más de 10 días atrás
                        const daysBack = differenceInDays(todayVenezuela, date);
                        return daysBack > 10;
                      }}
                      onSelect={(date) => {
                        if (date && validateDate(date)) {
                          setSelectedDate(date);
                          setIsCalendarOpen(false);
                        }
                      }}
                      numberOfMonths={1}
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigateDay('next')}
                  disabled={isFutureInVenezuela(addDays(selectedDate, 1))}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <Badge variant="secondary">
                1 día
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-7">
            <TabsTrigger value="transacciones" className="flex items-center gap-2">
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
            <TabsTrigger value="premios-por-pagar" className="flex items-center gap-2">
              <Gift className="h-4 w-4" />
              Premios P.P.
            </TabsTrigger>
            <TabsTrigger value="punto-venta" className="flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Punto Venta
            </TabsTrigger>
            <TabsTrigger value="cuadre-sistemas" className="flex items-center gap-2">
              <Calculator className="h-4 w-4" />
              Por Sistema
            </TabsTrigger>
            <TabsTrigger value="cuadre-general" className="flex items-center gap-2">
              <Calculator className="h-4 w-4" />
              Cuadre General
            </TabsTrigger>
          </TabsList>

          <TabsContent value="transacciones" className="space-y-6">
            <VentasPremiosManager onSuccess={triggerRefresh} dateRange={dateRange} />
          </TabsContent>

          <TabsContent value="gastos" className="space-y-6">
            <GastosManager onSuccess={triggerRefresh} dateRange={dateRange} />
          </TabsContent>

          <TabsContent value="pago-movil" className="space-y-6">
            <PagoMovilManager onSuccess={triggerRefresh} dateRange={dateRange} />
          </TabsContent>

          <TabsContent value="premios-por-pagar" className="space-y-6">
            <PremiosPorPagarManager onSuccess={triggerRefresh} dateRange={dateRange} />
          </TabsContent>

          <TabsContent value="punto-venta" className="space-y-6">
            <PointOfSaleForm dateRange={dateRange} />
          </TabsContent>

          <TabsContent value="cuadre-sistemas" className="space-y-6">
            <SystemCuadresView dateRange={dateRange} />
          </TabsContent>

          <TabsContent value="cuadre-general" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Cuadre General</CardTitle>
                <CardDescription>
                  Cuadre total y resumen financiero del período seleccionado
                </CardDescription>
              </CardHeader>
              <CardContent>
                <CuadreGeneral refreshKey={refreshKey} dateRange={dateRange} />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};