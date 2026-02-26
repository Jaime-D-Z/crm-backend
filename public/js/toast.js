/**
 * Toast Notification System
 * Usage: showToast('Mensaje', 'success' | 'error' | 'warning' | 'info', durationMs)
 */
(function () {
    let container = null;

    function getContainer() {
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            container.style.cssText = `
        position: fixed; top: 20px; right: 20px; z-index: 99999;
        display: flex; flex-direction: column; gap: 10px;
        pointer-events: none; max-width: 360px;
      `;
            document.body.appendChild(container);
        }
        return container;
    }

    const icons = {
        success: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>`,
        error: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
        warning: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
        info: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
    };

    const colors = {
        success: { bg: '#0f6b3e', border: '#22c55e', icon: '#4ade80', text: '#dcfce7' },
        error: { bg: '#6b0f1a', border: '#ef4444', icon: '#f87171', text: '#fee2e2' },
        warning: { bg: '#6b4e0f', border: '#f59e0b', icon: '#fbbf24', text: '#fef3c7' },
        info: { bg: '#0f3b6b', border: '#3b82f6', icon: '#60a5fa', text: '#dbeafe' },
    };

    window.showToast = function (message, type = 'info', duration = 4000) {
        const c = getContainer();
        const col = colors[type] || colors.info;

        const toast = document.createElement('div');
        toast.style.cssText = `
      display: flex; align-items: flex-start; gap: 12px;
      padding: 14px 16px; border-radius: 12px;
      background: ${col.bg}; border: 1px solid ${col.border};
      box-shadow: 0 8px 32px rgba(0,0,0,.4);
      pointer-events: all; cursor: pointer;
      transform: translateX(120%); transition: transform .35s cubic-bezier(.34,1.56,.64,1);
      color: ${col.text}; font-family: inherit; font-size: 14px; line-height: 1.4;
      min-width: 260px;
    `;

        toast.innerHTML = `
      <span style="color:${col.icon};flex-shrink:0;margin-top:1px">${icons[type] || icons.info}</span>
      <span style="flex:1">${message}</span>
      <button onclick="this.parentElement.remove()" style="background:none;border:none;color:${col.icon};cursor:pointer;padding:0;line-height:1;font-size:18px;flex-shrink:0;opacity:.7">×</button>
    `;

        c.appendChild(toast);
        requestAnimationFrame(() => {
            requestAnimationFrame(() => { toast.style.transform = 'translateX(0)'; });
        });

        const timer = setTimeout(() => remove(toast), duration);
        toast.addEventListener('click', () => { clearTimeout(timer); remove(toast); });

        function remove(el) {
            el.style.transform = 'translateX(120%)';
            el.style.opacity = '0';
            setTimeout(() => el.remove(), 350);
        }
    };
})();
