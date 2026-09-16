import { firebaseConfig } from '../firebase-config.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js';
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, sendPasswordResetEmail, signOut
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js';
import {
  getFirestore, doc, getDoc, setDoc, updateDoc, collection, getDocs,
  addDoc, deleteDoc, serverTimestamp, runTransaction, query, where, arrayUnion
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';

const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);

export {
  auth, db,
  onAuthStateChanged, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, sendPasswordResetEmail, signOut,
  doc, getDoc, setDoc, updateDoc, collection, getDocs,
  addDoc, deleteDoc, serverTimestamp, runTransaction, query, where, arrayUnion
};
