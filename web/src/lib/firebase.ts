// Firebase Auth uniquement — même architecture que KasoPlex
// Pas de FCM : les notifications push utilisent Expo Push
import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  type Auth,
} from 'firebase/auth';

const firebaseConfig = {
  apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

let _app: FirebaseApp | null = null;
let _auth: Auth | null = null;

const getFirebaseApp = (): FirebaseApp | null => {
  if (!firebaseConfig.apiKey) return null;
  if (_app) return _app;
  _app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  return _app;
};

export const getFirebaseAuth = (): Auth | null => {
  const app = getFirebaseApp();
  if (!app) return null;
  if (!_auth) _auth = getAuth(app);
  return _auth;
};

export const signInWithGoogle = async (): Promise<{ idToken: string } | null> => {
  const auth = getFirebaseAuth();
  if (!auth) return null;

  const provider = new GoogleAuthProvider();
  provider.addScope('email');
  provider.addScope('profile');

  try {
    const result = await signInWithPopup(auth, provider);
    const idToken = await result.user.getIdToken();
    return { idToken };
  } catch (err: any) {
    if (err?.code === 'auth/popup-blocked') {
      await signInWithRedirect(auth, provider);
    }
    return null;
  }
};

export const getGoogleRedirectResult = async (): Promise<{ idToken: string } | null> => {
  const auth = getFirebaseAuth();
  if (!auth) return null;
  try {
    const result = await getRedirectResult(auth);
    if (!result) return null;
    const idToken = await result.user.getIdToken();
    return { idToken };
  } catch {
    return null;
  }
};
