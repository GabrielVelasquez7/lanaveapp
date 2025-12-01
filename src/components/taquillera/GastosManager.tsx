import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Receipt, CreditCard } from 'lucide-react';
import { GastosOperativosForm } from './GastosOperativosForm';
import { DeudasForm } from './DeudasForm';
import { GastosHistorial } from './GastosHistorial';

interface GastosManagerProps {
  onSuccess?: () => void;
  dateRange?: {
    from: Date;
    to: Date;
  };
}

export const GastosManager = ({ onSuccess, dateRange }: GastosManagerProps) => {
  const [activeTab, setActiveTab] = useState('gastos-operativos');
  const [refreshHistorial, setRefreshHistorial] = useState(0);

  const handleSuccess = () => {
    onSuccess?.();
    setRefreshHistorial(prev => prev + 1);
    // Disparar evento para que CuadreGeneral se actualice
    window.dispatchEvent(new CustomEvent('expense-updated'));
  };

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="gastos-operativos" className="flex items-center gap-2">
            <Receipt className="h-4 w-4" />
            Gastos Operativos
          </TabsTrigger>
          <TabsTrigger value="deudas" className="flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            Deudas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="gastos-operativos" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Gastos Operativos</CardTitle>
              <CardDescription>
                Registra gastos operativos del día
              </CardDescription>
            </CardHeader>
            <CardContent>
              <GastosOperativosForm onSuccess={handleSuccess} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="deudas" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Deudas</CardTitle>
              <CardDescription>
                Registra deudas y compromisos pendientes
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DeudasForm onSuccess={handleSuccess} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Historial de gastos siempre visible */}
      <Card>
        <CardHeader>
          <CardTitle>Gastos Registrados</CardTitle>
          <CardDescription>
            Revisa y edita los gastos del día
          </CardDescription>
        </CardHeader>
        <CardContent>
          <GastosHistorial refreshKey={refreshHistorial} dateRange={dateRange} />
        </CardContent>
      </Card>
    </div>
  );
};