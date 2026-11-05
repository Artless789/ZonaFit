import React from 'react';
import {
  PlusCircle,
  Edit3,
  Trash2,
  AlertTriangle,
  RefreshCw,
  ShoppingBag,
  DollarSign,
  Coins,
  Lock,
  LockOpen,
  LogIn,
  LogOut,
  Key,
  Shield,
  Users,
  UserCheck,
  CreditCard,
  Package,
  Settings,
  Archive,
  ArrowLeftRight,
  Database,
  Tag,
} from 'lucide-react';
import { Badge } from '@shared/ui/Badge';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale/es';

export interface AuditModuleConfig {
  label: string;
  variant: 'brand' | 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'default';
  icon: React.ComponentType<{ size?: number; className?: string }>;
}

export interface AuditActionConfig {
  label: string;
  variant: 'brand' | 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'default';
  icon: React.ComponentType<{ size?: number; className?: string }>;
}

export const MODULE_CONFIGS: Record<string, AuditModuleConfig> = {
  MEMBERSHIPS: { label: 'Membresías', variant: 'brand', icon: CreditCard },
  CLIENTS: { label: 'Clientes', variant: 'info', icon: Users },
  SALES: { label: 'Ventas POS', variant: 'success', icon: ShoppingBag },
  PAYMENTS: { label: 'Pagos', variant: 'warning', icon: DollarSign },
  INVENTORY: { label: 'Inventario', variant: 'neutral', icon: Package },
  CASH_REGISTER: { label: 'Caja', variant: 'warning', icon: Archive },
  SETTINGS: { label: 'Configuración', variant: 'neutral', icon: Settings },
  USERS: { label: 'Usuarios', variant: 'info', icon: UserCheck },
  AUTH: { label: 'Autenticación', variant: 'default', icon: Key },
};

export const ACTION_CONFIGS: Record<string, AuditActionConfig> = {
  LOGIN: { label: 'Inicio de Sesión', variant: 'info', icon: LogIn },
  LOGOUT: { label: 'Cierre de Sesión', variant: 'neutral', icon: LogOut },
  CREATE: { label: 'Creación', variant: 'success', icon: PlusCircle },
  UPDATE: { label: 'Modificación', variant: 'warning', icon: Edit3 },
  DELETE: { label: 'Eliminación', variant: 'danger', icon: Trash2 },

  USER_CREATED: { label: 'Usuario Creado', variant: 'success', icon: PlusCircle },
  USER_UPDATED: { label: 'Usuario Modificado', variant: 'warning', icon: Edit3 },
  ROLE_CHANGED: { label: 'Rol Cambiado', variant: 'brand', icon: Shield },
  USER_DEACTIVATED: { label: 'Usuario Desactivado', variant: 'danger', icon: Trash2 },
  USER_ACTIVATED: { label: 'Usuario Activado', variant: 'success', icon: PlusCircle },

  CLIENT_CREATED: { label: 'Cliente Creado', variant: 'success', icon: PlusCircle },
  CLIENT_UPDATED: { label: 'Cliente Modificado', variant: 'warning', icon: Edit3 },
  CLIENT_DEACTIVATED: { label: 'Cliente Desactivado', variant: 'danger', icon: Trash2 },

  MEMBERSHIP_CREATED: { label: 'Membresía Asignada', variant: 'brand', icon: PlusCircle },
  MEMBERSHIP_RENEWED: { label: 'Membresía Renovada', variant: 'brand', icon: RefreshCw },
  MEMBERSHIP_CANCELLED: { label: 'Membresía Cancelada', variant: 'danger', icon: AlertTriangle },

  PAYMENT_CREATED: { label: 'Pago Registrado', variant: 'warning', icon: DollarSign },
  PAYMENT_CANCELLED: { label: 'Pago Cancelado', variant: 'danger', icon: AlertTriangle },

  SALE_COMPLETED: { label: 'Venta Completada', variant: 'success', icon: ShoppingBag },
  SALE_CANCELLED: { label: 'Venta Cancelada', variant: 'danger', icon: AlertTriangle },

  INVENTORY_MOVEMENT: { label: 'Mov. Inventario', variant: 'info', icon: ArrowLeftRight },
  PRODUCT_CREATED: { label: 'Producto Creado', variant: 'success', icon: PlusCircle },
  PRODUCT_UPDATED: { label: 'Producto Modificado', variant: 'warning', icon: Edit3 },
  PRODUCT_DEACTIVATED: { label: 'Producto Desactivado', variant: 'danger', icon: Trash2 },

  CASH_REGISTER_OPENED: { label: 'Apertura de Caja', variant: 'success', icon: LockOpen },
  CASH_REGISTER_CLOSED: { label: 'Cierre de Caja', variant: 'danger', icon: Lock },
  CASH_REGISTER_MOVEMENT: { label: 'Mov. de Caja', variant: 'warning', icon: Coins },

  GYM_SETTINGS_UPDATED: { label: 'Ajustes del Gimnasio', variant: 'neutral', icon: Settings },
  SUBSCRIPTION_CREATED: { label: 'Suscripción Creada', variant: 'brand', icon: PlusCircle },
};

export function formatAuditDate(isoString: string): string {
  try {
    return format(parseISO(isoString), "d MMM, yyyy · HH:mm:ss", { locale: es });
  } catch {
    return isoString;
  }
}

export function formatAuditDateShort(isoString: string): string {
  try {
    return format(parseISO(isoString), "dd/MM/yyyy HH:mm", { locale: es });
  } catch {
    return isoString;
  }
}

export function renderModuleBadge(module?: string | null) {
  if (!module) {
    return (
      <Badge variant="neutral" className="flex items-center gap-1.5 w-fit">
        <Database size={11} /> General
      </Badge>
    );
  }

  const config = MODULE_CONFIGS[module.toUpperCase()] || {
    label: module,
    variant: 'neutral' as const,
    icon: Database,
  };
  const Icon = config.icon;

  return (
    <Badge variant={config.variant} className="flex items-center gap-1.5 w-fit">
      <Icon size={11} /> {config.label}
    </Badge>
  );
}

export function renderActionBadge(action: string) {
  const normalizedAction = action.toUpperCase();
  const config = ACTION_CONFIGS[normalizedAction] || {
    label: action,
    variant: 'default' as const,
    icon: Tag,
  };
  const Icon = config.icon;

  return (
    <Badge variant={config.variant} className="flex items-center gap-1.5 w-fit font-medium">
      <Icon size={12} /> {config.label}
    </Badge>
  );
}

export function formatValueForDisplay(val: unknown): string {
  if (val === null || val === undefined) return '—';
  if (typeof val === 'boolean') return val ? 'Sí' : 'No';
  if (typeof val === 'number') {
    return Number.isInteger(val) ? String(val) : val.toFixed(2);
  }
  if (typeof val === 'object') {
    try {
      return JSON.stringify(val);
    } catch {
      return String(val);
    }
  }
  return String(val);
}
