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
  name: 'Merwil ZonaFit Demo Gym',
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
  { id: 1, gym_id: 99999, category_id: 1, name: 'Proteína Whey 2lb', sku: '12345', barcode: '12345', price: 150000, sale_price: 150000, purchase_price: 100000, stock: 12, minimum_stock: 5, is_active: true, created_at: now.toISOString(), updated_at: now.toISOString() },
  { id: 2, gym_id: 99999, category_id: 2, name: 'Agua Mineral 500ml', sku: '54321', barcode: '54321', price: 3000, sale_price: 3000, purchase_price: 1500, stock: 50, minimum_stock: 20, is_active: true, created_at: now.toISOString(), updated_at: now.toISOString() },
  { id: 3, gym_id: 99999, category_id: 2, name: 'Bebida Energizante', sku: '11111', barcode: '11111', price: 6000, sale_price: 6000, purchase_price: 3500, stock: 30, minimum_stock: 10, is_active: true, created_at: now.toISOString(), updated_at: now.toISOString() },
  { id: 4, gym_id: 99999, category_id: 3, name: 'Guantes de Cuero', sku: '22222', barcode: '22222', price: 45000, sale_price: 45000, purchase_price: 25000, stock: 5, minimum_stock: 5, is_active: true, created_at: now.toISOString(), updated_at: now.toISOString() },
];

export const MOCK_CLIENTS = [
  { id: 1, full_name: 'Carlos Rodríguez', document_type: 'CC', document: '1010101010', phone: '3001111111', email: 'carlos@demo.com', is_active: true, created_at: subDays(now, 10).toISOString() },
  { id: 2, full_name: 'Laura Martínez', document_type: 'CC', document: '2020202020', phone: '3002222222', email: 'laura@demo.com', is_active: true, created_at: subDays(now, 5).toISOString() },
  { id: 3, full_name: 'Andrés Gómez', document_type: 'CC', document: '3030303030', phone: '3003333333', email: 'andres@demo.com', is_active: true, created_at: subDays(now, 3).toISOString() },
  { id: 4, full_name: 'María Torres', document_type: 'CC', document: '4040404040', phone: '3004444444', email: 'maria@demo.com', is_active: true, created_at: subDays(now, 1).toISOString() },
  { id: 5, full_name: 'Sebastián Pérez', document_type: 'CC', document: '5050505050', phone: '3005555555', email: 'sebastian@demo.com', is_active: false, created_at: subDays(now, 60).toISOString() },
];

export const MOCK_MEMBERSHIPS = [
  { id: 1, client_id: 1, membership_plan_id: 1, price: 80000, start_date: subDays(now, 20).toISOString(), end_date: addDays(now, 10).toISOString(), status: 'ACTIVE', trainer_name: 'David', is_active: true, total_paid: 80000, pending_balance: 0, payments: [{ id: 1, amount: 80000, payment_method: 'CASH', status: 'PAID', created_at: subDays(now, 20).toISOString() }], created_at: subDays(now, 20).toISOString() },
  { id: 2, client_id: 2, membership_plan_id: 2, price: 200000, start_date: subDays(now, 2).toISOString(), end_date: addDays(now, 88).toISOString(), status: 'ACTIVE', trainer_name: 'Ana', is_active: true, total_paid: 200000, pending_balance: 0, payments: [{ id: 2, amount: 200000, payment_method: 'TRANSFER', status: 'PAID', created_at: subDays(now, 2).toISOString() }], created_at: subDays(now, 2).toISOString() },
  { id: 3, client_id: 3, membership_plan_id: 1, price: 80000, start_date: subDays(now, 35).toISOString(), end_date: subDays(now, 5).toISOString(), status: 'EXPIRED', trainer_name: 'David', is_active: true, total_paid: 40000, pending_balance: 40000, payments: [{ id: 3, amount: 40000, payment_method: 'CASH', status: 'PAID', created_at: subDays(now, 35).toISOString() }], created_at: subDays(now, 35).toISOString() },
  { id: 4, client_id: 4, membership_plan_id: 1, price: 80000, start_date: subDays(now, 1).toISOString(), end_date: addDays(now, 29).toISOString(), status: 'ACTIVE', trainer_name: 'Ana', is_active: true, total_paid: 80000, pending_balance: 0, payments: [{ id: 4, amount: 80000, payment_method: 'CARD', status: 'PAID', created_at: subDays(now, 1).toISOString() }], created_at: subDays(now, 1).toISOString() },
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
  sales_today: 5,
  sales_today_amount: 150000,
  income_this_month: 320000,
  active_clients: 3,
  expiring_memberships_count: 1,
  total_receivables: 190000,
  overdue_receivables: 40000,
  recent_activity: [
    { id: "1", type: 'MEMBERSHIP', title: 'Nueva Membresía', subtitle: 'María Torres adquirió Mensualidad Básica', amount: 80000, created_at: subDays(now, 1).toISOString() },
    { id: "2", type: 'SALE', title: 'Venta de Producto', subtitle: 'Venta de Proteína Whey a Carlos Rodríguez (Crédito)', amount: 150000, created_at: subDays(now, 5).toISOString() },
    { id: "3", type: 'MEMBERSHIP', title: 'Nueva Membresía', subtitle: 'Laura Martínez adquirió Trimestre Premium', amount: 200000, created_at: subDays(now, 2).toISOString() },
    { id: "4", type: 'CLIENT', title: 'Nuevo Cliente', subtitle: 'Nuevo cliente: Andrés Gómez', amount: null, created_at: subDays(now, 3).toISOString() },
  ],
  expiring_memberships: [
    { id: 1, client_name: 'Carlos Rodríguez', plan_name: 'Mensualidad Básica', end_date: addDays(now, 10).toISOString(), days_left: 10 }
  ],
  receivables: [
    { id: 1, client_name: 'Andrés Gómez', balance_due: 40000, due_date: subDays(now, 2).toISOString(), days_overdue: 2 },
    { id: 2, client_name: 'Carlos Rodríguez', balance_due: 150000, due_date: addDays(now, 15).toISOString(), days_overdue: 0 }
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

export const MOCK_SUBSCRIPTION = {
  id: 1,
  gym_id: 99999,
  status: 'TRIAL',
  starts_at: subDays(now, 5).toISOString(),
  ends_at: addDays(now, 9).toISOString(),
  is_lifetime: false,
  cancellation_requested_at: null,
  plan: {
    id: 1,
    name: 'Plan Pro',
    price: 99000,
    billing_interval: 'MONTHLY',
  }
};

export const MOCK_SAAS_PLANS = [
  {
    id: 1,
    name: 'Plan Mensual Pro',
    description: 'Acceso total para gimnasios en crecimiento',
    price: 99000,
    billing_interval: 'MONTHLY',
    duration_days: 30,
    is_active: true,
    features: ['Gestión de clientes ilimitada', 'Punto de Venta POS', 'Facturación electrónica', 'Control de caja']
  },
  {
    id: 2,
    name: 'Plan Anual VIP',
    description: 'Ahorra 20% pagando el año completo',
    price: 950000,
    billing_interval: 'YEARLY',
    duration_days: 365,
    is_active: true,
    features: ['Todo lo del plan Pro', 'Soporte prioritario 24/7', 'Módulo de WhatsApp ilimitado', 'Auditoría avanzada']
  }
];
