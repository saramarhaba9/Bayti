import { auth, db } from '../firebase-config.js';
import { store } from '../store.js';
import { collection, doc, getDoc, setDoc, writeBatch, onSnapshot, serverTimestamp, Timestamp } from '../firebase-sdk.js';

// Membership is enforced by firestore.rules (no server needed). These batches are atomic.
const guard = (denied, fn) => async (...a) => {
  try { return await fn(...a); } catch (e) {
    if (e.code === 'permission-denied') throw new Error(denied);
    if (e.code === 'unavailable') throw new Error('تعذّر الاتصال بالإنترنت');
    throw e;
  }
};
const profileName = async (uid) => (await getDoc(doc(db, 'users', uid))).data()?.displayName ?? '';

export const createHousehold = guard('تعذّر إنشاء الأسرة. تأكد من نشر قواعد Firestore الأخيرة', async ({ name }) => {
  const { uid } = auth.currentUser;
  const hRef = doc(collection(db, 'households'));
  const batch = writeBatch(db);
  batch.set(hRef, { name, ownerId: uid, defaultWeekStart: 'sunday', createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  batch.set(doc(db, 'households', hRef.id, 'members', uid), { userId: uid, role: 'owner', displayName: await profileName(uid), joinedAt: serverTimestamp() });
  batch.update(doc(db, 'users', uid), { householdId: hRef.id });
  await batch.commit();
});

// Invite is bound to the invitee's email (document id). Owner only; valid 7 days.
export const createInvite = guard('تعذّر إنشاء الدعوة. المالك فقط يستطيع الدعوة، وقد توجد دعوة سابقة لهذا البريد من أسرة أخرى', async ({ email }) => {
  const { hid } = store.state;
  if (!hid) throw new Error('أنشئ أسرة أولًا');
  await setDoc(doc(db, 'invites', email), {
    householdId: hid, email, invitedBy: auth.currentUser.uid,
    createdAt: serverTimestamp(), expiresAt: Timestamp.fromMillis(Date.now() + 7 * 864e5),
  });
});

export const joinHousehold = guard('تعذّر الانضمام. فعّل بريدك ثم اضغط «تحققت من بريدي»، وتأكد أن بريدك مطابق للبريد المدعو', async () => {
  const user = auth.currentUser;
  const invRef = doc(db, 'invites', user.email.toLowerCase());
  const inv = await getDoc(invRef);
  if (!inv.exists()) throw new Error('لا توجد دعوة لهذا البريد');
  const { householdId, expiresAt } = inv.data();
  if (expiresAt.toMillis() < Date.now()) throw new Error('انتهت صلاحية الدعوة، اطلب دعوة جديدة');
  const batch = writeBatch(db);
  batch.set(doc(db, 'households', householdId, 'members', user.uid), { userId: user.uid, role: 'member', displayName: await profileName(user.uid), joinedAt: serverTimestamp() });
  batch.delete(invRef); // single use
  batch.update(doc(db, 'users', user.uid), { householdId });
  await batch.commit();
});

export const watchUserDoc = (uid, cb) =>
  onSnapshot(doc(db, 'users', uid), (s) => cb(s.data()?.householdId ?? null), () => cb(null));
