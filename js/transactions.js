/* ==========================================
   VYAPAR PWA — TRANSACTIONS (INCOME & EXPENSE)
   ========================================== */

const Transactions = {
  currentType: 'all', // 'all', 'income', or 'expense'
  searchTerm: '',
  partyFilter: '',

  getParties() {
    const parties = DB.getAll(DB.COLLECTIONS.PARTIES).map(p => p.name);
    const incParties = DB.getAll(DB.COLLECTIONS.INCOMES).map(i => i.party).filter(Boolean);
    const expParties = DB.getAll(DB.COLLECTIONS.EXPENSES).map(e => e.party).filter(Boolean);
    return [...new Set(parties.concat(incParties, expParties))].filter(p => p && p !== 'General');
  },

  getItemNames() {
    const incItems = DB.getAll(DB.COLLECTIONS.INCOMES).map(i => i.itemName).filter(Boolean);
    const expItems = DB.getAll(DB.COLLECTIONS.EXPENSES).map(e => e.itemName).filter(Boolean);
    return [...new Set(['Service', 'Product Sale', 'Office Rent', 'Electricity', 'Salary', ...incItems, ...expItems])];
  },

  getAllTransactions(includePartyOnly = false) {
    const incomes = DB.getAll(DB.COLLECTIONS.INCOMES).map(i => ({ ...i, type: 'income' }));
    const expenses = DB.getAll(DB.COLLECTIONS.EXPENSES).map(e => ({ ...e, type: 'expense' }));
    const all = [...incomes, ...expenses].sort((a, b) => new Date(b.date) - new Date(a.date) || (b.createdAt || '').localeCompare(a.createdAt || '') || 0);
    
    if (includePartyOnly) return all;
    return all.filter(t => !t.isPartyOnly);
  },

  formatPartyCell(partyName) {
    if (!partyName || partyName === 'General' || partyName.trim() === '') {
      return `<span class="text-muted">-</span>`;
    }
    return `<a href="#" onclick="event.preventDefault();App.navigate('parties');Parties.viewPartyLedger('${Utils.escapeHtml(partyName)}')" style="color:var(--accent-light);font-weight:600">${Utils.escapeHtml(partyName)}</a>`;
  },

  renderDateGroupCards(transactions, options = {}) {
    const isPartyLedger = options.isPartyLedger || false;

    if (transactions.length === 0) {
      return `
        <div class="empty-state">
          <div style="font-size:48px;margin-bottom:12px">🧾</div>
          <h3>No Transactions Found</h3>
          <p>Add your first income or expense transaction</p>
        </div>
      `;
    }

    // Group by Date
    const grouped = {};
    transactions.forEach(t => {
      const d = t.date || 'Unknown';
      if (!grouped[d]) grouped[d] = [];
      grouped[d].push(t);
    });

    const dates = Object.keys(grouped).sort((a, b) => new Date(b) - new Date(a));

    return dates.map(date => {
      const items = grouped[date];
      
      const dayIncomeAmount = items.filter(t => t.type === 'income').reduce((sum, t) => sum + Utils.parseNum(t.amount), 0);
      const dayExpenseAmount = items.filter(t => t.type === 'expense').reduce((sum, t) => sum + Utils.parseNum(t.amount), 0);
      const dayTotalAmount = dayIncomeAmount - dayExpenseAmount;

      const dayIncomePrice = items.filter(t => t.type === 'income').reduce((sum, t) => sum + Utils.parseNum(t.price || 0), 0);
      const dayExpensePrice = items.filter(t => t.type === 'expense').reduce((sum, t) => sum + Utils.parseNum(t.price || 0), 0);
      const dayTotalPrice = dayIncomePrice - dayExpensePrice;

      const dayProfitLoss = dayTotalAmount - dayTotalPrice;

      return `
        <div class="date-group-card">
          <div class="date-card-header">
            <div class="date-card-title">
              <span>📅 ${Utils.formatDate(date)}</span>
              <span class="badge badge-accent" style="font-size:0.75rem">${items.length} ${items.length === 1 ? 'entry' : 'entries'}</span>
            </div>
            <div class="date-card-stats">
              ${!isPartyLedger ? `
                <div class="date-stat-pill">
                  <span>Amount:</span>
                  <strong class="${dayTotalAmount >= 0 ? 'text-success' : 'text-danger'}">${Utils.formatCurrency(dayTotalAmount)}</strong>
                </div>
                <div class="date-stat-pill">
                  <span>Price:</span>
                  <strong style="color:var(--accent-light)">${Utils.formatCurrency(dayTotalPrice)}</strong>
                </div>
                <div class="date-stat-pill">
                  <span>Total:</span>
                  <strong class="${dayProfitLoss >= 0 ? 'text-success' : 'text-danger'}">${Utils.formatCurrency(dayProfitLoss)}</strong>
                </div>
              ` : `
                <div class="date-stat-pill">
                  <span>Day Price Total:</span>
                  <strong style="color:var(--accent-light)">${Utils.formatCurrency(dayTotalPrice)}</strong>
                </div>
              `}
            </div>
          </div>

          <div class="table-container" style="border:none;border-radius:0;box-shadow:none">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Item Name</th>
                  ${!isPartyLedger ? `<th>Party</th><th>Account</th><th class="text-right">Amount</th>` : ''}
                  <th class="text-right">Price (₹)</th>
                  <th>Notes</th>
                  <th class="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                ${items.map(t => {
                  const acc = DB.getById(DB.COLLECTIONS.ACCOUNTS, t.accountId);
                  const isInc = t.type === 'income';
                  return `
                    <tr>
                      <td>
                        ${Utils.escapeHtml(t.itemName || 'General Item')}
                        ${t.isPartyOnly ? `<span class="badge badge-accent" style="font-size:0.65rem;margin-left:4px" title="Visible only in Party Ledger">🔒 Party Only</span>` : ''}
                      </td>
                      ${!isPartyLedger ? `
                        <td>${this.formatPartyCell(t.party)}</td>
                        <td><span class="badge badge-accent">${Utils.escapeHtml(acc?.name || t.accountName || 'Cash')}</span></td>
                        <td class="text-right">
                          <span class="amount ${isInc ? 'credit' : 'debit'}">${isInc ? '+' : '-'}${Utils.formatCurrency(t.amount)}</span>
                        </td>
                      ` : ''}
                      <td class="text-right" style="color:var(--accent-light)">${Utils.formatCurrency(t.price || 0)}</td>
                      <td>${Utils.escapeHtml(t.notes || '-')}</td>
                      <td>
                        <div class="table-actions">
                          <button class="btn btn-ghost btn-icon" onclick="Transactions.openEditModal('${t.type}', '${t.id}')" title="Edit">${Utils.icons.edit}</button>
                          <button class="btn btn-ghost btn-icon" onclick="Transactions.deleteTransaction('${t.type}', '${t.id}')" title="Delete">${Utils.icons.trash}</button>
                        </div>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }).join('');
  },

  renderAll() {
    const allTrans = this.getAllTransactions(false); // Exclude party-only from main list
    let filtered = Utils.filterBySearch(allTrans, this.searchTerm, ['itemName', 'party', 'notes', 'accountName']);
    
    if (this.currentType === 'income' || this.currentType === 'expense') {
      filtered = filtered.filter(t => t.type === this.currentType);
    }
    if (this.partyFilter) {
      filtered = filtered.filter(t => t.party === this.partyFilter);
    }

    const totalIncome = allTrans.filter(t => t.type === 'income').reduce((sum, t) => sum + Utils.parseNum(t.amount), 0);
    const totalExpense = allTrans.filter(t => t.type === 'expense').reduce((sum, t) => sum + Utils.parseNum(t.amount), 0);
    const parties = this.getParties();

    return `
      <div class="stat-grid" style="margin-bottom:20px">
        <div class="stat-card profit">
          <div class="stat-label">Total Income</div>
          <div class="stat-value text-success">${Utils.formatCurrency(totalIncome)}</div>
        </div>
        <div class="stat-card due">
          <div class="stat-label">Total Expense</div>
          <div class="stat-value text-danger">${Utils.formatCurrency(totalExpense)}</div>
        </div>
        <div class="stat-card cash">
          <div class="stat-label">Net Balance</div>
          <div class="stat-value ${totalIncome >= totalExpense ? 'text-success' : 'text-danger'}">${Utils.formatCurrency(totalIncome - totalExpense)}</div>
        </div>
      </div>

      <div class="toolbar">
        <div class="toolbar-left">
          <div class="tabs" style="border:none;margin:0">
            <div class="tab ${this.currentType === 'all' ? 'active' : ''}" onclick="Transactions.switchAllTab('all')">
              All (${allTrans.length})
            </div>
            <div class="tab ${this.currentType === 'income' ? 'active' : ''}" onclick="Transactions.switchAllTab('income')">
              💵 Income (${allTrans.filter(t=>t.type==='income').length})
            </div>
            <div class="tab ${this.currentType === 'expense' ? 'active' : ''}" onclick="Transactions.switchAllTab('expense')">
              💸 Expense (${allTrans.filter(t=>t.type==='expense').length})
            </div>
          </div>
        </div>
        <div class="toolbar-right">
          <button class="btn btn-success btn-sm" onclick="Transactions.openAddModal('income')">
            + Income
          </button>
          <button class="btn btn-danger btn-sm" onclick="Transactions.openAddModal('expense')">
            + Expense
          </button>
        </div>
      </div>

      <div class="toolbar mb-2">
        <div class="toolbar-left">
          <div class="search-bar" style="flex:1;max-width:260px">
            ${Utils.icons.search}
            <input type="text" placeholder="Search item, party, notes..." value="${this.searchTerm}" 
                   oninput="Transactions.search(this.value)">
          </div>
          <select class="form-select" style="max-width:160px" onchange="Transactions.filterParty(this.value)">
            <option value="">All Parties</option>
            ${parties.map(p => `<option value="${p}" ${p === this.partyFilter ? 'selected' : ''}>${p}</option>`).join('')}
          </select>
        </div>
      </div>

      ${this.renderDateGroupCards(filtered)}
    `;
  },

  switchAllTab(type) {
    this.currentType = type;
    App.refreshPage();
  },

  renderRecentDashboardRows(count = 4) {
    let allTrans = this.getAllTransactions(false);
    if (count > 0) {
      allTrans = allTrans.slice(0, count);
    }
    return this.renderDateGroupCards(allTrans);
  },

  render(type = 'income') {
    this.currentType = type;
    const isIncome = type === 'income';
    const collection = isIncome ? DB.COLLECTIONS.INCOMES : DB.COLLECTIONS.EXPENSES;
    const transactions = DB.getAll(collection).filter(t => !t.isPartyOnly);

    let filtered = Utils.filterBySearch(transactions, this.searchTerm, ['itemName', 'party', 'notes', 'accountName']);
    if (this.partyFilter) {
      filtered = filtered.filter(t => t.party === this.partyFilter);
    }
    filtered.reverse();

    const totalAmount = transactions.reduce((sum, t) => sum + Utils.parseNum(t.amount), 0);
    const parties = this.getParties();

    return `
      <div class="stat-grid" style="margin-bottom:20px">
        <div class="stat-card ${isIncome ? 'profit' : 'due'}">
          <div class="stat-label">Total ${isIncome ? 'Income' : 'Expense'}</div>
          <div class="stat-value ${isIncome ? 'text-success' : 'text-danger'}">${Utils.formatCurrency(totalAmount)}</div>
          <div class="stat-change">${transactions.length} entries recorded</div>
        </div>
      </div>

      <div class="toolbar">
        <div class="toolbar-left">
          <div class="search-bar" style="flex:1;max-width:260px">
            ${Utils.icons.search}
            <input type="text" placeholder="Search ${type}..." value="${this.searchTerm}" 
                   oninput="Transactions.search(this.value)">
          </div>
          <select class="form-select" style="max-width:160px" onchange="Transactions.filterParty(this.value)">
            <option value="">All Parties</option>
            ${parties.map(p => `<option value="${p}" ${p === this.partyFilter ? 'selected' : ''}>${p}</option>`).join('')}
          </select>
        </div>
        <div class="toolbar-right">
          <button class="btn ${isIncome ? 'btn-success' : 'btn-danger'}" onclick="Transactions.openAddModal('${type}')">
            ${Utils.icons.plus} Add ${isIncome ? 'Income' : 'Expense'}
          </button>
        </div>
      </div>

      ${this.renderDateGroupCards(filtered)}
    `;
  },

  search(term) {
    this.searchTerm = term;
    App.refreshPage();
  },

  filterParty(party) {
    this.partyFilter = party;
    App.refreshPage();
  },

  openAddModal(type = 'income', presetParty = '') {
    this.openModal(type, null, presetParty);
  },

  openEditModal(type, id) {
    let collection = type === 'income' ? DB.COLLECTIONS.INCOMES : DB.COLLECTIONS.EXPENSES;
    let record = DB.getById(collection, id);

    // Fallback search if type mismatch
    if (!record) {
      const altCollection = type === 'income' ? DB.COLLECTIONS.EXPENSES : DB.COLLECTIONS.INCOMES;
      record = DB.getById(altCollection, id);
      if (record) {
        type = type === 'income' ? 'expense' : 'income';
      }
    }

    if (!record) {
      App.toast('Entry not found', 'error');
      return;
    }
    this.openModal(type, record);
  },

  toggleFormType(newType) {
    const submitBtn = document.getElementById('transSubmitBtn');
    const incomeLabel = document.getElementById('lblTypeIncome');
    const expenseLabel = document.getElementById('lblTypeExpense');

    if (newType === 'income') {
      if (incomeLabel) incomeLabel.className = 'btn btn-outline btn-success active';
      if (expenseLabel) expenseLabel.className = 'btn btn-outline';
      if (submitBtn) {
        submitBtn.className = 'btn btn-success';
        submitBtn.textContent = '💵 Save Income';
      }
    } else {
      if (incomeLabel) incomeLabel.className = 'btn btn-outline';
      if (expenseLabel) expenseLabel.className = 'btn btn-outline btn-danger active';
      if (submitBtn) {
        submitBtn.className = 'btn btn-danger';
        submitBtn.textContent = '💸 Save Expense';
      }
    }
  },

  openModal(type = 'income', record = null, presetParty = '') {
    const isEdit = record !== null;
    const isIncome = type === 'income';
    const accounts = DB.getAll(DB.COLLECTIONS.ACCOUNTS);
    const parties = this.getParties();
    const itemSuggestions = this.getItemNames();
    const partyVal = isEdit ? (record.party || '') : presetParty;
    const isPartyOnlyDefault = isEdit ? (record.isPartyOnly || false) : (presetParty ? true : false);

    App.showModal(
      isEdit ? '✏️ Modify Transaction' : (isIncome ? '💵 Add Income' : '💸 Add Expense'),
      `
      <form id="transForm" onsubmit="Transactions.saveTransaction(event, '${type}', ${isEdit ? `'${record.id}'` : 'null'})">
        
        <!-- Transaction Type Switcher -->
        <div class="form-group mb-2" style="background:var(--bg-glass);padding:10px;border-radius:var(--radius-sm)">
          <label class="form-label" style="font-weight:700">Type (Income / Expense)</label>
          <div class="flex gap-1" style="margin-top:6px">
            <label id="lblTypeIncome" class="btn btn-outline ${isIncome ? 'btn-success active' : ''}" style="flex:1;cursor:pointer;justify-content:center;padding:8px">
              <input type="radio" name="transType" value="income" ${isIncome ? 'checked' : ''} onchange="Transactions.toggleFormType(this.value)" style="display:none">
              💵 Income
            </label>
            <label id="lblTypeExpense" class="btn btn-outline ${!isIncome ? 'btn-danger active' : ''}" style="flex:1;cursor:pointer;justify-content:center;padding:8px">
              <input type="radio" name="transType" value="expense" ${!isIncome ? 'checked' : ''} onchange="Transactions.toggleFormType(this.value)" style="display:none">
              💸 Expense
            </label>
          </div>
        </div>

        <div class="form-group mb-2" style="background:rgba(255,255,255,0.03);padding:8px 12px;border-radius:var(--radius-sm);border:1px solid var(--border)">
          <label class="flex items-center gap-2" style="cursor:pointer;font-size:0.88rem;margin:0">
            <input type="checkbox" name="isPartyOnly" value="true" ${isPartyOnlyDefault ? 'checked' : ''}>
            <span>🔒 <strong>Hide from Main Transactions</strong> (Show only in Party Ledger)</span>
          </label>
        </div>

        <div class="form-group">
          <label class="form-label">Item Name (Optional)</label>
          <input type="text" class="form-input" name="itemName" list="itemListOptions" value="${isEdit ? Utils.escapeHtml(record.itemName || '') : ''}" placeholder="Optional (e.g. Laptop Sale, General Item)">
          <datalist id="itemListOptions">
            ${itemSuggestions.map(i => `<option value="${i}">`).join('')}
          </datalist>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Total Amount (₹) (Optional)</label>
            <input type="number" class="form-input" name="amount" step="0.01" min="0" value="${isEdit ? record.amount : ''}" placeholder="0.00" style="font-size:1.2rem;font-weight:700">
          </div>
          <div class="form-group">
            <label class="form-label">Item Price / Rate (₹) (Optional)</label>
            <input type="number" class="form-input" name="price" step="0.01" min="0" value="${isEdit ? (record.price !== undefined && record.price !== null ? record.price : 0) : ''}" placeholder="0.00" style="font-size:1.2rem;font-weight:700">
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Party Name (Optional)</label>
            <select class="form-select" name="party">
              <option value="">-- Select Available Party (Optional) --</option>
              ${parties.map(p => `
                <option value="${Utils.escapeHtml(p)}" ${partyVal === p ? 'selected' : ''}>
                  ${Utils.escapeHtml(p)}
                </option>
              `).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Date *</label>
            <input type="date" class="form-input" name="date" value="${isEdit ? record.date : Utils.today()}" required>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Account (Optional)</label>
          <select class="form-select" name="accountId">
            <option value="">Select Account (Optional for Party Pending Items)</option>
            ${accounts.map(a => `<option value="${a.id}" ${isEdit && record.accountId === a.id ? 'selected' : ''}>${Utils.escapeHtml(a.name)} (${Utils.formatCurrency(a.balance)})</option>`).join('')}
          </select>
        </div>

        <div class="form-group">
          <label class="form-label">Notes / Description</label>
          <textarea class="form-textarea" name="notes" rows="2" placeholder="Optional details...">${isEdit ? Utils.escapeHtml(record.notes || '') : ''}</textarea>
        </div>

        <div class="modal-footer" style="padding:16px 0 0;border-top:1px solid var(--border)">
          <button type="button" class="btn btn-outline" onclick="App.closeModal()">Cancel</button>
          <button type="submit" id="transSubmitBtn" class="btn ${isIncome ? 'btn-success' : 'btn-danger'}">${isEdit ? 'Save Changes' : (isIncome ? '💵 Save Income' : '💸 Save Expense')}</button>
        </div>
      </form>
    `);
  },

  saveTransaction(e, originalType, existingId = null) {
    e.preventDefault();
    const form = new FormData(e.target);
    
    // Selected type from form radio button
    const chosenType = form.get('transType') || originalType;
    const isNewIncome = chosenType === 'income';
    const targetCollection = isNewIncome ? DB.COLLECTIONS.INCOMES : DB.COLLECTIONS.EXPENSES;

    const rawAccount = form.get('accountId');
    const defaultAccounts = DB.getAll(DB.COLLECTIONS.ACCOUNTS);
    const accountId = rawAccount && rawAccount.trim() !== '' ? rawAccount : (defaultAccounts[0] ? defaultAccounts[0].id : '');

    const rawPrice = form.get('price');
    const price = rawPrice !== null && rawPrice.trim() !== '' ? (parseFloat(rawPrice) || 0) : 0;

    const rawAmount = form.get('amount');
    const amount = rawAmount !== null && rawAmount.trim() !== '' ? (parseFloat(rawAmount) || price) : price;

    const rawItem = form.get('itemName');
    const itemName = rawItem && rawItem.trim() !== '' ? rawItem.trim() : 'General Item';

    const rawParty = form.get('party');
    const partyName = rawParty && rawParty.trim() !== '' ? rawParty.trim() : 'General';
    const isPartyOnly = form.get('isPartyOnly') === 'true';
    const account = accountId ? DB.getById(DB.COLLECTIONS.ACCOUNTS, accountId) : null;

    // Auto-create party record if it doesn't exist
    if (partyName && partyName !== 'General') {
      const existingParties = DB.getAll(DB.COLLECTIONS.PARTIES);
      const exists = existingParties.some(p => p.name.toLowerCase() === partyName.toLowerCase());
      if (!exists) {
        DB.add(DB.COLLECTIONS.PARTIES, { name: partyName, type: isNewIncome ? 'customer' : 'supplier', phone: '', notes: '' });
      }
    }

    if (existingId) {
      const isOriginalIncome = originalType === 'income';
      const originalCollection = isOriginalIncome ? DB.COLLECTIONS.INCOMES : DB.COLLECTIONS.EXPENSES;
      const oldRecord = DB.getById(originalCollection, existingId);

      // Revert old account balance
      if (oldRecord && oldRecord.accountId) {
        const oldAccount = DB.getById(DB.COLLECTIONS.ACCOUNTS, oldRecord.accountId);
        if (oldAccount) {
          const revertChange = isOriginalIncome ? -Utils.parseNum(oldRecord.amount) : Utils.parseNum(oldRecord.amount);
          DB.update(DB.COLLECTIONS.ACCOUNTS, oldRecord.accountId, {
            balance: Utils.parseNum(oldAccount.balance) + revertChange
          });
        }
      }

      const updatedData = {
        itemName,
        amount,
        price,
        date: form.get('date'),
        party: partyName,
        accountId,
        accountName: account ? account.name : 'Cash',
        notes: form.get('notes'),
        isPartyOnly
      };

      if (chosenType !== originalType) {
        // Type switched! Remove from old collection and add to new collection
        DB.delete(originalCollection, existingId);
        DB.add(targetCollection, updatedData);
      } else {
        // Same type, just update existing record
        DB.update(targetCollection, existingId, updatedData);
      }

      // Apply new balance to target account
      const updatedAccount = DB.getById(DB.COLLECTIONS.ACCOUNTS, accountId);
      if (updatedAccount) {
        const applyChange = isNewIncome ? amount : -amount;
        DB.update(DB.COLLECTIONS.ACCOUNTS, accountId, {
          balance: Utils.parseNum(updatedAccount.balance) + applyChange
        });
      }

      App.toast(`Entry updated as ${isNewIncome ? 'Income 💵' : 'Expense 💸'}!`, 'success');
    } else {
      // Add brand new record
      const record = {
        itemName,
        amount,
        price,
        date: form.get('date'),
        party: partyName,
        accountId,
        accountName: account ? account.name : 'Cash',
        notes: form.get('notes'),
        isPartyOnly
      };
      DB.add(targetCollection, record);

      // Update account balance
      if (account) {
        const balanceChange = isNewIncome ? amount : -amount;
        DB.update(DB.COLLECTIONS.ACCOUNTS, accountId, {
          balance: Utils.parseNum(account.balance) + balanceChange
        });
      }

      App.toast(isNewIncome ? 'Income added! 💵' : 'Expense added! 💸', 'success');
    }

    App.closeModal();
    App.refreshPage();
  },

  deleteTransaction(type, id) {
    if (!confirm('Delete this entry?')) return;
    const isIncome = type === 'income';
    const collection = isIncome ? DB.COLLECTIONS.INCOMES : DB.COLLECTIONS.EXPENSES;
    
    const record = DB.getById(collection, id);
    if (record && record.accountId) {
      const account = DB.getById(DB.COLLECTIONS.ACCOUNTS, record.accountId);
      if (account) {
        const revertChange = isIncome ? -Utils.parseNum(record.amount) : Utils.parseNum(record.amount);
        DB.update(DB.COLLECTIONS.ACCOUNTS, record.accountId, {
          balance: Utils.parseNum(account.balance) + revertChange
        });
      }
    }

    DB.delete(collection, id);
    App.toast('Entry deleted', 'warning');
    App.refreshPage();
  }
};
