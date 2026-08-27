const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const C = require('./config');
const S = require('./store');

const FRIENDS_FILE = path.join(C.DATA_DIR, 'social-friends.json');
const BLOCKS_FILE = path.join(C.DATA_DIR, 'social-blocks.json');
const GROUPS_FILE = path.join(C.DATA_DIR, 'social-groups.json');
const MAX_GROUP_CALL = 6;
const directCalls = new Map();
const directByUser = new Map();
const groupCalls = new Map();
const groupByUser = new Map();
const socketBuckets = new Map();

function readArray(file) {
  try {
    const value = JSON.parse(fs.readFileSync(file, 'utf8'));
    return Array.isArray(value) ? value : [];
  } catch { return []; }
}

function clean(value, max = 100) {
  return String(value || '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, max);
}

function randomId() {
  return typeof S.randomId === 'function' ? S.randomId(14) : crypto.randomBytes(14).toString('hex');
}

function userRoom(id) { return `user:${id}`; }
function groupById(id) { return readArray(GROUPS_FILE).find(group => group.id === id) || null; }
function isGroupMember(group, userId) { return Boolean(group?.memberIds?.includes(userId)); }

function profileUser(account) {
  const profile = account?.profile && typeof account.profile === 'object' ? account.profile : {};
  return {
    id: account.id,
    username: account.username,
    displayName: clean(profile.displayName, 50) || account.username,
    avatarUrl: profile.avatarUploadId ? `/social-avatar/${encodeURIComponent(account.id)}` : null
  };
}

function canDirectCall(a, b) {
  if (!a || !b || a === b) return false;
  const blocked = readArray(BLOCKS_FILE).some(item =>
    (item.blockerId === a && item.blockedId === b) || (item.blockerId === b && item.blockedId === a));
  if (blocked) return false;
  return readArray(FRIENDS_FILE).some(item => item.status === 'accepted' && (
    (item.senderId === a && item.receiverId === b) || (item.senderId === b && item.receiverId === a)
  ));
}

function acceptsCalls(account) {
  return account?.profile?.privacy?.allowCallsFromFriends !== false;
}

function validDescription(value) {
  return Boolean(value && ['offer', 'answer'].includes(value.type) && typeof value.sdp === 'string' && value.sdp.length > 0 && value.sdp.length <= 32000);
}

function validCandidate(value) {
  if (!value || typeof value !== 'object') return false;
  if (typeof value.candidate !== 'string' || value.candidate.length > 8000) return false;
  if (value.sdpMid != null && String(value.sdpMid).length > 100) return false;
  if (value.sdpMLineIndex != null && (!Number.isInteger(value.sdpMLineIndex) || value.sdpMLineIndex < 0 || value.sdpMLineIndex > 64)) return false;
  return true;
}

function mediaMode(value) {
  return ['camera', 'screen', 'none'].includes(value) ? value : 'none';
}

function allowSocket(socket, bucketName, max, windowMs) {
  const now = Date.now();
  const key = `${socket.id}:${bucketName}`;
  let bucket = socketBuckets.get(key);
  if (!bucket || bucket.resetAt <= now) bucket = { count: 0, resetAt: now + windowMs };
  bucket.count += 1;
  socketBuckets.set(key, bucket);
  return bucket.count <= max;
}

function userBusy(userId) {
  return directByUser.has(userId) || groupByUser.has(userId);
}

function directRole(call, socket) {
  if (!call || !socket?.account) return '';
  if (call.callerId === socket.account.id && call.callerSocketId === socket.id) return 'caller';
  if (call.calleeId === socket.account.id && call.calleeSocketId === socket.id) return 'callee';
  return '';
}

function endDirect(io, call, reason = 'Chamada encerrada.') {
  if (!call || !directCalls.has(call.id)) return;
  if (call.timer) clearTimeout(call.timer);
  directCalls.delete(call.id);
  if (directByUser.get(call.callerId) === call.id) directByUser.delete(call.callerId);
  if (directByUser.get(call.calleeId) === call.id) directByUser.delete(call.calleeId);
  const payload = { callId: call.id, reason };
  if (call.callerSocketId) io.to(call.callerSocketId).emit('call3:ended', payload);
  if (call.calleeSocketId) io.to(call.calleeSocketId).emit('call3:ended', payload);
  else io.to(userRoom(call.calleeId)).emit('call3:ended', payload);
}

function emitGroupState(io, groupId) {
  const group = groupById(groupId);
  if (!group) return;
  const call = groupCalls.get(groupId) || new Map();
  const participantIds = [...call.keys()];
  for (const userId of group.memberIds || []) io.to(userRoom(userId)).emit('groupcall3:state', { groupId, participantIds });
}

function leaveGroup(io, groupId, userId, socketId, reason = '') {
  const call = groupCalls.get(groupId);
  const entry = call?.get(userId);
  if (!entry || (socketId && entry.socketId !== socketId)) return;
  call.delete(userId);
  if (groupByUser.get(userId) === groupId) groupByUser.delete(userId);
  if (!call.size) groupCalls.delete(groupId);
  for (const other of call.values()) io.to(other.socketId).emit('groupcall3:peer-left', { groupId, userId, reason });
  emitGroupState(io, groupId);
}

function attachRealtimeCallsV3(io) {
  io.on('connection', socket => {
    const account = socket.account;
    if (!account) return;
    const userId = account.id;

    socket.on('call3:invite', async payload => {
      if (!allowSocket(socket, 'invite3', 10, 60_000)) return socket.emit('call3:error', { error: 'Muitas tentativas de chamada. Aguarde um pouco.' });
      const to = clean(payload?.to, 100);
      const mode = payload?.mode === 'video' ? 'video' : 'audio';
      if (!canDirectCall(userId, to)) return socket.emit('call3:error', { error: 'Chamadas estão disponíveis somente entre amigos.' });
      const target = S.loadAccounts().find(item => item.id === to && item.active);
      if (!target || !acceptsCalls(target)) return socket.emit('call3:error', { error: 'Este usuário não está aceitando chamadas.' });
      if (userBusy(userId) || userBusy(to)) return socket.emit('call3:error', { error: 'Uma das contas já está em outra chamada.' });
      const targetSockets = await io.in(userRoom(to)).fetchSockets();
      if (!targetSockets.length) return socket.emit('call3:error', { error: 'Este usuário está offline.' });

      const call = {
        id: randomId(), callerId: userId, calleeId: to,
        callerSocketId: socket.id, calleeSocketId: null,
        mode, accepted: false, timer: null
      };
      call.timer = setTimeout(() => endDirect(io, call, 'Chamada não atendida.'), 45_000);
      call.timer.unref?.();
      directCalls.set(call.id, call);
      directByUser.set(userId, call.id);
      directByUser.set(to, call.id);
      io.to(userRoom(to)).emit('call3:incoming', { callId: call.id, from: profileUser(account), mode });
      socket.emit('call3:ringing', { callId: call.id, to, mode });
    });

    socket.on('call3:accept', payload => {
      const call = directCalls.get(clean(payload?.callId, 140));
      if (!call || call.calleeId !== userId || call.accepted) return;
      if (groupByUser.has(userId)) return socket.emit('call3:error', { error: 'Saia da chamada de grupo antes de atender.' });
      if (call.timer) clearTimeout(call.timer);
      call.timer = null;
      call.accepted = true;
      call.calleeSocketId = socket.id;
      io.to(call.callerSocketId).emit('call3:accepted', { callId: call.id, by: userId, mode: call.mode });
      io.to(userRoom(userId)).emit('call3:claimed', { callId: call.id, socketId: socket.id });
      socket.emit('call3:accepted-local', { callId: call.id, mode: call.mode });
    });

    socket.on('call3:reject', payload => {
      const call = directCalls.get(clean(payload?.callId, 140));
      if (!call || call.calleeId !== userId || call.accepted) return;
      endDirect(io, call, 'Chamada recusada.');
    });

    socket.on('call3:end', payload => {
      const call = directCalls.get(clean(payload?.callId, 140));
      if (!call || !directRole(call, socket)) return;
      endDirect(io, call, clean(payload?.reason, 140) || 'Chamada encerrada.');
    });

    socket.on('call3:signal', payload => {
      if (!allowSocket(socket, 'signal3', 700, 60_000)) return;
      const call = directCalls.get(clean(payload?.callId, 140));
      const role = directRole(call, socket);
      if (!call?.accepted || !role) return;
      const targetSocketId = role === 'caller' ? call.calleeSocketId : call.callerSocketId;
      if (!targetSocketId) return;
      const output = { callId: call.id, from: userId };
      if (validDescription(payload?.description)) output.description = { type: payload.description.type, sdp: payload.description.sdp };
      else if (validCandidate(payload?.candidate)) output.candidate = payload.candidate;
      else return;
      io.to(targetSocketId).emit('call3:signal', output);
    });

    socket.on('call3:media', payload => {
      const call = directCalls.get(clean(payload?.callId, 140));
      const role = directRole(call, socket);
      if (!call?.accepted || !role) return;
      const targetSocketId = role === 'caller' ? call.calleeSocketId : call.callerSocketId;
      if (targetSocketId) io.to(targetSocketId).emit('call3:media', { callId: call.id, from: userId, mode: mediaMode(payload?.mode) });
    });

    socket.on('groupcall3:join', payload => {
      if (!allowSocket(socket, 'groupjoin3', 16, 60_000)) return socket.emit('groupcall3:error', { error: 'Muitas tentativas de entrada na chamada.' });
      const groupId = clean(payload?.groupId, 100);
      const group = groupById(groupId);
      if (!isGroupMember(group, userId)) return socket.emit('groupcall3:error', { groupId, error: 'Você não participa desse grupo.' });
      if (directByUser.has(userId)) return socket.emit('groupcall3:error', { groupId, error: 'Encerre sua chamada privada antes de entrar no grupo.' });
      const otherGroup = groupByUser.get(userId);
      if (otherGroup && otherGroup !== groupId) return socket.emit('groupcall3:error', { groupId, error: 'Você já está em outra chamada de grupo.' });

      let call = groupCalls.get(groupId);
      if (!call) { call = new Map(); groupCalls.set(groupId, call); }
      const existing = call.get(userId);
      if (existing && existing.socketId !== socket.id) return socket.emit('groupcall3:error', { groupId, error: 'Você já entrou nessa chamada em outra aba.' });
      if (!existing && call.size >= MAX_GROUP_CALL) return socket.emit('groupcall3:error', { groupId, error: `A chamada suporta até ${MAX_GROUP_CALL} participantes.` });

      const accounts = new Map(S.loadAccounts().filter(item => item.active).map(item => [item.id, item]));
      const participants = [...call.keys()].filter(id => id !== userId).map(id => {
        const participant = accounts.get(id);
        return participant ? profileUser(participant) : { id, username: 'Participante', displayName: 'Participante', avatarUrl: null };
      });
      call.set(userId, { socketId: socket.id, joinedAt: Date.now() });
      groupByUser.set(userId, groupId);
      socket.emit('groupcall3:participants', { groupId, participants });
      const user = profileUser(account);
      for (const [id, entry] of call) if (id !== userId) io.to(entry.socketId).emit('groupcall3:peer-joined', { groupId, user });
      emitGroupState(io, groupId);
    });

    socket.on('groupcall3:leave', payload => leaveGroup(io, clean(payload?.groupId, 100), userId, socket.id));

    socket.on('groupcall3:signal', payload => {
      if (!allowSocket(socket, 'groupsignal3', 1200, 60_000)) return;
      const groupId = clean(payload?.groupId, 100);
      const to = clean(payload?.to, 100);
      const call = groupCalls.get(groupId);
      const own = call?.get(userId);
      const target = call?.get(to);
      if (!own || own.socketId !== socket.id || !target) return;
      const output = { groupId, from: userId };
      if (validDescription(payload?.description)) output.description = { type: payload.description.type, sdp: payload.description.sdp };
      else if (validCandidate(payload?.candidate)) output.candidate = payload.candidate;
      else return;
      io.to(target.socketId).emit('groupcall3:signal', output);
    });

    socket.on('groupcall3:media', payload => {
      const groupId = clean(payload?.groupId, 100);
      const call = groupCalls.get(groupId);
      const own = call?.get(userId);
      if (!own || own.socketId !== socket.id) return;
      const mode = mediaMode(payload?.mode);
      for (const [id, entry] of call) if (id !== userId) io.to(entry.socketId).emit('groupcall3:media', { groupId, from: userId, mode });
    });

    socket.on('disconnect', () => {
      const callId = directByUser.get(userId);
      const call = callId ? directCalls.get(callId) : null;
      if (call && (call.callerSocketId === socket.id || call.calleeSocketId === socket.id)) endDirect(io, call, 'A outra pessoa desconectou.');
      const groupId = groupByUser.get(userId);
      if (groupId) leaveGroup(io, groupId, userId, socket.id, 'Participante desconectou.');
      for (const key of socketBuckets.keys()) if (key.startsWith(`${socket.id}:`)) socketBuckets.delete(key);
    });
  });
}

module.exports = { attachRealtimeCallsV3 };
