const fs = require('fs');
const path = require('path');

class StoreService {
  constructor(filePath) {
    this.filePath = filePath || path.join(process.cwd(), 'baileys_store.json');
    this.store = { contacts: {} };
    this.isDirty = false;
    this.load();
    this.startAutoSave();
  }

  load() {
    try {
      if (fs.existsSync(this.filePath)) {
        const data = fs.readFileSync(this.filePath, 'utf-8');
        this.store = JSON.parse(data);
        // Ensure structure
        if (!this.store.contacts) this.store.contacts = {};
        console.log('[STORE] Loaded', Object.keys(this.store.contacts).length, 'contacts');
      }
    } catch (error) {
      console.error('[STORE] Failed to load store:', error.message);
      // Initialize empty if failed
      this.store = { contacts: {} };
    }
  }

  async save() {
    if (!this.isDirty) return;
    
    try {
      // Write to temp file first then rename (atomic write usually, but simple write is better than sync)
      // Using simple async write for now as a huge improvement over synchronous write
      await fs.promises.writeFile(
        this.filePath, 
        JSON.stringify(this.store, null, 2)
      );
      this.isDirty = false;
    } catch (error) {
      console.error('[STORE] Failed to save store:', error.message);
    }
  }

  startAutoSave(intervalMs = 10000) {
    setInterval(() => this.save(), intervalMs);
  }

  addContact(id, name) {
    if (!id || !name) return false;
    
    // Check if contact doesn't exist or name is different
    if (!this.store.contacts[id] || this.store.contacts[id].name !== name) {
      this.store.contacts[id] = { id, name };
      this.isDirty = true;
      console.log('[STORE] Updated contact:', id, '→', name);
      return true;
    }
    return false;
  }

  getContact(id) {
    return this.store.contacts[id];
  }

  getContactName(id) {
    return this.store.contacts[id]?.name;
  }
}

module.exports = StoreService;
