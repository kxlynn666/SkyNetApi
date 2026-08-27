(() => {
  const EMPTY = 0;
  const RED = 1;
  const RED_KING = 2;
  const WHITE = -1;
  const WHITE_KING = -2;
  const SIZE = 8;
  const DRAW_NO_PROGRESS_TURNS = 80;
  const DIAGONALS = [[-1,-1],[-1,1],[1,-1],[1,1]];

  const api = {
    EMPTY, RED, RED_KING, WHITE, WHITE_KING, SIZE, DRAW_NO_PROGRESS_TURNS,
    initialBoard, createState, cloneState, playerOf, opponent, isKing,
    getTurnSequences, getLegalSteps, applyStep, applyTurnSequence,
    chooseBotSequence, countPieces, formatPlayer
  };

  if (typeof module === 'object' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.SkyNetCheckersRules = api;

  function rowOf(index) { return Math.floor(index / SIZE); }
  function colOf(index) { return index % SIZE; }
  function at(row, col) { return row * SIZE + col; }
  function inside(row, col) { return row >= 0 && row < SIZE && col >= 0 && col < SIZE; }
  function cloneBoard(board) { return Array.from(board || []); }

  function initialBoard() {
    const board = Array(SIZE * SIZE).fill(EMPTY);
    for (let row = 0; row < SIZE; row += 1) {
      for (let col = 0; col < SIZE; col += 1) {
        if ((row + col) % 2 === 0) continue;
        const index = at(row, col);
        if (row <= 2) board[index] = RED;
        else if (row >= 5) board[index] = WHITE;
      }
    }
    return board;
  }

  function createState(board = initialBoard(), turn = 'red') {
    return {
      board: cloneBoard(board),
      turn: turn === 'white' ? 'white' : 'red',
      forcedFrom: null,
      status: 'playing',
      winner: null,
      noProgress: 0,
      moveNumber: 1,
      lastMove: null
    };
  }

  function cloneState(state) {
    return {
      ...state,
      board: cloneBoard(state.board),
      lastMove: state.lastMove ? { ...state.lastMove } : null
    };
  }

  function playerOf(piece) {
    if (piece > 0) return 'red';
    if (piece < 0) return 'white';
    return null;
  }

  function opponent(player) { return player === 'red' ? 'white' : 'red'; }
  function isKing(piece) { return Math.abs(Number(piece)) === 2; }
  function formatPlayer(player) { return player === 'red' ? 'Vermelhas' : 'Claras'; }

  function ownPiece(board, index, player) {
    return playerOf(board[index]) === player;
  }

  function getCaptureStepsForPiece(board, from) {
    const piece = board[from];
    const player = playerOf(piece);
    if (!player) return [];
    const row = rowOf(from);
    const col = colOf(from);
    const steps = [];

    if (!isKing(piece)) {
      for (const [dr, dc] of DIAGONALS) {
        const enemyRow = row + dr;
        const enemyCol = col + dc;
        const landRow = row + dr * 2;
        const landCol = col + dc * 2;
        if (!inside(enemyRow, enemyCol) || !inside(landRow, landCol)) continue;
        const capture = at(enemyRow, enemyCol);
        const to = at(landRow, landCol);
        if (board[to] === EMPTY && playerOf(board[capture]) === opponent(player)) {
          steps.push({ from, to, capture });
        }
      }
      return steps;
    }

    for (const [dr, dc] of DIAGONALS) {
      let scanRow = row + dr;
      let scanCol = col + dc;
      let captured = null;
      while (inside(scanRow, scanCol)) {
        const index = at(scanRow, scanCol);
        const cell = board[index];
        if (cell === EMPTY) {
          if (captured !== null) steps.push({ from, to: index, capture: captured });
          scanRow += dr;
          scanCol += dc;
          continue;
        }
        if (captured !== null || playerOf(cell) === player) break;
        captured = index;
        scanRow += dr;
        scanCol += dc;
      }
    }
    return steps;
  }

  function captureSequencesFrom(board, from) {
    const piece = board[from];
    const player = playerOf(piece);
    if (!player) return [];
    const results = [];

    function walk(currentBoard, current, path, captures) {
      const steps = getCaptureStepsForPiece(currentBoard, current);
      if (!steps.length) {
        if (captures.length) results.push({ from: path[0], path: [...path], captures: [...captures], captureCount: captures.length });
        return;
      }
      for (const step of steps) {
        const nextBoard = cloneBoard(currentBoard);
        const moving = nextBoard[current];
        nextBoard[current] = EMPTY;
        nextBoard[step.capture] = EMPTY;
        nextBoard[step.to] = moving;
        walk(nextBoard, step.to, [...path, step.to], [...captures, step.capture]);
      }
    }

    walk(cloneBoard(board), from, [from], []);
    return results;
  }

  function getCaptureSequences(board, player, onlyFrom = null) {
    let sequences = [];
    if (Number.isInteger(onlyFrom)) {
      if (ownPiece(board, onlyFrom, player)) sequences = captureSequencesFrom(board, onlyFrom);
    } else {
      for (let index = 0; index < board.length; index += 1) {
        if (!ownPiece(board, index, player)) continue;
        sequences.push(...captureSequencesFrom(board, index));
      }
    }
    if (!sequences.length) return [];
    const max = Math.max(...sequences.map(sequence => sequence.captureCount));
    return sequences.filter(sequence => sequence.captureCount === max);
  }

  function simpleMovesForPiece(board, from) {
    const piece = board[from];
    const player = playerOf(piece);
    if (!player) return [];
    const row = rowOf(from);
    const col = colOf(from);
    const moves = [];

    if (!isKing(piece)) {
      const dr = player === 'red' ? 1 : -1;
      for (const dc of [-1, 1]) {
        const toRow = row + dr;
        const toCol = col + dc;
        if (!inside(toRow, toCol)) continue;
        const to = at(toRow, toCol);
        if (board[to] === EMPTY) moves.push({ from, path: [from, to], captures: [], captureCount: 0 });
      }
      return moves;
    }

    for (const [dr, dc] of DIAGONALS) {
      let scanRow = row + dr;
      let scanCol = col + dc;
      while (inside(scanRow, scanCol)) {
        const to = at(scanRow, scanCol);
        if (board[to] !== EMPTY) break;
        moves.push({ from, path: [from, to], captures: [], captureCount: 0 });
        scanRow += dr;
        scanCol += dc;
      }
    }
    return moves;
  }

  function getTurnSequences(board, player) {
    const captures = getCaptureSequences(board, player);
    if (captures.length) return captures;
    const moves = [];
    for (let index = 0; index < board.length; index += 1) {
      if (!ownPiece(board, index, player)) continue;
      moves.push(...simpleMovesForPiece(board, index));
    }
    return moves;
  }

  function getLegalSteps(board, player, forcedFrom = null) {
    const sequences = Number.isInteger(forcedFrom)
      ? getCaptureSequences(board, player, forcedFrom)
      : getTurnSequences(board, player);
    const unique = new Map();
    for (const sequence of sequences) {
      if (!sequence.path || sequence.path.length < 2) continue;
      const from = sequence.path[0];
      const to = sequence.path[1];
      const capture = sequence.captures?.[0] ?? null;
      const key = `${from}:${to}:${capture ?? 'n'}`;
      if (!unique.has(key)) unique.set(key, { from, to, capture, captureCount: sequence.captureCount || 0 });
    }
    return [...unique.values()];
  }

  function promotionRow(player) { return player === 'red' ? SIZE - 1 : 0; }

  function promoteIfNeeded(board, index, player) {
    const piece = board[index];
    if (!piece || isKing(piece) || rowOf(index) !== promotionRow(player)) return false;
    board[index] = player === 'red' ? RED_KING : WHITE_KING;
    return true;
  }

  function finishTurn(state, to, hadCapture) {
    const next = cloneState(state);
    const promoted = promoteIfNeeded(next.board, to, next.turn);
    const finishedPlayer = next.turn;
    const nextPlayer = opponent(finishedPlayer);
    next.forcedFrom = null;
    next.noProgress = hadCapture || promoted ? 0 : Number(next.noProgress || 0) + 1;
    next.turn = nextPlayer;
    next.moveNumber = Number(next.moveNumber || 1) + 1;

    if (next.noProgress >= DRAW_NO_PROGRESS_TURNS) {
      next.status = 'finished';
      next.winner = 'draw';
      return next;
    }

    if (countPieces(next.board, nextPlayer).total === 0 || getTurnSequences(next.board, nextPlayer).length === 0) {
      next.status = 'finished';
      next.winner = finishedPlayer;
    }
    return next;
  }

  function applyStep(state, fromRaw, toRaw) {
    if (!state || state.status !== 'playing') throw new Error('A partida já terminou.');
    const from = Number(fromRaw);
    const to = Number(toRaw);
    if (!Number.isInteger(from) || !Number.isInteger(to)) throw new Error('Jogada inválida.');
    const legal = getLegalSteps(state.board, state.turn, state.forcedFrom);
    const move = legal.find(item => item.from === from && item.to === to);
    if (!move) throw new Error('Jogada inválida ou captura obrigatória ignorada.');

    const next = cloneState(state);
    const piece = next.board[from];
    next.board[from] = EMPTY;
    next.board[to] = piece;
    if (move.capture !== null) next.board[move.capture] = EMPTY;
    next.lastMove = { from, to, capture: move.capture, player: next.turn };

    if (move.capture !== null) {
      const continuation = getLegalSteps(next.board, next.turn, to);
      if (continuation.length) {
        next.forcedFrom = to;
        return next;
      }
    }

    return finishTurn(next, to, move.capture !== null);
  }

  function samePath(a, b) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((value, index) => Number(value) === Number(b[index]));
  }

  function applyTurnSequence(state, sequence) {
    if (!state || state.status !== 'playing' || state.forcedFrom !== null) throw new Error('Sequência indisponível.');
    const legal = getTurnSequences(state.board, state.turn);
    const chosen = legal.find(item => samePath(item.path, sequence?.path));
    if (!chosen) throw new Error('Sequência de jogada inválida.');

    const next = cloneState(state);
    const moving = next.board[chosen.path[0]];
    next.board[chosen.path[0]] = EMPTY;
    for (let hop = 1; hop < chosen.path.length; hop += 1) {
      const to = chosen.path[hop];
      if (hop > 1) next.board[chosen.path[hop - 1]] = EMPTY;
      next.board[to] = moving;
      const capture = chosen.captures?.[hop - 1];
      if (Number.isInteger(capture)) next.board[capture] = EMPTY;
    }
    const to = chosen.path[chosen.path.length - 1];
    next.lastMove = {
      from: chosen.path[0], to,
      capture: chosen.captures?.length ? chosen.captures[chosen.captures.length - 1] : null,
      player: next.turn,
      path: [...chosen.path]
    };
    return finishTurn(next, to, Boolean(chosen.captures?.length));
  }

  function countPieces(board, player) {
    let men = 0;
    let kings = 0;
    for (const piece of board) {
      if (playerOf(piece) !== player) continue;
      if (isKing(piece)) kings += 1;
      else men += 1;
    }
    return { men, kings, total: men + kings };
  }

  function evaluate(board, botPlayer) {
    const enemy = opponent(botPlayer);
    let score = 0;
    for (let index = 0; index < board.length; index += 1) {
      const piece = board[index];
      const owner = playerOf(piece);
      if (!owner) continue;
      const sign = owner === botPlayer ? 1 : -1;
      const row = rowOf(index);
      const col = colOf(index);
      let value = isKing(piece) ? 190 : 100;
      if (!isKing(piece)) {
        const progress = owner === 'red' ? row : (SIZE - 1 - row);
        value += progress * 4;
      }
      if (row >= 2 && row <= 5 && col >= 2 && col <= 5) value += 5;
      score += sign * value;
    }
    const botMoves = getTurnSequences(board, botPlayer).length;
    const enemyMoves = getTurnSequences(board, enemy).length;
    return score + (botMoves - enemyMoves) * 3;
  }

  function minimax(board, player, botPlayer, depth, alpha, beta) {
    const sequences = getTurnSequences(board, player);
    if (!sequences.length) return player === botPlayer ? -100000 - depth : 100000 + depth;
    if (depth <= 0) return evaluate(board, botPlayer);
    const maximizing = player === botPlayer;
    let best = maximizing ? -Infinity : Infinity;
    for (const sequence of sequences) {
      const state = createState(board, player);
      const next = applyTurnSequence(state, sequence);
      let score;
      if (next.status === 'finished') {
        score = next.winner === 'draw' ? 0 : next.winner === botPlayer ? 100000 + depth : -100000 - depth;
      } else {
        score = minimax(next.board, next.turn, botPlayer, depth - 1, alpha, beta);
      }
      if (maximizing) {
        best = Math.max(best, score);
        alpha = Math.max(alpha, best);
      } else {
        best = Math.min(best, score);
        beta = Math.min(beta, best);
      }
      if (beta <= alpha) break;
    }
    return best;
  }

  function chooseBotSequence(state, difficulty = 'medium', botPlayer = state?.turn) {
    if (!state || state.status !== 'playing' || state.turn !== botPlayer || state.forcedFrom !== null) return null;
    const sequences = getTurnSequences(state.board, botPlayer);
    if (!sequences.length) return null;
    if (difficulty === 'easy') return sequences[Math.floor(Math.random() * sequences.length)];

    const depth = difficulty === 'hard' ? 4 : 1;
    let bestScore = -Infinity;
    let best = [];
    for (const sequence of sequences) {
      const next = applyTurnSequence(state, sequence);
      let score;
      if (next.status === 'finished') score = next.winner === botPlayer ? 100000 : next.winner === 'draw' ? 0 : -100000;
      else if (difficulty === 'medium') score = evaluate(next.board, botPlayer) + Math.random() * 8;
      else score = minimax(next.board, next.turn, botPlayer, depth - 1, -Infinity, Infinity);
      if (score > bestScore + 0.001) {
        bestScore = score;
        best = [sequence];
      } else if (Math.abs(score - bestScore) <= 0.001) {
        best.push(sequence);
      }
    }
    return best[Math.floor(Math.random() * best.length)] || sequences[0];
  }
})();
