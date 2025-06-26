
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyCOwUdfkNrMyxpqGUV4EHT0Df2fOQpyisc",
  authDomain: "imagemagic-a1812.firebaseapp.com",
  projectId: "imagemagic-a1812",
  storageBucket: "imagemagic-a1812.firebasestorage.app",
  messagingSenderId: "233830878713",
  appId: "1:233830878713:web:a51638732eba7eb1364128",
  measurementId: "G-C3GWGRQZ6W"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);

export default app;
