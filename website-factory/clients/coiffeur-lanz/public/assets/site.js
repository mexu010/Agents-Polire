(() => {
  document.documentElement.classList.add('js');
  const toggle = document.querySelector('.menu-toggle');
  const nav = document.querySelector('#main-nav');
  if (toggle && nav) {
    const close = () => {
      toggle.setAttribute('aria-expanded', 'false');
      nav.classList.remove('is-open');
    };
    toggle.addEventListener('click', () => {
      const open = toggle.getAttribute('aria-expanded') !== 'true';
      toggle.setAttribute('aria-expanded', String(open));
      nav.classList.toggle('is-open', open);
    });
    nav.addEventListener('click', event => { if (event.target.closest('a')) close(); });
    document.addEventListener('keydown', event => { if (event.key === 'Escape') close(); });
    const desktop = window.matchMedia('(min-width: 761px)');
    desktop.addEventListener('change', event => { if (event.matches) close(); });
  }

  if (navigator.doNotTrack !== '1' && navigator.globalPrivacyControl !== true) {
    fetch('/api/view', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: location.pathname, referrer: document.referrer }),
      credentials: 'same-origin', keepalive: true,
    }).catch(() => {});
  }

  const form = document.querySelector('#contact-form');
  if (!form) return;
  const status = document.querySelector('#contact-status');
  const submit = form.querySelector('[type="submit"]');
  const setStatus = (message, state = '') => {
    status.textContent = message;
    status.dataset.state = state;
  };
  const showFieldError = (name, message) => {
    const field = form.elements.namedItem(name);
    const element = form.querySelector(`[data-error-for="${name}"]`);
    if (element) element.textContent = message || '';
    if (field && field instanceof HTMLElement) {
      if (message) field.setAttribute('aria-invalid', 'true');
      else field.removeAttribute('aria-invalid');
    }
  };
  const clearErrors = () => ['name', 'email', 'phone', 'message', 'consent'].forEach(name => showFieldError(name, ''));
  const validate = () => {
    const name = form.elements.namedItem('name').value.trim();
    const email = form.elements.namedItem('email').value.trim();
    const message = form.elements.namedItem('message').value.trim();
    const consent = form.elements.namedItem('consent').checked;
    if (name.length < 2) showFieldError('name', 'Bitte geben Sie mindestens zwei Zeichen ein.');
    if (!email || !form.elements.namedItem('email').validity.valid) showFieldError('email', 'Bitte geben Sie eine gültige E-Mail-Adresse ein.');
    if (message.length < 10) showFieldError('message', 'Bitte schreiben Sie mindestens 10 Zeichen.');
    if (!consent) showFieldError('consent', 'Bitte stimmen Sie der Verarbeitung Ihrer Angaben zu.');
    return name.length >= 2 && email && form.elements.namedItem('email').validity.valid && message.length >= 10 && consent;
  };
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (submit.disabled) return;
    clearErrors();
    setStatus('');
    if (!validate()) {
      setStatus('Bitte prüfen Sie die markierten Angaben.', 'error');
      form.querySelector('[aria-invalid="true"]')?.focus();
      return;
    }
    const data = new FormData(form);
    const body = Object.fromEntries(data);
    body.consent = form.elements.namedItem('consent').checked;
    for (const key of ['name', 'email', 'phone', 'message']) body[key] = body[key].trim();
    submit.disabled = true;
    submit.textContent = 'Wird gesendet …';
    setStatus('Ihre Nachricht wird übertragen.');
    try {
      const response = await fetch(form.action, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin', body: JSON.stringify(body),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (result.fields && typeof result.fields === 'object') {
          for (const [name, error] of Object.entries(result.fields)) {
            if (['name', 'email', 'phone', 'message', 'consent'].includes(name)) showFieldError(name, String(error));
          }
        }
        setStatus(result.error || 'Ihre Nachricht konnte nicht gesendet werden. Bitte versuchen Sie es erneut oder rufen Sie an.', 'error');
        form.querySelector('[aria-invalid="true"]')?.focus();
        return;
      }
      const reference = result.reference ? ` Referenz: ${result.reference}.` : '';
      const text = result.delivery === 'review'
        ? `Ihre Testnachricht wurde im geschützten Posteingang gespeichert. Es wurde keine E-Mail versendet.${reference}`
        : `Vielen Dank. Ihre Anfrage ist eingegangen.${reference} Ein Termin ist erst nach unserer Bestätigung vereinbart.`;
      setStatus(text, 'success');
      form.reset();
      if (result.nextFormToken && result.formStartedAt) {
        form.elements.namedItem('formToken').value = result.nextFormToken;
        form.elements.namedItem('formStartedAt').value = String(result.formStartedAt);
      }
    } catch {
      setStatus('Die Verbindung ist unterbrochen. Bitte versuchen Sie es erneut oder rufen Sie an.', 'error');
    } finally {
      submit.disabled = false;
      submit.textContent = 'Nachricht senden';
    }
  });
})();
