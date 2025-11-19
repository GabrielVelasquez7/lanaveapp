import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Navigate } from 'react-router-dom';

const Auth = () => {
  const { signIn, user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  // Redirect if already logged in
  if (user) {
    return <Navigate to="/" replace />;
  }

  const handleSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    
    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    if (!email || !email.trim()) {
      toast({
        title: "Error",
        description: "El email es requerido",
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    if (!password || !password.trim()) {
      toast({
        title: "Error",
        description: "La contraseña es requerida",
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    const { error } = await signIn(email, password);
    
    if (error) {
      toast({
        title: "Error al iniciar sesión",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "¡Bienvenido!",
        description: "Has iniciado sesión correctamente.",
      });
    }
    
    setLoading(false);
  };


  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Sistema de Loterías</CardTitle>
          <CardDescription>Gestión de cuadres y ventas</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSignIn} noValidate className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="signin-email">Email</Label>
              <Input
                id="signin-email"
                name="email"
                type="email"
                placeholder="tu@email.com"
                required={false}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="signin-password">Contraseña</Label>
              <Input
                id="signin-password"
                name="password"
                type="password"
                placeholder="••••••••"
                required={false}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Iniciando..." : "Iniciar Sesión"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;