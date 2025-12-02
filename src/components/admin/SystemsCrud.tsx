import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Edit, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface LotterySystem {
  id: string;
  name: string;
  code: string;
  is_active: boolean;
  created_at: string;
  has_subcategories?: boolean;
  parent_system_id?: string | null;
}

export const SystemsCrud = () => {
  const [systems, setSystems] = useState<LotterySystem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [systemToDelete, setSystemToDelete] = useState<string | null>(null);
  const [editingSystem, setEditingSystem] = useState<LotterySystem | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    is_active: true,
    parent_system_id: null as string | null
  });
  const { toast } = useToast();

  const fetchSystems = async () => {
    try {
      const { data, error } = await supabase
        .from('lottery_systems')
        .select('*')
        .order('name');

      if (error) throw error;
      setSystems(data || []);
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudieron cargar los sistemas",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSystems();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.name.trim()) {
      toast({
        title: "Error",
        description: "El nombre es requerido",
        variant: "destructive",
      });
      return;
    }

    // Generar código automáticamente a partir del nombre
    const generatedCode = formData.name
      .toUpperCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // Eliminar acentos
      .replace(/[^A-Z0-9\s]/g, "") // Eliminar caracteres especiales
      .split(/\s+/)
      .map(word => word.charAt(0))
      .join('')
      .slice(0, 5); // Máximo 5 caracteres
    
    try {
      const dataToSave = {
        ...formData,
        code: generatedCode
      };

      if (editingSystem) {
        const { error } = await supabase
          .from('lottery_systems')
          .update(dataToSave)
          .eq('id', editingSystem.id);
        
        if (error) throw error;
        
        // Si se está editando una subcategoría, asegurar que el padre tenga has_subcategories = true
        if (dataToSave.parent_system_id) {
          await supabase
            .from('lottery_systems')
            .update({ has_subcategories: true })
            .eq('id', dataToSave.parent_system_id);
        }
        
        toast({
          title: "Éxito",
          description: "Sistema actualizado correctamente",
        });
      } else {
        const { error } = await supabase
          .from('lottery_systems')
          .insert(dataToSave);
        
        if (error) throw error;
        
        // Si se está creando una subcategoría, marcar el padre con has_subcategories = true
        if (dataToSave.parent_system_id) {
          await supabase
            .from('lottery_systems')
            .update({ has_subcategories: true })
            .eq('id', dataToSave.parent_system_id);
        }
        
        toast({
          title: "Éxito",
          description: "Sistema creado correctamente",
        });
      }
      
      fetchSystems();
      resetForm();
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo guardar el sistema",
        variant: "destructive",
      });
    }
  };

  const handleEdit = (system: LotterySystem) => {
    setEditingSystem(system);
    setFormData({
      name: system.name,
      code: system.code,
      is_active: system.is_active,
      parent_system_id: system.parent_system_id || null
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    setSystemToDelete(id);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!systemToDelete) return;
    
    try {
      const { error } = await supabase
        .from('lottery_systems')
        .delete()
        .eq('id', systemToDelete);
      
      if (error) throw error;
      
      toast({
        title: "Éxito",
        description: "Sistema eliminado correctamente",
      });
      
      fetchSystems();
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo eliminar el sistema",
        variant: "destructive",
      });
    } finally {
      setIsDeleteDialogOpen(false);
      setSystemToDelete(null);
    }
  };

  const toggleSystemStatus = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('lottery_systems')
        .update({ is_active: !currentStatus })
        .eq('id', id);
      
      if (error) throw error;
      
      toast({
        title: "Éxito",
        description: `Sistema ${!currentStatus ? 'activado' : 'desactivado'} correctamente`,
      });
      
      fetchSystems();
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo cambiar el estado del sistema",
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      code: '',
      is_active: true,
      parent_system_id: null
    });
    setEditingSystem(null);
    setIsDialogOpen(false);
  };

  if (loading) {
    return <div className="p-6">Cargando...</div>;
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-foreground">Gestión de Sistemas</h1>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => resetForm()}>
              <Plus className="mr-2 h-4 w-4" />
              Nuevo Sistema
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>
                {editingSystem ? 'Editar Sistema' : 'Nuevo Sistema'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} noValidate className="space-y-4">
              <div>
                <Label htmlFor="name">Nombre del Sistema *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required={false}
                  placeholder="ej. Triple Caracas"
                />
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
                <Label htmlFor="is_active">Activo</Label>
              </div>
              <div>
                <Label htmlFor="parent_system">Sistema Padre (si es subcategoría)</Label>
                <select
                  id="parent_system"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={formData.parent_system_id || ''}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    parent_system_id: e.target.value || null
                  })}
                >
                  <option value="">-- Sin sistema padre --</option>
                  {systems
                    .filter(s => !s.parent_system_id && s.id !== editingSystem?.id)
                    .map(system => (
                      <option key={system.id} value={system.id}>
                        {system.name} ({system.code})
                      </option>
                    ))
                  }
                </select>
                <p className="text-xs text-muted-foreground mt-1">
                  Selecciona un sistema padre para crear una subcategoría
                </p>
              </div>
              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancelar
                </Button>
                <Button type="submit">
                  {editingSystem ? 'Actualizar' : 'Crear'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lista de Sistemas de Lotería</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {systems.map((system) => (
                <TableRow key={system.id} className={system.parent_system_id ? "bg-muted/30" : ""}>
                  <TableCell className="font-medium">
                    {system.parent_system_id && <span className="ml-4">↳ </span>}
                    {system.name}
                  </TableCell>
                  <TableCell>
                    {system.has_subcategories ? (
                      <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">Con subcategorías</span>
                    ) : system.parent_system_id ? (
                      <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded">Subcategoría</span>
                    ) : (
                      <span className="text-xs bg-gray-100 text-gray-800 px-2 py-1 rounded">Normal</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        system.is_active 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {system.is_active ? 'Activo' : 'Inactivo'}
                      </span>
                      <Switch
                        checked={system.is_active}
                        onCheckedChange={() => toggleSystemStatus(system.id, system.is_active)}
                      />
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(system)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(system.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmar eliminación</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground">
              ¿Estás seguro de que quieres eliminar este sistema? Esta acción no se puede deshacer.
            </p>
          </div>
          <div className="flex justify-end space-x-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsDeleteDialogOpen(false);
                setSystemToDelete(null);
              }}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={confirmDelete}
            >
              Eliminar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};