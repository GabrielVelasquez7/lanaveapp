import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, CalendarIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const loanSchema = z.object({
  from_agency_id: z.string().min(1, "Debe seleccionar la agencia prestamista"),
  to_agency_id: z.string().min(1, "Debe seleccionar la agencia que recibe"),
  amount_bs: z.number().min(0, "El monto en Bs debe ser mayor o igual a 0"),
  amount_usd: z.number().min(0, "El monto en USD debe ser mayor o igual a 0"),
  loan_date: z.date({ required_error: "Debe seleccionar la fecha del préstamo" }),
  due_date: z.date().optional(),
  reason: z.string().min(1, "Debe especificar la razón del préstamo"),
  description: z.string().optional(),
});

interface InterAgencyLoansFormProps {
  onSuccess?: () => void;
}

export function InterAgencyLoansForm({ onSuccess }: InterAgencyLoansFormProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [agencies, setAgencies] = useState<Array<{ id: string; name: string }>>([]);

  const form = useForm<z.infer<typeof loanSchema>>({
    resolver: zodResolver(loanSchema),
    defaultValues: {
      amount_bs: 0,
      amount_usd: 0,
      loan_date: new Date(),
      reason: "",
      description: "",
    },
  });

  useEffect(() => {
    fetchAgencies();
  }, []);

  const fetchAgencies = async () => {
    try {
      const { data, error } = await supabase
        .from('agencies')
        .select('id, name')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setAgencies(data || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "No se pudieron cargar las agencias",
        variant: "destructive",
      });
    }
  };

  const onSubmit = async (values: z.infer<typeof loanSchema>) => {
    if (values.from_agency_id === values.to_agency_id) {
      toast({
        title: "Error",
        description: "Una agencia no puede prestarse a sí misma",
        variant: "destructive",
      });
      return;
    }

    if (values.amount_bs === 0 && values.amount_usd === 0) {
      toast({
        title: "Error",
        description: "Debe especificar al menos un monto mayor a 0",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Usuario no autenticado");

      const { error } = await supabase
        .from('inter_agency_loans')
        .insert({
          from_agency_id: values.from_agency_id,
          to_agency_id: values.to_agency_id,
          amount_bs: values.amount_bs,
          amount_usd: values.amount_usd,
          loan_date: values.loan_date.toISOString().split('T')[0],
          due_date: values.due_date ? values.due_date.toISOString().split('T')[0] : null,
          reason: values.reason,
          description: values.description || null,
          created_by: userData.user.id,
        });

      if (error) throw error;

      toast({
        title: "Éxito",
        description: "Préstamo registrado correctamente",
      });

      form.reset();
      onSuccess?.();
    } catch (error: any) {
      toast({
        title: "Error",
        description: "No se pudo registrar el préstamo",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Registrar Préstamo Entre Agencias</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="from_agency_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Agencia Prestamista</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar agencia" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {agencies.map((agency) => (
                          <SelectItem key={agency.id} value={agency.id}>
                            {agency.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="to_agency_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Agencia que Recibe</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar agencia" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {agencies.map((agency) => (
                          <SelectItem key={agency.id} value={agency.id}>
                            {agency.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="amount_bs"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Monto en Bs</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        {...field}
                        value={field.value === 0 ? '' : field.value}
                        onChange={(e) => {
                          const raw = e.target.value;
                          const value = raw === '' ? 0 : (parseFloat(raw) || 0);
                          field.onChange(value);
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="amount_usd"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Monto en USD</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        {...field}
                        value={field.value === 0 ? '' : field.value}
                        onChange={(e) => {
                          const raw = e.target.value;
                          const value = raw === '' ? 0 : (parseFloat(raw) || 0);
                          field.onChange(value);
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="loan_date"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Fecha del Préstamo</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              "pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value ? (
                              format(field.value, "dd/MM/yyyy", { locale: es })
                            ) : (
                              <span>Seleccionar fecha</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <CalendarComponent
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          initialFocus
                          locale={es}
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="due_date"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Fecha de Vencimiento (Opcional)</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              "pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value ? (
                              format(field.value, "dd/MM/yyyy", { locale: es })
                            ) : (
                              <span>Seleccionar fecha</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <CalendarComponent
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          initialFocus
                          locale={es}
                          disabled={(date) => date < new Date()}
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Razón del Préstamo</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar razón" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="premios">Premios</SelectItem>
                      <SelectItem value="sencillo_divisas">Sencillo en Divisas</SelectItem>
                      <SelectItem value="sencillo_bolivares">Sencillo en Bolívares</SelectItem>
                      <SelectItem value="operativo">Gasto Operativo</SelectItem>
                      <SelectItem value="emergencia">Emergencia</SelectItem>
                      <SelectItem value="otro">Otro</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descripción (Opcional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Detalles adicionales del préstamo..."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Registrando..." : "Registrar Préstamo"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}