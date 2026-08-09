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



  syncAccountBalances() {
    const accounts = DB.getAll(DB.COLLECTIONS.ACCOUNTS);
    const updatedAccounts = accounts.map(acc => {
      return {
        ...acc,
        balance: Calculations.getAccountBalance(acc.id)
      };
    });

    localStorage.setItem(DB.COLLECTIONS.ACCOUNTS, JSON.stringify(updatedAccounts));
    return updatedAccounts;
  },

  render() {
    this.syncAccountBalances();
    const accounts = DB.getAll(DB.COLLECTIONS.ACCOUNTS);
    const filtered = Utils.filterBySearch(accounts, this.searchTerm, ['name', 'type', 'bankName']);

    const totalBalance = accounts.reduce((sum, a) => sum + Utils.parseNum(a.balance), 0);

    return `


      <div class="toolbar">
        <div class="toolbar-left">
          <div class="search-bar" style="flex:1;max-width:300px">
            ${Utils.icons.search}
            <input type="text" placeholder="Search accounts..." value="${this.searchTerm}" 
                   oninput="Accounts.search(this.value)">
          </div>
        </div>
        <div class="toolbar-right flex gap-2">
          <button class="btn btn-outline btn-sm" onclick="App.undoLastAction()" title="Undo last action" style="color:var(--text-accent);border-color:var(--border);font-weight:700">
            ↩️ Undo
          </button>
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
              <div class="account-card" style="background:${preset.gradient};cursor:pointer" onclick="Transactions.viewAccountLedger('${acc.id}')">
                <div class="account-card-header">
                  <div class="account-card-icon">${preset.icon}</div>
                  <div class="account-card-actions">
                    <button class="btn btn-ghost btn-icon" style="color:rgba(255,255,255,0.7)" onclick="event.stopPropagation(); Accounts.openEditAccount('${acc.id}')" title="Edit">${Utils.icons.edit}</button>
                    <button class="btn btn-ghost btn-icon" style="color:rgba(255,255,255,0.7)" onclick="event.stopPropagation(); Accounts.deleteAccount('${acc.id}')" title="Delete">${Utils.icons.trash}</button>
                  </div>
                </div>
                <div class="account-card-name">${Utils.escapeHtml(acc.name)}</div>
                <div class="account-card-type">${preset.label}${acc.bankName ? ' • ' + Utils.escapeHtml(acc.bankName) : ''}</div>
                <div class="account-card-balance">${Utils.formatCurrency(acc.balance)}</div>

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
                          <div class="font-bold">
                            ${Utils.escapeHtml(acc.name)}
                            ${acc.isPersonal ? '<span title="Personal Account (Excluded from Dashboard)" style="font-size:0.8rem">🔒</span>' : ''}
                          </div>
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
    const trans = Calculations.getAccountTransactions(accountId);
    
    let totalIncome = 0;
    let totalExpense = 0;

    trans.forEach(t => {
      const details = Calculations.getAccountDetails(t, accountId);
      if (details.type === 'income') totalIncome += details.amount;
      else if (details.type === 'expense') totalExpense += details.amount;
    });

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
      <form id="accountForm" autocomplete="off" onsubmit="Accounts.saveAccount(event, ${isEdit ? `'${acc.id}'` : 'null'})">
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
            <label class="form-label">Opening Balance</label>
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
        <div class="form-group" style="background:var(--bg-glass); padding:12px; border-radius:var(--radius-sm); border:1px solid var(--border-light);">
          <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
            <input type="checkbox" name="isPersonal" value="true" ${isEdit && acc.isPersonal ? 'checked' : ''} style="width:16px; height:16px; accent-color:var(--accent);">
            <span style="font-weight:600; color:var(--text-secondary)">Personal Account (Exclude from Dashboard)</span>
          </label>
          <div class="form-helper" style="margin-left:24px;">Transactions involving this account will NOT affect the main daily Profit/Loss.</div>
        </div>
        <div class="form-group" style="background:var(--bg-glass); padding:12px; border-radius:var(--radius-sm); border:1px solid var(--border-light); margin-top:8px;">
          <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
            <input type="checkbox" name="isPendingAccount" value="true" ${isEdit && acc.isPendingAccount ? 'checked' : ''} style="width:16px; height:16px; accent-color:var(--accent);">
            <span style="font-weight:600; color:var(--text-secondary)">Pending/Udhaar Account</span>
          </label>
          <div class="form-helper" style="margin-left:24px;">Enable "Clear Payment" feature for transactions in this account to manage dues.</div>
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
      notes: form.get('notes'),
      isPersonal: form.get('isPersonal') === 'true',
      isPendingAccount: form.get('isPendingAccount') === 'true'
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
    this.syncAccountBalances();
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
            <div class="account-scroll-card minimal-card" style="background:${preset.gradient};cursor:pointer" onclick="Transactions.viewAccountLedger('${acc.id}')">
              <div class="account-scroll-name">${Utils.escapeHtml(acc.name)}</div>
              <div class="account-scroll-balance">${Utils.formatCurrency(acc.balance)}</div>
            </div>
          `;
        }).join('')}
        <!-- Add Account Card -->
        <div class="account-scroll-card account-scroll-add minimal-card" onclick="App.navigate('accounts')" style="justify-content:center; align-items:center;">
          <div style="font-size:1.1rem;font-weight:600;opacity:0.9;">+ Add Account</div>
        </div>
      </div>
    `;
  },

  openClearanceModal(id, type) {
    const collection = type === 'income' ? DB.COLLECTIONS.INCOMES : DB.COLLECTIONS.EXPENSES;
    const record = DB.getById(collection, id);
    if (!record) {
      App.toast('Transaction not found', 'error');
      return;
    }
    
    // Get non-pending accounts for destination selection
    const accounts = DB.getAll(DB.COLLECTIONS.ACCOUNTS).filter(a => !a.isPendingAccount);
    
    const html = `
      <div style="padding:16px;">
        <p style="margin-bottom:16px; color:var(--text-secondary);">
          You are clearing: <strong>${Utils.escapeHtml(record.itemName || 'Item')}</strong><br>
          Amount: <strong class="${type === 'income' ? 'text-success' : 'text-danger'}">${Utils.formatCurrency(record.amount)}</strong>
        </p>
        
        <div class="form-group">
          <label class="form-label">Payment Date (Today by default)</label>
          <input type="date" id="clearanceDate" class="form-input" value="${Utils.today()}" required>
        </div>
        
        <div class="form-group">
          <label class="form-label">Destination Account (Bank/Wallet) *</label>
          <select id="clearanceAccount" class="form-select" required>
            <option value="">-- Select Receiving Account --</option>
            ${accounts.map(a => `<option value="${a.id}">${Utils.escapeHtml(a.name)} (${Utils.formatCurrency(a.balance)})</option>`).join('')}
          </select>
        </div>
        
        <div class="modal-footer" style="margin-top:24px; padding-top:16px; border-top:1px solid var(--border);">
          <button type="button" class="btn btn-outline" onclick="App.closeModal()">Cancel</button>
          <button type="button" class="btn btn-success" onclick="Accounts.processClearance('${id}', '${type}')">✅ Clear Payment</button>
        </div>
      </div>
    `;
    App.showModal('Clear Payment', html);
  },

  processClearance(id, type) {
    const collection = type === 'income' ? DB.COLLECTIONS.INCOMES : DB.COLLECTIONS.EXPENSES;
    const record = DB.getById(collection, id);
    if (!record) return;

    const dateInput = document.getElementById('clearanceDate').value;
    const accountId = document.getElementById('clearanceAccount').value;

    if (!accountId) {
      App.toast('Please select a destination account', 'error');
      return;
    }

    const destAccount = DB.getById(DB.COLLECTIONS.ACCOUNTS, accountId);
    if (!destAccount) {
      App.toast('Invalid destination account', 'error');
      return;
    }

    // 1. Mark original entry as cleared for pending account (avoiding party status conflict)
    DB.update(collection, id, { pendingStatus: 'cleared' });

    // 2. Create a new entry for the clearance on the new date
    const pendingAccountId = record.accounts && record.accounts.length > 0 ? record.accounts[0].accountId : record.accountId;
    const pendingAccountName = record.accounts && record.accounts.length > 0 ? record.accounts[0].accountName : record.accountName;

    const newEntry = {
      type: record.type,
      itemName: record.itemName || 'Item',
      amount: record.amount,
      price: record.price,
      date: dateInput || Utils.today(),
      party: record.party,
      parties: record.parties,
      accounts: [
        {
          accountId: destAccount.id,
          accountName: destAccount.name,
          amount: record.amount,
          type: record.type // income/expense to Bank
        },
        {
          accountId: pendingAccountId,
          accountName: pendingAccountName,
          amount: record.amount,
          type: record.type === 'income' ? 'expense' : 'income' // Offset the pending account
        }
      ],
      notes: 'Clear Pending',
      isPartyOnly: false, // Show in main revenue
      status: 'cleared_receipt',
      isClearanceReceipt: true // To hide from Pending Account ledger UI
    };

    const addedEntry = DB.add(collection, newEntry);

    // 3. Update BOTH account balances
    const change = newEntry.type === 'income' ? newEntry.amount : -newEntry.amount;
    
    // Add to bank
    DB.update(DB.COLLECTIONS.ACCOUNTS, destAccount.id, {
      balance: Utils.parseNum(destAccount.balance) + change
    });
    
    // Subtract from pending account
    const pendingAccObj = DB.getById(DB.COLLECTIONS.ACCOUNTS, pendingAccountId);
    if (pendingAccObj) {
      DB.update(DB.COLLECTIONS.ACCOUNTS, pendingAccountId, {
        balance: Utils.parseNum(pendingAccObj.balance) - change
      });
    }

    App.lastAction = {
      type: 'revert_account_clearance',
      data: {
        collection,
        originalId: id,
        newEntryId: addedEntry.id,
        destAccountId: destAccount.id,
        pendingAccountId: pendingAccountId,
        amount: record.amount,
        type: newEntry.type
      }
    };

    App.toast('Payment Cleared Successfully! ✅', 'success');
    App.closeModal();
    App.refreshPage();
  }
};
