const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');

module.exports = async function run(parseHTML) {
  const html = fs.readFileSync(path.join(__dirname, '../landing/index.html'), 'utf8');
  const source = fs.readFileSync(path.join(__dirname, '../landing-auth.js'), 'utf8');
  for (const protocol of ['http:', 'file:']) {
    const { window } = parseHTML(html);
    const document = window.document;
    vm.runInNewContext(source, { window, document, location: { protocol } });
    for (const [selector, destination] of [
      ['.nav-sign-in', '../auth/login.html'],
      ['.nav-join', '../auth/register.html'],
      ['.hero-primary', '../auth/register.html?role=client'],
      ['.hero-secondary', '../auth/register.html?role=freelancer'],
    ]) {
      const link = document.querySelector(selector);
      assert.equal(link.getAttribute('href'), destination);
      const click = new window.Event('click', { bubbles: true, cancelable: true });
      link.dispatchEvent(click);
      assert.equal(click.defaultPrevented, false, `${selector} allows normal navigation`);
    }
    assert.equal(document.querySelector('.landing-auth-dialog'), null);
    assert.equal(document.querySelector('iframe'), null);
  }
  return 'PASS: homepage sign-in and registration open directly without a loading popup';
};
