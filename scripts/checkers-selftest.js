const assert = require('assert');
const R = require('../public/checkers-rules-v1');

function emptyBoard() { return Array(64).fill(R.EMPTY); }
function paths(sequences) { return sequences.map(item => item.path.join('-')).sort(); }

(function initialPosition() {
  const board = R.initialBoard();
  assert.strictEqual(R.countPieces(board, 'red').total, 12, 'posição inicial deve ter 12 vermelhas');
  assert.strictEqual(R.countPieces(board, 'white').total, 12, 'posição inicial deve ter 12 claras');
  assert.strictEqual(R.getTurnSequences(board, 'red').length, 7, 'vermelhas devem começar com 7 jogadas legais');
})();

(function mandatoryCapture() {
  const board = emptyBoard();
  board[17] = R.RED;
  board[26] = R.WHITE;
  board[46] = R.WHITE;
  const moves = R.getTurnSequences(board, 'red');
  assert.deepStrictEqual(paths(moves), ['17-35'], 'captura deve ser obrigatória');
})();

(function backwardCaptureForMen() {
  const board = emptyBoard();
  board[35] = R.RED;
  board[26] = R.WHITE;
  const moves = R.getTurnSequences(board, 'red');
  assert.deepStrictEqual(paths(moves), ['35-17'], 'peça comum deve capturar para trás');
})();

(function maximumCaptureRuleAndContinuation() {
  const board = emptyBoard();
  board[19] = R.RED;
  board[26] = R.WHITE;
  board[42] = R.WHITE;
  board[28] = R.WHITE;
  const moves = R.getTurnSequences(board, 'red');
  assert.deepStrictEqual(paths(moves), ['19-33-51'], 'deve prevalecer a sequência com mais capturas');

  let state = R.createState(board, 'red');
  state = R.applyStep(state, 19, 33);
  assert.strictEqual(state.turn, 'red', 'turno deve continuar durante captura múltipla');
  assert.strictEqual(state.forcedFrom, 33, 'mesma peça deve continuar capturando');
  assert.deepStrictEqual(R.getLegalSteps(state.board, state.turn, state.forcedFrom).map(move => `${move.from}-${move.to}`), ['33-51']);
  state = R.applyStep(state, 33, 51);
  assert.strictEqual(state.turn, 'white', 'turno deve trocar ao final da sequência');
  assert.strictEqual(state.forcedFrom, null);
})();

(function flyingKingCapture() {
  const board = emptyBoard();
  board[9] = R.RED_KING;
  board[27] = R.WHITE;
  const landings = R.getLegalSteps(board, 'red').map(move => move.to).sort((a,b) => a-b);
  assert.deepStrictEqual(landings, [36,45,54,63], 'dama deve poder pousar em casas livres após a captura');
})();

(function promotion() {
  const board = emptyBoard();
  board[49] = R.RED;
  board[14] = R.WHITE;
  const state = R.applyStep(R.createState(board, 'red'), 49, 56);
  assert.strictEqual(state.board[56], R.RED_KING, 'peça deve virar dama na última fileira');
  assert.strictEqual(state.status, 'playing');
  assert.strictEqual(state.turn, 'white');
})();

(function winByTakingLastPiece() {
  const board = emptyBoard();
  board[17] = R.RED;
  board[26] = R.WHITE;
  const state = R.applyStep(R.createState(board, 'red'), 17, 35);
  assert.strictEqual(state.status, 'finished');
  assert.strictEqual(state.winner, 'red');
})();

(function noProgressDraw() {
  const board = emptyBoard();
  board[17] = R.RED;
  board[46] = R.WHITE;
  const state = R.createState(board, 'red');
  state.noProgress = R.DRAW_NO_PROGRESS_TURNS - 1;
  const next = R.applyStep(state, 17, 24);
  assert.strictEqual(next.status, 'finished');
  assert.strictEqual(next.winner, 'draw');
})();

(function botAlwaysChoosesLegalMove() {
  const state = R.createState(R.initialBoard(), 'white');
  const legal = R.getTurnSequences(state.board, 'white');
  for (const difficulty of ['easy', 'medium', 'hard']) {
    const choice = R.chooseBotSequence(state, difficulty, 'white');
    assert(choice, `bot ${difficulty} deve escolher uma jogada`);
    assert(legal.some(move => move.path.join(',') === choice.path.join(',')), `bot ${difficulty} deve escolher uma jogada legal`);
    const next = R.applyTurnSequence(state, choice);
    assert.strictEqual(next.turn, 'red', `bot ${difficulty} deve concluir o turno`);
  }
})();

console.log('checkers-selftest: OK');
