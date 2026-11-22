(() => {
  const base = new URL('.', document.currentScript.src);
  let clientPromise;
  let signupClientPromise;
  let profile;
  function clearCache() {
    Object.keys(localStorage).filter((key) => key.startsWith('envisage')).forEach((key) => localStorage.removeItem(key));
  }
  // Remove the former browser accounts and their unverified workspace data once.
  if (localStorage.getItem('envisageAuthVersion') !== 'supabase-1') {
    clearCache();
    localStorage.setItem('envisageAuthVersion', 'supabase-1');
  }
  async function client(forSignup = false) {
    const config = window.ENVISAGE_SUPABASE;
    if (!config?.url || !config?.publishableKey) {
      throw new Error('Supabase is not configured yet. Add the project URL and public key in supabase-config.js.');
    }
    const existing = forSignup ? signupClientPromise : clientPromise;
    if (existing) return existing;
    const promise = import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.102.0/+esm')
      .then(({ createClient }) => createClient(config.url, config.publishableKey, forSignup ? {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: 'envisage-signup-verification' },
      } : undefined))
      .catch((error) => { if (forSignup) signupClientPromise = null; else clientPromise = null; throw error; });
    if (forSignup) signupClientPromise = promise;
    else clientPromise = promise;
    return promise;
  }
  function cache(row) {
    if (localStorage.getItem('envisageUserId') !== row.id) clearCache();
    profile = row;
    localStorage.setItem('envisageAuthVersion', 'supabase-1');
    localStorage.setItem('envisageUserId', row.id);
    localStorage.setItem('envisageRole', row.role);
    localStorage.setItem('envisageName', row.name);
    for (const [key, value] of Object.entries({
      envisageClientProfile: row.client_profile,
      envisageFreelancerProfile: row.freelancer_profile,
      envisageFreelancerSetup: row.freelancer_setup,
    })) {
      if (value) localStorage.setItem(key, JSON.stringify(value));
      else localStorage.removeItem(key);
    }
    return row;
  }
  async function current() {
    const db = await client();
    const { data, error } = await db.auth.getUser();
    if (error || !data.user) throw new Error('Please sign in to continue.');
    const result = await db.from('profiles').select('*').eq('id', data.user.id).single();
    if (result.error) throw new Error('Your account profile could not be loaded. Check the Supabase database setup.');
    if (result.data.account_status && result.data.account_status !== 'Active') throw new Error('Your account is suspended or deactivated. Contact support.');
    return cache(result.data);
  }
  function home(row) {
    if (row.role === 'admin') return new URL('admin/dashboard.html', base).href;
    if (!row.onboarding_complete) return new URL('auth/onboarding.html', base).href;
    return new URL(row.role === 'client' ? 'clients/discovery.html' :
      row.freelancer_profile_complete ? 'freelancers/availability.html' : 'freelancers/freelancer-profile.html', base).href;
  }
  async function signIn(email, password, expectedRole = 'client') {
    const db = await client();
    const { error } = await db.auth.signInWithPassword({ email, password });
    if (error) throw error;
    try {
      const row = await current();
      if (row.role !== (expectedRole || 'client')) {
        throw new Error(`This account belongs to a different role. Choose ${row.role === 'admin' ? 'Administrator' : row.role === 'freelancer' ? 'Freelancer' : 'Client'} sign in.`);
      }
      return row;
    } catch (error) {
      await db.auth.signOut({ scope: 'local' });
      clearCache();
      throw error;
    }
  }
  function signupEmail(value) {
    const email = String(value || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Enter a valid email address that you can access.');
    return email;
  }
  async function register({ name, email, password, role }) {
    name = String(name || '').trim();
    email = signupEmail(email);
    if (!['client', 'freelancer'].includes(role)) throw new Error('Choose Client or Freelancer.');
    if (!name || name.length > 100) throw new Error('Enter your name (up to 100 characters).');
    if (typeof password !== 'string' || password.length < 8) throw new Error('Use a password with at least 8 characters.');
    const db = await client(true);
    const { data, error } = await db.auth.signUp({
      email, password,
      options: { data: { name, role }, emailRedirectTo: new URL('auth/login.html', base).href },
    });
    if (error) throw error;
    if (!data?.user) throw new Error('Your account could not be created. Please try again.');
    // Supabase may return an empty identity list for an already registered address.
    if (Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      throw new Error('This email may already be registered. Sign in or reset your password.');
    }
    if (data.session) {
      await db.auth.signOut({ scope: 'local' });
      signupClientPromise = null;
      throw new Error('Email verification is not enabled. Please contact support to enable signup confirmation.');
    }
    return { email, needsConfirmation: true, profile: null };
  }
  async function resendSignup(email) {
    const db = await client(true);
    const { error } = await db.auth.resend({ type: 'signup', email: signupEmail(email), options: { emailRedirectTo: new URL('auth/login.html', base).href } });
    if (error) throw error;
  }
  async function confirmSignup(email, token) {
    if (!/^\d{6,10}$/.test(String(token).trim())) throw new Error('Enter the verification code from your email.');
    const db = await client(true);
    const { data, error } = await db.auth.verifyOtp({ email: signupEmail(email), token: String(token).trim(), type: 'email' });
    if (error) throw error;
    if (!data?.user?.email_confirmed_at) throw new Error('Email verification did not finish. Request a new code and try again.');
    // Verification is isolated from the sign-in client and never persists a login.
    // Revoke the temporary session when possible; it is discarded either way.
    try { await db.auth.signOut({ scope: 'local' }); } catch (_) { /* No session is saved in browser storage. */ }
    signupClientPromise = null;
    return { verified: true };
  }
  async function saveProfile(fields) {
    const db = await client();
    if (!profile) await current();
    const { data, error } = await db.from('profiles').update(fields).eq('id', profile.id).select().single();
    if (error) throw error;
    return cache(data);
  }
  async function logout() {
    try {
      const db = await client();
      const { error } = await db.auth.signOut({ scope: 'local' });
      if (error) throw error;
      clearCache();
      window.location.href = new URL('auth/login.html', base).href;
    } catch (error) { alert(error.message); }
  }
  window.Envisage = { client, current, signIn, register, resendSignup, confirmSignup, saveProfile, home, logout, base, get profile() { return profile; } };
})();

