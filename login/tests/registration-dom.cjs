const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.join(__dirname, '..');

module.exports = async function run(parseHTML) {
  const tick = () => new Promise(resolve => setTimeout(resolve, 0));
  function setup(file, api) {
    const { window } = parseHTML(fs.readFileSync(path.join(root, file), 'utf8'));
    const document = window.document;
    window.location = { search: '', href: '', pathname: '/' + file, hash: '' };
    for (const input of document.querySelectorAll('form, input')) input.reportValidity = () => true;
    const stored = {};
    const context = vm.createContext({
      window, document, location: window.location, URL, URLSearchParams, Date, Intl, console,
      Envisage: api, setInterval: () => 0, clearInterval() {},
      sessionStorage: { getItem: key => stored[key] || null, setItem: (key, value) => { stored[key] = value; }, removeItem: key => { delete stored[key]; } },
    });
    return { window, document, context, stored,
      run: file => vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context),
      set(id, value) {
        const input = document.getElementById(id);
        if (input.tagName === 'SELECT') Object.defineProperty(input, 'value', { value, writable: true, configurable: true });
        else input.value = value;
      },
    };
  }
  for (const role of ['client', 'freelancer']) {
    const calls = [];
    const page = setup('auth/register.html', {
      register: async request => { calls.push(request); return { email: request.email, needsConfirmation: true }; },
    });
    page.run('signup-flow.js');
    page.run('register.js');
    page.document.querySelector(`[data-role="${role}"]`).click();
    assert.equal(page.document.querySelector(`[data-role="${role}"]`).getAttribute('aria-pressed'), 'true');
    for (const [id, value] of Object.entries({ name: 'New user', 'register-email': 'new@example.com', 'register-password': 'Strong-password-123!', 'confirm-password': 'Mismatch' })) page.set(id, value);
    const form = page.document.querySelector('#register-form');
    form.dispatchEvent(new page.window.Event('submit', { cancelable: true }));
    await tick();
    assert.equal(calls.length, 0);
    assert.match(page.document.querySelector('#register-message').textContent, /do not match/);
    page.set('confirm-password', 'Strong-password-123!');
    form.dispatchEvent(new page.window.Event('submit', { cancelable: true }));
    await tick();
    assert.equal(calls.length, 1);
    assert.equal(calls[0].role, role);
    assert.equal(page.window.location.href, 'verify-email.html');
    assert.equal(page.document.querySelector('#register-password').value, '');
    assert.equal(page.stored.envisagePendingSignup, 'new@example.com');
    assert.ok(!JSON.stringify(page.stored).includes('Strong-password'));
    assert.ok(Number(page.stored.envisageSignupResendAt) > Date.now());
  }
  for (const role of ['client', 'freelancer']) {
    const calls = [];
    const profile = { id: role, role, name: 'New user', onboarding_complete: false };
    const api = { profile, saveProfile: async fields => { calls.push(fields); return { ...profile, ...fields }; }, home: row => row.role === 'client' ? 'discovery.html' : 'freelancer-profile.html' };
    const page = setup('auth/onboarding.html', api);
    page.run('marketplace.js');
    page.context.Marketplace = page.window.Marketplace;
    page.context.Marketplace.rows = async () => ['Photography','Videography','Editing','Content Creation'].map(name => ({name}));
    page.run('onboarding.js');
    await tick();
    if (role === 'client') {
      page.set('client-barangay', 'Pacita 1');
      assert.equal(page.document.querySelector('#service').disabled, true);
    } else {
      page.set('service', 'Photography');
      page.set('creative-location', 'Pacita 1, San Pedro, Laguna');
      assert.equal(page.document.querySelector('#client-name-confirm').disabled, true);
    }
    page.document.querySelector('#onboarding-form').dispatchEvent(new page.window.Event('submit', { cancelable: true }));
    await tick();
    assert.equal(calls.length, 1, `${role} profile saved`);
    assert.equal(calls[0].onboarding_complete, true);
    if (role === 'client') {
      assert.equal(calls[0].client_profile.barangay, 'Pacita 1');
      assert.equal(calls[0].client_profile.photoData, '');
      assert.equal(page.window.location.href, 'discovery.html');
    } else {
      assert.equal(calls[0].freelancer_setup.serviceArea, 'Pacita 1, San Pedro, Laguna');
      assert.equal(page.window.location.href, 'freelancer-profile.html');
    }
  }
  return 'PASS: both signup role buttons, password mismatch, confirmation screen, password clearing, both onboarding forms, and role-specific redirects';
};
