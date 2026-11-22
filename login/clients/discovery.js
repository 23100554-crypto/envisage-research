(async () => {
  const M = Marketplace, e = M.escape;
  const grid = document.querySelector('.profile-grid');
  const sidebar = document.querySelector('.barangay-list');
  const search = document.querySelector('#creative-search');
  const modal = document.querySelector('#inquiry-thread');
  const form = document.querySelector('#booking-form');
  const status = document.querySelector('.booking-status');
  BookingFormControls.bindAmounts(form);
  BookingFormControls.bindDate(document.querySelector('#event-date'));
  let directory = [], service = '', selected = '', active = null, scheduleRefresh;
  try {
    const categories = await M.rows('service_categories', q => q.order('name'));
    document.querySelectorAll('.filter').forEach(button => button.remove());
    document.querySelector('.filters').insertAdjacentHTML('afterbegin', '<button type="button" class="filter active">All services</button>' + categories.map(c => `<button type="button" class="filter">${e(c.name)}</button>`).join(''));
  } catch(error) { status.textContent = error.message; }
  let mapView;
  function chooseArea(area) {
    selected = area;
    render();
  }
  try { mapView = window.DiscoveryMap?.create({profile:Envisage.profile,onSelect:chooseArea}); }
  catch(error) { document.querySelector('#map-status').textContent = 'The map could not load. You can still browse the profiles below.'; console.error(error); }
  sidebar.innerHTML = ['',...M.barangays].map(b=>`<button class="barangay-option" type="button" data-barangay="${e(b)}">${e(b || 'All San Pedro')}</button>`).join('');
  document.querySelector('.filters').insertAdjacentHTML('afterend','<p id="result-summary" role="status"></p>');
  document.querySelector('#chat-message-form').hidden=true;
  document.querySelector('#request-booking-toggle').hidden=true;
  document.querySelector('.thread-messages').innerHTML='<p class="message message-system">Share your event details to start a private conversation. Request the booking from your conversation; it requires freelancer acceptance.</p>';
  document.querySelector('#booking-details').open=true;
  document.querySelector('#event-date').min=M.today();
  document.querySelector('#event-location').outerHTML='<select id="event-location" required><option value="">Choose event barangay in San Pedro</option>'+M.barangays.map(b=>`<option value="${e(M.location(b))}">${e(b)}</option>`).join('')+'</select>';
  form.insertAdjacentHTML('beforebegin','<details class="booking-calendar"><summary>View availability calendar</summary><div id="inquiry-calendar" class="calendar-panel"></div></details>');
  function inArea(b) {return directory.filter(row=>!b || M.barangayOf(row.profile)===b);}
  function preview(b) {
    mapView?.highlight(b);
  }
  const overviewDialog = document.createElement('dialog');
  overviewDialog.className = 'creative-overview-dialog';
  overviewDialog.setAttribute('aria-labelledby', 'creative-overview-name');
  document.body.append(overviewDialog);
  function updateOverviewButtons() {
    grid.querySelectorAll('.creative-overview-copy').forEach(copy => {
      const button = copy.parentElement.querySelector('.creative-see-more');
      button.hidden = copy.scrollHeight <= copy.clientHeight + 1;
    });
  }
  const overviewResize = new ResizeObserver(updateOverviewButtons);
  overviewResize.observe(grid);
  function showOverview(id) {
    const row = directory.find(person => person.id === id);
    if (!row) return;
    const p = row.profile, photo = M.image(p.photoData);
    const profileUrl = 'freelancer-view.html?id=' + encodeURIComponent(row.id);
    overviewDialog.innerHTML = `<div class="creative-overview-toolbar"><span>Creative overview</span><button type="button" class="creative-overview-close" aria-label="Close creative overview">×</button></div>
      <div class="creative-overview-banner"><a class="creative-overview-photo" href="${e(profileUrl)}" aria-label="${e('View ' + row.name + ' profile, portfolio, and posts')}">${photo ? `<img src="${e(photo)}" alt="${e(row.name)}" />` : `<span>${e(row.name.split(' ').map(word => word[0]).slice(0, 2).join(''))}</span>`}</a><div><h2 id="creative-overview-name">${e(row.name)}</h2><p>${e(p.headline)}</p></div></div>
      <p class="creative-overview-hint">Select the profile photo to view their profile, portfolio and posts.</p>
      <h3>Overview</h3><p class="creative-overview-full">${e(p.description)}</p>
      <h3>Location</h3><p>${e(p.location)}</p>
      <h3>Services</h3><p>${e(p.services.join(', '))}</p>
      <h3>Starting rate</h3><p>${M.money(p.startingRate)}</p>
      <div class="creative-overview-actions"><button type="button" class="book-button">Send inquiry →</button></div>`;
    overviewDialog.querySelector('.creative-overview-close').onclick = () => overviewDialog.close();
    overviewDialog.querySelector('.book-button').onclick = () => {
      overviewDialog.close();
      open(row.id);
    };
    overviewDialog.showModal();
  }
  overviewDialog.addEventListener('click', event => {
    if (event.target === overviewDialog) overviewDialog.close();
  });
  grid.addEventListener('click', event => {
    const button = event.target.closest('[data-overview-id]');
    if (button) showOverview(button.dataset.overviewId);
  });

  function render() {
    const term=search.value.trim().toLowerCase();
    let people=inArea(selected).filter(row=>(!service || row.profile.services.includes(service)) && `${row.name} ${row.profile.headline} ${row.profile.description} ${row.profile.services.join(' ')}`.toLowerCase().includes(term));
    if (window.DiscoveryMap) people = window.DiscoveryMap.nearby(people,Envisage.profile.client_profile?.barangay).map(item => item.row);
    document.querySelector('#selected-barangay').textContent=selected?M.location(selected):'All San Pedro, Laguna';
    document.querySelector('#result-summary').textContent=`Explore creatives ${selected?'in '+selected:'across San Pedro'}${service?' · '+service:''}`;
    sidebar.querySelectorAll('button').forEach(b=>{b.classList.toggle('active',b.dataset.barangay===selected);b.setAttribute('aria-pressed',String(b.dataset.barangay===selected));});
    document.querySelector('.discovery-map-section').hidden = Boolean(selected);
    preview(selected);
    mapView?.update(people,selected);
    grid.innerHTML=people.length?people.map(row=>{
      const p=row.profile, picture=M.image(p.photoData);
      return `<article class="creative-card"><div class="card-image image-profile">${picture?`<img class="saved-profile-photo" src="${e(picture)}" alt="${e(row.name)}"/>`:`<span>${e(row.name.split(' ').map(w=>w[0]).join(''))}</span>`}<p>${e(row.name)}<br/><small>${e(p.headline)}</small></p></div><div class="card-top"><div><h2>${e(row.name)}</h2><p>${M.money(p.startingRate)} starting rate</p></div><span class="availability">View schedule</span></div><div class="profile-parts"><div class="profile-part overview"><span>Overview</span><div class="creative-overview-preview"><p class="creative-overview-copy">${e(p.description)}</p><button type="button" class="creative-see-more" data-overview-id="${e(row.id)}" aria-label="${e('Read full overview for '+row.name)}" hidden>See more</button></div></div><div class="profile-part"><span>Location</span><p>${e(p.location)}</p></div><div class="profile-part forte"><span>Services</span><div>${p.services.map(s=>`<b>${e(s)}</b>`).join('')}</div></div></div><a class="portfolio-link" href="freelancer-view.html?id=${row.id}">Profile & availability →</a><button class="book-button" type="button" data-id="${row.id}">Send inquiry →</button></article>`;
    }).join(''):'<div class="empty-bookings"><strong>No matching freelancers.</strong><span>Choose another barangay or service, or clear your search.</span></div>';
    requestAnimationFrame(updateOverviewButtons);
  }
  async function refresh() { directory=(await M.rpc('freelancer_directory')).filter(r=>M.barangayOf(r.profile)); render(); }
  async function open(id) {
    active=directory.find(r=>r.id===id); if(!active) return;
    form.reset(); status.textContent='';
    document.querySelector('#thread-title').textContent=active.name;
    document.querySelector('#thread-avatar').textContent=active.name.split(' ').map(w=>w[0]).join('');
    document.querySelector('#other-event-wrap').hidden=true; document.querySelector('#other-event-type').required=false;
    document.querySelector('.request-services').innerHTML = '<legend>Services needed</legend>' + active.profile.services.map(name => `<label><input type="checkbox" name="requested-service" value="${e(name)}" checked><span>${e(name)}</span></label>`).join('');
    document.querySelectorAll('[name="requested-service"]').forEach(input=>{input.disabled=!active.profile.services.includes(input.value);input.checked=!input.disabled;input.closest('label').hidden=input.disabled;});
    document.querySelector('#event-location').value=active.profile.location;
    modal.showModal();
    try { scheduleRefresh=await M.calendar(document.querySelector('#inquiry-calendar'),id,date=>document.querySelector('#event-date').value=date); }
    catch(error){status.textContent=error.message;}
  }
  grid.addEventListener('click',event=>{const button=event.target.closest('[data-id]');if(button)open(button.dataset.id);});
  sidebar.querySelectorAll('button').forEach(button=>{
    button.addEventListener('click',()=>chooseArea(button.dataset.barangay));
    button.addEventListener('mouseenter',()=>preview(button.dataset.barangay));
    button.addEventListener('focus',()=>preview(button.dataset.barangay));
    button.addEventListener('mouseleave',()=>preview(selected));
    button.addEventListener('blur',()=>preview(selected));
  });
  search.addEventListener('input',render);
  document.querySelectorAll('.filter').forEach(button=>button.addEventListener('click',()=>{service=button.textContent==='All services'?'':button.textContent;document.querySelectorAll('.filter').forEach(b=>b.classList.toggle('active',b===button));render();}));
  document.querySelector('.modal-close').onclick=()=>modal.close();
  modal.addEventListener('click',event=>{if(event.target===modal)modal.close();});
  document.querySelector('#event-type').addEventListener('change',event=>{const other=event.target.value==='Other';document.querySelector('#other-event-wrap').hidden=!other;document.querySelector('#other-event-type').required=other;});
  form.addEventListener('submit',async event=>{
    event.preventDefault(); const submit=form.querySelector('[type="submit"]');submit.disabled=true;status.textContent='Sending inquiry…';
    try {
      const value=id=>document.getElementById(id).value;
      if(!value('event-date') || value('event-date') < M.today())throw new Error('Choose today or a future event date.');
      if(!form.querySelector('[name="requested-service"]:checked'))throw new Error('Choose at least one service.');
      const booking=await M.rpc('create_booking',{p_request:{freelancer_id:active.id,event_type:value('event-type')==='Other'?value('other-event-type').trim():value('event-type'),event_date:value('event-date'),start_time:'00:00',end_time:'23:59:59',location:value('event-location'),services:[...form.querySelectorAll('[name="requested-service"]:checked')].map(i=>i.value),budget:BookingFormControls.amount(value('budget')),note:value('details').trim()}});
      window.location.href=M.detailUrl(booking.id);
    }catch(error){status.textContent=error.message;submit.disabled=false;}
  });
  try {
    await refresh();
    const id=new URLSearchParams(location.search).get('inquire');
    if(id)await open(id);
    M.watch(async()=>{await refresh();if(modal.open)await scheduleRefresh?.();});
  }catch(error){grid.textContent=`Could not load freelancers: ${error.message}`;}
})();


