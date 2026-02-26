/**
 * footer.js — Auto-injecting persistent footer for all authenticated pages
 * Reads /api/auth/me, renders footer with: logo+version | user photo+name+role | year
 */
(async () => {
    // Only inject if inside a .crm-layout (authenticated pages)
    const layout = document.querySelector('.crm-layout');
    if (!layout) return;

    // Inject CSS
    const style = document.createElement('style');
    style.textContent = `
    :root { --footer-h: 56px; }
    .crm-footer {
      position: fixed; bottom: 0; left: var(--sidebar-w, 240px); right: 0;
      height: var(--footer-h);
      background: var(--bg-card);
      border-top: 1px solid var(--border);
      display: flex; align-items: center; justify-content: space-between;
      padding: 0 24px; z-index: 80;
      transition: left .25s;
    }
    .crm-layout.sidebar-collapsed .crm-footer { left: 64px; }
    .crm-main { padding-bottom: var(--footer-h); }
    .footer-brand { display: flex; align-items: center; gap: 8px; }
    .footer-brand-icon {
      width: 26px; height: 26px; border-radius: 7px;
      background: linear-gradient(135deg, #4f8ef7, #a78bfa);
      display: flex; align-items: center; justify-content: center;
      font-weight: 800; font-size: 13px; color: #fff;
    }
    .footer-brand-name { font-weight: 700; font-size: 13px; color: var(--text); }
    .footer-brand-ver  { font-size: 10px; color: var(--text-3); margin-left: 4px; }
    .footer-user { display: flex; align-items: center; gap: 10px; }
    .footer-avatar {
      width: 30px; height: 30px; border-radius: 50%; overflow: hidden;
      background: linear-gradient(135deg, #4f8ef7, #a78bfa);
      display: flex; align-items: center; justify-content: center;
      font-weight: 700; font-size: 12px; color: #fff; flex-shrink: 0;
    }
    .footer-avatar img { width: 100%; height: 100%; object-fit: cover; }
    .footer-user-name  { font-weight: 600; font-size: 13px; color: var(--text); }
    .footer-user-role  { font-size: 11px; color: var(--text-3); }
    .footer-right      { font-size: 12px; color: var(--text-3); white-space: nowrap; }
    @media (max-width: 640px) {
      .footer-brand-name, .footer-brand-ver, .footer-user-name, .footer-user-role { display: none; }
    }
  `;
    document.head.appendChild(style);

    // Build footer DOM
    const footer = document.createElement('footer');
    footer.className = 'crm-footer';
    footer.id = 'crmFooter';
    footer.innerHTML = `
    <div class="footer-brand">
      <div class="footer-brand-icon">C</div>
      <span class="footer-brand-name">CRM System</span>
      <span class="footer-brand-ver">v2.0</span>
    </div>
    <div class="footer-user">
      <div class="footer-avatar" id="footerAvatar">?</div>
      <div>
        <div class="footer-user-name" id="footerName">—</div>
        <div class="footer-user-role" id="footerRole">—</div>
      </div>
    </div>
    <div class="footer-right">© ${new Date().getFullYear()} Todos los derechos reservados</div>
  `;
    document.body.appendChild(footer);

    // Populate user data (use cached window.__crmMe if already fetched by the page)
    try {
        const me = window.__crmMe || await fetch('/api/auth/me').then(r => r.json());
        if (!me.error) {
            window.__crmMe = me;
            document.getElementById('footerName').textContent = me.userName || '—';
            document.getElementById('footerRole').textContent = _roleLabel(me.roleName || me.userRole);

            const avatarEl = document.getElementById('footerAvatar');
            // Use photo if available (stored in me.photoUrl), else initials
            if (me.photoUrl) {
                avatarEl.innerHTML = `<img src="${me.photoUrl}" alt="${me.userName}">`;
            } else {
                const initials = (me.userName || 'U').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
                avatarEl.textContent = initials;
            }
        }
    } catch (_) { /* silent fail */ }
})();

function _roleLabel(role) {
    const labels = {
        super_admin: 'Super Administrador',
        admin_rrhh: 'Admin RRHH',
        instructor: 'Instructor',
        developer: 'Desarrollador',
        assistant: 'Asistente Administrativo',
        admin: 'Administrador',
        employee: 'Empleado',
    };
    return labels[role] || role || '—';
}
