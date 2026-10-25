

const VeyraAPI = {
  
  baseUrl: '',

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const defaultHeaders = {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    };

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
        throw new Error(data.error || data.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      return data;
    } catch (err) {
      console.error(`API Error on [${options.method || 'GET'} ${endpoint}]:`, err);
      throw err;
    }
  },

  getHealth() {
    return this.request('/api/health.php');
  },

  getAccounts() {
    return this.request('/api/accounts.php');
  },

  getTransactions(limit = 20) {
    return this.request(`/api/transactions.php?limit=${limit}`);
  },

  createTransaction(payload) {
    return this.request('/api/transactions.php', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  getQueue() {
    return this.request('/api/queue.php');
  },

  getMeshState() {
    return this.request('/api/mesh.php');
  },

  runGossip() {
    return this.request('/api/mesh.php', {
      method: 'POST',
      body: JSON.stringify({ action: 'gossip' })
    });
  },

  resetMesh() {
    return this.request('/api/mesh.php', {
      method: 'POST',
      body: JSON.stringify({ action: 'reset' })
    });
  },

  synchronizeBridges() {
    return this.request('/api/synchronize.php', {
      method: 'POST'
    });
  },

  getSystemInfo() {
    return this.request('/api/system.php');
  }
};
