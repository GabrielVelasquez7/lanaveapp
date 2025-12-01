import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Edit, Trash2, Building2, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Group {
  id: string;
  name: string;
  description: string | null;
  is_client_group: boolean;
  created_at: string;
}

interface Agency {
  id: string;
  name: string;
  group_id: string | null;
}

export const GroupsCrud = () => {
  const [groups, setGroups] = useState<Group[]>([]);
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [selectedAgencies, setSelectedAgencies] = useState<string[]>([]);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    is_client_group: false,
  });
  const { toast } = useToast();

  const fetchGroups = async () => {
    try {
      const { data, error } = await supabase
        .from("agency_groups")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setGroups(data || []);
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudieron cargar los grupos",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchAgencies = async () => {
    try {
      const { data, error } = await supabase.from("agencies").select("id, name, group_id").order("name");

      if (error) throw error;
      setAgencies(data || []);
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudieron cargar las agencias",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    fetchGroups();
    fetchAgencies();
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

    try {
      let groupId: string;

      if (editingGroup) {
        const { error } = await supabase.from("agency_groups").update(formData).eq("id", editingGroup.id);

        if (error) throw error;
        groupId = editingGroup.id;

        toast({
          title: "Éxito",
          description: "Grupo actualizado correctamente",
        });
      } else {
        const { data, error } = await supabase.from("agency_groups").insert(formData).select().single();

        if (error) throw error;
        groupId = data.id;

        toast({
          title: "Éxito",
          description: "Grupo creado correctamente",
        });
      }

      // Update agencies' group_id
      // First, remove all agencies from this group
      await supabase.from("agencies").update({ group_id: null }).eq("group_id", groupId);

      // Then, assign selected agencies to this group
      if (selectedAgencies.length > 0) {
        await supabase.from("agencies").update({ group_id: groupId }).in("id", selectedAgencies);
      }

      fetchGroups();
      fetchAgencies();
      resetForm();
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo guardar el grupo",
        variant: "destructive",
      });
    }
  };

  const handleEdit = (group: Group) => {
    setEditingGroup(group);
    setFormData({
      name: group.name,
      description: group.description || "",
      is_client_group: group.is_client_group || false,
    });
    // Get agencies in this group
    const groupAgencies = agencies.filter((a) => a.group_id === group.id).map((a) => a.id);
    setSelectedAgencies(groupAgencies);
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Estás seguro de que quieres eliminar este grupo?")) return;

    try {
      const { error } = await supabase.from("agency_groups").delete().eq("id", id);

      if (error) throw error;

      toast({
        title: "Éxito",
        description: "Grupo eliminado correctamente",
      });

      fetchGroups();
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo eliminar el grupo",
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      is_client_group: false,
    });
    setSelectedAgencies([]);
    setEditingGroup(null);
    setIsDialogOpen(false);
  };

  const toggleAgencySelection = (agencyId: string) => {
    setSelectedAgencies((prev) =>
      prev.includes(agencyId) ? prev.filter((id) => id !== agencyId) : [...prev, agencyId],
    );
  };

  const getAgenciesInGroup = (groupId: string) => {
    return agencies.filter((a) => a.group_id === groupId);
  };

  if (loading) {
    return <div className="p-6">Cargando...</div>;
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-foreground">Gestión de Grupos</h1>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => resetForm()}>
              <Plus className="mr-2 h-4 w-4" />
              Nuevo Grupo
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>{editingGroup ? "Editar Grupo" : "Nuevo Grupo"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} noValidate className="space-y-4">
              <div>
                <Label htmlFor="name">Nombre *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required={false}
                />
              </div>

              <div>
                <Label htmlFor="description">Descripción</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Descripción opcional del grupo (ej: agencias incluidas, notas, etc.)"
                  rows={3}
                />
              </div>

              <div className="flex items-center justify-between space-x-2 p-4 border rounded-lg bg-muted/30">
                <div className="flex items-center space-x-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <Label htmlFor="is_client_group" className="cursor-pointer">
                      Grupo de Clientes
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Los grupos de clientes no se incluyen en cálculos de ganancias
                    </p>
                  </div>
                </div>
                <Switch
                  id="is_client_group"
                  checked={formData.is_client_group}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_client_group: checked })}
                />
              </div>

              <div className="space-y-2">
                <Label>Agencias en este grupo</Label>
                <ScrollArea className="h-[200px] w-full border rounded-md p-4">
                  <div className="space-y-2">
                    {agencies.map((agency) => (
                      <div key={agency.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`agency-${agency.id}`}
                          checked={selectedAgencies.includes(agency.id)}
                          onCheckedChange={() => toggleAgencySelection(agency.id)}
                        />
                        <label
                          htmlFor={`agency-${agency.id}`}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                        >
                          {agency.name}
                        </label>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
                <p className="text-xs text-muted-foreground">{selectedAgencies.length} agencia(s) seleccionada(s)</p>
              </div>
              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancelar
                </Button>
                <Button type="submit">{editingGroup ? "Actualizar" : "Crear"}</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lista de Grupos</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Agencias</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {groups.map((group) => {
                const groupAgencies = getAgenciesInGroup(group.id);
                return (
                  <TableRow key={group.id}>
                    <TableCell className="font-medium">{group.name}</TableCell>
                    <TableCell>
                      {group.is_client_group ? (
                        <Badge variant="secondary" className="flex items-center gap-1 w-fit">
                          <Users className="h-3 w-3" />
                          Clientes
                        </Badge>
                      ) : (
                        <Badge variant="default" className="flex items-center gap-1 w-fit">
                          <Building2 className="h-3 w-3" />
                          Agencias
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{groupAgencies.length} agencia(s)</span>
                      </div>
                      {groupAgencies.length > 0 && (
                        <div className="text-xs text-muted-foreground mt-1">
                          {groupAgencies.map((a) => a.name).join(", ")}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>{group.description || "-"}</TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button variant="outline" size="sm" onClick={() => handleEdit(group)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handleDelete(group.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};
