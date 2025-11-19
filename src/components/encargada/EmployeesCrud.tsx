import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Pencil, Trash2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

interface Employee {
  id: string;
  name: string;
  agency_id: string | null;
  base_salary_usd: number;
  base_salary_bs: number;
  sunday_rate_usd: number;
  is_active: boolean;
}

interface Agency {
  id: string;
  name: string;
}

export function EmployeesCrud() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [deleteEmployeeId, setDeleteEmployeeId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    agency_id: '',
    base_salary_usd: '',
    base_salary_bs: '',
    sunday_rate_usd: '',
  });

  useEffect(() => {
    fetchEmployees();
    fetchAgencies();
  }, []);

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
  };

  const fetchAgencies = async () => {
    const { data, error } = await supabase
      .from('agencies')
      .select('id, name')
      .eq('is_active', true)
      .order('name');

    if (error) {
      toast.error('Error al cargar agencias');
      return;
    }

    setAgencies(data || []);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error('El nombre es requerido');
      return;
    }

    if (editingEmployee) {
      const { error } = await supabase
        .from('employees')
        .update({
          name: formData.name,
          agency_id: formData.agency_id || null,
          base_salary_usd: parseFloat(formData.base_salary_usd as string) || 0,
          base_salary_bs: parseFloat(formData.base_salary_bs as string) || 0,
          sunday_rate_usd: parseFloat(formData.sunday_rate_usd as string) || 0,
        })
        .eq('id', editingEmployee.id);

      if (error) {
        toast.error('Error al actualizar empleado');
        return;
      }

      toast.success('Empleado actualizado');
    } else {
      const { error } = await supabase
        .from('employees')
        .insert({
          name: formData.name,
          agency_id: formData.agency_id || null,
          base_salary_usd: parseFloat(formData.base_salary_usd as string) || 0,
          base_salary_bs: parseFloat(formData.base_salary_bs as string) || 0,
          sunday_rate_usd: parseFloat(formData.sunday_rate_usd as string) || 0,
        });

      if (error) {
        toast.error('Error al crear empleado');
        return;
      }

      toast.success('Empleado creado');
    }

    setIsDialogOpen(false);
    setEditingEmployee(null);
    resetForm();
    fetchEmployees();
  };

  const handleEdit = (employee: Employee) => {
    setEditingEmployee(employee);
    setFormData({
      name: employee.name,
      agency_id: employee.agency_id || '',
      base_salary_usd: employee.base_salary_usd.toString(),
      base_salary_bs: employee.base_salary_bs.toString(),
      sunday_rate_usd: employee.sunday_rate_usd.toString(),
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteEmployeeId) return;

    const { error } = await supabase
      .from('employees')
      .update({ is_active: false })
      .eq('id', deleteEmployeeId);

    if (error) {
      toast.error('Error al eliminar empleado');
      return;
    }

    toast.success('Empleado eliminado');
    setIsDeleteDialogOpen(false);
    setDeleteEmployeeId(null);
    fetchEmployees();
  };

  const openDeleteDialog = (id: string) => {
    setDeleteEmployeeId(id);
    setIsDeleteDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      agency_id: '',
      base_salary_usd: '',
      base_salary_bs: '',
      sunday_rate_usd: '',
    });
  };

  const openNewDialog = () => {
    setEditingEmployee(null);
    resetForm();
    setIsDialogOpen(true);
  };

  const getAgencyName = (agencyId: string | null) => {
    if (!agencyId) return '-';
    return agencies.find(a => a.id === agencyId)?.name || '-';
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Empleados</CardTitle>
            <CardDescription>Gestión de empleados para nómina</CardDescription>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openNewDialog}>
                <Plus className="h-4 w-4 mr-2" />
                Nuevo Empleado
              </Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={handleSubmit} noValidate>
                <DialogHeader>
                  <DialogTitle>
                    {editingEmployee ? 'Editar Empleado' : 'Nuevo Empleado'}
                  </DialogTitle>
                  <DialogDescription>
                    Complete los datos del empleado
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="name">Nombre</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required={false}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="agency">Agencia</Label>
                    <Select
                      value={formData.agency_id}
                      onValueChange={(value) => setFormData({ ...formData, agency_id: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar agencia" />
                      </SelectTrigger>
                      <SelectContent>
                        {agencies.map((agency) => (
                          <SelectItem key={agency.id} value={agency.id}>
                            {agency.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="base_salary_usd">Sueldo Base ($)</Label>
                    <Input
                      id="base_salary_usd"
                      type="number"
                      step="0.01"
                      value={formData.base_salary_usd || ''}
                      onChange={(e) => {
                        const value = e.target.value === '' ? '' : e.target.value;
                        setFormData({ ...formData, base_salary_usd: value });
                      }}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="base_salary_bs">Sueldo Base (Bs)</Label>
                    <Input
                      id="base_salary_bs"
                      type="number"
                      step="0.01"
                      value={formData.base_salary_bs || ''}
                      onChange={(e) => {
                        const value = e.target.value === '' ? '' : e.target.value;
                        setFormData({ ...formData, base_salary_bs: value });
                      }}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="sunday_rate_usd">Tarifa Domingo ($)</Label>
                    <Input
                      id="sunday_rate_usd"
                      type="number"
                      step="0.01"
                      value={formData.sunday_rate_usd || ''}
                      onChange={(e) => {
                        const value = e.target.value === '' ? '' : e.target.value;
                        setFormData({ ...formData, sunday_rate_usd: value });
                      }}
                      placeholder="0.00"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit">
                    {editingEmployee ? 'Actualizar' : 'Crear'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Agencia</TableHead>
                <TableHead className="text-right">Sueldo Base $</TableHead>
                <TableHead className="text-right">Sueldo Base Bs</TableHead>
                <TableHead className="text-right">Tarifa Domingo</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employees.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No hay empleados registrados
                  </TableCell>
                </TableRow>
              ) : (
                employees.map((employee) => (
                  <TableRow key={employee.id}>
                    <TableCell className="font-medium">{employee.name}</TableCell>
                    <TableCell>{getAgencyName(employee.agency_id)}</TableCell>
                    <TableCell className="text-right">${employee.base_salary_usd.toFixed(2)}</TableCell>
                    <TableCell className="text-right">Bs {employee.base_salary_bs.toFixed(2)}</TableCell>
                    <TableCell className="text-right">${employee.sunday_rate_usd.toFixed(2)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(employee)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openDeleteDialog(employee.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar empleado?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción desactivará el empleado. Los registros de nómina existentes se mantendrán.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
