(() => {
  if (window.__SKYNET_ADMIN_COINS_EDITOR_V1__) return;
  window.__SKYNET_ADMIN_COINS_EDITOR_V1__ = true;
  const S = window.SkyNet;
  if (!S || !['/admin','/admin/painel'].includes(location.pathname.replace(/\/+$/,'') || '/')) return;

  function parseNumber(text) {
    const raw = String(text || '').replace(/\./g,'').replace(/,/g,'.').replace(/[^0-9.-]/g,'');
    const value = Number(raw);
    return Number.isFinite(value) ? Math.trunc(value) : 0;
  }

  function currentBalance() {
    const first = document.querySelector('#adminCosmeticContent .admin-cosmetic-summary .admin-cosmetic-stat strong');
    return Math.max(0, parseNumber(first?.textContent || '0'));
  }

  function selectedUser() {
    return document.getElementById('adminCosmeticUser')?.value || '';
  }

  function message(text, type = 'success') {
    const el = document.getElementById('adminCosmeticMessage');
    if (el) S.message(el, text, type);
  }

  async function setExactBalance(input, button) {
    const accountId = selectedUser();
    if (!accountId) return message('Selecione uma conta primeiro.','error');
    const desired = Math.trunc(Number(input.value));
    if (!Number.isFinite(desired) || desired < 0 || desired > 1000000) return message('Digite um saldo entre 0 e 1.000.000.','error');
    const current = currentBalance();
    const delta = desired - current;
    button.disabled = true;
    try {
      const result = await S.api(`/api/admin/profile-store/${encodeURIComponent(accountId)}/coins`, { method:'PATCH', body:{ delta } });
      const finalBalance = Number(result.wallet?.balance ?? desired);
      input.value = String(finalBalance);
      message(`Saldo definido para ${finalBalance.toLocaleString('pt-BR')} moedas.`,'success');
      document.getElementById('adminCosmeticLoad')?.click();
    } catch (error) {
      message(error.message || 'Não foi possível editar as moedas.','error');
    } finally { button.disabled = false; }
  }

  function install() {
    const actions = document.querySelector('#adminCosmeticContent .admin-cosmetic-actions');
    if (!actions || actions.dataset.exactCoins === '1') return false;
    actions.dataset.exactCoins = '1';
    const editor = document.createElement('div');
    editor.className = 'admin-coins-exact-v1';
    editor.innerHTML = `<label><span>Saldo exato</span><input id="adminExactCoinsInput" type="number" inputmode="numeric" min="0" max="1000000" step="1" value="${currentBalance()}" aria-label="Saldo exato de moedas"></label><button class="button primary small" id="adminExactCoinsApply" type="button">Definir saldo</button>`;
    actions.prepend(editor);
    const input = editor.querySelector('input');
    const button = editor.querySelector('button');
    button.addEventListener('click', () => setExactBalance(input,button));
    input.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); setExactBalance(input,button); } });
    return true;
  }

  const style = document.createElement('style');
  style.id = 'adminCoinsEditorV1Styles';
  style.textContent = `.admin-coins-exact-v1{display:grid;grid-template-columns:minmax(150px,220px) auto;gap:8px;align-items:end;padding:10px;border:1px solid rgba(139,92,246,.17);border-radius:12px;background:rgba(139,92,246,.045);flex:1 1 100%}.admin-coins-exact-v1 label{display:grid;gap:4px}.admin-coins-exact-v1 label>span{font-size:9px;text-transform:uppercase;letter-spacing:.07em;color:var(--text-faint);font-weight:700}.admin-coins-exact-v1 input{min-height:37px!important}@media(max-width:520px){.admin-coins-exact-v1{grid-template-columns:1fr}.admin-coins-exact-v1 .button{width:100%}}`;
  document.head.appendChild(style);

  install();
  const observer = new MutationObserver(() => install());
  observer.observe(document.documentElement,{childList:true,subtree:true});
})();