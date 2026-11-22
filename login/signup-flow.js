(() => {
  const pendingKey = 'envisagePendingSignup', cooldownKey = 'envisageSignupResendAt';
  function errorText(error) {
    const code = error.code || '';
    if (code === 'email_address_invalid') return 'Enter an email address you can access, such as your Gmail address.';
    if (code === 'email_address_not_authorized') return 'Email delivery is not ready for this address. Please contact support.';
    if (code === 'otp_expired' || code === 'otp_disabled') return 'This code is invalid or has expired. Check the latest email or request a new code.';
    if (code === 'over_email_send_rate_limit' || code === 'over_request_rate_limit' || error.status === 429) return 'Too many attempts. Please wait before trying again.';
    if (code === 'signup_disabled') return 'New registrations are currently unavailable.';
    if (/fetch|network/i.test(error.message || '')) return 'Could not connect. Check your connection and try again.';
    return error.message || 'Something went wrong. Please try again.';
  }
  window.SignupFlow = {
    errorText,
    email: () => sessionStorage.getItem(pendingKey) || '',
    resendAt: () => Number(sessionStorage.getItem(cooldownKey)) || 0,
    remember(email) {
      const normalized = email.trim().toLowerCase();
      if (normalized !== this.email()) sessionStorage.removeItem(cooldownKey);
      sessionStorage.setItem(pendingKey, normalized);
    },
    sent() { sessionStorage.setItem(cooldownKey, String(Date.now() + 60000)); },
    clear() { sessionStorage.removeItem(pendingKey); sessionStorage.removeItem(cooldownKey); },
  };
})();
