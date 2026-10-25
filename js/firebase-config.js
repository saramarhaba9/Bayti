import { initializeApp, getAuth, getFirestore } from './firebase-sdk.js';

// Paste your web-app config from Firebase console → Project settings. These values are not secrets;
// access is enforced by Firestore rules and Auth, never by hiding this config.
export const firebaseConfig = {
  apiKey: "AIzaSyDLeewmoiU00AwfHEKhjrgRw_CsUKDLBhI",
  authDomain: "bit-9e821.firebaseapp.com",
  projectId: "bit-9e821",
  storageBucket: "bit-9e821.firebasestorage.app",
  messagingSenderId: "766139514586",
  appId: "1:766139514586:web:5a3aefefbaa238fcc52fe3"
};
export const isConfigured = !firebaseConfig.apiKey.startsWith('REPLACE');

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
