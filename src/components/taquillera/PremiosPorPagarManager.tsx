import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Gift, CheckCircle } from 'lucide-react';
import { PremiosPorPagar } from './PremiosPorPagar';
import { PremiosPorPagarHistorial } from './PremiosPorPagarHistorial';

interface PremiosPorPagarManagerProps {
  onSuccess?: () => void;
  dateRange?: {
    from: Date;
    to: Date;
  };
}

export const PremiosPorPagarManager = ({ onSuccess, dateRange }: PremiosPorPagarManagerProps) => {
  const [activeTab, setActiveTab] = useState('pending');
  const [refreshHistorial, setRefreshHistorial] = useState(0);

  const handleSuccess = () => {
    onSuccess?.();
    // Disparar evento para que CuadreGeneral se actualice
    window.dispatchEvent(new CustomEvent('pending-prize-updated'));
    setRefreshHistorial(prev => prev + 1);
  };

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="pending" className="flex items-center gap-2">
            <Gift className="h-4 w-4" />
            Por Pagar
          </TabsTrigger>
          <TabsTrigger value="paid" className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4" />
            Pagados
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-6">
          <PremiosPorPagar 
            mode="pending" 
            onSuccess={handleSuccess} 
            dateRange={dateRange}
          />
        </TabsContent>

        <TabsContent value="paid" className="space-y-6">
          <PremiosPorPagar 
            mode="paid" 
            onSuccess={handleSuccess} 
            dateRange={dateRange}
          />
        </TabsContent>
      </Tabs>

      {/* Historial de premios siempre visible */}
      <Card>
        <CardHeader>
          <CardTitle>Premios Registrados</CardTitle>
          <CardDescription>
            Revisa y edita los premios del día
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PremiosPorPagarHistorial 
            refreshKey={refreshHistorial} 
            dateRange={dateRange} 
          />
        </CardContent>
      </Card>
    </div>
  );
};