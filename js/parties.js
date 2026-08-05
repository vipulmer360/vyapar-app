/* ==========================================
   VYAPAR PWA — PARTIES & PARTY LEDGER MODULE
   ========================================== */

const Parties = {
  searchTerm: '',
  activeLedgerParty: null,
  activeSubTab: 'pending', // 'pending' or 'cleared'

  render() {
    if (this.activeLedgerParty) {
      return this._renderPartyLedger(this.activeLedgerParty);
    }
    return this._renderPartyList();
  },

  _getAllPartyNames() {
    const dbParties = DB.getAll(DB.COLLECTIONS.PARTIES).map(p => p.name);
    const incParties = DB.getAll(DB.COLLECTIONS.INCOMES).map(i => i.party).filter(Boolean);
    const expParties = DB.getAll(DB.COLLECTIONS.EXPENSES).map(e => e.party).filter(Boolean);
    return [...new Set([...dbParties, ...incParties, ...expParties])].filter(name => name && name !== 'General');
  },

  _getPartyStats(partyName) {
    const incomes = DB.getAll(DB.COLLECTIONS.INCOMES).filter(i => i.party === partyName);
    const expenses = DB.getAll(DB.COLLECTIONS.EXPENSES).filter(e => e.party === partyName);

    const pendingIncomes = incomes.filter(i => i.status !== 'cleared' && !i.isSettlement);
    const pendingExpenses = expenses.filter(e => e.status !== 'cleared' && !e.isSettlement);

    const totalIncomePrice = pendingIncomes.reduce((sum, i) => sum + Utils.parseNum(i.price || i.amount || 0), 0);
    const totalExpensePrice = pendingExpenses.reduce((sum, e) => sum + Utils.parseNum(e.price || e.amount || 0), 0);
    const pendingTotalPrice = totalExpensePrice > 0 ? totalExpensePrice : totalIncomePrice;

    // Cleared individual items (exclude settlement summary records)
    const clearedIncomes = incomes.filter(i => i.status === 'cleared' && !i.isSettlement);
    const clearedExpenses = expenses.filter(e => e.status === 'cleared' && !e.isSettlement);
    const clearedItems = [...clearedIncomes, ...clearedExpenses];
    const totalClearedPaid = clearedItems.reduce((sum, item) => sum + Utils.parseNum(item.price || item.amount), 0);

    return {
      totalIncome: totalIncomePrice,
      totalExpense: totalExpensePrice,
      net: totalIncomePrice - totalExpensePrice,
      totalPrice: pendingTotalPrice,
      totalClearedPaid,
      pendingCount: pendingIncomes.length + pendingExpenses.length,
      clearedCount: clearedItems.length,
      totalEntries: incomes.length + expenses.length
    };
  },

  _renderPartyList() {
    const partyNames = this._getAllPartyNames();
    const filteredNames = Utils.filterBySearch(
      partyNames.map(name => ({ name, ...this._getPartyStats(name) })),
      this.searchTerm,
      ['name']
    );

    const grandIncome = partyNames.reduce((sum, p) => sum + this._getPartyStats(p).totalIncome, 0);
    const grandExpense = partyNames.reduce((sum, p) => sum + this._getPartyStats(p).totalExpense, 0);

    return `
      <div class="stat-grid" style="margin-bottom:20px">
        <div class="stat-card cash">
          <div class="stat-label">Total Parties</div>
          <div class="stat-value text-accent">${partyNames.length}</div>
        </div>
        <div class="stat-card profit">
          <div class="stat-label">Parties Total Income</div>
          <div class="stat-value text-success">${Utils.formatCurrency(grandIncome)}</div>
        </div>
        <div class="stat-card due">
          <div class="stat-label">Parties Total Due</div>
          <div class="stat-value text-danger">${Utils.formatCurrency(grandExpense)}</div>
        </div>
      </div>

      <div class="toolbar">
        <div class="toolbar-left">
          <div class="search-bar" style="flex:1;max-width:300px">
            ${Utils.icons.search}
            <input type="text" placeholder="Search party name..." value="${this.searchTerm}" 
                   oninput="Parties.search(this.value)">
          </div>
        </div>
        <div class="toolbar-right">
          <button class="btn btn-primary" onclick="Parties.openAddParty()">
            ${Utils.icons.plus} Add New Party
          </button>
        </div>
      </div>

      ${filteredNames.length === 0 ? `
        <div class="empty-state">
          <div style="font-size:36px;margin-bottom:8px">👥</div>
          <h3>No Parties Found</h3>
          <p style="margin:0">Add a party or create income/expense transactions with party names</p>
        </div>
      ` : `
        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Party Name</th>
                <th class="text-center">Pending Items</th>
                <th class="text-right">Total Pending Due</th>
                <th class="text-right">Total Paid Cleared</th>
                <th class="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${filteredNames.map(p => `
                <tr onclick="Parties.viewPartyLedger('${Utils.escapeHtml(p.name)}')" style="cursor:pointer">
                  <td>
                    <div class="flex items-center gap-1">
                      <div class="avatar customer">${Utils.getInitials(p.name)}</div>
                      <strong class="text-accent">${Utils.escapeHtml(p.name)}</strong>
                    </div>
                  </td>
                  <td class="text-center"><span class="badge badge-accent">${p.pendingCount} pending</span></td>
                  <td class="text-right"><span class="amount debit font-bold">${Utils.formatCurrency(p.totalPrice)}</span></td>
                  <td class="text-right"><span class="amount credit font-bold">${Utils.formatCurrency(p.totalClearedPaid)}</span></td>
                  <td>
                    <div class="table-actions">
                      <button class="btn btn-outline btn-sm" onclick="event.stopPropagation();Parties.viewPartyLedger('${Utils.escapeHtml(p.name)}')">
                        📖 View Ledger
                      </button>
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

  _renderPartyLedger(partyName) {
    const stats = this._getPartyStats(partyName);
    const incomes = DB.getAll(DB.COLLECTIONS.INCOMES).filter(i => i.party === partyName).map(i => ({ ...i, type: 'income' }));
    const expenses = DB.getAll(DB.COLLECTIONS.EXPENSES).filter(e => e.party === partyName).map(e => ({ ...e, type: 'expense' }));
    
    const pendingIncomes = incomes.filter(i => i.status !== 'cleared' && !i.isSettlement);
    const pendingExpenses = expenses.filter(e => e.status !== 'cleared' && !e.isSettlement);
    const pendingTrans = [...pendingIncomes, ...pendingExpenses].sort((a, b) => new Date(b.date) - new Date(a.date) || (b.createdAt || '').localeCompare(a.createdAt || '') || 0);

    const clearedIncomes = incomes.filter(i => i.status === 'cleared' && !i.isSettlement);
    const clearedExpenses = expenses.filter(e => e.status === 'cleared' && !e.isSettlement);
    const clearedItems = [...clearedIncomes, ...clearedExpenses].sort((a, b) => new Date(b.clearedAt || b.date) - new Date(a.clearedAt || a.date) || (b.createdAt || '').localeCompare(a.createdAt || '') || 0);

    const accounts = DB.getAll(DB.COLLECTIONS.ACCOUNTS);

    return `
      <div class="toolbar" style="margin-bottom:16px">
        <div class="toolbar-left">
          <button class="btn btn-outline" onclick="Parties.closeLedger()">
            ⬅️ Back to All Parties
          </button>
          <h2 style="font-size:1.2rem;font-weight:700;margin-left:12px">👤 Party Ledger: ${Utils.escapeHtml(partyName)}</h2>
        </div>
        <div class="toolbar-right flex gap-2 items-center">
          <div style="font-size:1.05rem;font-weight:700;padding:6px 14px;background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-sm);display:flex;align-items:center;gap:6px">
            <span>Pending Due Total:</span>
            <strong class="text-danger">${Utils.formatCurrency(stats.totalPrice)}</strong>
          </div>
          <button class="btn btn-success btn-sm" onclick="Transactions.openAddModal('income', '${Utils.escapeHtml(partyName)}')">
            + Income Entry
          </button>
          <button class="btn btn-danger btn-sm" onclick="Transactions.openAddModal('expense', '${Utils.escapeHtml(partyName)}')">
            + Due Expense Item
          </button>
        </div>
      </div>

      <!-- Sub Tabs: Pending Bills vs Cleared Ledger -->
      <div class="tabs mb-2" style="border:none;margin-bottom:16px">
        <div class="tab ${this.activeSubTab === 'pending' ? 'active' : ''}" onclick="Parties.switchSubTab('pending')">
          ⏳ Pending Bills (${pendingTrans.length})
        </div>
        <div class="tab ${this.activeSubTab === 'cleared' ? 'active' : ''}" onclick="Parties.switchSubTab('cleared')">
          ✅ Cleared Payments (${clearedItems.length})
        </div>
      </div>

      ${this.activeSubTab === 'pending' ? this._renderPendingTab(pendingTrans, partyName, accounts) : this._renderClearedTab(clearedItems)}
    `;
  },

  _renderPendingTab(pendingTrans, partyName, accounts) {
    if (pendingTrans.length === 0) {
      return `
        <div class="empty-state">
          <div style="font-size:48px;margin-bottom:12px">🎉</div>
          <h3>All Bills Cleared!</h3>
          <p>No pending due entries recorded for ${Utils.escapeHtml(partyName)}</p>
        </div>
      `;
    }

    return `
      <!-- Bill Clearance Control Bar -->
      <div id="clearanceBar" style="background:var(--bg-glass);border:1px solid var(--accent);border-radius:var(--radius-md);padding:14px 20px;margin-bottom:16px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px">
        <div>
          <span id="selectedCountText" style="font-weight:700">0 Bills Selected</span>
          <div style="font-size:1.2rem;font-weight:800;color:var(--text-success)" id="selectedTotalText">Total Payable: ₹0.00</div>
        </div>
        <div class="flex gap-2 items-center flex-wrap">
          <select id="clearanceAccountSelect" class="form-select" style="min-width:180px">
            <option value="">Select Payment Account *</option>
            ${accounts.map(a => `<option value="${a.id}">${Utils.escapeHtml(a.name)} (${Utils.formatCurrency(a.balance)})</option>`).join('')}
          </select>
          <input type="date" id="clearanceDate" class="form-input" value="${Utils.today()}" style="width:auto">
          <button class="btn btn-success" id="clearanceSubmitBtn" onclick="Parties.processClearance('${Utils.escapeHtml(partyName)}')" disabled style="padding:10px 18px;font-weight:700">
            💳 Pay & Clear Selected Bills
          </button>
        </div>
      </div>

      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th style="width:40px;text-align:center">
                <input type="checkbox" id="chkSelectAll" onchange="Parties.toggleSelectAllPending(this)">
              </th>
              <th>Date</th>
              <th>Item Name</th>
              <th class="text-right">Price (₹)</th>
              <th>Notes</th>
              <th class="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${pendingTrans.map(t => `
              <tr>
                <td style="text-align:center">
                  <input type="checkbox" class="pending-chk" data-type="${t.type}" data-id="${t.id}" data-price="${t.price || t.amount}" onchange="Parties.updateClearanceBar()">
                </td>
                <td>${Utils.formatDate(t.date)}</td>
                <td class="font-bold">
                  ${Utils.escapeHtml(t.itemName || 'General Item')}
                  ${t.isPartyOnly ? `<span class="badge badge-accent" style="font-size:0.65rem;margin-left:4px" title="Visible only in Party Ledger">🔒 Party Only</span>` : ''}
                </td>
                <td class="text-right font-bold" style="color:var(--accent-light)">${Utils.formatCurrency(t.price || 0)}</td>
                <td class="text-muted">${Utils.escapeHtml(t.notes || '-')}</td>
                <td>
                  <div class="table-actions">
                    <button class="btn btn-ghost btn-icon" onclick="Transactions.openEditModal('${t.type}', '${t.id}')" title="Edit Entry">${Utils.icons.edit}</button>
                    <button class="btn btn-ghost btn-icon" onclick="Transactions.deleteTransaction('${t.type}', '${t.id}')" title="Delete Entry">${Utils.icons.trash}</button>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  },

  _renderClearedTab(clearedItems) {
    if (clearedItems.length === 0) {
      return `
        <div class="empty-state">
          <div style="font-size:48px;margin-bottom:12px">🧾</div>
          <h3>No Cleared Payments Yet</h3>
          <p>Select pending bills and click 'Pay & Clear Selected Bills' to record payment history</p>
        </div>
      `;
    }

    const totalClearedAmount = clearedItems.reduce((sum, t) => sum + Utils.parseNum(t.price || t.amount), 0);

    // Group cleared items by Payment Clearance Date
    const grouped = {};
    clearedItems.forEach(item => {
      const payDate = item.clearedAt ? item.clearedAt.split('T')[0] : item.date;
      if (!grouped[payDate]) grouped[payDate] = [];
      grouped[payDate].push(item);
    });

    const sortedDates = Object.keys(grouped).sort((a, b) => new Date(b) - new Date(a));

    return `
      <div class="stat-grid mb-2" style="margin-bottom:16px">
        <div class="stat-card profit">
          <div class="stat-label">Total Paid & Cleared History</div>
          <div class="stat-value text-success">${Utils.formatCurrency(totalClearedAmount)}</div>
          <div class="stat-change">${clearedItems.length} cleared item${clearedItems.length === 1 ? '' : 's'} across ${sortedDates.length} payment date${sortedDates.length === 1 ? '' : 's'}</div>
        </div>
      </div>

      ${sortedDates.map(date => {
        const items = grouped[date];
        const dayPaidTotal = items.reduce((sum, i) => sum + Utils.parseNum(i.price || i.amount), 0);

        return `
          <div class="date-group-card" style="margin-bottom:16px">
            <div class="date-card-header">
              <div class="date-card-title">
                <span>📅 Payment Date: ${Utils.formatDate(date)}</span>
                <span class="badge badge-accent" style="font-size:0.75rem">${items.length} ${items.length === 1 ? 'item' : 'items'} paid</span>
              </div>
              <div class="date-card-stats">
                <div class="date-stat-pill">
                  <span>Day Total Paid:</span>
                  <strong class="text-success">${Utils.formatCurrency(dayPaidTotal)}</strong>
                </div>
              </div>
            </div>

            <div class="table-container" style="border:none;border-radius:0;box-shadow:none">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Entry Date</th>
                    <th>Item Name</th>
                    <th>Account Paid From</th>
                    <th>Notes</th>
                    <th class="text-right">Amount Paid (₹)</th>
                    <th class="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  ${items.map(t => {
                    let accountId = t.accountId;
                    if (t.clearanceId) {
                      const setRec = DB.getById(DB.COLLECTIONS.EXPENSES, t.clearanceId) || DB.getById(DB.COLLECTIONS.INCOMES, t.clearanceId);
                      if (setRec && setRec.accountId) accountId = setRec.accountId;
                    }
                    const acc = DB.getById(DB.COLLECTIONS.ACCOUNTS, accountId);

                    return `
                      <tr>
                        <td>${Utils.formatDate(t.date)}</td>
                        <td class="font-bold text-success">
                          ${Utils.escapeHtml(t.itemName || 'Cleared Item')}
                          ${t.isPartyOnly ? `<span class="badge badge-accent" style="font-size:0.65rem;margin-left:4px" title="Visible only in Party Ledger">🔒 Party Only</span>` : ''}
                        </td>
                        <td><span class="badge badge-accent">${Utils.escapeHtml(acc?.name || t.accountName || 'Cash')}</span></td>
                        <td class="text-muted">${Utils.escapeHtml(t.notes || '-')}</td>
                        <td class="text-right font-bold text-success">${Utils.formatCurrency(t.price || t.amount)}</td>
                        <td>
                          <div class="table-actions">
                            <button class="btn btn-ghost btn-icon" onclick="Transactions.openEditModal('${t.type}', '${t.id}')" title="Edit Entry">${Utils.icons.edit}</button>
                            <button class="btn btn-outline btn-sm" onclick="Parties.revertSingleBillClearance('${t.id}', '${t.type}')" title="Return to Pending Bills" style="color:var(--text-danger);border-color:var(--border)">
                              ↩️ Return Pending
                            </button>
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
      }).join('')}
    `;
  },

  switchSubTab(subTab) {
    this.activeSubTab = subTab;
    App.refreshPage();
  },

  toggleSelectAllPending(mainChk) {
    const checkboxes = document.querySelectorAll('.pending-chk');
    checkboxes.forEach(chk => {
      chk.checked = mainChk.checked;
    });
    this.updateClearanceBar();
  },

  updateClearanceBar() {
    const checkboxes = document.querySelectorAll('.pending-chk:checked');
    let total = 0;
    checkboxes.forEach(chk => {
      total += parseFloat(chk.getAttribute('data-price')) || 0;
    });

    const countText = document.getElementById('selectedCountText');
    const totalText = document.getElementById('selectedTotalText');
    const submitBtn = document.getElementById('clearanceSubmitBtn');

    if (countText) countText.textContent = `${checkboxes.length} Bill${checkboxes.length === 1 ? '' : 's'} Selected`;
    if (totalText) totalText.textContent = `Total Payable: ${Utils.formatCurrency(total)}`;
    if (submitBtn) submitBtn.disabled = checkboxes.length === 0;
  },

  processClearance(partyName) {
    const checkboxes = document.querySelectorAll('.pending-chk:checked');
    if (checkboxes.length === 0) {
      App.toast('Please select at least one pending bill to clear', 'error');
      return;
    }

    const accountSelect = document.getElementById('clearanceAccountSelect');
    const dateInput = document.getElementById('clearanceDate');

    const accountId = accountSelect ? accountSelect.value : '';
    const date = dateInput && dateInput.value ? dateInput.value : Utils.today();

    if (!accountId) {
      App.toast('Please select a payment account to deduct money from', 'error');
      return;
    }

    const account = DB.getById(DB.COLLECTIONS.ACCOUNTS, accountId);
    if (!account) {
      App.toast('Invalid payment account', 'error');
      return;
    }

    let totalAmount = 0;
    const selectedItems = [];
    const itemSummaryList = [];

    checkboxes.forEach(chk => {
      const type = chk.getAttribute('data-type');
      const id = chk.getAttribute('data-id');
      const price = parseFloat(chk.getAttribute('data-price')) || 0;

      const collection = type === 'income' ? DB.COLLECTIONS.INCOMES : DB.COLLECTIONS.EXPENSES;
      const rec = DB.getById(collection, id);
      const name = rec ? (rec.itemName || 'Item') : 'Item';

      if (rec) {
        DB.update(collection, id, { amount: price, price, accountId, accountName: account.name });
      }

      totalAmount += price;
      selectedItems.push({ type, id, price, name });
      itemSummaryList.push(`${name} (${Utils.formatCurrency(price)})`);
    });

    const clearedItemsText = itemSummaryList.join(', ');

    // Create ONE SINGLE Settlement Payment Expense in DB & Account first to get its ID
    const settlementRecord = {
      itemName: `Bill Settlement (${selectedItems.length} items paid)`,
      amount: totalAmount,
      price: totalAmount,
      date,
      party: partyName,
      accountId,
      accountName: account.name,
      notes: `Paid: ${clearedItemsText}`,
      clearedItemsText,
      isPartyOnly: false, // This single total payment reflects in Main Transactions & Dashboard!
      isSettlement: true,
      status: 'cleared'
    };

    const newSettlementId = DB.add(DB.COLLECTIONS.EXPENSES, settlementRecord);

    selectedItems.forEach(item => {
      const collection = item.type === 'income' ? DB.COLLECTIONS.INCOMES : DB.COLLECTIONS.EXPENSES;
      DB.update(collection, item.id, {
        status: 'cleared',
        clearanceId: newSettlementId,
        clearedAt: new Date().toISOString()
      });
    });

    // Deduct single total amount from Account balance
    DB.update(DB.COLLECTIONS.ACCOUNTS, accountId, {
      balance: Utils.parseNum(account.balance) - totalAmount
    });

    App.toast(`Successfully paid & cleared ${Utils.formatCurrency(totalAmount)} for ${partyName}! 💳`, 'success');
    App.refreshPage();
  },

  revertSingleBillClearance(id, type) {
    if (!confirm('Return this bill item to Pending Bills? Paid amount will be refunded to account.')) return;

    const collection = type === 'income' ? DB.COLLECTIONS.INCOMES : DB.COLLECTIONS.EXPENSES;
    const record = DB.getById(collection, id);

    if (!record) {
      App.toast('Item not found', 'error');
      return;
    }

    const itemAmount = Utils.parseNum(record.price || record.amount);

    // Refund money to Account balance
    if (record.accountId) {
      const account = DB.getById(DB.COLLECTIONS.ACCOUNTS, record.accountId);
      if (account) {
        const refundChange = type === 'income' ? -itemAmount : itemAmount;
        DB.update(DB.COLLECTIONS.ACCOUNTS, record.accountId, {
          balance: Utils.parseNum(account.balance) + refundChange
        });
      }
    }

    // If part of a settlement receipt, adjust or remove the settlement receipt
    if (record.clearanceId) {
      const settlement = DB.getById(DB.COLLECTIONS.EXPENSES, record.clearanceId) || DB.getById(DB.COLLECTIONS.INCOMES, record.clearanceId);
      if (settlement) {
        const setCol = settlement.type === 'income' ? DB.COLLECTIONS.INCOMES : DB.COLLECTIONS.EXPENSES;
        const newAmount = Utils.parseNum(settlement.amount) - itemAmount;
        if (newAmount <= 0) {
          DB.delete(setCol, record.clearanceId);
        } else {
          DB.update(setCol, record.clearanceId, { amount: newAmount, price: newAmount });
        }
      }
    }

    // Reset item status to pending
    DB.update(collection, id, { status: 'pending', clearanceId: null, clearedAt: null });

    App.toast(`Bill "${record.itemName || 'Item'}" returned to Pending! ↩️`, 'success');
    App.refreshPage();
  },

  viewPartyLedger(partyName) {
    this.activeLedgerParty = partyName;
    this.activeSubTab = 'pending';
    App.refreshPage();
  },

  closeLedger() {
    this.activeLedgerParty = null;
    App.refreshPage();
  },

  search(term) {
    this.searchTerm = term;
    App.refreshPage();
  },

  openAddParty() {
    App.showModal('👥 Add New Party', `
      <form id="partyForm" onsubmit="Parties.saveParty(event)">
        <div class="form-group">
          <label class="form-label">Party Name *</label>
          <input type="text" class="form-input" name="name" required placeholder="e.g. Ramesh Traders, Ankit Sharma">
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Phone Number</label>
            <input type="tel" class="form-input" name="phone" placeholder="10-digit mobile number">
          </div>
          <div class="form-group">
            <label class="form-label">Type</label>
            <select class="form-select" name="type">
              <option value="customer">Customer / Client</option>
              <option value="supplier">Supplier / Vendor</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Notes</label>
          <textarea class="form-textarea" name="notes" rows="2" placeholder="Optional party notes..."></textarea>
        </div>
        <div class="modal-footer" style="padding:16px 0 0;border-top:1px solid var(--border)">
          <button type="button" class="btn btn-outline" onclick="App.closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary">Save Party</button>
        </div>
      </form>
    `);
  },

  saveParty(e) {
    e.preventDefault();
    const form = new FormData(e.target);
    const name = form.get('name');
    if (!name) return;

    DB.add(DB.COLLECTIONS.PARTIES, {
      name,
      phone: form.get('phone'),
      type: form.get('type'),
      notes: form.get('notes')
    });

    App.toast('Party added! 👥', 'success');
    App.closeModal();
    this.viewPartyLedger(name);
  }
};
