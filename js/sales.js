/* ==========================================
   VYAPAR PWA — SALES INVOICE MODULE
   ========================================== */

const Sales = {
  searchTerm: '',
  invoiceItems: [],

  render() {
    const sales = DB.getAll(DB.COLLECTIONS.SALES);
    const filtered = Utils.filterBySearch(sales, this.searchTerm, ['invoiceNumber', 'partyName']).reverse();

    return `
      <div class="toolbar">
        <div class="toolbar-left">
          <div class="search-bar" style="flex:1;max-width:300px">
            ${Utils.icons.search}
            <input type="text" placeholder="Search invoices..." value="${this.searchTerm}" 
                   oninput="Sales.search(this.value)">
          </div>
        </div>
        <div class="toolbar-right">
          <button class="btn btn-primary" onclick="Sales.openNewInvoice()">
            ${Utils.icons.plus} New Invoice
          </button>
        </div>
      </div>

      ${filtered.length === 0 ? `
        <div class="empty-state">
          ${Utils.icons.sales}
          <h3>No Invoices Yet</h3>
          <p>Create your first sales invoice</p>
          <button class="btn btn-primary" onclick="Sales.openNewInvoice()">${Utils.icons.plus} New Invoice</button>
        </div>
      ` : `
        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Invoice #</th>
                <th>Date</th>
                <th>Customer</th>
                <th class="text-right">Amount</th>
                <th class="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${filtered.map(sale => `
                <tr>
                  <td class="font-bold text-accent">${sale.invoiceNumber}</td>
                  <td>${Utils.formatDate(sale.date)}</td>
                  <td>
                    <div class="flex items-center gap-1">
                      <div class="avatar customer">${Utils.getInitials(sale.partyName)}</div>
                      ${Utils.escapeHtml(sale.partyName || 'Cash Sale')}
                    </div>
                  </td>
                  <td class="text-right"><span class="amount credit">${Utils.formatCurrency(sale.grandTotal)}</span></td>
                  <td>
                    <div class="table-actions">
                      <button class="btn btn-ghost btn-icon" onclick="Sales.viewInvoice('${sale.id}')" title="View">${Utils.icons.eye}</button>
                      <button class="btn btn-ghost btn-icon" onclick="Sales.printInvoice('${sale.id}')" title="Print">${Utils.icons.printer}</button>
                      <button class="btn btn-ghost btn-icon" onclick="Sales.deleteInvoice('${sale.id}')" title="Delete">${Utils.icons.trash}</button>
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

  openNewInvoice() {
    this.invoiceItems = [{ itemId: '', quantity: 1, rate: 0, discount: 0, gstPercent: 0, amount: 0 }];
    const customers = DB.getParties('customer');
    const items = DB.getAll(DB.COLLECTIONS.ITEMS);
    const counter = DB.incrementCounter('sales');
    const settings = DB.getSettings();
    const invoiceNum = Utils.generateInvoiceNumber(settings.invoicePrefix, counter);

    App.showModal('Create Sales Invoice', `
      <form id="invoiceForm" autocomplete="off" onsubmit="Sales.saveInvoice(event)">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Invoice Number</label>
            <input type="text" class="form-input" name="invoiceNumber" value="${invoiceNum}" required>
          </div>
          <div class="form-group">
            <label class="form-label">Date</label>
            <input type="date" class="form-input" name="date" value="${Utils.today()}" required>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Customer *</label>
            <select class="form-select" name="partyId" required>
              <option value="">Select Customer</option>
              ${customers.map(c => `<option value="${c.id}">${Utils.escapeHtml(c.name)}</option>`).join('')}
            </select>
            <div class="form-helper">
              <a href="#" onclick="event.preventDefault();App.closeModal();App.navigate('parties');Parties.openAddParty()">+ Add New Customer</a>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Deposit Account</label>
            <select class="form-select" name="accountId">
              <option value="">Select Account</option>
              ${DB.getAll(DB.COLLECTIONS.ACCOUNTS).map(a => `<option value="${a.id}">${Utils.escapeHtml(a.name)} (${Utils.formatCurrency(a.balance)})</option>`).join('')}
            </select>
          </div>
        </div>

        <!-- Invoice Items -->
        <div class="section-header mt-2">
          <div class="section-title">Items</div>
          <button type="button" class="btn btn-sm btn-outline" onclick="Sales.addItemRow()">
            ${Utils.icons.plus} Add Item
          </button>
        </div>
        <div id="invoiceItemsContainer">
          ${this._renderItemRows(items)}
        </div>

        <!-- Totals -->
        <div id="invoiceTotals">
          ${this._renderTotals()}
        </div>

        <div class="form-group mt-2">
          <label class="form-label">Notes</label>
          <textarea class="form-textarea" name="notes" rows="2" placeholder="Any additional notes..."></textarea>
        </div>

        <div class="modal-footer" style="padding:16px 0 0;border-top:1px solid var(--border)">
          <button type="button" class="btn btn-outline" onclick="App.closeModal()">Cancel</button>
          <button type="submit" class="btn btn-success">💾 Save Invoice</button>
        </div>
      </form>
    `, 'modal-lg');
  },

  _renderItemRows(items = null) {
    if (!items) items = DB.getAll(DB.COLLECTIONS.ITEMS);

    return `
      <div class="invoice-items">
        <div class="invoice-item-row header">
          <div>Item</div>
          <div>Qty</div>
          <div>Rate</div>
          <div>Amount</div>
          <div></div>
        </div>
        ${this.invoiceItems.map((item, idx) => `
          <div class="invoice-item-row" data-index="${idx}">
            <select onchange="Sales.onItemSelect(${idx}, this.value)" style="min-width:120px">
              <option value="">Select item</option>
              ${items.map(i => `<option value="${i.id}" ${i.id === item.itemId ? 'selected' : ''}>${Utils.escapeHtml(i.name)} (${i.quantity} ${i.unit})</option>`).join('')}
            </select>
            <input type="number" value="${item.quantity}" min="1" onchange="Sales.onQtyChange(${idx}, this.value)" style="width:70px">
            <input type="number" value="${item.rate}" step="0.01" onchange="Sales.onRateChange(${idx}, this.value)" style="width:100px">
            <div class="font-bold" style="padding:8px">${Utils.formatCurrency(item.amount)}</div>
            <button type="button" class="btn btn-ghost btn-icon" onclick="Sales.removeItemRow(${idx})">${Utils.icons.close}</button>
          </div>
        `).join('')}
      </div>
    `;
  },

  _renderTotals() {
    const subtotal = this.invoiceItems.reduce((sum, i) => sum + i.amount, 0);
    const gstTotal = this.invoiceItems.reduce((sum, i) => sum + (i.amount * i.gstPercent / 100), 0);
    const grandTotal = subtotal + gstTotal;

    return `
      <div class="invoice-totals">
        <div class="invoice-total-row">
          <span>Subtotal:</span>
          <span>${Utils.formatCurrency(subtotal)}</span>
        </div>
        <div class="invoice-total-row">
          <span>GST:</span>
          <span>${Utils.formatCurrency(gstTotal)}</span>
        </div>
        <div class="invoice-total-row grand-total">
          <span>Grand Total:</span>
          <span>${Utils.formatCurrency(grandTotal)}</span>
        </div>
      </div>
    `;
  },

  _refreshInvoiceUI() {
    const items = DB.getAll(DB.COLLECTIONS.ITEMS);
    const container = document.getElementById('invoiceItemsContainer');
    const totals = document.getElementById('invoiceTotals');
    if (container) container.innerHTML = this._renderItemRows(items);
    if (totals) totals.innerHTML = this._renderTotals();
  },

  addItemRow() {
    this.invoiceItems.push({ itemId: '', quantity: 1, rate: 0, discount: 0, gstPercent: 0, amount: 0 });
    this._refreshInvoiceUI();
  },

  removeItemRow(idx) {
    if (this.invoiceItems.length <= 1) return;
    this.invoiceItems.splice(idx, 1);
    this._refreshInvoiceUI();
  },

  onItemSelect(idx, itemId) {
    const item = DB.getById(DB.COLLECTIONS.ITEMS, itemId);
    if (item) {
      this.invoiceItems[idx].itemId = itemId;
      this.invoiceItems[idx].rate = Utils.parseNum(item.salePrice);
      this.invoiceItems[idx].gstPercent = Utils.parseNum(item.gstPercent);
      this.invoiceItems[idx].amount = this.invoiceItems[idx].quantity * this.invoiceItems[idx].rate;
    }
    this._refreshInvoiceUI();
  },

  onQtyChange(idx, val) {
    this.invoiceItems[idx].quantity = Utils.parseNum(val);
    this.invoiceItems[idx].amount = this.invoiceItems[idx].quantity * this.invoiceItems[idx].rate;
    this._refreshInvoiceUI();
  },

  onRateChange(idx, val) {
    this.invoiceItems[idx].rate = Utils.parseNum(val);
    this.invoiceItems[idx].amount = this.invoiceItems[idx].quantity * this.invoiceItems[idx].rate;
    this._refreshInvoiceUI();
  },

  saveInvoice(e) {
    e.preventDefault();
    const form = new FormData(e.target);
    const partyId = form.get('partyId');
    const party = DB.getById(DB.COLLECTIONS.PARTIES, partyId);

    const validItems = this.invoiceItems.filter(i => i.itemId && i.amount > 0);
    if (validItems.length === 0) {
      App.toast('Please add at least one item', 'error');
      return;
    }

    const subtotal = validItems.reduce((sum, i) => sum + i.amount, 0);
    const gstTotal = validItems.reduce((sum, i) => sum + (i.amount * i.gstPercent / 100), 0);
    const grandTotal = subtotal + gstTotal;

    const accountId = form.get('accountId');

    const invoice = {
      invoiceNumber: form.get('invoiceNumber'),
      date: form.get('date'),
      partyId: partyId,
      partyName: party ? party.name : 'Cash Sale',
      accountId: accountId || '',
      items: validItems,
      subtotal,
      gstTotal,
      grandTotal,
      notes: form.get('notes')
    };

    DB.add(DB.COLLECTIONS.SALES, invoice);

    // Update account balance if selected
    if (accountId) {
      const acc = DB.getById(DB.COLLECTIONS.ACCOUNTS, accountId);
      if (acc) {
        DB.update(DB.COLLECTIONS.ACCOUNTS, accountId, {
          balance: Utils.parseNum(acc.balance) + grandTotal
        });
      }
    }

    // Update stock
    validItems.forEach(item => {
      DB.updateStock(item.itemId, -item.quantity);
    });

    App.toast('Invoice saved! 🧾', 'success');
    App.closeModal();
    App.refreshPage();
  },

  viewInvoice(id) {
    const sale = DB.getById(DB.COLLECTIONS.SALES, id);
    if (!sale) return;

    const party = DB.getById(DB.COLLECTIONS.PARTIES, sale.partyId);
    const settings = DB.getSettings();

    App.showModal(`Invoice ${sale.invoiceNumber}`, `
      <div style="background:white;color:#1a1a2e;padding:20px;border-radius:8px">
        <div style="display:flex;justify-content:space-between;border-bottom:2px solid #4f46e5;padding-bottom:12px;margin-bottom:16px">
          <div>
            <h2 style="color:#4f46e5;font-size:18px;margin-bottom:4px">${Utils.escapeHtml(settings.businessName)}</h2>
            <p style="font-size:11px;color:#666">${Utils.escapeHtml(settings.businessAddress || '')}</p>
            ${settings.gstin ? `<p style="font-size:11px;color:#666">GSTIN: ${settings.gstin}</p>` : ''}
          </div>
          <div style="text-align:right">
            <h3 style="color:#4f46e5;font-size:16px">TAX INVOICE</h3>
            <p style="font-size:11px;color:#666">No: <strong style="color:#1a1a2e">${sale.invoiceNumber}</strong></p>
            <p style="font-size:11px;color:#666">Date: <strong style="color:#1a1a2e">${Utils.formatDate(sale.date)}</strong></p>
          </div>
        </div>

        <div style="margin-bottom:16px">
          <h4 style="font-size:10px;text-transform:uppercase;color:#999;margin-bottom:4px">Bill To</h4>
          <p style="font-weight:700">${Utils.escapeHtml(party?.name || sale.partyName)}</p>
          <p style="font-size:11px;color:#666">${Utils.escapeHtml(party?.address || '')}</p>
          ${party?.gstin ? `<p style="font-size:11px;color:#666">GSTIN: ${party.gstin}</p>` : ''}
        </div>

        <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
          <thead>
            <tr style="background:#4f46e5;color:white">
              <th style="padding:8px;text-align:left;font-size:10px">#</th>
              <th style="padding:8px;text-align:left;font-size:10px">ITEM</th>
              <th style="padding:8px;text-align:right;font-size:10px">QTY</th>
              <th style="padding:8px;text-align:right;font-size:10px">RATE</th>
              <th style="padding:8px;text-align:right;font-size:10px">GST%</th>
              <th style="padding:8px;text-align:right;font-size:10px">AMOUNT</th>
            </tr>
          </thead>
          <tbody>
            ${sale.items.map((item, idx) => {
              const dbItem = DB.getById(DB.COLLECTIONS.ITEMS, item.itemId);
              return `
                <tr style="border-bottom:1px solid #eee">
                  <td style="padding:8px;font-size:12px">${idx + 1}</td>
                  <td style="padding:8px;font-size:12px">${Utils.escapeHtml(dbItem?.name || 'Item')}</td>
                  <td style="padding:8px;text-align:right;font-size:12px">${item.quantity}</td>
                  <td style="padding:8px;text-align:right;font-size:12px">${Utils.formatCurrency(item.rate)}</td>
                  <td style="padding:8px;text-align:right;font-size:12px">${item.gstPercent}%</td>
                  <td style="padding:8px;text-align:right;font-size:12px;font-weight:600">${Utils.formatCurrency(item.amount)}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>

        <div style="display:flex;justify-content:flex-end">
          <div style="width:250px">
            <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:12px">
              <span>Subtotal:</span><span>${Utils.formatCurrency(sale.subtotal)}</span>
            </div>
            <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:12px">
              <span>GST:</span><span>${Utils.formatCurrency(sale.gstTotal)}</span>
            </div>
            <div style="display:flex;justify-content:space-between;padding:8px 0;border-top:2px solid #4f46e5;margin-top:8px;font-size:16px;font-weight:800;color:#4f46e5">
              <span>Total:</span><span>${Utils.formatCurrency(sale.grandTotal)}</span>
            </div>
          </div>
        </div>

        <div style="background:#f8f9fa;padding:8px 12px;border-radius:4px;margin-top:12px;font-size:11px">
          <strong>Amount in Words:</strong> ${Utils.numberToWords(sale.grandTotal)}
        </div>
      </div>

      <div class="modal-footer" style="padding:16px 0 0">
        <button class="btn btn-outline" onclick="App.closeModal()">Close</button>
        <button class="btn btn-primary" onclick="Sales.printInvoice('${id}')">🖨️ Print</button>
      </div>
    `, 'modal-lg');
  },

  printInvoice(id) {
    const sale = DB.getById(DB.COLLECTIONS.SALES, id);
    if (!sale) return;

    const party = DB.getById(DB.COLLECTIONS.PARTIES, sale.partyId);
    const settings = DB.getSettings();

    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Invoice ${sale.invoiceNumber}</title>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet">
        <style>
          * { margin:0; padding:0; box-sizing:border-box; }
          body { font-family:'Inter',sans-serif; padding:30px; color:#1a1a2e; font-size:13px; }
          .header { display:flex; justify-content:space-between; border-bottom:2px solid #4f46e5; padding-bottom:12px; margin-bottom:20px; }
          .company h2 { color:#4f46e5; font-size:20px; }
          .company p { font-size:11px; color:#666; }
          .meta { text-align:right; }
          .meta h3 { color:#4f46e5; font-size:16px; }
          .meta p { font-size:11px; color:#666; }
          .meta strong { color:#1a1a2e; }
          .party { margin-bottom:20px; }
          .party h4 { font-size:10px; text-transform:uppercase; color:#999; letter-spacing:1px; margin-bottom:4px; }
          .party .name { font-size:14px; font-weight:700; }
          .party p { font-size:11px; color:#666; }
          table { width:100%; border-collapse:collapse; margin-bottom:20px; }
          th { background:#4f46e5; color:white; padding:8px 10px; font-size:10px; text-transform:uppercase; text-align:left; }
          th:last-child, td:last-child { text-align:right; }
          td { padding:8px 10px; border-bottom:1px solid #eee; font-size:12px; }
          tr:nth-child(even) td { background:#f8f9fa; }
          .totals { display:flex; justify-content:flex-end; margin-bottom:20px; }
          .totals-box { width:250px; }
          .total-line { display:flex; justify-content:space-between; padding:3px 0; font-size:12px; }
          .grand-total { border-top:2px solid #4f46e5; padding-top:8px; margin-top:6px; font-size:15px; font-weight:800; color:#4f46e5; }
          .words { background:#f8f9fa; padding:8px 12px; border-radius:4px; font-size:11px; margin-bottom:20px; }
          .words strong { color:#4f46e5; }
          .footer { display:flex; justify-content:space-between; border-top:1px solid #ddd; padding-top:16px; margin-top:40px; }
          .footer h4 { font-size:10px; text-transform:uppercase; color:#999; margin-bottom:4px; }
          .sig-line { width:150px; border-top:1px solid #333; margin-top:50px; padding-top:4px; font-size:11px; color:#666; text-align:center; margin-left:auto; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="company">
            <h2>${Utils.escapeHtml(settings.businessName)}</h2>
            <p>${Utils.escapeHtml(settings.businessAddress || '')}</p>
            <p>Phone: ${Utils.escapeHtml(settings.businessPhone || '')}</p>
            ${settings.gstin ? `<p>GSTIN: ${settings.gstin}</p>` : ''}
          </div>
          <div class="meta">
            <h3>TAX INVOICE</h3>
            <p>No: <strong>${sale.invoiceNumber}</strong></p>
            <p>Date: <strong>${Utils.formatDate(sale.date)}</strong></p>
          </div>
        </div>

        <div class="party">
          <h4>Bill To</h4>
          <div class="name">${Utils.escapeHtml(party?.name || sale.partyName)}</div>
          <p>${Utils.escapeHtml(party?.address || '')}</p>
          <p>Phone: ${Utils.escapeHtml(party?.phone || '')}</p>
          ${party?.gstin ? `<p>GSTIN: ${party.gstin}</p>` : ''}
        </div>

        <table>
          <thead>
            <tr>
              <th>#</th><th>Item</th><th style="text-align:right">Qty</th><th style="text-align:right">Rate</th><th style="text-align:right">GST%</th><th>Amount</th>
            </tr>
          </thead>
          <tbody>
            ${sale.items.map((item, idx) => {
              const dbItem = DB.getById(DB.COLLECTIONS.ITEMS, item.itemId);
              return `<tr><td>${idx+1}</td><td>${Utils.escapeHtml(dbItem?.name || 'Item')}</td><td style="text-align:right">${item.quantity}</td><td style="text-align:right">${Utils.formatCurrency(item.rate)}</td><td style="text-align:right">${item.gstPercent}%</td><td>${Utils.formatCurrency(item.amount)}</td></tr>`;
            }).join('')}
          </tbody>
        </table>

        <div class="totals">
          <div class="totals-box">
            <div class="total-line"><span>Subtotal:</span><span>${Utils.formatCurrency(sale.subtotal)}</span></div>
            <div class="total-line"><span>GST:</span><span>${Utils.formatCurrency(sale.gstTotal)}</span></div>
            <div class="total-line grand-total"><span>Grand Total:</span><span>${Utils.formatCurrency(sale.grandTotal)}</span></div>
          </div>
        </div>

        <div class="words"><strong>Amount in Words:</strong> ${Utils.numberToWords(sale.grandTotal)}</div>

        <div class="footer">
          <div>
            <h4>Terms & Conditions</h4>
            <p style="font-size:10px;color:#999">${Utils.escapeHtml(settings.termsAndConditions || 'Thank you for your business!')}</p>
          </div>
          <div style="text-align:right">
            <div class="sig-line">Authorized Signature</div>
          </div>
        </div>
      </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.onload = () => {
      printWindow.print();
    };
  },

  deleteInvoice(id) {
    if (!confirm('Delete this invoice? Stock will NOT be restored.')) return;
    DB.delete(DB.COLLECTIONS.SALES, id);
    App.toast('Invoice deleted', 'warning');
    App.refreshPage();
  }
};
