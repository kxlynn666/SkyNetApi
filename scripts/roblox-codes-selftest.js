const assert = require('assert');
const { parseCodesFromText, parseEurogamerPage, extractStructuredArticle } = require('../src/roblox-codes');

const text = `
Códigos ativos de Volleyball Legends
UPDATE_84 — 5 Lucky Style Spins
SEASON_18 - 5 Lucky Style Spins
PIRATE_SZN: 5 Lucky Ability Spins

Como resgatar os códigos
Abra o Roblox e entre no jogo.

Códigos expirados de Volleyball Legends
UPDATE_83
MIKAGE_REVIVED
SCHOOL_SOON
`;

const codes = parseCodesFromText(text);
assert.deepStrictEqual(codes.filter(item => item.status === 'active').map(item => item.code), ['UPDATE_84', 'SEASON_18', 'PIRATE_SZN']);
assert.deepStrictEqual(codes.filter(item => item.status === 'expired').map(item => item.code), ['UPDATE_83', 'MIKAGE_REVIVED', 'SCHOOL_SOON']);
assert.strictEqual(codes.find(item => item.code === 'UPDATE_84').reward, '5 Lucky Style Spins');

const html = `<!doctype html><html><head><script type="application/ld+json">${JSON.stringify({
  '@type':'NewsArticle',
  dateModified:'2026-08-29T10:00:00+01:00',
  articleBody:text
})}</script></head><body><h1>Volleyball Legends</h1></body></html>`;

const structured = extractStructuredArticle(html);
assert.ok(structured.articleBody.includes('UPDATE_84'));
assert.strictEqual(structured.dateModified, '2026-08-29T10:00:00+01:00');

const parsed = parseEurogamerPage(html);
assert.strictEqual(parsed.parser, 'json-ld');
assert.strictEqual(parsed.codes.length, 6);
assert.strictEqual(parsed.codes[0].code, 'UPDATE_84');

const htmlFallback = '<h2>Códigos ativos</h2><ul><li>TEST_CODE_1 — recompensa teste</li></ul><h2>Códigos expirados</h2><p>OLD_CODE_2</p>';
const fallback = parseEurogamerPage(htmlFallback);
assert.strictEqual(fallback.parser, 'html-text');
assert.ok(fallback.codes.some(item => item.code === 'TEST_CODE_1' && item.status === 'active'));
assert.ok(fallback.codes.some(item => item.code === 'OLD_CODE_2' && item.status === 'expired'));

console.log('Roblox codes parser self-test OK');
