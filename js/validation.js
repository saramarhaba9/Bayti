export function validatePassword(p) {
  if (typeof p !== 'string' || p.length < 8) throw new Error('كلمة المرور يجب ألا تقل عن 8 أحرف');
  if (!/[A-Za-z\u0600-\u06FF]/.test(p) || !/\d/.test(p)) throw new Error('كلمة المرور يجب أن تحتوي على حروف وأرقام');
}
export function validateEmail(e) {
  const v = (e ?? '').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) throw new Error('البريد الإلكتروني غير صالح');
  return v.toLowerCase();
}
export function validateName(n, label = 'الاسم') {
  const v = (n ?? '').trim();
  if (!v) throw new Error(`${label} مطلوب`);
  if (v.length > 60) throw new Error(`${label} طويل جدًا`);
  return v;
}
