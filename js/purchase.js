/* ==========================================
   VYAPAR PWA — PURCHASE MODULE
   ========================================== */

const Purchase = {
  searchTerm: '',
  billItems: [],

  render() {
    const purchases = DB.getAll(DB.COLLECTIONS.PURCHASES);
    const filtered = Utils.filterBySearch(purchases, this.searchTerm, ['billNumber', 'partyName']).reverse();

    return `
      <div class="toolbar">
        <div class="toolbar-left">
          <div class="search-bar" style="flex:1;max-width:300px">
            ${Utils.icons.search}
            <input type="text" placeholder="Search purchase bills..." value="${this.searchTerm}" 
                   oninput="Purchase.search(this.value)">
          </div>
        </div>
        <div class="toolbar-right">
          <button class="btn btn-primary" onclick="Purchase.openNewBill()">
            ${Utils.icons.plus} New Purchase
          </button>
        </div>
      </div>

      ${filtered.length === 0 ? `
        <div class="empty-state">
          ${Utils.icons.purchase}
          <h3>No Purchase Bills Yet</h3>
          <p>Record your first purchase</p>
          <button class="btn btn-primary" onclick="Purchase.openNewBill()">${Utils.icons.plus} New Purchase</button>
        </div>
      ` : `
        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Bill #</th>
                <th>Date</th>
                <th>Supplier</th>
                <th class="text-right">Amount</th>
                <th class="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${filtered.map(bill => `
                <tr>
                  <td class="font-bold text-info">${bill.billNumber}</td>
                  <td>${Utils.formatDate(bill.date)}</td>
                  <td>
                    <div class="flex items-center gap-1">
                      <div class="avatar supplier">${Utils.getInitials(bill.partyName)}</div>
                      ${Utils.escapeHtml(bill.partyName || 'Unknown')}
                    </div>
                  </td>
                  <td class="text-right"><span class="amount debit">${Utils.formatCurrency(bill.grandTotal)}</span></td>
                  <td>
                    <div class="table-actions">
                      <button class="btn btn-ghost btn-icon" onclick="Purchase.viewBill('${bill.id}')" title="View">${Utils.icons.eye}</button>
                      <button class="btn btn-ghost btn-icon" onclick="Purchase.deleteBill('${bill.id}')" title="Delete">${Utils.icons.trash}</button>
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

  search(term) {
    this.searchTerm = term;
    App.refreshPage();
  },

  openNewBill() {
    this.billItems = [{ itemId: '', quantity: 1, rate: 0, gstPercent: 0, amount: 0 }];
    const suppliers = DB.getParties('supplier');
    const items = DB.getAll(DB.COLLECTIONS.ITEMS);
    const counter = DB.incrementCounter('purchases');
    const settings = DB.getSettings();
    const billNum = Utils.generateInvoiceNumber(settings.purchasePrefix, counter);

    App.showModal('New Purchase Bill', `
      <form id="purchaseForm" autocomplete="off" onsubmit="Purchase.saveBill(event)">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Bill Number</label>
            <input type="text" class="form-input" name="billNumber" value="${billNum}" required>
          </div>
          <div class="form-group">
            <label class="form-label">Date</label>
            <input type="date" class="form-input" name="date" value="${Utils.today()}" required>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Supplier *</label>
            <select class="form-select" name="partyId" required>
              <option value="">Select Supplier</option>
              ${suppliers.map(s => `<option value="${s.id}">${Utils.escapeHtml(s.name)}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Payment Account</label>
            <select class="form-select" name="accountId">
              <option value="">Select Account</option>
              ${DB.getAll(DB.COLLECTIONS.ACCOUNTS).map(a => `<option value="${a.id}">${Utils.escapeHtml(a.name)} (${Utils.formatCurrency(a.balance)})</option>`).join('')}
            </select>
          </div>
        </div>

        <div class="section-header mt-2">
          <div class="section-title">Items</div>
          <button type="button" class="btn btn-sm btn-outline" onclick="Purchase.addItemRow()">
            ${Utils.icons.plus} Add Item
          </button>
        </div>
        <div id="purchaseItemsContainer">
          ${this._renderItemRows(items)}
        </div>
        <div id="purchaseTotals">
          ${this._renderTotals()}
        </div>

        <div class="modal-footer" style="padding:16px 0 0;border-top:1px solid var(--border)">
          <button type="button" class="btn btn-outline" onclick="App.closeModal()">Cancel</button>
          <button type="submit" class="btn btn-success">💾 Save Purchase</button>
        </div>
      </form>
    `, 'modal-lg');
  },

  _renderItemRows(items = null) {
    if (!items) items = DB.getAll(DB.COLLECTIONS.ITEMS);
    return `
      <div class="invoice-items">
        <div class="invoice-item-row header">
          <div>Item</div><div>Qty</div><div>Rate</div><div>Amount</div><div></div>
        </div>
        ${this.billItems.map((item, idx) => `
          <div class="invoice-item-row" data-index="${idx}">
            <select onchange="Purchase.onItemSelect(${idx}, this.value)" style="min-width:120px">
              <option value="">Select item</option>
              ${items.map(i => `<option value="${i.id}" ${i.id === item.itemId ? 'selected' : ''}>${Utils.escapeHtml(i.name)}</option>`).join('')}
            </select>
            <input type="number" value="${item.quantity}" min="1" onchange="Purchase.onQtyChange(${idx}, this.value)" style="width:70px">
            <input type="number" value="${item.rate}" step="0.01" onchange="Purchase.onRateChange(${idx}, this.value)" style="width:100px">
            <div class="font-bold" style="padding:8px">${Utils.formatCurrency(item.amount)}</div>
            <button type="button" class="btn btn-ghost btn-icon" onclick="Purchase.removeItemRow(${idx})">${Utils.icons.close}</button>
          </div>
        `).join('')}
      </div>
    `;
  },

  _renderTotals() {
    const subtotal = this.billItems.reduce((sum, i) => sum + i.amount, 0);
    const gstTotal = this.billItems.reduce((sum, i) => sum + (i.amount * i.gstPercent / 100), 0);
    const grandTotal = subtotal + gstTotal;
    return `
      <div class="invoice-totals">
        <div class="invoice-total-row"><span>Subtotal:</span><span>${Utils.formatCurrency(subtotal)}</span></div>
        <div class="invoice-total-row"><span>GST:</span><span>${Utils.formatCurrency(gstTotal)}</span></div>
        <div class="invoice-total-row grand-total"><span>Grand Total:</span><span>${Utils.formatCurrency(grandTotal)}</span></div>
      </div>
    `;
  },

  _refreshUI() {
    const items = DB.getAll(DB.COLLECTIONS.ITEMS);
    const container = document.getElementById('purchaseItemsContainer');
    const totals = document.getElementById('purchaseTotals');
    if (container) container.innerHTML = this._renderItemRows(items);
    if (totals) totals.innerHTML = this._renderTotals();
  },

  addItemRow() {
    this.billItems.push({ itemId: '', quantity: 1, rate: 0, gstPercent: 0, amount: 0 });
    this._refreshUI();
  },

  removeItemRow(idx) {
    if (this.billItems.length <= 1) return;
    this.billItems.splice(idx, 1);
    this._refreshUI();
  },

  onItemSelect(idx, itemId) {
    const item = DB.getById(DB.COLLECTIONS.ITEMS, itemId);
    if (item) {
      this.billItems[idx].itemId = itemId;
      this.billItems[idx].rate = Utils.parseNum(item.purchasePrice);
      this.billItems[idx].gstPercent = Utils.parseNum(item.gstPercent);
      this.billItems[idx].amount = this.billItems[idx].quantity * this.billItems[idx].rate;
    }
    this._refreshUI();
  },

  onQtyChange(idx, val) {
    this.billItems[idx].quantity = Utils.parseNum(val);
    this.billItems[idx].amount = this.billItems[idx].quantity * this.billItems[idx].rate;
    this._refreshUI();
  },

  onRateChange(idx, val) {
    this.billItems[idx].rate = Utils.parseNum(val);
    this.billItems[idx].amount = this.billItems[idx].quantity * this.billItems[idx].rate;
    this._refreshUI();
  },

  saveBill(e) {
    e.preventDefault();
    const form = new FormData(e.target);
    const partyId = form.get('partyId');
    const party = DB.getById(DB.COLLECTIONS.PARTIES, partyId);

    const validItems = this.billItems.filter(i => i.itemId && i.amount > 0);
    if (validItems.length === 0) {
      App.toast('Please add at least one item', 'error');
      return;
    }

    const subtotal = validItems.reduce((sum, i) => sum + i.amount, 0);
    const gstTotal = validItems.reduce((sum, i) => sum + (i.amount * i.gstPercent / 100), 0);

    const accountId = form.get('accountId');
    const grandTotal = subtotal + gstTotal;

    const bill = {
      billNumber: form.get('billNumber'),
      date: form.get('date'),
      partyId,
      partyName: party ? party.name : 'Unknown',
      accountId: accountId || '',
      items: validItems,
      subtotal,
      gstTotal,
      grandTotal
    };

    DB.add(DB.COLLECTIONS.PURCHASES, bill);

    // Update account balance if selected
    if (accountId) {
      const acc = DB.getById(DB.COLLECTIONS.ACCOUNTS, accountId);
      if (acc) {
        DB.update(DB.COLLECTIONS.ACCOUNTS, accountId, {
          balance: Utils.parseNum(acc.balance) - grandTotal
        });
      }
    }

    // Update stock (add)
    validItems.forEach(item => {
      DB.updateStock(item.itemId, item.quantity);
    });

    App.toast('Purchase bill saved! 🛒', 'success');
    App.closeModal();
    App.refreshPage();
  },

  viewBill(id) {
    const bill = DB.getById(DB.COLLECTIONS.PURCHASES, id);
    if (!bill) return;
    const party = DB.getById(DB.COLLECTIONS.PARTIES, bill.partyId);

    App.showModal(`Purchase Bill ${bill.billNumber}`, `
      <div class="card" style="background:var(--bg-card)">
        <p><strong>Supplier:</strong> ${Utils.escapeHtml(party?.name || bill.partyName)}</p>
        <p><strong>Date:</strong> ${Utils.formatDate(bill.date)}</p>
        <div class="divider"></div>
        <div class="table-container" style="margin-top:12px">
          <table class="data-table">
            <thead><tr><th>#</th><th>Item</th><th class="text-right">Qty</th><th class="text-right">Rate</th><th class="text-right">Amount</th></tr></thead>
            <tbody>
              ${bill.items.map((item, idx) => {
                const dbItem = DB.getById(DB.COLLECTIONS.ITEMS, item.itemId);
                return `<tr><td>${idx+1}</td><td>${Utils.escapeHtml(dbItem?.name || 'Item')}</td><td class="text-right">${item.quantity}</td><td class="text-right">${Utils.formatCurrency(item.rate)}</td><td class="text-right font-bold">${Utils.formatCurrency(item.amount)}</td></tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
        <div class="invoice-totals">
          <div class="invoice-total-row"><span>Subtotal:</span><span>${Utils.formatCurrency(bill.subtotal)}</span></div>
          <div class="invoice-total-row"><span>GST:</span><span>${Utils.formatCurrency(bill.gstTotal)}</span></div>
          <div class="invoice-total-row grand-total"><span>Total:</span><span>${Utils.formatCurrency(bill.grandTotal)}</span></div>
        </div>
      </div>
    `, 'modal-lg');
  },

  deleteBill(id) {
    if (!confirm('Delete this purchase bill?')) return;
    DB.delete(DB.COLLECTIONS.PURCHASES, id);
    App.toast('Purchase bill deleted', 'warning');
    App.refreshPage();
  }
};
