import { useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { formatCurrency } from '@/lib/utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Calculator, CheckCircle2, Save, TrendingUp, TrendingDown, ChevronDown, ChevronRight, AlertTriangle } from 'lucide-react';
import { useTaquilleraCuadre } from '@/hooks/useTaquilleraCuadre';
import { useState } from 'react';

interface CuadreGeneralProps {
  refreshKey?: number;
  dateRange?: { from: Date; to: Date; };
  onDateLockChange?: (locked: boolean) => void;
}

export const CuadreGeneral = ({ refreshKey = 0, dateRange, onDateLockChange }: CuadreGeneralProps) => {

  const {
    cuadre,
    formState,
    setFormState,
    loading,
    saving,
    handleSaveClosure,
    totals,
    refresh
  } = useTaquilleraCuadre(dateRange);

  useEffect(() => {
    if (refreshKey > 0) refresh();
  }, [refreshKey, refresh]);

  // UI State for collapsibles
  const [gastosOpen, setGastosOpen] = useState(false);
  const [deudasOpen, setDeudasOpen] = useState(false);
  const [gastosUsdOpen, setGastosUsdOpen] = useState(false);
  const [deudasUsdOpen, setDeudasUsdOpen] = useState(false);

  // Notify parent about lock state
  useEffect(() => {
    if (onDateLockChange) {
      const isLocked = cuadre.closureConfirmed && !cuadre.encargadaFeedback; // Pending approval
      onDateLockChange(isLocked);
    }
  }, [cuadre.closureConfirmed, cuadre.encargadaFeedback, onDateLockChange]);


  if (loading) {
    return <div className="p-8 text-center"><Calculator className="h-8 w-8 animate-spin mx-auto text-primary" /><p>Calculando...</p></div>;
  }

  // Status Logic
  const isClosed = cuadre.closureConfirmed;
  const status = cuadre.encargadaFeedback?.encargada_status;
  const isApproved = status === 'aprobado';
  const isRejected = status === 'rechazado';
  const isPending = isClosed && !status;

  return (
    <div className="space-y-6">
      {/* Status Badges */}
      <div className="flex gap-2">
        {isClosed && <Badge variant="secondary" className="bg-emerald-100 text-emerald-800">Cierre Confirmado</Badge>}
        {isApproved && <Badge className="bg-emerald-600">Aprobado por Encargada</Badge>}
        {isRejected && <Badge variant="destructive">Rechazado: {cuadre.encargadaFeedback?.encargada_observations}</Badge>}
        {isPending && <Badge variant="outline" className="animate-pulse">Pendiente de Revisión</Badge>}
      </div>

      {/* Exchange Rate */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="pt-4 text-center">
          <span className="text-muted-foreground mr-2">Tasa del día:</span>
          <span className="font-bold text-lg">{formState.exchangeRate} Bs/USD</span>
        </CardContent>
      </Card>

      {/* Forms */}
      <Card className={`border-2 ${isClosed ? 'opacity-80' : 'border-primary/20'}`}>
        <CardHeader><CardTitle className="text-sm uppercase text-muted-foreground">Cierre de Caja</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Tasa BCV</Label>
              <Input
                disabled={isClosed}
                type="number"
                value={formState.exchangeRate}
                onChange={e => setFormState(p => ({ ...p, exchangeRate: e.target.value }))}
                className="text-center font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label>Efectivo (Bs)</Label>
              <Input
                disabled={isClosed}
                type="number"
                value={formState.cashAvailable}
                onChange={e => setFormState(p => ({ ...p, cashAvailable: e.target.value }))}
                className="text-center font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label>Efectivo (USD)</Label>
              <Input
                disabled={isClosed}
                type="number"
                value={formState.cashAvailableUsd}
                onChange={e => setFormState(p => ({ ...p, cashAvailableUsd: e.target.value }))}
                className="text-center font-mono"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Observaciones</Label>
            <Textarea
              disabled={isClosed}
              value={formState.closureNotes}
              onChange={e => setFormState(p => ({ ...p, closureNotes: e.target.value }))}
              placeholder="Notas del cierre..."
            />
          </div>

          {/* Ajustes Adicionales */}
          <div className="p-4 border rounded-lg bg-muted/20 space-y-4">
            <div className="flex justify-between items-center">
              <Label>Aplicar Excedente USD a Bs</Label>
              <Switch
                checked={formState.applyExcessUsd}
                onCheckedChange={v => setFormState(p => ({ ...p, applyExcessUsd: v }))}
                disabled={isClosed}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Adicional (Bs)</Label>
                <Input
                  disabled={isClosed}
                  type="number"
                  value={formState.additionalAmountBs}
                  onChange={e => setFormState(p => ({ ...p, additionalAmountBs: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Adicional (USD)</Label>
                <Input
                  disabled={isClosed}
                  type="number"
                  value={formState.additionalAmountUsd}
                  onChange={e => setFormState(p => ({ ...p, additionalAmountUsd: e.target.value }))}
                />
              </div>
            </div>
            <Input
              disabled={isClosed}
              placeholder="Motivo del adicional..."
              value={formState.additionalNotes}
              onChange={e => setFormState(p => ({ ...p, additionalNotes: e.target.value }))}
            />
          </div>

          {!isClosed && (
            <Button className="w-full" size="lg" onClick={() => handleSaveClosure()} disabled={saving}>
              <Save className="mr-2 h-4 w-4" />
              {saving ? 'Guardando...' : 'Confirmar Cierre Diario'}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Resumen - Read Only View of Totals */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Bs Summary */}
        <Card>
          <CardHeader><CardTitle className="text-emerald-700">Resumen Bolívares</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Efectivo Caja" value={parseFloat(formState.cashAvailable)} />
            <Row label="Banco (PM + POS)" value={totals.totalBanco} />
            <Collapsible open={gastosOpen} onOpenChange={setGastosOpen}>
              <CollapsibleTrigger asChild><div className="flex justify-between hover:bg-muted p-1 rounded cursor-pointer"><span className="flex items-center"><ChevronRight className={`h-4 w-4 transition-transform ${gastosOpen ? 'rotate-90' : ''}`} /> Gastos</span><span>{formatCurrency(cuadre.totalGastos.bs, 'VES')}</span></div></CollapsibleTrigger>
              <CollapsibleContent className="pl-4 text-xs text-muted-foreground">
                {cuadre.gastosDetails.filter((g: any) => Number(g.amount_bs) > 0).map((g: any, i: number) => <div key={i} className="flex justify-between"><span>{g.description}</span><span>{formatCurrency(g.amount_bs, 'VES')}</span></div>)}
              </CollapsibleContent>
            </Collapsible>
            <Row label="Deudas" value={cuadre.totalDeudas.bs} />
            {totals.excessUsdInBs > 0 && <Row label="Excedente USD conv." value={totals.excessUsdInBs} className="text-blue-600" />}
            <Row label="Adicional" value={-parseFloat(formState.additionalAmountBs)} className="text-red-500" />
            <Separator />
            <Row label="Total Sumatoria" value={totals.sumatoriaBolivares} bold />

            <div className="mt-4 pt-4 border-t-2 border-dashed">
              <Row label="Cuadre (Ventas - Premios)" value={totals.cuadreVentasPremios.bs} />
              <Row label="Diferencia" value={totals.sumatoriaBolivares - totals.cuadreVentasPremios.bs} />
              <Row label="Premios por Pagar" value={-cuadre.premiosPorPagar} className="text-orange-600" />
              <div className={`mt-2 p-3 rounded text-center font-bold text-xl ${Math.abs(totals.diferenciaFinal) <= 100 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                {formatCurrency(totals.diferenciaFinal, 'VES')}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* USD Summary */}
        <Card>
          <CardHeader><CardTitle className="text-purple-700">Resumen Dólares</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Efectivo Caja" value={parseFloat(formState.cashAvailableUsd)} isUsd />
            <Collapsible open={gastosUsdOpen} onOpenChange={setGastosUsdOpen}>
              <CollapsibleTrigger asChild><div className="flex justify-between hover:bg-muted p-1 rounded cursor-pointer"><span className="flex items-center"><ChevronRight className={`h-4 w-4 transition-transform ${gastosUsdOpen ? 'rotate-90' : ''}`} /> Gastos</span><span>{formatCurrency(cuadre.totalGastos.usd, 'USD')}</span></div></CollapsibleTrigger>
              <CollapsibleContent className="pl-4 text-xs text-muted-foreground">
                {cuadre.gastosDetails.filter((g: any) => Number(g.amount_usd) > 0).map((g: any, i: number) => <div key={i} className="flex justify-between"><span>{g.description}</span><span>{formatCurrency(g.amount_usd, 'USD')}</span></div>)}
              </CollapsibleContent>
            </Collapsible>
            <Row label="Deudas" value={cuadre.totalDeudas.usd} isUsd />
            <Separator />
            <Row label="Total Sumatoria" value={totals.sumatoriaUsd} isUsd bold />

            <div className="mt-4 pt-4 border-t-2 border-dashed">
              <Row label="Cuadre (Ventas - Premios)" value={totals.cuadreVentasPremios.usd} isUsd />
              <Row label="Adicional" value={-parseFloat(formState.additionalAmountUsd)} isUsd />
              <Row label="Premios por Pagar" value={-cuadre.premiosPorPagarUsd} isUsd className="text-orange-600" />
              <div className={`mt-2 p-3 rounded text-center font-bold text-xl ${Math.abs(totals.diferenciaFinalUsd) <= 5 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                {formatCurrency(totals.diferenciaFinalUsd, 'USD')}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

const Row = ({ label, value, isUsd, bold, className }: any) => (
  <div className={`flex justify-between items-center p-1 ${className}`}>
    <span className={bold ? "font-bold" : "text-muted-foreground"}>{label}</span>
    <span className={`font-mono ${bold ? "font-bold" : ""}`}>{formatCurrency(value, isUsd ? 'USD' : 'VES')}</span>
  </div>
);