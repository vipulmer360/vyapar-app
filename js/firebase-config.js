/* ==========================================
   VYAPAR PWA — FIREBASE CONFIGURATION
   ========================================== */

// ⚠️ IMPORTANT: Replace these values with YOUR Firebase project config!
// Go to https://console.firebase.google.com → Create Project → Web App → Copy Config
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyC7cQpvpYg3C0TmNPPdjmJ0U99tnUZo9nE",
  authDomain: "vyapar-app-95a80.firebaseapp.com",
  projectId: "vyapar-app-95a80",
  storageBucket: "vyapar-app-95a80.firebasestorage.app",
  messagingSenderId: "937253556831",
  appId: "1:937253556831:web:f7a4d95e7e4af937fa01ea",
  measurementId: "G-S1EL85F1W1"
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
