/* ==========================================
   VYAPAR PWA — TRANSACTIONS (INCOME & EXPENSE)
   ========================================== */

const Transactions = {
  currentType: 'all', // 'all', 'income', or 'expense'
  searchTerm: '',
  partyFilter: '',
  accountFilter: '', // NEW: Filter by account

  viewAccountLedger(accountId) {
    this.accountFilter = accountId;
    this.currentType = 'all'; // Reset to all
    this.searchTerm = ''; // Reset search
    this.partyFilter = ''; // Reset party filter
    App.navigate('transactions');
  },

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

    // Sort items within each date by sortOrder
    Object.keys(grouped).forEach(date => {
      grouped[date].sort((a, b) => {
        const orderA = a.sortOrder !== undefined ? a.sortOrder : 9999;
        const orderB = b.sortOrder !== undefined ? b.sortOrder : 9999;
        return orderA - orderB;
      });
    });

    const dates = Object.keys(grouped).sort((a, b) => new Date(b) - new Date(a));

    return dates.map(date => {
      const items = grouped[date];
      
      const dayIncomeAmount = items.filter(t => t.type === 'income').reduce((sum, t) => sum + Accounts.getItemAmount(t), 0);
      const dayExpenseAmount = items.filter(t => t.type === 'expense').reduce((sum, t) => sum + Accounts.getItemAmount(t), 0);
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
                  <th style="width:30px"></th>
                  <th>Item Name</th>
                  ${!isPartyLedger ? `<th>Party</th><th>Account</th><th class="text-right">Amount</th>` : ''}
                  <th class="text-right">Price</th>
                  <th>Notes</th>
                  <th class="text-right">Actions</th>
                </tr>
              </thead>
              <tbody data-date="${date}">
                ${items.map((t, idx) => {
                  const acc = DB.getById(DB.COLLECTIONS.ACCOUNTS, t.accountId);
                  const isInc = t.type === 'income';
                  return `
                    <tr data-id="${t.id}" data-type="${t.type}" data-idx="${idx}">
                      <td style="width:30px;padding:4px">
                        <span class="drag-handle" title="Drag to reorder">⋮⋮</span>
                      </td>
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
                      <td class="text-right" style="color:var(--accent-light)">${(t.price && parseFloat(t.price) > 0) ? Utils.formatCurrency(t.price) : '-'}</td>
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
    const includeHidden = !!(this.accountFilter || this.partyFilter);
    const allTrans = this.getAllTransactions(includeHidden); // Include hidden items for Account/Party ledgers
    let filtered = Utils.filterBySearch(allTrans, this.searchTerm, ['itemName', 'party', 'notes', 'accountName']);
    
    if (this.currentType === 'income' || this.currentType === 'expense') {
      filtered = filtered.filter(t => t.type === this.currentType);
    }
    if (this.partyFilter) {
      filtered = filtered.filter(t => t.party === this.partyFilter);
    }
    if (this.accountFilter) {
      filtered = Accounts.getAccountTransactions(this.accountFilter);
    }

    const totalIncome = allTrans.filter(t => t.type === 'income').reduce((sum, t) => sum + Accounts.getItemAmount(t), 0);
    const totalExpense = allTrans.filter(t => t.type === 'expense').reduce((sum, t) => sum + Accounts.getItemAmount(t), 0);
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
        <div class="toolbar-right flex gap-2">
          <button class="btn btn-outline btn-sm" onclick="App.undoLastAction()" title="Undo last action" style="color:var(--text-accent);border-color:var(--border);font-weight:700">
            ↩️ Undo
          </button>
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
          ${this.accountFilter ? `
            <button class="btn btn-outline btn-sm" onclick="Transactions.clearAccountFilter()" style="margin-left:8px">
              Clear Account Filter ✖
            </button>
          ` : ''}
        </div>
      </div>

      ${this.renderDateGroupCards(filtered)}
    `;
  },

  switchAllTab(type) {
    this.currentType = type;
    App.refreshPage();
  },

  clearAccountFilter() {
    this.accountFilter = '';
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
    if (this.accountFilter) {
      filtered = filtered.filter(t => t.accountId === this.accountFilter);
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
      <form id="transForm" autocomplete="off" onsubmit="Transactions.saveTransaction(event, '${type}', ${isEdit ? `'${record.id}'` : 'null'})">
        
        <!-- Row 1: Type & Amount -->
        <div style="display:flex; gap:12px; margin-bottom:12px">
          <div style="flex:1; background:var(--bg-glass); padding:8px; border-radius:var(--radius-sm)">
            <label class="form-label" style="margin-bottom:6px; font-size:0.75rem">Type</label>
            <div class="flex gap-1">
              <label id="lblTypeIncome" class="btn btn-outline ${isIncome ? 'btn-success active' : ''}" style="flex:1;padding:6px 0;font-size:0.8rem;justify-content:center">
                <input type="radio" name="transType" value="income" ${isIncome ? 'checked' : ''} onchange="Transactions.toggleFormType(this.value)" style="display:none">
                💵 Income
              </label>
              <label id="lblTypeExpense" class="btn btn-outline ${!isIncome ? 'btn-danger active' : ''}" style="flex:1;padding:6px 0;font-size:0.8rem;justify-content:center">
                <input type="radio" name="transType" value="expense" ${!isIncome ? 'checked' : ''} onchange="Transactions.toggleFormType(this.value)" style="display:none">
                💸 Expense
              </label>
            </div>
          </div>
          <div style="flex:1">
            <label class="form-label" style="margin-bottom:6px; font-size:0.75rem">Total Amount</label>
            <input type="number" class="form-input" name="amount" step="0.01" min="0" value="${isEdit ? record.amount : ''}" placeholder="0.00" style="font-size:1.4rem; font-weight:800; height:60px; padding:8px; color:var(--accent-light)">
          </div>
        </div>

        <!-- Row 2: Item Name & Price -->
        <div style="display:flex; gap:12px; margin-bottom:12px">
          <div style="flex:2">
            <label class="form-label" style="margin-bottom:6px; font-size:0.75rem">Item Name</label>
            <input type="text" class="form-input" name="itemName" autocomplete="off" value="${isEdit ? Utils.escapeHtml(record.itemName || '') : ''}" placeholder="e.g. Sales" style="height:38px; padding:4px 8px">
          </div>
          <div style="flex:1">
            <label class="form-label" style="margin-bottom:6px; font-size:0.75rem">Rate</label>
            <input type="number" class="form-input" name="price" step="0.01" min="0" value="${isEdit ? (record.price !== undefined && record.price !== null ? record.price : 0) : ''}" placeholder="0.00" style="height:38px; padding:4px 8px">
          </div>
        </div>

        <!-- Row 3: Party & Account -->
        <div style="display:flex; gap:12px; margin-bottom:12px">
          <div style="flex:1">
            <label class="form-label" style="margin-bottom:6px; font-size:0.75rem">Party Name</label>
            <select class="form-select" name="party" style="height:38px; padding:4px 8px">
              <option value="">-- Party --</option>
              ${parties.map(p => `
                <option value="${Utils.escapeHtml(p)}" ${partyVal === p ? 'selected' : ''}>
                  ${Utils.escapeHtml(p)}
                </option>
              `).join('')}
            </select>
          </div>
          <div style="flex:1">
            <label class="form-label" style="margin-bottom:6px; font-size:0.75rem">Account</label>
            <select class="form-select" name="accountId" style="height:38px; padding:4px 8px">
              <option value="">-- Account --</option>
              ${accounts.map(a => `<option value="${a.id}" ${isEdit && record.accountId === a.id ? 'selected' : ''}>${Utils.escapeHtml(a.name)}</option>`).join('')}
            </select>
          </div>
        </div>

        <!-- Row 4: Date & Notes -->
        <div style="display:flex; gap:12px; margin-bottom:12px">
          <div style="flex:1; max-width:130px">
            <label class="form-label" style="margin-bottom:6px; font-size:0.75rem">Date</label>
            <input type="date" class="form-input" name="date" value="${isEdit ? record.date : Utils.today()}" style="height:38px; padding:4px 8px">
          </div>
          <div style="flex:1">
            <label class="form-label" style="margin-bottom:6px; font-size:0.75rem">Notes</label>
            <input type="text" class="form-input" name="notes" placeholder="Any details..." value="${isEdit ? Utils.escapeHtml(record.notes || '') : ''}" style="height:38px; padding:4px 8px">
          </div>
        </div>

        <div style="background:rgba(255,255,255,0.03);padding:8px 12px;border-radius:var(--radius-sm);border:1px solid var(--border); margin-bottom:12px">
          <label class="flex items-center gap-2" style="cursor:pointer;font-size:0.8rem;margin:0">
            <input type="checkbox" name="isPartyOnly" value="true" ${isPartyOnlyDefault ? 'checked' : ''}>
            <span>🔒 Hide from Main Transactions (Party & Account Ledger Only)</span>
          </label>
        </div>

        <div class="modal-footer" style="padding:12px 0 0;border-top:1px solid var(--border); margin-top:0">
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
        date: form.get('date') || Utils.today(),
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
        date: form.get('date') || Utils.today(),
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
    
    let collection = type === 'income' ? DB.COLLECTIONS.INCOMES : DB.COLLECTIONS.EXPENSES;
    let record = DB.getById(collection, id);
    
    if (!record) {
      // Try alternate collection in case of type mismatch
      const altCollection = type === 'income' ? DB.COLLECTIONS.EXPENSES : DB.COLLECTIONS.INCOMES;
      record = DB.getById(altCollection, id);
      if (record) {
        collection = altCollection;
      }
    }

    if (!record) {
      App.toast('Entry not found', 'error');
      return;
    }

    const isIncome = collection === DB.COLLECTIONS.INCOMES;

    // Save to App.lastAction for Undo
    App.lastAction = {
      type: 'delete_transaction',
      data: {
        collection,
        record: JSON.parse(JSON.stringify(record))
      }
    };

    if (record.accountId) {
      const account = DB.getById(DB.COLLECTIONS.ACCOUNTS, record.accountId);
      if (account) {
        const revertChange = isIncome ? -Utils.parseNum(record.amount) : Utils.parseNum(record.amount);
        DB.update(DB.COLLECTIONS.ACCOUNTS, record.accountId, {
          balance: Utils.parseNum(account.balance) + revertChange
        });
      }
    }

    DB.delete(collection, id);
    App.toast(`Entry deleted. <button class="btn btn-sm btn-outline" onclick="App.undoLastAction()" style="margin-left:8px;padding:2px 8px;font-size:0.75rem;color:var(--accent-light)">↩️ Undo</button>`, 'warning', 6500);
    App.refreshPage();
  },

  // ========== DRAG & DROP REORDER ==========
  _dragState: null,

  initDragReorder() {
    const handles = document.querySelectorAll('.drag-handle');
    handles.forEach(handle => {
      handle.addEventListener('mousedown', (e) => this._startDrag(e, handle));
      handle.addEventListener('touchstart', (e) => this._startDrag(e, handle), { passive: false });
    });
  },

  _startDrag(e, handle) {
    e.preventDefault();
    e.stopPropagation();

    const row = handle.closest('tr');
    const tbody = row.closest('tbody');
    if (!row || !tbody) return;

    const rows = Array.from(tbody.querySelectorAll('tr[data-id]'));
    const startIdx = rows.indexOf(row);
    if (startIdx === -1) return;

    const touch = e.touches ? e.touches[0] : e;
    const rect = row.getBoundingClientRect();

    // Create ghost element
    const ghost = document.createElement('div');
    ghost.className = 'drag-ghost';
    ghost.textContent = row.querySelector('td:nth-child(2)')?.textContent?.trim() || 'Item';
    ghost.style.left = (touch.clientX + 10) + 'px';
    ghost.style.top = (touch.clientY - 15) + 'px';
    document.body.appendChild(ghost);

    row.classList.add('dragging');

    this._dragState = {
      row,
      tbody,
      rows,
      startIdx,
      ghost,
      currentOverRow: null,
      offsetY: touch.clientY - rect.top
    };

    const moveHandler = (ev) => this._onDragMove(ev);
    const endHandler = (ev) => {
      this._onDragEnd(ev);
      document.removeEventListener('mousemove', moveHandler);
      document.removeEventListener('mouseup', endHandler);
      document.removeEventListener('touchmove', moveHandler);
      document.removeEventListener('touchend', endHandler);
    };

    document.addEventListener('mousemove', moveHandler);
    document.addEventListener('mouseup', endHandler);
    document.addEventListener('touchmove', moveHandler, { passive: false });
    document.addEventListener('touchend', endHandler);
  },

  _onDragMove(e) {
    if (!this._dragState) return;
    e.preventDefault();

    const touch = e.touches ? e.touches[0] : e;
    const { ghost, rows, row } = this._dragState;

    ghost.style.left = (touch.clientX + 10) + 'px';
    ghost.style.top = (touch.clientY - 15) + 'px';

    // Clear all drag-over classes
    rows.forEach(r => {
      r.classList.remove('drag-over-top', 'drag-over-bottom');
    });

    // Find which row we're hovering over
    for (const r of rows) {
      if (r === row) continue;
      const rect = r.getBoundingClientRect();
      if (touch.clientY >= rect.top && touch.clientY <= rect.bottom) {
        const mid = rect.top + rect.height / 2;
        if (touch.clientY < mid) {
          r.classList.add('drag-over-top');
        } else {
          r.classList.add('drag-over-bottom');
        }
        this._dragState.currentOverRow = r;
        this._dragState.insertBefore = touch.clientY < mid;
        break;
      }
    }
  },

  _onDragEnd(e) {
    if (!this._dragState) return;

    const { row, tbody, rows, ghost, currentOverRow, insertBefore } = this._dragState;

    // Remove visual states
    row.classList.remove('dragging');
    rows.forEach(r => r.classList.remove('drag-over-top', 'drag-over-bottom'));
    if (ghost && ghost.parentNode) ghost.parentNode.removeChild(ghost);

    // If dropped on a different row, reorder
    if (currentOverRow && currentOverRow !== row) {
      if (insertBefore) {
        tbody.insertBefore(row, currentOverRow);
      } else {
        tbody.insertBefore(row, currentOverRow.nextSibling);
      }

      // Save new order to DB
      const reorderedRows = Array.from(tbody.querySelectorAll('tr[data-id]'));
      reorderedRows.forEach((r, idx) => {
        const id = r.getAttribute('data-id');
        const type = r.getAttribute('data-type');
        const collection = type === 'income' ? DB.COLLECTIONS.INCOMES : DB.COLLECTIONS.EXPENSES;
        DB.update(collection, id, { sortOrder: idx });
      });
    }

    this._dragState = null;
  }
};
