const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.join(__dirname, '..');
const design = fs.readFileSync(path.join(root, 'public/design-system-v14.css'), 'utf8');
const theme = fs.readFileSync(path.join(root, 'public/theme-completeness-v2.css'), 'utf8');
const hotfix = fs.readFileSync(path.join(root, 'public/store-filter-hotfix-v15.css'), 'utf8');
const workspace = fs.readFileSync(path.join(root, 'public/workspace.html'), 'utf8');

assert(design.includes("@import url('/theme-completeness-v2.css')"), 'Camada final do tema não está carregada.');
assert(design.includes("@import url('/theme-legacy-aliases-v2.css')"), 'Aliases legados do tema não estão carregados.');
assert(design.includes("@import url('/store-filter-hotfix-v15.css')"), 'Hotfix de filtros da loja não está carregado.');
assert(theme.includes('var(--theme-primary)'), 'Tema completo não usa a cor principal dinâmica.');
assert(hotfix.includes('.profile-v3-product[hidden]') && hotfix.includes('display:none!important'), 'Filtro hidden da loja não está protegido.');
assert(workspace.includes('/profile-name-decorations-v1.js'), 'Integração de decoração de nome ausente do workspace.');
assert(!workspace.includes('<link rel="stylesheet" href="/design-system-v15.css">'), 'design-system-v15 está duplicado após a camada temática.');

console.log('Store/theme structural self-test OK');
