/* ==========================================
   VYAPAR PWA — EXPENSE MODULE
   ========================================== */

const Expense = {
  accountsList: [],
  partiesList: [],
  lastSelectedType: 'expense', // Default for Expense window

  openModal(record = null, presetParty = '') {
    const isEdit = record !== null;
    const parties = Transactions.getParties();
    const showInMainDefault = isEdit ? !record.isPartyOnly : true;

    // Get sticky types
    const stickyAccType = localStorage.getItem('vyapar_sticky_exp_acc_type') || 'expense';
    const stickyPartyType = localStorage.getItem('vyapar_sticky_exp_party_type') || 'expense';

    // Initialize accounts array
    if (record && record.accounts && record.accounts.length > 0) {
      this.accountsList = JSON.parse(JSON.stringify(record.accounts));
      // Fallback for old records
      this.accountsList.forEach(a => { if (!a.type) a.type = 'expense'; });
    } else if (record && record.accountId) {
      this.accountsList = [{ accountId: record.accountId, amount: record.amount, type: 'expense' }];
    } else {
      this.accountsList = [{ accountId: '', amount: 0, type: stickyAccType }];
    }

    // Initialize parties array
    if (record && record.parties && record.parties.length > 0) {
      this.partiesList = JSON.parse(JSON.stringify(record.parties));
      this.partiesList.forEach(p => { if (!p.type) p.type = 'expense'; });
    } else if (record && record.party && record.party !== 'General') {
      this.partiesList = [{ partyName: record.party, amount: record.amount, type: 'expense' }];
    } else if (presetParty) {
      this.partiesList = [{ partyName: presetParty, amount: 0, type: stickyPartyType }];
    } else {
      this.partiesList = [{ partyName: '', amount: 0, type: stickyPartyType }];
    }

    App.showModal(
      isEdit ? '✏️ Modify Expense' : '💸 Add Expense',
      `
      <form id="expenseForm" autocomplete="off" onsubmit="Expense.save(event, ${isEdit ? `'${record.id}'` : 'null'})">
        <input type="hidden" name="transType" value="expense">

        <!-- Row 2: Item Name -->
        <div style="margin-bottom:12px">
          <label class="form-label" style="margin-bottom:6px; font-size:0.75rem">Item Name</label>
          <input type="text" class="form-input" name="itemName" autocomplete="off" value="${isEdit ? Utils.escapeHtml(record.itemName || '') : ''}" placeholder="e.g. Purchases" style="height:38px; padding:4px 8px">
        </div>

        <!-- Parties Container -->
        <div style="margin-bottom:12px; border:1px solid var(--border); border-radius:var(--radius-sm); padding:10px; background:rgba(255,255,255,0.02)">
          <label class="form-label" style="margin-bottom:8px; font-size:0.8rem; font-weight:700">Parties & Amounts</label>
          <div id="expensePartiesContainer"></div>
        </div>

        <!-- Accounts Container -->
        <div style="margin-bottom:12px; border:1px solid var(--border); border-radius:var(--radius-sm); padding:10px; background:rgba(255,255,255,0.02)">
          <label class="form-label" style="margin-bottom:8px; font-size:0.8rem; font-weight:700">Accounts & Amounts</label>
          <div id="expenseAccountsContainer"></div>
        </div>

        <!-- Row 4: Date & Notes -->
        <div style="display:flex; gap:12px; margin-bottom:12px">
          <div style="flex:1; max-width:130px">
            <label class="form-label" style="margin-bottom:6px; font-size:0.75rem">Date</label>
            <input type="date" class="form-input" name="date" value="${isEdit ? record.date : (localStorage.getItem('vyapar_sticky_date') || Utils.today())}" style="height:38px; padding:4px 8px">
          </div>
          <div style="flex:1">
            <label class="form-label" style="margin-bottom:6px; font-size:0.75rem">Notes</label>
            <input type="text" class="form-input" name="notes" placeholder="Any details..." value="${isEdit ? Utils.escapeHtml(record.notes || '') : ''}" style="height:38px; padding:4px 8px">
          </div>
        </div>

        <div style="background:rgba(255,255,255,0.03);padding:8px 12px;border-radius:var(--radius-sm);border:1px solid var(--border); margin-bottom:12px">
          <label class="flex items-center gap-2" style="cursor:pointer;font-size:0.8rem;margin:0">
            <input type="checkbox" name="showInMain" value="true" ${showInMainDefault ? 'checked' : ''}>
            <span>👁️ Main Transactions list me dikhayein</span>
          </label>
        </div>

        <div class="modal-footer" style="padding:12px 0 0;border-top:1px solid var(--border); margin-top:0">
          <button type="button" class="btn btn-outline" onclick="App.closeModal()">Cancel</button>
          <button type="submit" class="btn btn-danger">${isEdit ? 'Save Changes' : '💸 Save Expense'}</button>
        </div>
      </form>
    `
    );

    this.renderAccountRows();
    this.renderPartyRows();
  },

  renderPartyRows() {
    const container = document.getElementById('expensePartiesContainer');
    if (!container) return;
    const allParties = Transactions.getParties();
    
    let html = '';
    this.partiesList.forEach((partyItem, idx) => {
      html += `
        <div style="display:flex; gap:6px; margin-bottom:8px; align-items:center;">
          <div style="width:50px">
            <select class="form-select" style="height:38px; padding:4px; font-weight:bold; color: ${partyItem.type === 'income' ? 'var(--success)' : 'var(--danger)'}" onchange="Expense.updatePartyRow(${idx}, 'type', this.value)">
              <option value="income" ${partyItem.type === 'income' ? 'selected' : ''}>I</option>
              <option value="expense" ${partyItem.type === 'expense' ? 'selected' : ''}>E</option>
            </select>
          </div>
          <div style="flex:2">
            <select class="form-select" style="height:38px; padding:4px 8px" onchange="Expense.updatePartyRow(${idx}, 'partyName', this.value)">
              <option value="">-- Select Party --</option>
              ${allParties.map(p => `<option value="${Utils.escapeHtml(p)}" ${partyItem.partyName === p ? 'selected' : ''}>${Utils.escapeHtml(p)}</option>`).join('')}
              <option value="_NEW_" style="font-weight:bold; color:var(--accent)">+ Add New Party...</option>
            </select>
          </div>
          <div style="flex:1">
            <input type="number" step="1" min="0" class="form-input" style="height:38px; padding:4px 8px" placeholder="Amount" value="${partyItem.amount || ''}" oninput="Expense.updatePartyRow(${idx}, 'amount', this.value)">
          </div>
          ${this.partiesList.length > 1 ? `
            <button type="button" class="btn btn-ghost btn-icon" style="color:var(--danger); padding:0 4px" onclick="Expense.removePartyRow(${idx})">✖</button>
          ` : `<div style="width:24px"></div>`}
        </div>
      `;
    });
    
    html += `<button type="button" class="btn btn-outline btn-sm mt-1" onclick="Expense.addPartyRow()">+ Add Another Party</button>`;
    container.innerHTML = html;
  },

  updatePartyRow(idx, field, value) {
    if (field === 'amount') {
      this.partiesList[idx].amount = parseFloat(value) || 0;
    } else if (field === 'type') {
      this.partiesList[idx].type = value;
      localStorage.setItem('vyapar_sticky_exp_party_type', value);
      this.renderPartyRows();
    } else {
      if (value === '_NEW_') {
        const newParty = prompt('Enter new party name:');
        if (newParty && newParty.trim()) {
          this.partiesList[idx].partyName = newParty.trim();
          // Add to DB temporarily so it appears in the dropdown immediately
          if (!DB.getAll(DB.COLLECTIONS.PARTIES).some(p => p.name.toLowerCase() === newParty.trim().toLowerCase())) {
            DB.add(DB.COLLECTIONS.PARTIES, { name: newParty.trim(), type: 'supplier', phone: '', notes: '' });
          }
        } else {
          this.partiesList[idx].partyName = '';
        }
        this.renderPartyRows();
      } else {
        this.partiesList[idx].partyName = value;
      }
    }
  },

  addPartyRow() {
    const stickyType = localStorage.getItem('vyapar_sticky_exp_party_type') || 'expense';
    this.partiesList.push({ partyName: '', amount: 0, type: stickyType });
    this.renderPartyRows();
  },

  removePartyRow(idx) {
    this.partiesList.splice(idx, 1);
    this.renderPartyRows();
  },

  renderAccountRows() {
    const container = document.getElementById('expenseAccountsContainer');
    if (!container) return;
    const allAccounts = DB.getAll(DB.COLLECTIONS.ACCOUNTS);
    
    let html = '';
    this.accountsList.forEach((accItem, idx) => {
      html += `
        <div style="display:flex; gap:6px; margin-bottom:8px; align-items:center;">
          <div style="width:50px">
            <select class="form-select" style="height:38px; padding:4px; font-weight:bold; color: ${accItem.type === 'income' ? 'var(--success)' : 'var(--danger)'}" onchange="Expense.updateAccountRow(${idx}, 'type', this.value)">
              <option value="income" ${accItem.type === 'income' ? 'selected' : ''}>I</option>
              <option value="expense" ${accItem.type === 'expense' ? 'selected' : ''}>E</option>
            </select>
          </div>
          <div style="flex:2">
            <select class="form-select" style="height:38px; padding:4px 8px" onchange="Expense.updateAccountRow(${idx}, 'accountId', this.value)">
              <option value="">-- Select Account --</option>
              ${allAccounts.map(a => `<option value="${a.id}" ${a.id === accItem.accountId ? 'selected' : ''}>${Utils.escapeHtml(a.name)}</option>`).join('')}
            </select>
          </div>
          <div style="flex:1">
            <input type="number" step="1" min="0" class="form-input" style="height:38px; padding:4px 8px" placeholder="Amount" value="${accItem.amount || ''}" oninput="Expense.updateAccountRow(${idx}, 'amount', this.value)">
          </div>
          ${this.accountsList.length > 1 ? `
            <button type="button" class="btn btn-ghost btn-icon" style="color:var(--danger); padding:0 4px" onclick="Expense.removeAccountRow(${idx})">✖</button>
          ` : `<div style="width:24px"></div>`}
        </div>
      `;
    });
    
    html += `<button type="button" class="btn btn-outline btn-sm mt-1" onclick="Expense.addAccountRow()">+ Add Another Account</button>`;
    container.innerHTML = html;
  },

  updateAccountRow(idx, field, value) {
    if (field === 'amount') {
      this.accountsList[idx].amount = parseFloat(value) || 0;
    } else if (field === 'type') {
      this.accountsList[idx].type = value;
      localStorage.setItem('vyapar_sticky_exp_acc_type', value);
      this.renderAccountRows();
    } else {
      this.accountsList[idx].accountId = value;
    }
  },

  addAccountRow() {
    const stickyType = localStorage.getItem('vyapar_sticky_exp_acc_type') || 'expense';
    this.accountsList.push({ accountId: '', amount: 0, type: stickyType });
    this.renderAccountRows();
  },

  removeAccountRow(idx) {
    this.accountsList.splice(idx, 1);
    this.renderAccountRows();
  },

  save(e, existingId = null) {
    e.preventDefault();
    const form = new FormData(e.target);
    const targetCollection = DB.COLLECTIONS.EXPENSES;

    const price = 0; // Price field removed from form; kept for backward compatibility

    const rawItem = form.get('itemName');
    const itemName = rawItem && rawItem.trim() !== '' ? rawItem.trim() : 'Expense Item';

    const isPartyOnly = form.get('showInMain') !== 'true';

    // Prepare valid accounts array
    const validAccounts = this.accountsList.filter(a => a.accountId && a.amount > 0).map(a => {
      const acc = DB.getById(DB.COLLECTIONS.ACCOUNTS, a.accountId);
      return { 
        accountId: a.accountId, 
        accountName: acc ? acc.name : '', 
        amount: a.amount,
        type: a.type
      };
    });

    // Calculate net amount (expense - income) since this is the Expense window
    const totalAmount = validAccounts.reduce((sum, a) => sum + (a.type === 'expense' ? a.amount : -a.amount), 0);

    // Prepare valid parties array
    const validParties = this.partiesList.filter(p => p.partyName && p.partyName.trim() !== '' && p.amount > 0).map(p => ({
      partyName: p.partyName.trim(),
      amount: p.amount,
      type: p.type
    }));

    // Auto-create party records if they don't exist
    const existingDbParties = DB.getAll(DB.COLLECTIONS.PARTIES);
    validParties.forEach(vp => {
      const exists = existingDbParties.some(p => p.name.toLowerCase() === vp.partyName.toLowerCase());
      if (!exists) {
        DB.add(DB.COLLECTIONS.PARTIES, { name: vp.partyName, type: 'supplier', phone: '', notes: '' });
        existingDbParties.push({ name: vp.partyName, type: 'supplier' });
      }
    });

    const entryDate = form.get('date') || Utils.today();
    localStorage.setItem('vyapar_sticky_date', entryDate);

    const updatedData = {
      type: 'expense', // Overall entry type
      itemName,
      amount: totalAmount, // global net amount
      price,
      date: entryDate,
      party: validParties.length === 1 ? validParties[0].partyName : (validParties.length > 1 ? 'Multiple' : 'General'),
      parties: validParties,
      accounts: validAccounts,
      notes: form.get('notes'),
      isPartyOnly
    };

    // Revert old account balances if editing
    if (existingId) {
      const oldRecord = DB.getById(targetCollection, existingId) || DB.getById(DB.COLLECTIONS.INCOMES, existingId);
      if (oldRecord) {
        // Find if old record was globally income or expense
        const isOldIncome = DB.getById(DB.COLLECTIONS.INCOMES, existingId) !== null;
        const oldAccounts = oldRecord.accounts || (oldRecord.accountId ? [{ accountId: oldRecord.accountId, amount: oldRecord.amount, type: isOldIncome ? 'income' : 'expense' }] : []);
        
        oldAccounts.forEach(oldAcc => {
          if (oldAcc.accountId) {
            const accObj = DB.getById(DB.COLLECTIONS.ACCOUNTS, oldAcc.accountId);
            if (accObj) {
              const revertChange = (oldAcc.type || (isOldIncome ? 'income' : 'expense')) === 'income' ? -Utils.parseNum(oldAcc.amount) : Utils.parseNum(oldAcc.amount);
              DB.update(DB.COLLECTIONS.ACCOUNTS, oldAcc.accountId, {
                balance: Utils.parseNum(accObj.balance) + revertChange
              });
            }
          }
        });

        if (DB.getById(DB.COLLECTIONS.INCOMES, existingId)) {
          DB.delete(DB.COLLECTIONS.INCOMES, existingId);
          DB.add(targetCollection, updatedData);
        } else {
          DB.update(targetCollection, existingId, updatedData);
        }
      }

      // Apply new balances
      validAccounts.forEach(newAcc => {
        const accObj = DB.getById(DB.COLLECTIONS.ACCOUNTS, newAcc.accountId);
        if (accObj) {
          const change = newAcc.type === 'income' ? newAcc.amount : -newAcc.amount;
          DB.update(DB.COLLECTIONS.ACCOUNTS, newAcc.accountId, {
            balance: Utils.parseNum(accObj.balance) + change
          });
        }
      });
      App.toast('Expense updated! 💸', 'success');

    } else {
      DB.add(targetCollection, updatedData);

      // Apply new balances
      validAccounts.forEach(newAcc => {
        const accObj = DB.getById(DB.COLLECTIONS.ACCOUNTS, newAcc.accountId);
        if (accObj) {
          const change = newAcc.type === 'income' ? newAcc.amount : -newAcc.amount;
          DB.update(DB.COLLECTIONS.ACCOUNTS, newAcc.accountId, {
            balance: Utils.parseNum(accObj.balance) + change
          });
        }
      });
      App.toast('Expense saved! 💸', 'success');
    }

    App.closeModal();
    App.refreshPage();
  }
};
