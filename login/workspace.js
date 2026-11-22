(async () => {
  document.body.hidden = true;
  try {
    const row = await Envisage.current();
    const path = window.location.pathname;
    const requiredRole = path.includes('/admin/') ? 'admin' : path.includes('/clients/') ? 'client' : path.includes('/freelancers/') ? 'freelancer' : null;
    if (requiredRole && row.role !== requiredRole) {
      window.location.replace(Envisage.home(row));
      return;
    }
    const needsSetup = requiredRole && row.role !== 'admin' && !row.onboarding_complete;
    const needsFreelancerProfile = requiredRole === 'freelancer' && !row.freelancer_profile_complete && !path.endsWith('/freelancer-profile.html');
    if (needsSetup || needsFreelancerProfile || (path.endsWith('/auth/onboarding.html') && (row.onboarding_complete || row.role === 'admin'))) {
      window.location.replace(Envisage.home(row));
      return;
    }
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = new URL('marketplace.js', Envisage.base).href;
      script.onload = resolve;
      script.onerror = () => reject(new Error('The workspace could not load. Refresh to retry.'));
      document.body.append(script);
    });
    for (const placeholder of document.querySelectorAll('script[data-app-src]')) {
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = placeholder.dataset.appSrc;
        script.onload = resolve;
        script.onerror = () => reject(new Error('A page script could not be loaded. Refresh to retry.'));
        document.body.append(script);
      });
    }
    if (['client','freelancer'].includes(row.role)) {
      const notifications = document.createElement('script');
      notifications.src = new URL('booking-notifications.js', Envisage.base).href;
      document.body.append(notifications);
    }
    document.body.hidden = false;
    if (requiredRole === 'freelancer' && row.application_status && row.application_status !== 'Approved') {
      const applicationNotice = document.createElement('p');
      applicationNotice.className = 'website-announcement';
      applicationNotice.textContent = `Freelancer application: ${row.application_status}. Complete your profile for administrator review. Your application must be approved before clients can discover you or you can accept bookings.`;
      document.querySelector('main')?.prepend(applicationNotice);
    }
    // Site announcements are shared across authenticated workspaces.
    if (requiredRole !== 'admin') {
      Marketplace.rows('website_settings').then(rows => {
        const settings = rows[0];
        if (!settings) return;
        const brand = document.querySelector('.brand span:last-child');
        if (brand) brand.textContent = settings.site_name;
        if (settings.announcement) {
          const notice = document.createElement('p');
          notice.className = 'website-announcement';
          notice.setAttribute('role', 'status');
          notice.textContent = settings.announcement;
          document.querySelector('main')?.prepend(notice);
        }
      }).catch(error => console.error('Website settings could not load:', error.message));
    }
  } catch (error) {
    document.body.replaceChildren();
    const main = document.createElement('main');
    main.className = 'account-card';
    const message = document.createElement('p');
    message.textContent = error.message;
    const link = document.createElement('a');
    link.href = new URL('auth/login.html', Envisage.base).href;
    link.textContent = 'Go to sign in';
    main.append(message, link);
    document.body.append(main);
    document.body.hidden = false;
  }
})();
