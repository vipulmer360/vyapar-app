/* ==========================================
   VYAPAR PWA — ACCOUNTS MODULE
   ========================================== */

const Accounts = {
  searchTerm: '',

  // Account type presets with icons & colors
  typePresets: {
    bank: { label: 'Bank Account', icon: '🏦', color: '#3b82f6', gradient: 'linear-gradient(135deg, #1e3a5f, #2563eb)' },
    wallet: { label: 'Wallet', icon: '👛', color: '#8b5cf6', gradient: 'linear-gradient(135deg, #4c1d95, #7c3aed)' },
    pocket: { label: 'Pocket / Cash', icon: '💵', color: '#22c55e', gradient: 'linear-gradient(135deg, #14532d, #16a34a)' },
    upi: { label: 'UPI', icon: '📲', color: '#6366f1', gradient: 'linear-gradient(135deg, #312e81, #6366f1)' },
    credit_card: { label: 'Credit Card', icon: '💳', color: '#f59e0b', gradient: 'linear-gradient(135deg, #78350f, #d97706)' },
    savings: { label: 'Savings', icon: '🏦', color: '#0ea5e9', gradient: 'linear-gradient(135deg, #0c4a6e, #0284c7)' },
    loan: { label: 'Loan Account', icon: '📋', color: '#ef4444', gradient: 'linear-gradient(135deg, #7f1d1d, #dc2626)' },
    other: { label: 'Other', icon: '💰', color: '#64748b', gradient: 'linear-gradient(135deg, #334155, #64748b)' }
  },

  render() {
    const accounts = DB.getAll(DB.COLLECTIONS.ACCOUNTS);
    const filtered = Utils.filterBySearch(accounts, this.searchTerm, ['name', 'type', 'bankName']);

    const totalBalance = accounts.reduce((sum, a) => sum + Utils.parseNum(a.balance), 0);

    return `
      <div class="stat-grid" style="margin-bottom:20px">
        <div class="stat-card cash">
          <div class="stat-label">Total Accounts</div>
          <div class="stat-value text-accent">${accounts.length}</div>
        </div>
        <div class="stat-card profit">
          <div class="stat-label">Total Balance</div>
          <div class="stat-value text-success">${Utils.formatCurrency(totalBalance)}</div>
        </div>
      </div>

      <div class="toolbar">
        <div class="toolbar-left">
          <div class="search-bar" style="flex:1;max-width:300px">
            ${Utils.icons.search}
            <input type="text" placeholder="Search accounts..." value="${this.searchTerm}" 
                   oninput="Accounts.search(this.value)">
          </div>
        </div>
        <div class="toolbar-right">
          <button class="btn btn-primary" onclick="Accounts.openAddAccount()">
            ${Utils.icons.plus} Add Account
          </button>
        </div>
      </div>

      ${filtered.length === 0 ? `
        <div class="empty-state" style="padding:40px 20px;text-align:center">
          <div style="font-size:36px;margin-bottom:8px">🏦</div>
          <h3 style="font-size:1rem;margin-bottom:4px">No Accounts Added</h3>
          <p style="font-size:0.85rem;color:var(--text-muted);margin:0">Add your Bank, Wallet, or Pocket accounts to track money flow</p>
        </div>
      ` : `
        <!-- Accounts Cards Grid -->
        <div class="accounts-grid">
          ${filtered.map(acc => {
            const preset = this.typePresets[acc.type] || this.typePresets.other;
            const stats = this._getAccountStats(acc.id);
            return `
              <div class="account-card" style="background:${preset.gradient}">
                <div class="account-card-header">
                  <div class="account-card-icon">${preset.icon}</div>
                  <div class="account-card-actions">
                    <button class="btn btn-ghost btn-icon" style="color:rgba(255,255,255,0.7)" onclick="Accounts.openEditAccount('${acc.id}')" title="Edit">${Utils.icons.edit}</button>
                    <button class="btn btn-ghost btn-icon" style="color:rgba(255,255,255,0.7)" onclick="Accounts.deleteAccount('${acc.id}')" title="Delete">${Utils.icons.trash}</button>
                  </div>
                </div>
                <div class="account-card-name">${Utils.escapeHtml(acc.name)}</div>
                <div class="account-card-type">${preset.label}${acc.bankName ? ' • ' + Utils.escapeHtml(acc.bankName) : ''}</div>
                <div class="account-card-balance">${Utils.formatCurrency(acc.balance)}</div>
                <div class="account-card-stats">
                  <div class="account-stat">
                    <span class="account-stat-label">Income</span>
                    <span class="account-stat-value" style="color:#4ade80">${Utils.formatShortCurrency(stats.totalIncome)}</span>
                  </div>
                  <div class="account-stat">
                    <span class="account-stat-label">Expense</span>
                    <span class="account-stat-value" style="color:#f87171">${Utils.formatShortCurrency(stats.totalExpense)}</span>
                  </div>
                  <div class="account-stat">
                    <span class="account-stat-label">Net</span>
                    <span class="account-stat-value" style="color:${stats.net >= 0 ? '#4ade80' : '#f87171'}">${Utils.formatShortCurrency(stats.net)}</span>
                  </div>
                </div>
                ${acc.accountNumber ? `<div class="account-card-number">•••• ${acc.accountNumber.slice(-4)}</div>` : ''}
              </div>
            `;
          }).join('')}
        </div>

        <!-- Accounts Table -->
        <div class="section-header mt-3">
          <div class="section-title">All Accounts</div>
        </div>
        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Account</th>
                <th>Type</th>
                <th class="text-right">Balance</th>
                <th class="text-right">Total Income</th>
                <th class="text-right">Total Expense</th>
                <th class="text-right">Net</th>
                <th class="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${filtered.map(acc => {
                const preset = this.typePresets[acc.type] || this.typePresets.other;
                const stats = this._getAccountStats(acc.id);
                return `
                  <tr>
                    <td>
                      <div class="flex items-center gap-1">
                        <span style="font-size:1.3rem">${preset.icon}</span>
                        <div>
                          <div class="font-bold">${Utils.escapeHtml(acc.name)}</div>
                          ${acc.bankName ? `<div class="text-muted" style="font-size:0.75rem">${Utils.escapeHtml(acc.bankName)}</div>` : ''}
                        </div>
                      </div>
                    </td>
                    <td><span class="badge badge-accent">${preset.label}</span></td>
                    <td class="text-right font-bold">${Utils.formatCurrency(acc.balance)}</td>
                    <td class="text-right"><span class="amount credit">${Utils.formatCurrency(stats.totalIncome)}</span></td>
                    <td class="text-right"><span class="amount debit">${Utils.formatCurrency(stats.totalExpense)}</span></td>
                    <td class="text-right"><span class="amount ${stats.net >= 0 ? 'credit' : 'debit'}">${Utils.formatCurrency(stats.net)}</span></td>
                    <td>
                      <div class="table-actions">
                        <button class="btn btn-ghost btn-icon" onclick="Accounts.openEditAccount('${acc.id}')" title="Edit">${Utils.icons.edit}</button>
                        <button class="btn btn-ghost btn-icon" onclick="Accounts.deleteAccount('${acc.id}')" title="Delete">${Utils.icons.trash}</button>
                      </div>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      `}
    `;
  },

  search(term) {
    this.searchTerm = term;
    App.refreshPage();
  },

  _getAccountStats(accountId) {
    const incomes = DB.getAll(DB.COLLECTIONS.INCOMES).filter(i => i.accountId === accountId);
    const expenses = DB.getAll(DB.COLLECTIONS.EXPENSES).filter(e => e.accountId === accountId);

    const totalIncome = incomes.reduce((sum, i) => sum + Utils.parseNum(i.amount), 0);
    const totalExpense = expenses.reduce((sum, e) => sum + Utils.parseNum(e.amount), 0);

    return {
      totalIncome,
      totalExpense,
      net: totalIncome - totalExpense
    };
  },

  openAddAccount() {
    App.showModal('➕ Add Account', this._accountForm());
  },

  openEditAccount(id) {
    const acc = DB.getById(DB.COLLECTIONS.ACCOUNTS, id);
    if (!acc) return;
    App.showModal('✏️ Edit Account', this._accountForm(acc));
  },

  _accountForm(acc = null) {
    const isEdit = acc !== null;
    return `
      <form id="accountForm" onsubmit="Accounts.saveAccount(event, ${isEdit ? `'${acc.id}'` : 'null'})">
        <div class="form-group">
          <label class="form-label">Account Name *</label>
          <input type="text" class="form-input" name="name" required value="${isEdit ? Utils.escapeHtml(acc.name) : ''}" placeholder="e.g. SBI Savings, Paytm Wallet, Cash">
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Account Type *</label>
            <select class="form-select" name="type" required>
              ${Object.entries(this.typePresets).map(([key, preset]) =>
                `<option value="${key}" ${isEdit && acc.type === key ? 'selected' : ''}>${preset.icon} ${preset.label}</option>`
              ).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Opening Balance (₹)</label>
            <input type="number" class="form-input" name="balance" step="0.01" value="${isEdit ? acc.balance || 0 : '0'}" placeholder="0.00">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Bank Name</label>
            <input type="text" class="form-input" name="bankName" value="${isEdit ? Utils.escapeHtml(acc.bankName || '') : ''}" placeholder="e.g. State Bank of India">
          </div>
          <div class="form-group">
            <label class="form-label">Account Number</label>
            <input type="text" class="form-input" name="accountNumber" value="${isEdit ? Utils.escapeHtml(acc.accountNumber || '') : ''}" placeholder="Account number">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">IFSC Code</label>
          <input type="text" class="form-input" name="ifscCode" value="${isEdit ? Utils.escapeHtml(acc.ifscCode || '') : ''}" placeholder="IFSC code">
        </div>
        <div class="form-group">
          <label class="form-label">Notes</label>
          <textarea class="form-textarea" name="notes" rows="2" placeholder="Any additional details...">${isEdit ? Utils.escapeHtml(acc.notes || '') : ''}</textarea>
        </div>
        <div class="modal-footer" style="padding:16px 0 0;border-top:1px solid var(--border)">
          <button type="button" class="btn btn-outline" onclick="App.closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary">${isEdit ? 'Update' : 'Add'} Account</button>
        </div>
      </form>
    `;
  },

  saveAccount(e, id = null) {
    e.preventDefault();
    const form = new FormData(e.target);
    const data = {
      name: form.get('name'),
      type: form.get('type'),
      balance: parseFloat(form.get('balance')) || 0,
      bankName: form.get('bankName'),
      accountNumber: form.get('accountNumber'),
      ifscCode: form.get('ifscCode'),
      notes: form.get('notes')
    };

    if (id) {
      DB.update(DB.COLLECTIONS.ACCOUNTS, id, data);
      App.toast('Account updated! ✅', 'success');
    } else {
      DB.add(DB.COLLECTIONS.ACCOUNTS, data);
      App.toast('Account added! 🏦', 'success');
    }
    App.closeModal();
    App.refreshPage();
  },

  deleteAccount(id) {
    if (!confirm('Delete this account? Transactions linked to it will NOT be deleted.')) return;
    DB.delete(DB.COLLECTIONS.ACCOUNTS, id);
    App.toast('Account deleted', 'warning');
    App.refreshPage();
  },

  // Render horizontal grid for Dashboard
  renderDashboardGrid() {
    const accounts = DB.getAll(DB.COLLECTIONS.ACCOUNTS);
    if (accounts.length === 0) {
      return `
        <div class="accounts-dashboard-empty" onclick="App.navigate('accounts')">
          <span style="font-size:32px">🏦</span>
          <p>Add your Bank, Wallet & Pocket accounts</p>
          <button class="btn btn-sm btn-outline">+ Add Account</button>
        </div>
      `;
    }

    return `
      <div class="accounts-horizontal-scroll">
        ${accounts.map(acc => {
          const preset = this.typePresets[acc.type] || this.typePresets.other;
          const stats = this._getAccountStats(acc.id);
          return `
            <div class="account-scroll-card" style="background:${preset.gradient}">
              <div class="account-scroll-header">
                <span class="account-scroll-icon">${preset.icon}</span>
                <span class="account-scroll-type">${preset.label}</span>
              </div>
              <div class="account-scroll-name">${Utils.escapeHtml(acc.name)}</div>
              <div class="account-scroll-balance">${Utils.formatCurrency(acc.balance)}</div>
              <div class="account-scroll-stats">
                <div>
                  <div class="account-scroll-stat-label">Income</div>
                  <div class="account-scroll-stat-value" style="color:#4ade80">${Utils.formatShortCurrency(stats.totalIncome)}</div>
                </div>
                <div>
                  <div class="account-scroll-stat-label">Expense</div>
                  <div class="account-scroll-stat-value" style="color:#f87171">${Utils.formatShortCurrency(stats.totalExpense)}</div>
                </div>
                <div>
                  <div class="account-scroll-stat-label">Net</div>
                  <div class="account-scroll-stat-value" style="color:${stats.net >= 0 ? '#4ade80' : '#f87171'}">${Utils.formatShortCurrency(stats.net)}</div>
                </div>
              </div>
            </div>
          `;
        }).join('')}
        <!-- Add Account Card -->
        <div class="account-scroll-card account-scroll-add" onclick="App.navigate('accounts')">
          <div style="font-size:32px;margin-bottom:8px">➕</div>
          <div style="font-size:0.85rem;font-weight:600">Add Account</div>
        </div>
      </div>
    `;
  }
};
