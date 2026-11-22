(() => {
  const path = window.location.pathname.toLowerCase();
  const isFreelancer = localStorage.getItem('envisageRole') === 'freelancer';
  let fallback = '../landing/index.html';

  if (path.includes('/dashboard/'))
    fallback = isFreelancer
      ? '../freelancers/freelancer-profile.html'
      : '../clients/discovery.html';
  if (path.includes('/freelancers/')) fallback = 'profile.html';
  if (path.includes('/clients/')) fallback = 'discovery.html';
  if (path.includes('/support/'))
    fallback =
      new URLSearchParams(window.location.search).get('role') === 'freelancer'
        ? '../freelancers/freelancer-profile.html'
        : '../clients/discovery.html';
  if (path.includes('/admin/'))
    fallback = path.endsWith('/login.html') ? '../index.html' : 'dashboard.html';
  if (path.includes('/auth/')) fallback = '../index.html';
  if (/\/(accepted-booking|inquiry-thread)\.html$/.test(path)) fallback = path.endsWith('/inquiry-thread.html') ? 'inquiries.html' : 'bookings.html';
  if (path.endsWith('/client-booking.html')) fallback = 'client-bookings.html';
  if (path.endsWith('/client-inquiry-thread.html')) fallback = 'client-messages.html';
  if (path.includes('/legal/')) fallback = '../landing/index.html';
  const safeReferrer = (() => {try {const url=new URL(document.referrer);return url.origin===window.location.origin && url.pathname!==path ? url : null;}catch{return null;}})();
  const goBack = () => {
    if (safeReferrer && window.history.length>1) window.history.back();
    else window.location.href=fallback;
  };
  if (path.includes('/support/')) {
    fallback=isFreelancer ? '../freelancers/profile.html' : '../clients/discovery.html';
    const back=document.querySelector('.back-link');if(back)back.href=fallback;
  }
  if (path.includes('/legal/')) {
    const returnTo=new URLSearchParams(window.location.search).get('return');
    const destinations={register:'../auth/register.html',login:'../auth/login.html',home:'../landing/index.html'};
    if(destinations[returnTo])fallback=destinations[returnTo];
    else if(safeReferrer)fallback=safeReferrer.href;
    const back=document.querySelector('[data-policy-back]');
    if(back){back.href=fallback;back.textContent=returnTo==='register'?'← Back to create account':returnTo==='login'?'← Back to sign in':'← Back';back.addEventListener('click',event=>{event.preventDefault();window.location.assign(back.href);});}
    // Section navigation must not consume Back with Terms/Privacy hash entries.
    document.querySelectorAll('a[href^="#"]').forEach(link=>link.addEventListener('click',event=>{
      const target=document.querySelector(link.getAttribute('href'));if(!target)return;
      event.preventDefault();window.history.replaceState(window.history.state,'',link.getAttribute('href'));target.scrollIntoView({behavior:'smooth'});
    }));
  }

  const isRoleHome = path.endsWith('/admin/dashboard.html') || document.body.classList.contains('landing-page');
  if (!isRoleHome && !document.querySelector('.back-link')) {
    const backButton = document.createElement('button');
    backButton.className = 'page-back-control';
    backButton.type = 'button';
    backButton.textContent = '← Back';
    backButton.addEventListener('click', goBack);
    const backContainer = document.querySelector('main') || document.body;
    backContainer.prepend(backButton);
  }

  const appHeader = document.querySelector('.app-header');
  const headerNav = appHeader?.querySelector('nav');
  if (appHeader && headerNav) {
    const mobileMenuButton = document.createElement('button');
    const menuId = headerNav.id || 'workspace-navigation';
    headerNav.id = menuId;
    mobileMenuButton.className = 'mobile-nav-toggle';
    mobileMenuButton.type = 'button';
    mobileMenuButton.setAttribute('aria-label', 'Open navigation menu');
    mobileMenuButton.setAttribute('aria-controls', menuId);
    mobileMenuButton.setAttribute('aria-expanded', 'false');
    mobileMenuButton.innerHTML = '<span></span><span></span><span></span>';
    mobileMenuButton.addEventListener('click', () => {
      const isOpen = appHeader.classList.toggle('mobile-menu-open');
      mobileMenuButton.setAttribute('aria-expanded', String(isOpen));
      mobileMenuButton.setAttribute(
        'aria-label',
        isOpen ? 'Close navigation menu' : 'Open navigation menu',
      );
    });
    headerNav.addEventListener('click', (event) => {
      if (!event.target.closest('a')) return;
      appHeader.classList.remove('mobile-menu-open');
      mobileMenuButton.setAttribute('aria-expanded', 'false');
      mobileMenuButton.setAttribute('aria-label', 'Open navigation menu');
    });
    appHeader.insertBefore(mobileMenuButton, headerNav.nextSibling);
  }

  const topButton = document.createElement('button');
  topButton.className = 'page-top-control';
  topButton.type = 'button';
  topButton.textContent = 'Top ↑';
  topButton.setAttribute('aria-hidden', 'true');
  topButton.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  document.body.append(topButton);

  const updateTopButton = () => {
    const shouldShow = window.scrollY > Math.max(240, window.innerHeight * 0.35);
    topButton.classList.toggle('is-visible', shouldShow);
    topButton.setAttribute('aria-hidden', String(!shouldShow));
  };
  window.addEventListener('scroll', updateTopButton, { passive: true });
  window.addEventListener('resize', updateTopButton);
  updateTopButton();

  document.querySelectorAll('[data-workspace-logout]').forEach((button) => {
    button.addEventListener('click', () => {
      Envisage.logout();
    });
  });
})();

