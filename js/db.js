/* ==========================================
   VYAPAR PWA — DATABASE LAYER (localStorage)
   ========================================== */

const DB = {
  // Collection names
  COLLECTIONS: {
    INCOMES: 'vyapar_incomes',
    EXPENSES: 'vyapar_expenses',
    CATEGORIES: 'vyapar_categories',
    ACCOUNTS: 'vyapar_accounts',
    PARTIES: 'vyapar_parties',
    SALES: 'vyapar_sales',
    PURCHASES: 'vyapar_purchases',
    PAYMENTS: 'vyapar_payments',
    ITEMS: 'vyapar_items',
    SETTINGS: 'vyapar_settings',
    COUNTERS: 'vyapar_counters'
  },

  // ========== GENERIC CRUD ==========

  // Get all items from a collection
  getAll(collection) {
    try {
      const data = localStorage.getItem(collection);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error(`DB.getAll error for ${collection}:`, e);
      return [];
    }
  },

  // Get single item by ID
  getById(collection, id) {
    const items = this.getAll(collection);
    return items.find(item => item.id === id) || null;
  },

  // Add new item
  add(collection, item) {
    const items = this.getAll(collection);
    const newItem = {
      ...item,
      id: item.id || Utils.generateId(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    items.push(newItem);
    this._save(collection, items);
    return newItem;
  },

  // Update existing item
  update(collection, id, updates) {
    const items = this.getAll(collection);
    const index = items.findIndex(item => item.id === id);
    if (index === -1) return null;
    items[index] = {
      ...items[index],
      ...updates,
      id: items[index].id,
      createdAt: items[index].createdAt,
      updatedAt: new Date().toISOString()
    };
    this._save(collection, items);
    return items[index];
  },

  // Delete item by ID
  delete(collection, id) {
    let items = this.getAll(collection);
    items = items.filter(item => item.id !== id);
    this._save(collection, items);
    return true;
  },

  // Save to localStorage
  _save(collection, data) {
    try {
      localStorage.setItem(collection, JSON.stringify(data));
      // Auto-sync to cloud if logged in
      if (typeof Sync !== 'undefined') {
        Sync.onDataChange(collection);
      }
    } catch (e) {
      console.error(`DB save error for ${collection}:`, e);
      if (e.name === 'QuotaExceededError') {
        alert('Storage full! Please export your data and clear some old records.');
      }
    }
  },

  // ========== SETTINGS ==========

  getSettings() {
    try {
      const data = localStorage.getItem(this.COLLECTIONS.SETTINGS);
      return data ? JSON.parse(data) : this.defaultSettings();
    } catch (e) {
      return this.defaultSettings();
    }
  },

  saveSettings(settings) {
    localStorage.setItem(this.COLLECTIONS.SETTINGS, JSON.stringify(settings));
  },

  defaultSettings() {
    return {
      businessName: 'My Business',
      businessAddress: '',
      businessPhone: '',
      businessEmail: '',
      gstin: '',
      state: '',
      bankName: '',
      accountNumber: '',
      ifscCode: '',
      invoicePrefix: 'INV',
      purchasePrefix: 'PUR',
      termsAndConditions: 'Thank you for your business!'
    };
  },

  // ========== COUNTERS ==========

  getCounter(type) {
    try {
      const counters = JSON.parse(localStorage.getItem(this.COLLECTIONS.COUNTERS) || '{}');
      return counters[type] || 0;
    } catch (e) {
      return 0;
    }
  },

  incrementCounter(type) {
    try {
      const counters = JSON.parse(localStorage.getItem(this.COLLECTIONS.COUNTERS) || '{}');
      counters[type] = (counters[type] || 0) + 1;
      localStorage.setItem(this.COLLECTIONS.COUNTERS, JSON.stringify(counters));
      return counters[type];
    } catch (e) {
      return 1;
    }
  },

  // ========== PARTY HELPERS ==========

  getParties(type = null) {
    let parties = this.getAll(this.COLLECTIONS.PARTIES);
    if (type) {
      parties = parties.filter(p => p.type === type);
    }
    return parties;
  },

  getPartyBalance(partyId) {
    const sales = this.getAll(this.COLLECTIONS.SALES).filter(s => s.partyId === partyId);
    const purchases = this.getAll(this.COLLECTIONS.PURCHASES).filter(p => p.partyId === partyId);
    const payments = this.getAll(this.COLLECTIONS.PAYMENTS).filter(p => p.partyId === partyId);

    let totalSales = sales.reduce((sum, s) => sum + Utils.parseNum(s.grandTotal), 0);
    let totalPurchases = purchases.reduce((sum, p) => sum + Utils.parseNum(p.grandTotal), 0);

    let totalPaymentsIn = payments
      .filter(p => p.type === 'in')
      .reduce((sum, p) => sum + Utils.parseNum(p.amount), 0);

    let totalPaymentsOut = payments
      .filter(p => p.type === 'out')
      .reduce((sum, p) => sum + Utils.parseNum(p.amount), 0);

    // For customer: Sales - PaymentsReceived = Receivable
    // For supplier: Purchases - PaymentsMade = Payable
    const receivable = totalSales - totalPaymentsIn;
    const payable = totalPurchases - totalPaymentsOut;

    return { totalSales, totalPurchases, totalPaymentsIn, totalPaymentsOut, receivable, payable };
  },

  // ========== INVENTORY HELPERS ==========

  updateStock(itemId, quantityChange) {
    const item = this.getById(this.COLLECTIONS.ITEMS, itemId);
    if (!item) return;
    const newQty = Utils.parseNum(item.quantity) + quantityChange;
    this.update(this.COLLECTIONS.ITEMS, itemId, { quantity: Math.max(0, newQty) });
  },

  getLowStockItems(threshold = 10) {
    return this.getAll(this.COLLECTIONS.ITEMS).filter(item =>
      Utils.parseNum(item.quantity) <= threshold && Utils.parseNum(item.quantity) >= 0
    );
  },

  // ========== DASHBOARD HELPERS ==========

  getDashboardStats(dateRange = 'month') {
    const range = Utils.getDateRange(dateRange);
    const sales = this.getAll(this.COLLECTIONS.SALES);
    const purchases = this.getAll(this.COLLECTIONS.PURCHASES);
    const payments = this.getAll(this.COLLECTIONS.PAYMENTS);

    const filteredSales = sales.filter(s => s.date >= range.start && s.date < range.end);
    const filteredPurchases = purchases.filter(p => p.date >= range.start && p.date < range.end);

    const totalSales = filteredSales.reduce((sum, s) => sum + Utils.parseNum(s.grandTotal), 0);
    const totalPurchases = filteredPurchases.reduce((sum, p) => sum + Utils.parseNum(p.grandTotal), 0);
    const profit = totalSales - totalPurchases;

    const totalReceivable = sales.reduce((sum, s) => sum + Utils.parseNum(s.grandTotal), 0) -
      payments.filter(p => p.type === 'in').reduce((sum, p) => sum + Utils.parseNum(p.amount), 0);

    const totalPayable = purchases.reduce((sum, p) => sum + Utils.parseNum(p.grandTotal), 0) -
      payments.filter(p => p.type === 'out').reduce((sum, p) => sum + Utils.parseNum(p.amount), 0);

    return {
      totalSales, totalPurchases, profit,
      salesCount: filteredSales.length,
      purchaseCount: filteredPurchases.length,
      totalReceivable: Math.max(0, totalReceivable),
      totalPayable: Math.max(0, totalPayable)
    };
  },

  // ========== EXPORT / IMPORT ==========

  exportAll() {
    const data = {};
    Object.values(this.COLLECTIONS).forEach(col => {
      data[col] = localStorage.getItem(col);
    });
    return JSON.stringify(data, null, 2);
  },

  importAll(jsonString) {
    try {
      const data = JSON.parse(jsonString);
      Object.keys(data).forEach(key => {
        if (data[key]) {
          localStorage.setItem(key, data[key]);
        }
      });
      return true;
    } catch (e) {
      console.error('Import error:', e);
      return false;
    }
  },

  clearAll() {
    Object.values(this.COLLECTIONS).forEach(col => {
      localStorage.removeItem(col);
    });
  },

  // ========== SEED DEMO DATA ==========

  seedDemoData() {
    if (this.getAll(this.COLLECTIONS.ACCOUNTS).length > 0) return;

    // Sample Accounts
    const sbi = this.add(this.COLLECTIONS.ACCOUNTS, { name: 'SBI Current Account', type: 'bank', balance: 125000, bankName: 'State Bank of India', accountNumber: '30982347123' });
    const paytm = this.add(this.COLLECTIONS.ACCOUNTS, { name: 'Paytm Business Wallet', type: 'wallet', balance: 18500, bankName: 'Paytm Payments Bank', accountNumber: '9876543210' });
    const cash = this.add(this.COLLECTIONS.ACCOUNTS, { name: 'Cash Pocket', type: 'pocket', balance: 5400, bankName: 'Cash', accountNumber: '' });
    const hdfc = this.add(this.COLLECTIONS.ACCOUNTS, { name: 'HDFC Savings', type: 'savings', balance: 45000, bankName: 'HDFC Bank', accountNumber: '5010023912' });

    // Sample Incomes
    const incomes = [
      { itemName: 'Dell Laptop Sale', amount: 45000, date: Utils.today(), party: 'Rajesh Kumar', accountId: sbi.id, accountName: sbi.name, notes: 'Client project payment' },
      { itemName: 'Website Design Service', amount: 15000, date: Utils.today(), party: 'Priya Sharma', accountId: paytm.id, accountName: paytm.name, notes: 'Design work' },
      { itemName: 'Wireless Mouse', amount: 2000, date: Utils.today(), party: 'Cash Customer', accountId: cash.id, accountName: cash.name, notes: 'Cash sale' }
    ];
    incomes.forEach(inc => this.add(this.COLLECTIONS.INCOMES, inc));

    // Sample Expenses
    const expenses = [
      { itemName: 'Monthly Office Rent', amount: 12000, date: Utils.today(), party: 'Landlord (Office Rent)', accountId: sbi.id, accountName: sbi.name, notes: 'Office rent' },
      { itemName: 'Electricity Bill', amount: 2500, date: Utils.today(), party: 'Electricity Board', accountId: paytm.id, accountName: paytm.name, notes: 'Electricity bill' },
      { itemName: 'Printer Paper & Pens', amount: 800, date: Utils.today(), party: 'Stationery Store', accountId: cash.id, accountName: cash.name, notes: 'Tea & Snacks' }
    ];
    expenses.forEach(exp => this.add(this.COLLECTIONS.EXPENSES, exp));
  }
};
