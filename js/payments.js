/* ==========================================
   VYAPAR PWA — PAYMENTS MODULE
   ========================================== */

const Payments = {
  currentTab: 'in',
  searchTerm: '',

  render() {
    const payments = DB.getAll(DB.COLLECTIONS.PAYMENTS);
    const filtered = payments
      .filter(p => p.type === this.currentTab)
      .filter(p => Utils.filterBySearch([p], this.searchTerm, ['partyName', 'receiptNumber']).length > 0)
      .reverse();

    const totalIn = payments.filter(p => p.type === 'in').reduce((sum, p) => sum + Utils.parseNum(p.amount), 0);
    const totalOut = payments.filter(p => p.type === 'out').reduce((sum, p) => sum + Utils.parseNum(p.amount), 0);

    return `
      <div class="stat-grid" style="margin-bottom:20px">
        <div class="stat-card">
          <div class="stat-label">Total Payment In</div>
          <div class="stat-value text-success">${Utils.formatCurrency(totalIn)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Total Payment Out</div>
          <div class="stat-value text-danger">${Utils.formatCurrency(totalOut)}</div>
        </div>
      </div>

      <div class="toolbar">
        <div class="toolbar-left">
          <div class="tabs" style="border:none;margin:0">
            <div class="tab ${this.currentTab === 'in' ? 'active' : ''}" onclick="Payments.switchTab('in')">
              💰 Payment In
            </div>
            <div class="tab ${this.currentTab === 'out' ? 'active' : ''}" onclick="Payments.switchTab('out')">
              💸 Payment Out
            </div>
          </div>
        </div>
        <div class="toolbar-right">
          <button class="btn btn-primary" onclick="Payments.openAddPayment()">
            ${Utils.icons.plus} ${this.currentTab === 'in' ? 'Payment In' : 'Payment Out'}
          </button>
        </div>
      </div>

      <div class="search-bar mb-2">
        ${Utils.icons.search}
        <input type="text" placeholder="Search payments..." value="${this.searchTerm}" 
               oninput="Payments.search(this.value)">
      </div>

      ${filtered.length === 0 ? `
        <div class="empty-state">
          ${Utils.icons.payments}
          <h3>No ${this.currentTab === 'in' ? 'Payment In' : 'Payment Out'} Records</h3>
          <p>Record your first payment</p>
          <button class="btn btn-primary" onclick="Payments.openAddPayment()">
            ${Utils.icons.plus} Add Payment
          </button>
        </div>
      ` : `
        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Receipt #</th>
                <th>Date</th>
                <th>Party</th>
                <th>Mode</th>
                <th class="text-right">Amount</th>
                <th class="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${filtered.map(payment => `
                <tr>
                  <td class="font-bold">${payment.receiptNumber || '-'}</td>
                  <td>${Utils.formatDate(payment.date)}</td>
                  <td>
                    <div class="flex items-center gap-1">
                      <div class="avatar ${payment.type === 'in' ? 'customer' : 'supplier'}">${Utils.getInitials(payment.partyName)}</div>
                      ${Utils.escapeHtml(payment.partyName || 'Unknown')}
                    </div>
                  </td>
                  <td><span class="badge badge-accent">${payment.mode || 'Cash'}</span></td>
                  <td class="text-right">
                    <span class="amount ${payment.type === 'in' ? 'credit' : 'debit'}">${Utils.formatCurrency(payment.amount)}</span>
                  </td>
                  <td>
                    <div class="table-actions">
                      <button class="btn btn-ghost btn-icon" onclick="Payments.deletePayment('${payment.id}')" title="Delete">${Utils.icons.trash}</button>
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `}
    `;
  },

  switchTab(tab) {
    this.currentTab = tab;
    this.searchTerm = '';
    App.refreshPage();
  },

  search(term) {
    this.searchTerm = term;
    App.refreshPage();
  },

  openAddPayment() {
    const type = this.currentTab;
    const parties = type === 'in' ? DB.getParties('customer') : DB.getParties('supplier');

    App.showModal(type === 'in' ? '💰 Payment In (Received)' : '💸 Payment Out (Paid)', `
      <form id="paymentForm" autocomplete="off" onsubmit="Payments.savePayment(event)">
        <input type="hidden" name="type" value="${type}">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Receipt Number</label>
            <input type="text" class="form-input" name="receiptNumber" value="RCT-${Date.now().toString().slice(-6)}" placeholder="Receipt #">
          </div>
          <div class="form-group">
            <label class="form-label">Date</label>
            <input type="date" class="form-input" name="date" value="${Utils.today()}" required>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">${type === 'in' ? 'Customer' : 'Supplier'} *</label>
          <select class="form-select" name="partyId" required onchange="Payments.showPartyBalance(this.value)">
            <option value="">Select ${type === 'in' ? 'Customer' : 'Supplier'}</option>
            ${parties.map(p => `<option value="${p.id}">${Utils.escapeHtml(p.name)}</option>`).join('')}
          </select>
          <div id="partyBalanceInfo" class="form-helper"></div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Amount *</label>
            <input type="number" class="form-input" name="amount" required step="0.01" min="0.01" placeholder="0.00" style="font-size:1.2rem;font-weight:700">
          </div>
          <div class="form-group">
            <label class="form-label">Account / Method</label>
            <select class="form-select" name="accountId">
              <option value="">Select Account</option>
              ${DB.getAll(DB.COLLECTIONS.ACCOUNTS).map(a => `<option value="${a.id}">${Utils.escapeHtml(a.name)} (${Utils.formatCurrency(a.balance)})</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Payment Mode</label>
          <select class="form-select" name="mode">
            <option value="Cash">Cash</option>
            <option value="UPI">UPI</option>
            <option value="Bank Transfer">Bank Transfer</option>
            <option value="Cheque">Cheque</option>
            <option value="Card">Card</option>
            <option value="Other">Other</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Notes</label>
          <textarea class="form-textarea" name="notes" rows="2" placeholder="Payment details..."></textarea>
        </div>
        <div class="modal-footer" style="padding:16px 0 0;border-top:1px solid var(--border)">
          <button type="button" class="btn btn-outline" onclick="App.closeModal()">Cancel</button>
          <button type="submit" class="btn ${type === 'in' ? 'btn-success' : 'btn-danger'}">${type === 'in' ? '💰 Receive Payment' : '💸 Make Payment'}</button>
        </div>
      </form>
    `);
  },

  showPartyBalance(partyId) {
    const el = document.getElementById('partyBalanceInfo');
    if (!el || !partyId) {
      if (el) el.innerHTML = '';
      return;
    }
    const balance = DB.getPartyBalance(partyId);
    const party = DB.getById(DB.COLLECTIONS.PARTIES, partyId);
    if (!party) return;

    if (party.type === 'customer') {
      el.innerHTML = `Outstanding: <strong class="text-warning">${Utils.formatCurrency(balance.receivable)}</strong>`;
    } else {
      el.innerHTML = `Payable: <strong class="text-danger">${Utils.formatCurrency(balance.payable)}</strong>`;
    }
  },

  savePayment(e) {
    e.preventDefault();
    const form = new FormData(e.target);
    const partyId = form.get('partyId');
    const party = DB.getById(DB.COLLECTIONS.PARTIES, partyId);

    const accountId = form.get('accountId');
    const amount = parseFloat(form.get('amount')) || 0;
    const type = form.get('type');

    const payment = {
      type,
      receiptNumber: form.get('receiptNumber'),
      date: form.get('date'),
      partyId,
      partyName: party ? party.name : 'Unknown',
      accountId: accountId || '',
      amount,
      mode: form.get('mode'),
      notes: form.get('notes')
    };

    DB.add(DB.COLLECTIONS.PAYMENTS, payment);

    // Update account balance if selected
    if (accountId) {
      const acc = DB.getById(DB.COLLECTIONS.ACCOUNTS, accountId);
      if (acc) {
        const change = type === 'in' ? amount : -amount;
        DB.update(DB.COLLECTIONS.ACCOUNTS, accountId, {
          balance: Utils.parseNum(acc.balance) + change
        });
      }
    }

    App.toast(type === 'in' ? 'Payment received! 💰' : 'Payment made! 💸', 'success');
    App.closeModal();
    App.refreshPage();
  },

  deletePayment(id) {
    if (!confirm('Delete this payment record?')) return;
    DB.delete(DB.COLLECTIONS.PAYMENTS, id);
    App.toast('Payment deleted', 'warning');
    App.refreshPage();
  }
};
