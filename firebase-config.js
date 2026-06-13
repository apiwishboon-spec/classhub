export const firebaseConfig = {
  apiKey: "AIzaSyDGN83Fo7YSQYt6FbG1mj-J_fFAbFQ2rwI",
  authDomain: "classhub-e1e8b.firebaseapp.com",
  projectId: "classhub-e1e8b",
  storageBucket: "classhub-e1e8b.firebasestorage.app",
  messagingSenderId: "967849169380",
  appId: "1:967849169380:web:347cd74ee21a2b4141b7f1",
  measurementId: "G-300HW5WQC6"
};

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const imgbbApiKey = "d851661ef4c88b4f97ee8b6857c184a7";
