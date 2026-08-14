// ================= FIREBASE CONFIG =================
// Your project's real config (from Firebase Console → Project Settings → Your apps)
const firebaseConfig = {
  apiKey: "AIzaSyAnRBYNUC1Z7CeuYbV7zyMDsVOme0LCPqk",
  authDomain: "chaya-co.firebaseapp.com",
  projectId: "chaya-co",
  storageBucket: "chaya-co.firebasestorage.app",
  messagingSenderId: "378388457746",
  appId: "1:378388457746:web:520850fb34170eba0eebcb",
};

// Initialise Firebase (compat SDK — works with plain <script> tags, no build tools needed)
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();
const storage = firebase.storage();

// ================= DEMO MODE =================
// While firebaseConfig above still says "PASTE_YOUR..." the site can't reach Firebase.
// DEMO_MODE lets the customer site keep working (using the local MENU_FALLBACK list in
// script.js) so you can test everything before your Firebase project is wired up.
const DEMO_MODE = firebaseConfig.apiKey.startsWith("PASTE_");