/* ==========================================
   VYAPAR PWA — REPORTS MODULE
   ========================================== */

const Reports = {
  currentReport: 'daybook',
  dateRange: 'month',

  render() {
    return `
      <div class="toolbar">
        <div class="toolbar-left">
          <div class="tabs" style="border:none;margin:0;flex-wrap:wrap">
            ${[
              { key: 'daybook', label: '📒 Day Book' },
              { key: 'summary', label: '📊 Income vs Expense' },
              { key: 'party', label: '👥 Party Summary' }
            ].map(r => `
              <div class="tab ${this.currentReport === r.key ? 'active' : ''}" onclick="Reports.switchReport('${r.key}')">
                ${r.label}
              </div>
            `).join('')}
          </div>
        </div>
      </div>

      <div class="toolbar" style="margin-bottom:16px">
        <div class="toolbar-left">
          <select class="form-select" style="max-width:150px" onchange="Reports.setDateRange(this.value)">
            <option value="today" ${this.dateRange === 'today' ? 'selected' : ''}>Today</option>
            <option value="week" ${this.dateRange === 'week' ? 'selected' : ''}>This Week</option>
            <option value="month" ${this.dateRange === 'month' ? 'selected' : ''}>This Month</option>
            <option value="year" ${this.dateRange === 'year' ? 'selected' : ''}>This Year</option>
            <option value="all" ${this.dateRange === 'all' ? 'selected' : ''}>All Time</option>
          </select>
        </div>
        <div class="toolbar-right">
          <button class="btn btn-outline btn-sm" onclick="Reports.exportCSV()">
            ${Utils.icons.download} Export CSV
          </button>
        </div>
      </div>

      <div id="reportContent">
        ${this._renderReport()}
      </div>
    `;
  },

  switchReport(report) {
    this.currentReport = report;
    App.refreshPage();
  },

  setDateRange(range) {
    this.dateRange = range;
    App.refreshPage();
  },

  _renderReport() {
    switch (this.currentReport) {
      case 'daybook': return this._daybookReport();
      case 'summary': return this._summaryReport();
      case 'party': return this._partyReport();
      default: return this._daybookReport();
    }
  },

  _daybookReport() {
    const range = Utils.getDateRange(this.dateRange);
    const incomes = DB.getAll(DB.COLLECTIONS.INCOMES).filter(i => i.date >= range.start && i.date < range.end);
    const expenses = DB.getAll(DB.COLLECTIONS.EXPENSES).filter(e => e.date >= range.start && e.date < range.end);

    const transactions = [
      ...incomes.map(i => ({ date: i.date, type: 'Income', itemName: i.itemName || 'General Item', party: i.party || 'General', account: i.accountName, credit: Calculations.getItemAmount(i), debit: 0, notes: i.notes })),
      ...expenses.map(e => ({ date: e.date, type: 'Expense', itemName: e.itemName || 'General Item', party: e.party || 'General', account: e.accountName, credit: 0, debit: Calculations.getItemAmount(e), notes: e.notes }))
    ].sort((a, b) => new Date(b.date) - new Date(a.date));

    const totalIncome = transactions.reduce((sum, t) => sum + t.credit, 0);
    const totalExpense = transactions.reduce((sum, t) => sum + t.debit, 0);

    if (transactions.length === 0) {
      return '<div class="empty-state"><h3>No transactions in this period</h3></div>';
    }

    return `
      <div class="stat-grid" style="margin-bottom:16px">
        <div class="stat-card profit"><div class="stat-label">Total Income</div><div class="stat-value text-success">${Utils.formatCurrency(totalIncome)}</div></div>
        <div class="stat-card due"><div class="stat-label">Total Expense</div><div class="stat-value text-danger">${Utils.formatCurrency(totalExpense)}</div></div>
        <div class="stat-card cash"><div class="stat-label">Net Total</div><div class="stat-value ${totalIncome >= totalExpense ? 'text-success' : 'text-danger'}">${Utils.formatCurrency(totalIncome - totalExpense)}</div></div>
      </div>
      <div class="table-container">
        <table class="data-table">
          <thead><tr><th>Date</th><th>Type</th><th>Item Name</th><th>Party</th><th>Account</th><th>Notes</th><th class="text-right">Credit</th><th class="text-right">Debit</th></tr></thead>
          <tbody>
            ${transactions.map(t => `
              <tr>
                <td>${Utils.formatDate(t.date)}</td>
                <td><span class="badge ${t.type === 'Income' ? 'badge-success' : 'badge-danger'}">${t.type}</span></td>
                <td class="font-bold">${Utils.escapeHtml(t.itemName)}</td>
                <td>${Utils.escapeHtml(t.party)}</td>
                <td><span class="badge badge-accent">${Utils.escapeHtml(t.account || 'Cash')}</span></td>
                <td class="text-muted">${Utils.escapeHtml(t.notes || '-')}</td>
                <td class="text-right">${t.credit ? `<span class="amount credit">${Utils.formatCurrency(t.credit)}</span>` : '-'}</td>
                <td class="text-right">${t.debit ? `<span class="amount debit">${Utils.formatCurrency(t.debit)}</span>` : '-'}</td>
              </tr>
            `).join('')}
            <tr style="background:var(--bg-secondary);font-weight:700">
              <td colspan="6">TOTAL</td>
              <td class="text-right text-success">${Utils.formatCurrency(totalIncome)}</td>
              <td class="text-right text-danger">${Utils.formatCurrency(totalExpense)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    `;
  },

  _summaryReport() {
    const range = Utils.getDateRange(this.dateRange);
    const incomes = DB.getAll(DB.COLLECTIONS.INCOMES).filter(i => i.date >= range.start && i.date < range.end);
    const expenses = DB.getAll(DB.COLLECTIONS.EXPENSES).filter(e => e.date >= range.start && e.date < range.end);

    const totalIncome = incomes.reduce((sum, i) => sum + Calculations.getItemAmount(i), 0);
    const totalExpense = expenses.reduce((sum, e) => sum + Calculations.getItemAmount(e), 0);
    const netSavings = totalIncome - totalExpense;

    return `
      <div class="card" style="max-width:500px;margin:0 auto">
        <h3 style="text-align:center;margin-bottom:24px;font-size:1.1rem">📊 Income vs Expense Statement</h3>
        
        <div style="display:flex;flex-direction:column;gap:12px">
          <div style="display:flex;justify-content:space-between;padding:12px;background:var(--success-bg);border-radius:var(--radius-sm)">
            <span>Total Income</span>
            <span class="font-bold text-success">${Utils.formatCurrency(totalIncome)}</span>
          </div>
          <div style="display:flex;justify-content:space-between;padding:12px;background:var(--danger-bg);border-radius:var(--radius-sm)">
            <span>Less: Total Expense</span>
            <span class="font-bold text-danger">- ${Utils.formatCurrency(totalExpense)}</span>
          </div>
          <div class="divider"></div>
          <div style="display:flex;justify-content:space-between;padding:16px;background:${netSavings >= 0 ? 'var(--success-bg)' : 'var(--danger-bg)'};border-radius:var(--radius-md);border:1px solid ${netSavings >= 0 ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}">
            <span style="font-size:1.1rem;font-weight:700">${netSavings >= 0 ? '📈 Net Savings' : '📉 Net Deficit'}</span>
            <span style="font-size:1.3rem;font-weight:800" class="${netSavings >= 0 ? 'text-success' : 'text-danger'}">${Utils.formatCurrency(Math.abs(netSavings))}</span>
          </div>
        </div>
      </div>
    `;
  },

  _partyReport() {
    const range = Utils.getDateRange(this.dateRange);
    const incomes = DB.getAll(DB.COLLECTIONS.INCOMES).filter(i => i.date >= range.start && i.date < range.end);
    const expenses = DB.getAll(DB.COLLECTIONS.EXPENSES).filter(e => e.date >= range.start && e.date < range.end);

    const partiesMap = {};
    incomes.forEach(i => {
      const p = i.party || 'General';
      if (!partiesMap[p]) partiesMap[p] = { income: 0, expense: 0, count: 0 };
      partiesMap[p].income += Calculations.getItemAmount(i);
      partiesMap[p].count++;
    });

    expenses.forEach(e => {
      const p = e.party || 'General';
      if (!partiesMap[p]) partiesMap[p] = { income: 0, expense: 0, count: 0 };
      partiesMap[p].expense += Calculations.getItemAmount(e);
      partiesMap[p].count++;
    });

    const partyList = Object.keys(partiesMap);

    return `
      <div class="table-container">
        <table class="data-table">
          <thead><tr><th>Party Name</th><th class="text-right">Income</th><th class="text-right">Expense</th><th class="text-right">Net</th></tr></thead>
          <tbody>
            ${partyList.length === 0 ? '<tr><td colspan="4" class="text-center">No transactions recorded</td></tr>' : partyList.map(party => {
              const inc = partiesMap[party].income;
              const exp = partiesMap[party].expense;
              const net = inc - exp;
              return `
                <tr>
                  <td class="font-bold">${Utils.escapeHtml(party)}</td>
                  <td class="text-right"><span class="amount credit">${Utils.formatCurrency(inc)}</span></td>
                  <td class="text-right"><span class="amount debit">${Utils.formatCurrency(exp)}</span></td>
                  <td class="text-right"><span class="amount ${net >= 0 ? 'credit' : 'debit'}">${Utils.formatCurrency(net)}</span></td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  },

  exportCSV() {
    const range = Utils.getDateRange(this.dateRange);
    const incomes = DB.getAll(DB.COLLECTIONS.INCOMES).filter(i => i.date >= range.start && i.date < range.end);
    const expenses = DB.getAll(DB.COLLECTIONS.EXPENSES).filter(e => e.date >= range.start && e.date < range.end);

    let csv = 'Date,Type,ItemName,Party,Account,Amount,Notes\n';
    incomes.forEach(i => {
      csv += `${i.date},Income,"${i.itemName || 'General Item'}","${i.party || 'General'}","${i.accountName}",${i.amount},"${i.notes || ''}"\n`;
    });
    expenses.forEach(e => {
      csv += `${e.date},Expense,"${e.itemName || 'General Item'}","${e.party || 'General'}","${e.accountName}",${e.amount},"${e.notes || ''}"\n`;
    });

    Utils.downloadFile(csv, `transactions_${this.currentReport}_${Utils.today()}.csv`, 'text/csv');
    App.toast('CSV exported! 📄', 'success');
  }
};
