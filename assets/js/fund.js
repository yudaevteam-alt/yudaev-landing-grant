/* Остаток грантового фонда — у каждого посетителя своя динамика.

   Механика:
   1. При первом заходе генерируется стартовое значение (случайное, кратное размеру гранта: 10,2–10,8 млн ₽).
   2. Дальше остаток уменьшается шагом в один грант (−200 000 ₽), а интервал между шагами зависит от того, сколько уже «ушло»:
        первые −1 000 000 ₽ от стартового ........ каждые ~30 секунд
        от 9,2–9,8 млн ₽ и до 6 000 000 ₽ ........ каждые ~5 минут
        6 000 000 ₽ и ниже ....................... каждые ~30 минут
      Интервалы случайные (±17 % от номинала), чтобы убывание не выглядело механическим.
      Ниже 9 800 000 ₽ остаток не падает (floor). Из-за этого пола до «средней» и «медленной» фаз дело не доходит:
      от 10,2–10,8 млн до 9,8 млн остаётся 2–5 шагов, то есть 1–2,5 минуты. Если пол опустить, фазы заработают сами.
   3. Состояние {start, left, nextAt} лежит в localStorage. После перезагрузки и при повторном визите счёт продолжается
      с сохранённого значения; если шаг уже был «должен» случиться, пока страницы не было, он происходит через 3–8 секунд
      после открытия (без «догонялки»: деньги не уходят, пока посетителя нет).
   4. Пока вкладка в фоне, шаги не выполняются — откладываются.

   Разметка: [data-fund-sum] — сумма «10 600 000 ₽», [data-fund-grants] — число грантов, [data-fund-bar] — получает
   CSS-переменную --p (0…1, доля остатка от всего фонда).
   Для проверки: YSFund.reset() в консоли и перезагрузить страницу — получите новое стартовое значение. */
(function (root, factory) {
    'use strict';
    const api = factory();
    if (typeof module === 'object' && module.exports) {
        module.exports = api;          // Node: тесты логики
    } else {
        root.YSFund = api;
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', api.mount);
        else api.mount();
    }
})(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    const SEC = 1000;
    const MIN = 60 * SEC;

    const CONFIG = {
        total: 11_000_000,        // весь фонд, ₽
        grant: 200_000,           // размер одного гранта, ₽ (остаток всегда кратен ему)
        step: 200_000,            // на сколько падает остаток за один шаг, ₽
        startMin: 10_200_000,     // стартовое значение — случайное в этом диапазоне
        startMax: 10_800_000,
        floor: 9_800_000,         // ниже остаток не опускается (минимум по ТЗ — 9 800 000 ₽)
        fastDrop: 1_000_000,      // «быстрая» фаза длится, пока ушло меньше этой суммы
        slowBelow: 6_000_000,     // с этой суммы (включительно) и ниже — «медленная» фаза
        every: {                  // [мин, макс] интервал между шагами, мс
            fast: [25 * SEC, 35 * SEC],
            medium: [4 * MIN + 10 * SEC, 5 * MIN + 50 * SEC],
            slow: [25 * MIN, 35 * MIN],
        },
        overdueDelay: [3 * SEC, 8 * SEC],   // шаг, который «просрочился» без посетителя, случится через столько
        storageKey: 'ys-grant-fund-v1',
    };

    /* ---------- Логика (чистые функции: время и random передаются снаружи — удобно тестировать) ---------- */

    const randInt = (min, max, rand) => min + Math.floor(rand() * (max - min + 1));
    const inRange = ([lo, hi], rand) => Math.round(lo + rand() * (hi - lo));
    const isStep = (n) => Number.isInteger(n) && n % CONFIG.grant === 0;

    const pickStart = (rand) =>
        CONFIG.startMin + CONFIG.grant * randInt(0, (CONFIG.startMax - CONFIG.startMin) / CONFIG.grant, rand);

    const phaseOf = (state) => {
        if (state.start - state.left < CONFIG.fastDrop) return 'fast';
        return state.left > CONFIG.slowBelow ? 'medium' : 'slow';
    };

    const intervalMs = (state, rand) => inRange(CONFIG.every[phaseOf(state)], rand);

    const isValid = (s) =>
        !!s &&
        isStep(s.start) && s.start <= CONFIG.total && s.start >= CONFIG.floor &&
        isStep(s.left) && s.left <= s.start && s.left >= CONFIG.floor &&
        (s.nextAt === null || Number.isFinite(s.nextAt));

    /** Состояние при открытии страницы: сохранённое (если исправно) или новое. */
    const init = (saved, now, rand) => {
        if (!isValid(saved)) {
            const start = pickStart(rand);
            const state = { start, left: start, nextAt: null };
            state.nextAt = now + intervalMs(state, rand);
            return state;
        }
        const state = { start: saved.start, left: saved.left, nextAt: saved.nextAt };
        if (state.left <= CONFIG.floor) {
            state.nextAt = null;
        } else if (state.nextAt === null || state.nextAt < now) {
            state.nextAt = now + inRange(CONFIG.overdueDelay, rand);          // без «догонялки»
        } else {
            state.nextAt = Math.min(state.nextAt, now + CONFIG.every[phaseOf(state)][1]);   // защита от часов «из будущего»
        }
        return state;
    };

    /** Один шаг вниз. На полу счёт останавливается (nextAt = null). */
    const tick = (state, now, rand) => {
        const left = Math.max(CONFIG.floor, state.left - CONFIG.step);
        const next = { start: state.start, left, nextAt: null };
        if (left > CONFIG.floor) next.nextAt = now + intervalMs(next, rand);
        return next;
    };

    /* ---------- DOM ---------- */

    const mount = () => {
        const sumEls = [...document.querySelectorAll('[data-fund-sum]')];
        const grantEls = [...document.querySelectorAll('[data-fund-grants]')];
        const grantTextEls = [...document.querySelectorAll('[data-fund-grants-text]')];
        const flipEls = [...document.querySelectorAll('[data-fund-flip]')];
        const barEls = [...document.querySelectorAll('[data-fund-bar]')];
        if (!sumEls.length && !grantEls.length && !grantTextEls.length && !flipEls.length && !barEls.length) return;

        const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
        const money = new Intl.NumberFormat('ru-RU');

        const store = {
            read() {
                try { return JSON.parse(localStorage.getItem(CONFIG.storageKey)); } catch { return null; }
            },
            write(state) {
                try { localStorage.setItem(CONFIG.storageKey, JSON.stringify(state)); } catch { /* приватный режим: счёт идёт до перезагрузки */ }
            },
            clear() {
                try { localStorage.removeItem(CONFIG.storageKey); } catch { /* ничего */ }
            },
        };

        let state = init(store.read(), Date.now(), Math.random);
        store.write(state);

        let shown = state.left;
        let raf = 0;
        let timer = 0;

        const paint = (value) => {
            sumEls.forEach((el) => { el.textContent = `${money.format(value)} ₽`; });
            grantEls.forEach((el) => { el.textContent = String(Math.round(value / CONFIG.grant)); });
        };
        const paintBar = (value) => barEls.forEach((el) => el.style.setProperty('--p', (value / CONFIG.total).toFixed(4)));

        // «Остался 21 грант» / «Осталось 22 гранта» / «Осталось 25 грантов»
        const plural = (n, one, few, many) => {
            const m10 = n % 10;
            const m100 = n % 100;
            if (m10 === 1 && m100 !== 11) return one;
            return m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? few : many;
        };
        const grantsText = (n) =>
            `${plural(n, 'Остался', 'Осталось', 'Осталось')} ${n} ${plural(n, 'грант', 'гранта', 'грантов')} по ${money.format(CONFIG.grant)} ₽`;

        // Табло: цифры по группам по три справа налево + знак ₽. Ячейки, у которых цифра сменилась, получают .is-tick (анимация в motion.css).
        // Число ячеек и групп отдаём в CSS (--cells, --groups) — ширина ячейки считается там, чтобы 8 цифр помещались так же, как 7.
        const paintFlip = (value, animate) => {
            const digits = String(value);
            const groups = [];
            for (let end = digits.length; end > 0; end -= 3) groups.unshift(digits.slice(Math.max(0, end - 3), end));
            groups.push('₽');

            flipEls.forEach((el) => {
                const chars = groups.join('').split('');
                let cells = [...el.querySelectorAll('.flip__cell b')];

                if (cells.length !== chars.length) {
                    el.replaceChildren(...groups.map((group) => {
                        const wrap = document.createElement('span');
                        wrap.className = 'flip__group';
                        [...group].forEach((char) => {
                            const cell = document.createElement('span');
                            const b = document.createElement('b');
                            cell.className = 'flip__cell';
                            b.textContent = char;
                            cell.append(b);
                            wrap.append(cell);
                        });
                        return wrap;
                    }));
                    cells = [...el.querySelectorAll('.flip__cell b')];
                } else {
                    cells.forEach((b, i) => {
                        if (b.textContent === chars[i]) return;
                        b.textContent = chars[i];
                        if (!animate) return;
                        b.classList.remove('is-tick');
                        void b.offsetWidth;   // перезапуск анимации
                        b.classList.add('is-tick');
                    });
                }

                el.style.setProperty('--cells', String(chars.length));
                el.style.setProperty('--groups', String(groups.length));
                el.setAttribute('aria-label', `В фонде осталось ${money.format(value)} ₽`);
            });
        };

        // всё, что не «катится» цифрами: табло, подпись про гранты, полоса
        const paintStatic = (value, animate) => {
            paintFlip(value, animate);
            grantTextEls.forEach((el) => { el.textContent = grantsText(Math.round(value / CONFIG.grant)); });
            paintBar(value);
        };

        // сумма «скатывается» к новому значению (при «уменьшить движение» — меняется сразу)
        const animateTo = (target) => {
            cancelAnimationFrame(raf);
            paintStatic(target, !reduceMotion.matches);
            if (reduceMotion.matches || shown === target) {
                shown = target;
                paint(shown);
                return;
            }
            const from = shown;
            const start = performance.now();
            const duration = 900;
            const frame = (now) => {
                const k = Math.min(1, (now - start) / duration);
                shown = Math.round((from + (target - from) * (1 - (1 - k) ** 3)) / 1000) * 1000;   // ровные тысячи в пути
                if (k >= 1) shown = target;
                paint(shown);
                if (k < 1) raf = requestAnimationFrame(frame);
            };
            raf = requestAnimationFrame(frame);
        };

        const schedule = () => {
            clearTimeout(timer);
            if (state.nextAt === null) return;
            timer = setTimeout(() => {
                const now = Date.now();
                if (document.hidden) {
                    // вкладка в фоне — шаг откладываем
                    state = { ...state, nextAt: now + intervalMs(state, Math.random) };
                    store.write(state);
                } else {
                    state = tick(state, now, Math.random);
                    store.write(state);
                    animateTo(state.left);
                }
                schedule();
            }, Math.max(0, state.nextAt - Date.now()));
        };

        // вернулись на вкладку посреди анимации — сразу показываем актуальное значение
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) return;
            cancelAnimationFrame(raf);
            shown = state.left;
            paint(shown);
        });

        // другая вкладка того же посетителя сдвинула счёт — подхватываем, чтобы цифры не расходились
        window.addEventListener('storage', (event) => {
            if (event.key !== CONFIG.storageKey) return;
            const saved = store.read();
            if (!isValid(saved)) return;
            state = saved;
            animateTo(state.left);
            schedule();
        });

        paint(state.left);
        paintStatic(state.left, false);
        schedule();

        api.reset = () => { clearTimeout(timer); store.clear(); };
        api.state = () => ({ ...state });
    };

    const api = { CONFIG, pickStart, phaseOf, intervalMs, isValid, init, tick, mount };
    return api;
});
