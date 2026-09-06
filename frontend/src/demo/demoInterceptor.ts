import { api } from '../services/api';
import * as mockData from './mockData';

// We simulate network delay to make the demo feel real
const delay = (ms = 400) => new Promise(resolve => setTimeout(resolve, ms));

// Auth routes that must always reach the real backend
const AUTH_PASSTHROUGH_PATTERNS = [
  '/auth/login',
  '/auth/register',
  '/auth/logout',
  '/auth/me',
  '/auth/forgot-password',
  '/auth/reset-password',
];

function isAuthRoute(url: string): boolean {
  return AUTH_PASSTHROUGH_PATTERNS.some(pattern => url.includes(pattern));
}

let interceptorId: number | null = null;

export function setupDemoInterceptor() {
  // Guard: only register once
  if (interceptorId !== null) return;

  interceptorId = api.interceptors.request.use(async (config) => {
    const url = config.url || '';

    // CRITICAL: Auth routes always bypass demo mode
    if (isAuthRoute(url)) {
      return config;
    }

    // Only intercept when explicitly in the demo routes
    if (!window.location.pathname.startsWith('/demo')) {
      return config;
    }

    // Intercept and return mock data directly using config.adapter
    config.adapter = async (config) => {
      try {
        await delay();

        const method = config.method?.toUpperCase();
        const reqUrl = config.url || '';

        // POST / PUT / PATCH / DELETE mutations
        if (method !== 'GET') {
          // Special mutation: Create Membership
          if (reqUrl.includes('/memberships') && method === 'POST') {
            const body = typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
            const newMemId = mockData.MOCK_MEMBERSHIPS.length + 1;
            const client = mockData.MOCK_CLIENTS.find(c => c.id === Number(body.client_id)) || {
              id: Number(body.client_id),
              full_name: 'Cliente Demo',
              document: '12345678',
              document_type: 'CC',
              phone: '3000000000',
              email: 'cliente@demo.com',
              is_active: true,
              created_at: new Date().toISOString()
            };
            const plan = mockData.MOCK_MEMBERSHIP_PLANS.find(p => p.id === Number(body.membership_plan_id)) || {
              id: Number(body.membership_plan_id),
              name: 'Plan Demo',
              duration_days: 30,
              price: Number(body.price) || 80000,
              description: '',
              is_active: true,
              created_at: new Date().toISOString()
            };

            const paid = Number(body.initial_payment || body.amount || (body.pending_balance !== undefined ? (Number(body.price || plan.price) - Number(body.pending_balance)) : Number(body.price || plan.price))) || 0;
            const total = Number(body.price || plan.price) || 80000;
            const balance = Math.max(0, total - paid);

            let newPayment = null;
            if (paid > 0) {
              newPayment = {
                id: mockData.MOCK_PAYMENTS.length + 1,
                amount: paid,
                payment_method: body.payment_method || 'CASH',
                status: 'PAID',
                is_active: true,
                created_at: new Date().toISOString()
              };
              mockData.MOCK_PAYMENTS.push(newPayment);

              if (mockData.MOCK_CASH_REGISTERS[0]) {
                mockData.MOCK_CASH_MOVEMENTS.push({
                  id: mockData.MOCK_CASH_MOVEMENTS.length + 1,
                  cash_register_id: mockData.MOCK_CASH_REGISTERS[0].id,
                  type: 'IN',
                  amount: paid,
                  description: `Pago membresía #${newMemId} - ${client.full_name}`,
                  created_at: new Date().toISOString()
                });
                mockData.MOCK_CASH_REGISTERS[0].total_sales += paid;
              }
              mockData.MOCK_DASHBOARD.income_this_month += paid;
            }

            if (balance > 0) {
              mockData.MOCK_AR.push({
                id: mockData.MOCK_AR.length + 1,
                client_id: client.id,
                original_amount: total,
                balance_due: balance,
                due_date: new Date(Date.now() + 15 * 86400000).toISOString(),
                status: 'PENDING',
                is_active: true,
                created_at: new Date().toISOString(),
                description: `Saldo Membresía - ${plan.name}`
              });
              mockData.MOCK_DASHBOARD.total_receivables += balance;
            }

            mockData.MOCK_DASHBOARD.sales_today += 1;
            mockData.MOCK_DASHBOARD.sales_today_amount += total;
            mockData.MOCK_DASHBOARD.recent_activity.unshift({
              id: `mem_${newMemId}`,
              type: 'MEMBERSHIP',
              title: 'Nueva Membresía',
              subtitle: `${client.full_name} adquirió ${plan.name}`,
              amount: total,
              created_at: new Date().toISOString()
            });

            const newMem = {
              id: newMemId,
              client_id: client.id,
              membership_plan_id: plan.id,
              price: total,
              start_date: body.start_date || new Date().toISOString(),
              end_date: new Date(Date.now() + plan.duration_days * 86400000).toISOString(),
              status: 'ACTIVE',
              trainer_name: body.trainer_name || 'Coach',
              is_active: true,
              total_paid: paid,
              pending_balance: balance,
              payments: newPayment ? [newPayment] : [],
              client: client,
              membership_plan: plan,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            };

            mockData.MOCK_MEMBERSHIPS.push(newMem);

            return {
              data: newMem,
              status: 201,
              statusText: 'Created',
              headers: {},
              config,
              request: {}
            };
          }

          // Simulate success for sales/credits/invoices/cash/clients/products UI interactions
          if (
            reqUrl.includes('/sales') ||
            reqUrl.includes('/sale-details') ||
            reqUrl.includes('/invoices') ||
            reqUrl.includes('/payments') ||
            reqUrl.includes('/accounts-receivable') ||
            reqUrl.includes('/cash-registers') ||
            reqUrl.includes('/cash-movements') ||
            reqUrl.includes('/clients') ||
            reqUrl.includes('/products') ||
            reqUrl.includes('/categories')
          ) {
            const mockInvoice = {
              id: mockData.MOCK_INVOICES.length + 1,
              code: `INV-${Math.floor(1000 + Math.random() * 9000)}`,
              type: 'SALE',
              subtotal: 153000,
              discount: 0,
              total: 153000,
              status: 'GENERATED',
              created_at: new Date().toISOString(),
              client_id: 1,
            };
            if (reqUrl.includes('/invoices')) {
              mockData.MOCK_INVOICES.push(mockInvoice);
            }
            return {
              data: reqUrl.includes('/invoices') ? mockInvoice : { detail: 'Operación simulada con éxito en Demo.', ...mockInvoice, id: 999 },
              status: 200,
              statusText: 'OK',
              headers: {},
              config,
              request: {},
            };
          }

          return Promise.reject({
            response: {
              status: 403,
              data: {
                detail:
                  'Esta función está deshabilitada en el modo Demo. Los cambios no se guardarán.',
              },
            },
          });
        }

        // GET REQUESTS: return mock data
        let data: any = null;

        if (reqUrl.includes('/users/me')) {
          data = mockData.MOCK_USER;
        } else if (reqUrl.includes('/gyms/my-gym')) {
          data = mockData.MOCK_GYM;
        } else if (reqUrl.includes('/dashboard')) {
          data = mockData.MOCK_DASHBOARD;
        } else if (reqUrl.includes('/clients/') && reqUrl.includes('/360')) {
          const clientId = parseInt(reqUrl.split('/')[2]);
          const client =
            mockData.MOCK_CLIENTS.find((c) => c.id === clientId) ||
            mockData.MOCK_CLIENTS[0];
          data = {
            client,
            current_membership: mockData.MOCK_MEMBERSHIPS.find(
              (m) => m.client_id === client?.id
            ),
            financial: {
              last_payment_date: new Date().toISOString(),
              last_payment_amount: 80000,
              total_paid: 200000,
              pending_balance: 0,
              overdue_balance: 0,
              active_credits_count: 0,
              last_purchase_date: new Date().toISOString(),
            },
          };
        } else if (reqUrl.match(/\/clients\/\d+$/)) {
          const clientId = parseInt(reqUrl.split('/').pop() || '1');
          data = mockData.MOCK_CLIENTS.find((c) => c.id === clientId) || mockData.MOCK_CLIENTS[0];
        } else if (reqUrl.includes('/clients')) {
          data = {
            items: mockData.MOCK_CLIENTS,
            total: mockData.MOCK_CLIENTS.length,
            page: 1,
            page_size: 20,
            total_pages: 1,
          };
        } else if (reqUrl.includes('/membership-plans') || reqUrl.includes('/memberships/plans')) {
          data = {
            items: mockData.MOCK_MEMBERSHIP_PLANS,
            total: mockData.MOCK_MEMBERSHIP_PLANS.length,
            page: 1,
            page_size: 20,
            total_pages: 1,
          };
        } else if (reqUrl.includes('/memberships')) {
          data = {
            items: mockData.MOCK_MEMBERSHIPS,
            total: mockData.MOCK_MEMBERSHIPS.length,
            page: 1,
            page_size: 20,
            total_pages: 1,
          };
        } else if (reqUrl.includes('/categories')) {
          data = mockData.MOCK_CATEGORIES;
        } else if (reqUrl.includes('/products')) {
          data = {
            items: mockData.MOCK_PRODUCTS,
            total: mockData.MOCK_PRODUCTS.length,
            page: 1,
            page_size: 20,
            total_pages: 1,
          };
        } else if (
          reqUrl.includes('/accounts-receivable/') &&
          reqUrl.includes('/payments')
        ) {
          const arId = parseInt(reqUrl.split('/')[2]);
          data = mockData.MOCK_PAYMENTS.filter((p) => p.id === arId);
        } else if (
          reqUrl.includes('/accounts-receivable/') &&
          !reqUrl.includes('?')
        ) {
          data = mockData.MOCK_AR[0];
        } else if (reqUrl.includes('/accounts-receivable')) {
          data = {
            items: mockData.MOCK_AR,
            total: mockData.MOCK_AR.length,
            page: 1,
            page_size: 20,
            total_pages: 1,
          };
        } else if (reqUrl.includes('/invoices')) {
          data = {
            items: mockData.MOCK_INVOICES,
            total: mockData.MOCK_INVOICES.length,
            page: 1,
            page_size: 20,
            total_pages: 1,
          };
        } else if (reqUrl.includes('/cash-registers/current')) {
          data = mockData.MOCK_CASH_REGISTERS[0];
        } else if (
          reqUrl.includes('/cash-registers/') &&
          reqUrl.includes('/movements')
        ) {
          data = mockData.MOCK_CASH_MOVEMENTS;
        } else if (reqUrl.includes('/cash-registers')) {
          data = {
            items: mockData.MOCK_CASH_REGISTERS,
            total: mockData.MOCK_CASH_REGISTERS.length,
            page: 1,
            page_size: 20,
            total_pages: 1,
          };
        } else if (reqUrl.includes('/reports/')) {
          data = {
            labels: ['Ene', 'Feb', 'Mar'],
            datasets: [{ label: 'Ventas', data: [1000, 2000, 3000] }],
          };
        } else if (reqUrl.includes('/audit')) {
          data = {
            items: mockData.MOCK_AUDIT,
            total: mockData.MOCK_AUDIT.length,
            page: 1,
            page_size: 20,
            total_pages: 1,
          };
        } else if (reqUrl.includes('/users')) {
          data = {
            items: mockData.MOCK_USERS,
            total: mockData.MOCK_USERS.length,
            page: 1,
            page_size: 20,
            total_pages: 1,
          };
        } else if (reqUrl.includes('/subscription/me')) {
          data = mockData.MOCK_SUBSCRIPTION;
        } else if (reqUrl.includes('/subscription/history')) {
          data = [];
        } else if (reqUrl.includes('/subscription/plans')) {
          data = mockData.MOCK_SAAS_PLANS;
        } else {
          data = {};
        }

        return {
          data,
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
          request: {},
        };
      } catch (err) {
        console.error('Error in mock adapter:', err);
        throw err;
      }
    };

    return config;
  });
}

/**
 * Activate demo mode. Called by DemoLayout on mount.
 */
export function activateDemoMode() {
  localStorage.setItem('demo_mode', 'true');
}

/**
 * Deactivate demo mode. Called by DemoLayout on unmount.
 * Ensures that no demo state leaks into real auth flows.
 */
export function deactivateDemoMode() {
  localStorage.removeItem('demo_mode');
}
