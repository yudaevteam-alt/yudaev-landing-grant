/* Обратный отсчёт «До окончания акции».
   Разметка: [data-countdown="2026-11-11T23:59:59+03:00"] с дочерними [data-cd="d|h|m|s"] — цифры дней, часов, минут и секунд.
   Дата окончания — в атрибуте (с часовым поясом): акция до 11 ноября включительно, по Москве. После окончания показывает нули. */
(() => {
    'use strict';

    const pad = (n) => String(n).padStart(2, '0');

    document.querySelectorAll('[data-countdown]').forEach((root) => {
        const end = Date.parse(root.dataset.countdown);
        if (!Number.isFinite(end)) return;

        const cells = {
            d: root.querySelector('[data-cd="d"]'),
            h: root.querySelector('[data-cd="h"]'),
            m: root.querySelector('[data-cd="m"]'),
            s: root.querySelector('[data-cd="s"]'),
        };

        const render = () => {
            const left = Math.max(0, Math.floor((end - Date.now()) / 1000));
            const parts = { d: Math.floor(left / 86400), h: Math.floor(left / 3600) % 24, m: Math.floor(left / 60) % 60, s: left % 60 };
            Object.entries(cells).forEach(([key, cell]) => {
                if (!cell) return;
                const text = pad(parts[key]);
                if (cell.textContent !== text) cell.textContent = text;
            });
            return left > 0;
        };

        if (!render()) return;

        // тикаем раз в секунду; в фоне вкладка браузером притормаживается — при возврате цифры сразу актуальны
        const timer = setInterval(() => { if (!render()) clearInterval(timer); }, 1000);
        document.addEventListener('visibilitychange', () => { if (!document.hidden) render(); });
    });
})();
