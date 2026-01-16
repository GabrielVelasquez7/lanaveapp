import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { Sidebar, SidebarContent, SidebarHeader, SidebarMenu, SidebarMenuItem, SidebarMenuButton } from '@/components/ui/sidebar';
import { LogOut, Eye, Calendar, Building2, Wallet, BarChart3, Users, CreditCard, Landmark, CheckCircle, XCircle } from 'lucide-react';
import { useDemo } from '@/contexts/DemoContext';
import { formatCurrency } from '@/lib/utils';
import { 
  demoWeeklySummary, 
  demoDailyCuadres,
  demoEmployees,
  demoWeeklyPayroll,
  demoInterAgencyLoans,
} from '@/data/demoData';

type EncargadaView = 'cuadre-semanal' | 'cuadre-agencias' | 'prestamos-deudas' | 'resumen-sistemas' | 'banco-semanal' | 'empleados' | 'nomina' | 'banqueo';

export function DemoEncargadaDashboard() {
  const { demoUser, exitDemoMode } = useDemo();
  const [activeTab, setActiveTab] = useState<EncargadaView>('cuadre-semanal');

  const menuItems = [
    { id: 'cuadre-semanal', label: 'Cuadre Semanal', icon: Calendar },
    { id: 'cuadre-agencias', label: 'Cuadres Agencias', icon: Building2 },
    { id: 'resumen-sistemas', label: 'Resumen Sistemas', icon: BarChart3 },
    { id: 'banco-semanal', label: 'Banco Semanal', icon: CreditCard },
    { id: 'prestamos-deudas', label: 'Préstamos/Deudas', icon: Wallet },
    { id: 'empleados', label: 'Empleados', icon: Users },
    { id: 'nomina', label: 'Nómina', icon: Wallet },
    { id: 'banqueo', label: 'Banqueo', icon: Landmark },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'cuadre-semanal':
        return (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Cuadre Semanal - Agencias</CardTitle>
                <CardDescription>Semana del {demoWeeklySummary.week_start} al {demoWeeklySummary.week_end}</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Agencia</TableHead>
                      <TableHead className="text-right">Ventas Bs</TableHead>
                      <TableHead className="text-right">Ventas USD</TableHead>
                      <TableHead className="text-right">Premios Bs</TableHead>
                      <TableHead className="text-right">Balance Bs</TableHead>
                      <TableHead className="text-right">Efectivo Bs</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {demoWeeklySummary.agencies.map((agency) => (
                      <TableRow key={agency.agency_id}>
                        <TableCell className="font-medium">{agency.agency_name}</TableCell>
                        <TableCell className="text-right font-mono text-green-600">{formatCurrency(agency.total_sales_bs, 'VES')}</TableCell>
                        <TableCell className="text-right font-mono text-green-600">{formatCurrency(agency.total_sales_usd, 'USD')}</TableCell>
                        <TableCell className="text-right font-mono text-red-600">{formatCurrency(agency.total_prizes_bs, 'VES')}</TableCell>
                        <TableCell className="text-right font-mono font-bold">{formatCurrency(agency.balance_bs, 'VES')}</TableCell>
                        <TableCell className="text-right font-mono">{formatCurrency(agency.cash_available_bs, 'VES')}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        );

      case 'cuadre-agencias':
        return (
          <Card>
            <CardHeader>
              <CardTitle>Cuadres Diarios por Revisar</CardTitle>
              <CardDescription>Cuadres pendientes de aprobación</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Taquillero</TableHead>
                    <TableHead>Agencia</TableHead>
                    <TableHead className="text-right">Ventas Bs</TableHead>
                    <TableHead className="text-right">Premios Bs</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {demoDailyCuadres.map((cuadre) => (
                    <TableRow key={cuadre.id}>
                      <TableCell>{cuadre.session_date}</TableCell>
                      <TableCell>{cuadre.user_name}</TableCell>
                      <TableCell>{cuadre.agency_name}</TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(cuadre.total_sales_bs, 'VES')}</TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(cuadre.total_prizes_bs, 'VES')}</TableCell>
                      <TableCell className="text-right font-mono font-bold">{formatCurrency(cuadre.balance_bs, 'VES')}</TableCell>
                      <TableCell>
                        <Badge variant={cuadre.encargada_status === 'aprobado' ? 'default' : cuadre.encargada_status === 'rechazado' ? 'destructive' : 'secondary'}>
                          {cuadre.encargada_status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {cuadre.encargada_status === 'pendiente' && (
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" className="text-green-600">
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="outline" className="text-red-600">
                              <XCircle className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        );

      case 'empleados':
        return (
          <Card>
            <CardHeader>
              <CardTitle>Empleados</CardTitle>
              <CardDescription>Gestión de empleados de la agencia</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead className="text-right">Salario Base Bs</TableHead>
                    <TableHead className="text-right">Salario Base USD</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {demoEmployees.map((emp) => (
                    <TableRow key={emp.id}>
                      <TableCell className="font-medium">{emp.name}</TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(emp.base_salary_bs, 'VES')}</TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(emp.base_salary_usd, 'USD')}</TableCell>
                      <TableCell>
                        <Badge variant={emp.is_active ? 'default' : 'secondary'}>
                          {emp.is_active ? 'Activo' : 'Inactivo'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        );

      case 'nomina':
        return (
          <Card>
            <CardHeader>
              <CardTitle>Nómina Semanal</CardTitle>
              <CardDescription>Cálculo de nómina de la semana</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Empleado</TableHead>
                    <TableHead className="text-right">Base</TableHead>
                    <TableHead className="text-right">Bonos</TableHead>
                    <TableHead className="text-right">Deducciones</TableHead>
                    <TableHead className="text-right">Domingo</TableHead>
                    <TableHead className="text-right">Total Bs</TableHead>
                    <TableHead className="text-right">Total USD</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {demoWeeklyPayroll.map((payroll) => (
                    <TableRow key={payroll.id}>
                      <TableCell className="font-medium">{payroll.employee_name}</TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(payroll.weekly_base_salary, 'VES')}</TableCell>
                      <TableCell className="text-right font-mono text-green-600">+{formatCurrency(payroll.bonuses_extras, 'VES')}</TableCell>
                      <TableCell className="text-right font-mono text-red-600">-{formatCurrency(payroll.absences_deductions, 'VES')}</TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(payroll.sunday_payment, 'VES')}</TableCell>
                      <TableCell className="text-right font-mono font-bold">{formatCurrency(payroll.total_bs, 'VES')}</TableCell>
                      <TableCell className="text-right font-mono font-bold">{formatCurrency(payroll.total_usd, 'USD')}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        );

      case 'prestamos-deudas':
        return (
          <Card>
            <CardHeader>
              <CardTitle>Préstamos entre Agencias</CardTitle>
              <CardDescription>Gestión de préstamos y deudas</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Origen</TableHead>
                    <TableHead>Destino</TableHead>
                    <TableHead className="text-right">Monto Bs</TableHead>
                    <TableHead>Razón</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {demoInterAgencyLoans.map((loan) => (
                    <TableRow key={loan.id}>
                      <TableCell>{loan.loan_date}</TableCell>
                      <TableCell>{loan.from_agency_name}</TableCell>
                      <TableCell>{loan.to_agency_name}</TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(loan.amount_bs, 'VES')}</TableCell>
                      <TableCell>{loan.reason}</TableCell>
                      <TableCell>
                        <Badge variant={loan.status === 'pagado' ? 'default' : 'secondary'}>
                          {loan.status}
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
          <Card>
            <CardHeader>
              <CardTitle>{menuItems.find(m => m.id === activeTab)?.label}</CardTitle>
              <CardDescription>Contenido de demostración</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-muted-foreground">
                <p>Vista de demostración para {activeTab}</p>
              </div>
            </CardContent>
          </Card>
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
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.id}>
                  <SidebarMenuButton
                    isActive={activeTab === item.id}
                    onClick={() => setActiveTab(item.id as EncargadaView)}
                  >
                    <item.icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
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
                      Sistema de Cuadres - Encargada
                    </h1>
                    <p className="text-primary-foreground/80">
                      Bienvenida, {demoUser?.full_name} - {demoUser?.agency_name}
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
            {renderContent()}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
