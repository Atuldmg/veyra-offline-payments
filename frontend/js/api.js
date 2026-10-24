/**
 * VEYRA — API Client Service
 * Encapsulates network communication with PHP API Gateway
 */

const VeyraAPI = {
  csrfToken: null,

  async getCsrf() {
    try {
      const res = await fetch(`${VEYRA_CONFIG.getApiBase()}${VEYRA_CONFIG.endpoints.csrf}`);
      if (res.ok) {
        const data = await res.json();
        this.csrfToken = data.token;
      }
    } catch (e) {
      console.warn('Unable to prefetch CSRF token:', e.message);
    }
  },

  async request(endpoint, options = {}) {
    const url = `${VEYRA_CONFIG.getApiBase()}${endpoint}`;
    const defaultHeaders = {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    };

    if (this.csrfToken && (options.method === 'POST' || options.method === 'PUT')) {
      defaultHeaders['X-CSRF-Token'] = this.csrfToken;
    }

    const config = {
      ...options,
      headers: {
        ...defaultHeaders,
        ...(options.headers || {})
      }
    };

    try {
      const response = await fetch(url, config);
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || data.message || `HTTP Error ${response.status}: ${response.statusText}`);
      }

      return data;
    } catch (err) {
      console.error(`API Error on [${options.method || 'GET'} ${endpoint}]:`, err);
      throw err;
    }
  },

  // Service endpoints
  getHealth() {
    return this.request(VEYRA_CONFIG.endpoints.health);
  },

  getAccounts() {
    return this.request(VEYRA_CONFIG.endpoints.accounts);
  },

  getTransactions() {
    return this.request(VEYRA_CONFIG.endpoints.transactions);
  },

  createTransaction(payload) {
    return this.request(VEYRA_CONFIG.endpoints.transactions, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  getQueue() {
    return this.request(VEYRA_CONFIG.endpoints.queue);
  },

  getMeshState() {
    return this.request(VEYRA_CONFIG.endpoints.mesh);
  },

  gossipMesh() {
    return this.request(VEYRA_CONFIG.endpoints.mesh, {
      method: 'POST',
      body: JSON.stringify({ action: 'gossip' })
    });
  },

  resetMesh() {
    return this.request(VEYRA_CONFIG.endpoints.mesh, {
      method: 'POST',
      body: JSON.stringify({ action: 'reset' })
    });
  },

  synchronizeBridge() {
    return this.request(VEYRA_CONFIG.endpoints.synchronize, {
      method: 'POST'
    });
  },

  getSystemInfo() {
    return this.request(VEYRA_CONFIG.endpoints.system);
  }
};
