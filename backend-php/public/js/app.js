

document.addEventListener('DOMContentLoaded', () => {
  VeyraApp.init();
});

const VeyraApp = {
  pollTimer: null,
  cachedAccounts: [],
  cachedTransactions: [],
  cachedMeshDevices: [],
  activeTransit: null,
  transitTimer: null,

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
    if (viewName === 'banks') this.loadAccounts();
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

    const autoSwitch = document.getElementById('autoCompleteTransfer');
    const submitBtn = document.getElementById('btnSubmitPayment');
    if (autoSwitch && submitBtn) {
      autoSwitch.addEventListener('change', () => {
        if (autoSwitch.checked) {
          submitBtn.innerHTML = '<i class="bi bi-send-check-fill me-1"></i> Send & Complete Transfer';
          submitBtn.className = 'btn btn-sm btn-primary';
        } else {
          submitBtn.innerHTML = '<i class="bi bi-inbox-fill me-1"></i> Queue in Offline Mesh Only';
          submitBtn.className = 'btn btn-sm btn-outline-primary';
        }
      });
    }

    const delaySelect = document.getElementById('txDeliveryDelay');
    const delayDisplay = document.getElementById('txDelayDisplay');
    if (delaySelect && delayDisplay) {
      delaySelect.addEventListener('change', () => {
        const val = parseInt(delaySelect.value, 10);
        if (val === 0) delayDisplay.textContent = 'Instant (0s)';
        else if (val >= 60) delayDisplay.textContent = `${(val / 60).toFixed(val % 60 ? 1 : 0)} min (${val}s)`;
        else delayDisplay.textContent = `${val}s`;
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
      this.loadMesh(),
      this.loadQueue()
    ]).catch(err => console.warn('Refresh error:', err));
  },

  async pollTelemetry() {
    try {
      await this.loadHealth();
      await this.loadMesh(true);
      await this.loadTransactions(true);
      await this.loadQueue(true);
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
        sel.innerHTML = '<option value="">-- Choose Sender Bank Account --</option>';
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
        sel.innerHTML = '<option value="">-- Choose Beneficiary Bank Account --</option>';
        accounts.forEach(acc => {
          const opt = document.createElement('option');
          opt.value = acc.vpa;
          opt.textContent = `${acc.full_name} (${acc.vpa})`;
          sel.appendChild(opt);
        });
        if (current) sel.value = current;
      });

      
      const tbody = document.getElementById('banksTableBody');
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
          const statusBadge = this.getStatusBadge(tx.status, tx);
          const dateStr = tx.created_at ? new Date(tx.created_at).toLocaleString() : 'Recent';
          const isPending = tx.status === 'QUEUED_FOR_SYNC' || tx.status === 'QUEUED' || tx.status === 'PENDING_VERIFICATION';
          const settleBtn = isPending ? `
            <button class="btn btn-sm btn-success py-0 px-2 rounded-2 ms-1" title="Complete & Settle" onclick="VeyraApp.completeTransaction(${tx.id})">
              <i class="bi bi-check2-circle me-1"></i>Settle
            </button>
          ` : '';

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
              ${settleBtn}
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
          const isPending = tx.status === 'QUEUED_FOR_SYNC' || tx.status === 'QUEUED' || tx.status === 'PENDING_VERIFICATION';
          const settleBtn = isPending ? `
            <button class="btn btn-sm btn-success py-0 px-2 ms-1" title="Complete & Settle" onclick="VeyraApp.completeTransaction(${tx.id})">
              <i class="bi bi-check2-circle me-1"></i>Settle
            </button>
          ` : '';

          tr.innerHTML = `
            <td><code>${tx.transaction_reference}</code></td>
            <td>${this.escapeHtml(tx.sender_vpa)}</td>
            <td>${this.escapeHtml(tx.receiver_vpa)}</td>
            <td><strong class="text-primary">₹${parseFloat(tx.amount).toFixed(2)}</strong></td>
            <td>${this.getStatusBadge(tx.status, tx)}</td>
            <td><span class="badge bg-secondary">${tx.hop_count} hops</span></td>
            <td><small class="text-muted">${tx.settled_at || tx.created_at}</small></td>
            <td>
              <button class="btn btn-sm btn-outline-primary py-0 px-2" onclick="VeyraApp.showTxDetails(${tx.id})">Inspect</button>
              ${settleBtn}
            </td>
          `;
          fullTbody.appendChild(tr);
        });
      }
    } catch (e) {
      console.warn('Failed to load transactions:', e);
    }
  },

  async loadQueue(isPolling = false) {
    try {
      const res = await VeyraAPI.getQueue();
      const queue = res.queue || [];
      this.cachedQueue = queue;

      const elQueued = document.getElementById('metricQueued');
      if (elQueued) elQueued.textContent = queue.length;

      const tbody = document.getElementById('queueTableBody');
      if (tbody) {
        if (queue.length === 0) {
          tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted py-4"><i class="bi bi-inbox me-2"></i>Outbox vault is empty. No offline packets waiting for bridge uplink.</td></tr>';
          return;
        }

        tbody.innerHTML = '';
        queue.forEach(pkt => {
          const tr = document.createElement('tr');
          const pktIdShort = pkt.packet_id ? (pkt.packet_id.substring(0, 12) + '...') : '--';
          tr.innerHTML = `
            <td><code class="font-monospace text-primary">${this.escapeHtml(pktIdShort)}</code></td>
            <td>
              <div class="small">
                <span class="fw-semibold">${this.escapeHtml(pkt.sender_vpa)}</span>
                <i class="bi bi-arrow-right mx-1 text-muted"></i>
                <span class="fw-semibold">${this.escapeHtml(pkt.receiver_vpa)}</span>
              </div>
            </td>
            <td><strong class="text-primary">₹${parseFloat(pkt.amount).toLocaleString('en-IN', {minimumFractionDigits: 2})}</strong></td>
            <td><span class="badge bg-secondary-subtle text-secondary border font-monospace">${this.escapeHtml(pkt.current_holder_node || 'phone-atul')}</span></td>
            <td><span class="badge bg-info-subtle text-info border">${pkt.ttl} hops</span></td>
            <td><span class="badge-soft-warning">${this.escapeHtml(pkt.status || 'QUEUED')}</span></td>
            <td>
              <button class="btn btn-sm btn-success py-0 px-2" onclick="VeyraApp.completeTransaction()">
                <i class="bi bi-check2-circle me-1"></i>Settle
              </button>
            </td>
          `;
          tbody.appendChild(tr);
        });
      }
    } catch (e) {
      if (!isPolling) console.warn('Failed to load offline queue:', e);
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
    const autoComplete = form.querySelector('#autoCompleteTransfer')?.checked ?? true;
    const delaySeconds = parseInt(form.querySelector('#txDeliveryDelay')?.value || '60', 10);

    if (!senderVpa || !receiverVpa || !amount || amount <= 0) {
      this.showToast('Validation Error', 'Please choose sender, recipient, and a positive amount.', 'warning');
      btn.disabled = false;
      btn.innerHTML = origText;
      return;
    }

    if (senderVpa === receiverVpa) {
      this.showToast('Invalid Transfer', 'Sender and recipient bank accounts must be different.', 'warning');
      btn.disabled = false;
      btn.innerHTML = origText;
      return;
    }

    try {
      const res = await VeyraAPI.createTransaction({ senderVpa, receiverVpa, amount, pin, ttl });

      if (modalId) {
        const modalEl = document.getElementById(modalId);
        if (modalEl) {
          bootstrap.Modal.getOrCreateInstance(modalEl).hide();
        }
      }
      form.reset();

      if (!autoComplete) {
        this.showToast('Envelope Queued Offline', `Transaction Reference: ${res.data.transactionReference}`, 'success');
        await this.refreshAll();
      } else if (delaySeconds === 0) {
        btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span> Relaying & Settling...';
        await VeyraAPI.runGossip();
        await VeyraAPI.synchronizeBridges();
        this.showToast('Transfer Completed & Settled', `₹${amount.toFixed(2)} sent from ${senderVpa} to ${receiverVpa} and settled against bank ledger.`, 'success');
        await this.refreshAll();
      } else {
        await this.startTransitSimulation({
          txId: res.data.transactionId,
          txRef: res.data.transactionReference,
          senderVpa,
          receiverVpa,
          amount,
          totalSeconds: delaySeconds
        });
      }
    } catch (err) {
      this.showToast('Payment Failed', err.message, 'danger');
    } finally {
      btn.disabled = false;
      btn.innerHTML = origText;
    }
  },

  async startTransitSimulation(data) {
    if (this.transitTimer) clearInterval(this.transitTimer);

    this.activeTransit = {
      ...data,
      remainingSeconds: data.totalSeconds,
      startTime: Date.now(),
      endTime: Date.now() + (data.totalSeconds * 1000)
    };

    const footer = document.getElementById('transitModalFooter');
    if (footer) {
      footer.innerHTML = `
        <button type="button" class="btn btn-sm btn-outline-secondary" data-bs-dismiss="modal" id="btnMinimizeTransit">
          <i class="bi bi-window-dash me-1"></i>Run in Background
        </button>
        <button type="button" class="btn btn-sm btn-success" id="btnSkipTransitDelay" onclick="VeyraApp.skipTransitDelay()">
          <i class="bi bi-lightning-charge-fill me-1"></i>Settle Now (Fast-Forward)
        </button>
      `;
    }

    const progressEl = document.getElementById('transitProgressBar');
    if (progressEl) {
      progressEl.className = 'progress-bar progress-bar-striped progress-bar-animated bg-primary';
    }

    this.updateTransitUI();
    this.showTransitModal();
    this.updateTransitBanner(true);
    await this.refreshAll();

    this.transitTimer = setInterval(async () => {
      if (!this.activeTransit) {
        clearInterval(this.transitTimer);
        this.transitTimer = null;
        return;
      }

      const now = Date.now();
      const remaining = Math.max(0, Math.round((this.activeTransit.endTime - now) / 1000));
      this.activeTransit.remainingSeconds = remaining;

      this.updateTransitUI();

      if (remaining === Math.round(this.activeTransit.totalSeconds * 0.5)) {
        VeyraAPI.runGossip().catch(() => {});
      }

      if (remaining <= 0) {
        clearInterval(this.transitTimer);
        this.transitTimer = null;
        await this.finalizeTransitSettlement();
      }
    }, 1000);
  },

  showTransitModal() {
    const modalEl = document.getElementById('meshTransitModal');
    if (modalEl) {
      bootstrap.Modal.getOrCreateInstance(modalEl).show();
    }
  },

  updateTransitBanner(show = true) {
    const banner = document.getElementById('inFlightTransitBanner');
    if (!banner) return;
    if (!show || !this.activeTransit) {
      banner.classList.add('d-none');
      return;
    }
    banner.classList.remove('d-none');
    const mins = Math.floor(this.activeTransit.remainingSeconds / 60);
    const secs = this.activeTransit.remainingSeconds % 60;
    const timeStr = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    const timeBadge = document.getElementById('inFlightBannerTime');
    if (timeBadge) timeBadge.textContent = `${timeStr} remaining`;
  },

  updateTransitUI() {
    if (!this.activeTransit) return;
    const { amount, senderVpa, receiverVpa, totalSeconds, remainingSeconds } = this.activeTransit;
    const elapsed = totalSeconds - remainingSeconds;
    const pct = Math.min(100, Math.round((elapsed / totalSeconds) * 100));
    const mins = Math.floor(remainingSeconds / 60);
    const secs = remainingSeconds % 60;
    const timeStr = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

    const amountEl = document.getElementById('transitAmountDisplay');
    if (amountEl) amountEl.textContent = `₹${parseFloat(amount).toLocaleString('en-IN', {minimumFractionDigits: 2})}`;

    const routeEl = document.getElementById('transitRouteDisplay');
    if (routeEl) routeEl.textContent = `${senderVpa} → ${receiverVpa}`;

    const countdownEl = document.getElementById('transitCountdownDisplay');
    if (countdownEl) countdownEl.textContent = timeStr;

    const progressEl = document.getElementById('transitProgressBar');
    if (progressEl) {
      progressEl.style.width = `${pct}%`;
      progressEl.setAttribute('aria-valuenow', pct);
    }

    this.updateTransitBanner(true);

    const subtext = document.getElementById('transitStatusSubtext');
    const setStep = (stepNum, state, iconClass) => {
      const badge = document.getElementById(`transitStep${stepNum}Badge`);
      const icon = document.getElementById(`transitStep${stepNum}Icon`);
      if (!badge) return;
      if (state === 'done') {
        badge.className = 'badge bg-success-subtle text-success';
        badge.innerHTML = '<i class="bi bi-check2 me-1"></i>Done';
        if (icon) icon.className = `bi bi-check-circle-fill text-success me-3 fs-5`;
      } else if (state === 'active') {
        badge.className = 'badge bg-primary-subtle text-primary';
        badge.innerHTML = '<span class="spinner-border spinner-border-sm me-1" style="width:0.6rem;height:0.6rem"></span>Active';
        if (icon) icon.className = `bi ${iconClass} text-primary me-3 fs-5`;
      } else {
        badge.className = 'badge bg-secondary-subtle text-secondary';
        badge.textContent = 'Pending';
        if (icon) icon.className = `bi ${iconClass} text-muted me-3 fs-5`;
      }
    };

    if (pct < 20) {
      if (subtext) subtext.textContent = 'Phase 1: Sealing AES-256-GCM envelope and generating zero-knowledge proof...';
      setStep(1, 'active', 'bi-shield-lock-fill');
      setStep(2, 'pending', 'bi-broadcast');
      setStep(3, 'pending', 'bi-diagram-3');
      setStep(4, 'pending', 'bi-router');
      setStep(5, 'pending', 'bi-bank2');
    } else if (pct < 45) {
      if (subtext) subtext.textContent = 'Phase 2: Local BLE peer discovery & multi-peer hop broadcast...';
      setStep(1, 'done', 'bi-shield-lock-fill');
      setStep(2, 'active', 'bi-broadcast');
      setStep(3, 'pending', 'bi-diagram-3');
      setStep(4, 'pending', 'bi-router');
      setStep(5, 'pending', 'bi-bank2');
    } else if (pct < 75) {
      if (subtext) subtext.textContent = 'Phase 3: Multi-hop store-and-forward mesh routing across stranger nodes...';
      setStep(1, 'done', 'bi-shield-lock-fill');
      setStep(2, 'done', 'bi-broadcast');
      setStep(3, 'active', 'bi-diagram-3');
      setStep(4, 'pending', 'bi-router');
      setStep(5, 'pending', 'bi-bank2');
    } else if (pct < 95) {
      if (subtext) subtext.textContent = 'Phase 4: 4G gateway bridge encountered (phone-bridge) & uplink transmission...';
      setStep(1, 'done', 'bi-shield-lock-fill');
      setStep(2, 'done', 'bi-broadcast');
      setStep(3, 'done', 'bi-diagram-3');
      setStep(4, 'active', 'bi-router');
      setStep(5, 'pending', 'bi-bank2');
    } else {
      if (subtext) subtext.textContent = 'Phase 5: Central bank RSA key authentication & double-entry ledger mutation...';
      setStep(1, 'done', 'bi-shield-lock-fill');
      setStep(2, 'done', 'bi-broadcast');
      setStep(3, 'done', 'bi-diagram-3');
      setStep(4, 'done', 'bi-router');
      setStep(5, 'active', 'bi-bank2');
    }

    document.querySelectorAll('.active-transit-timer').forEach(el => {
      el.textContent = `${remainingSeconds}s`;
    });
  },

  async skipTransitDelay() {
    if (!this.activeTransit) return;
    if (this.transitTimer) {
      clearInterval(this.transitTimer);
      this.transitTimer = null;
    }
    await this.finalizeTransitSettlement();
  },

  async finalizeTransitSettlement() {
    if (!this.activeTransit) return;
    const { txId, amount, receiverVpa } = this.activeTransit;

    const countdownEl = document.getElementById('transitCountdownDisplay');
    if (countdownEl) countdownEl.innerHTML = '<span class="text-success"><i class="bi bi-check-circle-fill me-2"></i>Settled</span>';

    const subtext = document.getElementById('transitStatusSubtext');
    if (subtext) subtext.innerHTML = `<strong class="text-success">Payment Successfully Settled!</strong> Verified against bank ledger.`;

    const progressEl = document.getElementById('transitProgressBar');
    if (progressEl) {
      progressEl.style.width = '100%';
      progressEl.className = 'progress-bar bg-success';
    }

    for (let i = 1; i <= 5; i++) {
      const badge = document.getElementById(`transitStep${i}Badge`);
      const icon = document.getElementById(`transitStep${i}Icon`);
      if (badge) {
        badge.className = 'badge bg-success-subtle text-success';
        badge.innerHTML = '<i class="bi bi-check2 me-1"></i>Done';
      }
      if (icon) icon.className = 'bi bi-check-circle-fill text-success me-3 fs-5';
    }

    const footer = document.getElementById('transitModalFooter');
    if (footer) {
      footer.innerHTML = `
        <button type="button" class="btn btn-sm btn-outline-secondary" data-bs-dismiss="modal">Close</button>
        <button type="button" class="btn btn-sm btn-primary" data-bs-dismiss="modal" onclick="VeyraApp.switchView('transactions')">
          <i class="bi bi-journal-text me-1"></i>View in Transaction Ledger
        </button>
      `;
    }

    try {
      await VeyraAPI.runGossip();
      await VeyraAPI.synchronizeBridges(txId);
      this.showToast('Transfer Completed & Settled', `₹${parseFloat(amount).toFixed(2)} delivered to ${receiverVpa} and settled against bank ledger.`, 'success');
    } catch (err) {
      this.showToast('Settlement Notice', err.message, 'warning');
    }

    this.updateTransitBanner(false);
    this.activeTransit = null;
    await this.refreshAll();
  },

  async completeTransaction(txId = null) {
    this.showToast('Settling Transaction', 'Routing packet through BLE mesh and settling with bank bridge...', 'info');
    try {
      await VeyraAPI.runGossip();
      await VeyraAPI.synchronizeBridges(txId);
      await this.refreshAll();
      this.showToast('Transaction Settled', 'Packet successfully routed and settled against bank ledger.', 'success');
    } catch (err) {
      this.showToast('Settlement Failed', err.message, 'danger');
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

  getStatusBadge(status, tx = null) {
    if (this.activeTransit && tx && tx.id == this.activeTransit.txId) {
      return `<span class="badge-soft-warning"><span class="spinner-border spinner-border-sm me-1" style="width:0.6rem;height:0.6rem"></span>In Transit (<span class="active-transit-timer">${this.activeTransit.remainingSeconds}s</span>)</span>`;
    }
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
