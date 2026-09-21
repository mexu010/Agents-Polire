/* global document */
const dialog = document.querySelector('.polire-dialog');
document.querySelectorAll('[data-demo-contact]').forEach(button => button.addEventListener('click', () => dialog.showModal()));
document.querySelector('[data-close-demo]')?.addEventListener('click', () => dialog.close());
dialog?.addEventListener('click', event => { if (event.target === dialog) { const rect = dialog.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close(); } });
document.querySelectorAll('[data-menu-toggle]').forEach(button => {
  const nav = document.getElementById(button.getAttribute('aria-controls') ?? 'site-nav');
  if (!nav) return;
  button.addEventListener('click', () => { const open = button.getAttribute('aria-expanded') !== 'true'; button.setAttribute('aria-expanded', String(open)); nav.classList.toggle('open', open); });
  nav.querySelectorAll('a').forEach(link => link.addEventListener('click', () => { nav.classList.remove('open'); button.setAttribute('aria-expanded', 'false'); }));
});
