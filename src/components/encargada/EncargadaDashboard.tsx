import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { VentasPremiosEncargada } from "./VentasPremiosEncargada";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { InterAgencyManager } from "./InterAgencyManager";
import { WeeklyCuadreView } from "./WeeklyCuadreView";
import { SystemsSummaryWeekly } from "./SystemsSummaryWeekly";
import { EmployeesCrud } from "./EmployeesCrud";
import { WeeklyPayrollManager } from "./WeeklyPayrollManager";
import { BankBalanceWeekly } from "./BankBalanceWeekly";
import { BanqueoEncargada } from "./BanqueoEncargada";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { EncargadaSidebar } from "./EncargadaSidebar";

export function EncargadaDashboard() {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("cuadre-semanal");

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user]);

  const fetchProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*, agencies(name)')
        .eq('user_id', user?.id)
        .single();

      if (error) throw error;
      setProfile(data);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "No se pudo cargar el perfil",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error: any) {
      toast({
        title: "Error",
        description: "No se pudo cerrar la sesión",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return <div className="p-6">Cargando...</div>;
  }

  const renderContent = () => {
    switch (activeTab) {
      case "cuadre-semanal":
        return <WeeklyCuadreView />;
      case "cuadre-agencias":
        return <VentasPremiosEncargada />;
      case "prestamos-deudas":
        return <InterAgencyManager />;
      case "resumen-sistemas":
        return <SystemsSummaryWeekly />;
      case "banco-semanal":
        return <BankBalanceWeekly />;
      case "empleados":
        return <EmployeesCrud />;
      case "nomina":
        return <WeeklyPayrollManager />;
      case "banqueo":
        return <BanqueoEncargada />;
      default:
        return <WeeklyCuadreView />;
    }
  };

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="min-h-screen flex w-full bg-muted/30">
        <EncargadaSidebar activeTab={activeTab} onTabChange={setActiveTab} />
        
        <div className="flex-1 flex flex-col">
          <header className="bg-primary border-b px-6 py-4 sticky top-0 z-10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <SidebarTrigger className="text-primary-foreground" />
                <div>
                  <h1 className="text-2xl font-bold text-primary-foreground">
                    Sistema de Cuadres - Encargada
                  </h1>
                  <p className="text-primary-foreground/80">
                    Bienvenida, {profile?.full_name} -{" "}
                    {profile?.agencies?.name || "Sin agencia asignada"}
                  </p>
                </div>
              </div>
              <Button variant="secondary" onClick={handleSignOut}>
                <LogOut className="h-4 w-4 mr-2" />
                Salir
              </Button>
            </div>
          </header>

          <main className="flex-1 container mx-auto p-6">
            {renderContent()}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}