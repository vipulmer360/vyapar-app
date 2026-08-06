/* ==========================================
   VYAPAR PWA — CALCULATIONS MODULE
   ========================================== */

const Calculations = {

  /**
   * Determine the effective amount of a transaction.
   * If amount is specified and valid, it is used. Otherwise price is used.
   */
  getItemAmount(t) {
    if (t.amount !== undefined && t.amount !== null && t.amount !== '') {
      const a = parseFloat(t.amount);
      if (!isNaN(a)) return Math.abs(a);
    }
    const p = parseFloat(t.price);
    if (!isNaN(p) && p !== 0) return Math.abs(p);
    return 0;
  },

  /**
   * Get all transactions associated with a specific account
   */
  getAccountTransactions(accountId) {
    const acc = DB.getById(DB.COLLECTIONS.ACCOUNTS, accountId);
    if (!acc) return [];

    const incomes = DB.getAll(DB.COLLECTIONS.INCOMES).map(i => ({ ...i, type: 'income' }));
    const expenses = DB.getAll(DB.COLLECTIONS.EXPENSES).map(e => ({ ...e, type: 'expense' }));
    const all = [...incomes, ...expenses];

    const accNameLower = String(acc.name || '').trim().toLowerCase();

    return all.filter(t => {
      // Match by accountId (exact)
      if (t.accountId && String(t.accountId) === String(accountId)) return true;
      // Match by accountName (case-insensitive exact)
      if (t.accountName && String(t.accountName).trim().toLowerCase() === accNameLower) return true;
      return false;
    });
  },

  /**
   * Calculate the total balance for an account
   */
  getAccountBalance(accountId) {
    const trans = this.getAccountTransactions(accountId);
    const incSum = trans.filter(t => t.type === 'income').reduce((sum, t) => sum + this.getItemAmount(t), 0);
    const expSum = trans.filter(t => t.type === 'expense').reduce((sum, t) => sum + this.getItemAmount(t), 0);
    return incSum - expSum;
  },

  /**
   * Calculate day totals for a group of items
   * @param {Array} items - List of transactions for a specific day
   * @param {Boolean} isPartyLedger - Whether this is inside a party ledger (affects exclusion logic)
   */
  getDayTotals(items, isPartyLedger = false) {
    // For main transactions, exclude items without account or settlement entries from calculations
    const calcItems = isPartyLedger ? items : items.filter(t => t.accountId && !t.isSettlement && t.status !== 'cleared');

    const dayIncomeAmount = calcItems.filter(t => t.type === 'income').reduce((sum, t) => sum + this.getItemAmount(t), 0);
    const dayExpenseAmount = calcItems.filter(t => t.type === 'expense').reduce((sum, t) => sum + this.getItemAmount(t), 0);
    const dayTotalAmount = dayIncomeAmount - dayExpenseAmount;

    const dayIncomePrice = calcItems.filter(t => t.type === 'income').reduce((sum, t) => sum + Utils.parseNum(t.price || 0), 0);
    const dayExpensePrice = calcItems.filter(t => t.type === 'expense').reduce((sum, t) => sum + Utils.parseNum(t.price || 0), 0);
    const dayTotalPrice = dayIncomePrice - dayExpensePrice;

    const dayProfitLoss = dayTotalAmount - dayTotalPrice;

    return {
      dayTotalAmount,
      dayTotalPrice,
      dayProfitLoss
    };
  },

  /**
   * Calculate overall totals for the main transactions view
   * @param {Array} allTrans - All visible transactions
   */
  getMainTransactionTotals(allTrans) {
    // Exclude no-account entries and settlement entries from global main transaction totals
    const calcTrans = allTrans.filter(t => t.accountId && !t.isSettlement && t.status !== 'cleared');
    const totalIncome = calcTrans.filter(t => t.type === 'income').reduce((sum, t) => sum + this.getItemAmount(t), 0);
    const totalExpense = calcTrans.filter(t => t.type === 'expense').reduce((sum, t) => sum + this.getItemAmount(t), 0);
    
    return {
      totalIncome,
      totalExpense,
      netBalance: totalIncome - totalExpense
    };
  }
};
