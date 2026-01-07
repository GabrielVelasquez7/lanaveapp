import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, ChevronLeft, ChevronRight, RefreshCcw, Building2, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/ui/use-toast";
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks } from "date-fns";
import { es } from "date-fns/locale";
import { AgencyWeeklyCard } from "./weekly/AgencyWeeklyCard";
import { useWeeklyCuadre, WeekBoundaries } from "@/hooks/useWeeklyCuadre";
import { parseDateFromDB } from "@/lib/dateUtils";

const PERSIST_KEY = "encargada:weekly-cuadre:week";

export function WeeklyCuadreView() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [currentWeek, setCurrentWeek] = useState<WeekBoundaries | null>(null);
  const [selectedAgency, setSelectedAgency] = useState<string>("all");
  const {
    loading,
    summaries,
    agencies,
    refresh,
    error
  } = useWeeklyCuadre(currentWeek);

  // Persistir semana seleccionada
  const persistWeek = useCallback((week: WeekBoundaries) => {
    try {
      localStorage.setItem(PERSIST_KEY, JSON.stringify({
        start: format(week.start, "yyyy-MM-dd"),
        end: format(week.end, "yyyy-MM-dd"),
      }));
    } catch (e) {
      // Ignore
    }
  }, []);

  const loadPersistedWeek = useCallback((): WeekBoundaries | null => {
    try {
      const stored = localStorage.getItem(PERSIST_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        const startDate = parseDateFromDB(parsed.start);
        const endDate = parseDateFromDB(parsed.end);
        endDate.setHours(23, 59, 59);
        return { start: startDate, end: endDate };
      }
    } catch (e) {
      // Ignore
    }
    return null;
  }, []);

  useEffect(() => {
    if (user) {
      // Intentar cargar semana persistida primero
      const persisted = loadPersistedWeek();
      if (persisted) {
        setCurrentWeek(persisted);
      } else {
        getCurrentWeekBoundaries();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (error) {
      toast({
        title: "Error",
        description: error,
        variant: "destructive"
      });
    }
  }, [error, toast]);

  const getCurrentWeekBoundaries = async () => {
    try {
      const { data, error } = await supabase.rpc("get_current_week_boundaries");
      if (error) throw error;
      if (data && data.length > 0) {
        const w = data[0];
        const startDate = parseDateFromDB(w.week_start);
        const endDate = parseDateFromDB(w.week_end);
        endDate.setHours(23, 59, 59);
        const week = { start: startDate, end: endDate };
        setCurrentWeek(week);
        persistWeek(week);
      } else {
        const now = new Date();
        const weekStart = startOfWeek(now, { weekStartsOn: 1 });
        const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
        const week = { start: weekStart, end: weekEnd };
        setCurrentWeek(week);
        persistWeek(week);
      }
    } catch (e) {
      console.error("Error getting week boundaries:", e);
      toast({
        title: "Error",
        description: "No se pudieron obtener las fechas de la semana",
        variant: "destructive"
      });
    }
  };

  const navigateWeek = (dir: "prev" | "next") => {
    if (!currentWeek) return;
    const newStart = dir === "prev" ? subWeeks(currentWeek.start, 1) : addWeeks(currentWeek.start, 1);
    const newEnd = endOfWeek(newStart, { weekStartsOn: 1 });
    const newWeek = { start: newStart, end: newEnd };
    setCurrentWeek(newWeek);
    persistWeek(newWeek);
  };

  const filtered = selectedAgency === "all" ? summaries : summaries.filter(a => a.agency_id === selectedAgency);
  if (loading || !currentWeek) {
    return <div className="flex items-center justify-center p-12">
        <div className="text-center">
          <RefreshCcw className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Cargando datos semanales...</p>
        </div>
      </div>;
  }
  return <div className="space-y-6">
      {/* Encabezado y navegación */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <Calendar className="h-6 w-6 text-primary" />
          <div>
            <h2 className="text-2xl font-bold">Cuadre Semanal</h2>
            <p className="text-sm text-muted-foreground">
              {format(currentWeek.start, "d 'de' MMMM", {
              locale: es
            })} — {format(currentWeek.end, "d 'de' MMMM 'de' yyyy", {
              locale: es
            })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => navigateWeek("prev")}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={() => navigateWeek("next")}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={refresh} title="Refrescar datos">
            <RefreshCcw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Filtro de agencia */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Building2 className="h-5 w-5" /> Filtrar por Agencias
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={selectedAgency} onValueChange={setSelectedAgency}>
            <SelectTrigger className="w-full sm:w-64">
              <SelectValue placeholder="Seleccionar agencia" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las agencias</SelectItem>
              {agencies.map(a => <SelectItem key={a.id} value={a.id}>
                  {a.name}
                </SelectItem>)}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Listado */}
      <div className="space-y-4">
        {filtered.length === 0 ? <Card>
            <CardContent className="py-12 text-center">
              <AlertCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">No hay datos para esta semana</p>
            </CardContent>
          </Card> : filtered.map(s => <AgencyWeeklyCard key={s.agency_id} summary={s} weekStart={currentWeek.start} weekEnd={currentWeek.end} onConfigSuccess={refresh} />)}
      </div>
    </div>;
}