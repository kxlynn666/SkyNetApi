const assert = require('assert');
const { CATALOG } = require('../src/profile-economy');
const { NAME_CATALOG } = require('../src/profile-name-decorations');

assert(Array.isArray(NAME_CATALOG) && NAME_CATALOG.length >= 8, 'Catálogo de decorações de nome incompleto.');
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

console.log(`Name decorations self-test OK (${NAME_CATALOG.length} itens)`);
