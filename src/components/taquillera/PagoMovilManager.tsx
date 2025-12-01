import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { PagoMovilRecibidos } from './PagoMovilRecibidos';
import { PagoMovilPagados } from './PagoMovilPagados';
import { PagoMovilHistorial } from './PagoMovilHistorial';

interface PagoMovilManagerProps {
  onSuccess?: () => void;
  dateRange?: {
    from: Date;
    to: Date;
  };
}

export const PagoMovilManager = ({ onSuccess, dateRange }: PagoMovilManagerProps) => {
  const [activeTab, setActiveTab] = useState('recibidos');
  const [refreshHistorial, setRefreshHistorial] = useState(0);

  const handleSuccess = () => {
    onSuccess?.();
    setRefreshHistorial(prev => prev + 1);
    // Disparar evento para que CuadreGeneral se actualice
    window.dispatchEvent(new CustomEvent('mobile-payment-updated'));
  };

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="recibidos" className="flex items-center gap-2">
            <ArrowDownLeft className="h-4 w-4" />
            Pagos Recibidos
          </TabsTrigger>
          <TabsTrigger value="pagados" className="flex items-center gap-2">
            <ArrowUpRight className="h-4 w-4" />
            Pagos Pagados
          </TabsTrigger>
        </TabsList>

        <TabsContent value="recibidos" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Pagos Móviles Recibidos</CardTitle>
              <CardDescription>
                Registra los pagos móviles recibidos de clientes en Bs
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PagoMovilRecibidos onSuccess={handleSuccess} dateRange={dateRange} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pagados" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Pagos Móviles Pagados</CardTitle>
              <CardDescription>
                Registra los pagos móviles pagados a clientes (premios)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PagoMovilPagados onSuccess={handleSuccess} dateRange={dateRange} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Historial de pagos móviles siempre visible */}
      <Card>
        <CardHeader>
          <CardTitle>Pagos Móviles Registrados</CardTitle>
          <CardDescription>
            Revisa y edita los pagos móviles del día
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PagoMovilHistorial refreshKey={refreshHistorial} dateRange={dateRange} />
        </CardContent>
      </Card>
    </div>
  );
};