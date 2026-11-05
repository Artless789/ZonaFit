from typing import Any, Dict, Optional


class Role:
    SUPERADMIN = "SUPERADMIN"
    OWNER = "OWNER"
    ADMIN = "ADMIN"
    EMPLOYEE = "EMPLOYEE"
    STAFF = "STAFF"  # Legacy alias for EMPLOYEE


class Permission:
    # Financial permissions
    VIEW_FINANCIALS = "view_financials"  # Monthly income, profit, global financial summaries
    VIEW_REPORTS = "view_reports"        # Detailed financial and sales reports

    # Operational permissions
    MANAGE_CLIENTS = "manage_clients"          # View, create, edit clients
    MANAGE_MEMBERSHIPS = "manage_memberships"  # Create, renew memberships
    CANCEL_MEMBERSHIPS = "cancel_memberships"  # Cancel/void memberships
    MANAGE_PAYMENTS = "manage_payments"        # Register payments
    MANAGE_SALES = "manage_sales"              # POS sales & checkout
    OPERATE_CASH = "operate_cash"              # Open/close shift, cash drawer movements
    VIEW_CASH_HISTORY = "view_cash_history"    # View historical cash register closures
    MANAGE_INVENTORY = "manage_inventory"      # Inventory movements & product management

    # Administrative permissions
    VIEW_AUDIT = "view_audit"            # Audit log inspection
    MANAGE_SETTINGS = "manage_settings"  # Gym settings & configuration
    MANAGE_USERS = "manage_users"        # Create/manage staff accounts


DEFAULT_ROLE_PERMISSIONS: Dict[str, Dict[str, bool]] = {
    Role.SUPERADMIN: {
        "*": True,
    },
    Role.OWNER: {
        "*": True,
        Permission.VIEW_FINANCIALS: True,
        Permission.VIEW_REPORTS: True,
        Permission.MANAGE_CLIENTS: True,
        Permission.MANAGE_MEMBERSHIPS: True,
        Permission.CANCEL_MEMBERSHIPS: True,
        Permission.MANAGE_PAYMENTS: True,
        Permission.MANAGE_SALES: True,
        Permission.OPERATE_CASH: True,
        Permission.VIEW_CASH_HISTORY: True,
        Permission.MANAGE_INVENTORY: True,
        Permission.VIEW_AUDIT: True,
        Permission.MANAGE_SETTINGS: True,
        Permission.MANAGE_USERS: True,
    },
    Role.ADMIN: {
        # Configurable admin defaults:
        # Permitted operational & staff management + audit.
        # Can be explicitly restricted by Owner (e.g. view_financials: False).
        Permission.VIEW_FINANCIALS: True,
        Permission.VIEW_REPORTS: True,
        Permission.MANAGE_CLIENTS: True,
        Permission.MANAGE_MEMBERSHIPS: True,
        Permission.CANCEL_MEMBERSHIPS: True,
        Permission.MANAGE_PAYMENTS: True,
        Permission.MANAGE_SALES: True,
        Permission.OPERATE_CASH: True,
        Permission.VIEW_CASH_HISTORY: True,
        Permission.MANAGE_INVENTORY: True,
        Permission.VIEW_AUDIT: True,
        Permission.MANAGE_SETTINGS: False,  # Institutional configuration reserved for OWNER
        Permission.MANAGE_USERS: True,
    },
    Role.EMPLOYEE: {
        # Strictly operational: front desk operations only
        # Absolutely NO access to monthly financials, profits, audit, or user management
        Permission.VIEW_FINANCIALS: False,
        Permission.VIEW_REPORTS: False,
        Permission.MANAGE_CLIENTS: True,
        Permission.MANAGE_MEMBERSHIPS: True,
        Permission.CANCEL_MEMBERSHIPS: False,
        Permission.MANAGE_PAYMENTS: True,
        Permission.MANAGE_SALES: True,
        Permission.OPERATE_CASH: True,
        Permission.VIEW_CASH_HISTORY: False,
        Permission.MANAGE_INVENTORY: False,
        Permission.VIEW_AUDIT: False,
        Permission.MANAGE_SETTINGS: False,
        Permission.MANAGE_USERS: False,
    },
    Role.STAFF: {
        # Exact alias of EMPLOYEE
        Permission.VIEW_FINANCIALS: False,
        Permission.VIEW_REPORTS: False,
        Permission.MANAGE_CLIENTS: True,
        Permission.MANAGE_MEMBERSHIPS: True,
        Permission.CANCEL_MEMBERSHIPS: False,
        Permission.MANAGE_PAYMENTS: True,
        Permission.MANAGE_SALES: True,
        Permission.OPERATE_CASH: True,
        Permission.VIEW_CASH_HISTORY: False,
        Permission.MANAGE_INVENTORY: False,
        Permission.VIEW_AUDIT: False,
        Permission.MANAGE_SETTINGS: False,
        Permission.MANAGE_USERS: False,
    },
}


def normalize_role(role: Optional[str]) -> str:
    """Normalizes role strings (e.g. staff -> EMPLOYEE)."""
    if not role:
        return Role.EMPLOYEE
    clean = role.strip().upper()
    if clean == "STAFF":
        return Role.EMPLOYEE
    return clean


def user_has_permission(user: Any, permission_name: str) -> bool:
    """
    Evaluates whether a user has a specific permission.
    Owners and Superadmins have universal access (*).
    User-specific permissions override role defaults.
    """
    if not user or not getattr(user, "is_active", True):
        return False

    raw_role = getattr(user, "role", "") or ""
    role_upper = raw_role.strip().upper()

    # Universal access for platform superadmin and gym owner
    if role_upper in (Role.SUPERADMIN, Role.OWNER):
        return True

    # Check custom user permissions if stored on the user record
    custom_perms = getattr(user, "permissions", None)
    if isinstance(custom_perms, dict):
        if custom_perms.get("*") is True:
            return True
        if permission_name in custom_perms:
            return bool(custom_perms[permission_name])

    # Fallback to role defaults
    role_key = Role.EMPLOYEE if role_upper == "STAFF" else role_upper
    defaults = DEFAULT_ROLE_PERMISSIONS.get(role_key, DEFAULT_ROLE_PERMISSIONS[Role.EMPLOYEE])
    return bool(defaults.get(permission_name, False))
