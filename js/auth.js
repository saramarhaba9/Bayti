import { auth, db } from './firebase-config.js';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut as fbSignOut, onAuthStateChanged,
  sendEmailVerification, updateProfile, doc, setDoc, serverTimestamp } from './firebase-sdk.js';
import { validatePassword } from './validation.js';

const MSGS = {
  'auth/invalid-email': 'البريد الإلكتروني غير صالح',
  'auth/email-already-in-use': 'هذا البريد مسجّل بالفعل',
  'auth/weak-password': 'كلمة المرور ضعيفة',
  'auth/invalid-credential': 'البريد أو كلمة المرور غير صحيحة',
  'auth/wrong-password': 'البريد أو كلمة المرور غير صحيحة',
  'auth/user-not-found': 'البريد أو كلمة المرور غير صحيحة',
  'auth/too-many-requests': 'محاولات كثيرة، حاول لاحقًا',
  'auth/network-request-failed': 'تعذّر الاتصال بالإنترنت',
};
const wrap = (e) => new Error(MSGS[e.code] ?? 'حدث خطأ غير متوقع، حاول مرة أخرى');

export const onAuth = (cb) => onAuthStateChanged(auth, cb);

export async function signUp(email, password, displayName) {
  validatePassword(password);
  try {
    const { user } = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(user, { displayName });
    // householdId can only be null here; rules forbid clients from setting it (Cloud Functions do).
    await setDoc(doc(db, 'users', user.uid), { displayName, householdId: null, createdAt: serverTimestamp() });
    await sendEmailVerification(user);
  } catch (e) { throw wrap(e); }
}
export async function signIn(email, password) {
  try { await signInWithEmailAndPassword(auth, email, password); } catch (e) { throw wrap(e); }
}
export const signOut = () => fbSignOut(auth);
export async function refreshVerification() {
  await auth.currentUser.reload();
  await auth.currentUser.getIdToken(true); // refresh email_verified claim for the Cloud Function
  return auth.currentUser.emailVerified;
}
export const resendVerification = () => sendEmailVerification(auth.currentUser).catch((e) => { throw wrap(e); });
