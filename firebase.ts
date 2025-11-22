import * as firebaseApp from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getAuth, Auth, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';

// TODO: Replace the following with your app's Firebase project configuration
// You can find this in the Firebase Console -> Project Settings -> General -> Your apps
const firebaseConfig = {
  apiKey: "AIzaSyC-XX-N5QYjqoonkME-kv9wlb-cW-RyKzE",
  authDomain: "fun-financial-growth.firebaseapp.com",
  projectId: "fun-financial-growth",
  storageBucket: "fun-financial-growth.firebasestorage.app",
  messagingSenderId: "137279147340",
  appId: "1:137279147340:web:3de3af65b7f6ced1f1d3e9",
  measurementId: "G-E1PSY3B66P"
};

let app;
let db: Firestore | null = null;
let auth: Auth | null = null;
let googleProvider: GoogleAuthProvider | null = null;

try {
  // Check if config is still using placeholders
  const isPlaceholder = firebaseConfig.apiKey === "YOUR_API_KEY";
  
  if (!isPlaceholder) {
    // Use type assertion to bypass potential type definition mismatches
    app = (firebaseApp as any).initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);
    googleProvider = new GoogleAuthProvider();
    console.log("Firebase initialized successfully");
  } else {
    console.warn("Firebase config is missing. Falling back to LocalStorage.");
  }
} catch (error) {
  console.error("Firebase initialization error:", error);
  // App will continue with db = null, triggering LocalStorage fallback in App.tsx
}

export { db, auth, googleProvider, signInWithPopup };