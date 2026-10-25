import { h, field, toast, safe } from './dom.js';
import { auth } from '../firebase-config.js';
import { signOut } from '../auth.js';
import { createInvite } from '../services/household-service.js';
import { validateEmail } from '../validation.js';

export function renderHousehold(root, { members, uid }) {
  const owner = members.find((m) => m.userId === uid)?.role === 'owner';
  root.replaceChildren(
    h('h1', {}, 'الأسرة'),
    h('div', { class: 'card' }, h('h2', {}, 'الأعضاء'),
      h('ul', {}, members.map((m) => h('li', {}, `${m.displayName} — ${m.role === 'owner' ? 'مالك' : 'عضو'}`)))),
    owner && h('form', {
      class: 'card',
      onsubmit: safe(async (e) => {
        e.preventDefault();
        await createInvite({ email: validateEmail(new FormData(e.target).get('email')) });
        e.target.reset();
        toast('تم إنشاء الدعوة. يسجّل العضو الآخر بهذا البريد ويفعّله ثم يضغط «انضمام»');
      }),
    }, h('h2', {}, 'دعوة عضو'), field('بريد العضو الآخر', h('input', { name: 'email', type: 'email', required: true })), h('button', { class: 'btn' }, 'إرسال الدعوة')),
    h('div', { class: 'card' }, h('h2', {}, 'الحساب'), h('p', { class: 'muted' }, h('bdi', {}, auth.currentUser?.email ?? '')),
      h('button', { class: 'btn danger', onclick: safe(signOut) }, 'تسجيل الخروج')));
}
