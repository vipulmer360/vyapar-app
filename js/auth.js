/* ==========================================
   VYAPAR PWA — AUTHENTICATION MODULE
   ========================================== */

const Auth = {
  currentUser: null,

  // Google Sign-In
  async signInWithGoogle() {
    try {
      const provider = new firebase.auth.GoogleAuthProvider();
      const result = await firebaseAuth.signInWithPopup(provider);
      this.currentUser = result.user;
      App.toast(`Welcome, ${result.user.displayName}! 🎉`, 'success');
      return result.user;
    } catch (err) {
      console.error('Sign-in error:', err);
      if (err.code === 'auth/popup-closed-by-user') {
        App.toast('Login cancelled', 'warning');
      } else {
        App.toast('Login failed: ' + err.message, 'error');
      }
      return null;
    }
  },

  // Sign Out
  async signOut() {
    try {
      await firebaseAuth.signOut();
      this.currentUser = null;
      App.toast('Logged out successfully', 'info');
    } catch (err) {
      console.error('Sign-out error:', err);
    }
  },

  // Listen for auth state changes
  onAuthStateChanged(callback) {
    firebaseAuth.onAuthStateChanged(user => {
      this.currentUser = user;
      callback(user);
    });
  },

  // Get current user
  getCurrentUser() {
    return this.currentUser || firebaseAuth.currentUser;
  },

  // Check if logged in
  isLoggedIn() {
    return !!this.getCurrentUser();
  },

  // Get user display info
  getUserInfo() {
    const user = this.getCurrentUser();
    if (!user) return null;
    return {
      uid: user.uid,
      name: user.displayName || 'User',
      email: user.email || '',
      photo: user.photoURL || ''
    };
  }
};
