const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.join(__dirname, '..');
const finalCss = fs.readFileSync(path.join(root, 'public/theme-completeness-v2.css'), 'utf8');
const finalCssV3 = fs.readFileSync(path.join(root, 'public/theme-completeness-v3.css'), 'utf8');
const finalCssV4 = fs.readFileSync(path.join(root, 'public/theme-completeness-v4.css'), 'utf8');
const aliases = fs.readFileSync(path.join(root, 'public/theme-legacy-aliases-v2.css'), 'utf8');
const combined = `${finalCss}\n${finalCssV3}\n${finalCssV4}`;
const requiredSelectors = [
  '.topbar', '.brand::before', '.button.primary', '.ui-title-icon', '.card', '.tab.active',
  'input:focus', '.workspace-sidebar', '.workspace-nav-link.active', '.workspace-nav-icon',
  '.profile-v3-card', '.profile-v3-store-filter button.active', '.profile-store-tools-v5', '.chat-bubble.mine',
  '.ui-preference-symbol', '.ui-preference-switch', '.chat-side-count-v10', '.profile-media-card-v10',
  '.dash-insight-icon', '.dash-progress i', '.workspace-command-box-v1', '.workspace-command-item-v1 b',
  '.panel-mini-self', '.profile-v3-price i', '.skynet-music-bar', '.skynet-music-progress',
  '.sticker-picker-v1', '.sticker-picker-tabs-v1 button.active', 'h2>.ui-action-icon-v4'
];
for (const selector of requiredSelectors) assert(combined.includes(selector), `Cobertura temática ausente para ${selector}`);
for (const alias of ['--cyan:var(--theme-bright)', '--pink:var(--theme-bright)', '--primary:var(--theme-primary)']) {
  assert(aliases.includes(alias), `Alias temático ausente: ${alias}`);
}
assert(combined.includes('scrollbar-color:'), 'Scrollbar ainda não está coberta pelo tema.');
assert(finalCssV3.includes('var(--theme-primary)') && finalCssV3.includes('var(--theme-bright)'), 'Camada v3 não usa a paleta dinâmica.');
assert(finalCssV4.includes('var(--theme-primary)') && finalCssV4.includes('var(--theme-bright)'), 'Camada v4 não usa a paleta dinâmica.');
console.log('Theme color coverage test OK');
