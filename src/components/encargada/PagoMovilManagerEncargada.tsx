import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { PagoMovilRecibidos } from '../taquillera/PagoMovilRecibidos';
import { PagoMovilPagados } from '../taquillera/PagoMovilPagados';
import { PagoMovilHistorialEncargada } from './PagoMovilHistorialEncargada';

interface PagoMovilManagerEncargadaProps {
  onSuccess?: () => void;
  selectedAgency: string;
  selectedDate: Date;
}

export const PagoMovilManagerEncargada = ({ onSuccess, selectedAgency, selectedDate }: PagoMovilManagerEncargadaProps) => {
  const [activeTab, setActiveTab] = useState('recibidos');
  const [refreshHistorial, setRefreshHistorial] = useState(0);

  const handleSuccess = () => {
    onSuccess?.();
    setRefreshHistorial(prev => prev + 1);
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
              <PagoMovilRecibidos 
                onSuccess={handleSuccess}
                selectedAgency={selectedAgency}
                selectedDate={selectedDate}
              />
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
              <PagoMovilPagados 
                onSuccess={handleSuccess}
                selectedAgency={selectedAgency}
                selectedDate={selectedDate}
              />
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
          <PagoMovilHistorialEncargada 
            refreshKey={refreshHistorial} 
            selectedAgency={selectedAgency}
            selectedDate={selectedDate}
            onDataChange={handleSuccess}
          />
        </CardContent>
      </Card>
    </div>
  );
};