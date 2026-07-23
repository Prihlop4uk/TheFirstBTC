// Scroll reveal
const io = new IntersectionObserver((entries) => {
  entries.forEach((e) => {
    if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
  });
}, { threshold: 0.12 });
document.querySelectorAll('.reveal').forEach((el, i) => {
  el.style.transitionDelay = (Math.min(i % 4, 3) * 90) + 'ms';
  io.observe(el);
});

// Sticky header shadow
const header = document.getElementById('site-header');
const onScroll = () => {
  if (window.scrollY > 20) header.classList.add('shadow-lg', 'shadow-stone-900/5');
  else header.classList.remove('shadow-lg', 'shadow-stone-900/5');
};
window.addEventListener('scroll', onScroll); onScroll();

// Mobile menu
const burger = document.getElementById('burger');
const mobileMenu = document.getElementById('mobile-menu');
burger?.addEventListener('click', () => {
  const open = mobileMenu.classList.toggle('hidden') === false;
  burger.setAttribute('aria-expanded', String(open));
});
document.querySelectorAll('#mobile-menu a').forEach(a =>
  a.addEventListener('click', () => mobileMenu.classList.add('hidden'))
);

// Lead form
const form = document.getElementById('lead-form');
const toast = document.getElementById('toast');
const toastTitle = toast?.querySelector('[data-toast-title]');
const toastText = toast?.querySelector('[data-toast-text]');
function showToast(title, text, ok = true) {
  if (toastTitle) toastTitle.textContent = title;
  if (toastText) toastText.textContent = text;
  toast.classList.toggle('is-error', !ok);
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 4600);
}

form?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const submitBtn = form.querySelector('[data-testid="lead-submit"]');
  const name = form.querySelector('[name="name"]').value.trim();
  const contact = form.querySelector('[name="contact"]').value.trim();
  const age = form.querySelector('[name="age"]').value.trim();
  const website = form.querySelector('[name="website"]').value;
  if (!name || !contact) return;

  const original = submitBtn.textContent;
  submitBtn.disabled = true;
  submitBtn.textContent = 'Отправляем…';
  try {
    const res = await fetch('/api/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, contact, age, website }),
    });
    if (res.status === 429) {
      showToast('Слишком много заявок', 'Пожалуйста, попробуйте немного позже.', false);
      return;
    }
    if (!res.ok) throw new Error('bad status ' + res.status);
    const data = await res.json().catch(() => null);
    if (!data || !data._id) throw new Error('unexpected response');
    form.reset();
    showToast('Заявка отправлена!', 'Мы свяжемся с вами в ближайшее время.', true);
  } catch (err) {
    showToast('Не удалось отправить', 'Попробуйте ещё раз или напишите нам напрямую.', false);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = original;
  }
});

// Year
const y = document.getElementById('year');
if (y) y.textContent = new Date().getFullYear();
