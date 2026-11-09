/* Общее поведение: появление блоков при скролле и пословный выезд заголовков.
   Приёмы взяты из yudaev-landing-static (assets/js/main.js); сами анимации — в assets/css/motion.css.

   Как подключить блок к анимации:
     <section data-rv>                 — блок появляется, когда заходит в экран
     <div data-rv data-rv-cascade>     — дети блока появляются следом по очереди
     <h2 class="h2">…</h2>             — заголовок делится на слова, слова выезжают по одному
*/
(() => {
    'use strict';

    // при «уменьшить движение» страница статична: классы .rv / data-split не ставим вообще
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (!('IntersectionObserver' in window)) return;

    /* ---------- Заголовки .h2: делим на слова <span class="w" style="--w:N"><i>слово</i></span> ---------- */
    const splitWords = (root) => {
        let index = 0;

        const walk = (node) => {
            Array.from(node.childNodes).forEach((child) => {
                if (child.nodeType === Node.TEXT_NODE) {
                    const frag = document.createDocumentFragment();

                    // пробелы остаются обычными (перенос строк работает как раньше), неразрывные внутри слова не трогаем
                    child.textContent.split(/([ \n\t]+)/).forEach((part) => {
                        if (!part) return;
                        if (/^[ \n\t]+$/.test(part)) {
                            frag.append(part);
                            return;
                        }
                        const word = document.createElement('span');
                        const inner = document.createElement('i');
                        word.className = 'w';
                        word.style.setProperty('--w', index++);
                        inner.textContent = part;
                        word.append(inner);
                        frag.append(word);
                    });

                    child.replaceWith(frag);
                } else if (child.nodeType === Node.ELEMENT_NODE && child.tagName !== 'BR') {
                    walk(child);
                }
            });
        };

        walk(root);
        root.setAttribute('data-split', '');
    };

    const titleObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            entry.target.classList.add('is-in');
            titleObserver.unobserve(entry.target);
        });
    }, { rootMargin: '0px 0px -10% 0px' });

    document.querySelectorAll('.h2').forEach((title) => {
        splitWords(title);
        titleObserver.observe(title);
    });

    /* ---------- Появление блоков: .rv (скрыт) → .rv-in (когда блок виден) ----------
       Блоки, попавшие в экран одной пачкой, идут со сдвигом --rv-d (до 4 шагов), дети с data-rv-cascade — каскадом (.rv-c, --c). */
    const revealObserver = new IntersectionObserver((entries) => {
        entries
            .filter((entry) => entry.isIntersecting || entry.boundingClientRect.top < 0)
            .forEach((entry, order) => {
                entry.target.style.setProperty('--rv-d', Math.min(order, 4));
                entry.target.classList.add('rv-in');
                revealObserver.unobserve(entry.target);
            });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });

    document.querySelectorAll('[data-rv]').forEach((block) => {
        // у «растворённого» блока (display: contents) нет рамки — наблюдатель за ним не сработает, а его дети и так видны
        if (getComputedStyle(block).display === 'contents') return;
        block.classList.add('rv');
        if (block.hasAttribute('data-rv-cascade')) {
            Array.from(block.children).forEach((child, i) => {
                child.classList.add('rv-c');
                child.style.setProperty('--c', Math.min(i, 7));
            });
        }
        revealObserver.observe(block);
    });
})();
