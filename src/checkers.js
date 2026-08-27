const crypto = require('crypto');
const S = require('./store');
const R = require('../public/checkers-rules-v1');

const games = new Map();
const playerGames = new Map();
const queue = [];
const waitingRooms = new Map();
const disconnectTimers = new Map();
let ioServer = null;

function attachCheckersSocket(io) {
    ioServer = io;
    io.on('connection', socket => {
        const account = socket.account;
        if (!account) return;
        const userId = account.id;
        socket.join(userRoom(userId));
        clearDisconnect(userId);

        const activeId = playerGames.get(userId);
        if (activeId && games.has(activeId)) {
            socket.join(gameRoom(activeId));
            socket.emit('checkers:game', publicGame(games.get(activeId), userId));
        }
        socket.emit('checkers:ready', { queued: queue.includes(userId) });

        socket.on('checkers:queue:join', () => safeSocket(socket, () => {
            ensureAvailable(userId);
            removeWaitingForUser(userId);
            if (!queue.includes(userId)) queue.push(userId);
            socket.emit('checkers:queue', { queued: true });
            matchQueue();
        }));

        socket.on('checkers:queue:leave', () => {
            leaveQueue(userId);
            socket.emit('checkers:queue', { queued: false });
        });

        socket.on('checkers:room:create', () => safeSocket(socket, () => {
            ensureAvailable(userId);
            leaveQueue(userId);
            removeWaitingForUser(userId);
            const code = createRoomCode();
            waitingRooms.set(code, { code, hostId: userId, createdAt: Date.now() });
            socket.emit('checkers:room', { code, waiting: true });
        }));

        socket.on('checkers:room:cancel', () => {
            const removed = removeWaitingForUser(userId);
            if (removed) socket.emit('checkers:room', { code: null, waiting: false });
        });

        socket.on('checkers:room:join', payload => safeSocket(socket, () => {
            ensureAvailable(userId);
            const code = cleanCode(payload?.code);
            const room = waitingRooms.get(code);
            if (!room) throw new Error('Sala não encontrada ou expirada.');
            if (room.hostId === userId) throw new Error('Você já é o dono dessa sala.');
            if (playerGames.has(room.hostId)) {
                waitingRooms.delete(code);
                throw new Error('O criador da sala já entrou em outra partida.');
            }
            waitingRooms.delete(code);
            leaveQueue(userId);
            leaveQueue(room.hostId);
            const [redId, whiteId] = randomSides(room.hostId, userId);
            startGame(makeGame(redId, whiteId));
        }));

        socket.on('checkers:move', payload => safeSocket(socket, () => {
            const game = getPlayerGame(userId, payload?.gameId);
            if (game.state.status !== 'playing') throw new Error('A partida já terminou.');
            const viewer = colorFor(game, userId);
            if (!viewer || viewer !== game.state.turn) throw new Error('Não é sua vez.');
            game.state = R.applyStep(game.state, payload?.from, payload?.to);
            game.updatedAt = Date.now();
            if (game.state.status === 'finished') game.finishedAt = Date.now();
            emitGame(game);
        }));

        socket.on('checkers:rematch', payload => safeSocket(socket, () => {
            const game = getPlayerGame(userId, payload?.gameId);
            if (game.state.status !== 'finished') throw new Error('A revanche só fica disponível quando a partida termina.');
            game.rematch.add(userId);
            ioServer.to(gameRoom(game.id)).emit('checkers:rematch:state', { requestedBy: [...game.rematch] });
            if (!game.rematch.has(game.redId) || !game.rematch.has(game.whiteId)) return;
            const next = makeGame(game.whiteId, game.redId);
            replaceGame(game, next);
            emitGame(next);
        }));

        socket.on('checkers:leave', () => safeSocket(socket, () => {
            leaveQueue(userId);
            removeWaitingForUser(userId);
            const gameId = playerGames.get(userId);
            const game = gameId ? games.get(gameId) : null;
            if (!game) return socket.emit('checkers:left', { reason: 'Você saiu do modo online.' });
            if (game.state.status === 'playing') {
                finishByForfeit(game, userId, 'O adversário saiu da partida.');
                emitGame(game);
            }
            scheduleCleanup(game, 1200, 'Partida encerrada.');
        }));

        socket.on('disconnect', () => {
            leaveQueue(userId);
            removeWaitingForUser(userId);
            const gameId = playerGames.get(userId);
            const game = gameId ? games.get(gameId) : null;
            if (!game || game.state.status !== 'playing') return;
            clearDisconnect(userId);
            const timer = setTimeout(async () => {
                disconnectTimers.delete(userId);
                try {
                    const connected = await io.in(userRoom(userId)).fetchSockets();
                    if (connected.length) return;
                } catch {}
                const currentId = playerGames.get(userId);
                const current = currentId ? games.get(currentId) : null;
                if (!current || current.state.status !== 'playing') return;
                finishByForfeit(current, userId, 'O adversário ficou desconectado por muito tempo.');
                emitGame(current);
                scheduleCleanup(current, 5000, 'Partida encerrada por desconexão.');
            }, 25000);
            timer.unref?.();
            disconnectTimers.set(userId, timer);
        });
    });
}

function makeGame(redId, whiteId) {
    return {
        id: randomId(),
        redId,
        whiteId,
        state: R.createState(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
        finishedAt: null,
        forfeitReason: null,
        rematch: new Set(),
        cleanupTimer: null
    };
}

function startGame(game) {
    games.set(game.id, game);
    for (const id of [game.redId, game.whiteId]) {
        playerGames.set(id, game.id);
        ioServer.to(userRoom(id)).socketsJoin(gameRoom(game.id));
        ioServer.to(userRoom(id)).emit('checkers:queue', { queued: false });
        ioServer.to(userRoom(id)).emit('checkers:room', { code: null, waiting: false });
    }
    emitGame(game);
}

function replaceGame(oldGame, nextGame) {
    if (oldGame.cleanupTimer) clearTimeout(oldGame.cleanupTimer);
    games.delete(oldGame.id);
    for (const id of [oldGame.redId, oldGame.whiteId]) {
        clearDisconnect(id);
        playerGames.set(id, nextGame.id);
        ioServer.to(userRoom(id)).socketsLeave(gameRoom(oldGame.id));
        ioServer.to(userRoom(id)).socketsJoin(gameRoom(nextGame.id));
    }
    games.set(nextGame.id, nextGame);
}

function matchQueue() {
    while (queue.length >= 2) {
        const first = queue.shift();
        if (!first || playerGames.has(first)) continue;
        const secondIndex = queue.findIndex(id => id !== first && !playerGames.has(id));
        if (secondIndex < 0) {
            queue.unshift(first);
            break;
        }
        const [second] = queue.splice(secondIndex, 1);
        const [redId, whiteId] = randomSides(first, second);
        startGame(makeGame(redId, whiteId));
    }
}

function getPlayerGame(userId, rawGameId) {
    const gameId = cleanId(rawGameId);
    const game = games.get(gameId);
    if (!game || playerGames.get(userId) !== game.id) throw new Error('Partida não encontrada.');
    return game;
}

function finishByForfeit(game, loserId, reason) {
    const loserColor = colorFor(game, loserId);
    if (!loserColor || game.state.status !== 'playing') return;
    game.state = {
        ...R.cloneState(game.state),
        status: 'finished',
        winner: R.opponent(loserColor),
        forcedFrom: null
    };
    game.forfeitReason = reason;
    game.finishedAt = Date.now();
    game.updatedAt = Date.now();
}

function publicGame(game, viewerId) {
    const accounts = new Map(S.loadAccounts().map(item => [item.id, item]));
    const viewerColor = colorFor(game, viewerId);
    const canMove = game.state.status === 'playing' && viewerColor === game.state.turn;
    return {
        id: game.id,
        board: [...game.state.board],
        turn: game.state.turn,
        forcedFrom: game.state.forcedFrom,
        status: game.state.status,
        winner: game.state.winner,
        noProgress: game.state.noProgress,
        moveNumber: game.state.moveNumber,
        lastMove: game.state.lastMove,
        viewerColor,
        canMove,
        legalSteps: canMove ? R.getLegalSteps(game.state.board, game.state.turn, game.state.forcedFrom) : [],
        red: basicUser(accounts.get(game.redId)),
        white: basicUser(accounts.get(game.whiteId)),
        forfeitReason: game.forfeitReason,
        createdAt: game.createdAt,
        updatedAt: game.updatedAt
    };
}

function emitGame(game) {
    for (const id of [game.redId, game.whiteId]) {
        ioServer?.to(userRoom(id)).emit('checkers:game', publicGame(game, id));
    }
}

function colorFor(game, userId) {
    if (game.redId === userId) return 'red';
    if (game.whiteId === userId) return 'white';
    return null;
}

function scheduleCleanup(game, delay, reason) {
    if (!game || game.cleanupTimer) return;
    const timer = setTimeout(() => cleanupGame(game, reason), delay);
    timer.unref?.();
    game.cleanupTimer = timer;
}

function cleanupGame(game, reason = 'Partida encerrada.') {
    if (!game || !games.has(game.id)) return;
    if (game.cleanupTimer) clearTimeout(game.cleanupTimer);
    games.delete(game.id);
    for (const id of [game.redId, game.whiteId]) {
        if (playerGames.get(id) === game.id) playerGames.delete(id);
        clearDisconnect(id);
        ioServer?.to(userRoom(id)).socketsLeave(gameRoom(game.id));
        ioServer?.to(userRoom(id)).emit('checkers:left', { gameId: game.id, reason });
    }
}

function cleanupCheckersAccount(accountId) {
    const userId = cleanId(accountId);
    if (!userId) return;
    leaveQueue(userId);
    removeWaitingForUser(userId);
    clearDisconnect(userId);
    const gameId = playerGames.get(userId);
    const game = gameId ? games.get(gameId) : null;
    if (!game) {
        playerGames.delete(userId);
        return;
    }
    if (game.state.status === 'playing') {
        finishByForfeit(game, userId, 'Conta removida durante a partida.');
        emitGame(game);
    }
    cleanupGame(game, 'Partida encerrada porque uma conta foi removida.');
}

function ensureAvailable(userId) {
    if (playerGames.has(userId)) throw new Error('Saia da partida atual antes de iniciar outra.');
}

function leaveQueue(userId) {
    let index = queue.indexOf(userId);
    while (index >= 0) {
        queue.splice(index, 1);
        index = queue.indexOf(userId);
    }
}

function removeWaitingForUser(userId) {
    let removed = false;
    for (const [code, room] of waitingRooms) {
        if (room.hostId !== userId) continue;
        waitingRooms.delete(code);
        removed = true;
    }
    return removed;
}

function createRoomCode() {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    for (let tries = 0; tries < 50; tries += 1) {
        let code = '';
        for (let i = 0; i < 6; i += 1) code += alphabet[crypto.randomInt(0, alphabet.length)];
        if (!waitingRooms.has(code)) return code;
    }
    throw new Error('Não foi possível criar a sala agora. Tente novamente.');
}

function randomSides(a, b) {
    return crypto.randomInt(0, 2) === 0 ? [a, b] : [b, a];
}

function basicUser(account) {
    if (!account) return { id: null, username: 'Usuário' };
    return { id: account.id, username: account.username };
}

function cleanCode(value) {
    return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
}

function cleanId(value) {
    return String(value || '').trim().slice(0, 120);
}

function randomId() {
    return crypto.randomBytes(12).toString('hex');
}

function userRoom(id) { return `user:${id}`; }
function gameRoom(id) { return `checkers:${id}`; }

function clearDisconnect(userId) {
    const timer = disconnectTimers.get(userId);
    if (timer) clearTimeout(timer);
    disconnectTimers.delete(userId);
}

function safeSocket(socket, fn) {
    try {
        const result = fn();
        if (result && typeof result.catch === 'function') result.catch(error => socket.emit('checkers:error', { error: error.message || 'Erro no modo online.' }));
    } catch (error) {
        socket.emit('checkers:error', { error: error.message || 'Erro no modo online.' });
    }
}

module.exports = { attachCheckersSocket, cleanupCheckersAccount };
