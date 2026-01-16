import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Calculator, DollarSign, Gift, LogOut, Receipt, Smartphone, CreditCard, Calendar as CalendarIcon, ChevronLeft, ChevronRight, Eye } from 'lucide-react';
import { useDemo } from '@/contexts/DemoContext';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { formatCurrency } from '@/lib/utils';
import { 
  demoSalesTransactions, 
  demoDailyCuadreSummary, 
  demoExpenses, 
  demoMobilePayments,
  demoPendingPrizes 
} from '@/data/demoData';

export function DemoTaquilleraDashboard() {
  const { demoUser, exitDemoMode } = useDemo();
  const [activeTab, setActiveTab] = useState('transacciones');
  const [selectedDate] = useState(new Date());

  const totals = demoSalesTransactions.reduce(
    (acc, t) => ({
      sales_bs: acc.sales_bs + t.sales_bs,
      sales_usd: acc.sales_usd + t.sales_usd,
      prizes_bs: acc.prizes_bs + t.prizes_bs,
      prizes_usd: acc.prizes_usd + t.prizes_usd,
    }),
    { sales_bs: 0, sales_usd: 0, prizes_bs: 0, prizes_usd: 0 }
  );

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="bg-primary border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Badge variant="secondary" className="bg-amber-500/20 text-amber-600 border-amber-300">
              <Eye className="h-3 w-3 mr-1" />
              DEMO
            </Badge>
            <div>
              <h1 className="text-2xl font-bold text-primary-foreground">Sistema de Cuadres</h1>
              <p className="text-primary-foreground/80">
                Bienvenida, {demoUser?.full_name} - {demoUser?.role}
              </p>
            </div>
          </div>
          <Button variant="secondary" onClick={exitDemoMode}>
            <LogOut className="h-4 w-4 mr-2" />
            Salir Demo
          </Button>
        </div>
      </header>

      <main className="container mx-auto p-6">
        {/* Date Filter */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Filtro de Fechas</span>
              <Button variant="default" size="sm">Hoy</Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm"><ChevronLeft className="h-4 w-4" /></Button>
                <Button variant="outline" className="min-w-[280px]">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(selectedDate, "dd 'de' MMMM, yyyy", { locale: es })}
                </Button>
                <Button variant="outline" size="sm" disabled><ChevronRight className="h-4 w-4" /></Button>
              </div>
              <Badge variant="secondary">1 día</Badge>
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
            {/* Totals Summary */}
            <Card className="border-primary/20">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Resumen del Día</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-3 bg-green-500/10 rounded-lg">
                    <p className="text-sm text-muted-foreground">Ventas Bs</p>
                    <p className="text-xl font-bold text-green-600">{formatCurrency(totals.sales_bs, 'VES')}</p>
                  </div>
                  <div className="text-center p-3 bg-green-500/10 rounded-lg">
                    <p className="text-sm text-muted-foreground">Ventas USD</p>
                    <p className="text-xl font-bold text-green-600">{formatCurrency(totals.sales_usd, 'USD')}</p>
                  </div>
                  <div className="text-center p-3 bg-red-500/10 rounded-lg">
                    <p className="text-sm text-muted-foreground">Premios Bs</p>
                    <p className="text-xl font-bold text-red-600">{formatCurrency(totals.prizes_bs, 'VES')}</p>
                  </div>
                  <div className="text-center p-3 bg-red-500/10 rounded-lg">
                    <p className="text-sm text-muted-foreground">Premios USD</p>
                    <p className="text-xl font-bold text-red-600">{formatCurrency(totals.prizes_usd, 'USD')}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Transactions Table */}
            <Card>
              <CardHeader>
                <CardTitle>Ventas y Premios por Sistema</CardTitle>
                <CardDescription>Registro de transacciones del día</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Sistema</TableHead>
                      <TableHead className="text-right">Ventas Bs</TableHead>
                      <TableHead className="text-right">Ventas USD</TableHead>
                      <TableHead className="text-right">Premios Bs</TableHead>
                      <TableHead className="text-right">Premios USD</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {demoSalesTransactions.map((t) => (
                      <TableRow key={t.lottery_system_id}>
                        <TableCell className="font-medium">{t.lottery_system_name}</TableCell>
                        <TableCell className="text-right font-mono">{formatCurrency(t.sales_bs, 'VES')}</TableCell>
                        <TableCell className="text-right font-mono">{formatCurrency(t.sales_usd, 'USD')}</TableCell>
                        <TableCell className="text-right font-mono">{formatCurrency(t.prizes_bs, 'VES')}</TableCell>
                        <TableCell className="text-right font-mono">{formatCurrency(t.prizes_usd, 'USD')}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted/50 font-semibold">
                      <TableCell>TOTAL</TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(totals.sales_bs, 'VES')}</TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(totals.sales_usd, 'USD')}</TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(totals.prizes_bs, 'VES')}</TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(totals.prizes_usd, 'USD')}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="gastos">
            <Card>
              <CardHeader>
                <CardTitle>Gastos del Día</CardTitle>
                <CardDescription>Registro de gastos operativos</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Descripción</TableHead>
                      <TableHead>Categoría</TableHead>
                      <TableHead className="text-right">Monto Bs</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {demoExpenses.map((e) => (
                      <TableRow key={e.id}>
                        <TableCell>{e.description}</TableCell>
                        <TableCell><Badge variant="outline">{e.category}</Badge></TableCell>
                        <TableCell className="text-right font-mono">{formatCurrency(e.amount_bs, 'VES')}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="pago-movil">
            <Card>
              <CardHeader>
                <CardTitle>Pagos Móviles</CardTitle>
                <CardDescription>Transferencias recibidas del día</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Referencia</TableHead>
                      <TableHead>Descripción</TableHead>
                      <TableHead className="text-right">Monto Bs</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {demoMobilePayments.map((mp) => (
                      <TableRow key={mp.id}>
                        <TableCell className="font-mono">{mp.reference_number}</TableCell>
                        <TableCell>{mp.description}</TableCell>
                        <TableCell className="text-right font-mono">{formatCurrency(mp.amount_bs, 'VES')}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="premios-por-pagar">
            <Card>
              <CardHeader>
                <CardTitle>Premios por Pagar</CardTitle>
                <CardDescription>Premios pendientes de pago</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Descripción</TableHead>
                      <TableHead className="text-right">Monto Bs</TableHead>
                      <TableHead>Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {demoPendingPrizes.map((pp) => (
                      <TableRow key={pp.id}>
                        <TableCell>{pp.description}</TableCell>
                        <TableCell className="text-right font-mono">{formatCurrency(pp.amount_bs, 'VES')}</TableCell>
                        <TableCell>
                          <Badge variant={pp.is_paid ? 'default' : 'destructive'}>
                            {pp.is_paid ? 'Pagado' : 'Pendiente'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="punto-venta">
            <Card>
              <CardHeader>
                <CardTitle>Punto de Venta</CardTitle>
                <CardDescription>Transacciones con tarjeta del día</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-muted-foreground">
                  <CreditCard className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Total en punto de venta: <strong>{formatCurrency(demoDailyCuadreSummary.total_pos_bs, 'VES')}</strong></p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="cuadre-sistemas">
            <Card>
              <CardHeader>
                <CardTitle>Cuadre por Sistema</CardTitle>
                <CardDescription>Balance por cada sistema de lotería</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Sistema</TableHead>
                      <TableHead className="text-right">Ventas Bs</TableHead>
                      <TableHead className="text-right">Premios Bs</TableHead>
                      <TableHead className="text-right">Balance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {demoSalesTransactions.map((t) => (
                      <TableRow key={t.lottery_system_id}>
                        <TableCell className="font-medium">{t.lottery_system_name}</TableCell>
                        <TableCell className="text-right font-mono text-green-600">{formatCurrency(t.sales_bs, 'VES')}</TableCell>
                        <TableCell className="text-right font-mono text-red-600">{formatCurrency(t.prizes_bs, 'VES')}</TableCell>
                        <TableCell className="text-right font-mono font-bold">{formatCurrency(t.sales_bs - t.prizes_bs, 'VES')}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="cuadre-general">
            <Card>
              <CardHeader>
                <CardTitle>Cuadre General del Día</CardTitle>
                <CardDescription>Resumen financiero completo</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="p-4 bg-green-500/10 rounded-lg">
                    <p className="text-sm text-muted-foreground">Total Ventas Bs</p>
                    <p className="text-2xl font-bold text-green-600">{formatCurrency(demoDailyCuadreSummary.total_sales_bs, 'VES')}</p>
                  </div>
                  <div className="p-4 bg-red-500/10 rounded-lg">
                    <p className="text-sm text-muted-foreground">Total Premios Bs</p>
                    <p className="text-2xl font-bold text-red-600">{formatCurrency(demoDailyCuadreSummary.total_prizes_bs, 'VES')}</p>
                  </div>
                  <div className="p-4 bg-yellow-500/10 rounded-lg">
                    <p className="text-sm text-muted-foreground">Gastos Bs</p>
                    <p className="text-2xl font-bold text-yellow-600">{formatCurrency(demoDailyCuadreSummary.total_expenses_bs, 'VES')}</p>
                  </div>
                  <div className="p-4 bg-blue-500/10 rounded-lg">
                    <p className="text-sm text-muted-foreground">Balance</p>
                    <p className="text-2xl font-bold text-blue-600">{formatCurrency(demoDailyCuadreSummary.balance_bs, 'VES')}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 border rounded-lg">
                    <p className="text-sm text-muted-foreground">Efectivo Disponible Bs</p>
                    <p className="text-xl font-bold">{formatCurrency(demoDailyCuadreSummary.cash_available_bs, 'VES')}</p>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <p className="text-sm text-muted-foreground">Efectivo Disponible USD</p>
                    <p className="text-xl font-bold">{formatCurrency(demoDailyCuadreSummary.cash_available_usd, 'USD')}</p>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <p className="text-sm text-muted-foreground">Tasa de Cambio</p>
                    <p className="text-xl font-bold">{demoDailyCuadreSummary.exchange_rate} Bs/$</p>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <p className="text-sm text-muted-foreground">Premios Pendientes</p>
                    <p className="text-xl font-bold text-orange-600">{formatCurrency(demoDailyCuadreSummary.pending_prizes, 'VES')}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
