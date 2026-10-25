import { h, field, toast, safe } from './dom.js';
import { signUp, signIn, signOut, refreshVerification, resendVerification } from '../auth.js';
import { createHousehold, joinHousehold } from '../services/household-service.js';
import { validateEmail, validateName } from '../validation.js';

export function renderAuth(root, mode = 'in') {
  const up = mode === 'up';
  root.replaceChildren(h('form', {
    class: 'card',
    onsubmit: safe(async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const email = validateEmail(fd.get('email'));
      if (up) await signUp(email, fd.get('password'), validateName(fd.get('name')));
      else await signIn(email, fd.get('password'));
    }),
  },
  h('h1', {}, up ? 'إنشاء حساب' : 'تسجيل الدخول'),
  up && field('الاسم', h('input', { name: 'name', required: true, autocomplete: 'name' })),
  field('البريد الإلكتروني', h('input', { name: 'email', type: 'email', required: true, autocomplete: 'email' })),
  field('كلمة المرور', h('input', { name: 'password', type: 'password', required: true, minlength: '8', autocomplete: up ? 'new-password' : 'current-password' })),
  h('div', { class: 'row' },
    h('button', { class: 'btn' }, up ? 'إنشاء الحساب' : 'دخول'),
    h('button', { type: 'button', class: 'btn ghost', onclick: () => renderAuth(root, up ? 'in' : 'up') }, up ? 'لدي حساب' : 'حساب جديد'))));
}

export function renderGate(root, user) {
  root.replaceChildren(
    h('h1', {}, 'مرحبًا في بيتي'),
    h('div', { class: 'card' }, h('h2', {}, 'إنشاء أسرة جديدة'),
      h('form', { onsubmit: safe(async (e) => { e.preventDefault(); await createHousehold({ name: validateName(new FormData(e.target).get('name'), 'اسم الأسرة') }); }) },
        field('اسم الأسرة', h('input', { name: 'name', required: true })), h('button', { class: 'btn' }, 'إنشاء'))),
    h('div', { class: 'card' }, h('h2', {}, 'الانضمام عبر دعوة'),
      h('p', { class: 'muted' }, 'يجب أن يدعو مالك الأسرة بريدك ', h('bdi', {}, user.email), ' وأن يكون بريدك مفعّلًا.'),
      h('div', { class: 'row' },
        h('button', { class: 'btn soft', onclick: safe(async () => { const ok = await refreshVerification(); toast(ok ? 'البريد مفعّل' : 'البريد غير مفعّل بعد', !ok); }) }, 'تحققت من بريدي'),
        h('button', { class: 'btn soft', onclick: safe(async () => { await resendVerification(); toast('أُرسلت رسالة التحقق'); }) }, 'إعادة إرسال التحقق'),
        h('button', { class: 'btn', onclick: safe(joinHousehold) }, 'انضمام'))),
    h('button', { class: 'btn ghost', onclick: safe(signOut) }, 'تسجيل الخروج'));
}
