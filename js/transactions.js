/* ==========================================
   VYAPAR PWA — TRANSACTIONS (INCOME & EXPENSE)
   ========================================== */

const Transactions = {
  currentType: 'all', // 'all', 'income', or 'expense'
  searchTerm: '',
  partyFilter: '',
  accountFilter: '', // NEW: Filter by account
  sortOrder: localStorage.getItem('vyapar_sort_order') || 'desc', // 'desc' (Newest First) or 'asc' (Oldest First)

  toggleSortOrder() {
    this.sortOrder = this.sortOrder === 'asc' ? 'desc' : 'asc';
    localStorage.setItem('vyapar_sort_order', this.sortOrder);
    App.toast(`Sorted by ${this.sortOrder === 'asc' ? 'Oldest First ⬆️' : 'Newest First ⬇️'}`, 'info');
    App.refreshPage();
  },

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
        const orderA = a.sortOrder !== undefined ? a.sortOrder : -1;
        const orderB = b.sortOrder !== undefined ? b.sortOrder : -1;
        
        if (orderA === orderB) {
           return (b.createdAt || '').localeCompare(a.createdAt || '');
        }
        return orderA - orderB;
      });
    });

    const isAsc = this.sortOrder === 'asc';
    const dates = Object.keys(grouped).sort((a, b) => isAsc ? new Date(a) - new Date(b) : new Date(b) - new Date(a));

    return dates.map(date => {
      const items = grouped[date];
      
      const totals = Calculations.getDayTotals(items, { 
        isPartyLedger, 
        accountId: Transactions.accountFilter,
        partyName: options.partyName 
      });

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
                  <span>Revenue:</span>
                  <strong class="text-success">${Utils.formatCurrency(totals.dayRevenue)}</strong>
                </div>
                <div class="date-stat-pill">
                  <span>Cost:</span>
                  <strong class="text-danger">${Utils.formatCurrency(totals.dayCost)}</strong>
                </div>
                <div class="date-stat-pill">
                  <span>Profit:</span>
                  <strong class="${totals.dayProfitLoss >= 0 ? 'text-success' : 'text-danger'}">${Utils.formatCurrency(totals.dayProfitLoss)}</strong>
                </div>
              ` : `
                <div class="date-stat-pill">
                  <span>Day Price Total:</span>
                  <strong style="color:var(--accent-light)">${Utils.formatCurrency(totals.dayTotalPrice)}</strong>
                </div>
              `}
            </div>
          </div>

          <div class="table-container" style="border:none;border-radius:0;box-shadow:none">
            <table class="data-table">
              <thead>
                <tr>
                  <th style="width:30px"></th>
                  <th class="text-center">Item Name</th>
                  ${!isPartyLedger ? `<th class="text-center">Party</th><th class="text-center">Account</th><th class="text-center">Acc Amount</th>` : ''}
                  <th class="text-center">Party Amount</th>
                  <th class="text-center">Notes</th>
                  <th class="text-center">Actions</th>
                </tr>
              </thead>
              <tbody data-date="${date}">
                ${items.map((t, idx) => {
                  let accDisplay = '-';
                  if (t.accounts && t.accounts.length > 0) {
                     accDisplay = t.accounts.map(a => DB.getById(DB.COLLECTIONS.ACCOUNTS, a.accountId)?.name || a.accountName).join(', ');
                  } else if (t.accountId) {
                     const acc = DB.getById(DB.COLLECTIONS.ACCOUNTS, t.accountId);
                     accDisplay = acc ? acc.name : (t.accountName || '-');
                  }

                  let partyDisplay = '-';
                  let mathNotes = '';
                  if (t.parties && t.parties.length > 0) {
                     partyDisplay = this.formatPartyCell(t.parties[0].partyName);
                     if (t.parties.length > 1) {
                        partyDisplay += ` <span style="font-size:0.75em;color:var(--text-muted)">(+${t.parties.length - 1})</span>`;
                        const amounts = t.parties.map(p => parseFloat(p.amount) || 0);
                        mathNotes = `<div style="font-size:0.85em;color:var(--accent-light);margin-top:2px;font-weight:600">[${amounts.join(' + ')}]</div>`;
                     }
                  } else {
                     partyDisplay = this.formatPartyCell(t.party);
                  }
                  
                  let displayAmount = parseFloat(t.amount) || 0;
                  let isInc = t.type === 'income';
                  
                  if (Transactions.accountFilter) {
                    const details = Calculations.getAccountDetails(t, Transactions.accountFilter);
                    displayAmount = details.amount;
                    isInc = details.type === 'income';
                  }

                  let partyDisplayAmount = parseFloat(t.price) || 0;
                  
                  if (t.parties && t.parties.length > 0) {
                     partyDisplayAmount = t.parties.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
                  }
                  
                  if (Transactions.partyFilter) {
                    partyDisplayAmount = Calculations.getPartyDetails(t, Transactions.partyFilter).amount;
                  }

                  let notesHtml = t.notes ? Utils.escapeHtml(t.notes) : (mathNotes ? '' : '-');

                  return `
                    <tr data-id="${t.id}" data-type="${t.type}" data-idx="${idx}">
                      <td class="text-center" style="width:30px;padding:4px">
                        <span class="drag-handle" title="Drag to reorder">⋮⋮</span>
                      </td>
                      <td class="text-center">
                        ${Utils.escapeHtml(t.itemName || 'General Item')}
                        ${t.isPartyOnly ? `<span title="Hidden from Main Transactions" style="cursor:help;margin-left:4px;font-size:1.1em">👁️</span>` : ''}
                      </td>
                      ${!isPartyLedger ? `
                        <td class="text-center">${partyDisplay}</td>
                        <td class="text-center"><span class="badge badge-accent" style="font-size:0.45rem; font-weight:normal">${Utils.escapeHtml(accDisplay)}</span></td>
                        <td class="text-center">
                          ${displayAmount ? `<span class="amount ${isInc ? 'credit' : 'debit'}">${isInc ? '+' : '-'}${Utils.formatCurrency(displayAmount)}</span>` : '<span class="text-muted">-</span>'}
                        </td>
                      ` : ''}
                      <td class="text-center" style="color:var(--accent-light)">${partyDisplayAmount ? Utils.formatCurrency(partyDisplayAmount) : '-'}</td>
                      <td class="text-center">${notesHtml}${mathNotes}</td>
                      <td class="text-center">
                        <div class="table-actions" style="justify-content:center">
                          <button class="btn btn-ghost btn-icon" onclick="Transactions.openEditModal('${t.type}', '${t.id}')" title="Edit">${Utils.icons.edit}</button>
                          <button class="btn btn-ghost btn-icon text-danger" onclick="Transactions.deleteTransaction('${t.type}', '${t.id}')" title="Delete">${Utils.icons.trash}</button>
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
      filtered = Calculations.getAccountTransactions(this.accountFilter);
    }

    const totals = Calculations.getMainTransactionTotals(allTrans);
    const parties = this.getParties();

    return `


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
          <button class="btn btn-outline btn-sm" onclick="Transactions.toggleSortOrder()" style="font-weight:600" title="Toggle date sorting order">
            ${this.sortOrder === 'asc' ? '📅 ⬆️ Oldest First' : '📅 ⬇️ Newest First'}
          </button>
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
    if (type === 'income') {
      Income.openModal(null, presetParty);
    } else {
      Expense.openModal(null, presetParty);
    }
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
    
    if (type === 'income') {
      Income.openModal(record);
    } else {
      Expense.openModal(record);
    }
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

    // Revert account balances (supports both multi-account and legacy single-account)
    if (record.accounts && record.accounts.length > 0) {
      record.accounts.forEach(accEntry => {
        if (accEntry.accountId) {
          const account = DB.getById(DB.COLLECTIONS.ACCOUNTS, accEntry.accountId);
          if (account) {
            const revertChange = (accEntry.type || (isIncome ? 'income' : 'expense')) === 'income' ? -Utils.parseNum(accEntry.amount) : Utils.parseNum(accEntry.amount);
            DB.update(DB.COLLECTIONS.ACCOUNTS, accEntry.accountId, {
              balance: Utils.parseNum(account.balance) + revertChange
            });
          }
        }
      });
    } else if (record.accountId) {
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
