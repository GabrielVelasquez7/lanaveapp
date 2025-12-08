import {
  Building2,
  Users,
  Settings,
  Home,
  Percent,
  FileSpreadsheet,
  TrendingUp,
  Grid3x3,
  FolderTree,
  UserCircle,
  Edit3,
  DollarSign,
  Landmark,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

type AdminView =
  | "agencies"
  | "groups"
  | "users"
  | "systems"
  | "system-commissions"
  | "weekly-cuadre-complete"
  | "ganancias"
  | "systems-summary"
  | "systems-summary-manual"
  | "dashboard"
  | "clients"
  | "fixed-expenses"
  | "banqueo";

const menuItems = [
  {
    group: "General",
    items: [{ id: "dashboard", label: "Dashboard", icon: Home }],
  },
  {
    group: "Configuración",
    items: [
      { id: "agencies", label: "Agencias", icon: Building2 },
      { id: "groups", label: "Grupos", icon: FolderTree },
      { id: "clients", label: "Clientes", icon: UserCircle },
      { id: "users", label: "Usuarios", icon: Users },
      { id: "systems", label: "Sistemas", icon: Settings },
      { id: "system-commissions", label: "Comisiones", icon: Percent },
      { id: "fixed-expenses", label: "Gastos Fijos", icon: DollarSign },
    ],
  },
  {
    group: "Reportes",
    items: [
      { id: "systems-summary", label: "Resumen por Sistemas", icon: Grid3x3 },
      { id: "systems-summary-manual", label: "Resumen Operadoras", icon: Edit3 },
      { id: "weekly-cuadre-complete", label: "Cuadre Semanal", icon: FileSpreadsheet },
      { id: "ganancias", label: "Ganancias", icon: TrendingUp },
      { id: "banqueo", label: "Banqueo", icon: Landmark },
    ],
  },
];

interface AdminSidebarProps {
  currentView: AdminView;
  onViewChange: (view: AdminView) => void;
}

export function AdminSidebar({ currentView, onViewChange }: AdminSidebarProps) {
  const { open: sidebarOpen } = useSidebar();

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        {menuItems.map((section) => (
          <SidebarGroup key={section.group}>
            <SidebarGroupLabel>{section.group}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map((item) => {
                  const isActive = currentView === item.id;
                  return (
                    <SidebarMenuItem key={item.id}>
                      <SidebarMenuButton
                        onClick={() => onViewChange(item.id as AdminView)}
                        isActive={isActive}
                        tooltip={item.label}
                      >
                        <item.icon className="h-4 w-4" />
                        {sidebarOpen && <span>{item.label}</span>}
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
    </Sidebar>
  );
}
