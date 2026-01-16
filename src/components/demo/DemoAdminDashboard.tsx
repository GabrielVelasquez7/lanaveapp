import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { Sidebar, SidebarContent, SidebarHeader, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarGroup, SidebarGroupLabel } from '@/components/ui/sidebar';
import { 
  LogOut, Eye, Building2, FolderTree, UserCircle, Users, Settings, Percent, 
  DollarSign, Grid3x3, Edit3, FileSpreadsheet, TrendingUp, Landmark, Wallet, UserCog 
} from 'lucide-react';
import { useDemo } from '@/contexts/DemoContext';
import { formatCurrency } from '@/lib/utils';
import { 
  demoAgencies, 
  demoClients, 
  demoUsers, 
  demoLotterySystems,
  demoSystemCommissions,
  demoSystemsSummary,
  demoBanqueoData,
  demoWeeklyExpenses,
} from '@/data/demoData';

type AdminView = 'dashboard' | 'agencies' | 'groups' | 'clients' | 'users' | 'systems' | 'system-commissions' | 'fixed-expenses' | 'employees' | 'payroll' | 'systems-summary' | 'systems-summary-manual' | 'weekly-cuadre' | 'ganancias' | 'banqueo';

export function DemoAdminDashboard() {
  const { demoUser, exitDemoMode } = useDemo();
  const [currentView, setCurrentView] = useState<AdminView>('dashboard');

  const configItems = [
    { id: 'agencies', label: 'Agencias', icon: Building2 },
    { id: 'groups', label: 'Grupos', icon: FolderTree },
    { id: 'clients', label: 'Clientes', icon: UserCircle },
    { id: 'users', label: 'Usuarios', icon: Users },
    { id: 'systems', label: 'Sistemas', icon: Settings },
    { id: 'system-commissions', label: 'Comisiones', icon: Percent },
    { id: 'fixed-expenses', label: 'Gastos Fijos', icon: DollarSign },
  ];

  const managementItems = [
    { id: 'employees', label: 'Empleados', icon: UserCog },
    { id: 'payroll', label: 'Nómina', icon: Wallet },
  ];

  const reportItems = [
    { id: 'systems-summary', label: 'Resumen Sistemas', icon: Grid3x3 },
    { id: 'systems-summary-manual', label: 'Resumen Operadoras', icon: Edit3 },
    { id: 'weekly-cuadre', label: 'Cuadre Semanal', icon: FileSpreadsheet },
    { id: 'ganancias', label: 'Ganancias', icon: TrendingUp },
    { id: 'banqueo', label: 'Banqueo', icon: Landmark },
  ];

  const renderContent = () => {
    switch (currentView) {
      case 'agencies':
        return (
          <Card>
            <CardHeader>
              <CardTitle>Agencias</CardTitle>
              <CardDescription>Gestión de agencias del sistema</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Dirección</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {demoAgencies.map((agency) => (
                    <TableRow key={agency.id}>
                      <TableCell className="font-medium">{agency.name}</TableCell>
                      <TableCell>{agency.address}</TableCell>
                      <TableCell>
                        <Badge variant={agency.is_active ? 'default' : 'secondary'}>
                          {agency.is_active ? 'Activa' : 'Inactiva'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        );

      case 'clients':
        return (
          <Card>
            <CardHeader>
              <CardTitle>Clientes</CardTitle>
              <CardDescription>Clientes registrados en el sistema</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {demoClients.map((client) => (
                    <TableRow key={client.id}>
                      <TableCell className="font-medium">{client.name}</TableCell>
                      <TableCell>
                        <Badge variant={client.is_active ? 'default' : 'secondary'}>
                          {client.is_active ? 'Activo' : 'Inactivo'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        );

      case 'users':
        return (
          <Card>
            <CardHeader>
              <CardTitle>Usuarios</CardTitle>
              <CardDescription>Usuarios del sistema</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Rol</TableHead>
                    <TableHead>Agencia</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {demoUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.full_name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{user.role}</Badge>
                      </TableCell>
                      <TableCell>{user.agency_name}</TableCell>
                      <TableCell>
                        <Badge variant={user.is_active ? 'default' : 'secondary'}>
                          {user.is_active ? 'Activo' : 'Inactivo'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        );

      case 'systems':
        return (
          <Card>
            <CardHeader>
              <CardTitle>Sistemas de Lotería</CardTitle>
              <CardDescription>Configuración de sistemas</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Código</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {demoLotterySystems.map((sys) => (
                    <TableRow key={sys.id}>
                      <TableCell className="font-medium">{sys.name}</TableCell>
                      <TableCell><Badge variant="outline">{sys.code}</Badge></TableCell>
                      <TableCell>
                        <Badge variant={sys.is_active ? 'default' : 'secondary'}>
                          {sys.is_active ? 'Activo' : 'Inactivo'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        );

      case 'system-commissions':
        return (
          <Card>
            <CardHeader>
              <CardTitle>Comisiones por Sistema</CardTitle>
              <CardDescription>Configuración de porcentajes</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Sistema</TableHead>
                    <TableHead className="text-right">Comisión %</TableHead>
                    <TableHead className="text-right">Utilidad %</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {demoSystemCommissions.map((comm) => (
                    <TableRow key={comm.id}>
                      <TableCell className="font-medium">{comm.system_name}</TableCell>
                      <TableCell className="text-right font-mono">{comm.commission_percentage}%</TableCell>
                      <TableCell className="text-right font-mono">{comm.utility_percentage}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        );

      case 'fixed-expenses':
        return (
          <Card>
            <CardHeader>
              <CardTitle>Gastos Fijos Semanales</CardTitle>
              <CardDescription>Gastos recurrentes del sistema</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Descripción</TableHead>
                    <TableHead>Categoría</TableHead>
                    <TableHead className="text-right">Monto Bs</TableHead>
                    <TableHead className="text-right">Monto USD</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {demoWeeklyExpenses.map((exp) => (
                    <TableRow key={exp.id}>
                      <TableCell className="font-medium">{exp.description}</TableCell>
                      <TableCell><Badge variant="outline">{exp.category}</Badge></TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(exp.amount_bs, 'VES')}</TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(exp.amount_usd, 'USD')}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        );

      case 'systems-summary':
        return (
          <Card>
            <CardHeader>
              <CardTitle>Resumen por Sistemas</CardTitle>
              <CardDescription>Ventas, premios y utilidades por sistema</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Sistema</TableHead>
                    <TableHead className="text-right">Ventas Bs</TableHead>
                    <TableHead className="text-right">Premios Bs</TableHead>
                    <TableHead className="text-right">Comisión %</TableHead>
                    <TableHead className="text-right">Utilidad Bs</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {demoSystemsSummary.map((sys) => (
                    <TableRow key={sys.system_id}>
                      <TableCell className="font-medium">{sys.system_name}</TableCell>
                      <TableCell className="text-right font-mono text-green-600">{formatCurrency(sys.total_sales_bs, 'VES')}</TableCell>
                      <TableCell className="text-right font-mono text-red-600">{formatCurrency(sys.total_prizes_bs, 'VES')}</TableCell>
                      <TableCell className="text-right font-mono">{sys.commission_percentage}%</TableCell>
                      <TableCell className="text-right font-mono font-bold text-blue-600">{formatCurrency(sys.utility_bs, 'VES')}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        );

      case 'banqueo':
        return (
          <Card>
            <CardHeader>
              <CardTitle>Banqueo por Cliente</CardTitle>
              <CardDescription>Datos de banqueo semanal</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead className="text-right">Ventas Bs</TableHead>
                    <TableHead className="text-right">Premios Bs</TableHead>
                    <TableHead className="text-right">Participación</TableHead>
                    <TableHead>Pagado Bs</TableHead>
                    <TableHead>Pagado USD</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {demoBanqueoData.map((banqueo) => (
                    <TableRow key={banqueo.client_id}>
                      <TableCell className="font-medium">{banqueo.client_name}</TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(banqueo.sales_bs, 'VES')}</TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(banqueo.prizes_bs, 'VES')}</TableCell>
                      <TableCell className="text-right font-mono">{banqueo.participation_percentage}%</TableCell>
                      <TableCell>
                        <Badge variant={banqueo.paid_bs ? 'default' : 'destructive'}>
                          {banqueo.paid_bs ? 'Sí' : 'No'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={banqueo.paid_usd ? 'default' : 'destructive'}>
                          {banqueo.paid_usd ? 'Sí' : 'No'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        );

      default:
        return (
          <div className="space-y-8">
            {/* Dashboard principal */}
            <div>
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <span className="w-1 h-6 bg-primary rounded"></span>
                Configuración
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {configItems.map((item) => (
                  <Card 
                    key={item.id}
                    className="p-6 cursor-pointer hover:shadow-lg hover:border-primary/40 transition-all group"
                    onClick={() => setCurrentView(item.id as AdminView)}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className="p-2 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-colors">
                        <item.icon className="h-5 w-5 text-primary" />
                      </div>
                      <h3 className="text-lg font-semibold">{item.label}</h3>
                    </div>
                    <p className="text-sm text-muted-foreground">Gestionar {item.label.toLowerCase()}</p>
                  </Card>
                ))}
              </div>
            </div>

            <div>
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <span className="w-1 h-6 bg-primary rounded"></span>
                Reportes
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {reportItems.map((item) => (
                  <Card 
                    key={item.id}
                    className="p-6 cursor-pointer hover:shadow-lg hover:border-primary/40 transition-all group"
                    onClick={() => setCurrentView(item.id as AdminView)}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className="p-2 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-colors">
                        <item.icon className="h-5 w-5 text-primary" />
                      </div>
                      <h3 className="text-lg font-semibold">{item.label}</h3>
                    </div>
                    <p className="text-sm text-muted-foreground">Ver {item.label.toLowerCase()}</p>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        );
    }
  };

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="min-h-screen flex w-full bg-muted/30">
        <Sidebar>
          <SidebarHeader className="p-4 border-b">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="bg-amber-500/20 text-amber-600">
                <Eye className="h-3 w-3 mr-1" />
                DEMO
              </Badge>
            </div>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Inicio</SidebarGroupLabel>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton isActive={currentView === 'dashboard'} onClick={() => setCurrentView('dashboard')}>
                    <Grid3x3 className="h-4 w-4" />
                    <span>Dashboard</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroup>
            <SidebarGroup>
              <SidebarGroupLabel>Configuración</SidebarGroupLabel>
              <SidebarMenu>
                {configItems.map((item) => (
                  <SidebarMenuItem key={item.id}>
                    <SidebarMenuButton isActive={currentView === item.id} onClick={() => setCurrentView(item.id as AdminView)}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroup>
            <SidebarGroup>
              <SidebarGroupLabel>Reportes</SidebarGroupLabel>
              <SidebarMenu>
                {reportItems.map((item) => (
                  <SidebarMenuItem key={item.id}>
                    <SidebarMenuButton isActive={currentView === item.id} onClick={() => setCurrentView(item.id as AdminView)}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>

        <div className="flex-1 flex flex-col">
          <header className="bg-primary border-b px-6 py-4 sticky top-0 z-10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <SidebarTrigger className="text-primary-foreground" />
                <div className="flex items-center gap-3">
                  <Badge variant="secondary" className="bg-amber-500/20 text-amber-600 border-amber-300">
                    <Eye className="h-3 w-3 mr-1" />
                    DEMO
                  </Badge>
                  <div>
                    <h1 className="text-2xl font-bold text-primary-foreground">
                      Panel de Administración
                    </h1>
                    <p className="text-primary-foreground/80">
                      Bienvenido, {demoUser?.full_name}
                    </p>
                  </div>
                </div>
              </div>
              <Button variant="secondary" onClick={exitDemoMode}>
                <LogOut className="h-4 w-4 mr-2" />
                Salir Demo
              </Button>
            </div>
          </header>

          <main className="flex-1 container mx-auto p-6">
            {currentView !== 'dashboard' && (
              <Button variant="ghost" className="mb-4" onClick={() => setCurrentView('dashboard')}>
                ← Volver al Dashboard
              </Button>
            )}
            {renderContent()}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
