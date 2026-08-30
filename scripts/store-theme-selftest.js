const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.join(__dirname, '..');
const design = fs.readFileSync(path.join(root, 'public/design-system-v14.css'), 'utf8');
const theme = fs.readFileSync(path.join(root, 'public/theme-completeness-v2.css'), 'utf8');
const themeV3 = fs.readFileSync(path.join(root, 'public/theme-completeness-v3.css'), 'utf8');
const themeV4 = fs.readFileSync(path.join(root, 'public/theme-completeness-v4.css'), 'utf8');
const hotfix = fs.readFileSync(path.join(root, 'public/store-filter-hotfix-v15.css'), 'utf8');
const workspace = fs.readFileSync(path.join(root, 'public/workspace.html'), 'utf8');
const postboot = fs.readFileSync(path.join(root, 'public/workspace-postboot-v1.js'), 'utf8');
const controller = fs.readFileSync(path.join(root, 'public/store-filter-controller-v2.js'), 'utf8');
const organizer = fs.readFileSync(path.join(root, 'public/profile-store-organizer-v5.js'), 'utf8');

assert(design.includes("@import url('/theme-completeness-v2.css')"), 'Camada base do tema não está carregada.');
assert(design.includes("@import url('/theme-completeness-v3.css')"), 'Camada final v3 do tema não está carregada.');
assert(design.includes("@import url('/theme-completeness-v4.css')"), 'Camada final v4 do tema não está carregada.');
assert(design.includes("@import url('/theme-legacy-aliases-v2.css')"), 'Aliases legados do tema não estão carregados.');
assert(design.includes("@import url('/store-filter-hotfix-v15.css')"), 'Hotfix de filtros da loja não está carregado.');
assert([theme, themeV3, themeV4].every(css => css.includes('var(--theme-primary)')), 'Uma camada temática não usa a cor principal dinâmica.');
assert(hotfix.includes('.profile-v3-product[hidden]') && hotfix.includes('display:none!important'), 'Filtro hidden da loja não está protegido.');
assert(postboot.includes("'/profile-name-decorations-v1.js'"), 'Integração de decoração de nome ausente do pós-boot do workspace.');
assert(postboot.includes("'/store-filter-controller-v2.js'"), 'Controlador estável de categorias não está no pós-boot do workspace.');
assert(controller.includes("type !== 'name-decoration'") && controller.includes('preferredType = type') && controller.includes("skynet:store-type-filter"), 'Controlador não preserva os filtros nativos e a categoria extra de nome.');
assert(!controller.includes('stopImmediatePropagation'), 'Controlador voltou a bloquear o manipulador nativo das categorias da loja.');
assert(organizer.includes('selectedType') && organizer.includes("cardType(card) === selectedType"), 'Organizador não combina categoria com busca/coleção/adquiridos.');
assert(!workspace.includes('<link rel="stylesheet" href="/design-system-v15.css">'), 'design-system-v15 está duplicado após a camada temática.');

console.log('Store/theme structural self-test OK');
