export function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) el.setAttribute(k, v === true ? '' : v);
  }
  el.append(...kids.flat(Infinity).filter((x) => x != null && x !== false));
  return el;
}
export const field = (label, el) => h('label', { class: 'field' }, h('span', {}, label), el);
export const select = (name, map, value) =>
  h('select', { name }, Object.entries(map).map(([k, v]) => h('option', { value: k, selected: k === value }, v)));

export function toast(msg, isError = false) {
  const t = document.getElementById('toast');
  t.textContent = (isError ? '⚠️ ' : '✅ ') + msg;
  t.className = isError ? 'show err' : 'show';
  clearTimeout(toast.t);
  toast.t = setTimeout(() => (t.className = ''), 3500);
}
export const safe = (fn) => async (...a) => { try { return await fn(...a); } catch (e) { toast(e.message, true); } };

export function modal(title, body, { onSubmit, submitLabel = 'حفظ', cancelLabel = 'إلغاء' } = {}) {
  const dlg = h('dialog', { 'aria-labelledby': 'dlg-t' });
  const form = h('form', {
    method: 'dialog',
    onsubmit: async (e) => {
      e.preventDefault();
      try { if (!onSubmit || (await onSubmit(new FormData(form))) !== false) dlg.close(); }
      catch (err) { toast(err.message, true); }
    },
  }, h('h2', { id: 'dlg-t' }, title), body,
  h('div', { class: 'row end' },
    h('button', { type: 'button', class: 'btn ghost', onclick: () => dlg.close() }, cancelLabel),
    onSubmit && h('button', { class: 'btn' }, submitLabel)));
  dlg.append(form);
  dlg.addEventListener('close', () => dlg.remove());
  document.body.append(dlg);
  dlg.showModal();
  return dlg;
}

export const confirmBox = (msg, label = 'حذف') => new Promise((res) => {
  let ok = false;
  const d = modal('تأكيد', h('p', {}, msg), { submitLabel: label, onSubmit: () => { ok = true; } });
  d.addEventListener('close', () => res(ok));
});
