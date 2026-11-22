const adminLoginForm = document.querySelector('#admin-login-form');
const adminLoginMessage = document.querySelector('#admin-login-message');
const adminPassword=document.querySelector('#admin-password'),adminToggle=document.querySelector('.show-password');
adminToggle?.addEventListener('click',()=>{const visible=adminPassword.type==='password';adminPassword.type=visible?'text':'password';adminToggle.textContent=visible?'Hide':'Show';adminToggle.setAttribute('aria-label',visible?'Hide password':'Show password');adminToggle.setAttribute('aria-pressed',String(visible));});
adminLoginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = adminLoginForm.querySelector('[type="submit"]');
  button.disabled = true;
  adminLoginMessage.textContent = 'Signing in…';
  try {
    const account = await Envisage.signIn(document.querySelector('#admin-email').value.trim(), document.querySelector('#admin-password').value, 'admin');
    window.location.href = Envisage.home(account);
  } catch (error) { adminLoginMessage.textContent = error.message; }
  finally { button.disabled = false; }
});
