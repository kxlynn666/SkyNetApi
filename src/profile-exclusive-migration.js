const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const C = require('./config');
const { CATALOG } = require('./profile-economy');

const STORE_FILE = path.join(C.DATA_DIR, 'profile-store.json');
const EXCLUSIVE_IDS = new Set(CATALOG.filter(item => item.grantOnly).map(item => item.id));

function migrateExclusiveProfileItems() {
    if (!fs.existsSync(STORE_FILE)) return { changedAccounts: 0, removedItems: 0, refundedCoins: 0 };
    let states;
    try {
        const parsed = JSON.parse(fs.readFileSync(STORE_FILE, 'utf8'));
        states = Array.isArray(parsed) ? parsed : [];
    } catch {
        return { changedAccounts: 0, removedItems: 0, refundedCoins: 0 };
    }

    let changedAccounts = 0;
    let removedItems = 0;
    let refundedCoins = 0;

    for (const state of states) {
        const items = Array.isArray(state.ownedItems) ? state.ownedItems : [];
        const removed = items.filter(entry =>
            EXCLUSIVE_IDS.has(String(entry?.itemId || '')) &&
            entry?.granted !== true &&
            entry?.source !== 'admin'
        );
        if (!removed.length) continue;

        const removedIds = new Set(removed.map(entry => String(entry.itemId || '')));
        state.ownedItems = items.filter(entry => !removed.includes(entry));

        const refund = removed.reduce((sum, entry) => sum + Math.max(0, Number(entry?.price || 0)), 0);
        state.spentCoins = Math.max(0, Number(state.spentCoins || 0) - refund);

        const equipped = state.equipped && typeof state.equipped === 'object' ? state.equipped : {};
        equipped.tagIds = (Array.isArray(equipped.tagIds) ? equipped.tagIds : []).filter(id => !removedIds.has(String(id)));
        if (removedIds.has(String(equipped.frameId || ''))) equipped.frameId = '';
        if (removedIds.has(String(equipped.decorationId || ''))) equipped.decorationId = '';
        state.equipped = equipped;
        state.updatedAt = new Date().toISOString();

        changedAccounts += 1;
        removedItems += removed.length;
        refundedCoins += refund;
    }

    if (changedAccounts) writeAtomic(states);
    return { changedAccounts, removedItems, refundedCoins };
}

function writeAtomic(value) {
    fs.mkdirSync(C.DATA_DIR, { recursive: true });
    const temp = `${STORE_FILE}.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`;
    fs.writeFileSync(temp, JSON.stringify(value, null, 2), { mode: 0o600 });
    fs.renameSync(temp, STORE_FILE);
}

module.exports = { migrateExclusiveProfileItems };
