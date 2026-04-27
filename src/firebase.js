// src/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore"

const firebaseConfig = {
  apiKey: "AIzaSyCNTy9U48QQuFghQ4EjgeE-vd-yoJltTFY",
  authDomain: "chat-room-67e8a.firebaseapp.com",
  projectId: "chat-room-67e8a",
  storageBucket: "chat-room-67e8a.firebasestorage.app",
  messagingSenderId: "762126359372",
  appId: "1:762126359372:web:d4d643104edbe9cad28de9",
  measurementId: "G-GTK8CXZ410"

};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const provider = new GoogleAuthProvider();
export const db = getFirestore(app);