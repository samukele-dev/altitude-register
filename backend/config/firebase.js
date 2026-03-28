const admin = require('firebase-admin');

let db = null;
let auth = null;
let storage = null;

const initializeFirebase = () => {
  try {
    if (!admin.apps.length) {
      let serviceAccount;
      try {
        serviceAccount = require('../serviceAccountKey.json');
        console.log('✅ Service account file loaded');
      } catch (e) {
        console.log('⚠️ Service account file not found');
        serviceAccount = {
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        };
      }

      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
        projectId: process.env.FIREBASE_PROJECT_ID
      });
      console.log('✅ Firebase Admin initialized');
    }

    db = admin.firestore();
    auth = admin.auth();
    storage = admin.storage();

    console.log('✅ Firestore database ready');
    
    return { db, auth, storage, admin };
  } catch (error) {
    console.error('❌ Firebase initialization failed:', error.message);
    return { db: null, auth: null, storage: null, admin: null };
  }
};

const { db: firestoreDb, auth: firebaseAuth, storage: firebaseStorage, admin: firebaseAdmin } = initializeFirebase();

module.exports = { 
  admin: firebaseAdmin, 
  db: firestoreDb, 
  auth: firebaseAuth, 
  storage: firebaseStorage 
};