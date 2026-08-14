import { addDays, subDays } from 'date-fns';

const now = new Date();

export const MOCK_USER = {
  id: 99999,
  email: 'admin@zonafitdemo.com',
  full_name: 'Demo Admin',
  role: 'OWNER',
  gym_id: 99999,
  is_active: true,
  onboarding_completed: true,
};

export const MOCK_GYM = {
  id: 99999,
  name: 'ZonaFit Demo Gym',
  document_type: 'NIT',
  document: '900000000-1',
  phone: '3000000000',
  address: 'Calle Demo 123',
  country: 'Colombia',
  currency: 'COP',
  is_active: true,
  stripe_customer_id: null,
  subscription_status: 'ACTIVE',
  subscription_plan_id: null,
  subscription_current_period_end: addDays(now, 30).toISOString(),
  trial_ends_at: null,
  cancel_at_period_end: false,
};

export const MOCK_MEMBERSHIP_PLANS = [
  { id: 1, name: 'Mensualidad Básica', description: 'Acceso a zona de pesas', duration_days: 30, price: 80000, is_active: true, created_at: now.toISOString() },
  { id: 2, name: 'Trimestre Premium', description: 'Acceso a todo + clases', duration_days: 90, price: 200000, is_active: true, created_at: now.toISOString() },
  { id: 3, name: 'Día Suelto', description: 'Acceso por un día', duration_days: 1, price: 15000, is_active: true, created_at: now.toISOString() },
];

export const MOCK_CATEGORIES = [
  { id: 1, name: 'Suplementos', description: 'Proteínas y vitaminas', is_active: true },
  { id: 2, name: 'Bebidas', description: 'Agua y energizantes', is_active: true },
  { id: 3, name: 'Accesorios', description: 'Guantes, toallas, etc', is_active: true },
];

export const MOCK_PRODUCTS = [
  { id: 1, category_id: 1, name: 'Proteína Whey 2lb', barcode: '12345', price: 150000, stock: 12, minimum_stock: 5, is_active: true },
  { id: 2, category_id: 2, name: 'Agua Mineral 500ml', barcode: '54321', price: 3000, stock: 50, minimum_stock: 20, is_active: true },
  { id: 3, category_id: 2, name: 'Bebida Energizante', barcode: '11111', price: 6000, stock: 30, minimum_stock: 10, is_active: true },
  { id: 4, category_id: 3, name: 'Guantes de Cuero', barcode: '22222', price: 45000, stock: 5, minimum_stock: 5, is_active: true },
];

export const MOCK_CLIENTS = [
  { id: 1, full_name: 'Carlos Rodríguez', document_type: 'CC', document: '1010101010', phone: '3001111111', email: 'carlos@demo.com', is_active: true, created_at: subDays(now, 10).toISOString() },
  { id: 2, full_name: 'Laura Martínez', document_type: 'CC', document: '2020202020', phone: '3002222222', email: 'laura@demo.com', is_active: true, created_at: subDays(now, 5).toISOString() },
  { id: 3, full_name: 'Andrés Gómez', document_type: 'CC', document: '3030303030', phone: '3003333333', email: 'andres@demo.com', is_active: true, created_at: subDays(now, 3).toISOString() },
  { id: 4, full_name: 'María Torres', document_type: 'CC', document: '4040404040', phone: '3004444444', email: 'maria@demo.com', is_active: true, created_at: subDays(now, 1).toISOString() },
  { id: 5, full_name: 'Sebastián Pérez', document_type: 'CC', document: '5050505050', phone: '3005555555', email: 'sebastian@demo.com', is_active: false, created_at: subDays(now, 60).toISOString() },
];

export const MOCK_MEMBERSHIPS = [
  { id: 1, client_id: 1, membership_plan_id: 1, start_date: subDays(now, 20).toISOString(), end_date: addDays(now, 10).toISOString(), status: 'ACTIVE', trainer_name: 'David', is_active: true, created_at: subDays(now, 20).toISOString() },
  { id: 2, client_id: 2, membership_plan_id: 2, start_date: subDays(now, 2).toISOString(), end_date: addDays(now, 88).toISOString(), status: 'ACTIVE', trainer_name: 'Ana', is_active: true, created_at: subDays(now, 2).toISOString() },
  { id: 3, client_id: 3, membership_plan_id: 1, start_date: subDays(now, 35).toISOString(), end_date: subDays(now, 5).toISOString(), status: 'EXPIRED', trainer_name: 'David', is_active: true, created_at: subDays(now, 35).toISOString() },
  { id: 4, client_id: 4, membership_plan_id: 1, start_date: subDays(now, 1).toISOString(), end_date: addDays(now, 29).toISOString(), status: 'ACTIVE', trainer_name: 'Ana', is_active: true, created_at: subDays(now, 1).toISOString() },
];

export const MOCK_AR = [
  { id: 1, client_id: 3, original_amount: 80000, balance_due: 40000, due_date: subDays(now, 2).toISOString(), status: 'OVERDUE', is_active: true, created_at: subDays(now, 35).toISOString(), description: "Membresía Mensual" },
  { id: 2, client_id: 1, original_amount: 150000, balance_due: 150000, due_date: addDays(now, 15).toISOString(), status: 'PENDING', is_active: true, created_at: subDays(now, 5).toISOString(), description: "Proteína Whey 2lb" },
];

export const MOCK_PAYMENTS = [
  { id: 1, amount: 80000, payment_method: 'CASH', status: 'PAID', is_active: true, created_at: subDays(now, 20).toISOString() },
  { id: 2, amount: 200000, payment_method: 'TRANSFER', status: 'PAID', is_active: true, created_at: subDays(now, 2).toISOString() },
  { id: 3, amount: 40000, payment_method: 'CASH', status: 'PAID', is_active: true, created_at: subDays(now, 35).toISOString() },
  { id: 4, amount: 80000, payment_method: 'CARD', status: 'PAID', is_active: true, created_at: subDays(now, 1).toISOString() },
];

export const MOCK_DASHBOARD = {
  daily_sales_total: 80000, // Today's payment for María
  daily_sales_count: 1,
  monthly_revenue: 320000,
  monthly_revenue_change_percentage: 15.5,
  active_clients: 3,
  active_clients_change_percentage: 5.2,
  expiring_memberships_count: 1, // Carlos expires in 10 days
  pending_accounts_total: 190000,
  pending_accounts_count: 2,
  recent_activity: [
    { type: 'membership_sale', description: 'María Torres adquirió Mensualidad Básica', time: subDays(now, 1).toISOString() },
    { type: 'product_sale', description: 'Venta de Proteína Whey a Carlos Rodríguez (Crédito)', time: subDays(now, 5).toISOString() },
    { type: 'membership_sale', description: 'Laura Martínez adquirió Trimestre Premium', time: subDays(now, 2).toISOString() },
    { type: 'client_created', description: 'Nuevo cliente: Andrés Gómez', time: subDays(now, 3).toISOString() },
  ],
  expiring_memberships: [
    { id: 1, client_id: 1, client_name: 'Carlos Rodríguez', client_document: '1010101010', plan_name: 'Mensualidad Básica', end_date: addDays(now, 10).toISOString(), days_left: 10 }
  ],
  pending_accounts: [
    { id: 1, client_name: 'Andrés Gómez', balance_due: 40000, due_date: subDays(now, 2).toISOString() },
    { id: 2, client_name: 'Carlos Rodríguez', balance_due: 150000, due_date: addDays(now, 15).toISOString() }
  ]
};

export const MOCK_AUDIT = [
  { id: 1, user_id: 99999, user_name: 'Demo Admin', action: 'CREATE', module: 'MEMBERSHIPS', entity_id: 4, details: 'Created membership for María', ip_address: '127.0.0.1', created_at: subDays(now, 1).toISOString() },
  { id: 2, user_id: 99999, user_name: 'Demo Admin', action: 'CREATE', module: 'SALES', entity_id: 2, details: 'Sold product on credit', ip_address: '127.0.0.1', created_at: subDays(now, 5).toISOString() },
];

export const MOCK_INVOICES = [
  { id: 1, code: 'INV-1001', type: 'PAYMENT', subtotal: 80000, discount: 0, total: 80000, status: 'GENERATED', created_at: subDays(now, 20).toISOString(), client_id: 1 },
  { id: 2, code: 'INV-1002', type: 'PAYMENT', subtotal: 200000, discount: 0, total: 200000, status: 'GENERATED', created_at: subDays(now, 2).toISOString(), client_id: 2 },
  { id: 3, code: 'INV-1003', type: 'PAYMENT', subtotal: 40000, discount: 0, total: 40000, status: 'GENERATED', created_at: subDays(now, 35).toISOString(), client_id: 3 },
  { id: 4, code: 'INV-1004', type: 'PAYMENT', subtotal: 80000, discount: 0, total: 80000, status: 'GENERATED', created_at: subDays(now, 1).toISOString(), client_id: 4 },
];

export const MOCK_USERS = [
  { id: 99999, email: 'admin@zonafitdemo.com', full_name: 'Demo Admin', role: 'OWNER', is_active: true },
  { id: 99998, email: 'staff@zonafitdemo.com', full_name: 'Recepcionista', role: 'STAFF', is_active: true },
  { id: 99997, email: 'entrenador@zonafitdemo.com', full_name: 'Entrenador Jefe', role: 'STAFF', is_active: true },
];

export const MOCK_CASH_REGISTERS = [
  { id: 1, user_id: 99999, opened_at: subDays(now, 0).setHours(6, 0, 0, 0), closed_at: null, initial_balance: 200000, final_balance: null, status: 'OPEN', total_sales: 80000, total_expenses: 0 },
];

export const MOCK_CASH_MOVEMENTS = [
  { id: 1, cash_register_id: 1, type: 'IN', amount: 80000, description: 'Venta de membresía - María Torres', created_at: subDays(now, 1).toISOString() }
];
