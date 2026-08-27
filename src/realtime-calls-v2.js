const fs = require('fs');
const path = require('path');
const C = require('./config');
const S = require('./store');

const FRIENDS_FILE = path.join(C.DATA_DIR, 'social-friends.json');
const BLOCKS_FILE = path.join(C.DATA_DIR, 'social-blocks.json');
const GROUPS_FILE = path.join(C.DATA_DIR, 'social-groups.json');
const MAX_GROUP_CALL = 6;
const directCalls = new Map();
const directByUser = new Map();
const groupCalls = new Map();
const socketBuckets = new Map();
const groupMessageBuckets = new Map();

function readArray(file) {
  try {
    const value = JSON.parse(fs.readFileSync(file, 'utf8'));
    return Array.isArray(value) ? value : [];
  } catch { return []; }
}

function clean(value, max = 80) {
  return String(value || '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, max);
}

function randomId() {
  return S.randomId ? S.randomId(14) : require('crypto').randomBytes(14).toString('hex');
}

function userRoom(id) { return `user:${id}`; }
function getGroups() { return readArray(GROUPS_FILE); }
function getGroup(groupId) { return getGroups().find(group => group.id === groupId) || null; }
function isGroupMember(group, userId) { return Boolean(group?.memberIds?.includes(userId)); }

function basicUser(account) {
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
  if (readArray(BLOCKS_FILE).some(item =>
    (item.blockerId === a && item.blockedId === b) || (item.blockerId === b && item.blockedId === a))) return false;
  return readArray(FRIENDS_FILE).some(item => item.status === 'accepted' && (
    (item.senderId === a && item.receiverId === b) || (item.senderId === b && item.receiverId === a)
  ));
}

function acceptsCalls(account) {
  const privacy = account?.profile?.privacy;
  return !privacy || privacy.allowCallsFromFriends !== false;
}

function validDescription(value) {
  return Boolean(value && ['offer','answer'].includes(value.type) && typeof value.sdp === 'string' && value.sdp.length > 0 && value.sdp.length <= 24000);
}

function validCandidate(value) {
  if (!value || typeof value !== 'object') return false;
  if (typeof value.candidate !== 'string' || value.candidate.length > 6000) return false;
  if (value.sdpMid != null && String(value.sdpMid).length > 80) return false;
  if (value.sdpMLineIndex != null && (!Number.isInteger(value.sdpMLineIndex) || value.sdpMLineIndex < 0 || value.sdpMLineIndex > 64)) return false;
  return true;
}

function allowSocket(socket, bucketName, max, windowMs) {
  const now = Date.now();
  const key = `${socket.id}:${bucketName}`;
  let bucket = socketBuckets.get(key);
  if (!bucket || bucket.resetAt <= now) bucket = { count:0, resetAt:now + windowMs };
  bucket.count += 1;
  socketBuckets.set(key, bucket);
  return bucket.count <= max;
}

function endDirect(io, call, reason = 'Chamada encerrada.') {
  if (!call || !directCalls.has(call.id)) return;
  clearTimeout(call.timer);
  directCalls.delete(call.id);
  if (directByUser.get(call.callerId) === call.id) directByUser.delete(call.callerId);
  if (directByUser.get(call.calleeId) === call.id) directByUser.delete(call.calleeId);
  const payload = { callId:call.id, reason };
  if (call.callerSocketId) io.to(call.callerSocketId).emit('call2:ended', payload);
  if (call.calleeSocketId) io.to(call.calleeSocketId).emit('call2:ended', payload);
  else io.to(userRoom(call.calleeId)).emit('call2:ended', payload);
}

function participantForCall(call, socket) {
  if (!call || !socket?.account) return null;
  if (call.callerId === socket.account.id && call.callerSocketId === socket.id) return 'caller';
  if (call.calleeId === socket.account.id && (!call.calleeSocketId || call.calleeSocketId === socket.id)) return 'callee';
  return null;
}

function emitGroupState(io, groupId) {
  const group = getGroup(groupId);
  if (!group) return;
  const map = groupCalls.get(groupId) || new Map();
  const participantIds = [...map.keys()];
  for (const id of group.memberIds || []) io.to(userRoom(id)).emit('groupcall2:state', { groupId, participantIds });
}

function leaveGroupCall(io, groupId, userId, socketId, reason = '') {
  const map = groupCalls.get(groupId);
  const entry = map?.get(userId);
  if (!entry || (socketId && entry.socketId !== socketId)) return;
  map.delete(userId);
  if (!map.size) groupCalls.delete(groupId);
  for (const other of map.values()) io.to(other.socketId).emit('groupcall2:peer-left', { groupId, userId, reason });
  emitGroupState(io, groupId);
}

function registerRealtimeProtection(app) {
  app.use('/api/community/groups', (req, res, next) => {
    if (req.method !== 'POST' || !/^\/[^/]+\/messages\/?$/.test(req.path)) return next();
    let accountId = null;
    try {
      const token = String(req.headers.cookie || '').split(';').map(x => x.trim()).find(x => x.startsWith('skynet_session='))?.slice(16) || '';
      const session = token ? S.getSession(decodeURIComponent(token)) : null;
      accountId = session?.accountId || null;
    } catch {}
    const key = accountId || req.ip || 'unknown';
    const now = Date.now();
    let bucket = groupMessageBuckets.get(key);
    if (!bucket || bucket.resetAt <= now) bucket = { count:0, resetAt:now + 60000 };
    bucket.count += 1;
    groupMessageBuckets.set(key, bucket);
    if (bucket.count > 60) {
      res.setHeader('Retry-After', String(Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))));
      return res.status(429).json({ ok:false, error:'Você está enviando mensagens rápido demais.' });
    }
    return next();
  });
}

function attachRealtimeCallsV2(io) {
  io.on('connection', socket => {
    const account = socket.account;
    if (!account) return;
    const userId = account.id;

    socket.on('call2:invite', async payload => {
      if (!allowSocket(socket, 'invite', 12, 60000)) return socket.emit('call2:error', { error:'Muitas tentativas de chamada.' });
      const to = clean(payload?.to);
      const mode = payload?.mode === 'video' ? 'video' : 'audio';
      if (!canDirectCall(userId, to)) return socket.emit('call2:error', { error:'Chamadas estão disponíveis somente entre amigos.' });
      const target = S.loadAccounts().find(item => item.id === to && item.active);
      if (!target || !acceptsCalls(target)) return socket.emit('call2:error', { error:'Este usuário não está aceitando chamadas.' });
      if (directByUser.has(userId) || directByUser.has(to)) return socket.emit('call2:error', { error:'Uma das contas já está em outra chamada.' });
      const targetSockets = await io.in(userRoom(to)).fetchSockets();
      if (!targetSockets.length) return socket.emit('call2:error', { error:'Este usuário está offline.' });

      const call = { id:randomId(), callerId:userId, calleeId:to, callerSocketId:socket.id, calleeSocketId:null, mode, accepted:false, timer:null };
      call.timer = setTimeout(() => endDirect(io, call, 'Chamada não atendida.'), 45000);
      call.timer.unref?.();
      directCalls.set(call.id, call);
      directByUser.set(userId, call.id);
      directByUser.set(to, call.id);
      io.to(userRoom(to)).emit('call2:incoming', { callId:call.id, from:basicUser(account), mode });
      socket.emit('call2:ringing', { callId:call.id, to, mode });
    });

    socket.on('call2:accept', payload => {
      const call = directCalls.get(clean(payload?.callId, 120));
      if (!call || call.calleeId !== userId || call.accepted) return;
      clearTimeout(call.timer);
      call.timer = null;
      call.accepted = true;
      call.calleeSocketId = socket.id;
      io.to(call.callerSocketId).emit('call2:accepted', { callId:call.id, by:userId, mode:call.mode });
      io.to(userRoom(userId)).emit('call2:claimed', { callId:call.id, socketId:socket.id });
      socket.emit('call2:accepted-local', { callId:call.id, mode:call.mode });
    });

    socket.on('call2:reject', payload => {
      const call = directCalls.get(clean(payload?.callId, 120));
      if (!call || call.calleeId !== userId || call.accepted) return;
      if (call.callerSocketId) io.to(call.callerSocketId).emit('call2:rejected', { callId:call.id, by:userId });
      endDirect(io, call, 'Chamada recusada.');
    });

    socket.on('call2:end', payload => {
      const call = directCalls.get(clean(payload?.callId, 120));
      if (!call || !participantForCall(call, socket)) return;
      endDirect(io, call, clean(payload?.reason, 120) || 'Chamada encerrada.');
    });

    socket.on('call2:signal', payload => {
      if (!allowSocket(socket, 'signal', 500, 60000)) return;
      const call = directCalls.get(clean(payload?.callId, 120));
      const role = participantForCall(call, socket);
      if (!call?.accepted || !role) return;
      const targetSocketId = role === 'caller' ? call.calleeSocketId : call.callerSocketId;
      if (!targetSocketId) return;
      const out = { callId:call.id, from:userId };
      if (validDescription(payload?.description)) out.description = { type:payload.description.type, sdp:payload.description.sdp };
      else if (validCandidate(payload?.candidate)) out.candidate = payload.candidate;
      else return;
      io.to(targetSocketId).emit('call2:signal', out);
    });

    socket.on('groupcall2:join', payload => {
      if (!allowSocket(socket, 'groupjoin', 20, 60000)) return socket.emit('groupcall2:error', { error:'Muitas tentativas de entrada.' });
      const groupId = clean(payload?.groupId);
      const group = getGroup(groupId);
      if (!isGroupMember(group, userId)) return socket.emit('groupcall2:error', { groupId, error:'Você não participa desse grupo.' });
      let map = groupCalls.get(groupId);
      if (!map) { map = new Map(); groupCalls.set(groupId, map); }
      const existing = map.get(userId);
      if (existing && existing.socketId !== socket.id) return socket.emit('groupcall2:error', { groupId, error:'Você já entrou nessa call em outra aba.' });
      if (!existing && map.size >= MAX_GROUP_CALL) return socket.emit('groupcall2:error', { groupId, error:`A call suporta até ${MAX_GROUP_CALL} participantes.` });
      const accounts = new Map(S.loadAccounts().filter(a => a.active).map(a => [a.id,a]));
      const participants = [...map.entries()].filter(([id]) => id !== userId).map(([id]) => basicUser(accounts.get(id) || {id,username:'Participante'}));
      map.set(userId, { socketId:socket.id, mode:payload?.mode === 'video' ? 'video' : 'audio', joinedAt:Date.now() });
      socket.emit('groupcall2:participants', { groupId, participants });
      const user = basicUser(account);
      for (const [id, entry] of map) if (id !== userId) io.to(entry.socketId).emit('groupcall2:peer-joined', { groupId, user });
      emitGroupState(io, groupId);
    });

    socket.on('groupcall2:leave', payload => leaveGroupCall(io, clean(payload?.groupId), userId, socket.id));

    socket.on('groupcall2:signal', payload => {
      if (!allowSocket(socket, 'groupsignal', 900, 60000)) return;
      const groupId = clean(payload?.groupId);
      const to = clean(payload?.to);
      const map = groupCalls.get(groupId);
      const own = map?.get(userId);
      const target = map?.get(to);
      if (!own || own.socketId !== socket.id || !target) return;
      const out = { groupId, from:userId };
      if (validDescription(payload?.description)) out.description = { type:payload.description.type, sdp:payload.description.sdp };
      else if (validCandidate(payload?.candidate)) out.candidate = payload.candidate;
      else return;
      io.to(target.socketId).emit('groupcall2:signal', out);
    });

    socket.on('disconnect', () => {
      const callId = directByUser.get(userId);
      const call = callId ? directCalls.get(callId) : null;
      if (call && (call.callerSocketId === socket.id || call.calleeSocketId === socket.id)) endDirect(io, call, 'A outra pessoa desconectou.');
      for (const [groupId, map] of groupCalls) {
        const entry = map.get(userId);
        if (entry?.socketId === socket.id) leaveGroupCall(io, groupId, userId, socket.id, 'Participante desconectou.');
      }
      for (const key of socketBuckets.keys()) if (key.startsWith(`${socket.id}:`)) socketBuckets.delete(key);
    });
  });
}

module.exports = { registerRealtimeProtection, attachRealtimeCallsV2 };
