/* ==========================================
   VYAPAR PWA — FIREBASE CONFIGURATION
   ========================================== */

// ⚠️ IMPORTANT: Replace these values with YOUR Firebase project config!
// Go to https://console.firebase.google.com → Create Project → Web App → Copy Config
const FIREBASE_CONFIG = {
  apiKey: "YOUR_API_KEY_HERE",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// Initialize Firebase
firebase.initializeApp(FIREBASE_CONFIG);

// Firebase services
const firebaseAuth = firebase.auth();
const firebaseDB = firebase.firestore();

// Enable offline persistence for Firestore
firebaseDB.enablePersistence({ synchronizeTabs: true }).catch(err => {
  console.log('Firestore persistence error:', err.code);
});

console.log('🔥 Firebase initialized');
