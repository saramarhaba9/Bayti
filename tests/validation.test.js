import test from 'node:test';
import assert from 'node:assert/strict';
import { validatePassword, validateEmail, validateName } from '../js/validation.js';

test('password rules', () => {
  assert.throws(() => validatePassword('short1'));
  assert.throws(() => validatePassword('onlyletters'));
  assert.throws(() => validatePassword('12345678'));
  assert.doesNotThrow(() => validatePassword('abcd1234'));
});
test('email normalised, invalid rejected', () => {
  assert.equal(validateEmail('  A@B.com '), 'a@b.com');
  assert.throws(() => validateEmail('nope'));
});
test('name required and bounded', () => {
  assert.throws(() => validateName('   '));
  assert.throws(() => validateName('x'.repeat(61)));
  assert.equal(validateName(' سارة '), 'سارة');
});
