// Initialize immediately so the SDK consumes the recovery link before submission.
const recoveryClient = Envisage.client();
recoveryClient.catch((error) => { document.querySelector('#update-message').textContent = error.message; });
document.querySelector('#update-password-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const message = document.querySelector('#update-message');
  const button = event.currentTarget.querySelector('[type="submit"]');
  button.disabled = true;
  try {
    const db = await recoveryClient;
    const { data } = await db.auth.getSession();
    if (!data.session) throw new Error('This reset link is missing or expired. Request another reset link.');
    const { error } = await db.auth.updateUser({ password: document.querySelector('#new-password').value });
    if (error) throw error;
    message.textContent = 'Password updated. You can now sign in.';
    await Envisage.logout();
  } catch (error) { message.textContent = error.message; }
  finally { button.disabled = false; }
});
