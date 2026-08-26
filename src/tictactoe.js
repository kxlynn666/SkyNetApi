const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const C = require('./config');
const S = require('./store');

const STATS_FILE = path.join(C.DATA_DIR, 'tictactoe-stats.json');
const WIN_LINES = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
const games = new Map();
const playerGames = new Map();
const queue = [];
const invites = new Map();
const disconnectTimers = new Map();
let ioServer = null;

function registerTicTacToeRoutes(app) {
    ensureStorage();
    const json = express.json({ limit: '24kb' });
    app.use('/api/tictactoe', json);

    app.get('/api/tictactoe/me', requireSession, (req, res) => {
        res.setHeader('Cache-Control', 'no-store');
        return res.json({ ok: true, stats: getStats(req.account.id), activeGame: publicGameFor(req.account.id) });
    });

    app.get('/api/tictactoe/leaderboard', requireSession, (req, res) => {
        const accounts = new Map(S.loadAccounts().filter(a => a.active).map(a => [a.id, a]));
        const rows = loadStats().filter(row => accounts.has(row.accountId)).map(row => {
            const account = accounts.get(row.accountId);
            const pvp = row.pvp || emptyBucket();
            return { id: row.accountId, username: account.username, wins: Number(row.wins || 0), games: Number(row.games || 0), pvpWins: Number(pvp.wins || 0), draws: Number(row.draws || 0) };
        }).sort((a,b) => b.pvpWins - a.pvpWins || b.wins - a.wins || a.games - b.games || a.username.localeCompare(b.username)).slice(0, 25);
        return res.json({ ok: true, leaderboard: rows });
    });
}

function attachTicTacToeSocket(io) {
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
            socket.emit('ttt:game', publicGame(games.get(activeId), userId));
        }
        socket.emit('ttt:ready', { stats: getStats(userId), queued: queue.includes(userId) });

        socket.on('ttt:bot:start', payload => safeSocket(socket, () => {
            leaveQueue(userId);
            leaveCurrentGame(userId, 'Nova partida iniciada.', true);
            const difficulty = ['easy','medium','hard'].includes(payload?.difficulty) ? payload.difficulty : 'easy';
            const game = newGame({ type: 'bot', players: [userId, 'bot'], difficulty });
            games.set(game.id, game);
            playerGames.set(userId, game.id);
            socket.join(gameRoom(game.id));
            emitGame(game);
        }));

        socket.on('ttt:queue:join', () => safeSocket(socket, () => {
            if (playerGames.has(userId)) return socket.emit('ttt:error', { error: 'Saia da partida atual antes de buscar outra.' });
            if (!queue.includes(userId)) queue.push(userId);
            socket.emit('ttt:queue', { queued: true });
            matchQueue();
        }));

        socket.on('ttt:queue:leave', () => {
            leaveQueue(userId);
            socket.emit('ttt:queue', { queued: false });
        });

        socket.on('ttt:challenge', payload => safeSocket(socket, () => {
            const targetId = cleanId(payload?.userId);
            if (!targetId || targetId === userId) return socket.emit('ttt:error', { error: 'Usuário inválido para desafio.' });
            const target = S.loadAccounts().find(a => a.id === targetId && a.active);
            if (!target) return socket.emit('ttt:error', { error: 'Usuário não encontrado.' });
            if (playerGames.has(userId)) return socket.emit('ttt:error', { error: 'Você já está em uma partida.' });
            if (playerGames.has(targetId)) return socket.emit('ttt:error', { error: 'Esse usuário já está em uma partida.' });
            if ([...invites.values()].filter(item => item.fromId === userId && item.expiresAt > Date.now()).length >= 3) return socket.emit('ttt:error', { error: 'Você já possui muitos desafios pendentes.' });
            const invite = { id: randomId(), fromId: userId, toId: targetId, createdAt: Date.now(), expiresAt: Date.now() + 60000 };
            invites.set(invite.id, invite);
            setTimeout(() => {
                const current = invites.get(invite.id);
                if (!current) return;
                invites.delete(invite.id);
                io.to(userRoom(userId)).emit('ttt:challenge:expired', { inviteId: invite.id });
                io.to(userRoom(targetId)).emit('ttt:challenge:expired', { inviteId: invite.id });
            }, 61000).unref?.();
            io.to(userRoom(targetId)).emit('ttt:challenge', { inviteId: invite.id, from: basicUser(account), expiresAt: invite.expiresAt });
            socket.emit('ttt:challenge:sent', { inviteId: invite.id, to: basicUser(target) });
        }));

        socket.on('ttt:challenge:accept', payload => safeSocket(socket, () => {
            const invite = invites.get(cleanId(payload?.inviteId));
            if (!invite || invite.toId !== userId || invite.expiresAt <= Date.now()) return socket.emit('ttt:error', { error: 'Desafio expirado ou inválido.' });
            invites.delete(invite.id);
            if (playerGames.has(invite.fromId) || playerGames.has(invite.toId)) return socket.emit('ttt:error', { error: 'Um dos jogadores já entrou em outra partida.' });
            leaveQueue(invite.fromId); leaveQueue(invite.toId);
            const game = newGame({ type: 'pvp', players: shufflePair(invite.fromId, invite.toId) });
            startPvpGame(game);
        }));

        socket.on('ttt:challenge:decline', payload => {
            const invite = invites.get(cleanId(payload?.inviteId));
            if (!invite || invite.toId !== userId) return;
            invites.delete(invite.id);
            io.to(userRoom(invite.fromId)).emit('ttt:challenge:declined', { inviteId: invite.id });
        });

        socket.on('ttt:move', payload => safeSocket(socket, () => makeMove(userId, payload?.gameId, payload?.index)));
        socket.on('ttt:rematch', payload => safeSocket(socket, () => requestRematch(userId, payload?.gameId)));
        socket.on('ttt:leave', () => safeSocket(socket, () => leaveCurrentGame(userId, 'Jogador saiu da partida.', true)));

        socket.on('disconnect', () => {
            leaveQueue(userId);
            const gameId = playerGames.get(userId);
            const game = gameId ? games.get(gameId) : null;
            if (!game || game.type !== 'pvp' || game.status === 'finished') return;
            clearDisconnect(userId);
            const timer = setTimeout(async () => {
                disconnectTimers.delete(userId);
                try {
                    const connected = await io.in(userRoom(userId)).fetchSockets();
                    if (connected.length) return;
                } catch {}
                const currentId = playerGames.get(userId);
                const current = currentId ? games.get(currentId) : null;
                if (!current || current.status === 'finished') return;
                finishByForfeit(current, userId, 'Desconectado por muito tempo.');
            }, 20000);
            timer.unref?.();
            disconnectTimers.set(userId, timer);
        });
    });
}

function newGame({ type, players, difficulty = null }) {
    const first = players[0], second = players[1];
    return {
        id: randomId(), type, difficulty, board: Array(9).fill(''), status: 'playing', winner: null, winningLine: [], turn: 'X',
        xId: first, oId: second, createdAt: Date.now(), updatedAt: Date.now(), finishedAt: null, rematch: new Set(), recorded: false
    };
}

function startPvpGame(game) {
    games.set(game.id, game);
    for (const id of [game.xId, game.oId]) {
        playerGames.set(id, game.id);
        ioServer.to(userRoom(id)).socketsJoin(gameRoom(game.id));
    }
    emitGame(game);
}

function matchQueue() {
    while (queue.length >= 2) {
        const a = queue.shift();
        if (!a || playerGames.has(a)) continue;
        const bIndex = queue.findIndex(id => id !== a && !playerGames.has(id));
        if (bIndex < 0) { queue.unshift(a); break; }
        const [b] = queue.splice(bIndex, 1);
        const game = newGame({ type: 'pvp', players: shufflePair(a,b) });
        ioServer.to(userRoom(a)).emit('ttt:queue', { queued: false });
        ioServer.to(userRoom(b)).emit('ttt:queue', { queued: false });
        startPvpGame(game);
    }
}

function makeMove(userId, gameIdRaw, indexRaw) {
    const gameId = cleanId(gameIdRaw);
    const game = games.get(gameId);
    const index = Number(indexRaw);
    if (!game || playerGames.get(userId) !== game.id) return emitUserError(userId, 'Partida não encontrada.');
    if (game.status !== 'playing') return emitUserError(userId, 'A partida já terminou.');
    if (!Number.isInteger(index) || index < 0 || index > 8 || game.board[index]) return emitUserError(userId, 'Jogada inválida.');
    const symbol = game.xId === userId ? 'X' : game.oId === userId ? 'O' : null;
    if (!symbol || symbol !== game.turn) return emitUserError(userId, 'Não é sua vez.');

    game.board[index] = symbol;
    game.updatedAt = Date.now();
    resolveAfterMove(game, symbol);
    emitGame(game);
    if (game.type === 'bot' && game.status === 'playing' && game.turn === 'O') {
        setTimeout(() => {
            const current = games.get(game.id);
            if (!current || current.status !== 'playing' || current.turn !== 'O') return;
            const move = chooseBotMove(current.board, current.difficulty);
            if (move >= 0) current.board[move] = 'O';
            current.updatedAt = Date.now();
            resolveAfterMove(current, 'O');
            emitGame(current);
        }, game.difficulty === 'hard' ? 260 : 360).unref?.();
    }
}

function resolveAfterMove(game, symbol) {
    const result = boardResult(game.board);
    if (result.winner) return finishGame(game, result.winner, result.line);
    if (result.draw) return finishGame(game, 'draw', []);
    game.turn = symbol === 'X' ? 'O' : 'X';
}

function finishGame(game, winner, line) {
    game.status = 'finished'; game.winner = winner; game.winningLine = line || []; game.finishedAt = Date.now(); game.updatedAt = Date.now();
    recordGame(game);
}

function finishByForfeit(game, loserId, reason) {
    const winnerId = game.xId === loserId ? game.oId : game.xId;
    game.status = 'finished'; game.winner = game.xId === winnerId ? 'X' : 'O'; game.winningLine = []; game.finishedAt = Date.now(); game.updatedAt = Date.now(); game.forfeitReason = reason;
    recordGame(game);
    emitGame(game);
}

function recordGame(game) {
    if (game.recorded) return;
    game.recorded = true;
    if (game.type === 'bot') {
        const userId = game.xId;
        const outcome = game.winner === 'draw' ? 'draw' : game.winner === 'X' ? 'win' : 'loss';
        updateStats(userId, outcome, `bot:${game.difficulty}`);
    } else {
        if (game.winner === 'draw') {
            updateStats(game.xId, 'draw', 'pvp'); updateStats(game.oId, 'draw', 'pvp');
        } else {
            const winnerId = game.winner === 'X' ? game.xId : game.oId;
            const loserId = winnerId === game.xId ? game.oId : game.xId;
            updateStats(winnerId, 'win', 'pvp'); updateStats(loserId, 'loss', 'pvp');
        }
    }
}

function requestRematch(userId, gameIdRaw) {
    const game = games.get(cleanId(gameIdRaw));
    if (!game || playerGames.get(userId) !== game.id || game.status !== 'finished') return emitUserError(userId, 'Não há revanche disponível.');
    if (game.type === 'bot') {
        const next = newGame({ type:'bot', players:[userId,'bot'], difficulty:game.difficulty });
        replaceGame(game, next);
        emitGame(next);
        return;
    }
    game.rematch.add(userId);
    ioServer.to(gameRoom(game.id)).emit('ttt:rematch:state', { requestedBy: [...game.rematch] });
    if (!game.rematch.has(game.xId) || !game.rematch.has(game.oId)) return;
    const next = newGame({ type:'pvp', players:[game.oId, game.xId] });
    replaceGame(game, next);
    emitGame(next);
}

function replaceGame(oldGame, next) {
    games.delete(oldGame.id);
    for (const id of [oldGame.xId, oldGame.oId].filter(id => id !== 'bot')) {
        playerGames.set(id, next.id);
        ioServer.to(userRoom(id)).socketsLeave(gameRoom(oldGame.id));
        ioServer.to(userRoom(id)).socketsJoin(gameRoom(next.id));
    }
    games.set(next.id, next);
}

function leaveCurrentGame(userId, reason, countForfeit) {
    const gameId = playerGames.get(userId);
    const game = gameId ? games.get(gameId) : null;
    if (!game) { playerGames.delete(userId); return; }
    if (countForfeit && game.type === 'pvp' && game.status === 'playing') finishByForfeit(game, userId, reason);
    for (const id of [game.xId, game.oId].filter(id => id !== 'bot')) {
        playerGames.delete(id);
        clearDisconnect(id);
        ioServer?.to(userRoom(id)).socketsLeave(gameRoom(game.id));
        ioServer?.to(userRoom(id)).emit('ttt:left', { gameId: game.id, reason });
    }
    games.delete(game.id);
}

function emitGame(game) {
    for (const id of [game.xId, game.oId].filter(id => id !== 'bot')) ioServer?.to(userRoom(id)).emit('ttt:game', publicGame(game, id));
}

function publicGame(game, viewerId) {
    const accounts = new Map(S.loadAccounts().map(a => [a.id, a]));
    const x = game.xId === 'bot' ? botUser(game.difficulty) : basicUser(accounts.get(game.xId));
    const o = game.oId === 'bot' ? botUser(game.difficulty) : basicUser(accounts.get(game.oId));
    const viewerSymbol = game.xId === viewerId ? 'X' : game.oId === viewerId ? 'O' : null;
    return { id:game.id, type:game.type, difficulty:game.difficulty, board:[...game.board], status:game.status, winner:game.winner, winningLine:[...game.winningLine], turn:game.turn, viewerSymbol, canMove:game.status === 'playing' && viewerSymbol === game.turn, x, o, forfeitReason:game.forfeitReason || null, createdAt:game.createdAt, updatedAt:game.updatedAt };
}
function publicGameFor(userId) { const id = playerGames.get(userId); const game = id ? games.get(id) : null; return game ? publicGame(game,userId) : null; }

function chooseBotMove(board, difficulty) {
    const empty = emptyCells(board);
    if (!empty.length) return -1;
    if (difficulty === 'easy') return randomChoice(empty);
    const win = tacticalMove(board, 'O'); if (win >= 0) return win;
    const block = tacticalMove(board, 'X'); if (block >= 0) return block;
    if (difficulty === 'medium') {
        if (board[4] === '' && Math.random() < .72) return 4;
        const corners = [0,2,6,8].filter(i => !board[i]);
        return corners.length && Math.random() < .66 ? randomChoice(corners) : randomChoice(empty);
    }
    let best = -Infinity, choices = [];
    for (const index of empty) {
        board[index] = 'O';
        const score = minimax(board, false, 0);
        board[index] = '';
        if (score > best) { best = score; choices = [index]; }
        else if (score === best) choices.push(index);
    }
    return randomChoice(choices);
}
function tacticalMove(board, symbol) { for (const i of emptyCells(board)) { board[i]=symbol; const won=boardResult(board).winner===symbol; board[i]=''; if(won)return i; } return -1; }
function minimax(board, maximizing, depth) {
    const result = boardResult(board);
    if (result.winner === 'O') return 10-depth;
    if (result.winner === 'X') return depth-10;
    if (result.draw) return 0;
    if (maximizing) { let best=-Infinity; for(const i of emptyCells(board)){board[i]='O';best=Math.max(best,minimax(board,false,depth+1));board[i]='';} return best; }
    let best=Infinity; for(const i of emptyCells(board)){board[i]='X';best=Math.min(best,minimax(board,true,depth+1));board[i]='';} return best;
}
function boardResult(board) { for(const line of WIN_LINES){const [a,b,c]=line;if(board[a]&&board[a]===board[b]&&board[a]===board[c])return{winner:board[a],line,draw:false};} return {winner:null,line:[],draw:board.every(Boolean)}; }
function emptyCells(board){return board.map((v,i)=>v?'':i).filter(v=>v!=='');}
function randomChoice(items){return items[crypto.randomInt(0,items.length)];}
function shufflePair(a,b){return crypto.randomInt(0,2) ? [a,b] : [b,a];}

function ensureStorage(){fs.mkdirSync(C.DATA_DIR,{recursive:true});if(!fs.existsSync(STATS_FILE))writeJsonAtomic(STATS_FILE,[]);}
function loadStats(){ensureStorage();try{const v=JSON.parse(fs.readFileSync(STATS_FILE,'utf8'));return Array.isArray(v)?v:[];}catch{return[];}}
function getStats(accountId){const found=loadStats().find(r=>r.accountId===accountId)||{};return normalizeStats(accountId,found);}
function normalizeStats(accountId,row){return {accountId,games:Number(row.games||0),wins:Number(row.wins||0),losses:Number(row.losses||0),draws:Number(row.draws||0),pvp:{...emptyBucket(),...(row.pvp||{})},bot:{easy:{...emptyBucket(),...(row.bot?.easy||{})},medium:{...emptyBucket(),...(row.bot?.medium||{})},hard:{...emptyBucket(),...(row.bot?.hard||{})}},updatedAt:row.updatedAt||null};}
function emptyBucket(){return{games:0,wins:0,losses:0,draws:0};}
function updateStats(accountId,outcome,mode){
    const all=loadStats();let row=all.find(r=>r.accountId===accountId);if(!row){row=normalizeStats(accountId,{});all.push(row);}else Object.assign(row,normalizeStats(accountId,row));
    row.games++;
    if(outcome==='win')row.wins++;else if(outcome==='loss')row.losses++;else row.draws++;
    const bucket=mode==='pvp'?row.pvp:row.bot[mode.split(':')[1]];bucket.games++;if(outcome==='win')bucket.wins++;else if(outcome==='loss')bucket.losses++;else bucket.draws++;
    row.updatedAt=new Date().toISOString();writeJsonAtomic(STATS_FILE,all);ioServer?.to(userRoom(accountId)).emit('ttt:stats',{stats:row});
}
function writeJsonAtomic(file,value){const temp=`${file}.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`;fs.writeFileSync(temp,JSON.stringify(value,null,2),{mode:0o600});fs.renameSync(temp,file);}
function cleanupTicTacToeAccount(accountId){leaveQueue(accountId);leaveCurrentGame(accountId,'Conta removida.',false);writeJsonAtomic(STATS_FILE,loadStats().filter(r=>r.accountId!==accountId));for(const [id,invite] of invites)if(invite.fromId===accountId||invite.toId===accountId)invites.delete(id);}

function requireSession(req,res,next){try{const token=parseCookies(req.headers.cookie||'').skynet_session||'';const session=token?S.getSession(token):null;const account=session?S.loadAccounts().find(a=>a.id===session.accountId&&a.active):null;if(!account)return res.status(401).json({ok:false,error:'Não autorizado.'});req.account=account;return next();}catch(error){return next(error);}}
function parseCookies(header){const out={};for(const part of String(header||'').split(';')){const i=part.indexOf('=');if(i<0)continue;const k=part.slice(0,i).trim(),v=part.slice(i+1).trim();try{out[k]=decodeURIComponent(v);}catch{out[k]=v;}}return out;}
function basicUser(account){return account?{id:account.id,username:account.username}:{id:'unknown',username:'Usuário'};}
function botUser(difficulty){return{id:'bot',username:`Bot ${difficulty==='hard'?'Difícil':difficulty==='medium'?'Médio':'Fácil'}`};}
function cleanId(value){return String(value||'').trim().slice(0,100);}
function randomId(){return crypto.randomBytes(12).toString('hex');}
function userRoom(id){return`ttt:user:${id}`;}function gameRoom(id){return`ttt:game:${id}`;}
function leaveQueue(id){let i;while((i=queue.indexOf(id))!==-1)queue.splice(i,1);}
function emitUserError(id,error){ioServer?.to(userRoom(id)).emit('ttt:error',{error});}
function clearDisconnect(id){const timer=disconnectTimers.get(id);if(timer)clearTimeout(timer);disconnectTimers.delete(id);}
function safeSocket(socket,fn){try{return fn();}catch(error){console.error('TicTacToe:',error);socket.emit('ttt:error',{error:'Não foi possível concluir a ação.'});}}

module.exports={registerTicTacToeRoutes,attachTicTacToeSocket,cleanupTicTacToeAccount};
