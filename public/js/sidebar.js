/**
 * sidebar.js — Collapsible sidebar with icon-only mode
 * Persists state in localStorage. Requires .crm-sidebar + .crm-layout structure.
 */
(function () {
    const STORAGE_KEY = 'crm-sidebar-collapsed';

    // Inject collapse CSS
    const style = document.createElement('style');
    style.textContent = `
    /* Collapse toggle button */
    .sidebar-toggle-btn {
      position: absolute; top: 14px; right: -13px;
      width: 26px; height: 26px; border-radius: 50%;
      background: var(--bg-card); border: 1px solid var(--border);
      color: var(--text-3); display: flex; align-items: center; justify-content: center;
      cursor: pointer; z-index: 110; transition: all .2s;
      box-shadow: 0 2px 8px rgba(0,0,0,.3);
    }
    .sidebar-toggle-btn:hover { background: var(--accent); color: #fff; border-color: var(--accent); }
    .sidebar-toggle-btn svg { transition: transform .3s; }
    .crm-layout.sidebar-collapsed .sidebar-toggle-btn svg { transform: rotate(180deg); }

    /* Collapsed sidebar */
    .crm-layout.sidebar-collapsed .crm-sidebar {
      width: 64px;
    }
    .crm-layout.sidebar-collapsed .crm-sidebar .sidebar-logo-name,
    .crm-layout.sidebar-collapsed .crm-sidebar .sidebar-logo-sub,
    .crm-layout.sidebar-collapsed .crm-sidebar .sidebar-section-label,
    .crm-layout.sidebar-collapsed .crm-sidebar .sidebar-user-name,
    .crm-layout.sidebar-collapsed .crm-sidebar .sidebar-user-role,
    .crm-layout.sidebar-collapsed .crm-sidebar .sidebar-logout span,
    .crm-layout.sidebar-collapsed .crm-sidebar .nav-link-text {
      display: none;
    }
    .crm-layout.sidebar-collapsed .crm-sidebar .sidebar-logo {
      padding: 20px 14px 16px;
      justify-content: center;
    }
    .crm-layout.sidebar-collapsed .crm-sidebar .sidebar-nav a {
      justify-content: center;
      padding: 10px;
      position: relative;
    }
    .crm-layout.sidebar-collapsed .crm-sidebar .sidebar-nav a:hover::after {
      content: attr(data-tooltip);
      position: absolute; left: 70px; top: 50%;
      transform: translateY(-50%);
      background: var(--bg-card); border: 1px solid var(--border);
      color: var(--text); font-size: 12px; padding: 4px 10px;
      border-radius: 6px; white-space: nowrap; z-index: 200;
      pointer-events: none; box-shadow: var(--shadow);
    }
    .crm-layout.sidebar-collapsed .crm-sidebar .sidebar-user {
      justify-content: center; padding: 10px;
    }
    .crm-layout.sidebar-collapsed .crm-sidebar .sidebar-logout {
      padding: 10px; justify-content: center;
    }
    .crm-layout.sidebar-collapsed .crm-main {
      margin-left: 64px;
    }
    /* Transition for smooth collapse */
    .crm-sidebar { transition: width .25s; overflow: hidden; }
    .crm-main    { transition: margin-left .25s; }

    /* Notification badge */
    .nav-badge {
      margin-left: auto; min-width: 18px; height: 18px;
      background: var(--accent-err); color: #fff;
      border-radius: 99px; font-size: 10px; font-weight: 700;
      display: flex; align-items: center; justify-content: center;
      padding: 0 4px; flex-shrink: 0;
    }
    .crm-layout.sidebar-collapsed .nav-badge { display: none; }
  `;
    document.head.appendChild(style);

    document.addEventListener('DOMContentLoaded', () => {
        const sidebar = document.querySelector('.crm-sidebar');
        const layout = document.querySelector('.crm-layout');
        if (!sidebar || !layout) return;

        // Make sidebar position: relative so toggle btn can sit on edge
        sidebar.style.position = 'fixed';

        // Add wrapper for logo to be relative
        sidebar.style.position = 'fixed';

        // Add toggle button inside sidebar-logo area
        const toggleBtn = document.createElement('button');
        toggleBtn.className = 'sidebar-toggle-btn';
        toggleBtn.title = 'Colapsar / Expandir menú';
        toggleBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>`;
        sidebar.appendChild(toggleBtn);

        // Wrap nav link text in spans for collapse hiding
        sidebar.querySelectorAll('.sidebar-nav a').forEach(a => {
            // Add data-tooltip from text content
            const text = [...a.childNodes].find(n => n.nodeType === 3 && n.textContent.trim());
            if (text) {
                const tip = text.textContent.trim();
                a.setAttribute('data-tooltip', tip);
                const span = document.createElement('span');
                span.className = 'nav-link-text';
                span.textContent = tip;
                a.replaceChild(span, text);
            }
        });

        // Restore state
        const collapsed = localStorage.getItem(STORAGE_KEY) === '1';
        if (collapsed) layout.classList.add('sidebar-collapsed');

        toggleBtn.addEventListener('click', () => {
            layout.classList.toggle('sidebar-collapsed');
            localStorage.setItem(STORAGE_KEY, layout.classList.contains('sidebar-collapsed') ? '1' : '0');
        });
    });
})();
