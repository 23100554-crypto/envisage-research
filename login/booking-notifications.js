(() => {
  if (!['client','freelancer'].includes(Envisage.profile.role) || window.BookingNotifications) return;
  const M = Marketplace, e = M.escape;
  const widget = document.createElement('details');
  widget.className = 'booking-notifications' + (Envisage.profile.role === 'freelancer' ? ' freelancer-notifications' : '');
  widget.innerHTML = '<summary aria-label="Notifications">Notifications <span id="booking-unread-count">0</span></summary><div class="booking-notification-menu"><div class="booking-notification-heading"><h2>Notifications</h2><a href="notifications.html">View all notifications</a></div><div id="booking-notification-preview"></div><p id="booking-notification-feedback" role="status"></p></div>';
  const header = document.querySelector('.app-header');
  if (header) {
    const nav = header.querySelector('nav');
    const existing = nav?.querySelector('a[href="notifications.html"]');
    const profile = nav?.querySelector('a[href="profile.html"], a[href="freelancer-profile.html"]');
    if (existing) existing.replaceWith(widget);
    else if (nav && Envisage.profile.role === 'freelancer' && profile) profile.after(widget);
    else if (nav) nav.append(widget);
    else header.prepend(widget);
    if (nav && Envisage.profile.role === 'freelancer' && profile) profile.after(widget);
    header.classList.add('has-booking-notifications');
  }
  const toast = document.createElement('aside');
  toast.className = 'booking-notification-toast';toast.hidden = true;toast.setAttribute('aria-live','polite');
  document.body.append(toast);
  const page = document.querySelector('#notification-list');
  const feedback = widget.querySelector('#booking-notification-feedback');
  const seenKey = 'envisageNoticeSeen:'+Envisage.profile.id;
  let loaded = false, latestId = sessionStorage.getItem(seenKey), refreshing = false;
  const paymentNotice = n => /payment|deposit|balance|acknowledged/.test(n.kind || '') || /payment|deposit|balance|fully paid/i.test(n.title || '');
  const destination = n => n.kind === 'account_warning' ? 'freelancer-profile.html#warnings' : n.kind === 'booking_review' ? 'freelancer-profile.html#client-reviews' : M.detailUrl(n.booking_id) + (paymentNotice(n) ? '#chat-payment-controls' : '#shared-messages');
  function relativeTime(value) {
    const minutes = Math.max(0,Math.floor((Date.now()-new Date(value).getTime())/60000));
    if (!Number.isFinite(minutes)) return '';
    if (minutes<1) return 'Just now';
    if (minutes<60) return minutes+'m ago';
    if (minutes<1440) return Math.floor(minutes/60)+'h ago';
    if (minutes<10080) return Math.floor(minutes/1440)+'d ago';
    return new Date(value).toLocaleDateString('en-PH',{timeZone:'Asia/Manila',month:'short',day:'numeric',year:'numeric'});
  }
  const item = n => `<article class="booking-notification-item ${n.read_at ? '' : 'unread'}"><a data-notification="${e(n.id)}" href="${e(destination(n))}"><span class="notification-event-icon" aria-hidden="true">${paymentNotice(n) ? '₱' : '↗'}</span><span class="notification-event-copy"><strong>${e(n.title)}</strong><span class="notification-event-body">${e(n.body)}</span><time datetime="${e(n.created_at)}" title="${e(new Date(n.created_at).toLocaleString('en-PH',{timeZone:'Asia/Manila'}))}">${e(relativeTime(n.created_at))}</time></span>${n.read_at ? '' : '<span class="notification-unread-dot" aria-label="Unread"></span>'}</a>${n.read_at ? '' : `<button type="button" data-read-notification="${e(n.id)}">Mark as read</button>`}</article>`;

  async function refresh() {
    if (refreshing) return;
    refreshing = true;
    try {
      const db = await Envisage.client();
      const [items,countResult] = await Promise.all([
        M.rows('booking_notifications',q => q.order('created_at',{ascending:false}).limit(50)),
        db.from('booking_notifications').select('id',{count:'exact',head:true}).is('read_at',null),
      ]);
      if (countResult.error) throw countResult.error;
      widget.querySelector('#booking-unread-count').textContent = String(countResult.count || 0);
      widget.querySelector('summary').setAttribute('aria-label',`Notifications: ${countResult.count || 0} unread`);
      widget.querySelector('#booking-notification-preview').innerHTML = items.slice(0,5).map(item).join('') || '<p>You’re all caught up.</p>';
      if (page) page.innerHTML = items.map(item).join('') || '<p>You’re all caught up. New notifications will appear here.</p>';
      const newest = items[0];
      if (newest && !newest.read_at && newest.id !== latestId) {
        toast.innerHTML = `<button type="button" data-dismiss-notification aria-label="Dismiss notification">×</button>${item(newest)}`;
        toast.hidden = false;
      }
      if (newest) {latestId = newest.id;sessionStorage.setItem(seenKey,latestId);}
      feedback.textContent = '';loaded = true;
    } catch(error) {
      feedback.textContent = 'Could not load notifications. '+error.message;
      if (page && !loaded) page.textContent = feedback.textContent;
    } finally {refreshing = false;}
  }
  async function markRead(id) {
    const db = await Envisage.client();
    const {error} = await db.from('booking_notifications').update({read_at:new Date().toISOString()}).eq('id',id);
    if(error) throw error;
  }
  document.addEventListener('click', async event => {
    if (event.target.closest('[data-dismiss-notification]')) {toast.hidden=true;return;}
    const link = event.target.closest('[data-notification]');
    const button = event.target.closest('[data-read-notification]');
    if (!link && !button) return;
    if (link && (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button > 0)) return;
    if (link) event.preventDefault();
    if (button) button.disabled=true;
    try {await markRead(link?.dataset.notification || button.dataset.readNotification);toast.hidden=true;if(!link)await refresh();}
    catch(error) {feedback.textContent=error.message;if(button)button.disabled=false;}
    if (link) window.location.href=link.href;
  });
  window.BookingNotifications = {refresh};
  window.BookingNotifications.ready = refresh();
  M.watch(refresh);
})();
