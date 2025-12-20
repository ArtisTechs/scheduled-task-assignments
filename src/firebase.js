import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyB37JS8JAr4uYb5kMBEt_NdFFQSpDqbvb8",
  authDomain: "congregation-scheduler-backend.firebaseapp.com",
  projectId: "congregation-scheduler-backend",
  storageBucket: "congregation-scheduler-backend.firebasestorage.app",
  messagingSenderId: "1068302502654",
  appId: "1:1068302502654:web:cdfe63cc585dd87a73b3af",
  measurementId: "G-7Z03R54HCF",
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);
