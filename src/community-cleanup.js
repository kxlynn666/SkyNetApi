const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const C = require('./config');

const PROFILE_FILE = path.join(C.DATA_DIR, 'profile-custom.json');
const GROUPS_FILE = path.join(C.DATA_DIR, 'social-groups.json');
const GROUP_MESSAGES_FILE = path.join(C.DATA_DIR, 'social-group-messages.json');

function cleanupCommunityAccount(accountId) {
    if (!accountId) return;
    const profiles = readArray(PROFILE_FILE).filter(item => item.accountId !== accountId);
    writeArray(PROFILE_FILE, profiles);

    const originalGroups = readArray(GROUPS_FILE);
    const removedGroupIds = new Set();
    const groups = [];
    for (const group of originalGroups) {
        if (!Array.isArray(group.memberIds) || !group.memberIds.includes(accountId)) {
            groups.push(group);
            continue;
        }
        group.memberIds = group.memberIds.filter(id => id !== accountId);
        if (!group.memberIds.length) {
            removedGroupIds.add(group.id);
            continue;
        }
        if (group.ownerId === accountId) group.ownerId = group.memberIds[0];
        group.updatedAt = new Date().toISOString();
        groups.push(group);
    }
    writeArray(GROUPS_FILE, groups);

    const messages = readArray(GROUP_MESSAGES_FILE).filter(item => item.fromId !== accountId && !removedGroupIds.has(item.groupId));
    writeArray(GROUP_MESSAGES_FILE, messages);
}

function readArray(file) {
    try {
        const data = JSON.parse(fs.readFileSync(file, 'utf8'));
        return Array.isArray(data) ? data : [];
    } catch {
        return [];
    }
}

function writeArray(file, data) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const temp = `${file}.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`;
    fs.writeFileSync(temp, JSON.stringify(data, null, 2), { mode: 0o600 });
    fs.renameSync(temp, file);
}

module.exports = { cleanupCommunityAccount };
