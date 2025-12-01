import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AdminSidebar } from "./AdminSidebar";
import { AgenciesCrud } from "./AgenciesCrud";
import { GroupsCrud } from "./GroupsCrud";
import { UsersCrud } from "./UsersCrud";
import { SystemsCrud } from "./SystemsCrud";
import { SystemCommissionsCrud } from "./SystemCommissionsCrud";
import { AdminWeeklyCuadreView } from "./AdminWeeklyCuadreView";
import { AdminGananciasView } from "./AdminGananciasView";
import { AdminSystemsSummaryView } from "./AdminSystemsSummaryView";
import { AdminSystemsSummaryManual } from "./AdminSystemsSummaryManual";
import { ClientsCrud } from "./ClientsCrud";
import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";

type AdminView = 'agencies' | 'groups' | 'users' | 'systems' | 'system-commissions' | 'weekly-cuadre-complete' | 'ganancias' | 'systems-summary' | 'systems-summary-manual' | 'dashboard' | 'clients';

export const AdminDashboard = () => {
  const [currentView, setCurrentView] = useState<AdminView>('dashboard');
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user]);

  const fetchProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
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

  if (loading) {
    return <div className="p-6">Cargando...</div>;
  }

  const renderContent = () => {
    switch (currentView) {
      case 'agencies':
        return <AgenciesCrud />;
      case 'groups':
        return <GroupsCrud />;
      case 'users':
        return <UsersCrud />;
      case 'systems':
        return <SystemsCrud />;
      case 'system-commissions':
        return <SystemCommissionsCrud />;
      case 'weekly-cuadre-complete':
        return <AdminWeeklyCuadreView />;
      case 'ganancias':
        return <AdminGananciasView />;
      case 'systems-summary':
        return <AdminSystemsSummaryView />;
      case 'systems-summary-manual':
        return <AdminSystemsSummaryManual />;
      case 'clients':
        return <ClientsCrud />;
      default:
        return (
          <div className="p-4 sm:p-6">
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-6">Panel de Administración</h1>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
              <Card 
                className="p-4 sm:p-6 cursor-pointer hover:shadow-lg transition-shadow border-primary/20"
                onClick={() => setCurrentView('agencies')}
              >
                <h3 className="text-lg sm:text-xl font-semibold mb-2 text-primary">Agencias</h3>
                <p className="text-sm sm:text-base text-muted-foreground">Gestionar agencias del sistema</p>
              </Card>
              <Card 
                className="p-4 sm:p-6 cursor-pointer hover:shadow-lg transition-shadow border-primary/20"
                onClick={() => setCurrentView('users')}
              >
                <h3 className="text-lg sm:text-xl font-semibold mb-2 text-primary">Usuarios</h3>
                <p className="text-sm sm:text-base text-muted-foreground">Administrar taquilleros y roles</p>
              </Card>
              <Card 
                className="p-4 sm:p-6 cursor-pointer hover:shadow-lg transition-shadow border-primary/20"
                onClick={() => setCurrentView('systems')}
              >
                <h3 className="text-lg sm:text-xl font-semibold mb-2 text-primary">Sistemas</h3>
                <p className="text-sm sm:text-base text-muted-foreground">Configurar sistemas de lotería</p>
              </Card>
              <Card 
                className="p-4 sm:p-6 cursor-pointer hover:shadow-lg transition-shadow border-primary/20"
                onClick={() => setCurrentView('system-commissions')}
              >
                <h3 className="text-lg sm:text-xl font-semibold mb-2 text-primary">Comisiones</h3>
                <p className="text-sm sm:text-base text-muted-foreground">Configurar comisiones de sistemas</p>
              </Card>
              <Card 
                className="p-4 sm:p-6 cursor-pointer hover:shadow-lg transition-shadow border-primary/20"
                onClick={() => setCurrentView('weekly-cuadre-complete')}
              >
                <h3 className="text-lg sm:text-xl font-semibold mb-2 text-primary">Cuadre Semanal</h3>
                <p className="text-sm sm:text-base text-muted-foreground">Ver cuadre semanal completo</p>
              </Card>
            </div>
          </div>
        );
    }
  };

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="min-h-screen flex w-full bg-muted/30">
        <AdminSidebar currentView={currentView} onViewChange={setCurrentView} />
        
        <div className="flex-1 flex flex-col">
          <header className="bg-primary border-b px-6 py-4 sticky top-0 z-10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <SidebarTrigger className="text-primary-foreground" />
                <div>
                  <h1 className="text-2xl font-bold text-primary-foreground">
                    Panel de Administración
                  </h1>
                  <p className="text-primary-foreground/80">
                    Bienvenido, {profile?.full_name || "Administrador"}
                  </p>
                </div>
              </div>
              <Button variant="secondary" onClick={signOut}>
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
};