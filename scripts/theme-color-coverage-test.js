const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.join(__dirname, '..');
const finalCss = fs.readFileSync(path.join(root, 'public/theme-completeness-v2.css'), 'utf8');
const aliases = fs.readFileSync(path.join(root, 'public/theme-legacy-aliases-v2.css'), 'utf8');
const requiredSelectors = [
  '.topbar', '.brand::before', '.button.primary', '.ui-title-icon', '.card', '.tab.active',
  'input:focus', '.workspace-sidebar', '.workspace-nav-link.active', '.workspace-nav-icon',
  '.profile-v3-card', '.profile-v3-store-filter button.active', '.profile-store-tools-v5', '.chat-bubble.mine'
];
for (const selector of requiredSelectors) assert(finalCss.includes(selector), `Cobertura temática ausente para ${selector}`);
for (const alias of ['--cyan:var(--theme-bright)', '--pink:var(--theme-bright)', '--primary:var(--theme-primary)']) {
  assert(aliases.includes(alias), `Alias temático ausente: ${alias}`);
}
assert(finalCss.includes('scrollbar-color:'), 'Scrollbar ainda não está coberta pelo tema.');
console.log('Theme color coverage test OK');
