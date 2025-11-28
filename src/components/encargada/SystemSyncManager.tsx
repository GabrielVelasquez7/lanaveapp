import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { RefreshCw, X, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Progress } from '@/components/ui/progress';

interface SystemSyncManagerProps {
  isOpen: boolean;
  onClose: () => void;
  targetDate: string; // Format: DD-MM-YYYY
  onSuccess: (results: SystemSyncResult[]) => void;
}

export interface SystemSyncResult {
  systemName: string;
  systemCode: string;
  updatedAgenciesCount: number;
  agencyResults: Array<{name: string, sales: number, prizes: number}>;
  success: boolean;
  error?: string;
}

interface SystemConfig {
  code: string;
  name: string;
  functionName: string;
  enabled: boolean;
  comingSoon?: boolean;
}

const AVAILABLE_SYSTEMS: SystemConfig[] = [];

export function SystemSyncManager({ 
  isOpen, 
  onClose, 
}: SystemSyncManagerProps) {
  const [selectedSystems, setSelectedSystems] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [syncProgress, setSyncProgress] = useState<Record<string, 'pending' | 'syncing' | 'success' | 'error'>>({});
  const [syncResults, setSyncResults] = useState<SystemSyncResult[]>([]);
  const { toast } = useToast();

  const handleToggleSystem = (systemCode: string) => {
    setSelectedSystems(prev => 
      prev.includes(systemCode) 
        ? prev.filter(s => s !== systemCode)
        : [...prev, systemCode]
    );
  };

  const handleToggleAll = () => {
    const enabledSystems = AVAILABLE_SYSTEMS.filter(s => s.enabled).map(s => s.code);
    if (selectedSystems.length === enabledSystems.length) {
      setSelectedSystems([]);
    } else {
      setSelectedSystems(enabledSystems);
    }
  };

  const syncSystem = async (_system: SystemConfig): Promise<SystemSyncResult> => {
    return {
      systemName: '',
      systemCode: '',
      updatedAgenciesCount: 0,
      agencyResults: [],
      success: false,
      error: 'Sincronización deshabilitada en esta versión',
    };
  };

  const handleSyncSelected = async () => {
    toast({
      title: 'Sincronización deshabilitada',
      description: 'La sincronización automática con sistemas externos está deshabilitada por motivos de seguridad.',
      variant: 'destructive',
    });
    return;

    setIsLoading(true);
    setSyncProgress({});
    setSyncResults([]);

    // Initialize progress for selected systems
    const initialProgress: Record<string, 'pending' | 'syncing' | 'success' | 'error'> = {};
    selectedSystems.forEach(code => {
      initialProgress[code] = 'pending';
    });
    setSyncProgress(initialProgress);

    // Sync systems in parallel
    const systemsToSync = AVAILABLE_SYSTEMS.filter(s => selectedSystems.includes(s.code));
    const syncPromises = systemsToSync.map(system => syncSystem(system));
    
    const results = await Promise.all(syncPromises);
    setSyncResults(results);

    // Show summary
    const successCount = results.filter(r => r.success).length;
    const totalAgencies = results.reduce((sum, r) => sum + r.updatedAgenciesCount, 0);
    const totalSales = results.reduce((sum, r) => 
      r.agencyResults.reduce((s, a) => s + a.sales, 0), 0
    );
    const totalPrizes = results.reduce((sum, r) => 
      r.agencyResults.reduce((s, a) => s + a.prizes, 0), 0
    );

    if (successCount > 0) {
      toast({
        title: 'Sincronización completada',
        description: `${successCount} de ${results.length} sistemas sincronizados. ${totalAgencies} agencias actualizadas: ${totalSales.toFixed(2)} Bs ventas, ${totalPrizes.toFixed(2)} Bs premios`,
      });

      // Wait for UI update
      setTimeout(() => {
        onSuccess(results);
        onClose();
        setIsLoading(false);
        setSyncProgress({});
        setSyncResults([]);
      }, 1500);
    } else {
      toast({
        title: 'Error en sincronización',
        description: 'Ningún sistema pudo sincronizarse correctamente',
        variant: 'destructive',
      });
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      onClose();
      setSyncProgress({});
      setSyncResults([]);
    }
  };

  const getProgressIcon = (status: string) => {
    switch (status) {
      case 'syncing':
        return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
      case 'success':
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-destructive" />;
      default:
        return null;
    }
  };

  const enabledSystems = AVAILABLE_SYSTEMS.filter(s => s.enabled);
  const allSelected = selectedSystems.length === enabledSystems.length && enabledSystems.length > 0;
  const progressPercentage = Object.keys(syncProgress).length > 0 
    ? (Object.values(syncProgress).filter(s => s === 'success' || s === 'error').length / Object.keys(syncProgress).length) * 100
    : 0;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            Sincronizar Sistemas de Lotería
          </DialogTitle>
          <DialogDescription>
            La sincronización automática con sistemas externos (MaxPlayGo, SOURCES, etc.) está deshabilitada en esta versión por motivos de seguridad.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Sincronización deshabilitada */}
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>
              La funcionalidad de sincronización automática con sistemas de terceros ha sido desactivada. 
              Si necesitas volver a habilitarla en el futuro, será necesario reconfigurar credenciales seguras
              y revisar los Edge Functions correspondientes.
            </p>
          </div>

          {/* Progress */}
          {isLoading && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Progreso general</span>
                <span className="font-medium">{Math.round(progressPercentage)}%</span>
              </div>
              <Progress value={progressPercentage} className="h-2" />
              
              {Object.entries(syncProgress).length > 0 && (
                <div className="space-y-1 text-xs">
                  {Object.entries(syncProgress).map(([code, status]) => {
                    const system = AVAILABLE_SYSTEMS.find(s => s.code === code);
                    const result = syncResults.find(r => r.systemCode === code);
                    return (
                      <div key={code} className="flex items-center justify-between">
                        <span className="text-muted-foreground">{system?.name}:</span>
                        <span className={
                          status === 'success' ? 'text-green-600' :
                          status === 'error' ? 'text-destructive' :
                          'text-muted-foreground'
                        }>
                          {status === 'success' && result 
                            ? `✓ ${result.updatedAgenciesCount} agencias`
                            : status === 'error' 
                            ? '✗ Error'
                            : status === 'syncing'
                            ? 'Sincronizando...'
                            : 'Pendiente'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="flex gap-2">
          <Button 
            type="button" 
            variant="outline" 
            onClick={handleClose}
            disabled={isLoading}
          >
            <X className="h-4 w-4 mr-2" />
            Cancelar
          </Button>
          <Button 
            onClick={handleSyncSelected} 
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sincronizando...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Sincronizar Seleccionados
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
