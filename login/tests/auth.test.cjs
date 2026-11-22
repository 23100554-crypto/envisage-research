const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
function setup(role = 'client', options = {}) {
  const row = { id: 'real-user', name: 'Test', role, onboarding_complete: true };
  let signedOut = false;
  const calls = [];
  const storage = { envisageDemoAccounts: '[{"password":"old"}]', envisageRole: 'admin' };
  const db = {
    auth: {
      signUp: async (request) => {
        calls.push({ method: 'signUp', request });
        return { data: { user: { id: row.id, identities: options.duplicate ? [] : [{ provider: 'email' }] }, session: options.confirmed ? { user: { id: row.id } } : null }, error: options.signupError };
      },
      resend: async (request) => { calls.push({ method: 'resend', request }); return {}; },
      verifyOtp: async (request) => { calls.push({ method: 'verifyOtp', request }); return { data: { user: { email_confirmed_at: options.unverified ? null : '2026-10-02T00:00:00Z' } }, error: options.otpError }; },
      getUser: async () => ({ data: { user: options.noUser ? null : { id: row.id } } }),
      signInWithPassword: async () => ({ error: options.invalidPassword ? new Error('Invalid login credentials') : null }),
      signOut: async () => { signedOut = true; return {}; },
    },
    from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: row, error: options.profileError }) }) }) }),
  };
  const localStorage = Object.assign(storage, {});
  Object.defineProperties(localStorage, {
    getItem: { value: (key) => storage[key] ?? null },
    setItem: { value: (key, value) => { storage[key] = String(value); } },
    removeItem: { value: (key) => { delete storage[key]; } },
  });
  const window = { ENVISAGE_SUPABASE: options.unconfigured ? {} : { url: 'https://test.supabase.co', publishableKey: 'public-test' }, location: {} };
  const context = vm.createContext({ window, document: { currentScript: { src: 'https://example.com/login/backend.js' } }, URL, localStorage, alert() {}, fakeDb: db });
  const source = fs.readFileSync(path.join(__dirname, '../backend.js'), 'utf8')
    .replace("import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.102.0/+esm')", 'Promise.resolve({ createClient: (url, key, config) => { fakeDb.clientConfig = config; return fakeDb; } })');
  vm.runInContext(source, context);
  return { api: window.Envisage, storage, window, row, calls, db, signedOut: () => signedOut };
}
test('demo credentials and forged roles are cleared', () => {
  const { storage } = setup();
  assert.equal(storage.envisageDemoAccounts, undefined);
  assert.equal(storage.envisageRole, undefined);
});
for (const role of ['client', 'freelancer', 'admin']) {
  test(`${role} signs in using the verified profile role`, async () => {
    const { api, storage } = setup(role);
    const row = await api.signIn('user@example.com', 'test-password', role);
    assert.equal(row.role, role);
    assert.equal(storage.envisageUserId, 'real-user');
  });
}
test('client cannot sign in through Admin and session is discarded', async () => {
  const state = setup('client');
  await assert.rejects(state.api.signIn('a', 'b', 'admin'), /different role/);
  assert.equal(state.signedOut(), true);
  assert.equal(state.storage.envisageRole, undefined);
});
for (const [actual,selected] of [['freelancer','client'],['client','freelancer']]) {
  test(`${actual} cannot enter through ${selected} sign in`, async () => {
    const state=setup(actual);
    await assert.rejects(state.api.signIn('a','b',selected),/different role/);
    assert.equal(state.signedOut(),true);
    assert.equal(state.storage.envisageRole,undefined);
  });
}
test('omitted role defaults to client instead of accepting a freelancer',async()=>{
  const state=setup('freelancer');
  await assert.rejects(state.api.signIn('a','b'),/different role/);
  assert.equal(state.signedOut(),true);
});
test('bad password never creates cached identity', async () => {
  const { api, storage } = setup('client', { invalidPassword: true });
  await assert.rejects(api.signIn('a', 'wrong', 'client'), /Invalid login/);
  assert.equal(storage.envisageUserId, undefined);
});
test('missing configuration fails with setup guidance', async () => {
  await assert.rejects(setup('client', { unconfigured: true }).api.current(), /not configured/);
});
test('missing or revoked user cannot open workspace', async () => {
  await assert.rejects(setup('client', { noUser: true }).api.current(), /sign in/);
});
test('database profile failure never falls back to browser role', async () => {
  await assert.rejects(setup('client', { profileError: new Error('offline') }).api.signIn('a', 'b', 'client'), /profile could not/);
});
test('logout clears cached account and ends Supabase session', async () => {
  const state = setup();
  await state.api.current();
  await state.api.logout();
  assert.equal(state.signedOut(), true);
  assert.equal(state.storage.envisageUserId, undefined);
  assert.match(state.window.location.href, /auth\/login.html$/);
});

for (const role of ['client', 'freelancer']) {
  test(`${role} registration sends normalized email and selected role to Supabase`, async () => {
    const { api, calls, storage } = setup(role);
    const result = await api.register({ name: ' New User ', email: ' USER@EXAMPLE.COM ', password: 'Test-password-123!', role });
    assert.equal(calls[0].request.email, 'user@example.com');
    assert.equal(calls[0].request.options.data.name, 'New User');
    assert.equal(calls[0].request.options.data.role, role);
    assert.equal(result.needsConfirmation, true);
    assert.equal(result.profile, null);
    assert.equal(storage.envisageUserId, undefined);
  });
}
test('auto-confirmed signup is never treated as OTP verification', async () => {
  const state = setup('freelancer', { confirmed: true });
  await assert.rejects(state.api.register({name:'New User',email:'user@example.com',password:'Test-password-123!',role:'freelancer'}), /verification is not enabled/);
  assert.equal(state.signedOut(),true);
  assert.equal(state.storage.envisageUserId,undefined);
});

test('signup refuses admin roles and empty names before contacting Supabase', async () => {
  const { api, calls } = setup();
  await assert.rejects(api.register({ name: 'Test', email: 'user@example.com', password: 'Test-password-123!', role: 'admin' }), /Choose Client/);
  await assert.rejects(api.register({ name: '  ', email: 'user@example.com', password: 'Test-password-123!', role: 'client' }), /Enter your name/);
  assert.equal(calls.length, 0);
});
test('duplicate signup does not pretend a new account was created', async () => {
  const { api } = setup('client', { duplicate: true });
  await assert.rejects(api.register({ name: 'Test', email: 'user@example.com', password: 'Test-password-123!', role: 'client' }), /already be registered/);
});
test('verification and resend use the signup email flow', async () => {
  const { api, calls } = setup();
  await api.resendSignup(' USER@EXAMPLE.COM ');
  await api.confirmSignup(' USER@EXAMPLE.COM ', '123456');
  assert.equal(calls[0].request.type, 'signup');
  assert.equal(calls[0].request.email, 'user@example.com');
  assert.equal(calls[1].request.type, 'email');
  assert.equal(calls[1].request.token, '123456');
});
test('invalid confirmation codes never contact Supabase', async () => {
  const { api, calls } = setup();
  await assert.rejects(api.confirmSignup('user@example.com', 'abc'), /verification code/);
  assert.equal(calls.length, 0);
});
for (const accountStatus of ['Suspended', 'Deactivated']) {
  test(`${accountStatus} accounts cannot sign in or reuse a session`, async () => {
    const state = setup('client');
    state.row.account_status = accountStatus;
    await assert.rejects(state.api.current(), /suspended or deactivated/);
    await assert.rejects(state.api.signIn('a', 'b', 'client'), /suspended or deactivated/);
    assert.equal(state.signedOut(), true);
  });
}

test('OTP verification uses a nonpersistent session and never loads a workspace', async () => {
  const state = setup();
  const result = await state.api.confirmSignup('user@gmail.com','123456');
  assert.equal(result.verified,true);
  assert.equal(state.db.clientConfig.auth.persistSession,false);
  assert.equal(state.db.clientConfig.auth.autoRefreshToken,false);
  assert.equal(state.db.clientConfig.auth.detectSessionInUrl,false);
  assert.equal(state.signedOut(),true);
  assert.equal(state.storage.envisageUserId,undefined);
});
test('expired or unverified OTP responses cannot complete registration', async () => {
  await assert.rejects(setup('client',{otpError:new Error('Code expired')}).api.confirmSignup('user@gmail.com','123456'),/expired/);
  await assert.rejects(setup('client',{unverified:true}).api.confirmSignup('user@gmail.com','123456'),/did not finish/);
});
