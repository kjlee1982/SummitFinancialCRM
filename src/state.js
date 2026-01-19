/**
 * src/state.js
 * The Single Source of Truth for the CRM.
 * Handles Local State, Activity Logs, and Firebase Firestore Sync.
 */
import { db, auth } from './firebase.js';
import {
  doc,
  getDoc,
  setDoc,
  runTransaction
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ------------------------
// 1) CLIENT INSTANCE ID
// ------------------------
// Persisted per browser/device so we can detect "another device wrote newer data".
const CLIENT_ID_KEY = 'summitcrm_clientInstanceId';

function makeId(prefix = 'id') {
  try {
    if (crypto?.randomUUID) return `${prefix}_${crypto.randomUUID()}`;
  } catch (_) {}
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function getClientInstanceId() {
  try {
    const existing = localStorage.getItem(CLIENT_ID_KEY);
    if (existing) return existing;
    const created = makeId('client');
    localStorage.setItem(CLIENT_ID_KEY, created);
    return created;
  } catch (e) {
    // If localStorage blocked, fall back to a session-only id
    return makeId('client');
  }
}

const clientInstanceId = getClientInstanceId();

// ------------------------
// 2) INITIAL STATE
// ------------------------
let state = {
  deals: [],
  properties: [],
  investors: [],
  contacts: [],
  tasks: [],
  llcs: [],
  projects: [],
  vault: [],
  activities: [],
  settings: {
    companyName: "Summit Capital",
    currency: "USD",
    theme: "light"
  },

  // Meta is used only for sync + conflict protection
  _meta: {
    clientInstanceId,   // the id of *this* device/browser
    lastUpdatedAt: null,
    lastUpdatedBy: null
  }
};

let listeners = [];

// Debounced cloud writes to reduce thrash + conflicts
let pushTimer = null;
const PUSH_DEBOUNCE_MS = 800;

// Prevent writes before we've hydrated from cloud at least once
let hydrated = false;

// Track what cloud version we last pulled.
// Used to detect "cloud newer than my local copy".
let lastPulledCloudUpdatedAt = null;

// ------------------------
// 3) ACTIVITY LOGGING
// ------------------------
function addActivity({ text, type = 'info', entity = null, entityId = null }) {
  const activity = {
    id: makeId('act'),
    text,
    at: new Date().toISOString(),
    type,
    entity,
    entityId
  };

  state.activities = [activity, ...(state.activities || [])].slice(0, 50);
}

// ------------------------
// 4) CONFLICT-SAFE PUSH
// ------------------------
async function pushToCloudTransactionSafe() {
  const user = auth.currentUser;
  if (!user) return;
  if (!hydrated) return;

  const userDocRef = doc(db, "users", user.uid);

  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(userDocRef);

      if (snap.exists()) {
        const cloudData = snap.data() || {};
        const cloudMeta = cloudData._meta || {};
        const cloudUpdatedAt = cloudMeta.lastUpdatedAt || null;
        const cloudUpdatedBy = cloudMeta.lastUpdatedBy || null;

        // If cloud is newer than what we last pulled AND it was written by another client,
        // block this write to avoid overwriting newer cloud data.
        if (
          cloudUpdatedAt &&
          lastPulledCloudUpdatedAt &&
          cloudUpdatedAt > lastPulledCloudUpdatedAt &&
          cloudUpdatedBy &&
          cloudUpdatedBy !== clientInstanceId
        ) {
          throw new Error(
            `CONFLICT_BLOCKED: Cloud has newer data (updatedAt=${cloudUpdatedAt}, updatedBy=${cloudUpdatedBy}). ` +
            `This client (${clientInstanceId}) last pulled ${lastPulledCloudUpdatedAt}.`
          );
        }
      }

      // Stamp meta for this write
      const nowIso = new Date().toISOString();
      state._meta = {
        ...state._meta,
        clientInstanceId,
        lastUpdatedAt: nowIso,
        lastUpdatedBy: clientInstanceId
      };

      // Overwrite the doc with our state (transaction guarantees the conflict check above)
      tx.set(userDocRef, state);
    });

    // If the write succeeded, our local becomes the newest cloud baseline
    lastPulledCloudUpdatedAt = state._meta.lastUpdatedAt;
  } catch (error) {
    // Conflict block is expected sometimes — do not crash app
    if (String(error?.message || '').startsWith('CONFLICT_BLOCKED')) {
      console.warn(
        '[State] Push blocked to prevent overwriting newer cloud data.',
        error.message
      );
      return;
    }
    console.error("Cloud Push Failed:", error);
  }
}

async function pushToCloudDebounced() {
  if (!hydrated) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(async () => {
    await pushToCloudTransactionSafe();
  }, PUSH_DEBOUNCE_MS);
}

// ------------------------
// 5) STATE MANAGER API
// ------------------------
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
        const cloudData = docSnap.data() || {};
        const cloudMeta = cloudData._meta || {};

        // Remember what cloud version we pulled so we can detect newer writes later
        lastPulledCloudUpdatedAt = cloudMeta.lastUpdatedAt || null;

        // Merge cloud data with our local skeleton to prevent errors from missing keys
        // Deep-merge settings so defaults aren't lost
        state = {
          ...state,
          ...cloudData,
          settings: { ...state.settings, ...(cloudData.settings || {}) },
          _meta: {
            ...state._meta,
            ...(cloudData._meta || {}),
            clientInstanceId // always keep local client id
          }
        };

        // Hard guard: ensure arrays are arrays
        state.deals = Array.isArray(state.deals) ? state.deals : [];
        state.properties = Array.isArray(state.properties) ? state.properties : [];
        state.investors = Array.isArray(state.investors) ? state.investors : [];
        state.contacts = Array.isArray(state.contacts) ? state.contacts : [];
        state.tasks = Array.isArray(state.tasks) ? state.tasks : [];
        state.llcs = Array.isArray(state.llcs) ? state.llcs : [];
        state.projects = Array.isArray(state.projects) ? state.projects : [];
        state.vault = Array.isArray(state.vault) ? state.vault : [];
        state.activities = Array.isArray(state.activities) ? state.activities : [];

        console.log("State synchronized with Cloud.");
      } else {
        console.log("No cloud profile found. Creating initial record...");

        // Mark hydrated first so the initial push is allowed
        hydrated = true;

        // Stamp meta for first write
        const nowIso = new Date().toISOString();
        state._meta = {
          ...state._meta,
          clientInstanceId,
          lastUpdatedAt: nowIso,
          lastUpdatedBy: clientInstanceId
        };

        await setDoc(docRef, state);
        lastPulledCloudUpdatedAt = state._meta.lastUpdatedAt;
      }

      hydrated = true;
      this.notify(state, 'all');
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
      id: makeId(category),
      createdAt: new Date().toISOString()
    };

    state[category] = [newItem, ...(state[category] || [])];

    addActivity({
      text: `Added ${data?.name || 'New Item'} to ${category}`,
      type: 'add',
      entity: category,
      entityId: newItem.id
    });

    this.notify(state, category);
    await pushToCloudDebounced();
  },

  /**
   * Updates an existing item by ID
   */
  async update(category, id, updates) {
    const list = Array.isArray(state[category]) ? state[category] : [];
    const before = list.find(item => item.id === id);

    state[category] = list.map(item =>
      item.id === id
        ? { ...item, ...updates, updatedAt: new Date().toISOString() }
        : item
    );

    if (before) {
      addActivity({
        text: `Updated ${before?.name || 'Item'} in ${category}`,
        type: 'update',
        entity: category,
        entityId: id
      });
    }

    this.notify(state, category);
    await pushToCloudDebounced();
  },

  /**
   * Specific handler for Global Application Settings
   */
  async updateSettings(updates) {
    state.settings = { ...state.settings, ...updates };

    addActivity({
      text: `Updated settings`,
      type: 'update',
      entity: 'settings',
      entityId: null
    });

    this.notify(state, 'settings');
    await pushToCloudDebounced();
  },

  /**
   * Deletes an item from a category
   */
  async delete(category, id) {
    const list = Array.isArray(state[category]) ? state[category] : [];
    const before = list.find(item => item.id === id);

    state[category] = list.filter(item => item.id !== id);

    addActivity({
      text: `Deleted ${before?.name || 'Item'} from ${category}`,
      type: 'delete',
      entity: category,
      entityId: id
    });

    this.notify(state, category);
    await pushToCloudDebounced();
  },

  /**
   * Observer Pattern: Allows modules to listen for state changes
   */
  subscribe(callback) {
    listeners.push(callback);
    // Immediate trigger so the module can render its initial view
    callback(state, 'all');
  },

  /**
   * Alerts all subscribers that data has changed
   */
  notify(newState, category = 'all') {
    listeners.forEach(callback => callback(newState, category));
  }
};
