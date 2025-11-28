import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Edit, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  email?: string;
  role: 'taquillero' | 'encargado' | 'administrador' | 'encargada';
  agency_id: string | null;
  agency_name?: string;
  is_active: boolean;
  created_at: string;
}

interface Agency {
  id: string;
  name: string;
}

export const UsersCrud = () => {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [profileToDelete, setProfileToDelete] = useState<Profile | null>(null);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    full_name: '',
    role: 'taquillero' as 'taquillero' | 'encargado' | 'administrador' | 'encargada',
    agency_id: 'none',
    is_active: true
  });
  const { toast } = useToast();

  const fetchProfiles = async () => {
    try {
      // Fetch profiles with agencies
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select(`
          *,
          agencies!profiles_agency_id_fkey(name)
        `)
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

      // Fetch roles from user_roles
      const { data: rolesData, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role');

      if (rolesError) throw rolesError;

      // Fetch emails from edge function
      const { data: emailsData, error: emailsError } = await supabase.functions.invoke('get-users-emails');
      
      if (emailsError) {
        console.error('Error fetching emails:', emailsError);
      }

      // Create a map of user_id -> role for quick lookup
      const rolesMap = new Map(rolesData?.map(r => [r.user_id, r.role]) || []);
      
      // Create a map of user_id -> email
      const emailsMap = new Map<string, string>();
      if (emailsData?.emails) {
        Object.entries(emailsData.emails).forEach(([userId, email]) => {
          emailsMap.set(userId, email as string);
        });
      }
      
      const profilesWithRoleAndAgency = profilesData?.map(profile => ({
        ...profile,
        role: rolesMap.get(profile.user_id) || 'taquillero',
        email: emailsMap.get(profile.user_id) || undefined,
        agency_name: profile.agencies?.name || null
      })) || [];
      
      setProfiles(profilesWithRoleAndAgency);
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudieron cargar los usuarios",
        variant: "destructive",
      });
    }
  };

  const fetchAgencies = async () => {
    try {
      const { data, error } = await supabase
        .from('agencies')
        .select('id, name')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setAgencies(data || []);
    } catch (error) {
      console.error('Error fetching agencies:', error);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      await Promise.all([fetchProfiles(), fetchAgencies()]);
      setLoading(false);
    };
    loadData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (editingProfile) {
        // Update profile data (without role)
        const profileUpdateData = {
          full_name: formData.full_name,
          agency_id: formData.agency_id === 'none' ? null : formData.agency_id || null,
          is_active: formData.is_active
        };

        const { error: profileError } = await supabase
          .from('profiles')
          .update(profileUpdateData)
          .eq('id', editingProfile.id);
        
        if (profileError) throw profileError;

        // Update role in user_roles table
        const { error: roleError } = await supabase
          .from('user_roles')
          .update({ role: formData.role })
          .eq('user_id', editingProfile.user_id);
        
        if (roleError) throw roleError;
        
        toast({
          title: "Éxito",
          description: "Usuario actualizado correctamente",
        });
      } else {
        // Create new user
        if (!formData.email || !formData.password || !formData.full_name) {
          toast({
            title: "Error",
            description: "Email, contraseña y nombre son obligatorios",
            variant: "destructive",
          });
          return;
        }

        const { data, error } = await supabase.functions.invoke('create-user', {
          body: {
            email: formData.email.trim(),
            password: formData.password,
            full_name: formData.full_name.trim(),
            role: formData.role,
            agency_id: formData.agency_id === 'none' ? null : formData.agency_id
          }
        });

        // Errores de red/función
        if (error) {
          const msg = error.message || 'Error al crear usuario';
          // Mensaje más amigable si refiere a email duplicado
          if (msg.toLowerCase().includes('already') || msg.toLowerCase().includes('email')) {
            throw new Error('Ese correo ya está registrado. Usa otro correo o edita el usuario existente.');
          }
          throw new Error(msg);
        }
        
        // Error de negocio enviado por la función
        if (data?.error) {
          const msg: string = data.error;
          if (msg.toLowerCase().includes('email') && msg.toLowerCase().includes('registr')) {
            throw new Error('Ese correo ya está registrado. Usa otro correo o edita el usuario existente.');
          }
          throw new Error(msg);
        }
        
        toast({
          title: "Éxito",
          description: "Usuario creado correctamente",
        });
      }
      
      fetchProfiles();
      resetForm();
    } catch (error: any) {
      console.error('Error saving user:', error);
      toast({
        title: "Error",
        description: error.message || "No se pudo guardar el usuario",
        variant: "destructive",
      });
    }
  };

  const handleDeleteClick = (profile: Profile) => {
    if (!profile.user_id) {
      toast({
        title: "Error",
        description: "No se encontró el usuario a eliminar",
        variant: "destructive",
      });
      return;
    }
    setProfileToDelete(profile);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!profileToDelete?.user_id) {
      toast({
        title: "Error",
        description: "No se encontró el usuario a eliminar",
        variant: "destructive",
      });
      setDeleteDialogOpen(false);
      setProfileToDelete(null);
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('delete-user', {
        body: { user_id: profileToDelete.user_id }
      });

      if (error) {
        throw new Error(error.message || 'Error al eliminar usuario');
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      toast({
        title: "Usuario eliminado",
        description: "El usuario fue eliminado correctamente.",
      });

      setDeleteDialogOpen(false);
      setProfileToDelete(null);
      fetchProfiles();
    } catch (error: any) {
      console.error('Error deleting user:', error);
      toast({
        title: "Error",
        description: error.message || "No se pudo eliminar el usuario",
        variant: "destructive",
      });
      setDeleteDialogOpen(false);
      setProfileToDelete(null);
    }
  };

  const handleEdit = (profile: Profile) => {
    setEditingProfile(profile);
    setFormData({
      email: profile.email || '', // Keep email for reference but won't be editable
      password: '',
      full_name: profile.full_name,
      role: profile.role,
      agency_id: profile.agency_id || 'none',
      is_active: profile.is_active
    });
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({
      email: '',
      password: '',
      full_name: '',
      role: 'taquillero',
      agency_id: 'none',
      is_active: true
    });
    setEditingProfile(null);
    setIsDialogOpen(false);
  };

  if (loading) {
    return <div className="p-6">Cargando...</div>;
  }

  return (
    <div className="p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Gestión de Usuarios</h1>
        <div className="flex gap-2">
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) {
              resetForm();
            }
          }}>
            <DialogTrigger asChild>
              <Button onClick={() => {
                resetForm();
                setIsDialogOpen(true);
              }}>
                <Plus className="mr-2 h-4 w-4" />
                <span className="hidden sm:inline">Crear Usuario</span>
                <span className="sm:hidden">Crear</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] w-[95vw] max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingProfile ? 'Editar Usuario' : 'Crear Usuario'}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} noValidate className="space-y-4">
                {editingProfile ? (
                  <div>
                    <Label htmlFor="email-display">Email</Label>
                    <Input
                      id="email-display"
                      type="email"
                      value={editingProfile.email || '-'}
                      disabled
                      className="bg-muted cursor-not-allowed"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      El correo no se puede modificar. Para cambiarlo, elimina y crea un nuevo usuario.
                    </p>
                  </div>
                ) : (
                  <>
                    <div>
                      <Label htmlFor="email">Email *</Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        required={false}
                        placeholder="usuario@ejemplo.com"
                      />
                    </div>
                    <div>
                      <Label htmlFor="password">Contraseña *</Label>
                      <Input
                        id="password"
                        type="password"
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        required={false}
                        placeholder="Mínimo 6 caracteres"
                      />
                    </div>
                  </>
                )}
                <div>
                  <Label htmlFor="full_name">Nombre Completo *</Label>
                  <Input
                    id="full_name"
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    required={false}
                  />
                </div>
                <div>
                  <Label htmlFor="role">Rol *</Label>
                  <Select 
                    value={formData.role} 
                    onValueChange={(value: 'taquillero' | 'encargado' | 'administrador' | 'encargada') => 
                      setFormData({ ...formData, role: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="taquillero">Taquillero</SelectItem>
                      <SelectItem value="encargado">Encargado</SelectItem>
                      <SelectItem value="encargada">Encargada</SelectItem>
                      <SelectItem value="administrador">Administrador</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="agency_id">Agencia</Label>
                  <Select 
                    value={formData.agency_id} 
                    onValueChange={(value) => setFormData({ ...formData, agency_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar agencia" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sin agencia</SelectItem>
                      {agencies.map((agency) => (
                        <SelectItem key={agency.id} value={agency.id}>
                          {agency.name}
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
                  <Label htmlFor="is_active">Activo</Label>
                </div>
                <div className="flex justify-end space-x-2">
                  <Button type="button" variant="outline" onClick={resetForm}>
                    Cancelar
                  </Button>
                  <Button type="submit">
                    {editingProfile ? 'Actualizar' : 'Crear'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lista de Usuarios</CardTitle>
        </CardHeader>
        <CardContent className="p-3 sm:p-6">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[120px]">Nombre</TableHead>
                  <TableHead className="min-w-[180px]">Correo</TableHead>
                  <TableHead className="min-w-[100px]">Rol</TableHead>
                  <TableHead className="min-w-[100px] hidden sm:table-cell">Agencia</TableHead>
                  <TableHead className="min-w-[80px]">Estado</TableHead>
                  <TableHead className="min-w-[120px]">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {profiles.map((profile) => (
                  <TableRow key={profile.id}>
                    <TableCell className="font-medium">
                      <div className="max-w-[120px] truncate">
                        {profile.full_name}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="max-w-[180px] truncate text-sm text-muted-foreground">
                        {profile.email || '-'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded-full text-xs whitespace-nowrap ${
                        profile.role === 'administrador' 
                          ? 'bg-primary/10 text-primary' 
                          : profile.role === 'encargado'
                          ? 'bg-purple-500/10 text-purple-600'
                          : 'bg-muted text-muted-foreground'
                      }`}>
                        {profile.role === 'administrador' ? 'Administrador' : 
                         profile.role === 'encargado' ? 'Encargado' : 'Taquillero'}
                      </span>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <div className="max-w-[100px] truncate">
                        {profile.agency_name || '-'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded-full text-xs whitespace-nowrap ${
                        profile.is_active 
                          ? 'bg-green-500/10 text-green-600' 
                          : 'bg-red-500/10 text-red-600'
                      }`}>
                        {profile.is_active ? 'Activo' : 'Inactivo'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(profile)}
                          className="h-8 w-8 p-0"
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteClick(profile)}
                          className="h-8 w-8 p-0 text-destructive border-destructive/40"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar usuario?</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Seguro que deseas eliminar al usuario "{profileToDelete?.full_name}"? Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setDeleteDialogOpen(false);
              setProfileToDelete(null);
            }}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};