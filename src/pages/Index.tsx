import { useAuth } from '@/hooks/useAuth';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { TaquilleraDashboard } from '@/components/taquillera/TaquilleraDashboard';
import { AdminDashboard } from '@/components/admin/AdminDashboard';
import { EncargadaDashboard } from '@/components/encargada/EncargadaDashboard';
import { useDemo } from '@/contexts/DemoContext';
import { DemoTaquilleraDashboard } from '@/components/demo/DemoTaquilleraDashboard';
import { DemoEncargadaDashboard } from '@/components/demo/DemoEncargadaDashboard';
import { DemoAdminDashboard } from '@/components/demo/DemoAdminDashboard';
import { DemoRoleSwitcher } from '@/components/demo/DemoRoleSwitcher';

const Index = () => {
  const { user, profile, loading } = useAuth();
  const { isDemoMode, demoUser } = useDemo();

  // Demo mode - show demo dashboards
  if (isDemoMode && demoUser) {
    return (
      <>
        {demoUser.role === 'administrador' && <DemoAdminDashboard />}
        {demoUser.role === 'encargada' && <DemoEncargadaDashboard />}
        {demoUser.role === 'taquillero' && <DemoTaquilleraDashboard />}
        <DemoRoleSwitcher />
      </>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Cargando...</h1>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthLayout />;
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Cargando perfil...</h1>
        </div>
      </div>
    );
  }

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
