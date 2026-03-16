import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useDemo } from '@/contexts/DemoContext';
import { DemoModeSelector } from '@/components/demo/DemoModeSelector';
import { DollarSign, TrendingUp, Receipt, Calculator, Banknote, Coins, CreditCard, Wallet, Eye } from 'lucide-react';

const FloatingIcon = ({ icon: Icon, delay, duration, startX, startY }: { 
  icon: any; 
  delay: number; 
  duration: number;
  startX: string;
  startY: string;
}) => (
  <div
    className="absolute opacity-30 animate-float"
    style={{
      left: startX,
      top: startY,
      animationDelay: `${delay}s`,
      animationDuration: `${duration}s`,
    }}
  >
    <Icon className="w-16 h-16 text-primary" />
  </div>
);

export const AuthLayout = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showDemoSelector, setShowDemoSelector] = useState(false);
  
  const { signIn } = useAuth();
  const { toast } = useToast();
  const { isDemoMode } = useDemo();

  // Clear all app data on login for fresh start
  const clearAllAppData = async () => {
    // Get all localStorage keys except Supabase auth keys
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && !key.startsWith('sb-')) {
        keysToRemove.push(key);
      }
    }
    
    // Remove non-auth localStorage items
    keysToRemove.forEach(key => localStorage.removeItem(key));
    
    // Clear sessionStorage completely
    sessionStorage.clear();
    
    // Unregister and clear Service Worker caches
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const registration of registrations) {
        await registration.unregister();
      }
    }
    
    // Clear all caches
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map(name => caches.delete(name)));
    }
    
    console.log('✓ App data cleared on login');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await signIn(email, password);
      if (error) {
        toast({
          title: "Error al iniciar sesión",
          description: error.message,
          variant: "destructive",
        });
      } else {
        // Login successful - clear all cached data for fresh start
        await clearAllAppData();
        
        toast({
          title: "Sesión iniciada",
          description: "Datos actualizados correctamente",
        });
        
        // Force page reload to ensure fresh data fetch
        window.location.reload();
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Algo salió mal",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const floatingIcons = [
    { icon: DollarSign, delay: 0, duration: 15, startX: '10%', startY: '20%' },
    { icon: TrendingUp, delay: 2, duration: 18, startX: '80%', startY: '30%' },
    { icon: Receipt, delay: 4, duration: 20, startX: '15%', startY: '70%' },
    { icon: Calculator, delay: 1, duration: 17, startX: '75%', startY: '60%' },
    { icon: Banknote, delay: 3, duration: 19, startX: '50%', startY: '10%' },
    { icon: Coins, delay: 5, duration: 16, startX: '25%', startY: '50%' },
    { icon: CreditCard, delay: 2.5, duration: 21, startX: '65%', startY: '80%' },
    { icon: Wallet, delay: 4.5, duration: 18, startX: '90%', startY: '50%' },
  ];

  if (showDemoSelector) {
    return <DemoModeSelector onBack={() => setShowDemoSelector(false)} />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
      {floatingIcons.map((item, index) => (
        <FloatingIcon key={index} {...item} />
      ))}
      
      <Card className="w-full max-w-md relative z-10 shadow-2xl">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl text-center">Sistema de Loterías</CardTitle>
          <CardDescription className="text-center">
            Iniciar sesión
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="tu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-3">
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Cargando...' : 'Iniciar sesión'}
            </Button>
            <Button 
              type="button" 
              variant="outline" 
              className="w-full"
              onClick={() => setShowDemoSelector(true)}
            >
              <Eye className="h-4 w-4 mr-2" />
              Ver Demo
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
};