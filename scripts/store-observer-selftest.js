const fs = require('fs');
const path = require('path');
const assert = require('assert');
const source = fs.readFileSync(path.join(__dirname, '..', 'public', 'store-experience-v14.js'), 'utf8');
assert(source.includes("attributeFilter:['disabled','data-grant-only','data-buy-profile-item']"), 'Observador não acompanha mudanças importantes dos botões.');
assert(!source.includes('observer.disconnect(),30000'), 'Observador da loja ainda expira após 30 segundos.');
console.log('Store observer self-test OK');
