import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useDemo, DemoRole } from '@/contexts/DemoContext';
import { Shield, UserCog, User, Eye, ArrowLeft } from 'lucide-react';

interface DemoModeSelectorProps {
  onBack?: () => void;
}

export function DemoModeSelector({ onBack }: DemoModeSelectorProps) {
  const { enterDemoMode } = useDemo();

  const roles: { role: DemoRole; title: string; description: string; icon: React.ReactNode; color: string }[] = [
    {
      role: 'administrador',
      title: 'Administrador',
      description: 'Acceso completo: agencias, usuarios, sistemas, reportes, banqueo y configuración.',
      icon: <Shield className="h-8 w-8" />,
      color: 'bg-red-500/10 text-red-600 border-red-200',
    },
    {
      role: 'encargada',
      title: 'Encargada',
      description: 'Gestión de cuadres semanales, revisión de taquilleros, nómina y préstamos.',
      icon: <UserCog className="h-8 w-8" />,
      color: 'bg-blue-500/10 text-blue-600 border-blue-200',
    },
    {
      role: 'taquillero',
      title: 'Taquillero',
      description: 'Registro de ventas/premios, gastos, pago móvil y cuadre diario.',
      icon: <User className="h-8 w-8" />,
      color: 'bg-green-500/10 text-green-600 border-green-200',
    },
  ];

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-muted/30 to-background p-4">
      <div className="max-w-4xl w-full">
        <div className="text-center mb-8">
          <Badge variant="secondary" className="mb-4 text-sm px-4 py-1">
            <Eye className="h-4 w-4 mr-2" />
            Modo Demostración
          </Badge>
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Sistema de Loterías - Demo
          </h1>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Explora el sistema con datos ficticios. Selecciona un perfil para ver las funcionalidades disponibles.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          {roles.map(({ role, title, description, icon, color }) => (
            <Card 
              key={role} 
              className={`cursor-pointer transition-all hover:shadow-lg hover:scale-105 border-2 ${color}`}
              onClick={() => enterDemoMode(role)}
            >
              <CardHeader className="text-center pb-2">
                <div className="mx-auto mb-3 p-3 rounded-full bg-background shadow-sm">
                  {icon}
                </div>
                <CardTitle className="text-lg">{title}</CardTitle>
              </CardHeader>
              <CardContent className="text-center">
                <CardDescription className="text-sm">{description}</CardDescription>
                <Button className="mt-4 w-full" variant="outline" size="sm">
                  Entrar como {title}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {onBack && (
          <div className="text-center">
            <Button variant="ghost" onClick={onBack}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver al login
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
