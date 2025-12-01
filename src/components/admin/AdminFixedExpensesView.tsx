import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks } from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { WeeklyBankExpensesManager } from '@/components/encargada/WeeklyBankExpensesManager';
import { WeeklyBankExpensesUsdManager } from '@/components/encargada/WeeklyBankExpensesUsdManager';

export function AdminFixedExpensesView() {
  const [currentWeek, setCurrentWeek] = useState<{ start: Date; end: Date } | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    getCurrentWeekBoundaries();
  }, []);

  const getCurrentWeekBoundaries = async () => {
    try {
      const { data, error } = await supabase.rpc('get_current_week_boundaries');
      
      if (error) throw error;
      
      if (data && data.length > 0) {
        const w = data[0];
        setCurrentWeek({
          start: new Date(w.week_start + 'T00:00:00'),
          end: new Date(w.week_end + 'T23:59:59'),
        });
      } else {
        const now = new Date();
        const weekStart = startOfWeek(now, { weekStartsOn: 1 });
        const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
        setCurrentWeek({ start: weekStart, end: weekEnd });
      }
    } catch (error) {
      console.error('Error fetching week boundaries:', error);
    }
  };

  const navigateWeek = (direction: 'prev' | 'next') => {
    if (!currentWeek) return;
    
    const newStart = direction === 'prev' 
      ? subWeeks(currentWeek.start, 1)
      : addWeeks(currentWeek.start, 1);
    const newEnd = endOfWeek(newStart, { weekStartsOn: 1 });
    
    setCurrentWeek({ start: newStart, end: newEnd });
    setRefreshKey(prev => prev + 1);
  };

  const handleExpensesChange = () => {
    setRefreshKey(prev => prev + 1);
  };

  if (!currentWeek) {
    return <div className="p-6">Cargando...</div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Gestión de Gastos Fijos Semanales</CardTitle>
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                size="icon"
                onClick={() => navigateWeek('prev')}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="text-center min-w-[250px]">
                <p className="text-sm font-medium">
                  {format(currentWeek.start, "d 'de' MMMM", { locale: es })} — {format(currentWeek.end, "d 'de' MMMM 'de' yyyy", { locale: es })}
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
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="bs" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="bs">Gastos en Bolívares (Bs)</TabsTrigger>
              <TabsTrigger value="usd">Gastos en Dólares (USD)</TabsTrigger>
            </TabsList>
            <TabsContent value="bs" className="mt-6">
              <WeeklyBankExpensesManager
                weekStart={currentWeek.start}
                weekEnd={currentWeek.end}
                onExpensesChange={handleExpensesChange}
              />
            </TabsContent>
            <TabsContent value="usd" className="mt-6">
              <WeeklyBankExpensesUsdManager
                weekStart={currentWeek.start}
                weekEnd={currentWeek.end}
                onExpensesChange={handleExpensesChange}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

