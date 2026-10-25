// Run with: npm run test:rules  (needs Java + Firebase Emulator Suite)
import { readFileSync } from 'node:fs';
import { before, after, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs, writeBatch, Timestamp } from 'firebase/firestore';

let env;
before(async () => { env = await initializeTestEnvironment({ projectId: 'demo-bayti', firestore: { rules: readFileSync('firestore.rules', 'utf8') } }); });
after(() => env.cleanup());

const ts = (ms) => Timestamp.fromMillis(Date.now() + ms);
const invite = (email, hid, by, ms = 864e5) => ({ householdId: hid, email, invitedBy: by, createdAt: ts(0), expiresAt: ts(ms) });
const as = (uid, email) => env.authenticatedContext(uid, email ? { email, email_verified: true } : {}).firestore();
const unverified = (uid, email) => env.authenticatedContext(uid, { email, email_verified: false }).firestore();
const anon = () => env.unauthenticatedContext().firestore();
const meal = (o = {}) => ({ recipeName: 'A', date: '2026-10-25', mealType: 'dinner', servings: 4, ingredientsSnapshot: [], ...o });
const joinBatch = (db, uid, hid, email, role = 'member') => {
  const b = writeBatch(db);
  b.set(doc(db, `households/${hid}/members/${uid}`), { userId: uid, role, displayName: 'N', joinedAt: ts(0) });
  b.delete(doc(db, `invites/${email}`));
  b.update(doc(db, `users/${uid}`), { householdId: hid });
  return b.commit();
};

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'households/h1'), { name: 'A', ownerId: 'alice' });
    await setDoc(doc(db, 'households/h1/members/alice'), { userId: 'alice', role: 'owner' });
    await setDoc(doc(db, 'households/h1/members/bob'), { userId: 'bob', role: 'member' });
    await setDoc(doc(db, 'households/h2'), { name: 'B', ownerId: 'carol' });
    await setDoc(doc(db, 'households/h2/members/carol'), { userId: 'carol', role: 'owner' });
    await setDoc(doc(db, 'households/h1/weeks/w1/shoppingItems/s1'), { name: 'x', purchased: false, requiredQuantity: 1 });
    await setDoc(doc(db, 'households/h1/weeks/w1/shoppingItems/s2'), { name: 'y', purchased: false, requiredQuantity: 2 });
    for (const u of ['bob', 'alice']) await setDoc(doc(db, `users/${u}`), { displayName: u, householdId: 'h1' });
    for (const u of ['erin', 'mal', 'gina', 'dave']) await setDoc(doc(db, `users/${u}`), { displayName: u, householdId: null });
    await setDoc(doc(db, 'invites/erin@x.com'), invite('erin@x.com', 'h1', 'alice'));
    await setDoc(doc(db, 'invites/gina@x.com'), invite('gina@x.com', 'h1', 'alice', -1000));
  });
});

test('15 cross-household and anonymous access is denied', async () => {
  await assertSucceeds(getDocs(collection(as('alice'), 'households/h1/recipes')));
  await assertFails(getDocs(collection(as('carol'), 'households/h1/recipes')));
  await assertFails(getDocs(collection(anon(), 'households/h1/recipes')));
  await assertFails(setDoc(doc(as('carol'), 'households/h1/ingredients/i1'), { name: 'x' }));
  await assertFails(setDoc(doc(as('alice'), 'households/h2/ingredients/i1'), { name: 'x' }));
});

test('16 roles, ownership and membership cannot be self-assigned', async () => {
  await assertFails(updateDoc(doc(as('bob'), 'households/h1/members/bob'), { role: 'owner' }));
  await assertFails(updateDoc(doc(as('alice'), 'households/h1'), { ownerId: 'bob' }));
  await assertFails(deleteDoc(doc(as('bob'), 'households/h1/members/alice')));
  await assertFails(updateDoc(doc(as('bob'), 'users/bob'), { householdId: 'h2' }));
  await assertFails(setDoc(doc(as('carol'), 'households/h1/members/carol'), { userId: 'carol', role: 'member', displayName: 'c', joinedAt: ts(0) }));
  await assertFails(setDoc(doc(as('carol'), 'households/h1/members/carol'), { userId: 'carol', role: 'owner', displayName: 'c', joinedAt: ts(0) }));
  await assertFails(setDoc(doc(as('zed'), 'users/zed'), { displayName: 'Z', householdId: 'h1', createdAt: ts(0) }));
});

test('household creation makes the creator the owner (atomic batch)', async () => {
  const db = as('dave');
  const b = writeBatch(db);
  b.set(doc(db, 'households/h3'), { name: 'D', ownerId: 'dave', defaultWeekStart: 'sunday', createdAt: ts(0), updatedAt: ts(0) });
  b.set(doc(db, 'households/h3/members/dave'), { userId: 'dave', role: 'owner', displayName: 'd', joinedAt: ts(0) });
  b.update(doc(db, 'users/dave'), { householdId: 'h3' });
  await assertSucceeds(b.commit());
  const bad = writeBatch(db);
  bad.set(doc(db, 'households/h4'), { name: 'D', ownerId: 'alice', defaultWeekStart: 'sunday', createdAt: ts(0), updatedAt: ts(0) });
  await assertFails(bad.commit());
});

test('invites: only the household owner, bound to one email', async () => {
  await assertSucceeds(setDoc(doc(as('alice'), 'invites/new@x.com'), invite('new@x.com', 'h1', 'alice')));
  await assertFails(setDoc(doc(as('bob'), 'invites/b@x.com'), invite('b@x.com', 'h1', 'bob')));
  await assertFails(setDoc(doc(as('carol'), 'invites/c@x.com'), invite('c@x.com', 'h1', 'carol')));
  await assertFails(setDoc(doc(as('alice'), 'invites/other@x.com'), invite('new@x.com', 'h1', 'alice')));
  await assertFails(setDoc(doc(as('carol'), 'invites/erin@x.com'), invite('erin@x.com', 'h2', 'carol'))); // can't hijack alice's invite
});

test('join: verified invited email succeeds; everything else fails', async () => {
  await assertFails(joinBatch(unverified('erin', 'erin@x.com'), 'erin', 'h1', 'erin@x.com'));
  await assertFails(joinBatch(as('mal', 'mal@x.com'), 'mal', 'h1', 'mal@x.com'));            // no invite
  await assertFails(joinBatch(as('gina', 'gina@x.com'), 'gina', 'h1', 'gina@x.com'));        // expired
  await assertFails(joinBatch(as('erin', 'erin@x.com'), 'erin', 'h2', 'erin@x.com'));        // invite is for h1, not h2
  await assertFails(joinBatch(as('erin', 'erin@x.com'), 'erin', 'h1', 'erin@x.com', 'owner')); // no owner escalation
  await assertSucceeds(joinBatch(as('erin', 'erin@x.com'), 'erin', 'h1', 'erin@x.com'));
  await assertSucceeds(getDocs(collection(as('erin'), 'households/h1/recipes')));
  await assertFails(getDoc(doc(as('erin', 'erin@x.com'), 'invites/erin@x.com')));            // invite is single use
});

test('17 concurrent edits to different shopping items are both preserved', async () => {
  await Promise.all([
    assertSucceeds(updateDoc(doc(as('alice'), 'households/h1/weeks/w1/shoppingItems/s1'), { purchased: true })),
    assertSucceeds(updateDoc(doc(as('bob'), 'households/h1/weeks/w1/shoppingItems/s2'), { requiredQuantity: 5 })),
  ]);
  const a = (await getDoc(doc(as('alice'), 'households/h1/weeks/w1/shoppingItems/s1'))).data();
  const b = (await getDoc(doc(as('alice'), 'households/h1/weeks/w1/shoppingItems/s2'))).data();
  assert.deepEqual([a.purchased, a.requiredQuantity, b.purchased, b.requiredQuantity], [true, 1, false, 5]);
});

test('field validation on meals and recipes', async () => {
  const m = (id, d) => setDoc(doc(as('bob'), `households/h1/weeks/w1/meals/${id}`), d);
  await assertSucceeds(m('ok', meal()));
  await assertFails(m('z', meal({ servings: 0 })));
  await assertFails(m('d', meal({ date: '25/10/2026' })));
  await assertFails(m('t', meal({ mealType: 'brunch' })));
  await assertFails(setDoc(doc(as('bob'), 'households/h1/recipes/r'), { name: '', defaultServings: 4, ingredients: [], instructions: [] }));
  await assertSucceeds(setDoc(doc(as('bob'), 'households/h1/recipes/r'), { name: 'ok', defaultServings: 4, ingredients: [], instructions: [] }));
});
