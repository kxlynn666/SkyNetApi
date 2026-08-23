(() => {
  const PATH = '/painel/brat';
  const cleanPath = () => location.pathname.replace(/\/+$/, '') || '/';

  const install = () => {
    const sidebar = document.getElementById('workspaceSidebar');
    if (!sidebar || sidebar.querySelector(`a[href="${PATH}"]`)) return false;

    const groups = [...sidebar.querySelectorAll('.workspace-nav-group')];
    const creation = groups.find(group => group.querySelector('.workspace-nav-label')?.textContent?.trim() === 'Criação');
    if (!creation) return false;

    const link = document.createElement('a');
    link.className = `workspace-nav-link ${cleanPath() === PATH ? 'active' : ''}`;
    link.href = PATH;
    link.innerHTML = '<span class="workspace-nav-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 9h10M7 15h10"/></svg></span><span>Brat Generator</span>';
    creation.appendChild(link);
    return true;
  };

  if (install()) return;
  const observer = new MutationObserver(() => {
    if (install()) observer.disconnect();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  setTimeout(() => observer.disconnect(), 12000);
})();
