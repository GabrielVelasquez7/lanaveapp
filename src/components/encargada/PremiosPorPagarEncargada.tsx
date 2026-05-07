import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/utils';
import { formatDateForDB } from '@/lib/dateUtils';
import { format } from 'date-fns';
import { Plus, Minus, Save, Loader2, Trophy } from 'lucide-react';

interface EntradaPremio {
  amount_bs: string;
  amount_usd: string;
  description: string;
}

interface PremioRegistrado {
  id: string;
  amount_bs: number;
  amount_usd: number;
  description: string | null;
  is_paid: boolean;
  source: 'encargada' | 'taquillera';
  session_date?: string;
}

interface PremiosPorPagarEncargadaProps {
  selectedAgency: string;
  selectedDate: Date;
  onSuccess?: () => void;
}

// ─────────────────────────────────────────────────────────────
// Helper: obtiene o crea la sesión de la encargada para la fecha
// Mismo patrón que usa la taquillera en PremiosPorPagar.tsx
// ─────────────────────────────────────────────────────────────
const getOrCreateEncargadaSession = async (userId: string, sessionDate: string) => {
  const { data: existing } = await supabase
    .from('daily_sessions')
    .select('id')
    .eq('user_id', userId)
    .eq('session_date', sessionDate)
    .single();

  if (existing) return existing.id;

  const { data: newSession, error } = await supabase
    .from('daily_sessions')
    .insert({
      user_id: userId,
      session_date: sessionDate,
      cash_available_bs: 0,
      cash_available_usd: 0,
      exchange_rate: 36.00,
    })
    .select('id')
    .single();

  if (error) throw error;
  return newSession!.id;
};

// ─────────────────────────────────────────────────────────────
// Helper: actualiza daily_cuadres_summary de la sesión de encargada
// con la suma real de pending_prizes de esa sesión.
// ─────────────────────────────────────────────────────────────
const syncEncargadaSummary = async (sessionId: string, userId: string, sessionDate: string, agencyId: string) => {
  const { data: prizes } = await supabase
    .from('pending_prizes')
    .select('amount_bs, amount_usd, is_paid')
    .eq('session_id', sessionId);

  const unpaidBs  = (prizes || []).filter(p => !p.is_paid).reduce((s, p) => s + Number(p.amount_bs  || 0), 0);
  const unpaidUsd = (prizes || []).filter(p => !p.is_paid).reduce((s, p) => s + Number(p.amount_usd || 0), 0);

  await supabase
    .from('daily_cuadres_summary')
    .upsert({
      session_id:          sessionId,
      user_id:             userId,
      session_date:        sessionDate,
      agency_id:           agencyId,
      pending_prizes:      unpaidBs,
      pending_prizes_usd:  unpaidUsd,
    }, { onConflict: 'session_id' });
};

export const PremiosPorPagarEncargada = ({
  selectedAgency,
  selectedDate,
  onSuccess,
}: PremiosPorPagarEncargadaProps) => {
  const { user } = useAuth();
  const { toast } = useToast();

  // ── Form state ──
  const [entradas, setEntradas] = useState<EntradaPremio[]>([
    { amount_bs: '', amount_usd: '', description: '' },
  ]);
  const [saving, setSaving] = useState(false);

  // ── Historial ──
  const [premios, setPremios] = useState<PremioRegistrado[]>([]);
  const [loadingPremios, setLoadingPremios] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const sessionDate = formatDateForDB(selectedDate);

  // ─────────────────────────────────────────────────────────────
  // Cargar premios (encargada + taquillera) para esta agencia/fecha
  // ─────────────────────────────────────────────────────────────
  const loadPremios = useCallback(async () => {
    if (!selectedAgency || !sessionDate) return;
    setLoadingPremios(true);
    try {
      // Perfiles de la agencia
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, role')
        .eq('agency_id', selectedAgency)
        .eq('is_active', true);

      const allUserIds = (profiles || []).map(p => p.user_id);
      if (user?.id && !allUserIds.includes(user.id)) {
        allUserIds.push(user.id);
      }
      
      const taqUserIds = (profiles || []).filter(p => p.role === 'taquillero').map(p => p.user_id);

      if (allUserIds.length === 0) { setPremios([]); return; }

      // Sesiones de TODOS los usuarios de la agencia para esta fecha
      const { data: sessions } = await supabase
        .from('daily_sessions')
        .select('id, user_id')
        .eq('session_date', sessionDate)
        .in('user_id', allUserIds);

      const sessionList = sessions || [];
      if (sessionList.length === 0) { setPremios([]); return; }

      const allSessionIds = sessionList.map(s => s.id);
      const taqUserSet    = new Set(taqUserIds);
      const taqSessionSet = new Set(
        sessionList.filter(s => taqUserSet.has(s.user_id)).map(s => s.id)
      );

      const { data: rows } = await supabase
        .from('pending_prizes')
        .select('id, session_id, amount_bs, amount_usd, description, is_paid')
        .in('session_id', allSessionIds)
        .order('is_paid', { ascending: true });

      const result: PremioRegistrado[] = (rows || []).map(r => ({
        id:          r.id,
        amount_bs:   Number(r.amount_bs  || 0),
        amount_usd:  Number(r.amount_usd || 0),
        description: r.description,
        is_paid:     r.is_paid,
        source:      taqSessionSet.has(r.session_id) ? 'taquillera' : 'encargada',
        session_date: sessionDate,
      }));

      setPremios(result);
    } catch (err: any) {
      console.error('Error loading premios:', err);
    } finally {
      setLoadingPremios(false);
    }
  }, [selectedAgency, sessionDate]);

  useEffect(() => { loadPremios(); }, [loadPremios]);

  // ─────────────────────────────────────────────────────────────
  // Form helpers
  // ─────────────────────────────────────────────────────────────
  const addEntrada    = () => setEntradas(prev => [...prev, { amount_bs: '', amount_usd: '', description: '' }]);
  const removeEntrada = (i: number) => setEntradas(prev => prev.filter((_, idx) => idx !== i));
  const updateEntrada = (i: number, field: keyof EntradaPremio, value: string) =>
    setEntradas(prev => prev.map((e, idx) => idx === i ? { ...e, [field]: value } : e));

  const totalForm = {
    bs:  entradas.reduce((s, e) => s + (parseFloat(e.amount_bs)  || 0), 0),
    usd: entradas.reduce((s, e) => s + (parseFloat(e.amount_usd) || 0), 0),
  };

  // ─────────────────────────────────────────────────────────────
  // Guardar premios de la encargada
  // ─────────────────────────────────────────────────────────────
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;

    const validos = entradas.filter(
      en => (parseFloat(en.amount_bs) || 0) > 0 || (parseFloat(en.amount_usd) || 0) > 0
    );
    if (validos.length === 0) {
      toast({ title: 'Validación', description: 'Ingresa al menos un monto válido.', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const sessionId = await getOrCreateEncargadaSession(user.id, sessionDate);

      const inserts = validos.map(en => ({
        session_id:  sessionId,
        amount_bs:   parseFloat(en.amount_bs)  || 0,
        amount_usd:  parseFloat(en.amount_usd) || 0,
        description: en.description || '',
        is_paid:     false,
      }));

      const { error } = await supabase.from('pending_prizes').insert(inserts);
      if (error) throw error;

      await syncEncargadaSummary(sessionId, user.id, sessionDate, selectedAgency);

      toast({ title: '✓ Guardado', description: `${validos.length} premio(s) registrado(s).` });
      setEntradas([{ amount_bs: '', amount_usd: '', description: '' }]);
      await loadPremios();
      onSuccess?.();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Error al guardar', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  // ─────────────────────────────────────────────────────────────
  // Toggle pagado (solo premios de encargada)
  // ─────────────────────────────────────────────────────────────
  const handleTogglePaid = async (premio: PremioRegistrado) => {
    if (premio.source === 'taquillera') return;

    const newPaid = !premio.is_paid;
    // Optimistic
    setPremios(prev => prev.map(p => p.id === premio.id ? { ...p, is_paid: newPaid } : p));
    setTogglingId(premio.id);

    try {
      const { error } = await supabase
        .from('pending_prizes')
        .update({ is_paid: newPaid })
        .eq('id', premio.id);
      if (error) throw error;

      // Sincronizar summary
      if (user?.id) {
        const sessionId = await getOrCreateEncargadaSession(user.id, sessionDate);
        await syncEncargadaSummary(sessionId, user.id, sessionDate, selectedAgency);
      }

      onSuccess?.();
    } catch (err: any) {
      // Revert
      setPremios(prev => prev.map(p => p.id === premio.id ? { ...p, is_paid: !newPaid } : p));
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setTogglingId(null);
    }
  };

  // ─────────────────────────────────────────────────────────────
  // Totales historial
  // ─────────────────────────────────────────────────────────────
  const pendientesBs  = premios.filter(p => !p.is_paid).reduce((s, p) => s + p.amount_bs,  0);
  const pendientesUsd = premios.filter(p => !p.is_paid).reduce((s, p) => s + p.amount_usd, 0);

  return (
    <div className="space-y-6">
      {/* ── Formulario de registro ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-amber-500" />
            Registrar Premio por Pagar
          </CardTitle>
          <CardDescription>
            Registra premios pendientes de pago de la encargada para esta agencia y fecha.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4">
            {entradas.map((entrada, i) => (
              <div key={i}>
                {i > 0 && <Separator className="my-4" />}
                <div className="flex items-start gap-4">
                  <div className="flex-1 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label htmlFor={`enc-premio-bs-${i}`}>Monto (Bs)</Label>
                        <Input
                          id={`enc-premio-bs-${i}`}
                          type="number"
                          step="0.01"
                          min="0"
                          value={entrada.amount_bs}
                          onChange={e => updateEntrada(i, 'amount_bs', e.target.value)}
                          placeholder="0.00"
                          className="font-mono text-center"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor={`enc-premio-usd-${i}`}>Monto ($)</Label>
                        <Input
                          id={`enc-premio-usd-${i}`}
                          type="number"
                          step="0.01"
                          min="0"
                          value={entrada.amount_usd}
                          onChange={e => updateEntrada(i, 'amount_usd', e.target.value)}
                          placeholder="0.00"
                          className="font-mono text-center"
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor={`enc-premio-desc-${i}`}>Descripción</Label>
                      <Textarea
                        id={`enc-premio-desc-${i}`}
                        value={entrada.description}
                        onChange={e => updateEntrada(i, 'description', e.target.value)}
                        placeholder="Detalles del premio..."
                        rows={2}
                      />
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 pt-6">
                    <Button type="button" variant="outline" size="sm" onClick={addEntrada}>
                      <Plus className="h-4 w-4" />
                    </Button>
                    {entradas.length > 1 && (
                      <Button type="button" variant="outline" size="sm" onClick={() => removeEntrada(i)}>
                        <Minus className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {(totalForm.bs > 0 || totalForm.usd > 0) && (
              <div className="flex gap-2 justify-end">
                {totalForm.bs  > 0 && <Badge variant="secondary">Bs: {formatCurrency(totalForm.bs,  'VES')}</Badge>}
                {totalForm.usd > 0 && <Badge variant="outline">$: {formatCurrency(totalForm.usd, 'USD')}</Badge>}
              </div>
            )}

            <Button
              type="submit"
              disabled={saving || (totalForm.bs === 0 && totalForm.usd === 0)}
              className="w-full"
            >
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              {saving ? 'Guardando...' : 'Guardar Premio(s)'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* ── Historial ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Premios Registrados</span>
            {(pendientesBs > 0 || pendientesUsd > 0) && (
              <div className="flex gap-2">
                {pendientesBs  > 0 && <Badge variant="destructive">{formatCurrency(pendientesBs,  'VES')}</Badge>}
                {pendientesUsd > 0 && <Badge variant="outline">${formatCurrency(pendientesUsd, 'USD')}</Badge>}
              </div>
            )}
          </CardTitle>
          <CardDescription>
            Premios de encargada (editables) y taquillera (referencia).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingPremios ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : premios.length === 0 ? (
            <p className="text-center text-muted-foreground py-4 text-sm">
              No hay premios registrados para esta fecha.
            </p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">Pagado</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead className="text-right">Bs</TableHead>
                    <TableHead className="text-right">$</TableHead>
                    <TableHead className="w-[90px] text-center">Origen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {premios.map(p => (
                    <TableRow
                      key={p.id}
                      className={
                        p.is_paid
                          ? 'bg-primary/5 opacity-70'
                          : p.source === 'taquillera'
                          ? 'bg-amber-50/30 dark:bg-amber-950/10'
                          : ''
                      }
                    >
                      <TableCell>
                        {togglingId === p.id ? (
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        ) : (
                          <Checkbox
                            checked={p.is_paid}
                            disabled={p.source === 'taquillera'}
                            onCheckedChange={() => p.source === 'encargada' && handleTogglePaid(p)}
                          />
                        )}
                      </TableCell>
                      <TableCell className={p.is_paid ? 'line-through text-muted-foreground' : ''}>
                        {p.description || <span className="italic text-muted-foreground text-xs">Sin descripción</span>}
                      </TableCell>
                      <TableCell className={`text-right font-mono text-sm ${p.is_paid ? 'line-through opacity-60' : ''}`}>
                        {p.amount_bs > 0 ? formatCurrency(p.amount_bs, 'VES') : '—'}
                      </TableCell>
                      <TableCell className={`text-right font-mono text-sm ${p.is_paid ? 'line-through opacity-60' : ''}`}>
                        {p.amount_usd > 0 ? formatCurrency(p.amount_usd, 'USD') : '—'}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant="outline"
                          className={
                            p.source === 'encargada'
                              ? 'bg-primary/10 text-primary text-[10px]'
                              : 'bg-amber-500/10 text-amber-600 text-[10px]'
                          }
                        >
                          {p.source === 'encargada' ? 'Encargada' : 'Taquillera'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
