/* ==========================================
   VYAPAR PWA — SETTINGS MODULE
   ========================================== */

const Settings = {
  render() {
    const settings = DB.getSettings();

    return `
      <div style="max-width:600px">
        <!-- Business Profile -->
        <div class="card mb-3">
          <div class="card-header">
            <h3 class="card-title">🏢 Business Profile</h3>
          </div>
          <form id="settingsForm" autocomplete="off" onsubmit="Settings.save(event)">
            <div class="form-group">
              <label class="form-label">Business Name</label>
              <input type="text" class="form-input" name="businessName" value="${Utils.escapeHtml(settings.businessName)}" placeholder="Your Business Name">
            </div>
            <div class="form-group">
              <label class="form-label">Address</label>
              <textarea class="form-textarea" name="businessAddress" rows="2" placeholder="Full business address">${Utils.escapeHtml(settings.businessAddress || '')}</textarea>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Phone</label>
                <input type="tel" class="form-input" name="businessPhone" value="${Utils.escapeHtml(settings.businessPhone || '')}" placeholder="Phone number">
              </div>
              <div class="form-group">
                <label class="form-label">Email</label>
                <input type="email" class="form-input" name="businessEmail" value="${Utils.escapeHtml(settings.businessEmail || '')}" placeholder="Email address">
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">GSTIN</label>
                <input type="text" class="form-input" name="gstin" value="${Utils.escapeHtml(settings.gstin || '')}" placeholder="e.g. 27AADCB2230M1ZX" maxlength="15">
              </div>
              <div class="form-group">
                <label class="form-label">State</label>
                <input type="text" class="form-input" name="state" value="${Utils.escapeHtml(settings.state || '')}" placeholder="e.g. Maharashtra">
              </div>
            </div>

            <div class="divider"></div>
            <h3 class="card-title mb-2">🏦 Bank Details (for Invoice)</h3>
            <div class="form-group">
              <label class="form-label">Bank Name</label>
              <input type="text" class="form-input" name="bankName" value="${Utils.escapeHtml(settings.bankName || '')}" placeholder="Bank name">
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Account Number</label>
                <input type="text" class="form-input" name="accountNumber" value="${Utils.escapeHtml(settings.accountNumber || '')}" placeholder="Account number">
              </div>
              <div class="form-group">
                <label class="form-label">IFSC Code</label>
                <input type="text" class="form-input" name="ifscCode" value="${Utils.escapeHtml(settings.ifscCode || '')}" placeholder="IFSC code">
              </div>
            </div>

            <div class="divider"></div>
            <h3 class="card-title mb-2">🧾 Invoice Settings</h3>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Invoice Prefix</label>
                <input type="text" class="form-input" name="invoicePrefix" value="${Utils.escapeHtml(settings.invoicePrefix || 'INV')}" placeholder="INV">
              </div>
              <div class="form-group">
                <label class="form-label">Purchase Prefix</label>
                <input type="text" class="form-input" name="purchasePrefix" value="${Utils.escapeHtml(settings.purchasePrefix || 'PUR')}" placeholder="PUR">
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Terms & Conditions</label>
              <textarea class="form-textarea" name="termsAndConditions" rows="3" placeholder="Invoice terms & conditions">${Utils.escapeHtml(settings.termsAndConditions || '')}</textarea>
            </div>

            <button type="submit" class="btn btn-primary btn-block mt-2">💾 Save Settings</button>
          </form>
        </div>

        <!-- Cloud Sync & Account Status -->
        <div class="card mb-3">
          <div class="card-header">
            <h3 class="card-title">☁️ Cloud Account & Sync</h3>
          </div>
          <div style="display:flex;flex-direction:column;gap:12px">
            <div style="display:flex;align-items:center;justify-content:space-between;padding:12px;background:var(--bg-glass);border-radius:var(--radius-sm)">
              <div>
                <div class="font-bold">👤 Account: ${Auth.getUserInfo() ? Utils.escapeHtml(Auth.getUserInfo().name) : 'Not Logged In'}</div>
                <div class="text-muted" style="font-size:0.8rem">${Auth.getUserInfo() ? Utils.escapeHtml(Auth.getUserInfo().email) : ''}</div>
              </div>
              <button class="btn btn-outline btn-sm" onclick="App.handleLogout()">
                🚪 Logout
              </button>
            </div>

            <div style="display:flex;align-items:center;justify-content:space-between;padding:12px;background:var(--bg-glass);border-radius:var(--radius-sm)">
              <div>
                <div class="font-bold">⚡ Cloud Auto Sync</div>
                <div class="text-muted" style="font-size:0.8rem">Turn OFF if you don't want cloud data auto-restoring</div>
              </div>
              <button class="btn ${Settings.isCloudSyncDisabled() ? 'btn-danger' : 'btn-success'} btn-sm" onclick="Settings.toggleCloudSync()" style="font-weight:700">
                ${Settings.isCloudSyncDisabled() ? '🔴 Cloud Sync: OFF' : '🟢 Cloud Sync: ON'}
              </button>
            </div>

            <div style="display:flex;align-items:center;justify-content:space-between;padding:12px;background:var(--bg-glass);border-radius:var(--radius-sm)">
              <div>
                <div class="font-bold">📥 Pull Cloud Data (Restore)</div>
                <div class="text-muted" style="font-size:0.8rem">Download data saved in your Google Account to this device</div>
              </div>
              <button class="btn btn-success btn-sm" onclick="Sync.pullAll()">
                📥 Restore Cloud Data
              </button>
            </div>

            <div style="display:flex;align-items:center;justify-content:space-between;padding:12px;background:var(--bg-glass);border-radius:var(--radius-sm)">
              <div>
                <div class="font-bold">📤 Push Local Data</div>
                <div class="text-muted" style="font-size:0.8rem">Upload data from this device to your Google Account</div>
              </div>
              <button class="btn btn-primary btn-sm" onclick="Sync.pushAll()">
                📤 Push to Cloud
              </button>
            </div>

            <div style="display:flex;align-items:center;justify-content:space-between;padding:12px;background:var(--bg-glass);border-radius:var(--radius-sm)">
              <div>
                <div class="font-bold">🔄 Two-Way Smart Sync</div>
                <div class="text-muted" style="font-size:0.8rem">Merge local device data and cloud data</div>
              </div>
              <button class="btn btn-accent btn-sm" onclick="Sync.syncNow()">
                🔄 Smart Sync
              </button>
            </div>

            <div style="display:flex;align-items:center;justify-content:space-between;padding:12px;background:var(--bg-glass);border-radius:var(--radius-sm)">
              <div>
                <div class="font-bold text-danger">⚠️ Delete Cloud Data</div>
                <div class="text-muted" style="font-size:0.8rem">Permanently wipe all data from your Google Account (Keeps local device data)</div>
              </div>
              <button class="btn btn-danger btn-sm" onclick="Settings.handleDeleteCloudDataOnly()">
                🗑️ Delete Cloud Data
              </button>
            </div>
          </div>
        </div>

        <!-- Data Management -->
        <div class="card mb-3">
          <div class="card-header">
            <h3 class="card-title">💾 Data Management</h3>
          </div>
          
          <div style="display:flex;flex-direction:column;gap:12px">
            <div style="display:flex;align-items:center;justify-content:space-between;padding:12px;background:var(--bg-glass);border-radius:var(--radius-sm)">
              <div>
                <div class="font-bold">📥 Export Backup</div>
                <div class="text-muted" style="font-size:0.8rem">Download all data as JSON file</div>
              </div>
              <button class="btn btn-outline btn-sm" onclick="Settings.exportData()">
                ${Utils.icons.download} Export
              </button>
            </div>
            
            <div style="display:flex;align-items:center;justify-content:space-between;padding:12px;background:var(--bg-glass);border-radius:var(--radius-sm)">
              <div>
                <div class="font-bold">📤 Import Backup</div>
                <div class="text-muted" style="font-size:0.8rem">Restore data from JSON file</div>
              </div>
              <label class="btn btn-outline btn-sm" style="cursor:pointer">
                ${Utils.icons.upload} Import
                <input type="file" accept=".json" onchange="Settings.importData(event)" style="display:none">
              </label>
            </div>

            <div style="display:flex;align-items:center;justify-content:space-between;padding:12px;background:var(--bg-glass);border-radius:var(--radius-sm)">
              <div>
                <div class="font-bold">📊 Load Demo Data</div>
                <div class="text-muted" style="font-size:0.8rem">Add sample parties, items for testing</div>
              </div>
              <button class="btn btn-outline btn-sm" onclick="Settings.loadDemo()">
                Load Demo
              </button>
            </div>

            <div class="divider"></div>

            <div style="display:flex;align-items:center;justify-content:space-between;padding:12px;background:var(--danger-bg);border-radius:var(--radius-sm);border:1px solid rgba(239,68,68,0.2)">
              <div>
                <div class="font-bold text-danger">🗑️ Clear All Data</div>
                <div class="text-muted" style="font-size:0.8rem">Delete everything permanently</div>
              </div>
              <button class="btn btn-danger btn-sm" onclick="Settings.clearData()">
                Clear All
              </button>
            </div>
          </div>
        </div>

        <!-- App Info -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">ℹ️ App Info</h3>
          </div>
          <div style="font-size:0.85rem;color:var(--text-muted)">
            <p><strong>App:</strong> Vyapar Business App</p>
            <p><strong>Version:</strong> 1.0.0 (PWA)</p>
            <p><strong>Storage:</strong> localStorage (Browser)</p>
            <p style="margin-top:8px">Made with ❤️ for Indian Businesses</p>
          </div>
        </div>
      </div>
    `;
  },

  save(e) {
    e.preventDefault();
    const form = new FormData(e.target);
    const settings = {
      businessName: form.get('businessName'),
      businessAddress: form.get('businessAddress'),
      businessPhone: form.get('businessPhone'),
      businessEmail: form.get('businessEmail'),
      gstin: form.get('gstin'),
      state: form.get('state'),
      bankName: form.get('bankName'),
      accountNumber: form.get('accountNumber'),
      ifscCode: form.get('ifscCode'),
      invoicePrefix: form.get('invoicePrefix'),
      purchasePrefix: form.get('purchasePrefix'),
      termsAndConditions: form.get('termsAndConditions')
    };
    DB.saveSettings(settings);
    App.toast('Settings saved! ⚙️', 'success');
    // Update sidebar business name
    const brandEl = document.querySelector('.sidebar-brand h1');
    if (brandEl) brandEl.textContent = settings.businessName;
  },

  exportData() {
    const data = DB.exportAll();
    Utils.downloadFile(data, `vyapar_backup_${Utils.today()}.json`);
    App.toast('Backup downloaded! 📥', 'success');
  },

  importData(e) {
    const file = e.target.files[0];
    if (!file) return;

    if (!confirm('This will MERGE with existing data. Continue?')) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const success = DB.importAll(event.target.result);
      if (success) {
        App.toast('Data imported successfully! 📤', 'success');
        App.refreshPage();
      } else {
        App.toast('Import failed. Invalid file.', 'error');
      }
    };
    reader.readAsText(file);
  },

  loadDemo() {
    DB.seedDemoData();
    App.toast('Demo data loaded! 📊', 'success');
    App.refreshPage();
  },

  isCloudSyncDisabled() {
    return localStorage.getItem('vyapar_cloud_sync_disabled') === 'true';
  },

  toggleCloudSync() {
    const current = this.isCloudSyncDisabled();
    if (current) {
      localStorage.removeItem('vyapar_cloud_sync_disabled');
      App.toast('Cloud Sync turned ON 🟢', 'success');
    } else {
      localStorage.setItem('vyapar_cloud_sync_disabled', 'true');
      App.toast('Cloud Sync turned OFF 🔴', 'warning');
    }
    App.refreshPage();
  },

  async handleDeleteCloudDataOnly() {
    if (!confirm('⚠️ Are you sure you want to PERMANENTLY DELETE all cloud data from your Google Account? (Your local data on this phone will NOT be deleted)')) return;
    await Sync.deleteCloudDataOnly();
  },

  async clearData() {
    if (!confirm('⚠️ DELETE ALL DATA (Local & Cloud)? This cannot be undone!')) return;
    if (!confirm('Are you REALLY sure? All cloud backups will also be permanently deleted.')) return;
    
    App.toast('Wiping all local and cloud data... ⏳', 'info');
    
    try {
      if (window.Sync && Sync.wipeAllData) {
        await Sync.wipeAllData();
      } else {
        DB.clearAll();
      }
      App.toast('All local & cloud data cleared permanently! 🗑️', 'success');
    } catch (err) {
      console.error('Clear data error:', err);
      DB.clearAll();
      App.toast('Local data cleared! 🗑️', 'warning');
    }

    App.refreshPage();
  }
};
