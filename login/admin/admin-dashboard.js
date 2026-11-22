(() => {
  const M = Marketplace, e = M.escape;
  const root = document.querySelector('#panel-content'), status = document.querySelector('#panel-status');
  const dialog = document.querySelector('#admin-dialog'), detail = document.querySelector('#dialog-content');
  const sections = {
    dashboard: ['Dashboard', 'Your community, at a glance.'],
    users: ['User Management', 'View profiles and manage account access.'],
    freelancers: ['Freelancer Management', 'Review applications, portfolios, services and availability.'],
    clients: ['Client Management', 'Monitor client profiles, booking history and reported issues.'],
    bookings: ['Bookings / Projects', 'Clients request. Freelancers accept. Monitor every stage here.'],
    services: ['Services', 'Manage the service categories available on Envisage.'],
    reports: ['Reports & Complaints', 'Investigate reported issues and record their resolution.'],
    messages: ['Messages', 'Communication activity without exposing private message content.'],
    notifications: ['Notifications', 'Applications and reports that need your attention.'],
    settings: ['Settings', 'Manage your administrator profile and password.']
  };
  let users = [], bookings = [], reports = [], categories = [], summary = {}, website = {}, preferences = {}, loaded = false;
  const section = () => Object.hasOwn(sections, location.hash.slice(1)) ? location.hash.slice(1) : 'dashboard';
  const badge = value => `<span class="admin-badge ${e(String(value).toLowerCase())}">${e(value === 'Approved' ? 'Approved' : value)}</span>`;
  const empty = text => `<p class="admin-empty">${e(text)}</p>`;
  const table = (headers, rows) => `<div class="admin-table-wrap"><table class="admin-table"><thead><tr>${headers.map(h => `<th>${e(h)}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`;
  const pending = () => users.filter(u => u.role === 'freelancer' && u.freelancer_profile_complete && u.application_status === 'Pending');
  const openReports = () => reports.filter(r => r.status !== 'Resolved');
  const userName = id => users.find(u => u.id === id)?.name || id;
  function showLoadError(error) {
    const missingSchema = ['PGRST202','PGRST205','42P01','42703'].includes(error.code) || /schema cache|does not exist/i.test(error.message || '');
    if (missingSchema) {
      loaded = false;
      status.textContent = 'The admin database update has not been applied, or its schema cache needs refreshing.';
      root.innerHTML = '<section class="admin-box"><h2>Finish the Supabase database update</h2><p>In this website’s Supabase project, open SQL Editor and run the complete <a href="../supabase/migrations/202610020001_admin_management.sql" target="_blank" rel="noopener">admin management migration</a>. It creates the dashboard functions and tables and updates the booking flow.</p><p>If that migration already completed successfully, run this command in SQL Editor, then click Refresh:</p><pre><code>NOTIFY pgrst, \'reload schema\';</code></pre><p>If SQL Editor reports an error, resolve that error before retrying the dashboard. The website’s public API key cannot install database migrations.</p></section>';
    } else status.textContent = `Could not load the admin panel: ${error.message}`;
  }
  const bookingRows = items => items.map(b => `<tr><td><b>${e(b.event_type)}</b><small>${e(b.services.join(', '))}</small></td><td>${e(b.client_name)}<small>with ${e(b.freelancer_name)}</small></td><td>${e(b.event_date)}<small>${e(b.start_time.slice(0,5))}–${e(b.end_time.slice(0,5))}</small></td><td>${e(b.location)}</td><td>${badge(M.bookingLabel(b)) + '<small>Total: ' + M.money(b.budget) + ' — Deposit: ' + M.money(b.deposit_amount) + (M.depositReceived(b) ? ' ✓ Received' : ' required') + ' — Balance: ' + M.money(b.payment_status === 'Fully Paid' ? 0 : M.paymentAmounts(b).balance) + '</small>'}</td><td>Freelancer manages cancellation</td></tr>`);
  function dashboard() {
    const metrics = [
      ['Total Users', users.length, 'All registered accounts', 'users'],
      ['Total Clients', users.filter(u => u.role === 'client').length, 'People looking for services', 'clients'],
      ['Total Freelancers', users.filter(u => u.role === 'freelancer').length, 'Creative professionals', 'freelancers'],
      ['Pending Applications', pending().length, 'Completed profiles awaiting review', 'freelancers'],
      ['Approved Freelancers', users.filter(u => u.role === 'freelancer' && u.application_status === 'Approved').length, 'Applications approved', 'freelancers'],
      ['Active Bookings', bookings.filter(M.activeBooking).length, 'Accepted requests and paid bookings', 'bookings'],
      ['Completed Projects', bookings.filter(b => b.status === 'Completed').length, 'Completed by both parties', 'bookings'],
      ['Pending Requests', bookings.filter(b => b.status === 'Inquiry Sent').length, 'Awaiting freelancer response', 'bookings'],
      ['Reports & Issues', openReports().length, 'Pending or under review', 'reports']
    ];
    root.innerHTML = `<div class="admin-metrics">${metrics.map(([name,count,note,target]) => `<a class="admin-metric" href="#${target}"><span>${name}</span><strong>${count}</strong><small>${note}</small></a>`).join('')}</div><div class="admin-columns"><section class="admin-box"><h2>Recent bookings</h2>${bookings.slice(0,5).map(b => `<div class="admin-list-row"><div><b>${e(b.event_type)}</b><small>${e(b.client_name)} · ${e(b.freelancer_name)}<br>${e(b.event_date)}</small></div>${badge(M.bookingLabel(b))}</div>`).join('') || empty('No bookings yet.')}<p><a href="#bookings">View all bookings →</a></p></section><section class="admin-box"><h2>Needs your attention</h2><div class="admin-list-row"><a href="#freelancers">Freelancer applications</a>${badge(pending().length)}</div><div class="admin-list-row"><a href="#reports">Open reports & complaints</a>${badge(openReports().length)}</div><h3>Direct booking flow</h3><p>Inquiry → Acceptance → Acknowledgement → Deposit received → Partially booked → Balance received → Fully booked → Completed.</p><p>Admin approval is required for new freelancer applications.</p></section></div>`;
  }
  function people() {
    const role = section() === 'freelancers' ? 'freelancer' : section() === 'clients' ? 'client' : '';
    root.innerHTML = `<section class="admin-box"><div class="admin-toolbar"><input id="people-search" type="search" aria-label="Search users" placeholder="Search by name, role or location"><select id="people-status" aria-label="Filter account status"><option value="">All statuses</option>${['Active','Suspended','Deactivated','Pending','Approved','Rejected'].map(s => `<option>${s}</option>`).join('')}</select></div><div id="people-results"></div></section>`;
    const render = () => {
      const term = document.querySelector('#people-search').value.toLowerCase(), filter = document.querySelector('#people-status').value;
      const matches = users.filter(u => (!role || u.role === role) && (!filter || u.account_status === filter || u.application_status === filter) && `${u.name} ${u.role} ${u.freelancer_profile?.location || u.client_profile?.barangay || ''}`.toLowerCase().includes(term));
      document.querySelector('#people-results').innerHTML = matches.length ? table(['Name / Profession','Role / Location','Account','Application','Actions'], matches.map(u => `<tr><td><b>${e(u.name)}</b><small>${e(u.freelancer_profile?.headline || '')}</small></td><td>${e(u.role)}<small>${e(u.freelancer_profile?.location || u.client_profile?.barangay || '')}</small></td><td>${badge(u.account_status)}</td><td>${u.role === 'freelancer' ? badge(u.freelancer_profile_complete ? u.application_status : 'Profile incomplete') : '—'}</td><td><button data-user="${u.id}">View / manage</button></td></tr>`)) : empty('No matching accounts.');
    };
    document.querySelector('#people-search').oninput = render;
    document.querySelector('#people-status').onchange = render;
    render();
  }
  function bookingPage() {
    root.innerHTML = '<section class="admin-box"><div class="admin-toolbar"><input id="booking-search" type="search" aria-label="Search bookings" placeholder="Search client, freelancer, service or location"><select id="booking-filter" aria-label="Booking status"><option value="">All stages</option><option>Inquiry Sent</option><option>Awaiting Confirmation</option><option>Awaiting Deposit</option><option>Partially Booked</option><option>Fully Booked</option><option>Completed</option><option>Cancelled</option><option>Declined</option><option>Rejected</option></select></div><div id="booking-results"></div></section>';
    const render = () => {
      const term = document.querySelector('#booking-search').value.toLowerCase(), filter = document.querySelector('#booking-filter').value;
      const items = bookings.filter(b => (!filter || b.status === filter) && `${b.client_name} ${b.freelancer_name} ${b.event_type} ${b.services.join(' ')} ${b.location}`.toLowerCase().includes(term));
      document.querySelector('#booking-results').innerHTML = items.length ? table(['Project / Service','Participants','Date / Time','Location','Status','Actions'],bookingRows(items)) : empty('No matching bookings.');
    };
    document.querySelector('#booking-search').oninput = render;
    document.querySelector('#booking-filter').onchange = render;
    render();
  }
  function reportPage() {
    root.innerHTML = `<section class="admin-box"><h2>Reported booking issues</h2>${reports.length ? table(['Reported by / Booking','Reason','Date','Status','Review'],reports.map(r => `<tr><td>${e(userName(r.reporter_id))}<small>${e(r.booking_id)}</small></td><td>${e(r.reason)}</td><td>${e(new Date(r.created_at).toLocaleDateString())}</td><td><select data-report="${r.id}" aria-label="Report status">${['Pending','Reviewing','Resolved'].map(s => `<option ${s === r.status ? 'selected' : ''}>${s}</option>`).join('')}</select></td><td>${r.status === 'Reviewing' ? `<button data-conversation="${r.id}">Review reported conversation</button>${bookings.some(b => b.id === r.booking_id && b.client_id === r.reporter_id) ? `<button data-warn-report="${r.id}">Issue freelancer warning</button>` : ""}` : 'Set Reviewing to investigate'}</td></tr>`)) : empty('No reports submitted.')}<p>Conversation access is limited to reports under review and recorded in the moderation access log.</p></section>`;
  }
  function servicePage() {
    root.innerHTML = `<section class="admin-box"><h2>Service categories</h2><form id="category-form" class="admin-toolbar"><input name="category" aria-label="Category name" placeholder="New service category" required maxlength="80"><button>Add category</button></form>${categories.map(c => `<div class="admin-list-row"><b>${e(c.name)}</b><div><button data-edit-category="${c.id}">Edit</button><button data-remove-category="${c.id}">Remove</button></div></div>`).join('')}</section>`;
    document.querySelector('#category-form').onsubmit = event => { event.preventDefault(); run(async () => { await mutate('service_categories','insert',{name:event.target.elements.category.value.trim()}); }); };
  }
  function notifications() {
    const applications = preferences.application_notifications === false ? [] : pending();
    const issues = preferences.report_notifications === false ? [] : openReports();
    root.innerHTML = `<section class="admin-box"><h2>Action queue</h2>${website.announcement ? `<div class="admin-list-row"><div><b>System announcement</b><p>${e(website.announcement)}</p></div></div>` : ''}${applications.map(u => `<div class="admin-list-row"><div><b>New freelancer application</b><small>${e(u.name)} · ${e(u.freelancer_profile?.headline)}</small></div><button data-user="${u.id}">Review application</button></div>`).join('')}${issues.map(r => `<div class="admin-list-row"><div><b>Booking complaint / dispute</b><small>${e(r.reason)} · ${e(new Date(r.created_at).toLocaleDateString())}</small></div><a href="#reports">Review</a></div>`).join('')}${!applications.length && !issues.length ? empty('You are all caught up.') : ''}</section>`;
  }
  function settings() {
    root.innerHTML = `<section class="admin-box"><h2>Admin profile</h2><form id="admin-profile-form"><label>Name<input name="name" value="${e(Envisage.profile.name)}" required maxlength="100"></label><button>Save profile</button></form></section><section class="admin-box"><h2>Password</h2><form id="admin-password-form"><label>New password<input name="password" type="password" minlength="8" required autocomplete="new-password"></label><label>Confirm password<input name="confirmation" type="password" minlength="8" required autocomplete="new-password"></label><button>Update password</button></form></section><section class="admin-box"><h2>Administration</h2><p><a href="#services">Manage service categories</a> · <a href="#users">Manage account access</a> · <a href="#notifications">Review notifications</a></p><p>Clients manage requests and payments. Approved freelancers accept bookings. Administrators review applications and moderate reported issues. Administrator roles are assigned through trusted database administration.</p></section>`;
    root.insertAdjacentHTML('beforeend', `<section class="admin-box"><h2>Website settings</h2><form id="website-form"><label>Website name<input name="site_name" value="${e(website.site_name || 'envisage')}" required maxlength="50"></label><label>System announcement<textarea name="announcement" rows="3" maxlength="1000">${e(website.announcement || '')}</textarea></label><button>Save website settings</button></form></section><section class="admin-box"><h2>Notification preferences</h2><form id="preferences-form"><label><input name="applications" type="checkbox" ${preferences.application_notifications !== false ? 'checked' : ''}>Freelancer applications and verification requests</label><label><input name="reports" type="checkbox" ${preferences.report_notifications !== false ? 'checked' : ''}>Reports, complaints and booking disputes</label><button>Save preferences</button></form></section>`);
    document.querySelector('#website-form').onsubmit = event => { event.preventDefault(); const fields = event.target.elements; run(async () => { const db = await Envisage.client(); const {error} = await db.from('website_settings').update({site_name:fields.site_name.value.trim(),announcement:fields.announcement.value.trim(),updated_at:new Date().toISOString()}).eq('id',true); if(error) throw error; }); };
    document.querySelector('#preferences-form').onsubmit = event => { event.preventDefault(); const fields = event.target.elements; run(async () => { const db = await Envisage.client(); const {error} = await db.from('admin_preferences').upsert({admin_id:Envisage.profile.id,application_notifications:fields.applications.checked,report_notifications:fields.reports.checked}); if(error) throw error; }); };
    document.querySelector('#admin-profile-form').onsubmit = event => { event.preventDefault(); run(async () => { await Envisage.saveProfile({name:event.target.elements.name.value.trim()}); }); };
    document.querySelector('#admin-password-form').onsubmit = event => { event.preventDefault(); const form = event.target; run(async () => { if (form.elements.password.value !== form.elements.confirmation.value) throw new Error('Passwords do not match.'); const db = await Envisage.client(); const result = await db.auth.updateUser({password:form.elements.password.value}); if(result.error) throw result.error; form.reset(); }); };
  }
  function render() {
    const key = section();
    document.querySelector('#section-label').textContent = sections[key][0];
    document.querySelector('#page-title').textContent = sections[key][0];
    document.querySelector('#page-description').textContent = sections[key][1];
    document.querySelector('#admin-name').textContent = Envisage.profile.name || 'Administrator';
    document.querySelector('.brand span:last-child').textContent = website.site_name || 'envisage';
    document.querySelectorAll('#admin-nav a').forEach(a => { a.classList.toggle('active',a.hash === '#' + key); if(a.hash === '#' + key) a.setAttribute('aria-current','page'); else a.removeAttribute('aria-current'); });
    if(!loaded) return;
    if(key === 'dashboard') dashboard();
    else if(['users','freelancers','clients'].includes(key)) people();
    else if(key === 'bookings') bookingPage();
    else if(key === 'reports') reportPage();
    else if(key === 'services') servicePage();
    else if(key === 'notifications') notifications();
    else if(key === 'settings') settings();
    else root.innerHTML = `<div class="admin-metrics">${[['Active conversations (30 days)',summary.conversations],['New messages (24 hours)',summary.new_messages],['Reported conversations',summary.reported]].map(([label,value]) => `<article class="admin-metric"><span>${label}</span><strong>${e(value)}</strong></article>`).join('')}</div><section class="admin-box"><h2>Respecting conversation privacy</h2><p>Message content is available only for a reported booking under review. Each access is logged.</p><a href="#reports">Open reports & complaints →</a></section>`;
  }
  async function refresh() {
    const data = await Promise.all([M.rows('profiles',q => q.order('created_at',{ascending:false})),M.rows('bookings',q => q.order('created_at',{ascending:false})),M.rows('reports',q => q.order('created_at',{ascending:false})),M.rows('service_categories',q => q.order('name')),M.rpc('admin_message_summary')]);
    [users,bookings,reports,categories,summary] = data;
    const [settingsRows, preferenceRows] = await Promise.all([M.rows('website_settings'), M.rows('admin_preferences')]);
    website = settingsRows[0] || {}; preferences = preferenceRows[0] || {};
    loaded = true; render();
  }
  async function mutate(tableName, method, value, id) {
    const db = await Envisage.client();
    let query = db.from(tableName)[method](value);
    if(id) query = query.eq('id',id);
    const result = await query; if(result.error) throw result.error;
  }
  async function run(task) {
    status.textContent = 'Saving…';
    document.querySelector('#dialog-status').textContent = '';
    try { await task(); await refresh(); status.textContent = 'Changes saved.'; }
    catch(error) { status.textContent = error.message; document.querySelector('#dialog-status').textContent = error.message; }
  }
  async function openUser(id) {
    const u = users.find(u => u.id === id); if(!u) return;
    document.querySelector('#dialog-status').textContent = '';
    const p = u.freelancer_profile || u.client_profile || {}, url = M.link(p.portfolioUrl);
    detail.innerHTML = `<h2>${e(u.name)}</h2><p>${badge(u.role)} ${badge(u.account_status)}</p><dl>${[['Profession',p.headline],['Location',p.location || p.barangay],['Services',(p.services || []).join(', ')],['Starting price',u.role === 'freelancer' ? M.money(p.startingRate) : '—'],['About',p.description],['Verified',u.verified_at ? new Date(u.verified_at).toLocaleDateString() : 'Not verified'],['Application',u.role === 'freelancer' ? u.application_status : '—']].map(([key,value]) => `<dt>${key}</dt><dd>${e(value || '—')}</dd>`).join('')}</dl>${url ? `<p><a href="${e(url)}" target="_blank" rel="noopener noreferrer">View portfolio ↗</a></p>` : ''}${u.role !== 'admin' ? `<form id="edit-user"><label>Name<input name="name" value="${e(u.name)}" required maxlength="100"></label><button>Save name</button></form><p>${['Active','Suspended','Deactivated','verify',...(u.role === 'freelancer' && u.freelancer_profile_complete ? ['Approved','Rejected'] : []),'delete'].map(action => `<button data-account="${action}" data-id="${u.id}">${e(({verify:'Verify information',Active:'Activate',Suspended:'Suspend',Deactivated:'Deactivate',Approved:'Approve freelancer',Rejected:'Reject application',delete:'Delete account'})[action])}</button>`).join(' ')}</p>` : ''}<h3>Booking history / active requests</h3>${table(['Service','Participants','Date','Location','Status','Actions'],bookingRows(bookings.filter(b => b.client_id === id || b.freelancer_id === id)))}<h3>Related reports</h3>${reports.filter(r => bookings.some(b => b.id === r.booking_id && (b.client_id === id || b.freelancer_id === id))).map(r => `<p>${badge(r.status)} ${e(r.reason)}</p>`).join('') || '<p>No related reports.</p>'}${u.role === 'freelancer' ? '<h3>Availability</h3><div id="admin-calendar"></div>' : ''}`;
    dialog.showModal();
    const form = document.querySelector('#edit-user');
    if (form) {
      const fields = u.role === 'client' ? [['phone','Phone'],['address','Address'],['barangay','Barangay'],['facebookName','Facebook name']] : [['headline','Profession'],['description','Description'],['location','Location'],['startingRate','Starting price'],['portfolioUrl','Portfolio URL']];
      form.querySelector('button').textContent = 'Save user information';
      form.querySelector('button').insertAdjacentHTML('beforebegin', fields.map(([key,label]) => `<label>${label}${['barangay','location'].includes(key) ? `<select name="${key}"><option value="">Choose a barangay</option>${M.barangays.map(b => { const value = key === 'location' ? M.location(b) : b; return `<option value="${e(value)}" ${p[key] === value ? 'selected' : ''}>${e(b)}</option>`; }).join('')}</select>` : `<input name="${key}" value="${e(p[key] || '')}" ${key === 'startingRate' ? 'type="number" min="0" step="0.01"' : key === 'portfolioUrl' ? 'type="url"' : ''}>`}</label>`).join(''));
      form.onsubmit = event => {
        event.preventDefault();
        const values = Object.fromEntries(fields.map(([key]) => [key,form.elements[key].value.trim()]));
        if (values.startingRate === '') delete values.startingRate;
        run(async () => {await M.rpc('admin_update_profile',{p_id:id,p_name:form.elements.name.value.trim(),p_fields:values}); dialog.close();});
      };
    }
    if(u.role === 'freelancer') try { await M.calendar(document.querySelector('#admin-calendar'),id); } catch(error) { document.querySelector('#admin-calendar').textContent = error.message; }
  }
  document.addEventListener('click', async event => {
    const button = event.target.closest('button'); if(!button) return;
    if(button.dataset.user) { await openUser(button.dataset.user); return; }
    if(button.dataset.account) {
      const action = button.dataset.account;
      if(['delete','Suspended','Deactivated'].includes(action) && !confirm(`${action === 'delete' ? 'Permanently delete' : action === 'Suspended' ? 'Suspend' : 'Deactivate'} this account?`)) return;
      button.disabled = true; await run(async () => { await M.rpc('admin_manage_user',{p_id:button.dataset.id,p_action:action}); dialog.close(); }); button.disabled = false;
    }
    if(button.dataset.editCategory) { const name = prompt('Category name',categories.find(c => c.id === button.dataset.editCategory).name); if(name?.trim()) await run(() => mutate('service_categories','update',{name:name.trim()},button.dataset.editCategory)); }
    if(button.dataset.removeCategory && confirm('Remove this service category? Existing booking records remain unchanged.')) await run(() => mutate('service_categories','delete',undefined,button.dataset.removeCategory));
    if(button.dataset.warnReport) {
      document.querySelector('#dialog-status').textContent = '';
      detail.innerHTML = '<h2>Issue freelancer warning</h2><p>This warning is linked to the report under review and will appear privately on the freelancer’s profile. It does not cancel the booking.</p><form id="warning-form"><label>Warning<textarea name="warning" required minlength="10" maxlength="2000"></textarea></label><button type="submit">Send warning</button></form>';
      detail.querySelector('#warning-form').onsubmit = event => {
        event.preventDefault(); const form = event.target, submit = form.querySelector('button'); submit.disabled = true;
        run(async () => { await M.rpc('warn_reported_freelancer',{p_report:button.dataset.warnReport,p_message:form.querySelector('textarea').value.trim()}); dialog.close(); }).finally(() => {submit.disabled = false;});
      };
      dialog.showModal();
    }
    if(button.dataset.conversation) {
      button.disabled = true;
      try { const messages = await M.rpc('admin_report_messages',{p_report:button.dataset.conversation}); detail.innerHTML = '<h2>Reported conversation</h2><p>This access has been logged.</p>' + (messages.map(m => `<div class="admin-list-row"><div><b>${e(userName(m.sender_id))}</b><p>${e(m.body)}</p><small>${e(new Date(m.created_at).toLocaleString())}</small></div></div>`).join('') || empty('No messages.')); dialog.showModal(); }
      catch(error) {status.textContent = error.message;} finally {button.disabled = false;}
    }
  });
  root.addEventListener('change', event => { if(event.target.dataset.report) run(() => mutate('reports','update',{status:event.target.value},event.target.dataset.report)); });
  document.querySelector('#close-dialog').onclick = () => dialog.close();
  window.addEventListener('hashchange',render);
  document.querySelector('#refresh-panel').onclick = async () => { status.textContent = 'Refreshing…'; try {await refresh();status.textContent = '';} catch(error) {showLoadError(error);} };
  render(); status.textContent = 'Loading shared platform records…';
  refresh().then(() => {status.textContent = '';}).catch(showLoadError);
  M.watch(async () => {
    if (dialog.open || !['dashboard','notifications','messages'].includes(section())) return;
    try { await refresh(); } catch(error) { showLoadError(error); }
  });
})();
