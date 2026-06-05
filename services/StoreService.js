const fs = require('fs');
const path = require('path');

class StoreService {
  constructor(filePath) {
    this.filePath = filePath || path.join(process.cwd(), 'baileys_store.json');
    this.data = {
      contacts: {},
      chats: {},
      messages: {}
    };
    this.isDirty = false;
    this.sock = null;
    this.load();
    this.startAutoSave();
  }

  load() {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        const parsed = JSON.parse(raw);
        this.data.contacts = parsed.contacts || {};
        this.data.chats = parsed.chats || {};
        this.data.messages = parsed.messages || {};
        console.log('[STORE] Loaded', Object.keys(this.data.contacts).length, 'contacts');
      }
    } catch (error) {
      console.error('[STORE] Failed to load store:', error.message);
      this.data = {
        contacts: {},
        chats: {},
        messages: {}
      };
    }
  }

  async save() {
    if (!this.isDirty) {
      return;
    }

    try {
      await fs.promises.writeFile(
        this.filePath,
        JSON.stringify(this.data, null, 2)
      );
      this.isDirty = false;
    } catch (error) {
      console.error('[STORE] Failed to save store:', error.message);
    }
  }

  startAutoSave(intervalMs = 10000) {
    setInterval(() => this.save(), intervalMs).unref?.();
  }

  attachSocket(sock) {
    this.sock = sock;

    if (sock) {
      const resolver = async (jid, opts = {}) => this.resolveName(jid, opts);
      sock.getDisplayName = resolver;
      sock.getName = resolver;
    }
  }

  async registerSelf(sock) {
    if (!sock?.user?.id) {
      return;
    }

    const userId = `${sock.user.id.split(':')[0]}@s.whatsapp.net`;
    const selfName = sock.user.name || sock.user.verifiedName || 'Me';
    if (this.#upsertContact(userId, selfName)) {
      console.log('[STORE] Saved self contact:', userId, '→', selfName);
    }
  }

  async captureContact(jid, name = '', options = {}) {
    if (!jid) {
      return;
    }

    const trimmedName = this.#sanitizeName(name);
    let updated = trimmedName ? this.#upsertContact(jid, trimmedName) : false;

    if (updated) {
      console.log('[STORE] Updated contact:', jid, '→', trimmedName);
    }

    if (!trimmedName && this.sock?.onWhatsApp) {
      try {
        const lookups = await this.sock.onWhatsApp(jid);
        const first = Array.isArray(lookups) ? lookups[0] : undefined;
        const resolvedName = this.#sanitizeName(first?.notify || first?.verifiedName);
        if (resolvedName) {
          const primaryUpdated = this.#upsertContact(jid, resolvedName);
          const canonicalUpdated = first?.jid ? this.#upsertContact(first.jid, resolvedName) : false;
          if (primaryUpdated || canonicalUpdated) {
            console.log('[STORE] Resolved contact name via lookup:', first?.jid || jid, '→', resolvedName);
          }
          updated = updated || primaryUpdated || canonicalUpdated;
        }
      } catch (error) {
        console.warn('[STORE] Lookup failed for', jid, '-', error.message);
      }
    }

    if (jid.includes('@lid') && this.sock?.onWhatsApp) {
      try {
        const results = await this.sock.onWhatsApp(jid);
        if (Array.isArray(results)) {
          for (const entry of results) {
            if (!entry?.jid) continue;
            const aliasName = trimmedName || entry.notify || entry.verifiedName;
            if (this.#upsertContact(entry.jid, aliasName)) {
              console.log('[STORE] Aliased contact:', entry.jid, '→', aliasName || '-');
            }
          }
        }
      } catch (error) {
        console.warn('[STORE] Failed to resolve canonical JID for', jid, '-', error.message);
      }
    }

    if (options.additionalJids?.length) {
      for (const altJid of options.additionalJids) {
        if (this.#upsertContact(altJid, trimmedName)) {
          console.log('[STORE] Synced contact alias:', altJid, '→', trimmedName);
        }
      }
    }
  }

  getContact(jid) {
    return this.data.contacts[jid];
  }

  getContactName(jid) {
    return this.data.contacts[jid]?.name;
  }

  captureMessage(rawMessage) {
    if (!rawMessage?.key?.remoteJid || !rawMessage?.key?.id || !rawMessage.message) {
      return;
    }

    const remoteJid = rawMessage.key.remoteJid;
    if (!this.data.messages[remoteJid]) {
      this.data.messages[remoteJid] = [];
    }

    const bucket = this.data.messages[remoteJid];
    const payload = {
      id: rawMessage.key.id,
      participant: rawMessage.key.participant,
      message: rawMessage.message,
      timestamp: rawMessage.messageTimestamp
    };

    const existingIndex = bucket.findIndex((entry) => entry.id === payload.id);
    if (existingIndex >= 0) {
      bucket[existingIndex] = payload;
    } else {
      bucket.push(payload);
      if (bucket.length > 100) {
        bucket.shift();
      }
    }

    this.isDirty = true;
  }

  findMessage(remoteJid, id) {
    if (!remoteJid || !id) {
      return undefined;
    }

    const bucket = this.data.messages[remoteJid];
    if (!Array.isArray(bucket) || !bucket.length) {
      return undefined;
    }

    return bucket.find((entry) => entry.id === id);
  }

  async captureGroup(jid, subject = '') {
    if (!jid?.endsWith('@g.us')) {
      return;
    }

    const name = this.#sanitizeName(subject);
    if (!name) {
      return;
    }

    if (this.#upsertContact(jid, name)) {
      console.log('[STORE] Updated group subject:', jid, '→', name);
    }
  }

  getContactNameByNumber(number) {
    const cleaned = this.#extractNumber(number);
    if (!cleaned) {
      return undefined;
    }

    for (const contact of Object.values(this.data.contacts)) {
      const contactNumber = this.#extractNumber(contact.id);
      if (contactNumber === cleaned && contact.name) {
        return contact.name;
      }
    }
    return undefined;
  }

  async resolveName(jid, options = {}) {
    if (!jid) {
      return 'Unknown';
    }

    const direct = this.getContactName(jid);
    if (direct) {
      return direct;
    }

    const numberAlias = this.getContactNameByNumber(jid);
    if (numberAlias) {
      return numberAlias;
    }

    if (options.pushName) {
      return options.pushName;
    }

    if (options.remoteJid && options.remoteJid.endsWith('@g.us') && this.sock?.groupMetadata) {
      try {
        const meta = await this.sock.groupMetadata(options.remoteJid);
        const participants = meta?.participants || [];
        const targetNumber = this.#extractNumber(jid);

        const participant = participants.find((entry) => {
          if (!entry?.id) {
            return false;
          }
          if (entry.id === jid) {
            return true;
          }
          return this.#extractNumber(entry.id) === targetNumber;
        });

        if (participant) {
          const candidateName = this.#sanitizeName(
            participant.name || participant.notify || participant.verifiedName || participant?.id?.split('@')[0]
          );

          if (candidateName) {
            await this.captureContact(jid, candidateName).catch(() => {});
            return candidateName;
          }
        }
      } catch (error) {
        console.warn('[STORE] Failed to read group metadata for name resolution:', error.message);
      }
    }

    if (this.sock) {
      if (jid.endsWith('@g.us')) {
        try {
          const meta = await this.sock.groupMetadata(jid);
            if (meta?.subject) {
              await this.captureGroup(jid, meta.subject);
            return meta.subject;
          }
        } catch (error) {
          // ignore
        }
      } else if (this.sock.onWhatsApp) {
        try {
          const result = await this.sock.onWhatsApp(jid);
          const contact = Array.isArray(result) ? result[0] : undefined;
          if (contact?.notify) {
            return contact.notify;
          }
          if (contact?.verifiedName) {
            return contact.verifiedName;
          }
        } catch (error) {
          // ignore
        }
      }
    }

    const number = this.#extractNumber(jid);
    return number ? `+${number}` : jid;
  }

  #upsertContact(jid, name) {
    if (!jid) {
      return false;
    }

    const trimmed = this.#sanitizeName(name);
    if (!trimmed) {
      return false;
    }

    const current = this.data.contacts[jid];
    if (current && current.name === trimmed) {
      return false;
    }

    this.data.contacts[jid] = { id: jid, name: trimmed };
    this.isDirty = true;
    return true;
  }

  #sanitizeName(name) {
    if (typeof name !== 'string') {
      return '';
    }
    return name.trim();
  }

  #extractNumber(value) {
    if (!value) {
      return '';
    }
    const raw = value.includes('@') ? value.split('@')[0] : value;
    return raw.replace(/[^0-9]/g, '');
  }
}

module.exports = StoreService;
