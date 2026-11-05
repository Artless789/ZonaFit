export const Permission = {
  VIEW_FINANCIALS: 'view_financials',
  VIEW_REPORTS: 'view_reports',
  MANAGE_CLIENTS: 'manage_clients',
  MANAGE_MEMBERSHIPS: 'manage_memberships',
  CANCEL_MEMBERSHIPS: 'cancel_memberships',
  MANAGE_PAYMENTS: 'manage_payments',
  MANAGE_SALES: 'manage_sales',
  OPERATE_CASH: 'operate_cash',
  VIEW_CASH_HISTORY: 'view_cash_history',
  MANAGE_INVENTORY: 'manage_inventory',
  VIEW_AUDIT: 'view_audit',
  MANAGE_SETTINGS: 'manage_settings',
  MANAGE_USERS: 'manage_users',
} as const;

export type PermissionKey = typeof Permission[keyof typeof Permission];

export interface UserLike {
  role?: string;
  permissions?: Record<string, boolean> | null;
}

export const DEFAULT_ROLE_PERMISSIONS: Record<string, Record<string, boolean>> = {
  SUPERADMIN: {
    '*': true,
  },
  OWNER: {
    '*': true,
    [Permission.VIEW_FINANCIALS]: true,
    [Permission.VIEW_REPORTS]: true,
    [Permission.MANAGE_CLIENTS]: true,
    [Permission.MANAGE_MEMBERSHIPS]: true,
    [Permission.CANCEL_MEMBERSHIPS]: true,
    [Permission.MANAGE_PAYMENTS]: true,
    [Permission.MANAGE_SALES]: true,
    [Permission.OPERATE_CASH]: true,
    [Permission.VIEW_CASH_HISTORY]: true,
    [Permission.MANAGE_INVENTORY]: true,
    [Permission.VIEW_AUDIT]: true,
    [Permission.MANAGE_SETTINGS]: true,
    [Permission.MANAGE_USERS]: true,
  },
  ADMIN: {
    [Permission.VIEW_FINANCIALS]: true,
    [Permission.VIEW_REPORTS]: true,
    [Permission.MANAGE_CLIENTS]: true,
    [Permission.MANAGE_MEMBERSHIPS]: true,
    [Permission.CANCEL_MEMBERSHIPS]: true,
    [Permission.MANAGE_PAYMENTS]: true,
    [Permission.MANAGE_SALES]: true,
    [Permission.OPERATE_CASH]: true,
    [Permission.VIEW_CASH_HISTORY]: true,
    [Permission.MANAGE_INVENTORY]: true,
    [Permission.VIEW_AUDIT]: true,
    [Permission.MANAGE_SETTINGS]: false,
    [Permission.MANAGE_USERS]: true,
  },
  EMPLOYEE: {
    [Permission.VIEW_FINANCIALS]: false,
    [Permission.VIEW_REPORTS]: false,
    [Permission.MANAGE_CLIENTS]: true,
    [Permission.MANAGE_MEMBERSHIPS]: true,
    [Permission.CANCEL_MEMBERSHIPS]: false,
    [Permission.MANAGE_PAYMENTS]: true,
    [Permission.MANAGE_SALES]: true,
    [Permission.OPERATE_CASH]: true,
    [Permission.VIEW_CASH_HISTORY]: false,
    [Permission.MANAGE_INVENTORY]: false,
    [Permission.VIEW_AUDIT]: false,
    [Permission.MANAGE_SETTINGS]: false,
    [Permission.MANAGE_USERS]: false,
  },
  STAFF: {
    [Permission.VIEW_FINANCIALS]: false,
    [Permission.VIEW_REPORTS]: false,
    [Permission.MANAGE_CLIENTS]: true,
    [Permission.MANAGE_MEMBERSHIPS]: true,
    [Permission.CANCEL_MEMBERSHIPS]: false,
    [Permission.MANAGE_PAYMENTS]: true,
    [Permission.MANAGE_SALES]: true,
    [Permission.OPERATE_CASH]: true,
    [Permission.VIEW_CASH_HISTORY]: false,
    [Permission.MANAGE_INVENTORY]: false,
    [Permission.VIEW_AUDIT]: false,
    [Permission.MANAGE_SETTINGS]: false,
    [Permission.MANAGE_USERS]: false,
  },
};

export function hasPermission(user: UserLike | null | undefined, permission: PermissionKey): boolean {
  if (!user) return false;
  const role = (user.role || '').toUpperCase();
  if (role === 'SUPERADMIN' || role === 'OWNER') return true;

  if (user.permissions && typeof user.permissions === 'object') {
    if (user.permissions['*'] === true) return true;
    if (permission in user.permissions) {
      return Boolean(user.permissions[permission]);
    }
  }

  const roleKey = role === 'STAFF' ? 'EMPLOYEE' : role;
  const defaults = DEFAULT_ROLE_PERMISSIONS[roleKey] || DEFAULT_ROLE_PERMISSIONS.EMPLOYEE;
  return Boolean(defaults[permission]);
}

export function canViewFinancials(user: UserLike | null | undefined): boolean {
  return hasPermission(user, Permission.VIEW_FINANCIALS);
}

export function canViewReports(user: UserLike | null | undefined): boolean {
  return hasPermission(user, Permission.VIEW_REPORTS);
}

export function canViewAudit(user: UserLike | null | undefined): boolean {
  return hasPermission(user, Permission.VIEW_AUDIT);
}

export function canManageUsers(user: UserLike | null | undefined): boolean {
  return hasPermission(user, Permission.MANAGE_USERS);
}

export function canManageSettings(user: UserLike | null | undefined): boolean {
  return hasPermission(user, Permission.MANAGE_SETTINGS);
}
