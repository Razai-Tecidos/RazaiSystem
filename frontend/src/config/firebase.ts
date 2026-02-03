// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyD7TwdYRjoFB7S9B-1nI-sBQLIiKj94kHw",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "razaisystem.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "razaisystem",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "razaisystem.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "696290533431",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:696290533431:web:95c194457310d78e375fb2",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-ZC2SM2PLH5"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const analytics = typeof window !== 'undefined' ? getAnalytics(app) : null;
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export default app;
