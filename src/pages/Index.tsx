import { useAuth } from '@/hooks/useAuth';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { TaquilleraDashboard } from '@/components/taquillera/TaquilleraDashboard';
import { AdminDashboard } from '@/components/admin/AdminDashboard';
import { EncargadaDashboard } from '@/components/encargada/EncargadaDashboard';

const Index = () => {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Cargando...</h1>
        </div>
      </div>
    );
  }

  // If no user is authenticated, show auth layout
  if (!user) {
    return <AuthLayout />;
  }

  // If user is authenticated but profile is still loading or doesn't exist, 
  // show loading state to prevent wrong dashboard from showing
  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Cargando perfil...</h1>
        </div>
      </div>
    );
  }

  // Now safely render based on role
  switch (profile.role) {
    case 'administrador':
      return <AdminDashboard />;
    case 'encargada':
      return <EncargadaDashboard />;
    case 'taquillero':
    default:
      return <TaquilleraDashboard />;
  }
};

export default Index;
