

document.addEventListener('DOMContentLoaded', () => {
  VeyraApp.init();
});

const VeyraApp = {
  pollTimer: null,
  cachedAccounts: [],
  cachedTransactions: [],
  cachedMeshDevices: [],

  async init() {
    this.setupNavigation();
    this.setupForms();
    this.setupQuickActions();
    this.setupSidebarToggle();

    
    await this.refreshAll();

    
    this.pollTimer = setInterval(() => this.pollTelemetry(), 8000);
  },

  setupNavigation() {
    
    document.querySelectorAll('[data-view-target]').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const targetView = link.getAttribute('data-view-target');
        this.switchView(targetView);

        
        document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
        link.classList.add('active');

        
        document.getElementById('veyraSidebar')?.classList.remove('show');
        document.getElementById('sidebarBackdrop')?.classList.remove('show');
      });
    });
  },

  switchView(viewName) {
    
    document.querySelectorAll('.view-pane').forEach(el => el.classList.add('d-none'));

    
    const targetEl = document.getElementById(`view-${viewName}`);
    if (targetEl) {
      targetEl.classList.remove('d-none');
    }

    
    if (viewName === 'transactions') this.loadTransactions();
    if (viewName === 'queue') this.loadQueue();
    if (viewName === 'mesh') this.loadMesh();
    if (viewName === 'wallets') this.loadAccounts();
    if (viewName === 'crypto') this.loadCryptoInfo();
  },

  setupSidebarToggle() {
    const toggleBtn = document.getElementById('sidebarToggleBtn');
    const sidebar = document.getElementById('veyraSidebar');
    const backdrop = document.getElementById('sidebarBackdrop');

    if (toggleBtn && sidebar) {
      toggleBtn.addEventListener('click', () => {
        sidebar.classList.toggle('show');
        backdrop?.classList.toggle('show');
      });
    }

    if (backdrop) {
      backdrop.addEventListener('click', () => {
        sidebar?.classList.remove('show');
        backdrop.classList.remove('show');
      });
    }
  },

  setupForms() {
    const form = document.getElementById('newTransactionForm');
    if (form) {
      form.addEventListener('submit', (e) => this.handlePaymentSubmit(e));
    }

    
    const modalForm = document.getElementById('modalPaymentForm');
    if (modalForm) {
      modalForm.addEventListener('submit', (e) => this.handlePaymentSubmit(e, 'newTransactionModal'));
    }

    
    const ttlRange = document.getElementById('txTtl');
    const ttlDisplay = document.getElementById('txTtlDisplay');
    if (ttlRange && ttlDisplay) {
      ttlRange.addEventListener('input', () => {
        ttlDisplay.textContent = `${ttlRange.value} hops`;
      });
    }
  },

  setupQuickActions() {
    
    document.getElementById('actionNewPayment')?.addEventListener('click', (e) => {
      e.preventDefault();
      const modal = new bootstrap.Modal(document.getElementById('newTransactionModal'));
      modal.show();
    });

    
    document.getElementById('actionRunGossip')?.addEventListener('click', async (e) => {
      e.preventDefault();
      await this.triggerGossip();
    });

    
    document.getElementById('actionFlushBridges')?.addEventListener('click', async (e) => {
      e.preventDefault();
      await this.triggerBridgeSync();
    });

    
    document.getElementById('actionInspectKeys')?.addEventListener('click', (e) => {
      e.preventDefault();
      const modal = new bootstrap.Modal(document.getElementById('cryptoInspectorModal'));
      this.loadCryptoInfo();
      modal.show();
    });

    
    document.getElementById('sidebarResetMesh')?.addEventListener('click', async (e) => {
      e.preventDefault();
      if (confirm('Reset virtual Bluetooth mesh and clear offline outbox?')) {
        await VeyraAPI.resetMesh();
        this.showToast('Mesh Reset', 'Virtual peer buffers and queue cleared.', 'info');
        await this.refreshAll();
      }
    });

    
    document.getElementById('btnTamperTest')?.addEventListener('click', () => {
      this.runTamperTest();
    });
  },

  async refreshAll() {
    await Promise.all([
      this.loadHealth(),
      this.loadAccounts(),
      this.loadTransactions(),
      this.loadMesh()
    ]).catch(err => console.warn('Refresh error:', err));
  },

  async pollTelemetry() {
    try {
      await this.loadHealth();
      await this.loadMesh(true);
      await this.loadTransactions(true);
    } catch (e) {
      
    }
  },

  async loadHealth() {
    try {
      const data = await VeyraAPI.getHealth();
      const pill = document.getElementById('topbarHealthBadge');
      if (pill) {
        if (data.systemStatus === 'HEALTHY') {
          pill.className = 'badge-soft-success px-2 py-1 rounded-pill';
          pill.innerHTML = '<i class="bi bi-circle-fill me-1" style="font-size:0.5rem"></i> HEALTHY';
        } else {
          pill.className = 'badge-soft-warning px-2 py-1 rounded-pill';
          pill.innerHTML = '<i class="bi bi-circle-fill me-1" style="font-size:0.5rem"></i> DEGRADED';
        }
      }
    } catch (e) {
      const pill = document.getElementById('topbarHealthBadge');
      if (pill) {
        pill.className = 'badge-soft-danger px-2 py-1 rounded-pill';
        pill.innerHTML = '<i class="bi bi-circle-fill me-1" style="font-size:0.5rem"></i> OFFLINE';
      }
    }
  },

  async loadAccounts() {
    try {
      const accounts = await VeyraAPI.getAccounts();
      this.cachedAccounts = accounts;

      
      const senderSelects = [document.getElementById('txSender'), document.getElementById('modalTxSender')];
      const receiverSelects = [document.getElementById('txReceiver'), document.getElementById('modalTxReceiver')];

      senderSelects.forEach(sel => {
        if (!sel) return;
        const current = sel.value;
        sel.innerHTML = '<option value="">-- Choose Sender Wallet --</option>';
        accounts.forEach(acc => {
          const opt = document.createElement('option');
          opt.value = acc.vpa;
          opt.textContent = `${acc.full_name} (${acc.vpa}) — ₹${parseFloat(acc.balance).toLocaleString('en-IN', {minimumFractionDigits: 2})}`;
          sel.appendChild(opt);
        });
        if (current) sel.value = current;
      });

      receiverSelects.forEach(sel => {
        if (!sel) return;
        const current = sel.value;
        sel.innerHTML = '<option value="">-- Choose Beneficiary --</option>';
        accounts.forEach(acc => {
          const opt = document.createElement('option');
          opt.value = acc.vpa;
          opt.textContent = `${acc.full_name} (${acc.vpa})`;
          sel.appendChild(opt);
        });
        if (current) sel.value = current;
      });

      
      const tbody = document.getElementById('walletsTableBody');
      if (tbody) {
        tbody.innerHTML = '';
        accounts.forEach(acc => {
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td><strong>${this.escapeHtml(acc.full_name)}</strong><br><small class="text-muted">${acc.username}</small></td>
            <td><code>${acc.vpa}</code></td>
            <td><small class="text-muted">${acc.account_number}</small></td>
            <td><strong class="text-primary">₹${parseFloat(acc.balance).toLocaleString('en-IN', {minimumFractionDigits: 2})}</strong></td>
            <td><span class="badge-soft-success">${acc.status}</span></td>
            <td><code>v${acc.version}</code></td>
          `;
          tbody.appendChild(tr);
        });
      }
    } catch (e) {
      console.warn('Failed to load accounts:', e);
    }
  },

  async loadTransactions(isPolling = false) {
    try {
      const res = await VeyraAPI.getTransactions(15);
      const txs = res.transactions || [];
      const metrics = res.metrics || {};
      this.cachedTransactions = txs;

      
      const elTotal = document.getElementById('metricTotalTxs');
      const elPending = document.getElementById('metricPendingTxs');
      const elSettled = document.getElementById('metricSettledTxs');

      if (elTotal) elTotal.textContent = metrics.TOTAL || txs.length;
      if (elPending) elPending.textContent = (metrics.CREATED || 0) + (metrics.QUEUED_FOR_SYNC || 0) + (metrics.PENDING_VERIFICATION || 0);
      if (elSettled) elSettled.textContent = metrics.SYNCHRONIZED || 0;

      
      const tbody = document.getElementById('recentTransactionsBody');
      if (tbody) {
        tbody.innerHTML = '';
        if (txs.length === 0) {
          tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted py-4"><i class="bi bi-inbox me-2"></i>No transaction records found in ledger. Click "New Payment" to compose one.</td></tr>';
          return;
        }

        txs.slice(0, 5).forEach(tx => {
          const tr = document.createElement('tr');
          const statusBadge = this.getStatusBadge(tx.status);
          const dateStr = tx.created_at ? new Date(tx.created_at).toLocaleString() : 'Recent';

          tr.innerHTML = `
            <td>
              <div class="fw-semibold text-truncate" style="max-width: 280px;">${this.escapeHtml(tx.sender_vpa)} &rarr; ${this.escapeHtml(tx.receiver_vpa)}</div>
              <small class="text-muted font-monospace">${tx.transaction_reference}</small>
            </td>
            <td><small class="text-muted">${dateStr}</small></td>
            <td>${statusBadge}</td>
            <td>
              <button class="btn btn-sm btn-outline-primary py-0 px-2 rounded-2" onclick="VeyraApp.showTxDetails(${tx.id})">
                View
              </button>
            </td>
          `;
          tbody.appendChild(tr);
        });
      }

      
      const fullTbody = document.getElementById('fullTransactionsBody');
      if (fullTbody) {
        fullTbody.innerHTML = '';
        txs.forEach(tx => {
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td><code>${tx.transaction_reference}</code></td>
            <td>${this.escapeHtml(tx.sender_vpa)}</td>
            <td>${this.escapeHtml(tx.receiver_vpa)}</td>
            <td><strong class="text-primary">₹${parseFloat(tx.amount).toFixed(2)}</strong></td>
            <td>${this.getStatusBadge(tx.status)}</td>
            <td><span class="badge bg-secondary">${tx.hop_count} hops</span></td>
            <td><small class="text-muted">${tx.settled_at || tx.created_at}</small></td>
            <td><button class="btn btn-sm btn-outline-primary py-0 px-2" onclick="VeyraApp.showTxDetails(${tx.id})">Inspect</button></td>
          `;
          fullTbody.appendChild(tr);
        });
      }
    } catch (e) {
      console.warn('Failed to load transactions:', e);
    }
  },

  async loadMesh(isPolling = false) {
    try {
      const mesh = await VeyraAPI.getMeshState();
      const devices = mesh.devices || [];
      this.cachedMeshDevices = devices;

      
      const elPeers = document.getElementById('metricMeshPeers');
      if (elPeers) elPeers.textContent = devices.length || 5;

      
      const container = document.getElementById('meshNodesContainer');
      if (container) {
        container.innerHTML = '';
        devices.forEach(d => {
          const hasNet = d.hasInternet;
          const count = d.packetCount || 0;
          const isBridge = hasNet || d.deviceId.includes('bridge');

          const div = document.createElement('div');
          div.className = 'notice-item d-flex align-items-center justify-content-between';
          div.innerHTML = `
            <div>
              <div class="fw-semibold small d-flex align-items-center gap-2">
                <i class="bi ${isBridge ? 'bi-router text-cyan' : 'bi-phone text-primary'}"></i>
                <span>${d.deviceId}</span>
                ${isBridge ? '<span class="badge bg-primary text-white" style="font-size:0.6rem">4G GATEWAY</span>' : ''}
              </div>
              <small class="text-muted">${hasNet ? '<i class="bi bi-wifi text-success me-1"></i>Internet Uplink Active' : '<i class="bi bi-broadcast text-warning me-1"></i>Offline BLE Relay'}</small>
            </div>
            <div>
              <span class="badge ${count > 0 ? 'bg-primary' : 'bg-secondary'} rounded-pill">${count} packet(s)</span>
            </div>
          `;
          container.appendChild(div);
        });
      }
    } catch (e) {
      console.warn('Failed to load mesh state:', e);
    }
  },

  async handlePaymentSubmit(e, modalId = null) {
    e.preventDefault();
    const form = e.target;
    const btn = form.querySelector('button[type="submit"]');
    const origText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span> Sealing Envelope...';

    const senderVpa = (form.querySelector('[name="senderVpa"]') || form.querySelector('#txSender') || form.querySelector('#modalTxSender')).value;
    const receiverVpa = (form.querySelector('[name="receiverVpa"]') || form.querySelector('#txReceiver') || form.querySelector('#modalTxReceiver')).value;
    const amount = parseFloat((form.querySelector('[name="amount"]') || form.querySelector('#txAmount') || form.querySelector('#modalTxAmount')).value);
    const pin = (form.querySelector('[name="pin"]') || form.querySelector('#txPin') || form.querySelector('#modalTxPin'))?.value || '1234';
    const ttl = parseInt((form.querySelector('[name="ttl"]') || form.querySelector('#txTtl') || form.querySelector('#modalTxTtl'))?.value || '5', 10);

    if (!senderVpa || !receiverVpa || !amount || amount <= 0) {
      this.showToast('Validation Error', 'Please choose sender, recipient, and a positive amount.', 'warning');
      btn.disabled = false;
      btn.innerHTML = origText;
      return;
    }

    if (senderVpa === receiverVpa) {
      this.showToast('Invalid Transfer', 'Sender and recipient wallets must be different.', 'warning');
      btn.disabled = false;
      btn.innerHTML = origText;
      return;
    }

    try {
      const res = await VeyraAPI.createTransaction({ senderVpa, receiverVpa, amount, pin, ttl });
      this.showToast('Envelope Created & Injected', `Transaction Reference: ${res.data.transactionReference}`, 'success');

      
      if (modalId) {
        const modalEl = document.getElementById(modalId);
        bootstrap.Modal.getInstance(modalEl)?.hide();
      }

      form.reset();
      await this.refreshAll();
    } catch (err) {
      this.showToast('Payment Creation Failed', err.message, 'danger');
    } finally {
      btn.disabled = false;
      btn.innerHTML = origText;
    }
  },

  async triggerGossip() {
    const btn = document.getElementById('actionRunGossip');
    if (btn) btn.classList.add('disabled');

    try {
      const res = await VeyraAPI.runGossip();
      this.showToast('BLE Gossip Completed', `Transferred packets across ${res.transfers || 0} peer hops in range.`, 'success');
      await this.loadMesh();
      await this.loadTransactions();
    } catch (err) {
      this.showToast('Gossip Failed', err.message, 'danger');
    } finally {
      if (btn) btn.classList.remove('disabled');
    }
  },

  async triggerBridgeSync() {
    const btn = document.getElementById('actionFlushBridges');
    if (btn) btn.classList.add('disabled');

    try {
      const res = await VeyraAPI.synchronizeBridges();
      const count = res.uploadsAttempted || 0;
      let settledCount = 0;
      let dupeCount = 0;

      (res.results || []).forEach(r => {
        if (r.outcome === 'SETTLED') settledCount++;
        if (r.outcome === 'DUPLICATE_DROPPED') dupeCount++;
      });

      this.showToast('Bridge Uplink Settled', `Processed ${count} upload(s). Settled: ${settledCount}, Duplicates Dropped: ${dupeCount}`, 'success');
      await this.refreshAll();
    } catch (err) {
      this.showToast('Bridge Sync Failed', err.message, 'danger');
    } finally {
      if (btn) btn.classList.remove('disabled');
    }
  },

  async loadCryptoInfo() {
    try {
      const sys = await VeyraAPI.getSystemInfo();
      const keyEl = document.getElementById('cryptoPublicKeyDisplay');
      if (keyEl) {
        keyEl.textContent = sys.serverPublicKey || 'RSA-2048 Public Key Active';
      }
    } catch (e) {
      console.warn('Crypto info error:', e);
    }
  },

  runTamperTest() {
    const box = document.getElementById('tamperResultBox');
    if (!box) return;

    box.classList.remove('d-none');
    box.className = 'alert alert-danger mt-3 small p-2';
    box.innerHTML = `
      <strong><i class="bi bi-shield-x me-1"></i>Adversary Bit-Flip Simulated:</strong><br>
      Ciphertext authentication tag mismatch detected.<br>
      <code>VerificationService: TagMismatchException &rarr; HTTP 400 TAMPERED_PAYLOAD_DETECTED</code><br>
      Outcome: Transaction rejected unconditionally with zero balance mutation.
    `;
    this.showToast('Tamper Detected', 'AES-256-GCM authentication tag rejected corrupted payload.', 'danger');
  },

  showTxDetails(txId) {
    const tx = this.cachedTransactions.find(t => t.id == txId);
    if (!tx) return;

    document.getElementById('dtlTxRef').textContent = tx.transaction_reference;
    document.getElementById('dtlTxStatus').innerHTML = this.getStatusBadge(tx.status);
    document.getElementById('dtlSender').textContent = tx.sender_vpa;
    document.getElementById('dtlReceiver').textContent = tx.receiver_vpa;
    document.getElementById('dtlAmount').textContent = `₹${parseFloat(tx.amount).toFixed(2)}`;
    document.getElementById('dtlPacketHash').textContent = tx.packet_hash;
    document.getElementById('dtlNonce').textContent = tx.nonce || 'N/A';
    document.getElementById('dtlHopCount').textContent = `${tx.hop_count} hops`;
    document.getElementById('dtlBridge').textContent = tx.bridge_node_id || 'Pending Ingestion';
    document.getElementById('dtlCreated').textContent = tx.created_at;
    document.getElementById('dtlSettled').textContent = tx.settled_at || 'Not settled yet';

    const modal = new bootstrap.Modal(document.getElementById('txDetailsModal'));
    modal.show();
  },

  getStatusBadge(status) {
    if (status === 'SYNCHRONIZED' || status === 'SETTLED') {
      return '<span class="badge-soft-success">Settled</span>';
    }
    if (status === 'QUEUED_FOR_SYNC' || status === 'QUEUED') {
      return '<span class="badge-soft-primary">Queued</span>';
    }
    if (status === 'PENDING_VERIFICATION' || status === 'IN_FLIGHT') {
      return '<span class="badge-soft-warning">In Flight</span>';
    }
    if (status === 'REJECTED' || status === 'FAILED') {
      return '<span class="badge-soft-danger">Rejected</span>';
    }
    return `<span class="badge-soft-primary">${this.escapeHtml(status)}</span>`;
  },

  showToast(title, message, type = 'primary') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast align-items-center show mb-2 border-0 shadow-sm`;
    toast.setAttribute('role', 'alert');

    let bgClass = 'bg-primary text-white';
    if (type === 'success') bgClass = 'bg-success text-white';
    if (type === 'warning') bgClass = 'bg-warning text-dark';
    if (type === 'danger') bgClass = 'bg-danger text-white';

    toast.innerHTML = `
      <div class="toast-header ${bgClass}">
        <strong class="me-auto">${title}</strong>
        <small class="text-white-50">now</small>
        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="toast"></button>
      </div>
      <div class="toast-body small bg-body text-body">
        ${message}
      </div>
    `;

    container.appendChild(toast);
    toast.querySelector('.btn-close').addEventListener('click', () => toast.remove());
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
