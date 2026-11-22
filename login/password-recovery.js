document.querySelector('#reset-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const message = document.querySelector('#reset-message');
  const button = event.currentTarget.querySelector('[type="submit"]');
  button.disabled = true;
  try {
    const db = await Envisage.client();
    const { error } = await db.auth.resetPasswordForEmail(document.querySelector('#reset-email').value.trim(), {
      redirectTo: new URL('auth/update-password.html', Envisage.base).href,
    });
    if (error) throw error;
    message.textContent = 'If an account exists for this email, you will receive a password reset link.';
  } catch (error) { message.textContent = error.message; }
  finally { button.disabled = false; }
});
