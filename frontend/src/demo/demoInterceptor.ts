import { api } from '../services/api';
import * as mockData from './mockData';

// We simulate network delay to make the demo feel real
const delay = (ms = 400) => new Promise(resolve => setTimeout(resolve, ms));

// ─── AUTH ROUTES THAT MUST ALWAYS REACH THE REAL BACKEND ─────────────────────
// Even if demo_mode is active in localStorage, these routes bypass the mock.
// This ensures /login, /register, /forgot-password, etc. always work correctly.
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

    // ── CRITICAL: Auth routes always bypass demo mode ─────────────────────────
    if (isAuthRoute(url)) {
      return config;
    }

    // ── Only intercept when explicitly in demo mode ───────────────────────────
    if (localStorage.getItem('demo_mode') !== 'true') {
      return config;
    }

    // Intercept and return mock data directly using config.adapter
    config.adapter = async (config) => {
      await delay();

      const method = config.method?.toUpperCase();
      const reqUrl = config.url || '';

      // ── MUTATIONS: block most, simulate a few for UI realism ─────────────────
      if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method!)) {
        // Simulate success for sales/credits/cash UI interactions
        if (
          reqUrl.includes('/sales') ||
          reqUrl.includes('/accounts-receivable') ||
          reqUrl.includes('/cash-registers')
        ) {
          return {
            data: { detail: 'Operación simulada con éxito en Demo.', id: 999 },
            status: 200,
            statusText: 'OK',
            headers: {},
            config,
            request: {},
          };
        }

        // All other mutations are blocked in demo
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

      // ── GET REQUESTS: return mock data ────────────────────────────────────────
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
      } else if (reqUrl.includes('/clients/') && !reqUrl.includes('?')) {
        data = mockData.MOCK_CLIENTS[0];
      } else if (reqUrl.includes('/clients')) {
        data = {
          items: mockData.MOCK_CLIENTS,
          total: mockData.MOCK_CLIENTS.length,
          page: 1,
          page_size: 20,
          total_pages: 1,
        };
      } else if (reqUrl.includes('/memberships/plans')) {
        data = mockData.MOCK_MEMBERSHIP_PLANS;
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
