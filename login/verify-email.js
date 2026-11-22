(() => {
  const flow = window.SignupFlow, email = flow.email();
  const step = document.querySelector('#verification-step');
  const form = document.querySelector('#verification-form');
  const code = document.querySelector('#verification-code');
  const message = document.querySelector('#verification-message');
  const resend = document.querySelector('#resend-code');
  const verify = document.querySelector('#verify-button');
  const change = document.querySelector('#change-email');
  let busy = false, complete = false;
  if (!email) {
    step.hidden = true;
    document.querySelector('#verification-missing').hidden = false;
    return;
  }
  document.querySelector('#verification-email').textContent = email;
  function updateButtons() {
    const seconds = Math.max(0, Math.ceil((flow.resendAt() - Date.now()) / 1000));
    resend.disabled = busy || complete || seconds > 0;
    resend.textContent = seconds ? `Resend OTP in ${seconds}s` : 'Resend OTP';
    verify.disabled = busy || complete;
    change.disabled = busy || complete;
  }
  updateButtons();
  const interval = setInterval(updateButtons, 1000);
  window.addEventListener('pagehide', () => clearInterval(interval), {once:true});
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (busy || complete || !form.reportValidity()) return;
    if (!/^\d{6,10}$/.test(code.value.trim())) { message.textContent = 'Enter the numeric code from your email.'; return; }
    busy = true;
    updateButtons();
    message.textContent = 'Verifying your email…';
    try {
      await Envisage.confirmSignup(email,code.value.trim());
      complete = true;
      flow.clear();
      code.value = '';
      step.hidden = true;
      document.querySelector('#verification-success').hidden = false;
      document.querySelector('#success-title').focus();
      clearInterval(interval);
    } catch (error) { message.textContent = flow.errorText(error); }
    finally { busy = false; updateButtons(); }
  });
  resend.addEventListener('click', async () => {
    if (busy || complete || Date.now() < flow.resendAt()) return;
    busy = true;
    updateButtons();
    message.textContent = 'Requesting a new code…';
    try {
      await Envisage.resendSignup(email);
      flow.sent();
      code.value = '';
      message.textContent = 'A new code was requested. Check your inbox and Spam folder.';
    } catch (error) { message.textContent = flow.errorText(error); }
    finally { busy = false; updateButtons(); }
  });
  change.addEventListener('click', () => {
    if (busy) return;
    flow.clear();
    window.location.href = 'register.html';
  });
})();
