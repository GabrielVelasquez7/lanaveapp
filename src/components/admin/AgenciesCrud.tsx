import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Edit, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Agency {
  id: string;
  name: string;
  group_id: string | null;
  is_active: boolean;
  created_at: string;
  agency_groups?: {
    name: string;
  } | null;
}

interface Group {
  id: string;
  name: string;
}

export const AgenciesCrud = () => {
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAgency, setEditingAgency] = useState<Agency | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    group_id: '',
    is_active: true
  });
  const { toast } = useToast();

  const fetchAgencies = async () => {
    try {
      const { data, error } = await supabase
        .from('agencies')
        .select('id, name, group_id, is_active, created_at, agency_groups(name)')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Asegurar que los datos tengan la estructura correcta
      const formattedData = (data || []).map((agency: any) => ({
        id: agency.id,
        name: agency.name,
        group_id: agency.group_id,
        is_active: agency.is_active,
        created_at: agency.created_at,
        agency_groups: agency.agency_groups
      }));
      
      setAgencies(formattedData);
    } catch (error) {
      console.error('Error fetching agencies:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar las agencias",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchGroups = async () => {
    try {
      const { data, error } = await supabase
        .from('agency_groups')
        .select('id, name')
        .order('name');

      if (error) throw error;
      setGroups(data || []);
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudieron cargar los grupos",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    fetchAgencies();
    fetchGroups();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const submitData = {
        name: formData.name,
        group_id: formData.group_id === '' ? null : formData.group_id,
        is_active: formData.is_active
      };

      if (editingAgency) {
        const { error } = await supabase
          .from('agencies')
          .update(submitData)
          .eq('id', editingAgency.id);
        
        if (error) throw error;
        
        toast({
          title: "Éxito",
          description: "Agencia actualizada correctamente",
        });
      } else {
        const { error } = await supabase
          .from('agencies')
          .insert(submitData);
        
        if (error) throw error;
        
        toast({
          title: "Éxito",
          description: "Agencia creada correctamente",
        });
      }
      
      fetchAgencies();
      resetForm();
    } catch (error) {
      console.error('Error al guardar agencia:', error);
      toast({
        title: "Error",
        description: "No se pudo guardar la agencia",
        variant: "destructive",
      });
    }
  };

  const handleEdit = (agency: Agency) => {
    try {
      setEditingAgency(agency);
      setFormData({
        name: agency.name || '',
        group_id: agency.group_id || '',
        is_active: agency.is_active ?? true
      });
      setIsDialogOpen(true);
    } catch (error) {
      console.error('Error al editar agencia:', error);
      toast({
        title: "Error",
        description: "No se pudo cargar la información de la agencia",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Estás seguro de que quieres eliminar esta agencia?')) return;
    
    try {
      const { error } = await supabase
        .from('agencies')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      
      toast({
        title: "Éxito",
        description: "Agencia eliminada correctamente",
      });
      
      fetchAgencies();
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo eliminar la agencia",
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      group_id: '',
      is_active: true
    });
    setEditingAgency(null);
    setIsDialogOpen(false);
  };

  if (loading) {
    return <div className="p-6">Cargando...</div>;
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-foreground">Gestión de Agencias</h1>
        <Button onClick={() => resetForm()}>
          <Plus className="mr-2 h-4 w-4" />
          Nueva Agencia
        </Button>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={(open) => {
        setIsDialogOpen(open);
        if (!open) {
          resetForm();
        }
      }}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>
              {editingAgency ? 'Editar Agencia' : 'Nueva Agencia'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="name">Nombre *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
            <div>
              <Label htmlFor="group">Grupo</Label>
              <Select
                value={formData.group_id}
                onValueChange={(value) => setFormData({ ...formData, group_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar grupo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Sin grupo</SelectItem>
                  {groups.map((group) => (
                    <SelectItem key={group.id} value={group.id}>
                      {group.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
              <Label htmlFor="is_active">Activa</Label>
            </div>
            <div className="flex justify-end space-x-2">
              <Button type="button" variant="outline" onClick={resetForm}>
                Cancelar
              </Button>
              <Button type="submit">
                {editingAgency ? 'Actualizar' : 'Crear'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <CardTitle>Lista de Agencias</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Grupo</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {agencies.map((agency: any) => (
                <TableRow key={agency.id}>
                  <TableCell className="font-medium">{agency.name}</TableCell>
                  <TableCell>{agency.agency_groups?.name || 'Sin grupo'}</TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      agency.is_active 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {agency.is_active ? 'Activa' : 'Inactiva'}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(agency)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(agency.id)}
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
    </div>
  );
};