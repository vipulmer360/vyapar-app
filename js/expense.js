/* ==========================================
   VYAPAR PWA — EXPENSE MODULE
   ========================================== */

const Expense = {
  
  openModal(record = null, presetParty = '') {
    const isEdit = record !== null;
    const accounts = DB.getAll(DB.COLLECTIONS.ACCOUNTS);
    const parties = Transactions.getParties();
    const partyVal = isEdit ? (record.party || '') : presetParty;
    const isPartyOnlyDefault = isEdit ? (record.isPartyOnly || false) : (presetParty ? true : false);

    App.showModal(
      isEdit ? '✏️ Modify Expense' : '💸 Add Expense',
      `
      <form id="expenseForm" autocomplete="off" onsubmit="Expense.save(event, ${isEdit ? `'${record.id}'` : 'null'})">
        <input type="hidden" name="transType" value="expense">
        
        <!-- Row 1: Amount -->
        <div style="display:flex; gap:12px; margin-bottom:12px">
          <div style="flex:1">
            <label class="form-label" style="margin-bottom:6px; font-size:0.75rem">Total Amount</label>
            <input type="number" class="form-input" name="amount" step="0.01" min="0" value="${isEdit ? record.amount : ''}" placeholder="0.00" style="font-size:1.4rem; font-weight:800; height:60px; padding:8px; color:var(--danger)">
          </div>
        </div>

        <!-- Row 2: Item Name & Price -->
        <div style="display:flex; gap:12px; margin-bottom:12px">
          <div style="flex:2">
            <label class="form-label" style="margin-bottom:6px; font-size:0.75rem">Item Name</label>
            <input type="text" class="form-input" name="itemName" autocomplete="off" value="${isEdit ? Utils.escapeHtml(record.itemName || '') : ''}" placeholder="e.g. Purchases" style="height:38px; padding:4px 8px">
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
          <button type="submit" class="btn btn-danger">${isEdit ? 'Save Changes' : '💸 Save Expense'}</button>
        </div>
      </form>
    `
    );
  },

  save(e, existingId = null) {
    e.preventDefault();
    const form = new FormData(e.target);
    const targetCollection = DB.COLLECTIONS.EXPENSES;

    const rawAccount = form.get('accountId');
    const accountId = rawAccount && rawAccount.trim() !== '' ? rawAccount : '';

    const rawPrice = form.get('price');
    const price = rawPrice !== null && rawPrice.trim() !== '' ? (parseFloat(rawPrice) || 0) : 0;

    const rawAmount = form.get('amount');
    const amount = rawAmount !== null && rawAmount.trim() !== '' ? (parseFloat(rawAmount) || 0) : 0;

    const rawItem = form.get('itemName');
    const itemName = rawItem && rawItem.trim() !== '' ? rawItem.trim() : 'Expense Item';

    const rawParty = form.get('party');
    const partyName = rawParty && rawParty.trim() !== '' ? rawParty.trim() : 'General';
    const isPartyOnly = form.get('isPartyOnly') === 'true';
    const account = accountId ? DB.getById(DB.COLLECTIONS.ACCOUNTS, accountId) : null;

    if (partyName && partyName !== 'General') {
      const existingParties = DB.getAll(DB.COLLECTIONS.PARTIES);
      const exists = existingParties.some(p => p.name.toLowerCase() === partyName.toLowerCase());
      if (!exists) {
        DB.add(DB.COLLECTIONS.PARTIES, { name: partyName, type: 'supplier', phone: '', notes: '' });
      }
    }

    const updatedData = {
      itemName,
      amount,
      price,
      date: form.get('date') || Utils.today(),
      party: partyName,
      accountId,
      accountName: account ? account.name : '',
      notes: form.get('notes'),
      isPartyOnly
    };

    if (existingId) {
      const oldRecord = DB.getById(targetCollection, existingId) || DB.getById(DB.COLLECTIONS.INCOMES, existingId);
      if (oldRecord) {
        if (oldRecord.accountId) {
          const oldAccount = DB.getById(DB.COLLECTIONS.ACCOUNTS, oldRecord.accountId);
          if (oldAccount) {
            const isOldIncome = DB.getById(DB.COLLECTIONS.INCOMES, existingId) !== null;
            const revertChange = isOldIncome ? -Utils.parseNum(oldRecord.amount) : Utils.parseNum(oldRecord.amount);
            DB.update(DB.COLLECTIONS.ACCOUNTS, oldRecord.accountId, {
              balance: Utils.parseNum(oldAccount.balance) + revertChange
            });
          }
        }
        
        if (DB.getById(DB.COLLECTIONS.INCOMES, existingId)) {
          DB.delete(DB.COLLECTIONS.INCOMES, existingId);
          DB.add(targetCollection, updatedData);
        } else {
          DB.update(targetCollection, existingId, updatedData);
        }
      }

      const updatedAccount = DB.getById(DB.COLLECTIONS.ACCOUNTS, accountId);
      if (updatedAccount) {
        DB.update(DB.COLLECTIONS.ACCOUNTS, accountId, {
          balance: Utils.parseNum(updatedAccount.balance) - amount
        });
      }
      App.toast('Expense updated! 💸', 'success');

    } else {
      DB.add(targetCollection, updatedData);

      if (account) {
        DB.update(DB.COLLECTIONS.ACCOUNTS, accountId, {
          balance: Utils.parseNum(account.balance) - amount
        });
      }
      App.toast('Expense saved! 💸', 'success');
    }

    App.closeModal();
    App.refreshPage();
  }
};
