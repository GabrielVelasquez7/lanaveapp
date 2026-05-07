import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Check, X, RefreshCw } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

interface SystemDebt {
  id: string;
  agency_id: string | null;
  agency_name: string;
  transaction_date: string;
  description: string;
  amount_bs: number;
  amount_usd: number;
  is_paid: boolean;
  created_at: string;
  session_id: string | null;
}

interface SystemDebtsViewProps {
  refreshTrigger?: number;
}

export function SystemDebtsView({ refreshTrigger }: SystemDebtsViewProps) {
  const [debts, setDebts] = useState<SystemDebt[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDebt, setSelectedDebt] = useState<SystemDebt | null>(null);
  const [actionType, setActionType] = useState<'paid' | 'unpaid' | null>(null);

  useEffect(() => {
    fetchDebts();
  }, [refreshTrigger]);

  const fetchDebts = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('expenses')
        .select(`
          id,
          agency_id,
          transaction_date,
          description,
          amount_bs,
          amount_usd,
          is_paid,
          created_at,
          session_id
        `)
        .eq('category', 'deuda')
        .order('transaction_date', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch agency names
      const agencyIds = [...new Set(data?.map(d => d.agency_id).filter(Boolean))];
      const { data: agenciesData } = await supabase
        .from('agencies')
        .select('id, name')
        .in('id', agencyIds);

      const agencyMap = new Map(agenciesData?.map(a => [a.id, a.name]));

      const debtsWithAgencies = data?.map(debt => ({
        ...debt,
        agency_name: debt.agency_id ? agencyMap.get(debt.agency_id) || 'Sin agencia' : 'Sin agencia'
      })) || [];

      setDebts(debtsWithAgencies);
    } catch (error) {
      console.error('[Deudas] Error obteniendo deudas:', error);
      toast.error('Error al cargar las deudas');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (paid: boolean) => {
    if (!selectedDebt) return;

    try {
      const { error } = await supabase
        .from('expenses')
        .update({ is_paid: paid })
        .eq('id', selectedDebt.id);

      if (error) throw error;

      toast.success(paid ? 'Deuda marcada como pagada' : 'Deuda marcada como pendiente');
      fetchDebts();
      setSelectedDebt(null);
      setActionType(null);
    } catch (error) {
      console.error('[Deudas] Error actualizando estado de deuda:', error);
      toast.error('Error al actualizar el estado de la deuda');
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Deudas del Sistema</CardTitle>
          <CardDescription>Cargando deudas...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center p-8">
            <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Deudas del Sistema</CardTitle>
            <CardDescription>
              Gestiona las deudas registradas en el sistema
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={fetchDebts}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualizar
          </Button>
        </CardHeader>
        <CardContent>
          {debts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No hay deudas registradas
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Agencia</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead className="text-right">Monto Bs</TableHead>
                    <TableHead className="text-right">Monto USD</TableHead>
                    <TableHead className="text-center">Estado</TableHead>
                    <TableHead className="text-center">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {debts.map((debt) => (
                    <TableRow key={debt.id}>
                      <TableCell>
                        {format(new Date(debt.transaction_date), 'dd/MM/yyyy', { locale: es })}
                      </TableCell>
                      <TableCell>{debt.agency_name}</TableCell>
                      <TableCell>{debt.description}</TableCell>
                      <TableCell className="text-right">
                        Bs. {debt.amount_bs.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-right">
                        ${debt.amount_usd.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-center">
                        {debt.is_paid ? (
                          <Badge variant="default" className="bg-green-500">
                            Pagada
                          </Badge>
                        ) : (
                          <Badge variant="destructive">
                            Pendiente
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex justify-center gap-2">
                          {!debt.is_paid && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedDebt(debt);
                                setActionType('paid');
                              }}
                            >
                              <Check className="h-4 w-4 mr-1" />
                              Marcar Pagada
                            </Button>
                          )}
                          {debt.is_paid && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedDebt(debt);
                                setActionType('unpaid');
                              }}
                            >
                              <X className="h-4 w-4 mr-1" />
                              Marcar Pendiente
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!selectedDebt && !!actionType} onOpenChange={() => {
        setSelectedDebt(null);
        setActionType(null);
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {actionType === 'paid' ? 'Marcar deuda como pagada' : 'Marcar deuda como pendiente'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {actionType === 'paid' 
                ? 'Esta deuda ya no se tomará en cuenta en los cuadres semanales.'
                : 'Esta deuda volverá a aparecer en los cuadres semanales.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => handleUpdateStatus(actionType === 'paid')}>
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
