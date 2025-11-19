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
    
    // Initialize payroll data for each employee using base salaries from employee record
    const initialData: Record<string, PayrollEntry> = {};
    (data || []).forEach(emp => {
      const baseTotalUsd = emp.base_salary_usd;
      const baseTotalBs = emp.base_salary_bs;
      const sundayUsd = emp.sunday_rate_usd;
      
      initialData[emp.id] = {
        employee_id: emp.id,
        absences_deductions: 0,
        other_deductions: 0,
        bonuses_extras: 0,
        sunday_payment: sundayUsd,
        sunday_enabled: true,
        total_usd: baseTotalUsd + sundayUsd,
        total_bs: baseTotalBs + (sundayUsd * exchangeRate),
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
    
    const employee = employees.find(emp => emp.id === employeeId);
    if (!employee) return;
    
    const updated = { ...entry, [field]: value };
    
    // Recalculate total using employee's base salaries
    const baseUsd = employee.base_salary_usd;
    const baseBs = employee.base_salary_bs;
    const sundayAmount = updated.sunday_enabled ? updated.sunday_payment : 0;
    
    updated.total_usd = baseUsd + 
                        sundayAmount + 
                        updated.bonuses_extras - 
                        updated.absences_deductions - 
                        updated.other_deductions;
    
    updated.total_bs = baseBs + 
                       (sundayAmount * exchangeRate) + 
                       (updated.bonuses_extras * exchangeRate) - 
                       (updated.absences_deductions * exchangeRate) - 
                       (updated.other_deductions * exchangeRate);
    
    setPayrollData({ ...payrollData, [employeeId]: updated });
  };

  const handleSavePayroll = async () => {
    if (!weekStart || !weekEnd) {
      toast.error('Debe seleccionar las fechas de la semana');
      return;
    }

    setLoading(true);

    try {
      const payrollEntries = Object.values(payrollData).map(entry => {
        const employee = employees.find(emp => emp.id === entry.employee_id);
        return {
          ...entry,
          weekly_base_salary: employee?.base_salary_usd || 0, // Keep for DB compatibility
          week_start_date: weekStart,
          week_end_date: weekEnd,
          exchange_rate: exchangeRate,
        };
      });

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
        const employee = employees.find(emp => emp.id === entry.employee_id);
        // Use employee's current base salaries, not the saved weekly_base_salary
        if (employee) {
          const baseUsd = employee.base_salary_usd;
          const baseBs = employee.base_salary_bs;
          const sundayAmount = entry.sunday_payment > 0 ? entry.sunday_payment : 0;
          
          // Recalculate totals using current employee salaries
          const totalUsd = baseUsd + 
                          sundayAmount + 
                          entry.bonuses_extras - 
                          entry.absences_deductions - 
                          entry.other_deductions;
          
          const currentExchangeRate = data[0].exchange_rate || exchangeRate;
          const totalBs = baseBs + 
                         (sundayAmount * currentExchangeRate) + 
                         (entry.bonuses_extras * currentExchangeRate) - 
                         (entry.absences_deductions * currentExchangeRate) - 
                         (entry.other_deductions * currentExchangeRate);
          
          loadedData[entry.employee_id] = {
            employee_id: entry.employee_id,
            absences_deductions: entry.absences_deductions,
            other_deductions: entry.other_deductions,
            bonuses_extras: entry.bonuses_extras,
            sunday_payment: entry.sunday_payment,
            sunday_enabled: entry.sunday_payment > 0,
            total_usd: totalUsd,
            total_bs: totalBs,
          };
        }
      });
      setPayrollData({ ...payrollData, ...loadedData });
      if (data[0].exchange_rate) {
        setExchangeRate(data[0].exchange_rate);
      }
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
      const employee = employees.find(emp => emp.id === employeeId);
      if (!employee) return;
      
      const baseBs = employee.base_salary_bs;
      const sundayAmount = entry.sunday_enabled ? entry.sunday_payment : 0;
      
      const newTotalBs = baseBs + 
                         (sundayAmount * exchangeRate) + 
                         (entry.bonuses_extras * exchangeRate) - 
                         (entry.absences_deductions * exchangeRate) - 
                         (entry.other_deductions * exchangeRate);
      
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
  }, [exchangeRate, employees]);

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
              value={exchangeRate || ''}
              onChange={(e) => {
                const value = e.target.value === '' ? 36 : (parseFloat(e.target.value) || 36);
                setExchangeRate(value);
              }}
              placeholder="36.00"
            />
          </div>
        </div>

        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted">
                <TableHead className="min-w-[140px]">Empleado</TableHead>
                <TableHead className="min-w-[100px]">Agencia</TableHead>
                <TableHead className="text-right min-w-[100px]">Sueldo Bs</TableHead>
                <TableHead className="text-right min-w-[100px]">Sueldo USD</TableHead>
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
                    <TableCell className="text-right font-medium text-muted-foreground">
                      {formatCurrency(employee.base_salary_bs, 'VES')}
                    </TableCell>
                    <TableCell className="text-right font-medium text-muted-foreground">
                      {formatCurrency(employee.base_salary_usd, 'USD')}
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        step="0.01"
                        className="text-right h-8"
                        value={entry.absences_deductions === 0 ? '' : (entry.absences_deductions || '')}
                        onChange={(e) => {
                          const value = e.target.value === '' ? 0 : (parseFloat(e.target.value) || 0);
                          updatePayrollEntry(employee.id, 'absences_deductions', value);
                        }}
                        placeholder="0.00"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        step="0.01"
                        className="text-right h-8"
                        value={entry.other_deductions === 0 ? '' : (entry.other_deductions || '')}
                        onChange={(e) => {
                          const value = e.target.value === '' ? 0 : (parseFloat(e.target.value) || 0);
                          updatePayrollEntry(employee.id, 'other_deductions', value);
                        }}
                        placeholder="0.00"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        step="0.01"
                        className="text-right h-8"
                        value={entry.bonuses_extras === 0 ? '' : (entry.bonuses_extras || '')}
                        onChange={(e) => {
                          const value = e.target.value === '' ? 0 : (parseFloat(e.target.value) || 0);
                          updatePayrollEntry(employee.id, 'bonuses_extras', value);
                        }}
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
                        value={entry.sunday_payment === 0 ? '' : (entry.sunday_payment || '')}
                        onChange={(e) => {
                          const value = e.target.value === '' ? 0 : (parseFloat(e.target.value) || 0);
                          updatePayrollEntry(employee.id, 'sunday_payment', value);
                        }}
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
                <TableCell colSpan={9} className="text-right text-base">TOTALES:</TableCell>
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
