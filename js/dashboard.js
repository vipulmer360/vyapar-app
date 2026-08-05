/* ==========================================
   VYAPAR PWA — DASHBOARD MODULE
   ========================================== */

const Dashboard = {
  render() {
    return `
      <!-- Install Banner -->
      <div class="install-banner" id="installBanner" onclick="App.installApp()">
        📱 App install karein apne phone mein!
        <button class="btn btn-sm">Install</button>
      </div>

      <!-- Accounts Horizontal Grid -->
      <div class="accounts-horizontal-section">
        <div class="accounts-section-header">
          <div class="accounts-section-title">🏦 My Accounts</div>
          <button class="btn btn-sm btn-outline" onclick="App.navigate('accounts')">View All</button>
        </div>
        ${Accounts.renderDashboardGrid()}
      </div>

      <!-- Quick Actions -->
      <div class="quick-actions">
        <button class="quick-action-btn" style="border-color:var(--success)" onclick="Transactions.openAddModal('income')">
          <span style="font-size:1.5rem">💵</span>
          Add Income
        </button>
        <button class="quick-action-btn" style="border-color:var(--danger)" onclick="Transactions.openAddModal('expense')">
          <span style="font-size:1.5rem">💸</span>
          Add Expense
        </button>
        <button class="quick-action-btn" onclick="App.navigate('accounts'); Accounts.openAddAccount()">
          <span style="font-size:1.5rem">🏦</span>
          Add Account
        </button>
        <button class="quick-action-btn" onclick="App.navigate('reports')">
          ${Utils.icons.reports}
          Reports
        </button>
      </div>

      <!-- Recent Transactions (4 Rows) -->
      <div class="recent-list mt-3">
        <div class="recent-list-header">
          <div class="recent-list-title">🧾 Recent Transactions</div>
          <button class="btn btn-sm btn-outline" onclick="App.navigate('transactions')">View All</button>
        </div>
        ${Transactions.renderRecentDashboardRows(4)}
      </div>
    `;
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
