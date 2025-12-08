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
import { AdminFixedExpensesView } from "./AdminFixedExpensesView";
import { BanqueoManager } from "./BanqueoManager";
import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { 
  LogOut, 
  Building2, 
  FolderTree, 
  UserCircle, 
  Users, 
  Settings, 
  Percent, 
  DollarSign,
  Grid3x3,
  Edit3,
  FileSpreadsheet,
  TrendingUp,
  Landmark
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";

type AdminView = 'agencies' | 'groups' | 'users' | 'systems' | 'system-commissions' | 'weekly-cuadre-complete' | 'ganancias' | 'systems-summary' | 'systems-summary-manual' | 'dashboard' | 'clients' | 'fixed-expenses' | 'banqueo';
export const AdminDashboard = () => {
  const [currentView, setCurrentView] = useState<AdminView>('dashboard');
  const {
    user,
    signOut
  } = useAuth();
  const {
    toast
  } = useToast();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user]);
  const fetchProfile = async () => {
    try {
      const {
        data,
        error
      } = await supabase.from('profiles').select('*').eq('user_id', user?.id).single();
      if (error) throw error;
      setProfile(data);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "No se pudo cargar el perfil",
        variant: "destructive"
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
      case 'fixed-expenses':
        return <AdminFixedExpensesView />;
      case 'banqueo':
        return <BanqueoManager />;
      default:
        return <div className="p-4 sm:p-6">
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">Panel de Administración</h1>
            <p className="text-muted-foreground mb-8">Gestiona tu sistema de lotería desde aquí</p>
            
            {/* Sección Configuración */}
            <div className="mb-8">
              <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
                <span className="w-1 h-6 bg-primary rounded"></span>
                Configuración
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="p-6 cursor-pointer hover:shadow-lg hover:border-primary/40 transition-all group" onClick={() => setCurrentView('agencies')}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-colors">
                      <Building2 className="h-5 w-5 text-primary" />
                    </div>
                    <h3 className="text-lg font-semibold text-foreground">Agencias</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">Gestionar agencias del sistema</p>
                </Card>
                
                <Card className="p-6 cursor-pointer hover:shadow-lg hover:border-primary/40 transition-all group" onClick={() => setCurrentView('groups')}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-colors">
                      <FolderTree className="h-5 w-5 text-primary" />
                    </div>
                    <h3 className="text-lg font-semibold text-foreground">Grupos</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">Organizar agencias en grupos</p>
                </Card>
                
                <Card className="p-6 cursor-pointer hover:shadow-lg hover:border-primary/40 transition-all group" onClick={() => setCurrentView('clients')}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-colors">
                      <UserCircle className="h-5 w-5 text-primary" />
                    </div>
                    <h3 className="text-lg font-semibold text-foreground">Clientes</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">Administrar clientes del sistema</p>
                </Card>
                
                <Card className="p-6 cursor-pointer hover:shadow-lg hover:border-primary/40 transition-all group" onClick={() => setCurrentView('users')}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-colors">
                      <Users className="h-5 w-5 text-primary" />
                    </div>
                    <h3 className="text-lg font-semibold text-foreground">Usuarios</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">Administrar taquilleros y roles</p>
                </Card>
                
                <Card className="p-6 cursor-pointer hover:shadow-lg hover:border-primary/40 transition-all group" onClick={() => setCurrentView('systems')}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-colors">
                      <Settings className="h-5 w-5 text-primary" />
                    </div>
                    <h3 className="text-lg font-semibold text-foreground">Sistemas</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">Configurar sistemas de lotería</p>
                </Card>
                
                <Card className="p-6 cursor-pointer hover:shadow-lg hover:border-primary/40 transition-all group" onClick={() => setCurrentView('system-commissions')}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-colors">
                      <Percent className="h-5 w-5 text-primary" />
                    </div>
                    <h3 className="text-lg font-semibold text-foreground">Comisiones</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">Configurar comisiones de sistemas</p>
                </Card>
                
                <Card className="p-6 cursor-pointer hover:shadow-lg hover:border-primary/40 transition-all group" onClick={() => setCurrentView('fixed-expenses')}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-colors">
                      <DollarSign className="h-5 w-5 text-primary" />
                    </div>
                    <h3 className="text-lg font-semibold text-foreground">Gastos Fijos</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">Gestionar gastos fijos semanales</p>
                </Card>
              </div>
            </div>
            
            {/* Sección Reportes */}
            <div>
              <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
                <span className="w-1 h-6 bg-primary rounded"></span>
                Reportes
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="p-6 cursor-pointer hover:shadow-lg hover:border-primary/40 transition-all group" onClick={() => setCurrentView('systems-summary')}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-colors">
                      <Grid3x3 className="h-5 w-5 text-primary" />
                    </div>
                    <h3 className="text-lg font-semibold text-foreground">Resumen por Sistemas</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">Ver resumen consolidado por sistemas</p>
                </Card>
                
                <Card className="p-6 cursor-pointer hover:shadow-lg hover:border-primary/40 transition-all group" onClick={() => setCurrentView('systems-summary-manual')}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-colors">
                      <Edit3 className="h-5 w-5 text-primary" />
                    </div>
                    <h3 className="text-lg font-semibold text-foreground">Resumen Operadoras</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">Entrada manual de datos operadoras</p>
                </Card>
                
                <Card className="p-6 cursor-pointer hover:shadow-lg hover:border-primary/40 transition-all group" onClick={() => setCurrentView('weekly-cuadre-complete')}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-colors">
                      <FileSpreadsheet className="h-5 w-5 text-primary" />
                    </div>
                    <h3 className="text-lg font-semibold text-foreground">Cuadre Semanal</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">Ver cuadre semanal completo</p>
                </Card>
                
                <Card className="p-6 cursor-pointer hover:shadow-lg hover:border-primary/40 transition-all group" onClick={() => setCurrentView('ganancias')}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-colors">
                      <TrendingUp className="h-5 w-5 text-primary" />
                    </div>
                    <h3 className="text-lg font-semibold text-foreground">Ganancias</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">Análisis de ganancias y distribución</p>
                </Card>
                
                <Card className="p-6 cursor-pointer hover:shadow-lg hover:border-primary/40 transition-all group" onClick={() => setCurrentView('banqueo')}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-colors">
                      <Landmark className="h-5 w-5 text-primary" />
                    </div>
                    <h3 className="text-lg font-semibold text-foreground">Banqueo</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">Ver datos de banqueo por cliente</p>
                </Card>
              </div>
            </div>
          </div>;
    }
  };
  return <SidebarProvider defaultOpen={true}>
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
    </SidebarProvider>;
};