const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const C = require('./config');
const S = require('./store');

const FRIENDS_FILE = path.join(C.DATA_DIR, 'social-friends.json');
const BLOCKS_FILE = path.join(C.DATA_DIR, 'social-blocks.json');
const GROUPS_FILE = path.join(C.DATA_DIR, 'social-groups.json');
const MAX_GROUP_CALL = 6;
const CALL_TIMEOUT_MS = 45_000;
const dmCalls = new Map();
const dmByUser = new Map();
const groupCalls = new Map();

function readArray(file) {
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function clean(value, max = 100) {
  return String(value || '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, max);
}

function userRoom(id) { return `user:${id}`; }
function groupRoom(id) { return `group:${id}`; }
function groupCallRoom(id) { return `rt:group-call:${id}`; }
function callId() { return crypto.randomBytes(18).toString('base64url'); }

function accountById(id) {
  return S.loadAccounts().find(account => account.id === id && account.active) || null;
}

function publicUser(account) {
  if (!account) return null;
  const profile = account.profile && typeof account.profile === 'object' ? account.profile : {};
  return {
    id: account.id,
    username: account.username,
    displayName: clean(profile.displayName, 50) || account.username,
    avatarUrl: null
  };
}

function isBlocked(a, b) {
  return readArray(BLOCKS_FILE).some(item =>
    (item.blockerId === a && item.blockedId === b) ||
    (item.blockerId === b && item.blockedId === a)
  );
}

function areFriends(a, b) {
  if (!a || !b || a === b || isBlocked(a, b)) return false;
  return readArray(FRIENDS_FILE).some(item => item.status === 'accepted' && (
    (item.senderId === a && item.receiverId === b) ||
    (item.senderId === b && item.receiverId === a)
  ));
}

function allowsCalls(account) {
  const privacy = account?.profile?.privacy;
  return privacy?.allowCallsFromFriends !== false;
}

function groupById(id) {
  return readArray(GROUPS_FILE).find(group => group.id === id) || null;
}

function isGroupMember(groupId, userId) {
  const group = groupById(groupId);
  return Boolean(group && Array.isArray(group.memberIds) && group.memberIds.includes(userId));
}

function roomHasSockets(io, room) {
  return Number(io.sockets.adapter.rooms.get(room)?.size || 0) > 0;
}

function emitDmEnd(io, call, reason = 'Chamada encerrada.') {
  if (!call || call.ended) return;
  call.ended = true;
  clearTimeout(call.timer);
  dmCalls.delete(call.id);
  if (dmByUser.get(call.a) === call.id) dmByUser.delete(call.a);
  if (dmByUser.get(call.b) === call.id) dmByUser.delete(call.b);
  io.to(userRoom(call.a)).emit('rt:dm:ended', { callId: call.id, reason });
  io.to(userRoom(call.b)).emit('rt:dm:ended', { callId: call.id, reason });
}

function participantSide(call, userId) {
  if (call.a === userId) return 'a';
  if (call.b === userId) return 'b';
  return null;
}

function otherUser(call, userId) {
  if (call.a === userId) return call.b;
  if (call.b === userId) return call.a;
  return null;
}

function signalBudget(socket) {
  const now = Date.now();
  let bucket = socket.data.rtSignalBucket;
  if (!bucket || bucket.resetAt <= now) bucket = { count: 0, resetAt: now + 60_000 };
  bucket.count += 1;
  socket.data.rtSignalBucket = bucket;
  return bucket.count <= 360;
}

function leaveGroupCall(io, socket, groupId, userId, reason = '') {
  const members = groupCalls.get(groupId);
  if (!members) return;
  const entry = members.get(userId);
  if (!entry || (socket && entry.socketId !== socket.id)) return;
  members.delete(userId);
  if (socket) socket.leave(groupCallRoom(groupId));
  if (!members.size) groupCalls.delete(groupId);
  io.to(groupCallRoom(groupId)).emit('rt:group:peer-left', { groupId, userId, reason });
  io.to(groupRoom(groupId)).emit('rt:group:state', { groupId, participantIds: [...members.keys()] });
}

function attachRealtimeV3(io) {
  io.on('connection', socket => {
    const account = socket.account;
    if (!account) return;
    const userId = account.id;

    socket.on('rt:dm:invite', payload => {
      const to = clean(payload?.to, 80);
      const mode = payload?.mode === 'video' ? 'video' : 'audio';
      if (!to || !areFriends(userId, to)) return socket.emit('rt:dm:error', { error: 'A chamada está disponível somente entre amigos.' });
      const target = accountById(to);
      if (!target || !allowsCalls(target)) return socket.emit('rt:dm:error', { error: 'Este usuário não está aceitando chamadas.' });
      if (!roomHasSockets(io, userRoom(to))) return socket.emit('rt:dm:error', { error: 'Este usuário está offline.' });
      if (dmByUser.has(userId) || dmByUser.has(to)) return socket.emit('rt:dm:error', { error: 'Uma das contas já está em outra chamada.' });

      const id = callId();
      const call = {
        id,
        a: userId,
        b: to,
        aSocket: socket.id,
        bSocket: null,
        mode,
        state: 'ringing',
        createdAt: Date.now(),
        ended: false,
        timer: null
      };
      call.timer = setTimeout(() => emitDmEnd(io, call, 'Chamada não atendida.'), CALL_TIMEOUT_MS);
      call.timer.unref?.();
      dmCalls.set(id, call);
      dmByUser.set(userId, id);
      dmByUser.set(to, id);
      io.to(userRoom(to)).emit('rt:dm:incoming', { callId: id, from: publicUser(account), mode });
      socket.emit('rt:dm:ringing', { callId: id, to, mode });
    });

    socket.on('rt:dm:accept', payload => {
      const id = clean(payload?.callId, 80);
      const call = dmCalls.get(id);
      if (!call || call.ended || call.b !== userId || call.state !== 'ringing') return;
      call.state = 'active';
      call.bSocket = socket.id;
      clearTimeout(call.timer);
      io.to(userRoom(call.a)).emit('rt:dm:accepted', { callId: id, by: userId, mode: call.mode });
      socket.emit('rt:dm:accepted-local', { callId: id, with: call.a, mode: call.mode });
    });

    socket.on('rt:dm:reject', payload => {
      const id = clean(payload?.callId, 80);
      const call = dmCalls.get(id);
      if (!call || call.ended || participantSide(call, userId) == null) return;
      emitDmEnd(io, call, userId === call.b ? 'Chamada recusada.' : 'Chamada cancelada.');
    });

    socket.on('rt:dm:end', payload => {
      const id = clean(payload?.callId, 80) || dmByUser.get(userId);
      const call = dmCalls.get(id);
      if (!call || participantSide(call, userId) == null) return;
      emitDmEnd(io, call, clean(payload?.reason, 100) || 'Chamada encerrada.');
    });

    socket.on('rt:dm:signal', payload => {
      if (!signalBudget(socket)) return;
      const id = clean(payload?.callId, 80);
      const type = clean(payload?.type, 16);
      const call = dmCalls.get(id);
      if (!call || call.ended || call.state !== 'active' || !['offer', 'answer', 'ice'].includes(type)) return;
      const side = participantSide(call, userId);
      if (!side) return;
      const expectedSocket = side === 'a' ? call.aSocket : call.bSocket;
      if (expectedSocket && expectedSocket !== socket.id) return;
      const targetSocket = side === 'a' ? call.bSocket : call.aSocket;
      if (!targetSocket) return;
      io.to(targetSocket).emit('rt:dm:signal', { callId: id, from: userId, type, data: payload?.data || null });
    });

    socket.on('rt:group:join', payload => {
      const groupId = clean(payload?.groupId, 80);
      if (!groupId || !isGroupMember(groupId, userId)) return socket.emit('rt:group:error', { groupId, error: 'Você não participa desse grupo.' });
      let members = groupCalls.get(groupId);
      if (!members) { members = new Map(); groupCalls.set(groupId, members); }
      const existing = members.get(userId);
      if (existing && existing.socketId !== socket.id && io.sockets.sockets.has(existing.socketId)) {
        return socket.emit('rt:group:error', { groupId, error: 'Sua conta já está nessa chamada em outra aba/dispositivo.' });
      }
      if (!existing && members.size >= MAX_GROUP_CALL) return socket.emit('rt:group:error', { groupId, error: `A chamada suporta até ${MAX_GROUP_CALL} participantes.` });

      const participants = [...members.entries()]
        .filter(([id]) => id !== userId)
        .map(([id]) => publicUser(accountById(id)))
        .filter(Boolean);
      members.set(userId, { socketId: socket.id, joinedAt: Date.now() });
      socket.join(groupCallRoom(groupId));
      socket.emit('rt:group:participants', { groupId, participants });
      socket.to(groupCallRoom(groupId)).emit('rt:group:peer-joined', { groupId, user: publicUser(account) });
      io.to(groupRoom(groupId)).emit('rt:group:state', { groupId, participantIds: [...members.keys()] });
    });

    socket.on('rt:group:leave', payload => {
      const groupId = clean(payload?.groupId, 80);
      if (groupId) leaveGroupCall(io, socket, groupId, userId);
    });

    socket.on('rt:group:signal', payload => {
      if (!signalBudget(socket)) return;
      const groupId = clean(payload?.groupId, 80);
      const to = clean(payload?.to, 80);
      const type = clean(payload?.type, 16);
      if (!groupId || !to || !['offer', 'answer', 'ice'].includes(type)) return;
      const members = groupCalls.get(groupId);
      const fromEntry = members?.get(userId);
      const toEntry = members?.get(to);
      if (!fromEntry || fromEntry.socketId !== socket.id || !toEntry || !isGroupMember(groupId, userId) || !isGroupMember(groupId, to)) return;
      io.to(toEntry.socketId).emit('rt:group:signal', { groupId, from: userId, type, data: payload?.data || null });
    });

    socket.on('disconnect', () => {
      const id = dmByUser.get(userId);
      const call = dmCalls.get(id);
      if (call && (call.aSocket === socket.id || call.bSocket === socket.id)) emitDmEnd(io, call, 'A conexão da chamada foi encerrada.');
      for (const [groupId, members] of groupCalls) {
        const entry = members.get(userId);
        if (entry?.socketId === socket.id) leaveGroupCall(io, null, groupId, userId, 'Participante desconectado.');
      }
    });
  });
}

module.exports = { attachRealtimeV3 };
