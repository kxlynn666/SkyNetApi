const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { NAME_CATALOG } = require('../src/profile-name-decorations');

const root = path.join(__dirname, '..');
const client = fs.readFileSync(path.join(root, 'public/profile-name-decorations-v1.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'public/profile-name-decorations-v1.css'), 'utf8');

for (const item of NAME_CATALOG) {
    assert(css.includes(`[data-name-decoration="${item.id}"]`), `Efeito visual ausente para ${item.id}`);
}
assert(client.includes("nameDecorationId"), 'Cliente não envia o slot nameDecorationId.');
assert(client.includes("name-decoration"), 'Cliente não reconhece a categoria name-decoration.');
console.log('Name decoration contract test OK');
