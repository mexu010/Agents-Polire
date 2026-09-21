/* global document */
document.querySelectorAll('[data-filter]').forEach(button => button.addEventListener('click', () => {
  document.querySelectorAll('[data-filter]').forEach(other => other.setAttribute('aria-pressed', String(other === button)));
  const filter = button.dataset.filter;
  let count = 0;
  document.querySelectorAll('[data-family]').forEach(card => { card.hidden = filter !== 'all' && card.dataset.family !== filter; if (!card.hidden) count += 1; });
  document.querySelector('[data-count]').textContent = `${count} Entwürfe sichtbar`;
}));
