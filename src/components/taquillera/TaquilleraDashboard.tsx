import { useState } from 'react';
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
import { format, addDays, isToday, isSameDay, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { getVenezuelaDate, isFutureInVenezuela } from '@/lib/dateUtils';
import { useTaquilleraNotifications } from '@/hooks/useTaquilleraNotifications';

type DateRange = {
  from: Date;
  to: Date;
};

export const TaquilleraDashboard = () => {
  const { profile, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState('transacciones');
  const { refreshKey, triggerRefresh } = useDataRefresh();
  const [isDateLockedByApproval, setIsDateLockedByApproval] = useState(false);
  const { toast } = useToast();

  // Date State
  const today = getVenezuelaDate();
  const [selectedDate, setSelectedDate] = useState<Date>(today);
  const dateRange: DateRange = { from: selectedDate, to: selectedDate };
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  // Hook for Notifications
  useTaquilleraNotifications({
    onStatusChange: (status, date) => {
      // If status changed, refresh data
      triggerRefresh();
      // If rejected/approved, switch to Cuadre General and that date
      setActiveTab('cuadre-general');
      setSelectedDate(date);
    }
  });

  const handleSignOut = async () => {
    await signOut();
  };

  const setToday = () => {
    if (isDateLockedByApproval) {
      toast({ title: 'Bloqueado', description: 'Espera aprobación para cambiar fecha.', variant: 'destructive' });
      return;
    }
    setSelectedDate(getVenezuelaDate());
  };

  const navigateDay = (direction: 'prev' | 'next') => {
    if (isDateLockedByApproval) {
      toast({ title: 'Bloqueado', description: 'Espera aprobación para cambiar fecha.', variant: 'destructive' });
      return;
    }
    const days = direction === 'prev' ? -1 : 1;
    const newDate = addDays(selectedDate, days);

    if (direction === 'next' && isFutureInVenezuela(newDate)) {
      toast({ title: 'Fecha Inválida', description: 'No puedes ir al futuro.', variant: 'destructive' });
      return;
    }

    if (differenceInDays(getVenezuelaDate(), newDate) > 10) {
      toast({ title: 'Fecha Inválida', description: 'Máximo 10 días atrás.', variant: 'destructive' });
      return;
    }

    setSelectedDate(newDate);
  };

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
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Filtro de Fechas</span>
              <Button variant={isToday(selectedDate) ? "default" : "outline"} size="sm" onClick={setToday} disabled={isDateLockedByApproval}>
                Hoy
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => navigateDay('prev')} disabled={isDateLockedByApproval}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>

                <Popover open={isCalendarOpen} onOpenChange={(open) => !isDateLockedByApproval && setIsCalendarOpen(open)}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("justify-start text-left font-normal min-w-[280px]", !selectedDate && "text-muted-foreground")} disabled={isDateLockedByApproval}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(selectedDate, "dd 'de' MMMM, yyyy", { locale: es })}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={(date) => {
                        if (date && !isFutureInVenezuela(date) && differenceInDays(getVenezuelaDate(), date) <= 10) {
                          setSelectedDate(date);
                          setIsCalendarOpen(false);
                        }
                      }}
                      disabled={(date) => isFutureInVenezuela(date) || differenceInDays(getVenezuelaDate(), date) > 10}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>

                <Button variant="outline" size="sm" onClick={() => navigateDay('next')} disabled={isDateLockedByApproval || isFutureInVenezuela(addDays(selectedDate, 1))}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <Badge variant="secondary">1 día</Badge>
            </div>
          </CardContent>
        </Card>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-7">
            <TabsTrigger value="transacciones" className="flex items-center gap-2"><DollarSign className="h-4 w-4" /> Ventas/Premios</TabsTrigger>
            <TabsTrigger value="gastos" className="flex items-center gap-2"><Receipt className="h-4 w-4" /> Gastos</TabsTrigger>
            <TabsTrigger value="pago-movil" className="flex items-center gap-2"><Smartphone className="h-4 w-4" /> Pago Móvil</TabsTrigger>
            <TabsTrigger value="premios-por-pagar" className="flex items-center gap-2"><Gift className="h-4 w-4" /> Premios P.P.</TabsTrigger>
            <TabsTrigger value="punto-venta" className="flex items-center gap-2"><CreditCard className="h-4 w-4" /> Punto Venta</TabsTrigger>
            <TabsTrigger value="cuadre-sistemas" className="flex items-center gap-2"><Calculator className="h-4 w-4" /> Por Sistema</TabsTrigger>
            <TabsTrigger value="cuadre-general" className="flex items-center gap-2"><Calculator className="h-4 w-4" /> Cuadre General</TabsTrigger>
          </TabsList>

          <TabsContent value="transacciones" className="space-y-6"><VentasPremiosManager onSuccess={triggerRefresh} dateRange={dateRange} /></TabsContent>
          <TabsContent value="gastos" className="space-y-6"><GastosManager onSuccess={triggerRefresh} dateRange={dateRange} /></TabsContent>
          <TabsContent value="pago-movil" className="space-y-6"><PagoMovilManager onSuccess={triggerRefresh} dateRange={dateRange} /></TabsContent>
          <TabsContent value="premios-por-pagar" className="space-y-6"><PremiosPorPagarManager onSuccess={triggerRefresh} dateRange={dateRange} /></TabsContent>
          <TabsContent value="punto-venta" className="space-y-6"><PointOfSaleForm dateRange={dateRange} /></TabsContent>
          <TabsContent value="cuadre-sistemas" className="space-y-6"><SystemCuadresView dateRange={dateRange} /></TabsContent>

          <TabsContent value="cuadre-general" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Cuadre General</CardTitle>
                <CardDescription>Resumen financiero del día</CardDescription>
              </CardHeader>
              <CardContent>
                <CuadreGeneral
                  refreshKey={refreshKey}
                  dateRange={dateRange}
                  onDateLockChange={setIsDateLockedByApproval}
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};