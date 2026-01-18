/**
 * src/state.js
 * The Single Source of Truth for the CRM.
 * Handles Local State, Activity Logs, and Firebase Firestore Sync.
 */
import { db, auth } from './firebase.js';
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// 1. INITIAL STATE STRUCTURE
let state = {
    deals: [],
    properties: [],
    investors: [],
    contacts: [],
    tasks: [],
    llcs: [],
    projects: [],   // Added for CapEx Module
    vault: [],      // Added for Document Vault
    activities: [],
    settings: {
        companyName: "Summit Capital",
        currency: "USD",
        theme: "light"
    }
};

let listeners = [];

export const stateManager = {
    /**
     * Bootstraps the app state from Firestore upon login.
     */
    async init() {
        const user = auth.currentUser;
        if (!user) return;

        try {
            const docRef = doc(db, "users", user.uid);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                // Merge cloud data with our local skeleton to prevent errors from missing keys
                const cloudData = docSnap.data();
                state = { ...state, ...cloudData };
                console.log("State synchronized with Cloud.");
            } else {
                console.log("No cloud profile found. Creating initial record...");
                await this.pushToCloud();
            }
            this.notify(state);
        } catch (error) {
            console.error("State Sync Error:", error);
        }
    },

    get() {
        return state;
    },

    /**
     * Adds a new item to a category (deals, properties, etc.)
     */
    async add(category, data) {
        const newItem = { 
            ...data, 
            id: `id_${Date.now()}`, 
            createdAt: new Date().toISOString() 
        };

        // Create an activity log entry
        const activity = {
            id: Date.now(),
            text: `Added ${data.name || 'New Item'} to ${category}`,
            at: new Date().toISOString(),
            type: 'add'
        };

        state[category] = [newItem, ...(state[category] || [])];
        state.activities = [activity, ...(state.activities || [])].slice(0, 20); // Keep last 20
        
        this.notify(state, category);
        await this.pushToCloud();
    },

    /**
     * Updates an existing item by ID
     */
    async update(category, id, updates) {
        state[category] = state[category].map(item => 
            item.id === id ? { ...item, ...updates, updatedAt: new Date().toISOString() } : item
        );
        
        this.notify(state, category);
        await this.pushToCloud();
    },

    /**
     * Specific handler for Global Application Settings
     */
    async updateSettings(updates) {
        state.settings = { ...state.settings, ...updates };
        this.notify(state, 'settings');
        await this.pushToCloud();
    },

    /**
     * Deletes an item from a category
     */
    async delete(category, id) {
        state[category] = state[category].filter(item => item.id !== id);
        
        this.notify(state, category);
        await this.pushToCloud();
    },

    /**
     * Persists the current state object to Firebase Firestore
     */
    async pushToCloud() {
        const user = auth.currentUser;
        if (!user) return;

        try {
            await setDoc(doc(db, "users", user.uid), state);
        } catch (error) {
            console.error("Cloud Push Failed:", error);
        }
    },

    /**
     * Observer Pattern: Allows modules to listen for state changes
     */
    subscribe(callback) {
        listeners.push(callback);
        // Immediate trigger so the module can render its initial view
        callback(state);
    },

    /**
     * Alerts all subscribers that data has changed
     */
    notify(newState, category = 'all') {
        listeners.forEach(callback => callback(newState, category));
    }
};