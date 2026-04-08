import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BanqueoManager } from './BanqueoManager';
import { BanqueoGroupView } from './BanqueoGroupView';
import { BanqueoGeneralView } from './BanqueoGeneralView';
import { Banknote, Users, Globe } from 'lucide-react';

export const BanqueoUnificado = () => {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Banqueo</h2>
        <p className="text-muted-foreground text-sm">Gestión y consulta de banqueo por cliente, grupo y vista general</p>
      </div>

      <Tabs defaultValue="cliente" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="cliente" className="flex items-center gap-2">
            <Banknote className="h-4 w-4" />
            Por Cliente
          </TabsTrigger>
          <TabsTrigger value="grupo" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Por Grupo
          </TabsTrigger>
          <TabsTrigger value="general" className="flex items-center gap-2">
            <Globe className="h-4 w-4" />
            General
          </TabsTrigger>
        </TabsList>

        <TabsContent value="cliente" className="mt-4">
          <BanqueoManager />
        </TabsContent>

        <TabsContent value="grupo" className="mt-4">
          <BanqueoGroupView />
        </TabsContent>

        <TabsContent value="general" className="mt-4">
          <BanqueoGeneralView />
        </TabsContent>
      </Tabs>
    </div>
  );
};
