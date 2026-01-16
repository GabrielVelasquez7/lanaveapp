import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { useDemo, DemoRole } from '@/contexts/DemoContext';
import { Eye, Shield, UserCog, User, LogOut, ChevronDown } from 'lucide-react';

export function DemoRoleSwitcher() {
  const { isDemoMode, demoUser, switchDemoRole, exitDemoMode } = useDemo();

  if (!isDemoMode || !demoUser) return null;

  const roleIcons: Record<DemoRole, React.ReactNode> = {
    administrador: <Shield className="h-4 w-4" />,
    encargada: <UserCog className="h-4 w-4" />,
    taquillero: <User className="h-4 w-4" />,
  };

  const roleLabels: Record<DemoRole, string> = {
    administrador: 'Administrador',
    encargada: 'Encargada',
    taquillero: 'Taquillero',
  };

  const roleColors: Record<DemoRole, string> = {
    administrador: 'bg-red-500',
    encargada: 'bg-blue-500',
    taquillero: 'bg-green-500',
  };

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="shadow-lg border-2 bg-background">
            <Eye className="h-4 w-4 mr-2 text-amber-500" />
            <span className="font-medium">DEMO:</span>
            <Badge className={`ml-2 ${roleColors[demoUser.role]}`}>
              {roleLabels[demoUser.role]}
            </Badge>
            <ChevronDown className="h-4 w-4 ml-2" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-amber-500" />
            Modo Demo Activo
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-xs text-muted-foreground">
            Cambiar perfil
          </DropdownMenuLabel>
          {(['administrador', 'encargada', 'taquillero'] as DemoRole[]).map((role) => (
            <DropdownMenuItem
              key={role}
              onClick={() => switchDemoRole(role)}
              className={demoUser.role === role ? 'bg-muted' : ''}
            >
              {roleIcons[role]}
              <span className="ml-2">{roleLabels[role]}</span>
              {demoUser.role === role && (
                <Badge variant="secondary" className="ml-auto text-xs">Actual</Badge>
              )}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={exitDemoMode} className="text-destructive">
            <LogOut className="h-4 w-4 mr-2" />
            Salir del demo
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
