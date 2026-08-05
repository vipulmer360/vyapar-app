/* ==========================================
   VYAPAR PWA — MAIN APP CONTROLLER
   ========================================== */

const App = {
  currentPage: 'dashboard',
  deferredPrompt: null,

  // Page config
  pages: {
    dashboard: { title: '📊 Dashboard', icon: 'dashboard', module: Dashboard },
    transactions: { title: '🧾 Transactions', icon: 'reports', render: () => Transactions.renderAll() },
    parties: { title: '👥 Parties', icon: 'parties', module: Parties },
    income: { title: '💵 Income', icon: 'sales', render: () => Transactions.render('income') },
    expense: { title: '💸 Expense', icon: 'purchase', render: () => Transactions.render('expense') },
    accounts: { title: '🏦 Accounts', icon: 'payments', module: Accounts },
    reports: { title: '📈 Reports', icon: 'reports', module: Reports },
    settings: { title: '⚙️ Settings', icon: 'settings', module: Settings }
  },

  // Initialize app
  init() {
    this.registerServiceWorker();
    this.handleInstallPrompt();

    // Initialize sync module
    if (typeof Sync !== 'undefined') Sync.init();

    // Listen for auth state changes
    Auth.onAuthStateChanged(user => {
      if (user) {
        // Detect user switch: if different user logged in, clear local data first
        const lastUid = localStorage.getItem('vyapar_lastUid');
        if (lastUid && lastUid !== user.uid) {
          console.log('🔄 Different user detected — clearing old local data...');
          // Clear all collection data (not settings needed for app shell)
          Object.values(DB.COLLECTIONS).forEach(col => {
            localStorage.removeItem(col);
          });
        }
        localStorage.setItem('vyapar_lastUid', user.uid);

        // User is logged in — show main app
        this.renderShell();
        this.handleRouting();

        // Load from hash
        const hash = window.location.hash.replace('#', '');
        if (hash && this.pages[hash]) {
          this.currentPage = hash;
        }
        this.renderPage();

        // Handle back/forward
        window.addEventListener('hashchange', () => {
          const hash = window.location.hash.replace('#', '');
          if (hash && this.pages[hash]) {
            this.currentPage = hash;
            this.renderPage();
          }
        });

        // Start smart sync (pulls cloud data for this user)
        if (typeof Sync !== 'undefined') {
          Sync.smartSync();
        }
      } else {
        // Not logged in — show login screen
        this.renderLoginScreen();
      }
    });
  },

  // Register service worker
  registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./service-worker.js')
        .then(reg => console.log('SW registered:', reg.scope))
        .catch(err => console.log('SW failed:', err));
    }
  },

  // Handle PWA install prompt
  handleInstallPrompt() {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredPrompt = e;
      const banner = document.getElementById('installBanner');
      if (banner) banner.classList.add('show');
    });

    window.addEventListener('appinstalled', () => {
      this.deferredPrompt = null;
      const banner = document.getElementById('installBanner');
      if (banner) banner.classList.remove('show');
      this.toast('App installed! 🎉', 'success');
    });
  },

  installApp() {
    if (!this.deferredPrompt) {
      this.toast('Open in Chrome & use "Add to Home Screen"', 'info');
      return;
    }
    this.deferredPrompt.prompt();
    this.deferredPrompt.userChoice.then(choice => {
      if (choice.outcome === 'accepted') {
        this.toast('Installing... 📱', 'success');
      }
      this.deferredPrompt = null;
    });
  },

  // ========== LOGIN SCREEN ==========
  renderLoginScreen() {
    const container = document.getElementById('app');
    container.innerHTML = `
      <div class="login-screen">
        <div class="login-card">
          <div class="login-header">
            <img src="assets/icons/icon-192.png" alt="Vyapar" class="login-logo">
            <h1 class="login-title">Vyapar</h1>
            <p class="login-subtitle">Business Accounting App</p>
          </div>
          <div class="login-body">
            <p class="login-desc">Apne business data ko cloud par safely sync karein.<br>Multiple devices par access karein.</p>
            <button class="google-login-btn" onclick="Auth.signInWithGoogle()" id="googleLoginBtn">
              <svg viewBox="0 0 24 24" width="22" height="22">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              <span>Sign in with Google</span>
            </button>
          </div>
          <div class="login-footer">
            <p>🔒 Secure • ☁️ Cloud Sync • 📱 Multi-Device</p>
          </div>
        </div>
      </div>
    `;
  },

  // Handle routing
  handleRouting() {
    // Close sidebar on mobile when clicking overlay
    document.addEventListener('click', (e) => {
      const sidebar = document.querySelector('.sidebar');
      if (sidebar && sidebar.classList.contains('open') && !sidebar.contains(e.target) && !e.target.classList.contains('hamburger')) {
        sidebar.classList.remove('open');
      }
    });
  },

  // Render app shell
  renderShell() {
    const settings = DB.getSettings();
    const userInfo = Auth.getUserInfo();
    const container = document.getElementById('app');
    
    container.innerHTML = `
      <div class="app-container">
        <!-- Sidebar -->
        <aside class="sidebar" id="sidebar">
          <div class="sidebar-header">
            <img src="assets/icons/icon-192.png" alt="Logo" class="sidebar-logo">
            <div class="sidebar-brand">
              <h1>${Utils.escapeHtml(settings.businessName)}</h1>
              <p>Business App</p>
            </div>
          </div>
          <nav class="sidebar-nav" id="sidebarNav">
            ${Object.entries(this.pages).map(([key, page]) => `
              <div class="nav-item ${key === this.currentPage ? 'active' : ''}" 
                   onclick="App.navigate('${key}')" data-page="${key}">
                ${Utils.icon(page.icon)}
                <span>${page.title}</span>
              </div>
            `).join('')}
          </nav>
          <div class="sidebar-footer">
            <!-- User Profile in Sidebar -->
            <div class="sidebar-user">
              ${userInfo && userInfo.photo ? `<img src="${userInfo.photo}" alt="avatar" class="sidebar-user-avatar">` : '<span class="sidebar-user-avatar-placeholder">👤</span>'}
              <div class="sidebar-user-info">
                <span class="sidebar-user-name">${userInfo ? Utils.escapeHtml(userInfo.name) : 'Guest'}</span>
                <span class="sidebar-user-email">${userInfo ? Utils.escapeHtml(userInfo.email) : ''}</span>
              </div>
            </div>
            <button class="btn btn-outline btn-sm sidebar-logout-btn" onclick="App.handleLogout()">🚪 Logout</button>
            <div class="business-info">v1.0.0 • PWA • Cloud Sync</div>
          </div>
        </aside>

        <!-- Main Content -->
        <main class="main-content">
          <header class="top-header">
            <div style="display:flex;align-items:center;gap:12px">
              <button class="hamburger" onclick="App.toggleSidebar()">
                ${Utils.icons.menu}
              </button>
              <h2 class="page-title" id="pageTitle">${this.pages[this.currentPage].title}</h2>
            </div>
            <div class="header-actions" style="display:flex;align-items:center;gap:8px">
              <div class="sync-indicator" id="syncIndicator">☁️ <span>Synced</span></div>
              <button class="btn btn-ghost btn-icon" onclick="App.refreshPage()" title="Refresh">
                ${Utils.icons.refresh}
              </button>
              <button class="btn btn-ghost btn-icon" onclick="Sync.syncNow()" title="Force Sync (Pull & Push)">🔄</button>
              ${userInfo && userInfo.photo ? `<img src="${userInfo.photo}" alt="user" class="header-user-avatar" onclick="App.handleLogout()" title="Logout">` : ''}
            </div>
          </header>
          <div class="page-content" id="pageContent">
            <!-- Dynamic content -->
          </div>
        </main>
      </div>

      <!-- Bottom Nav (Mobile) -->
      <nav class="bottom-nav" id="bottomNav">
        ${['dashboard', 'transactions', 'parties', 'income', 'expense'].map(key => `
          <div class="bottom-nav-item ${key === this.currentPage ? 'active' : ''}" 
               onclick="App.navigate('${key}')" data-page="${key}">
            ${Utils.icons[this.pages[key].icon]}
            <span>${key.charAt(0).toUpperCase() + key.slice(1)}</span>
          </div>
        `).join('')}
      </nav>

      <!-- Modal -->
      <div class="modal-overlay" id="modalOverlay" onclick="if(event.target===this)App.closeModal()">
        <div class="modal" id="modalContainer">
          <div class="modal-header">
            <h3 class="modal-title" id="modalTitle"></h3>
            <button class="modal-close" onclick="App.closeModal()">${Utils.icons.close}</button>
          </div>
          <div class="modal-body" id="modalBody"></div>
        </div>
      </div>

      <!-- Toast Container -->
      <div class="toast-container" id="toastContainer"></div>

      <!-- Print Invoice Area -->
      <div class="print-invoice" id="printInvoice"></div>
    `;
  },

  // Handle Logout
  handleLogout() {
    if (confirm('Are you sure you want to logout?')) {
      if (typeof Sync !== 'undefined') {
        Sync._stopRealtimeListeners();
      }
      Auth.signOut();
    }
  },

  // Navigate to page
  navigate(page) {
    if (!this.pages[page]) return;
    this.currentPage = page;
    window.location.hash = page;
    this.renderPage();
    this.updateNav();
    // Close sidebar on mobile
    document.getElementById('sidebar')?.classList.remove('open');
  },

  // Render current page
  renderPage() {
    const page = this.pages[this.currentPage];
    const content = document.getElementById('pageContent');
    const title = document.getElementById('pageTitle');

    if (content) {
      if (page.render) {
        content.innerHTML = page.render();
      } else if (page.module && page.module.render) {
        content.innerHTML = page.module.render();
      }
    }
    if (title) title.textContent = page.title;
  },

  // Refresh current page
  refreshPage() {
    this.renderPage();
    this.updateNav();
  },

  // Update navigation active states
  updateNav() {
    // Sidebar
    document.querySelectorAll('#sidebarNav .nav-item').forEach(item => {
      item.classList.toggle('active', item.dataset.page === this.currentPage);
    });
    // Bottom nav
    document.querySelectorAll('#bottomNav .bottom-nav-item').forEach(item => {
      item.classList.toggle('active', item.dataset.page === this.currentPage);
    });
  },

  // Toggle sidebar (mobile)
  toggleSidebar() {
    document.getElementById('sidebar')?.classList.toggle('open');
  },

  // Show modal
  showModal(title, content, extraClass = '') {
    const overlay = document.getElementById('modalOverlay');
    const titleEl = document.getElementById('modalTitle');
    const bodyEl = document.getElementById('modalBody');
    const container = document.getElementById('modalContainer');

    if (titleEl) titleEl.textContent = title;
    if (bodyEl) bodyEl.innerHTML = content;
    if (container) container.className = 'modal ' + extraClass;
    if (overlay) overlay.classList.add('show');

    // Prevent body scroll
    document.body.style.overflow = 'hidden';
  },

  // Close modal
  closeModal() {
    const overlay = document.getElementById('modalOverlay');
    if (overlay) overlay.classList.remove('show');
    document.body.style.overflow = '';
  },

  // Toast notification
  toast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const icons = {
      success: '✅',
      error: '❌',
      warning: '⚠️',
      info: 'ℹ️'
    };

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<span>${icons[type] || ''}</span> ${message}`;
    container.appendChild(toast);

    // Auto remove after 3 seconds
    setTimeout(() => {
      toast.classList.add('toast-exit');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => App.init());
