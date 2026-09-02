'use strict';

const admin = require('firebase-admin');
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');

/**
 * Initialise proprement et de façon unique l'application Firebase Admin
 */
const initFirebase = () => {
  const apps = getApps();
  if (apps.length > 0) return apps[0];

  try {
    if (process.env.FIREBASE_PROJECT_ID) {
      process.env.GOOGLE_CLOUD_PROJECT = process.env.FIREBASE_PROJECT_ID;
    }

    let privateKey = process.env.FIREBASE_PRIVATE_KEY;
    if (!privateKey) throw new Error('FIREBASE_PRIVATE_KEY manquante');

    privateKey = privateKey.trim();
    if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
      privateKey = privateKey.slice(1, -1);
    }
    privateKey = privateKey.replace(/\\n/g, '\n');

    return initializeApp({
      credential: cert({
        projectId:   process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey,
      }),
      projectId: process.env.FIREBASE_PROJECT_ID,
    });
  } catch (err) {
    if (err.code === 'app/duplicate-app' || err.message.includes('already exists')) {
      return getApps()[0];
    }
    console.error('[FIREBASE] Échec initialisation:', err);
    throw err;
  }
};

/**
 * Vérifie un ID Token Firebase (connexion Google/Apple/Phone côté client)
 */
const verifyFirebaseToken = async (idToken) => {
  if (!idToken) return { valid: false, phone: null, uid: null };

  try {
    const app  = initFirebase();
    const auth = getAuth(app);
    const decoded = await auth.verifyIdToken(idToken);
    return {
      valid: true,
      phone: decoded.phone_number || null,
      uid:   decoded.uid,
      email: decoded.email  || null,
      name:  decoded.name   || null,
    };
  } catch (err) {
    console.error('[FIREBASE] Vérification token échouée:', err.message);
    return { valid: false, phone: null, uid: null };
  }
};

module.exports = { initFirebase, verifyFirebaseToken };
