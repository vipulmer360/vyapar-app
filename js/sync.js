/* ==========================================
   VYAPAR PWA — AUTO SYNC MODULE (Firestore)
   ========================================== */

const Sync = {
  isOnline: navigator.onLine,
  isSyncing: false,
  listeners: [],
  syncQueue: [],
  lastSyncTime: null,

  // Collection mapping: local storage key → Firestore subcollection name
  SYNC_COLLECTIONS: {
    'vyapar_incomes': 'incomes',
    'vyapar_expenses': 'expenses',
    'vyapar_accounts': 'accounts',
    'vyapar_parties': 'parties',
    'vyapar_sales': 'sales',
    'vyapar_purchases': 'purchases',
    'vyapar_payments': 'payments',
    'vyapar_items': 'items',
    'vyapar_categories': 'categories',
    'vyapar_settings': 'settings',
    'vyapar_counters': 'counters'
  },

  // Initialize sync system
  init() {
    // Monitor online/offline
    window.addEventListener('online', () => {
      this.isOnline = true;
      this._updateSyncIndicator('online');
      this.pushAll(); // Push any queued changes
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      this._updateSyncIndicator('offline');
    });
  },

  // Get Firestore user document reference
  _userDoc() {
    const user = Auth.getCurrentUser();
    if (!user) return null;
    return firebaseDB.collection('users').doc(user.uid);
  },

  // ========== PUSH: Local → Cloud ==========

  // Push a single collection to cloud
  async pushCollection(localKey) {
    if (localStorage.getItem('vyapar_cloud_sync_disabled') === 'true') return;
    const userDoc = this._userDoc();
    if (!userDoc) return;

    const cloudKey = this.SYNC_COLLECTIONS[localKey];
    if (!cloudKey) return;

    try {
      const localData = localStorage.getItem(localKey);
      if (localData === null) return;

      await userDoc.collection('data').doc(cloudKey).set({
        content: localData,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        localKey: localKey
      });

      console.log(`☁️ Pushed ${cloudKey} to cloud`);
    } catch (err) {
      console.error(`Push error for ${cloudKey}:`, err);
      // Queue for retry
      if (!this.syncQueue.includes(localKey)) {
        this.syncQueue.push(localKey);
      }
    }
  },

  // Push ALL collections to cloud
  async pushAll(force = false) {
    if (this.isSyncing && !force) return;
    this.isSyncing = true;
    this._updateSyncIndicator('syncing');

    try {
      const promises = Object.keys(this.SYNC_COLLECTIONS).map(key =>
        this.pushCollection(key)
      );
      await Promise.all(promises);

      // Process queued items
      while (this.syncQueue.length > 0) {
        const key = this.syncQueue.shift();
        await this.pushCollection(key);
      }

      this.lastSyncTime = new Date();
      localStorage.setItem('vyapar_lastSync', this.lastSyncTime.toISOString());
      this._updateSyncIndicator('synced');
      console.log('✅ All data pushed to cloud');
    } catch (err) {
      console.error('Push all error:', err);
      this._updateSyncIndicator('error');
    }

    this.isSyncing = false;
  },

  // ========== PULL: Cloud → Local ==========

  // Pull a single collection from cloud
  async pullCollection(localKey) {
    const userDoc = this._userDoc();
    if (!userDoc) return false;

    const cloudKey = this.SYNC_COLLECTIONS[localKey];
    if (!cloudKey) return false;

    try {
      const doc = await userDoc.collection('data').doc(cloudKey).get();
      if (doc.exists) {
        const cloudData = doc.data().content;
        localStorage.setItem(localKey, cloudData);
        console.log(`📥 Pulled ${cloudKey} from cloud`);
        return true;
      }
      return false;
    } catch (err) {
      console.error(`Pull error for ${cloudKey}:`, err);
      return false;
    }
  },

  // Pull ALL collections from cloud
  async pullAll(force = false) {
    if (localStorage.getItem('vyapar_cloud_sync_disabled') === 'true') {
      App.toast('Cloud sync is currently OFF in Settings 🔴', 'warning');
      return;
    }
    if (this.isSyncing && !force) return;
    this.isSyncing = true;
    this._updateSyncIndicator('syncing');

    try {
      let pulledAny = false;
      for (const localKey of Object.keys(this.SYNC_COLLECTIONS)) {
        const pulled = await this.pullCollection(localKey);
        if (pulled) pulledAny = true;
      }

      this.lastSyncTime = new Date();
      localStorage.setItem('vyapar_lastSync', this.lastSyncTime.toISOString());
      this._updateSyncIndicator('synced');

      if (pulledAny) {
        console.log('✅ Cloud data pulled — refreshing UI');
        App.refreshPage();
      }
    } catch (err) {
      console.error('Pull all error:', err);
      this._updateSyncIndicator('error');
    }

    this.isSyncing = false;
  },

  // ========== SMART SYNC: Merge Cloud ↔ Local ==========

  async smartSync() {
    if (localStorage.getItem('vyapar_cloud_sync_disabled') === 'true') {
      console.log('🔴 Cloud sync is disabled in settings');
      return;
    }
    const userDoc = this._userDoc();
    if (!userDoc) return;

    this.isSyncing = true;
    this._updateSyncIndicator('syncing');

    try {
      // Check if cloud has data
      const snapshot = await userDoc.collection('data').get();
      const cloudHasData = !snapshot.empty;

      // Check if local has data
      const localHasData = Object.keys(this.SYNC_COLLECTIONS).some(key => {
        const data = localStorage.getItem(key);
        return data && data !== '[]' && data !== '{}' && data !== 'null';
      });

      if (cloudHasData && !localHasData) {
        // Cloud has data, local is empty → Pull from cloud
        console.log('📥 First login — pulling cloud data...');
        await this.pullAll(true);
        App.toast('Cloud data restored! ☁️', 'success');
      } else if (localHasData && !cloudHasData) {
        // Local has data, cloud is empty → Push to cloud
        console.log('☁️ First sync — pushing local data to cloud...');
        await this.pushAll(true);
        App.toast('Local data synced to cloud! ☁️', 'success');
      } else if (cloudHasData && localHasData) {
        // Both have data → Merge (cloud wins for each collection based on timestamp)
        console.log('🔄 Merging cloud + local data...');
        await this._mergeData(snapshot);
        App.toast('Data synced! 🔄', 'success');
      } else {
        // Both empty — nothing to do
        console.log('📭 No data to sync');
      }

      // Start real-time listeners
      this._startRealtimeListeners();

    } catch (err) {
      console.error('Smart sync error:', err);
      this._updateSyncIndicator('error');
    }

    this.isSyncing = false;
  },

  // Delete all cloud & local data permanently by overwriting with empty arrays
  async wipeAllData() {
    this.isSyncing = true;
    this._stopRealtimeListeners();

    // 1. Overwrite all local storage keys with empty arrays
    Object.keys(this.SYNC_COLLECTIONS).forEach(localKey => {
      if (localKey === 'vyapar_settings') {
        localStorage.setItem(localKey, JSON.stringify(DB.getSettings()));
      } else {
        localStorage.setItem(localKey, '[]');
      }
    });

    // 2. Delete all Firestore cloud documents explicitly
    const userDoc = this._userDoc();
    if (userDoc) {
      try {
        const promises = Object.entries(this.SYNC_COLLECTIONS).map(([localKey, cloudKey]) => {
          const docRef = userDoc.collection('data').doc(cloudKey);
          return docRef.delete();
        });
        await Promise.all(promises);
        console.log('🗑️ All Cloud collections explicitly deleted');
      } catch (err) {
        console.error('Error wiping cloud data:', err);
      }
    }

    // 3. Double guarantee: Push all empty collections to cloud again
    try {
      await this.pushAll(true);
    } catch (e) {
      console.error('Error pushing empty state to cloud:', e);
    }

    this.isSyncing = false;
  },

  // Delete ONLY cloud data, leave local data untouched
  async deleteCloudDataOnly() {
    this.isSyncing = true;
    this._updateSyncIndicator('syncing');
    
    const userDoc = this._userDoc();
    if (userDoc) {
      try {
        const promises = Object.entries(this.SYNC_COLLECTIONS).map(([localKey, cloudKey]) => {
          const docRef = userDoc.collection('data').doc(cloudKey);
          return docRef.delete();
        });
        await Promise.all(promises);
        console.log('🗑️ Cloud Data Deleted Successfully');
        App.toast('Cloud Data Permanently Deleted 🗑️', 'success');
      } catch (err) {
        console.error('Error deleting cloud data:', err);
        App.toast('Failed to delete cloud data', 'error');
      }
    } else {
      App.toast('Not logged in to Google', 'error');
    }
    
    this.isSyncing = false;
    this._updateSyncIndicator('synced');
  },

  // Merge cloud data with local (cloud wins on conflicts)
  async _mergeData(snapshot) {
    for (const doc of snapshot.docs) {
      const cloudKey = doc.id;
      const cloudContent = doc.data().content;
      const localKey = doc.data().localKey;

      if (!localKey || !cloudContent) continue;

      const localContent = localStorage.getItem(localKey);

      // If cloud has data and local doesn't → use cloud
      if (cloudContent && (!localContent || localContent === '[]' || localContent === '{}')) {
        localStorage.setItem(localKey, cloudContent);
        continue;
      }

      // Both have data → merge arrays by ID (cloud wins for duplicates)
      try {
        const cloudItems = JSON.parse(cloudContent);
        const localItems = JSON.parse(localContent);

        if (Array.isArray(cloudItems) && Array.isArray(localItems)) {
          const mergedMap = new Map();

          // Add local items first
          localItems.forEach(item => {
            if (item.id) mergedMap.set(item.id, item);
          });

          // Cloud items overwrite local or get added
          cloudItems.forEach(item => {
            if (item.id) {
              const local = mergedMap.get(item.id);
              if (!local || !item.updatedAt || !local.updatedAt || item.updatedAt >= local.updatedAt) {
                mergedMap.set(item.id, item);
              }
            }
          });

          const merged = Array.from(mergedMap.values());
          localStorage.setItem(localKey, JSON.stringify(merged));
        } else {
          // Not arrays (settings/counters) — use cloud version
          localStorage.setItem(localKey, cloudContent);
        }
      } catch (e) {
        // Parse error — use cloud version
        localStorage.setItem(localKey, cloudContent);
      }
    }

    // Now push merged data back to cloud
    await this.pushAll(true);
    App.refreshPage();
  },

  // Full Two-Way Sync (Pull + Merge + Push)
  async syncNow() {
    App.toast('Syncing with Cloud... 🔄', 'info');
    await this.smartSync();
  },

  // ========== REAL-TIME LISTENERS ==========

  _startRealtimeListeners() {
    // Stop existing listeners
    this._stopRealtimeListeners();

    const userDoc = this._userDoc();
    if (!userDoc) return;

    // Listen for changes on each collection
    const unsubscribe = userDoc.collection('data').onSnapshot(snapshot => {
      if (this.isSyncing) return; // Skip if we're the ones syncing

      snapshot.docChanges().forEach(change => {
        if (change.type === 'modified' || change.type === 'added') {
          const data = change.doc.data();
          if (data.localKey && data.content) {
            // Check if this change is newer than local
            const currentLocal = localStorage.getItem(data.localKey);
            if (currentLocal !== data.content) {
              localStorage.setItem(data.localKey, data.content);
              console.log(`🔄 Realtime update: ${data.localKey}`);
              App.refreshPage();
            }
          }
        }
      });
    }, err => {
      console.error('Realtime listener error:', err);
    });

    this.listeners.push(unsubscribe);
  },

  _stopRealtimeListeners() {
    this.listeners.forEach(unsub => unsub());
    this.listeners = [];
  },

  // ========== AUTO-SYNC ON DB CHANGE ==========

  // Called by DB module after every add/update/delete
  onDataChange(collection) {
    if (!Auth.isLoggedIn()) return;

    // Debounce: wait 500ms before pushing to avoid rapid-fire updates
    clearTimeout(this._pushTimer);
    this._pushTimer = setTimeout(() => {
      this.pushCollection(collection);
    }, 500);
  },

  // ========== UI INDICATOR ==========

  _updateSyncIndicator(status) {
    const el = document.getElementById('syncIndicator');
    if (!el) return;

    const states = {
      online: { icon: '🟢', text: 'Online', cls: 'sync-online' },
      offline: { icon: '🔴', text: 'Offline', cls: 'sync-offline' },
      syncing: { icon: '🔄', text: 'Syncing...', cls: 'sync-syncing' },
      synced: { icon: '☁️', text: 'Synced', cls: 'sync-synced' },
      error: { icon: '⚠️', text: 'Sync Error', cls: 'sync-error' }
    };

    const s = states[status] || states.online;
    el.className = 'sync-indicator ' + s.cls;
    el.innerHTML = `${s.icon} <span>${s.text}</span>`;
  },

  // Get last sync time display
  getLastSyncDisplay() {
    const last = localStorage.getItem('vyapar_lastSync');
    if (!last) return 'Never';
    const d = new Date(last);
    return d.toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' });
  }
};
