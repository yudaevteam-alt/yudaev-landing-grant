/**
 * Заявки: поп-ап (#lead-modal) и форма на странице (форма «Займите место в очереди»).
 * Поп-ап открывается любой кнопкой с [data-lead-open], закрывается крестиком, Esc или кликом по затемнению.
 * Имя — от 2 символов, телефон — не меньше 10 цифр (формат не навязываем), согласие на обработку данных обязательно.
 *
 * Сервера у формы пока нет: после проверки показывается экран «Заявка отправлена» (в поп-апе) или сообщение под кнопкой (на странице).
 * Чтобы заявки уходили в CRM, достаточно отправить FormData в месте, отмеченном «TODO: отправка».
 */
(() => {
    'use strict';

    const modal = document.getElementById('lead-modal');
    const forms = [...document.querySelectorAll('[data-lead-form]')];

    const validate = (form) => {
        const phone = form.elements.phone;
        phone.setCustomValidity(phone.value.replace(/\D/g, '').length >= 10 ? '' : 'Введите номер телефона полностью');
        if (form.checkValidity()) return true;
        form.reportValidity();
        return false;
    };

    // ошибка телефона гаснет, как только поле начали править
    forms.forEach((form) => form.elements.phone?.addEventListener('input', () => form.elements.phone.setCustomValidity('')));

    const send = (form) => {
        const data = new FormData(form);
        // TODO: отправка — например, fetch('/api/lead', { method: 'POST', body: data })
        void data;
    };

    /* ---------- Форма на странице ---------- */
    forms.filter((form) => !modal?.contains(form)).forEach((form) => {
        const status = form.querySelector('.form-status');

        form.addEventListener('submit', (event) => {
            event.preventDefault();
            if (!validate(form)) return;
            send(form);
            form.reset();
            if (status) {
                status.textContent = 'Заявка отправлена. Менеджер свяжется с вами в ближайшее время.';
                status.classList.add('is-ok');
            }
        });
    });

    /* ---------- Поп-ап ---------- */
    if (!modal || typeof modal.showModal !== 'function') return;

    const form = modal.querySelector('[data-lead-form]');
    const done = modal.querySelector('[data-lead-done]');
    const doneTitle = modal.querySelector('[data-lead-done-title]');
    const title = modal.querySelector('#lead-title');
    let lastFocus = null;

    const open = () => {
        lastFocus = document.activeElement;
        modal.showModal();
        document.documentElement.style.overflow = 'hidden';
        title?.focus({ preventScroll: true });
    };

    document.querySelectorAll('[data-lead-open]').forEach((trigger) => {
        trigger.addEventListener('click', (event) => {
            event.preventDefault();
            open();
        });
    });

    modal.addEventListener('click', (event) => {
        // крестик, кнопка «Отлично» или клик по затемнению (сам <dialog> вне карточки)
        if (event.target === modal || (event.target instanceof Element && event.target.closest('[data-lead-close]'))) modal.close();
    });

    modal.addEventListener('close', () => {
        document.documentElement.style.overflow = '';
        if (lastFocus instanceof HTMLElement && lastFocus.isConnected) lastFocus.focus({ preventScroll: true });

        // следующий раз открываем чистую форму
        if (!done.hidden) {
            form.reset();
            done.hidden = true;
            form.hidden = false;
        }
    });

    form.addEventListener('submit', (event) => {
        event.preventDefault();
        if (!validate(form)) return;
        send(form);
        form.hidden = true;
        done.hidden = false;
        doneTitle?.focus({ preventScroll: true });
    });
})();
