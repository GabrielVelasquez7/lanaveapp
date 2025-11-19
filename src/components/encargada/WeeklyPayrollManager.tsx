import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/utils';
import { Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { getTodayVenezuela, formatDateForDB } from '@/lib/dateUtils';

interface Employee {
  id: string;
  name: string;
  agency_id: string | null;
  base_salary_usd: number;
  base_salary_bs: number;
  sunday_rate_usd: number;
}

interface Agency {
  id: string;
  name: string;
}

interface PayrollEntry {
  employee_id: string;
  weekly_base_salary: number;
  absences_deductions: number;
  other_deductions: number;
  bonuses_extras: number;
  sunday_payment: number;
  sunday_enabled: boolean;
  total_usd: number;
  total_bs: number;
}

export function WeeklyPayrollManager() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [weekStart, setWeekStart] = useState('');
  const [weekEnd, setWeekEnd] = useState('');
  const [exchangeRate, setExchangeRate] = useState(36);
  const [payrollData, setPayrollData] = useState<Record<string, PayrollEntry>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchEmployees();
    fetchAgencies();
    fetchLatestExchangeRate();
    setDefaultWeekDates();
  }, []);

  const setDefaultWeekDates = () => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    
    const monday = new Date(today);
    monday.setDate(today.getDate() + diff);
    
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    
    setWeekStart(formatDateForDB(monday));
    setWeekEnd(formatDateForDB(sunday));
  };

  const fetchLatestExchangeRate = async () => {
    const { data } = await supabase
      .from('daily_cuadres_summary')
      .select('exchange_rate')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (data?.exchange_rate) {
      setExchangeRate(data.exchange_rate);
    }
  };

  const fetchEmployees = async () => {
    const { data, error } = await supabase
      .from('employees')
      .select('*')
      .eq('is_active', true)
      .order('name');

    if (error) {
      toast.error('Error al cargar empleados');
      return;
    }

    setEmployees(data || []);
    
    // Initialize payroll data for each employee
    const initialData: Record<string, PayrollEntry> = {};
    (data || []).forEach(emp => {
      initialData[emp.id] = {
        employee_id: emp.id,
        weekly_base_salary: emp.base_salary_usd,
        absences_deductions: 0,
        other_deductions: 0,
        bonuses_extras: 0,
        sunday_payment: emp.sunday_rate_usd,
        sunday_enabled: true,
        total_usd: emp.base_salary_usd + emp.sunday_rate_usd,
        total_bs: (emp.base_salary_usd + emp.sunday_rate_usd) * exchangeRate,
      };
    });
    setPayrollData(initialData);
  };

  const fetchAgencies = async () => {
    const { data } = await supabase
      .from('agencies')
      .select('id, name')
      .eq('is_active', true);

    setAgencies(data || []);
  };

  const getAgencyName = (agencyId: string | null) => {
    if (!agencyId) return '-';
    return agencies.find(a => a.id === agencyId)?.name || '-';
  };

  const updatePayrollEntry = (employeeId: string, field: keyof PayrollEntry, value: number | boolean) => {
    const entry = payrollData[employeeId];
    if (!entry) return;
    
    const updated = { ...entry, [field]: value };
    
    // Recalculate total
    const sundayAmount = updated.sunday_enabled ? updated.sunday_payment : 0;
    const total = updated.weekly_base_salary + 
                  sundayAmount + 
                  updated.bonuses_extras - 
                  updated.absences_deductions - 
                  updated.other_deductions;
    
    updated.total_usd = total;
    updated.total_bs = total * exchangeRate;
    
    setPayrollData({ ...payrollData, [employeeId]: updated });
  };

  const handleSavePayroll = async () => {
    if (!weekStart || !weekEnd) {
      toast.error('Debe seleccionar las fechas de la semana');
      return;
    }

    setLoading(true);

    try {
      const payrollEntries = Object.values(payrollData).map(entry => ({
        ...entry,
        week_start_date: weekStart,
        week_end_date: weekEnd,
        exchange_rate: exchangeRate,
      }));

      const { error } = await supabase
        .from('weekly_payroll')
        .upsert(payrollEntries, {
          onConflict: 'employee_id,week_start_date',
        });

      if (error) throw error;

      toast.success('Nómina guardada exitosamente');
    } catch (error) {
      console.error('Error saving payroll:', error);
      toast.error('Error al guardar la nómina');
    } finally {
      setLoading(false);
    }
  };

  const loadExistingPayroll = async () => {
    if (!weekStart) return;

    const { data, error } = await supabase
      .from('weekly_payroll')
      .select('*')
      .eq('week_start_date', weekStart);

    if (error) {
      toast.error('Error al cargar nómina existente');
      return;
    }

    if (data && data.length > 0) {
      const loadedData: Record<string, PayrollEntry> = {};
      data.forEach(entry => {
        loadedData[entry.employee_id] = {
          employee_id: entry.employee_id,
          weekly_base_salary: entry.weekly_base_salary,
          absences_deductions: entry.absences_deductions,
          other_deductions: entry.other_deductions,
          bonuses_extras: entry.bonuses_extras,
          sunday_payment: entry.sunday_payment,
          sunday_enabled: entry.sunday_payment > 0,
          total_usd: entry.total_usd,
          total_bs: entry.total_bs,
        };
      });
      setPayrollData({ ...payrollData, ...loadedData });
      setExchangeRate(data[0].exchange_rate);
      toast.success('Nómina cargada');
    }
  };

  useEffect(() => {
    if (weekStart) {
      loadExistingPayroll();
    }
  }, [weekStart]);

  // Recalculate all totals in Bs when exchange rate changes
  useEffect(() => {
    if (Object.keys(payrollData).length === 0) return;
    
    const updatedData: Record<string, PayrollEntry> = {};
    let hasChanges = false;
    
    Object.entries(payrollData).forEach(([employeeId, entry]) => {
      const newTotalBs = entry.total_usd * exchangeRate;
      if (Math.abs(newTotalBs - entry.total_bs) > 0.01) {
        hasChanges = true;
      }
      updatedData[employeeId] = {
        ...entry,
        total_bs: newTotalBs,
      };
    });
    
    if (hasChanges) {
      setPayrollData(updatedData);
    }
  }, [exchangeRate]);

  const totals = Object.values(payrollData).reduce(
    (acc, entry) => ({
      totalUsd: acc.totalUsd + entry.total_usd,
      totalBs: acc.totalBs + entry.total_bs,
    }),
    { totalUsd: 0, totalBs: 0 }
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Nómina de Empleados</CardTitle>
        <CardDescription>Gestión semanal de nómina</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="text-sm font-medium">Semana inicio:</label>
            <Input
              type="date"
              value={weekStart}
              onChange={(e) => setWeekStart(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-medium">Semana fin:</label>
            <Input
              type="date"
              value={weekEnd}
              onChange={(e) => setWeekEnd(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-medium">Moneda:</label>
            <Input value="DOL" disabled className="bg-muted" />
          </div>
          <div>
            <label className="text-sm font-medium">Tasa (Bs/$):</label>
            <Input
              type="number"
              step="0.01"
              value={exchangeRate}
              onChange={(e) => setExchangeRate(parseFloat(e.target.value) || 36)}
            />
          </div>
        </div>

        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted">
                <TableHead className="min-w-[140px]">Empleado</TableHead>
                <TableHead className="min-w-[100px]">Agencia</TableHead>
                <TableHead className="text-right min-w-[100px]">Sueldo Semanal</TableHead>
                <TableHead className="text-right min-w-[100px]">Ausencias</TableHead>
                <TableHead className="text-right min-w-[100px]">Descuentos</TableHead>
                <TableHead className="text-right min-w-[100px]">Bonos</TableHead>
                <TableHead className="text-center min-w-[80px]">Domingo</TableHead>
                <TableHead className="text-right min-w-[100px]">Pago Dom.</TableHead>
                <TableHead className="text-right min-w-[120px]">Total USD</TableHead>
                <TableHead className="text-right min-w-[120px]">Total Bs</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employees.map((employee) => {
                const entry = payrollData[employee.id];
                if (!entry) return null;
                
                return (
                  <TableRow key={employee.id}>
                    <TableCell className="font-medium">{employee.name}</TableCell>
                    <TableCell className="text-muted-foreground">{getAgencyName(employee.agency_id)}</TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        step="0.01"
                        className="text-right h-8"
                        value={entry.weekly_base_salary || ''}
                        onChange={(e) => updatePayrollEntry(employee.id, 'weekly_base_salary', parseFloat(e.target.value) || 0)}
                        placeholder="0.00"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        step="0.01"
                        className="text-right h-8"
                        value={entry.absences_deductions || ''}
                        onChange={(e) => updatePayrollEntry(employee.id, 'absences_deductions', parseFloat(e.target.value) || 0)}
                        placeholder="0.00"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        step="0.01"
                        className="text-right h-8"
                        value={entry.other_deductions || ''}
                        onChange={(e) => updatePayrollEntry(employee.id, 'other_deductions', parseFloat(e.target.value) || 0)}
                        placeholder="0.00"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        step="0.01"
                        className="text-right h-8"
                        value={entry.bonuses_extras || ''}
                        onChange={(e) => updatePayrollEntry(employee.id, 'bonuses_extras', parseFloat(e.target.value) || 0)}
                        placeholder="0.00"
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center">
                        <Checkbox
                          checked={entry.sunday_enabled}
                          onCheckedChange={(checked) => updatePayrollEntry(employee.id, 'sunday_enabled', checked as boolean)}
                        />
                      </div>
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        step="0.01"
                        className="text-right h-8"
                        value={entry.sunday_payment || ''}
                        onChange={(e) => updatePayrollEntry(employee.id, 'sunday_payment', parseFloat(e.target.value) || 0)}
                        placeholder="0.00"
                        disabled={!entry.sunday_enabled}
                      />
                    </TableCell>
                    <TableCell className="text-right font-medium text-primary">
                      ${(entry.total_usd || 0).toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      Bs {(entry.total_bs || 0).toFixed(2)}
                    </TableCell>
                  </TableRow>
                );
              })}
              <TableRow className="bg-muted/50 font-bold">
                <TableCell colSpan={8} className="text-right text-base">TOTALES:</TableCell>
                <TableCell className="text-right text-primary text-base">${totals.totalUsd.toFixed(2)}</TableCell>
                <TableCell className="text-right text-base">Bs {totals.totalBs.toFixed(2)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>

        <div className="flex justify-end">
          <Button onClick={handleSavePayroll} disabled={loading}>
            {loading ? 'Guardando...' : 'Guardar Nómina'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
