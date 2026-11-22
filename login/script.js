const roles = document.querySelectorAll('.role');
const password = document.querySelector('#password');
const passwordToggle = document.querySelector('.show-password');
const form = document.querySelector('#login-form');
const message = document.querySelector('#form-message');
const normalizeRole = (value) =>
  ['freelancer', 'creative', 'creator'].includes(String(value || '').toLowerCase())
    ? 'freelancer'
    : 'client';
let chosenRole = new URLSearchParams(window.location.search).get('role') === 'freelancer' ? 'freelancer' : 'client';
let signingIn = false;
passwordToggle.innerHTML = "<svg viewBox=\"0 0 24 24\" width=\"24\" height=\"24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" aria-hidden=\"true\"><path d=\"M3 3l18 18M10.6 5.1A12 12 0 0 1 12 5c6.5 0 10 7 10 7a19 19 0 0 1-3 3.8M6.2 6.2A20 20 0 0 0 2 12s3.5 7 10 7a12 12 0 0 0 5.8-1.6\"/><path d=\"M9.9 9.9a3 3 0 0 0 4.2 4.2\"/></svg>";
passwordToggle.setAttribute('aria-pressed','false');
function renderRole() {
  roles.forEach(button => {button.classList.toggle('active',button.dataset.role===chosenRole);button.setAttribute('aria-pressed',String(button.dataset.role===chosenRole));});
  document.body.dataset.signinRole = chosenRole;
  document.querySelector('.login-heading h2').textContent = 'Sign in to your account';
  document.querySelector('.login-heading > p:last-child').textContent = chosenRole==='client' ? 'Find your creative, manage bookings, and plan your next event.' : 'Share your work, reply to inquiries, and manage your bookings.';
  form.querySelector('[type="submit"]').innerHTML = `Sign in as ${chosenRole} <span>→</span>`;
  const signup=document.querySelector('.signup a[href^="register.html"]');if(signup)signup.href=`register.html?role=${chosenRole}`;
}
renderRole();

roles.forEach((button) =>
  button.addEventListener('click', () => {
    if(signingIn)return;
    chosenRole = button.dataset.role;
    renderRole();
    password.value='';
    message.textContent = `Signing in as a ${button.dataset.role === 'client' ? 'client' : 'freelancer'}.`;
  }),
);

passwordToggle.addEventListener('click', () => {
  const visible = password.type === 'text';
  password.type = visible ? 'password' : 'text';
  passwordToggle.innerHTML = visible ? "<svg viewBox=\"0 0 24 24\" width=\"24\" height=\"24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" aria-hidden=\"true\"><path d=\"M3 3l18 18M10.6 5.1A12 12 0 0 1 12 5c6.5 0 10 7 10 7a19 19 0 0 1-3 3.8M6.2 6.2A20 20 0 0 0 2 12s3.5 7 10 7a12 12 0 0 0 5.8-1.6\"/><path d=\"M9.9 9.9a3 3 0 0 0 4.2 4.2\"/></svg>" : "<svg viewBox=\"0 0 24 24\" width=\"24\" height=\"24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" aria-hidden=\"true\"><path d=\"M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z\"/><circle cx=\"12\" cy=\"12\" r=\"3\" fill=\"currentColor\" stroke=\"none\"/></svg>";
  passwordToggle.setAttribute('aria-pressed',String(!visible));
  passwordToggle.setAttribute('aria-label', visible ? 'Show password' : 'Hide password');
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if(signingIn)return;
  signingIn=true;roles.forEach(role=>role.disabled=true);
  const button = form.querySelector('[type="submit"]');
  button.disabled = true;
  message.textContent = 'Signing in…';
  try {
    const account = await Envisage.signIn(document.querySelector('#email').value.trim().toLowerCase(), password.value, chosenRole);
    sessionStorage.removeItem('envisagePendingSignup');
    window.location.href = Envisage.home(account);
  } catch (error) { message.textContent = error.code === 'email_not_confirmed' ? 'Verify your email using the OTP in your inbox. Open Create account and choose Already registered to enter or resend your code.' : error.message; }
  finally { signingIn=false;button.disabled = false;roles.forEach(role=>role.disabled=false); }
});

// Supabase consumes confirmation tokens from the URL when its client initializes.
(async () => {
  const hash = new URLSearchParams(window.location.hash.slice(1));
  const query = new URLSearchParams(window.location.search);
  const error = hash.get('error_description') || query.get('error_description');
  if (error) {
    message.textContent = `Email confirmation could not finish: ${error}`;
    return;
  }
  if (!(hash.get('type') === 'signup' || hash.get('type') === 'email' || query.has('code'))) return;
  message.textContent = 'Confirming your email…';
  try {
    const row = await Envisage.current();
    sessionStorage.removeItem('envisagePendingSignup');
    window.location.replace(Envisage.home(row));
  } catch (error) { message.textContent = 'Your confirmation link could not open a session. Try signing in, or request a new confirmation email.'; }
})();

