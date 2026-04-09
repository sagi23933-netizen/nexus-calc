import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  projectId: 'YOUR_PROJECT_ID',
  appId: 'YOUR_APP_ID',
  storageBucket: 'YOUR_PROJECT_ID.firebasestorage.app',
  apiKey: 'YOUR_API_KEY',
  authDomain: 'YOUR_PROJECT_ID.firebaseapp.com',
  messagingSenderId: 'YOUR_SENDER_ID',
};

const app = initializeApp(firebaseConfig);
export const firestore = getFirestore(app);
