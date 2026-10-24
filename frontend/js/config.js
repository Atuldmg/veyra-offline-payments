/**
 * VEYRA — Frontend Runtime Configuration
 * Brand: VEYRA (Secure Transactions. Resilient Networks.)
 */

const VEYRA_CONFIG = {
  // Configurable base URL; defaults to local PHP API Gateway
  getApiBase: function () {
    return localStorage.getItem('veyra_api_base') || 'http://127.0.0.1:8000';
  },

  setApiBase: function (url) {
    if (!url) return;
    const cleanUrl = url.replace(/\/+$/, '');
    localStorage.setItem('veyra_api_base', cleanUrl);
  },

  endpoints: {
    health: '/api/health.php',
    accounts: '/api/accounts.php',
    transactions: '/api/transactions.php',
    queue: '/api/queue.php',
    mesh: '/api/mesh.php',
    synchronize: '/api/synchronize.php',
    system: '/api/system.php',
    csrf: '/api/csrf.php'
  },

  // Polling interval in milliseconds for dashboard telemetry
  pollInterval: 8000
};
