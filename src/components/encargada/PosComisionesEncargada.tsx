import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { formatCurrency } from '@/lib/utils';
import { Zap, RefreshCw, ChevronLeft, ChevronRight, AlertTriangle, Split } from 'lucide-react';
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks } from 'date-fns';
import { es } from 'date-fns/locale';
import { posCommissionsService, type CommissionRow, type PosBank } from '@/services/posCommissionsService';

export function PosComisionesEncargada() {
  const { user, profile } = useAuth();
  const { toast } = useToast();

  const [currentWeek, setCurrentWeek] = useState<{ start: Date; end: Date }>(() => {
    const now = new Date();
    return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) };
  });

  const [rows, setRows] = useState<CommissionRow[]>([]);
  const [bcvRate, setBcvRate] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Split management state
  const [splits, setSplits] = useState<Record<string, number>>({});
  const [banks, setBanks] = useState<PosBank[]>([]);
  const [assignments, setAssignments] = useState<{ agency_id: string; bank_id: string }[]>([]);
  const [posTotals, setPosTotals] = useState<Map<string, number>>(new Map());

  const agencyId = profile?.agency_id ?? undefined;

  const navigateWeek = (dir: 'prev' | 'next') => {
    const newStart = dir === 'prev' ? subWeeks(currentWeek.start, 1) : addWeeks(currentWeek.start, 1);
    setCurrentWeek({ start: newStart, end: endOfWeek(newStart, { weekStartsOn: 1 }) });
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [liveRows, suggestedBcv, banksData, assignsData, splitsData, posMap] = await Promise.all([
        posCommissionsService.getLiveCommissionsForWeek(currentWeek.start, currentWeek.end),
        posCommissionsService.fetchSuggestedBcv(currentWeek.start),
        posCommissionsService.fetchBanks(),
        posCommissionsService.fetchAssignments(),
        posCommissionsService.fetchSplits(currentWeek.start),
        posCommissionsService.fetchPosTotalsByAgency(currentWeek.start, currentWeek.end),
      ]);
      // Filter by agency if encargada has one assigned
      const filtered = agencyId ? liveRows.filter(r => r.agency_id === agencyId) : liveRows;
      setRows(filtered);
      setBanks(banksData);
      setAssignments(assignsData.filter(a => a.is_active));
      setPosTotals(posMap);

      // Build splits map
      const splitMap: Record<string, number> = {};
      splitsData.forEach((s: any) => { splitMap[`${s.agency_id}_${s.bank_id}`] = Number(s.sales_bs); });
      setSplits(splitMap);

      if (suggestedBcv && !bcvRate) {
        setBcvRate(String(suggestedBcv));
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentWeek.start.toISOString()]);

  // Compute multi-bank agencies that need splits (filtered to encargada's agency)
  const splitAgencies = useMemo(() => {
    const byAgency = new Map<string, { agencyName: string; banks: PosBank[]; total: number }>();
    const filteredAssignments = agencyId
      ? assignments.filter(a => a.agency_id === agencyId)
      : assignments;

    filteredAssignments.forEach((a) => {
      const bank = banks.find((b) => b.id === a.bank_id);
      if (!bank) return;
      if (!byAgency.has(a.agency_id)) {
        // Find agency name from rows or use agency_id
        const row = rows.find(r => r.agency_id === a.agency_id);
        const agencyName = row?.agency_name || a.agency_id;
        byAgency.set(a.agency_id, { agencyName, banks: [], total: posTotals.get(a.agency_id) || 0 });
      }
      byAgency.get(a.agency_id)!.banks.push(bank);
    });
    return Array.from(byAgency.entries())
      .filter(([, x]) => x.banks.length > 1)
      .map(([id, x]) => ({ agencyId: id, ...x }));
  }, [assignments, banks, posTotals, agencyId, rows]);

  // Save a split value
  const saveSplit = async (targetAgencyId: string, bankId: string, value: number) => {
    if (!user) return;
    try {
      await posCommissionsService.upsertSplit({
        agency_id: targetAgencyId,
        bank_id: bankId,
        week_start: currentWeek.start,
        week_end: currentWeek.end,
        sales_bs: value,
        user_id: user.id,
      });
      setSplits((prev) => ({ ...prev, [`${targetAgencyId}_${bankId}`]: value }));
      // Reload to recalculate commissions with the new split
      await loadData();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  const handleSave = async () => {
    if (!user) return;
    const bcv = Number(bcvRate);
    if (!bcv || bcv <= 0) {
      toast({ title: 'Tasa BCV requerida', description: 'Ingresa la tasa BCV antes de guardar.', variant: 'destructive' });
      return;
    }
    const pending = liveRows.filter(r => r.needs_split);
    if (pending.length > 0) {
      toast({
        title: 'Datos incompletos',
        description: `Debes registrar el split para: ${pending.map(r => r.bank_name).join(', ')}. Usa la sección "Splits Multi-banco" más abajo.`,
        variant: 'destructive',
      });
      return;
    }
    const readyRows = liveRows.filter(r => !r.needs_split);
    if (readyRows.length === 0) {
      toast({ title: 'Sin comisiones', description: 'No hay comisiones para guardar.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const res = await posCommissionsService.generateCommissions({
        weekStart: currentWeek.start,
        weekEnd: currentWeek.end,
        bcvRate: bcv,
        rows: readyRows,
        userId: user.id,
      });
      toast({
        title: '✓ Comisiones POS guardadas',
        description: `${res.inserted} comisiones registradas en Gastos Fijos. Se reflejan en el balance de la semana.`,
      });
      // Refresh so user sees updated state
      await loadData();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  // Recalculate commission amounts in real-time whenever bcvRate changes
  const liveRows = useMemo(() => {
    const bcv = Number(bcvRate) || 0;
    return rows.map(r => {
      if (r.needs_split) return r;
      const variable_amount_bs = r.sales_bs * (r.variable_percentage / 100);
      const fixed_amount_bs = r.monthly_fixed_usd * bcv;
      const total_bs = variable_amount_bs + fixed_amount_bs;
      return { ...r, variable_amount_bs, fixed_amount_bs, total_bs };
    });
  }, [rows, bcvRate]);

  const totalCommission = liveRows.filter(r => !r.needs_split).reduce((s, r) => s + r.total_bs, 0);
  const hasPendingSplits = liveRows.some(r => r.needs_split);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <CardTitle>Comisiones POS – Punto de Venta</CardTitle>
              <CardDescription>
                Revisa las comisiones calculadas y regístralas con la tasa BCV del momento para que se reflejen en el balance semanal.
              </CardDescription>
            </div>
            {/* Week navigator */}
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={() => navigateWeek('prev')}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="text-center min-w-[230px] border rounded-md py-1.5 px-3 bg-muted/20">
                <p className="text-sm font-medium">
                  {format(currentWeek.start, "d 'de' MMM", { locale: es })} — {format(currentWeek.end, "d 'de' MMM 'de' yyyy", { locale: es })}
                </p>
              </div>
              <Button variant="outline" size="icon" onClick={() => navigateWeek('next')}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* BCV row */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-1">
              <label className="text-sm font-medium">Tasa BCV (Bs/$)</label>
              <Input
                type="number"
                step="0.01"
                value={bcvRate}
                onChange={e => setBcvRate(e.target.value)}
                placeholder="Ej: 36.50"
                className="font-mono text-right mt-1"
              />
            </div>
            <div className="md:col-span-3 flex items-end gap-2">
              <Button
                onClick={handleSave}
                disabled={saving || loading || rows.length === 0}
                className="gap-2"
              >
                <Zap className="h-4 w-4" />
                {saving ? 'Guardando...' : 'Guardar Comisiones'}
              </Button>
              <Button variant="outline" onClick={loadData} disabled={loading} className="gap-2">
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                Actualizar
              </Button>
            </div>
          </div>

          {hasPendingSplits && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>Tu agencia tiene múltiples bancos POS asignados. Registra el split de ventas por banco en la sección de abajo para calcular las comisiones correctamente.</span>
            </div>
          )}

          {/* Commission table */}
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead className="pl-4">Banco</TableHead>
                  <TableHead className="text-right">Ventas brutas (Bs)</TableHead>
                  <TableHead className="text-right">% Variable</TableHead>
                  <TableHead className="text-right">Variable (Bs)</TableHead>
                  <TableHead className="text-right">Fijo (Bs)</TableHead>
                  <TableHead className="text-right pr-4">Total Comisión (Bs)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Cargando datos...
                    </TableCell>
                  </TableRow>
                )}
                {!loading && rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No hay bancos POS asignados a tu agencia. El administrador debe configurarlos.
                    </TableCell>
                  </TableRow>
                )}
                {liveRows.map(r => (
                  <TableRow key={`${r.agency_id}_${r.bank_id}`} className={r.needs_split ? 'bg-amber-50' : 'hover:bg-muted/20'}>
                    <TableCell className="pl-4 font-medium">
                      {r.bank_name}
                      {r.needs_split && (
                        <Badge variant="outline" className="ml-2 text-[10px] border-amber-400 text-amber-700">Falta split</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono">{formatCurrency(r.sales_bs, 'VES')}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{r.variable_percentage}%</TableCell>
                    <TableCell className="text-right font-mono">{r.needs_split ? '—' : formatCurrency(r.variable_amount_bs, 'VES')}</TableCell>
                    <TableCell className="text-right font-mono">{r.needs_split ? '—' : formatCurrency(r.fixed_amount_bs, 'VES')}</TableCell>
                    <TableCell className="text-right font-mono font-semibold text-blue-600 pr-4">
                      {r.needs_split ? '—' : formatCurrency(r.total_bs, 'VES')}
                    </TableCell>
                  </TableRow>
                ))}
                {rows.length > 0 && (
                  <TableRow className="bg-primary/5 font-bold border-t-2">
                    <TableCell colSpan={5} className="pl-4 text-right">TOTAL A REGISTRAR:</TableCell>
                    <TableCell className="text-right font-mono text-blue-600 pr-4">{formatCurrency(totalCommission, 'VES')}</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <p className="text-xs text-muted-foreground">
            Al guardar, los montos reemplazan cualquier comisión POS anterior para esta semana. Puedes actualizar y volver a guardar en cualquier momento para recalcular con la tasa BCV más reciente o con más ventas.
          </p>
        </CardContent>
      </Card>

      {/* Split management section — only shown when the encargada's agency has multi-bank assignments */}
      {splitAgencies.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Split className="h-5 w-5" />
              Splits Multi-banco
            </CardTitle>
            <CardDescription>
              Tu agencia tiene varios bancos POS. Registra cuánto del total POS de la semana corresponde a cada banco.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {splitAgencies.map(({ agencyId: agId, agencyName, banks: agBanks, total }) => {
              const sumSplits = agBanks.reduce((acc, b) => acc + (splits[`${agId}_${b.id}`] || 0), 0);
              const diff = total - sumSplits;
              return (
                <div key={agId} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{agencyName}</span>
                    <span className="text-sm text-muted-foreground">
                      Total POS semana: <span className="font-semibold text-foreground">{formatCurrency(total, 'VES')}</span>
                    </span>
                  </div>
                  {agBanks.map((bank) => {
                    const key = `${agId}_${bank.id}`;
                    return (
                      <div key={bank.id} className="flex items-center gap-3">
                        <div className="w-40 font-medium text-sm">{bank.name}</div>
                        <Input
                          type="number"
                          step="0.01"
                          value={splits[key] ?? ''}
                          placeholder="Bs vendidos por este banco"
                          onChange={(e) => setSplits((prev) => ({ ...prev, [key]: Number(e.target.value) || 0 }))}
                          onBlur={(e) => saveSplit(agId, bank.id, Number(e.target.value) || 0)}
                          className="max-w-[240px] font-mono"
                        />
                      </div>
                    );
                  })}
                  <div className={`text-sm ${Math.abs(diff) > 0.01 ? 'text-destructive' : 'text-emerald-600'}`}>
                    Suma splits: {formatCurrency(sumSplits, 'VES')} · Diferencia vs POS: {formatCurrency(diff, 'VES')}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
