/* ==========================================
   VYAPAR PWA — DASHBOARD MODULE
   ========================================== */

const Dashboard = {
  render() {
    // IMPORTANT: Clear any stray filters so they don't affect Dashboard totals/lists!
    if (typeof Transactions !== 'undefined') {
      Transactions.accountFilter = null;
      Transactions.partyFilter = null;
    }

    const settings = DB.getSettings();
    const savedPrefs = settings.dashboardPreferences || {};
    const prefs = {
      sectionOrder: savedPrefs.sectionOrder || 'accounts_first',
      totalsStartDate: savedPrefs.totalsStartDate || Utils.today(),
      totalsEndDateType: savedPrefs.totalsEndDateType || 'today',
      totalsEndDate: savedPrefs.totalsEndDate || Utils.today(),
      transactionsStartDate: savedPrefs.transactionsStartDate || Utils.today(),
      transactionsEndDateType: savedPrefs.transactionsEndDateType || 'today',
      transactionsEndDate: savedPrefs.transactionsEndDate || Utils.today(),
      includedAccounts: savedPrefs.includedAccounts || DB.getAll(DB.COLLECTIONS.ACCOUNTS).map(a => a.id)
    };

    // Calculate Totals based on date range
    let totalsStart = prefs.totalsStartDate;
    let totalsEnd = prefs.totalsEndDateType === 'today' ? Utils.today() : prefs.totalsEndDate;
    
    const stats = DB.getDashboardStats(totalsStart, totalsEnd);
    
    // Calculate total balance for included accounts
    const allAccounts = DB.getAll(DB.COLLECTIONS.ACCOUNTS);
    const includedBalances = allAccounts
      .filter(a => prefs.includedAccounts.includes(a.id))
      .reduce((sum, a) => sum + Utils.parseNum(a.balance), 0);

    const summarySection = `
      <div class="dashboard-summary-cards" style="display:flex; gap:12px; margin-bottom:16px; margin-top:8px;">
        <div class="summary-card" style="flex:1; background:var(--bg-card); padding:16px; border-radius:var(--radius-md); box-shadow:0 2px 8px rgba(0,0,0,0.05); text-align:center;">
          <div style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase; font-weight:600;">Total Balance</div>
          <div style="font-size:1.4rem; font-weight:800; color:var(--accent);">${Utils.formatCurrency(includedBalances)}</div>
          <div style="font-size:0.7rem; color:var(--text-muted); margin-top:4px;">(Selected Accounts)</div>
        </div>
        <div class="summary-card" style="flex:1; background:var(--bg-card); padding:16px; border-radius:var(--radius-md); box-shadow:0 2px 8px rgba(0,0,0,0.05); text-align:center;">
          <div style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase; font-weight:600;">Net Profit</div>
          <div style="font-size:1.4rem; font-weight:800; color:${stats.profit >= 0 ? 'var(--success)' : 'var(--danger)'};">${Utils.formatCurrency(stats.profit)}</div>
          <div style="font-size:0.7rem; color:var(--text-muted); margin-top:4px;">(${Utils.formatDate(totalsStart)} - ${prefs.totalsEndDateType === 'today' ? 'Today' : Utils.formatDate(totalsEnd)})</div>
        </div>
      </div>
    `;

    const accountsSection = `
      <div class="accounts-horizontal-section">
        <div class="accounts-section-header">
          <div class="accounts-section-title">🏦 My Accounts</div>
          <button class="btn btn-sm btn-outline" onclick="App.navigate('accounts')">View All</button>
        </div>
        ${Accounts.renderDashboardGrid()}
      </div>
    `;

    const transactionsSection = `
      <div class="recent-list mt-3">
        <div class="recent-list-header">
          <div class="recent-list-title">🧾 All Recent Transactions</div>
          <div class="flex gap-2">
            <button class="btn btn-sm btn-outline" onclick="Transactions.toggleSortOrder()" style="font-weight:600">
              ${Transactions.sortOrder === 'asc' ? '📅 ⬆️ Oldest First' : '📅 ⬇️ Newest First'}
            </button>
            <button class="btn btn-sm btn-outline" onclick="App.navigate('transactions')">Manage</button>
          </div>
        </div>
        <div style="padding-bottom: 20px;">
          ${(() => {
            let tStart = prefs.transactionsStartDate;
            let tEnd = prefs.transactionsEndDateType === 'today' ? Utils.today() : prefs.transactionsEndDate;
            return Transactions.renderRecentDashboardRows(0, tStart, tEnd);
          })()}
        </div>
      </div>
    `;

    let html = `
      <!-- Install Banner -->
      <div class="install-banner" id="installBanner" onclick="App.installApp()">
        📱 App install karein apne phone mein!
        <button class="btn btn-sm">Install</button>
      </div>
      
      ${summarySection}
    `;

    if (prefs.sectionOrder === 'accounts_first') {
      html += accountsSection + transactionsSection;
    } else {
      html += transactionsSection + accountsSection;
    }

    return html;
  },

  // Draw simple bar chart
  drawChart() {
    const canvas = document.getElementById('salesChart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width - 40;
    canvas.height = 220;

    const sales = DB.getAll(DB.COLLECTIONS.SALES);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const currentYear = new Date().getFullYear();

    // Calculate monthly totals
    const monthlyData = new Array(12).fill(0);
    sales.forEach(sale => {
      const d = new Date(sale.date);
      if (d.getFullYear() === currentYear) {
        monthlyData[d.getMonth()] += Utils.parseNum(sale.grandTotal);
      }
    });

    const maxVal = Math.max(...monthlyData, 1);
    const padding = { top: 20, right: 20, bottom: 40, left: 60 };
    const chartWidth = canvas.width - padding.left - padding.right;
    const chartHeight = canvas.height - padding.top - padding.bottom;
    const barWidth = chartWidth / 12 - 8;

    // Background
    ctx.fillStyle = 'transparent';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Grid lines
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = padding.top + (chartHeight / 4) * i;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(canvas.width - padding.right, y);
      ctx.stroke();

      // Y-axis labels
      ctx.fillStyle = '#64748b';
      ctx.font = '10px Inter';
      ctx.textAlign = 'right';
      const val = maxVal - (maxVal / 4) * i;
      ctx.fillText(Utils.formatShortCurrency(val), padding.left - 8, y + 4);
    }

    // Bars
    monthlyData.forEach((val, i) => {
      const x = padding.left + (chartWidth / 12) * i + 4;
      const barHeight = (val / maxVal) * chartHeight;
      const y = padding.top + chartHeight - barHeight;

      // Bar gradient
      const gradient = ctx.createLinearGradient(x, y, x, y + barHeight);
      gradient.addColorStop(0, '#818cf8');
      gradient.addColorStop(1, '#4f46e5');

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.roundRect(x, y, barWidth, barHeight, [4, 4, 0, 0]);
      ctx.fill();

      // Month label
      ctx.fillStyle = '#64748b';
      ctx.font = '10px Inter';
      ctx.textAlign = 'center';
      ctx.fillText(months[i], x + barWidth / 2, canvas.height - 10);
    });
  }
};
