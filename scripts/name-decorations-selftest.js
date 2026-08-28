const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { CATALOG } = require('../src/profile-economy');
const { NAME_CATALOG } = require('../src/profile-name-decorations');

assert(Array.isArray(NAME_CATALOG), 'Catálogo de decorações de nome inválido.');
assert.strictEqual(NAME_CATALOG.length, 25, 'O catálogo deve ter exatamente 25 decorações de nome.');
assert.strictEqual(NAME_CATALOG.filter(item => item.animated).length, 10, 'Exatamente 10 decorações de nome devem ser animadas.');

const regularIds = new Set(CATALOG.map(item => item.id));
const ids = new Set();
for (const item of NAME_CATALOG) {
    assert(item && item.type === 'name-decoration', `Tipo inválido em ${item?.id || 'item desconhecido'}.`);
    assert(/^[a-z0-9_-]+$/.test(item.id), `ID inválido: ${item.id}`);
    assert(!regularIds.has(item.id), `ID colide com o catálogo principal: ${item.id}`);
    assert(!ids.has(item.id), `ID duplicado: ${item.id}`);
    assert(Number.isFinite(item.price) && item.price > 0, `Preço inválido: ${item.id}`);
    assert(Array.isArray(item.colors) && item.colors.length >= 2, `Paleta incompleta: ${item.id}`);
    ids.add(item.id);
}

const css = fs.readFileSync(path.join(__dirname, '..', 'public', 'profile-name-decorations-v1.css'), 'utf8');
for (const item of NAME_CATALOG) {
    assert(css.includes(`[data-name-decoration="${item.id}"]`), `Efeito CSS ausente para ${item.id}.`);
}

for (const item of NAME_CATALOG.filter(entry => entry.animated)) {
    const marker = `[data-name-decoration="${item.id}"]`;
    const start = css.indexOf(marker);
    assert(start >= 0, `Seletor animado ausente para ${item.id}.`);
    const next = css.indexOf('\n[data-name-decoration=', start + marker.length);
    const rule = css.slice(start, next < 0 ? css.length : next);
    assert(/animation\s*:/.test(rule), `Item ${item.id} está marcado como animado, mas não possui animação CSS.`);
}

console.log(`Name decorations self-test OK (${NAME_CATALOG.length} itens, 10 animados)`);
