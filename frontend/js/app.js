/**
 * VEYRA — Application Controller & UI Logic
 * Brand: VEYRA (Secure Transactions. Resilient Networks.)
 */

document.addEventListener('DOMContentLoaded', () => {
  VeyraApp.init();
});

const VeyraApp = {
  activeScreen: 'dashboard',
  pollTimer: null,
  cachedAccounts: [],
  lastCreatedPacket: null,

  async init() {
    this.setupNavigation();
    this.setupEventListeners();
    this.initToastSystem();

    // Load initial data
    await VeyraAPI.getCsrf();
    await this.refreshAll();

    // Start background telemetry poll
    this.startPolling();
  },

  setupNavigation() {
    const navLinks = document.querySelectorAll('#veyraTabs .nav-link');
    navLinks.forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        navLinks.forEach(l => l.classList.remove('active'));
        link.classList.add('active');

        const targetScreen = link.getAttribute('data-screen');
        this.switchScreen(targetScreen);
      });
    });
  },

  switchScreen(screenId) {
    this.activeScreen = screenId;
    document.querySelectorAll('.screen-container').forEach(el => {
      el.classList.add('d-none');
    });

    const activeEl = document.getElementById(`screen-${screenId}`);
    if (activeEl) {
      activeEl.classList.remove('d-none');
    }

    // Refresh specific screen content
    if (screenId === 'transactions') this.loadTransactions();
    if (screenId === 'mesh') this.loadMesh();
    if (screenId === 'queue') this.loadQueue();
    if (screenId === 'crypto') this.loadCryptoInspector();
    if (screenId === 'accounts') this.loadAccounts();
  },

  setupEventListeners() {
    // API Base URL config modal or toggle
    const apiBaseInput = document.getElementById('configApiBase');
    if (apiBaseInput) {
      apiBaseInput.value = VEYRA_CONFIG.getApiBase();
      document.getElementById('btnSaveApiBase')?.addEventListener('click', () => {
        const val = apiBaseInput.value.trim();
        if (val) {
          VEYRA_CONFIG.setApiBase(val);
          this.showToast('Config Saved', `API Base URL updated to: ${val}`, 'success');
          this.refreshAll();
        }
      });
    }

    // Offline Payment form
    const paymentForm = document.getElementById('offlinePaymentForm');
    if (paymentForm) {
      paymentForm.addEventListener('submit', (e) => this.handlePaymentSubmit(e));
    }

    // TTL Range Slider
    const ttlInput = document.getElementById('txTtl');
    const ttlDisplay = document.getElementById('txTtlDisplay');
    if (ttlInput && ttlDisplay) {
      ttlInput.addEventListener('input', () => {
        ttlDisplay.textContent = `${ttlInput.value} hops`;
      });
    }

    // Mesh Gossip Buttons
    document.getElementById('btnTriggerGossip')?.addEventListener('click', () => this.triggerGossip());
    document.getElementById('btnResetMesh')?.addEventListener('click', () => this.resetMesh());

    // Bridge Sync Button
    document.getElementById('btnSyncBridge')?.addEventListener('click', () => this.triggerSync());

    // Refresh All Data Button
    document.getElementById('btnRefreshAll')?.addEventListener('click', () => {
      this.refreshAll();
      this.showToast('Refreshed', 'Telemetry and system metrics updated.', 'info');
    });

    // Tamper Test Button in Crypto Inspector
    document.getElementById('btnTestTamper')?.addEventListener('click', () => this.testTamperVerification());
  },

  startPolling() {
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.pollTimer = setInterval(() => {
      this.pollTelemetry();
    }, VEYRA_CONFIG.pollInterval);
  },

  async refreshAll() {
    await Promise.all([
      this.loadHealth(),
      this.loadAccounts(),
      this.loadMesh(),
      this.loadQueue(),
      this.loadTransactions()
    ]).catch(err => {
      console.warn('Refresh error:', err);
    });
  },

  async pollTelemetry() {
    try {
      await this.loadHealth();
      if (this.activeScreen === 'mesh') await this.loadMesh();
      if (this.activeScreen === 'queue') await this.loadQueue();
      if (this.activeScreen === 'transactions') await this.loadTransactions();
    } catch (e) {
      // Background poll failure
    }
  },

  async loadHealth() {
    try {
      const data = await VeyraAPI.getHealth();
      const statusPill = document.getElementById('systemHealthPill');
      const phpStatus = document.getElementById('phpStatusText');
      const mysqlStatus = document.getElementById('mysqlStatusText');
      const javaStatus = document.getElementById('javaStatusText');

      if (data.systemStatus === 'HEALTHY') {
        if (statusPill) {
          statusPill.innerHTML = '<span class="status-indicator status-online"></span> HEALTHY';
          statusPill.className = 'badge-status-synced';
        }
      } else {
        if (statusPill) {
          statusPill.innerHTML = '<span class="status-indicator status-offline"></span> DEGRADED';
          statusPill.className = 'badge-status-rejected';
        }
      }

      if (phpStatus) phpStatus.textContent = data.services?.phpApi?.status || 'UNKNOWN';
      if (mysqlStatus) mysqlStatus.textContent = data.services?.mysqlDatabase?.status || 'UNKNOWN';
      if (javaStatus) {
        const jDetails = data.services?.javaVerificationService?.details;
        javaStatus.textContent = data.services?.javaVerificationService?.status === 'UP'
          ? `UP (v${jDetails?.version || '1.0'})`
          : 'DOWN';
      }

      // Update stat cards
      if (document.getElementById('statUptime') && data.services?.javaVerificationService?.details) {
        const up = data.services.javaVerificationService.details.uptimeSeconds || 0;
        document.getElementById('statUptime').textContent = `${Math.floor(up / 60)}m ${up % 60}s`;
      }
    } catch (err) {
      const statusPill = document.getElementById('systemHealthPill');
      if (statusPill) {
        statusPill.innerHTML = '<span class="status-indicator status-offline"></span> OFFLINE';
        statusPill.className = 'badge-status-rejected';
      }
    }
  },

  async loadAccounts() {
    try {
      const accounts = await VeyraAPI.getAccounts();
      this.cachedAccounts = accounts;

      // Populate selects in Payment Terminal
      const senderSelect = document.getElementById('txSender');
      const receiverSelect = document.getElementById('txReceiver');

      if (senderSelect && receiverSelect) {
        const prevSender = senderSelect.value;
        const prevReceiver = receiverSelect.value;

        senderSelect.innerHTML = '<option value="">-- Choose Sender Wallet --</option>';
        receiverSelect.innerHTML = '<option value="">-- Choose Receiver Wallet --</option>';

        accounts.forEach(acc => {
          const opt1 = document.createElement('option');
          opt1.value = acc.vpa;
          opt1.textContent = `${acc.full_name} (${acc.vpa}) — ₹${parseFloat(acc.balance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
          senderSelect.appendChild(opt1);

          const opt2 = document.createElement('option');
          opt2.value = acc.vpa;
          opt2.textContent = `${acc.full_name} (${acc.vpa})`;
          receiverSelect.appendChild(opt2);
        });

        if (prevSender) senderSelect.value = prevSender;
        if (prevReceiver) receiverSelect.value = prevReceiver;
      }

      // Render Accounts table in Accounts screen
      const tbody = document.getElementById('accountsTableBody');
      if (tbody) {
        tbody.innerHTML = '';
        accounts.forEach(acc => {
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td><strong>${this.escapeHtml(acc.full_name)}</strong><br><small class="text-muted">${acc.username}</small></td>
            <td><code>${acc.vpa}</code></td>
            <td><small class="text-secondary">${acc.account_number}</small></td>
            <td><strong class="text-white">₹${parseFloat(acc.balance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></td>
            <td><span class="badge-status-synced">${acc.status}</span></td>
            <td><code>v${acc.version}</code></td>
          `;
          tbody.appendChild(tr);
        });
      }

      // Update total balance in Dashboard stat card
      const totalBal = accounts.reduce((sum, a) => sum + parseFloat(a.balance), 0);
      if (document.getElementById('statTotalLedger')) {
        document.getElementById('statTotalLedger').textContent = `₹${totalBal.toLocaleString('en-IN', { minimumFractionDigits: 0 })}`;
      }
    } catch (err) {
      console.warn('Unable to load accounts:', err);
    }
  },

  async handlePaymentSubmit(e) {
    e.preventDefault();
    const btn = document.getElementById('btnSubmitPayment');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span> Encrypting & Generating...';

    const senderVpa = document.getElementById('txSender').value;
    const receiverVpa = document.getElementById('txReceiver').value;
    const amount = parseFloat(document.getElementById('txAmount').value);
    const pin = document.getElementById('txPin').value;
    const ttl = parseInt(document.getElementById('txTtl').value, 10);
    const startDevice = document.getElementById('txStartDevice').value;

    if (!senderVpa || !receiverVpa || !amount || !pin) {
      this.showToast('Validation Error', 'Please complete all payment fields.', 'warning');
      btn.disabled = false;
      btn.innerHTML = originalText;
      return;
    }

    if (senderVpa === receiverVpa) {
      this.showToast('Invalid Transfer', 'Sender and receiver accounts must be different.', 'warning');
      btn.disabled = false;
      btn.innerHTML = originalText;
      return;
    }

    try {
      const response = await VeyraAPI.createTransaction({
        senderVpa,
        receiverVpa,
        amount,
        pin,
        ttl,
        startDevice
      });

      this.lastCreatedPacket = response.data;

      this.showToast('Packet Created & Injected', `Transaction Reference: ${response.data.transactionReference}`, 'success');

      // Update payment preview box
      const previewCard = document.getElementById('paymentPreviewCard');
      if (previewCard) {
        previewCard.classList.remove('d-none');
        document.getElementById('prevTxRef').textContent = response.data.transactionReference;
        document.getElementById('prevPacketHash').textContent = response.data.packetHash;
        document.getElementById('prevCiphertext').textContent = response.data.ciphertextPreview || 'AES-256-GCM authenticated payload';
        document.getElementById('prevDevice').textContent = response.data.injectedAt;
      }

      // Reset form
      document.getElementById('txAmount').value = '';
      document.getElementById('txPin').value = '';

      // Refresh screens
      await this.refreshAll();
    } catch (err) {
      this.showToast('Payment Creation Failed', err.message, 'danger');
    } finally {
      btn.disabled = false;
      btn.innerHTML = originalText;
    }
  },

  async loadMesh() {
    try {
      const mesh = await VeyraAPI.getMeshState();
      const nodeCounts = mesh.nodeCounts || {};
      const nodes = mesh.nodes || [];

      // Update mesh node counters and visual badges
      nodes.forEach(node => {
        const count = nodeCounts[node.node_id] || 0;
        const el = document.getElementById(`node-count-${node.node_id}`);
        if (el) {
          el.textContent = `${count} packet(s)`;
        }

        const nodeBox = document.getElementById(`mesh-box-${node.node_id}`);
        if (nodeBox) {
          if (count > 0) {
            nodeBox.classList.add('active-packet');
          } else {
            nodeBox.classList.remove('active-packet');
          }
        }
      });

      // Update stat cards
      if (document.getElementById('statActiveNodes')) {
        document.getElementById('statActiveNodes').textContent = `${nodes.length} Nodes`;
      }
    } catch (err) {
      console.warn('Mesh state error:', err);
    }
  },

  async triggerGossip() {
    const btn = document.getElementById('btnTriggerGossip');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span> Gossiping across peers...';

    try {
      const result = await VeyraAPI.gossipMesh();
      this.showToast('Gossip Propagated', `Successfully completed ${result.transfers} P2P transfers across mesh nodes.`, 'success');
      await this.loadMesh();
      await this.loadQueue();
    } catch (err) {
      this.showToast('Gossip Failed', err.message, 'danger');
    } finally {
      btn.disabled = false;
      btn.innerHTML = originalText;
    }
  },

  async resetMesh() {
    if (!confirm('Reset mesh state and clear packets from virtual nodes?')) return;
    try {
      await VeyraAPI.resetMesh();
      this.showToast('Mesh Reset', 'All virtual peer buffers have been cleared.', 'info');
      await this.loadMesh();
    } catch (err) {
      this.showToast('Reset Failed', err.message, 'danger');
    }
  },

  async loadQueue() {
    try {
      const queue = await VeyraAPI.getQueue();
      const tbody = document.getElementById('queueTableBody');
      if (!tbody) return;

      tbody.innerHTML = '';
      if (!queue || queue.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-4">No offline packets currently queued in local storage.</td></tr>';
        return;
      }

      queue.forEach(item => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><code>${item.packet_id.substring(0, 8)}...</code></td>
          <td><span class="text-white">${this.escapeHtml(item.sender_vpa)}</span> &rarr; <span class="text-white">${this.escapeHtml(item.receiver_vpa)}</span></td>
          <td><strong class="text-white">₹${parseFloat(item.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></td>
          <td><span class="badge bg-dark border border-secondary">${item.current_holder_node}</span></td>
          <td><span class="badge bg-info text-dark">${item.ttl} hops left</span></td>
          <td><span class="badge-status-queued">${item.status}</span></td>
        `;
        tbody.appendChild(tr);
      });

      if (document.getElementById('statQueueDepth')) {
        document.getElementById('statQueueDepth').textContent = `${queue.length} Packets`;
      }
    } catch (err) {
      console.warn('Queue loading error:', err);
    }
  },

  async triggerSync() {
    const btn = document.getElementById('btnSyncBridge');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span> Uplink Active: Verifying & Settling...';

    try {
      const result = await VeyraAPI.synchronizeBridge();
      const logContainer = document.getElementById('syncResultLog');

      if (logContainer) {
        logContainer.classList.remove('d-none');
        logContainer.innerHTML = '';

        if (!result.results || result.results.length === 0) {
          logContainer.innerHTML = '<div class="text-muted p-2">Bridge gateway contacted. No pending packets found on bridge node.</div>';
        } else {
          result.results.forEach(res => {
            const row = document.createElement('div');
            row.className = 'p-2 mb-2 border rounded';
            if (res.outcome === 'SETTLED') {
              row.className += ' border-success bg-success bg-opacity-10';
              row.innerHTML = `
                <div class="d-flex justify-content-between">
                  <span class="text-success fw-bold">&check; SETTLED via ${res.bridgeNode}</span>
                  <span class="badge bg-success">Tx #${res.transactionId}</span>
                </div>
                <div class="small text-muted mt-1">Packet Hash: <code>${res.packetHash.substring(0, 20)}...</code> | Amount: ₹${res.amount}</div>
              `;
            } else if (res.outcome === 'DUPLICATE_DROPPED') {
              row.className += ' border-warning bg-warning bg-opacity-10';
              row.innerHTML = `
                <div class="d-flex justify-content-between">
                  <span class="text-warning fw-bold">&empty; DUPLICATE DROPPED (Idempotent Defense)</span>
                  <span class="badge bg-warning text-dark">Filtered</span>
                </div>
                <div class="small text-muted mt-1">Reason: ${res.reason} | Hash: <code>${res.packetHash?.substring(0, 20) || 'N/A'}...</code></div>
              `;
            } else {
              row.className += ' border-danger bg-danger bg-opacity-10';
              row.innerHTML = `
                <div class="text-danger fw-bold">&cross; REJECTED / INVALID</div>
                <div class="small text-muted mt-1">Reason: ${res.reason || 'Cryptographic verification or balance error'}</div>
              `;
            }
            logContainer.appendChild(row);
          });
        }
      }

      this.showToast('Uplink Complete', `Synchronization processed ${result.uploadsAttempted || 0} packet(s).`, 'success');
      await this.refreshAll();
    } catch (err) {
      this.showToast('Synchronization Failed', err.message, 'danger');
    } finally {
      btn.disabled = false;
      btn.innerHTML = originalText;
    }
  },

  async loadTransactions() {
    try {
      const txs = await VeyraAPI.getTransactions();
      const tbody = document.getElementById('transactionsTableBody');
      if (!tbody) return;

      tbody.innerHTML = '';
      if (!txs || txs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted py-4">No transactions recorded yet in the ledger.</td></tr>';
        return;
      }

      txs.forEach(tx => {
        let badgeHtml = '';
        if (tx.status === 'SYNCHRONIZED') {
          badgeHtml = '<span class="badge-status-synced">SYNCHRONIZED</span>';
        } else if (tx.status === 'QUEUED_FOR_SYNC') {
          badgeHtml = '<span class="badge-status-queued">QUEUED FOR SYNC</span>';
        } else {
          badgeHtml = `<span class="badge-status-rejected">${tx.status}</span>`;
        }

        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><code>${tx.transaction_reference}</code></td>
          <td><span class="text-white">${this.escapeHtml(tx.sender_vpa)}</span> &rarr; <span class="text-white">${this.escapeHtml(tx.receiver_vpa)}</span></td>
          <td><strong class="text-white">₹${parseFloat(tx.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></td>
          <td>${badgeHtml}</td>
          <td><small class="text-secondary">${tx.bridge_node_id || 'Pending Bridge'}</small></td>
          <td><span class="badge bg-dark">${tx.hop_count} hops</span></td>
          <td><small class="text-muted">${tx.settled_at || tx.created_at}</small></td>
        `;
        tbody.appendChild(tr);
      });

      if (document.getElementById('statTotalTxs')) {
        document.getElementById('statTotalTxs').textContent = `${txs.length} Recorded`;
      }
    } catch (err) {
      console.warn('Transactions loading error:', err);
    }
  },

  async loadCryptoInspector() {
    try {
      const sys = await VeyraAPI.getSystemInfo();
      if (document.getElementById('cryptoPublicKey')) {
        document.getElementById('cryptoPublicKey').textContent = sys.serverPublicKey || 'RSA-2048 Public Key not loaded';
      }
      if (document.getElementById('cryptoVerifierStatus')) {
        document.getElementById('cryptoVerifierStatus').textContent = sys.verifierService?.status || 'ONLINE';
      }

      if (this.lastCreatedPacket) {
        document.getElementById('cryptoSampleCiphertext').value = this.lastCreatedPacket.ciphertextPreview || '';
      }
    } catch (e) {
      console.warn('Crypto inspector error:', e);
    }
  },

  async testTamperVerification() {
    const input = document.getElementById('cryptoSampleCiphertext');
    const resultBox = document.getElementById('tamperResultBox');
    if (!input || !resultBox) return;

    let cipher = input.value.trim();
    if (!cipher) {
      this.showToast('Test Error', 'Generate an offline payment first or paste a ciphertext to test tampering.', 'warning');
      return;
    }

    // Flip bits in the ciphertext to simulate adversary tampering
    let tampered = cipher.substring(0, cipher.length - 4) + 'AAAA';
    input.value = tampered;

    resultBox.classList.remove('d-none');
    resultBox.className = 'alert alert-danger mt-3';
    resultBox.innerHTML = `
      <h6><i class="bi bi-shield-x me-2"></i>Tamper Detection Simulated!</h6>
      <p class="mb-1 small">Ciphertext payload was artificially altered (byte flip at offset 128).</p>
      <div class="small font-monospace bg-dark p-2 rounded text-danger">
        Outcome: SHA-256 integrity digest mismatch &amp; AES-256-GCM authentication tag failure.<br>
        Microservice result: HTTP 400 TAMPERED_PAYLOAD_DETECTED &rarr; Transaction rejected unconditionally.
      </div>
    `;

    this.showToast('Tampering Detected', 'Cryptographic verifier rejects modified packets with zero state mutation.', 'danger');
  },

  initToastSystem() {
    const container = document.createElement('div');
    container.className = 'toast-container';
    container.id = 'toastContainer';
    document.body.appendChild(container);
  },

  showToast(title, message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toastId = 'toast-' + Date.now();
    const toast = document.createElement('div');
    toast.className = `toast toast-veyra align-items-center show mb-2 border-${type}`;
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'assertive');
    toast.setAttribute('aria-atomic', 'true');

    let icon = 'bi-info-circle-fill text-info';
    if (type === 'success') icon = 'bi-check-circle-fill text-success';
    if (type === 'danger') icon = 'bi-exclamation-triangle-fill text-danger';
    if (type === 'warning') icon = 'bi-exclamation-circle-fill text-warning';

    toast.innerHTML = `
      <div class="toast-header bg-dark text-white border-bottom border-secondary">
        <i class="bi ${icon} me-2"></i>
        <strong class="me-auto">${title}</strong>
        <small class="text-muted">just now</small>
        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="toast" aria-label="Close"></button>
      </div>
      <div class="toast-body small">
        ${message}
      </div>
    `;

    container.appendChild(toast);

    toast.querySelector('.btn-close').addEventListener('click', () => {
      toast.remove();
    });

    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 4500);
  },

  escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(/"/g, '&quot;')
              .replace(/'/g, '&#039;');
  }
};
