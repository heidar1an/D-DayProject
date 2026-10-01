/*
 * تست سیاست credential مدیر — فاز ۹.
 *
 * چه اثبات می‌کند: در production، نبودِ رمز صریح **خطا** می‌دهد (نه fallback)،
 * رمز ضعیف شناخته‌شده رد می‌شود، و مسیر seed محلی توسعه باز می‌ماند.
 *
 * اجرا: node --test database/adminCredentialPolicy.test.mjs
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  FORBIDDEN_PRODUCTION_PASSWORDS,
  MIN_PRODUCTION_PASSWORD_LENGTH,
  assertAdminCredentialUsable,
  isProduction,
  resolveAdminCredential,
} from './adminCredentialPolicy.js';

test('isProduction فقط با NODE_ENV=production', () => {
  assert.equal(isProduction({ NODE_ENV: 'production' }), true);
  assert.equal(isProduction({ NODE_ENV: 'PRODUCTION' }), true);
  assert.equal(isProduction({ NODE_ENV: 'development' }), false);
  assert.equal(isProduction({}), false);
});

test('production بدون TAPESH_ADMIN_PASSWORD ⇒ refuse (بدون fallback)', () => {
  const decision = resolveAdminCredential({ NODE_ENV: 'production' });
  assert.equal(decision.action, 'refuse');
  assert.equal(decision.password, null, 'هیچ رمزی نباید تولید شود');
});

test('production با رمز ضعیف شناخته‌شده ⇒ refuse', () => {
  for (const weak of FORBIDDEN_PRODUCTION_PASSWORDS) {
    const decision = resolveAdminCredential({ NODE_ENV: 'production', TAPESH_ADMIN_PASSWORD: weak });
    assert.equal(decision.action, 'refuse', `رمز «${weak}» باید در production رد شود`);
  }
});

test('production با رمز کوتاه ⇒ refuse', () => {
  const short = 'a'.repeat(MIN_PRODUCTION_PASSWORD_LENGTH - 1);
  assert.equal(resolveAdminCredential({ NODE_ENV: 'production', TAPESH_ADMIN_PASSWORD: short }).action, 'refuse');
});

test('production با رمز قوی ⇒ seed و بدون اجبار تغییر', () => {
  const decision = resolveAdminCredential({ NODE_ENV: 'production', TAPESH_ADMIN_PASSWORD: 'Str0ng-Passphrase-2026' });
  assert.equal(decision.action, 'seed');
  assert.equal(decision.password, 'Str0ng-Passphrase-2026');
  assert.equal(decision.mustChangePassword, false);
});

test('توسعه بدون رمز ⇒ seed محلی پرچم‌دار', () => {
  const decision = resolveAdminCredential({ NODE_ENV: 'development' });
  assert.equal(decision.action, 'seed');
  assert.equal(decision.mustChangePassword, true);
  assert.ok(decision.password);
});

test('assertAdminCredentialUsable در production خطا با کد مشخص می‌دهد', () => {
  assert.throws(
    () => assertAdminCredentialUsable({ NODE_ENV: 'production' }),
    (error) => error.code === 'ADMIN_CREDENTIAL_REQUIRED',
  );
});

test('assertAdminCredentialUsable در توسعه برمی‌گرداند، نه خطا', () => {
  const decision = assertAdminCredentialUsable({ NODE_ENV: 'development' });
  assert.equal(decision.action, 'seed');
});

test('رمز حاوی فاصلهٔ اضافی trim می‌شود (اشتباه رایج .env)', () => {
  const decision = resolveAdminCredential({ NODE_ENV: 'production', TAPESH_ADMIN_PASSWORD: '  Str0ng-Passphrase-2026  ' });
  assert.equal(decision.password, 'Str0ng-Passphrase-2026');
});
