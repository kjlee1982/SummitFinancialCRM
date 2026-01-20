/**
 * src/firebase.js
 * Centralized Firebase configuration and initialization.
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
console.log("Firebase projectId:", app.options.projectId);
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

// Your web app's Firebase configuration
// Replace these with your actual keys from the Firebase Console
const firebaseConfig = {
    apiKey: "AIzaSyBvIWKdRexJGVIp1wh22ncdJow2S0lgS7s",
    authDomain: "summit-financial-crm.firebaseapp.com",
    projectId: "summit-financial-crm",
    storageBucket: "summit-financial-crm.firebasestorage.app",
    messagingSenderId: "1093113945952",
    appId: "1:1093113945952:web:7536d5257913501a357591"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export instances to be used by other modules
export const auth = getAuth(app);
export const db = getFirestore(app, "summitcrm");
export const storage = getStorage(app);

/**
 * Helper to sync our local stateManager with Firestore
 */
export const syncStateToCloud = async (userId, state) => {
    // This function would be called by stateManager.saveAndNotify()
    // to push data to the 'users/userId/data' collection in Firestore
};
