const assert = require('assert');
const { parseCodesFromText, parseEurogamerPage, extractStructuredArticle, mergeSourceCodes } = require('../src/roblox-codes');

const text = `
Códigos ativos de Volleyball Legends
UPDATE_85 — 5 Lucky Style Spins
SHIRO - 5 Lucky Style Spins
BLOCKED: 5 Lucky Ability Spins

Como resgatar os códigos
Abra o Roblox e entre no jogo.

Códigos expirados de Volleyball Legends
UPDATE_84
SEASON_18
PIRATE_SZN
SEASON_6_Grind
FREE CLAIM
FREE QUEST
`;

const codes = parseCodesFromText(text);
assert.deepStrictEqual(codes.filter(item => item.status === 'active').map(item => item.code), ['UPDATE_85', 'SHIRO', 'BLOCKED']);
assert.ok(codes.some(item => item.code === 'UPDATE_84' && item.status === 'expired'));
assert.ok(codes.some(item => item.code === 'SEASON_6_Grind' && item.status === 'expired'));
assert.ok(codes.some(item => item.code === 'FREE CLAIM' && item.status === 'expired'));
assert.ok(codes.some(item => item.code === 'FREE QUEST' && item.status === 'expired'));
assert.strictEqual(codes.find(item => item.code === 'UPDATE_85').reward, '5 Lucky Style Spins');

const flattened = 'Códigos ativos de Volleyball Legends UPDATE_85 — 5 Lucky Style Spins • SHIRO — 5 Lucky Style Spins • BLOCKED — 5 Lucky Ability Spins Códigos expirados de Volleyball Legends UPDATE_84 | SEASON_18 | PIRATE_SZN | UPDATE_83 | MIKAGE_REVIVED | SCHOOL_SOON';
const flatCodes = parseCodesFromText(flattened);
assert.deepStrictEqual(flatCodes.filter(item => item.status === 'active').map(item => item.code), ['UPDATE_85', 'SHIRO', 'BLOCKED']);
assert.deepStrictEqual(flatCodes.filter(item => item.status === 'expired').map(item => item.code), ['UPDATE_84', 'SEASON_18', 'PIRATE_SZN', 'UPDATE_83', 'MIKAGE_REVIVED', 'SCHOOL_SOON']);

const html = `<!doctype html><html><head><script type="application/ld+json">${JSON.stringify({
  '@type':'NewsArticle',
  dateModified:'2026-08-29T10:00:00+01:00',
  articleBody:flattened
})}</script></head><body><h1>Volleyball Legends</h1></body></html>`;

const structured = extractStructuredArticle(html);
assert.ok(structured.articleBody.includes('UPDATE_85'));
assert.strictEqual(structured.dateModified, '2026-08-29T10:00:00+01:00');

const parsed = parseEurogamerPage(html);
assert.ok(parsed.codes.length >= 9);
assert.ok(parsed.codes.some(item => item.code === 'UPDATE_84' && item.status === 'expired'));

const htmlFallback = '<h2>Working Volleyball Legends Codes</h2><ul><li>TEST_CODE_1 — recompensa teste</li></ul><h2>Expired Volleyball Legends Codes</h2><p>OLD_CODE_2 | OLD_CODE_3</p>';
const fallback = parseEurogamerPage(htmlFallback);
assert.ok(fallback.codes.some(item => item.code === 'TEST_CODE_1' && item.status === 'active'));
assert.ok(fallback.codes.some(item => item.code === 'OLD_CODE_2' && item.status === 'expired'));
assert.ok(fallback.codes.some(item => item.code === 'OLD_CODE_3' && item.status === 'expired'));

const merged = mergeSourceCodes([
  {
    source: { name: 'Fonte nova' },
    parsed: { codes: [
      { code: 'UPDATE_85', status: 'active', reward: '5 Lucky Style Spins' },
      { code: 'UPDATE_84', status: 'expired', reward: '' }
    ] }
  },
  {
    source: { name: 'Fonte antiga' },
    parsed: { codes: [
      { code: 'UPDATE_84', status: 'active', reward: '5 Lucky Style Spins' },
      { code: 'OLDER_CODE', status: 'expired', reward: '' }
    ] }
  }
]);
assert.strictEqual(merged.find(item => item.code === 'UPDATE_84').status, 'expired', 'A fonte mais nova deve prevalecer em conflito de status.');
assert.deepStrictEqual(merged.find(item => item.code === 'UPDATE_84').verifiedBy, ['Fonte nova', 'Fonte antiga']);

console.log('Roblox codes parser self-test OK (seções achatadas + múltiplas fontes)');
