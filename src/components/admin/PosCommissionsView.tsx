import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, Plus, Trash2, Pencil, Zap, RefreshCw } from 'lucide-react';
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks } from 'date-fns';
import { es } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/components/ui/use-toast';
import { formatCurrency } from '@/lib/utils';
import { calcCommission, posCommissionsService, type CommissionRow, type PosBank } from '@/services/posCommissionsService';

interface Agency { id: string; name: string; }

export function PosCommissionsView() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [currentWeek, setCurrentWeek] = useState<{ start: Date; end: Date }>(() => {
    const now = new Date();
    return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) };
  });

  const [banks, setBanks] = useState<PosBank[]>([]);
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [assignments, setAssignments] = useState<{ agency_id: string; bank_id: string }[]>([]);
  const [splits, setSplits] = useState<Record<string, number>>({}); // key: `${agency_id}_${bank_id}`
  const [posTotals, setPosTotals] = useState<Map<string, number>>(new Map());
  const [bcvRate, setBcvRate] = useState<string>('');
  const [loading, setLoading] = useState(false);

  // Bank dialog
  const [bankDialogOpen, setBankDialogOpen] = useState(false);
  const [editingBank, setEditingBank] = useState<PosBank | null>(null);
  const [bankForm, setBankForm] = useState({ name: '', variable_percentage: '0', monthly_fixed_usd: '0' });

  // Generate dialog
  const [generateOpen, setGenerateOpen] = useState(false);

  useEffect(() => {
    loadAll();
  }, [currentWeek.start.toISOString()]);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [banksData, agenciesData, assignsData, splitsData, posMap, suggestedBcv] = await Promise.all([
        posCommissionsService.fetchBanks(),
        supabase.from('agencies').select('id, name').eq('is_active', true).order('name'),
        posCommissionsService.fetchAssignments(),
        posCommissionsService.fetchSplits(currentWeek.start),
        posCommissionsService.fetchPosTotalsByAgency(currentWeek.start, currentWeek.end),
        posCommissionsService.fetchSuggestedBcv(currentWeek.start),
      ]);
      setBanks(banksData);
      setAgencies((agenciesData.data || []) as Agency[]);
      setAssignments(assignsData.filter((a) => a.is_active));
      const splitMap: Record<string, number> = {};
      splitsData.forEach((s: any) => { splitMap[`${s.agency_id}_${s.bank_id}`] = Number(s.sales_bs); });
      setSplits(splitMap);
      setPosTotals(posMap);
      if (suggestedBcv) setBcvRate(String(suggestedBcv));
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const navigateWeek = (dir: 'prev' | 'next') => {
    const newStart = dir === 'prev' ? subWeeks(currentWeek.start, 1) : addWeeks(currentWeek.start, 1);
    setCurrentWeek({ start: newStart, end: endOfWeek(newStart, { weekStartsOn: 1 }) });
  };

  // Compute commission rows from current state
  const commissionRows: CommissionRow[] = useMemo(() => {
    const bcv = Number(bcvRate) || 0;
    const rows: CommissionRow[] = [];
    // Group assignments by agency
    const byAgency = new Map<string, string[]>();
    assignments.forEach((a) => {
      if (!byAgency.has(a.agency_id)) byAgency.set(a.agency_id, []);
      byAgency.get(a.agency_id)!.push(a.bank_id);
    });

    byAgency.forEach((bankIds, agencyId) => {
      const agency = agencies.find((a) => a.id === agencyId);
      if (!agency) return;
      const totalPos = posTotals.get(agencyId) || 0;
      const isMulti = bankIds.length > 1;

      bankIds.forEach((bankId) => {
        const bank = banks.find((b) => b.id === bankId);
        if (!bank) return;
        let salesBs = 0;
        let needsSplit = false;
        if (isMulti) {
          const splitVal = splits[`${agencyId}_${bankId}`];
          if (splitVal === undefined) needsSplit = true;
          salesBs = splitVal || 0;
        } else {
          salesBs = totalPos;
        }
        const c = calcCommission({
          salesBs,
          variablePercentage: Number(bank.variable_percentage),
          monthlyFixedUsd: Number(bank.monthly_fixed_usd),
          bcvRate: bcv,
        });
        rows.push({
          agency_id: agencyId,
          agency_name: agency.name,
          bank_id: bankId,
          bank_name: bank.name,
          variable_percentage: Number(bank.variable_percentage),
          monthly_fixed_usd: Number(bank.monthly_fixed_usd),
          sales_bs: salesBs,
          variable_amount_bs: c.variable_amount_bs,
          fixed_amount_bs: c.fixed_amount_bs,
          total_bs: c.total_bs,
          needs_split: needsSplit,
        });
      });
    });
    return rows.sort((a, b) => a.agency_name.localeCompare(b.agency_name) || a.bank_name.localeCompare(b.bank_name));
  }, [assignments, agencies, banks, splits, posTotals, bcvRate]);

  const totals = useMemo(() => {
    return commissionRows.reduce((acc, r) => ({
      sales: acc.sales + r.sales_bs,
      variable: acc.variable + r.variable_amount_bs,
      fixed: acc.fixed + r.fixed_amount_bs,
      total: acc.total + r.total_bs,
    }), { sales: 0, variable: 0, fixed: 0, total: 0 });
  }, [commissionRows]);

  // Bank CRUD
  const openNewBank = () => {
    setEditingBank(null);
    setBankForm({ name: '', variable_percentage: '0', monthly_fixed_usd: '0' });
    setBankDialogOpen(true);
  };
  const openEditBank = (bank: PosBank) => {
    setEditingBank(bank);
    setBankForm({
      name: bank.name,
      variable_percentage: String(bank.variable_percentage),
      monthly_fixed_usd: String(bank.monthly_fixed_usd),
    });
    setBankDialogOpen(true);
  };
  const saveBank = async () => {
    try {
      const payload = {
        name: bankForm.name.trim(),
        variable_percentage: Number(bankForm.variable_percentage) || 0,
        monthly_fixed_usd: Number(bankForm.monthly_fixed_usd) || 0,
      };
      if (!payload.name) {
        toast({ title: 'Nombre requerido', variant: 'destructive' });
        return;
      }
      if (editingBank) {
        const { error } = await supabase.from('pos_banks' as any).update(payload).eq('id', editingBank.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('pos_banks' as any).insert(payload);
        if (error) throw error;
      }
      toast({ title: 'Banco guardado' });
      setBankDialogOpen(false);
      loadAll();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };
  const deleteBank = async (id: string) => {
    if (!confirm('¿Eliminar este banco? Sus asignaciones también se eliminarán.')) return;
    try {
      await supabase.from('agency_pos_banks' as any).delete().eq('bank_id', id);
      const { error } = await supabase.from('pos_banks' as any).delete().eq('id', id);
      if (error) throw error;
      toast({ title: 'Banco eliminado' });
      loadAll();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  // Assignment toggle
  const toggleAssignment = async (agencyId: string, bankId: string, checked: boolean) => {
    try {
      if (checked) {
        const { error } = await supabase
          .from('agency_pos_banks' as any)
          .upsert({ agency_id: agencyId, bank_id: bankId, is_active: true }, { onConflict: 'agency_id,bank_id' });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('agency_pos_banks' as any)
          .delete()
          .eq('agency_id', agencyId)
          .eq('bank_id', bankId);
        if (error) throw error;
      }
      loadAll();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  // Save split
  const saveSplit = async (agencyId: string, bankId: string, value: number) => {
    if (!user) return;
    try {
      await posCommissionsService.upsertSplit({
        agency_id: agencyId,
        bank_id: bankId,
        week_start: currentWeek.start,
        week_end: currentWeek.end,
        sales_bs: value,
        user_id: user.id,
      });
      setSplits((prev) => ({ ...prev, [`${agencyId}_${bankId}`]: value }));
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  const handleGenerate = async () => {
    if (!user) return;
    const bcv = Number(bcvRate);
    if (!bcv || bcv <= 0) {
      toast({ title: 'Tasa BCV requerida', description: 'Ingresa la tasa BCV antes de generar.', variant: 'destructive' });
      return;
    }
    const pendingSplits = commissionRows.filter((r) => r.needs_split);
    if (pendingSplits.length > 0) {
      const list = pendingSplits.map((r) => `${r.agency_name} - ${r.bank_name}`).join(', ');
      toast({
        title: 'Faltan splits',
        description: `Define el split semanal para: ${list}`,
        variant: 'destructive',
      });
      return;
    }
    try {
      const res = await posCommissionsService.generateCommissions({
        weekStart: currentWeek.start,
        weekEnd: currentWeek.end,
        bcvRate: bcv,
        rows: commissionRows,
        userId: user.id,
      });
      toast({
        title: '✓ Comisiones generadas',
        description: `Se cargaron ${res.inserted} gastos de comisión POS en Gastos Fijos (Bs).`,
      });
      setGenerateOpen(false);
    } catch (e: any) {
      toast({ title: 'Error al generar', description: e.message, variant: 'destructive' });
    }
  };

  // Multi-bank agencies needing split inputs
  const splitAgencies = useMemo(() => {
    const byAgency = new Map<string, { agency: Agency; banks: PosBank[]; total: number }>();
    assignments.forEach((a) => {
      const agency = agencies.find((x) => x.id === a.agency_id);
      const bank = banks.find((b) => b.id === a.bank_id);
      if (!agency || !bank) return;
      if (!byAgency.has(agency.id)) {
        byAgency.set(agency.id, { agency, banks: [], total: posTotals.get(agency.id) || 0 });
      }
      byAgency.get(agency.id)!.banks.push(bank);
    });
    return Array.from(byAgency.values()).filter((x) => x.banks.length > 1);
  }, [assignments, agencies, banks, posTotals]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <CardTitle>Comisiones de Puntos de Venta (POS)</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Gestiona bancos, asignaciones y genera los gastos de comisión semanal automáticamente.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={() => navigateWeek('prev')}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="text-center min-w-[260px]">
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
        <CardContent>
          <Tabs defaultValue="report" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="report">Reporte Semanal</TabsTrigger>
              <TabsTrigger value="splits">Splits Multi-banco</TabsTrigger>
              <TabsTrigger value="banks">Bancos</TabsTrigger>
              <TabsTrigger value="assignments">Asignaciones</TabsTrigger>
            </TabsList>

            {/* REPORTE */}
            <TabsContent value="report" className="mt-6 space-y-4">
              <div className="flex items-end gap-4 flex-wrap">
                <div className="flex-1 min-w-[200px] max-w-[260px]">
                  <Label>Tasa BCV (Bs/USD)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={bcvRate}
                    onChange={(e) => setBcvRate(e.target.value)}
                    placeholder="Ej: 36.50"
                  />
                </div>
                <Button onClick={() => setGenerateOpen(true)} disabled={commissionRows.length === 0}>
                  <Zap className="h-4 w-4 mr-2" /> Generar / Regenerar Comisiones
                </Button>
                <Button variant="outline" onClick={loadAll} disabled={loading}>
                  <RefreshCw className="h-4 w-4 mr-2" /> Refrescar
                </Button>
              </div>

              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Agencia</TableHead>
                      <TableHead>Banco</TableHead>
                      <TableHead className="text-right">Ventas Brutas (Bs)</TableHead>
                      <TableHead className="text-right">% Variable</TableHead>
                      <TableHead className="text-right">Variable (Bs)</TableHead>
                      <TableHead className="text-right">Fijo USD/mes</TableHead>
                      <TableHead className="text-right">Fijo (Bs)</TableHead>
                      <TableHead className="text-right">Total (Bs)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {commissionRows.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-muted-foreground py-6">
                          No hay agencias con bancos asignados.
                        </TableCell>
                      </TableRow>
                    )}
                    {commissionRows.map((r) => (
                      <TableRow key={`${r.agency_id}_${r.bank_id}`} className={r.needs_split ? 'bg-destructive/5' : ''}>
                        <TableCell className="font-medium">{r.agency_name}</TableCell>
                        <TableCell>
                          {r.bank_name}
                          {r.needs_split && <Badge variant="destructive" className="ml-2 text-[10px]">Falta split</Badge>}
                        </TableCell>
                        <TableCell className="text-right font-mono">{formatCurrency(r.sales_bs, 'VES')}</TableCell>
                        <TableCell className="text-right">{r.variable_percentage}%</TableCell>
                        <TableCell className="text-right font-mono">{formatCurrency(r.variable_amount_bs, 'VES')}</TableCell>
                        <TableCell className="text-right">${r.monthly_fixed_usd}</TableCell>
                        <TableCell className="text-right font-mono">{formatCurrency(r.fixed_amount_bs, 'VES')}</TableCell>
                        <TableCell className="text-right font-mono font-semibold">{formatCurrency(r.total_bs, 'VES')}</TableCell>
                      </TableRow>
                    ))}
                    {commissionRows.length > 0 && (
                      <TableRow className="bg-primary/5 font-bold">
                        <TableCell colSpan={2}>TOTALES</TableCell>
                        <TableCell className="text-right font-mono">{formatCurrency(totals.sales, 'VES')}</TableCell>
                        <TableCell />
                        <TableCell className="text-right font-mono">{formatCurrency(totals.variable, 'VES')}</TableCell>
                        <TableCell />
                        <TableCell className="text-right font-mono">{formatCurrency(totals.fixed, 'VES')}</TableCell>
                        <TableCell className="text-right font-mono">{formatCurrency(totals.total, 'VES')}</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            {/* SPLITS */}
            <TabsContent value="splits" className="mt-6 space-y-4">
              <p className="text-sm text-muted-foreground">
                Para agencias con varios bancos POS, registra cuánto del total POS de la semana corresponde a cada banco.
              </p>
              {splitAgencies.length === 0 && (
                <div className="text-center text-muted-foreground py-6">
                  No hay agencias con múltiples bancos asignados.
                </div>
              )}
              {splitAgencies.map(({ agency, banks: agBanks, total }) => {
                const sumSplits = agBanks.reduce((acc, b) => acc + (splits[`${agency.id}_${b.id}`] || 0), 0);
                const diff = total - sumSplits;
                return (
                  <Card key={agency.id}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">{agency.name}</CardTitle>
                        <div className="text-sm text-muted-foreground">
                          Total POS semana: <span className="font-semibold text-foreground">{formatCurrency(total, 'VES')}</span>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {agBanks.map((bank) => {
                        const key = `${agency.id}_${bank.id}`;
                        return (
                          <div key={bank.id} className="flex items-center gap-3">
                            <div className="w-32 font-medium">{bank.name}</div>
                            <Input
                              type="number"
                              step="0.01"
                              value={splits[key] ?? ''}
                              placeholder="Bs vendidos por este banco"
                              onChange={(e) => setSplits((prev) => ({ ...prev, [key]: Number(e.target.value) || 0 }))}
                              onBlur={(e) => saveSplit(agency.id, bank.id, Number(e.target.value) || 0)}
                              className="max-w-[240px]"
                            />
                          </div>
                        );
                      })}
                      <div className={`text-sm ${Math.abs(diff) > 0.01 ? 'text-destructive' : 'text-emerald-600'}`}>
                        Suma splits: {formatCurrency(sumSplits, 'VES')} · Diferencia vs POS: {formatCurrency(diff, 'VES')}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </TabsContent>

            {/* BANCOS */}
            <TabsContent value="banks" className="mt-6 space-y-4">
              <div className="flex justify-end">
                <Button onClick={openNewBank}>
                  <Plus className="h-4 w-4 mr-2" /> Nuevo Banco
                </Button>
              </div>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre</TableHead>
                      <TableHead className="text-right">% Variable</TableHead>
                      <TableHead className="text-right">Fijo Mensual (USD)</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {banks.map((b) => (
                      <TableRow key={b.id}>
                        <TableCell className="font-medium">{b.name}</TableCell>
                        <TableCell className="text-right">{b.variable_percentage}%</TableCell>
                        <TableCell className="text-right">${b.monthly_fixed_usd}</TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="ghost" onClick={() => openEditBank(b)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => deleteBank(b.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            {/* ASIGNACIONES */}
            <TabsContent value="assignments" className="mt-6">
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Agencia</TableHead>
                      {banks.map((b) => (
                        <TableHead key={b.id} className="text-center">{b.name}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {agencies.map((agency) => (
                      <TableRow key={agency.id}>
                        <TableCell className="font-medium">{agency.name}</TableCell>
                        {banks.map((b) => {
                          const checked = assignments.some((a) => a.agency_id === agency.id && a.bank_id === b.id);
                          return (
                            <TableCell key={b.id} className="text-center">
                              <Checkbox
                                checked={checked}
                                onCheckedChange={(v) => toggleAssignment(agency.id, b.id, !!v)}
                              />
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Bank Dialog */}
      <Dialog open={bankDialogOpen} onOpenChange={setBankDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingBank ? 'Editar Banco' : 'Nuevo Banco'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nombre</Label>
              <Input value={bankForm.name} onChange={(e) => setBankForm({ ...bankForm, name: e.target.value })} />
            </div>
            <div>
              <Label>% Variable</Label>
              <Input
                type="number"
                step="0.01"
                value={bankForm.variable_percentage}
                onChange={(e) => setBankForm({ ...bankForm, variable_percentage: e.target.value })}
              />
            </div>
            <div>
              <Label>Fijo Mensual (USD)</Label>
              <Input
                type="number"
                step="0.01"
                value={bankForm.monthly_fixed_usd}
                onChange={(e) => setBankForm({ ...bankForm, monthly_fixed_usd: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBankDialogOpen(false)}>Cancelar</Button>
            <Button onClick={saveBank}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Generate */}
      <Dialog open={generateOpen} onOpenChange={setGenerateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generar Comisiones POS de la Semana</DialogTitle>
            <DialogDescription>
              Se crearán {commissionRows.length} gastos en "Gastos Fijos (Bs)" para la semana actual usando la tasa BCV{' '}
              <strong>{bcvRate}</strong>. Si ya existían comisiones POS de esta semana se reemplazarán.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGenerateOpen(false)}>Cancelar</Button>
            <Button onClick={handleGenerate}>Confirmar y Generar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}