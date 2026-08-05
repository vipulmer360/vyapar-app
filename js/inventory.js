/* ==========================================
   VYAPAR PWA — INVENTORY MODULE
   ========================================== */

const Inventory = {
  searchTerm: '',
  categoryFilter: '',

  render() {
    const items = DB.getAll(DB.COLLECTIONS.ITEMS);
    let filtered = Utils.filterBySearch(items, this.searchTerm, ['name', 'hsn', 'category']);
    if (this.categoryFilter) {
      filtered = filtered.filter(i => i.category === this.categoryFilter);
    }

    const categories = [...new Set(items.map(i => i.category).filter(Boolean))];
    const totalValue = items.reduce((sum, i) => sum + (Utils.parseNum(i.quantity) * Utils.parseNum(i.salePrice)), 0);

    return `
      <div class="stat-grid" style="margin-bottom:20px">
        <div class="stat-card">
          <div class="stat-label">Total Items</div>
          <div class="stat-value text-accent">${items.length}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Stock Value</div>
          <div class="stat-value text-success">${Utils.formatCurrency(totalValue)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Low Stock</div>
          <div class="stat-value text-danger">${DB.getLowStockItems(10).length}</div>
        </div>
      </div>

      <div class="toolbar">
        <div class="toolbar-left">
          <div class="search-bar" style="flex:1;max-width:300px">
            ${Utils.icons.search}
            <input type="text" placeholder="Search items..." value="${this.searchTerm}" 
                   oninput="Inventory.search(this.value)">
          </div>
          ${categories.length > 0 ? `
            <select class="form-select" style="max-width:160px" onchange="Inventory.filterCategory(this.value)">
              <option value="">All Categories</option>
              ${categories.map(c => `<option value="${c}" ${c === this.categoryFilter ? 'selected' : ''}>${c}</option>`).join('')}
            </select>
          ` : ''}
        </div>
        <div class="toolbar-right">
          <button class="btn btn-primary" onclick="Inventory.openAddItem()">
            ${Utils.icons.plus} Add Item
          </button>
        </div>
      </div>

      ${filtered.length === 0 ? `
        <div class="empty-state">
          ${Utils.icons.inventory}
          <h3>No Items Found</h3>
          <p>Add your first item to manage inventory</p>
          <button class="btn btn-primary" onclick="Inventory.openAddItem()">${Utils.icons.plus} Add Item</button>
        </div>
      ` : `
        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Item Name</th>
                <th>HSN</th>
                <th>Category</th>
                <th class="text-right">Sale Price</th>
                <th class="text-right">Purchase Price</th>
                <th class="text-center">Stock</th>
                <th class="text-right">GST %</th>
                <th class="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${filtered.map(item => {
                const qty = Utils.parseNum(item.quantity);
                const isLow = qty <= 10;
                return `
                  <tr>
                    <td class="font-bold">${Utils.escapeHtml(item.name)}</td>
                    <td class="text-muted">${Utils.escapeHtml(item.hsn || '-')}</td>
                    <td><span class="badge badge-accent">${Utils.escapeHtml(item.category || 'General')}</span></td>
                    <td class="text-right">${Utils.formatCurrency(item.salePrice)}</td>
                    <td class="text-right text-muted">${Utils.formatCurrency(item.purchasePrice)}</td>
                    <td class="text-center">
                      <span class="badge ${isLow ? 'badge-danger' : 'badge-success'}">${qty} ${item.unit || 'pcs'}</span>
                    </td>
                    <td class="text-right">${item.gstPercent || 0}%</td>
                    <td>
                      <div class="table-actions">
                        <button class="btn btn-ghost btn-icon" onclick="Inventory.openEditItem('${item.id}')" title="Edit">${Utils.icons.edit}</button>
                        <button class="btn btn-ghost btn-icon" onclick="Inventory.deleteItem('${item.id}')" title="Delete">${Utils.icons.trash}</button>
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

  filterCategory(cat) {
    this.categoryFilter = cat;
    App.refreshPage();
  },

  openAddItem() {
    App.showModal('Add New Item', this._itemForm());
  },

  openEditItem(id) {
    const item = DB.getById(DB.COLLECTIONS.ITEMS, id);
    if (!item) return;
    App.showModal('Edit Item', this._itemForm(item));
  },

  _itemForm(item = null) {
    const isEdit = item !== null;
    return `
      <form id="itemForm" onsubmit="Inventory.saveItem(event, ${isEdit ? `'${item.id}'` : 'null'})">
        <div class="form-group">
          <label class="form-label">Item Name *</label>
          <input type="text" class="form-input" name="name" required value="${isEdit ? Utils.escapeHtml(item.name) : ''}" placeholder="Enter item name">
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">HSN Code</label>
            <input type="text" class="form-input" name="hsn" value="${isEdit ? Utils.escapeHtml(item.hsn || '') : ''}" placeholder="e.g. 8471">
          </div>
          <div class="form-group">
            <label class="form-label">Category</label>
            <input type="text" class="form-input" name="category" value="${isEdit ? Utils.escapeHtml(item.category || '') : ''}" placeholder="e.g. Electronics">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Sale Price (₹) *</label>
            <input type="number" class="form-input" name="salePrice" required step="0.01" min="0" value="${isEdit ? item.salePrice : ''}" placeholder="0.00">
          </div>
          <div class="form-group">
            <label class="form-label">Purchase Price (₹)</label>
            <input type="number" class="form-input" name="purchasePrice" step="0.01" min="0" value="${isEdit ? item.purchasePrice || '' : ''}" placeholder="0.00">
          </div>
        </div>
        <div class="form-row-3">
          <div class="form-group">
            <label class="form-label">Stock Quantity</label>
            <input type="number" class="form-input" name="quantity" min="0" value="${isEdit ? item.quantity || 0 : '0'}" placeholder="0">
          </div>
          <div class="form-group">
            <label class="form-label">Unit</label>
            <select class="form-select" name="unit">
              ${['Pcs', 'Kg', 'Ltr', 'Mtr', 'Box', 'Dozen', 'Ream', 'Set', 'Pair'].map(u =>
                `<option value="${u}" ${isEdit && item.unit === u ? 'selected' : ''}>${u}</option>`
              ).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">GST %</label>
            <select class="form-select" name="gstPercent">
              ${[0, 3, 5, 12, 18, 28].map(g =>
                `<option value="${g}" ${isEdit && parseInt(item.gstPercent) === g ? 'selected' : ''}>${g}%</option>`
              ).join('')}
            </select>
          </div>
        </div>
        <div class="modal-footer" style="padding:16px 0 0;border-top:1px solid var(--border)">
          <button type="button" class="btn btn-outline" onclick="App.closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary">${isEdit ? 'Update' : 'Add'} Item</button>
        </div>
      </form>
    `;
  },

  saveItem(e, id = null) {
    e.preventDefault();
    const form = new FormData(e.target);
    const data = {
      name: form.get('name'),
      hsn: form.get('hsn'),
      category: form.get('category'),
      salePrice: parseFloat(form.get('salePrice')) || 0,
      purchasePrice: parseFloat(form.get('purchasePrice')) || 0,
      quantity: parseInt(form.get('quantity')) || 0,
      unit: form.get('unit'),
      gstPercent: parseInt(form.get('gstPercent')) || 0
    };

    if (id) {
      DB.update(DB.COLLECTIONS.ITEMS, id, data);
      App.toast('Item updated!', 'success');
    } else {
      DB.add(DB.COLLECTIONS.ITEMS, data);
      App.toast('Item added!', 'success');
    }
    App.closeModal();
    App.refreshPage();
  },

  deleteItem(id) {
    if (!confirm('Delete this item?')) return;
    DB.delete(DB.COLLECTIONS.ITEMS, id);
    App.toast('Item deleted', 'warning');
    App.refreshPage();
  }
};
