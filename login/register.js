(() => {
  const form = document.querySelector('#register-form');
  const roles = [...document.querySelectorAll('.role')];
  const message = document.querySelector('#register-message');
  const flow = window.SignupFlow;
  let chosenRole = '', busy = false;
  function choose(role) {
    if (busy || !['client', 'freelancer'].includes(role)) return;
    chosenRole = role;
    roles.forEach(button => {
      const active = button.dataset.role === role;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    message.textContent = `Creating a ${role} account for San Pedro, Laguna.`;
  }
  roles.forEach(button => button.addEventListener('click', () => choose(button.dataset.role)));
  choose(new URLSearchParams(location.search).get('role'));
  if (flow.email()) { window.location.replace('verify-email.html'); return; }
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (busy || !form.reportValidity()) return;
    if (!chosenRole) { message.textContent = 'Choose Client or Freelancer first.'; roles[0].focus(); return; }
    const password = document.querySelector('#register-password').value;
    if (password !== document.querySelector('#confirm-password').value) { message.textContent = 'The passwords do not match.'; return; }
    const button = form.querySelector('[type="submit"]');
    busy = true;
    button.disabled = true;
    roles.forEach(role => { role.disabled = true; });
    message.textContent = 'Creating your account and requesting your verification code…';
    try {
      const result = await Envisage.register({name:document.querySelector('#name').value,email:document.querySelector('#register-email').value,password,role:chosenRole});
      document.querySelector('#register-password').value = '';
      document.querySelector('#confirm-password').value = '';
      flow.remember(result.email);
      flow.sent();
      window.location.href = 'verify-email.html';
    } catch (error) { message.textContent = flow.errorText(error); }
    finally { busy = false; button.disabled = false; roles.forEach(role => { role.disabled = false; }); }
  });
  document.querySelector('#show-confirmation')?.addEventListener('click', () => {
    if (busy) return;
    const input = document.querySelector('#register-email');
    if (!input.reportValidity()) return;
    flow.remember(input.value);
    window.location.href = 'verify-email.html';
  });
})();

