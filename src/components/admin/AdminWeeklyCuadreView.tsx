import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { format, addWeeks, subWeeks, startOfWeek, endOfWeek, addDays } from "date-fns";
import { es } from "date-fns/locale";
import { useWeeklyCuadre, type WeekBoundaries } from "@/hooks/useWeeklyCuadre";
import { useSystemCommissions } from "@/hooks/useSystemCommissions";
import { AdminAgencyWeeklyCard } from "./weekly/AdminAgencyWeeklyCard";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function AdminWeeklyCuadreView() {
  const [currentWeek, setCurrentWeek] = useState<WeekBoundaries | null>(null);
  const [selectedAgency, setSelectedAgency] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<"week" | "weekend">("week");

  const { loading, summaries, agencies, refresh } = useWeeklyCuadre(currentWeek);
  const { commissions, loading: commissionsLoading } = useSystemCommissions();

  useEffect(() => {
    initializeCurrentWeek();
  }, []);

  const initializeCurrentWeek = async () => {
    try {
      const { data, error } = await supabase.rpc("get_current_week_boundaries");

      if (error) throw error;

      if (data && data.length > 0) {
        const w = data[0];
        setCurrentWeek({
          start: new Date(w.week_start + "T00:00:00"),
          end: new Date(w.week_end + "T23:59:59"),
        });
      } else {
        const now = new Date();
        const weekStart = startOfWeek(now, { weekStartsOn: 1 });
        const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
        setCurrentWeek({ start: weekStart, end: weekEnd });
      }
    } catch (error) {
      console.error("Error getting current week:", error);
      toast.error("No se pudieron obtener las fechas de la semana");
    }
  };

  const navigateWeek = (direction: "prev" | "next") => {
    if (!currentWeek) return;
    
    if (dateFilter === "week") {
      const newStart = direction === "next"
        ? addWeeks(currentWeek.start, 1)
        : subWeeks(currentWeek.start, 1);
      const newEnd = endOfWeek(newStart, { weekStartsOn: 1 });

      setCurrentWeek({
        start: newStart,
        end: newEnd,
      });
    } else {
      // Navigate 3 days (weekend)
      const daysToAdd = direction === "next" ? 7 : -7;
      const newStart = addDays(currentWeek.start, daysToAdd);
      const newEnd = addDays(newStart, 2); // 3 days total (Fri, Sat, Sun)
      
      setCurrentWeek({
        start: newStart,
        end: newEnd,
      });
    }
  };

  const handleDateFilterChange = (filter: "week" | "weekend") => {
    setDateFilter(filter);
    
    if (filter === "weekend" && currentWeek) {
      // Calculate the most recent Friday-Sunday period
      const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
      const friday = addDays(weekStart, 4); // Friday is 4 days after Monday
      const sunday = addDays(friday, 2); // Sunday is 2 days after Friday
      
      setCurrentWeek({
        start: friday,
        end: sunday,
      });
    } else if (filter === "week") {
      // Reset to full week
      initializeCurrentWeek();
    }
  };

  const filtered = selectedAgency === "all"
    ? summaries
    : summaries.filter((s) => s.agency_id === selectedAgency);

  if (loading || commissionsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigateWeek("prev")}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h2 className="text-xl font-semibold min-w-[250px] text-center">
              {currentWeek
                ? `${format(currentWeek.start, "d 'de' MMMM", { locale: es })} - ${format(
                    currentWeek.end,
                    "d 'de' MMMM, yyyy",
                    { locale: es }
                  )}`
                : "Cargando..."}
            </h2>
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigateWeek("next")}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={refresh}
              title="Refrescar datos"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Agencia:</span>
            <Select value={selectedAgency} onValueChange={setSelectedAgency}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las agencias</SelectItem>
                {agencies.map((agency) => (
                  <SelectItem key={agency.id} value={agency.id}>
                    {agency.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Tabs value={dateFilter} onValueChange={(value) => handleDateFilterChange(value as "week" | "weekend")} className="w-full">
          <TabsList className="grid w-full max-w-md mx-auto grid-cols-2">
            <TabsTrigger value="week">Semana Completa (7 días)</TabsTrigger>
            <TabsTrigger value="weekend">Fin de Semana (3 días)</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="space-y-6">
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            No hay datos disponibles para {dateFilter === "week" ? "esta semana" : "este fin de semana"}
          </div>
        ) : (
          filtered.map((summary) => (
            <AdminAgencyWeeklyCard
              key={summary.agency_id}
              summary={summary}
              commissions={commissions}
            />
          ))
        )}
      </div>
    </div>
  );
}
