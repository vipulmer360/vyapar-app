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
    let incParties = [];
    DB.getAll(DB.COLLECTIONS.INCOMES).forEach(i => {
      if (i.parties && i.parties.length > 0) i.parties.forEach(p => incParties.push(p.partyName));
      else if (i.party) incParties.push(i.party);
    });
    let expParties = [];
    DB.getAll(DB.COLLECTIONS.EXPENSES).forEach(e => {
      if (e.parties && e.parties.length > 0) e.parties.forEach(p => expParties.push(p.partyName));
      else if (e.party) expParties.push(e.party);
    });
    return [...new Set([...dbParties, ...incParties, ...expParties])].filter(name => name && name !== 'General');
  },

  _getPartyStats(partyName) {
    const allPartyTrans = Calculations.getPartyTransactions(partyName);
    
    // We can't just filter by t.type anymore because row type might differ.
    // Instead, we accumulate based on row-level type.
    let totalIncomePrice = 0;
    let totalExpensePrice = 0;
    let totalClearedPaid = 0;

    const pendingTrans = allPartyTrans.filter(t => {
      if (t.isSettlement) return false;
      if (t.status === 'cleared') return false; // Legacy global clearance
      if (t.clearedParties && t.clearedParties.includes(partyName)) return false; // Partial clearance
      return true;
    });

    const clearedTrans = allPartyTrans.filter(t => {
      if (t.isSettlement) return false;
      if (t.status === 'cleared') return true; // Legacy global clearance
      if (t.clearedParties && t.clearedParties.includes(partyName)) return true; // Partial clearance
      return false;
    });

    pendingTrans.forEach(t => {
      const details = Calculations.getPartyDetails(t, partyName);
      if (details.type === 'income') totalIncomePrice += details.amount;
      else if (details.type === 'expense') totalExpensePrice += details.amount;
    });

    clearedTrans.forEach(t => {
      const details = Calculations.getPartyDetails(t, partyName);
      totalClearedPaid += details.amount;
    });

    const pendingTotalPrice = totalExpensePrice > 0 ? totalExpensePrice : totalIncomePrice;

    return {
      totalIncome: totalIncomePrice,
      totalExpense: totalExpensePrice,
      net: totalIncomePrice - totalExpensePrice,
      totalPrice: pendingTotalPrice,
      totalClearedPaid,
      pendingCount: pendingTrans.length,
      clearedCount: clearedTrans.length,
      totalEntries: allPartyTrans.length
    };
  },

  _renderPartyList() {
    const partyNames = this._getAllPartyNames();
    const filteredNames = Utils.filterBySearch(
      partyNames.map(name => ({ name, ...this._getPartyStats(name) })),
      this.searchTerm,
      ['name']
    ).sort((a, b) => a.name.localeCompare(b.name));

    const grandIncome = partyNames.reduce((sum, p) => sum + this._getPartyStats(p).totalIncome, 0);
    const grandExpense = partyNames.reduce((sum, p) => sum + this._getPartyStats(p).totalExpense, 0);

    return `

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
                      <strong class="text-accent" style="font-size:1.05rem">${Utils.escapeHtml(p.name)}</strong>
                    </div>
                  </td>
                  <td class="text-center"><span class="badge badge-accent">${p.pendingCount} pending</span></td>
                  <td class="text-right"><span class="amount debit font-bold">${Utils.formatCurrency(p.totalPrice)}</span></td>
                  <td class="text-right"><span class="amount credit font-bold">${Utils.formatCurrency(p.totalClearedPaid)}</span></td>
                  <td>
                    <div class="table-actions" style="display:flex;gap:4px;align-items:center">
                      <button class="btn btn-ghost btn-icon" onclick="event.stopPropagation();Parties.openEditParty('${Utils.escapeHtml(p.name)}')" title="Edit Party">
                        ${Utils.icons.edit}
                      </button>
                      <button class="btn btn-ghost btn-icon text-danger" onclick="event.stopPropagation();Parties.deleteParty('${Utils.escapeHtml(p.name)}')" title="Delete Party">
                        ${Utils.icons.trash}
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
    const allPartyTrans = Calculations.getPartyTransactions(partyName);
    
    const incomes = allPartyTrans.filter(t => t.type === 'income');
    const pendingTrans = allPartyTrans.filter(t => {
      if (t.isSettlement) return false;
      if (t.status === 'cleared') return false;
      if (t.clearedParties && t.clearedParties.includes(partyName)) return false;
      return true;
    }).sort((a, b) => new Date(b.date) - new Date(a.date) || (b.createdAt || '').localeCompare(a.createdAt || '') || 0);

    const clearedItems = allPartyTrans.filter(t => {
      if (t.isSettlement) return false;
      if (t.status === 'cleared') return true;
      if (t.clearedParties && t.clearedParties.includes(partyName)) return true;
      return false;
    }).sort((a, b) => new Date(b.clearedAt || b.date) - new Date(a.clearedAt || a.date) || (b.createdAt || '').localeCompare(a.createdAt || '') || 0);

    const accounts = DB.getAll(DB.COLLECTIONS.ACCOUNTS);

    return `
      <div class="toolbar" style="margin-bottom:16px">
        <div class="toolbar-left">
          <button class="btn btn-outline" onclick="Parties.closeLedger()">
            ⬅️ Back to All Parties
          </button>
          <h2 style="font-size:1.4rem;font-weight:800;margin-left:12px">👤 ${Utils.escapeHtml(partyName)}</h2>
        </div>
        <div class="toolbar-right flex gap-2 items-center">
          <button class="btn btn-outline btn-sm" onclick="App.undoLastAction()" title="Undo last action" style="color:var(--text-accent);border-color:var(--border);font-weight:700">
            ↩️ Undo
          </button>
          <div style="font-size:1.05rem;font-weight:700;padding:6px 14px;background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-sm);display:flex;align-items:center;gap:6px">
            <span>Pending Due Total:</span>
            <strong class="text-danger">${Utils.formatCurrency(stats.totalPrice)}</strong>
          </div>
          <button class="btn btn-success btn-sm" onclick="Transactions.openAddModal('income', '${Utils.escapeHtml(partyName)}')">
            💵 Add Income
          </button>
          <button class="btn btn-danger btn-sm" onclick="Transactions.openAddModal('expense', '${Utils.escapeHtml(partyName)}')">
            💸 Add Expense
          </button>
          <button class="btn btn-outline btn-sm" onclick="Parties.openEditParty('${Utils.escapeHtml(partyName)}')">
            ✏️ Edit Party
          </button>
          <button class="btn btn-outline btn-sm text-danger" onclick="Parties.deleteParty('${Utils.escapeHtml(partyName)}')">
            🗑️ Delete
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

      ${this.activeSubTab === 'pending' ? this._renderPendingTab(pendingTrans, partyName, accounts) : this._renderClearedTab(clearedItems, partyName)}
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
      <div id="clearanceBar" style="background:var(--bg-glass);border:1px solid var(--accent);border-radius:var(--radius-md);padding:14px;margin-bottom:16px;display:flex;flex-direction:column;gap:12px">
        <div>
          <span id="selectedCountText" style="font-weight:700">0 Bills Selected</span>
          <div style="font-size:1.3rem;font-weight:800;color:var(--text-success)" id="selectedTotalText">Total: 0.00</div>
        </div>
        <div style="display:flex; flex-wrap:wrap; gap:8px; align-items:center; width:100%">
          <select id="clearanceAccountSelect" class="form-select" style="flex:1; min-width:140px; height:40px">
            <option value="">Select Account *</option>
            ${accounts.map(a => `<option value="${a.id}">${Utils.escapeHtml(a.name)}</option>`).join('')}
          </select>
          <input type="date" id="clearanceDate" class="form-input" value="${Utils.today()}" style="flex:1; min-width:120px; height:40px">
          <button class="btn btn-success" id="clearanceSubmitBtn" onclick="Parties.processClearance('${Utils.escapeHtml(partyName)}')" disabled style="height:40px;font-weight:700;flex-grow:1;min-width:200px">
            💳 Pay & Clear
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
              <th class="text-center">Party Amount</th>
              <th class="text-center">Notes</th>
              <th class="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${pendingTrans.map(t => {
              const details = Calculations.getPartyDetails(t, partyName);
              const isInc = details.type === 'income';
              return `
              <tr>
                <td style="text-align:center">
                  <input type="checkbox" class="pending-chk" data-type="${details.type}" data-parent-type="${t.type}" data-id="${t.id}" data-price="${details.amount}" onchange="Parties.updateClearanceBar()">
                </td>
                <td>${Utils.formatDate(t.date)}</td>
                <td>
                  ${Utils.escapeHtml(t.itemName || 'General Item')}
                  ${t.isPartyOnly ? `<span title="Visible only in Party Ledger" style="cursor:help;margin-left:4px;font-size:1.1em">👁️</span>` : ''}
                </td>
                <td class="text-center">
                  <span class="amount ${isInc ? 'credit' : 'debit'} font-bold">${isInc ? '+' : '-'}${Utils.formatCurrency(details.amount)}</span>
                </td>
                <td class="text-center">${Utils.escapeHtml(t.notes || '-')}</td>
                <td>
                  <div class="table-actions">
                    <button class="btn btn-ghost btn-icon" onclick="Transactions.openEditModal('${t.type}', '${t.id}')" title="Edit Entry">${Utils.icons.edit}</button>
                    <button class="btn btn-ghost btn-icon" onclick="Transactions.deleteTransaction('${t.type}', '${t.id}')" title="Delete Entry">${Utils.icons.trash}</button>
                  </div>
                </td>
              </tr>
            `}).join('')}
          </tbody>
        </table>
      </div>
    `;
  },

  _renderClearedTab(clearedItems, partyName) {
    if (clearedItems.length === 0) {
      return `
        <div class="empty-state">
          <div style="font-size:48px;margin-bottom:12px">🧾</div>
          <h3>No Cleared Payments Yet</h3>
          <p>Select pending bills and click 'Pay & Clear Selected Bills' to record payment history</p>
        </div>
      `;
    }

    const totalClearedAmount = clearedItems.reduce((sum, t) => sum + Calculations.getPartyDetails(t, partyName).amount, 0);

    // Group cleared items by Payment Clearance Date (settlement date)
    const grouped = {};
    clearedItems.forEach(item => {
      let payDate = item.clearedAt ? item.clearedAt.split('T')[0] : item.date;
      if (item.clearanceId) {
        const settlement = DB.getById(DB.COLLECTIONS.EXPENSES, item.clearanceId) || DB.getById(DB.COLLECTIONS.INCOMES, item.clearanceId);
        if (settlement && settlement.date) {
          payDate = settlement.date;
        }
      }
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
        const dayPaidTotal = items.reduce((sum, i) => sum + Calculations.getPartyDetails(i, partyName).amount, 0);

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
                    <th class="text-center">Notes</th>
                    <th class="text-center">Amount Paid</th>
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
                        <td class="text-success">
                          ${Utils.escapeHtml(t.itemName || 'Cleared Item')}
                          ${t.isPartyOnly ? `<span title="Visible only in Party Ledger" style="cursor:help;margin-left:4px;font-size:1.1em">👁️</span>` : ''}
                        </td>
                        <td><span class="badge badge-accent">${Utils.escapeHtml(acc?.name || t.accountName || '-')}</span></td>
                        <td class="text-center">${Utils.escapeHtml(t.notes || '-')}</td>
                        <td class="text-center text-success" style="font-weight:600">${Utils.formatCurrency(Calculations.getPartyDetails(t, partyName).amount)}</td>
                        <td>
                          <div class="table-actions">
                            <button class="btn btn-ghost btn-icon" onclick="Transactions.openEditModal('${t.type}', '${t.id}')" title="Edit Entry">${Utils.icons.edit}</button>
                            <button class="btn btn-ghost btn-icon text-danger" onclick="Parties.revertSingleBillClearance('${t.id}', '${t.type}')" title="Return to Pending Bills">
                              ↩️
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
      App.toast('Please select a payment account', 'error');
      return;
    }

    const account = DB.getById(DB.COLLECTIONS.ACCOUNTS, accountId);
    if (!account) {
      App.toast('Invalid payment account', 'error');
      return;
    }

    let totalAmount = 0;
    const selectedItems = [];

    checkboxes.forEach(chk => {
      const type = chk.getAttribute('data-parent-type') || chk.getAttribute('data-type') || 'expense';
      const id = chk.getAttribute('data-id');
      const price = parseFloat(chk.getAttribute('data-price')) || 0;
      totalAmount += price;
      selectedItems.push({ type, id, price });
    });

    // Create ONE SINGLE Expense Group Settlement entry (Paisa chukaya = Expense = -Amount)
    const expSettlement = {
      itemName: `Bill ${partyName}`,
      amount: totalAmount,
      price: 0,
      date,
      party: partyName,
      accountId,
      accountName: account.name,
      notes: `${account.name}`,
      isPartyOnly: false,
      isSettlement: true,
      status: 'cleared',
      type: 'expense'
    };

    const expSettlementRes = DB.add(DB.COLLECTIONS.EXPENSES, expSettlement);
    const expSettlementId = expSettlementRes ? expSettlementRes.id : null;

    selectedItems.forEach(item => {
      const collection = item.type === 'income' ? DB.COLLECTIONS.INCOMES : DB.COLLECTIONS.EXPENSES;
      const t = DB.getById(collection, item.id);
      
      if (t) {
        // Initialize clearedParties if not exists
        const clearedParties = t.clearedParties ? [...t.clearedParties] : [];
        if (!clearedParties.includes(partyName)) {
           clearedParties.push(partyName);
        }
        
        // Check if ALL parties in this transaction have now been cleared
        let allCleared = true;
        if (t.parties && t.parties.length > 0) {
           t.parties.forEach(p => {
              if (p.partyName && !clearedParties.includes(p.partyName)) {
                 allCleared = false;
              }
           });
        } else if (t.party && t.party !== 'General') {
           if (!clearedParties.includes(t.party)) {
              allCleared = false;
           }
        }

        DB.update(collection, item.id, {
          status: allCleared ? 'cleared' : (t.status || 'pending'),
          clearedParties: clearedParties,
          clearanceId: expSettlementId,
          clearedAt: new Date().toISOString()
        });
      }
    });

    // Subtract total paid from account balance
    const newBalance = Utils.parseNum(account.balance) - totalAmount;
    DB.update(DB.COLLECTIONS.ACCOUNTS, accountId, { balance: newBalance });

    App.toast(`Successfully paid & cleared ${Utils.formatCurrency(totalAmount)}! 💳`, 'success');
    App.refreshPage();
  },

  revertSingleBillClearance(id, type) {
    if (!confirm('Return this bill to Pending? Paid amount will be refunded to your account.')) return;

    const collection = type === 'income' ? DB.COLLECTIONS.INCOMES : DB.COLLECTIONS.EXPENSES;
    const record = DB.getById(collection, id);

    if (!record) {
      App.toast('Item not found', 'error');
      return;
    }

    const itemAmount = Utils.parseNum(record.price || record.amount);

    // Get the settlement record FIRST to find the actual payment account and amount
    let settlement = null;
    if (record.clearanceId) {
      settlement = DB.getById(DB.COLLECTIONS.EXPENSES, record.clearanceId);
      if (!settlement) {
        settlement = DB.getById(DB.COLLECTIONS.INCOMES, record.clearanceId);
      }
    }

    const paymentAccountId = settlement ? settlement.accountId : record.accountId;

    // Save state to App.lastAction for Undo
    App.lastAction = {
      type: 'revert_clearance',
      data: {
        billCollection: collection,
        billId: id,
        settlementCollection: settlement ? (settlement.type === 'income' ? DB.COLLECTIONS.INCOMES : DB.COLLECTIONS.EXPENSES) : DB.COLLECTIONS.EXPENSES,
        settlementId: record.clearanceId,
        settlementRecord: settlement ? JSON.parse(JSON.stringify(settlement)) : null,
        paymentAccountId,
        itemAmount,
        isIncome: type === 'income'
      }
    };

    // Refund paid money back into account (+itemAmount)
    if (paymentAccountId) {
      const account = DB.getById(DB.COLLECTIONS.ACCOUNTS, paymentAccountId);
      if (account) {
        DB.update(DB.COLLECTIONS.ACCOUNTS, paymentAccountId, {
          balance: Utils.parseNum(account.balance) + itemAmount
        });
      }
    }

    // Adjust or delete the expense settlement receipt
    if (settlement) {
      const setCol = settlement.type === 'income' ? DB.COLLECTIONS.INCOMES : DB.COLLECTIONS.EXPENSES;
      const newAmount = Utils.parseNum(settlement.amount) - itemAmount;
      if (newAmount <= 0.01) {
        DB.delete(setCol, record.clearanceId);
      } else {
        DB.update(setCol, record.clearanceId, { amount: newAmount, price: 0 });
      }
    }

    const partyName = Parties.activeLedgerParty;
    let clearedParties = record.clearedParties ? [...record.clearedParties] : [];
    
    if (partyName) {
      clearedParties = clearedParties.filter(p => p !== partyName);
    } else {
      clearedParties = [];
    }

    // Reset original item status to pending, and update clearedParties array
    DB.update(collection, id, { 
      status: 'pending', 
      clearedParties: clearedParties,
      clearanceId: clearedParties.length === 0 ? null : record.clearanceId, 
      clearedAt: clearedParties.length === 0 ? null : record.clearedAt 
    });

    App.toast(`Bill returned to Pending! <button class="btn btn-sm btn-outline" onclick="App.undoLastAction()" style="margin-left:8px;padding:2px 6px;font-size:0.75rem;color:var(--accent-light)">↩️ Undo</button>`, 'warning', 6500);
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
      <form id="partyForm" autocomplete="off" onsubmit="Parties.saveParty(event)">
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
          <textarea class="form-textarea" name="notes" rows="2" placeholder="Party notes..."></textarea>
        </div>
        <div class="modal-footer" style="padding:16px 0 0;border-top:1px solid var(--border)">
          <button type="button" class="btn btn-outline" onclick="App.closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary">Save Party</button>
        </div>
      </form>
    `);
  },

  openEditParty(partyName) {
    const dbParty = DB.getAll(DB.COLLECTIONS.PARTIES).find(p => p.name === partyName) || { name: partyName, phone: '', type: 'customer', notes: '' };

    App.showModal('✏️ Edit Party', `
      <form id="partyForm" autocomplete="off" onsubmit="Parties.saveParty(event, '${Utils.escapeHtml(partyName)}')">
        <div class="form-group">
          <label class="form-label">Party Name *</label>
          <input type="text" class="form-input" name="name" required value="${Utils.escapeHtml(dbParty.name)}">
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Phone Number</label>
            <input type="tel" class="form-input" name="phone" value="${Utils.escapeHtml(dbParty.phone || '')}" placeholder="10-digit mobile number">
          </div>
          <div class="form-group">
            <label class="form-label">Type</label>
            <select class="form-select" name="type">
              <option value="customer" ${dbParty.type === 'customer' ? 'selected' : ''}>Customer / Client</option>
              <option value="supplier" ${dbParty.type === 'supplier' ? 'selected' : ''}>Supplier / Vendor</option>
              <option value="other" ${dbParty.type === 'other' ? 'selected' : ''}>Other</option>
            </select>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Notes</label>
          <textarea class="form-textarea" name="notes" rows="2" placeholder="Party notes...">${Utils.escapeHtml(dbParty.notes || '')}</textarea>
        </div>
        <div class="modal-footer" style="padding:16px 0 0;border-top:1px solid var(--border)">
          <button type="button" class="btn btn-outline" onclick="App.closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary">Update Party</button>
        </div>
      </form>
    `);
  },

  saveParty(e, oldName = null) {
    e.preventDefault();
    const form = new FormData(e.target);
    const newName = form.get('name')?.trim();
    if (!newName) return;

    if (oldName) {
      // Edit existing party
      const existing = DB.getAll(DB.COLLECTIONS.PARTIES).find(p => p.name === oldName);
      if (existing) {
        DB.update(DB.COLLECTIONS.PARTIES, existing.id, {
          name: newName,
          phone: form.get('phone'),
          type: form.get('type'),
          notes: form.get('notes')
        });
      } else {
        DB.add(DB.COLLECTIONS.PARTIES, {
          name: newName,
          phone: form.get('phone'),
          type: form.get('type'),
          notes: form.get('notes')
        });
      }

      // Sync updated party name across all incomes & expenses (both legacy and new parties[] array)
      if (oldName !== newName) {
        const oldNameLower = oldName.toLowerCase();
        
        // Update incomes
        DB.getAll(DB.COLLECTIONS.INCOMES).forEach(i => {
          const updates = {};
          if (i.party === oldName) updates.party = newName;
          if (i.parties && i.parties.length > 0) {
            const updatedParties = i.parties.map(p => 
              p.partyName.toLowerCase() === oldNameLower ? { ...p, partyName: newName } : p
            );
            if (JSON.stringify(updatedParties) !== JSON.stringify(i.parties)) updates.parties = updatedParties;
          }
          if (Object.keys(updates).length > 0) DB.update(DB.COLLECTIONS.INCOMES, i.id, updates);
        });

        // Update expenses
        DB.getAll(DB.COLLECTIONS.EXPENSES).forEach(e => {
          const updates = {};
          if (e.party === oldName) updates.party = newName;
          if (e.parties && e.parties.length > 0) {
            const updatedParties = e.parties.map(p => 
              p.partyName.toLowerCase() === oldNameLower ? { ...p, partyName: newName } : p
            );
            if (JSON.stringify(updatedParties) !== JSON.stringify(e.parties)) updates.parties = updatedParties;
          }
          if (Object.keys(updates).length > 0) DB.update(DB.COLLECTIONS.EXPENSES, e.id, updates);
        });
      }

      App.toast('Party details updated! ✏️', 'success');
      App.closeModal();
      this.viewPartyLedger(newName);
    } else {
      // Add new party
      DB.add(DB.COLLECTIONS.PARTIES, {
        name: newName,
        phone: form.get('phone'),
        type: form.get('type'),
        notes: form.get('notes')
      });

      App.toast('Party added! 👥', 'success');
      App.closeModal();
      this.viewPartyLedger(newName);
    }
  },

  deleteParty(partyName) {
    if (!confirm(`Are you sure you want to delete party "${partyName}"?`)) return;

    // 1. Remove from PARTIES collection
    const dbParties = DB.getAll(DB.COLLECTIONS.PARTIES).filter(p => p.name === partyName);
    dbParties.forEach(p => DB.delete(DB.COLLECTIONS.PARTIES, p.id));

    // 2. Remove party name reference from incomes & expenses (both legacy and new parties[] array)
    const partyNameLower = partyName.toLowerCase();
    
    DB.getAll(DB.COLLECTIONS.INCOMES).forEach(i => {
      const updates = {};
      if (i.party === partyName) updates.party = '';
      if (i.parties && i.parties.length > 0) {
        const filtered = i.parties.filter(p => p.partyName.toLowerCase() !== partyNameLower);
        if (filtered.length !== i.parties.length) updates.parties = filtered;
      }
      if (Object.keys(updates).length > 0) DB.update(DB.COLLECTIONS.INCOMES, i.id, updates);
    });

    DB.getAll(DB.COLLECTIONS.EXPENSES).forEach(e => {
      const updates = {};
      if (e.party === partyName) updates.party = '';
      if (e.parties && e.parties.length > 0) {
        const filtered = e.parties.filter(p => p.partyName.toLowerCase() !== partyNameLower);
        if (filtered.length !== e.parties.length) updates.parties = filtered;
      }
      if (Object.keys(updates).length > 0) DB.update(DB.COLLECTIONS.EXPENSES, e.id, updates);
    });

    App.toast(`Party "${partyName}" deleted! 🗑️`, 'success');
    this.closeLedger();
  }
};
