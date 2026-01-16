import React, { createContext, useContext, useState, ReactNode } from 'react';

export type DemoRole = 'administrador' | 'encargada' | 'taquillero';

interface DemoUser {
  id: string;
  email: string;
  full_name: string;
  role: DemoRole;
  agency_name?: string;
  agency_id?: string;
  is_active: boolean;
}

interface DemoContextType {
  isDemoMode: boolean;
  demoUser: DemoUser | null;
  enterDemoMode: (role: DemoRole) => void;
  exitDemoMode: () => void;
  switchDemoRole: (role: DemoRole) => void;
}

const demoUsers: Record<DemoRole, DemoUser> = {
  administrador: {
    id: 'demo-admin-001',
    email: 'demo.admin@lanave.com',
    full_name: 'Carlos Demo (Admin)',
    role: 'administrador',
    is_active: true,
  },
  encargada: {
    id: 'demo-encargada-001',
    email: 'demo.encargada@lanave.com',
    full_name: 'María Demo (Encargada)',
    role: 'encargada',
    agency_name: 'Agencia Demo Central',
    agency_id: 'demo-agency-001',
    is_active: true,
  },
  taquillero: {
    id: 'demo-taquillero-001',
    email: 'demo.taquillero@lanave.com',
    full_name: 'Juan Demo (Taquillero)',
    role: 'taquillero',
    agency_name: 'Agencia Demo Central',
    agency_id: 'demo-agency-001',
    is_active: true,
  },
};

const DemoContext = createContext<DemoContextType | undefined>(undefined);

export function DemoProvider({ children }: { children: ReactNode }) {
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [demoUser, setDemoUser] = useState<DemoUser | null>(null);

  const enterDemoMode = (role: DemoRole) => {
    setDemoUser(demoUsers[role]);
    setIsDemoMode(true);
  };

  const exitDemoMode = () => {
    setDemoUser(null);
    setIsDemoMode(false);
  };

  const switchDemoRole = (role: DemoRole) => {
    setDemoUser(demoUsers[role]);
  };

  return (
    <DemoContext.Provider value={{ isDemoMode, demoUser, enterDemoMode, exitDemoMode, switchDemoRole }}>
      {children}
    </DemoContext.Provider>
  );
}

export function useDemo() {
  const context = useContext(DemoContext);
  if (context === undefined) {
    throw new Error('useDemo must be used within a DemoProvider');
  }
  return context;
}
