(() => {
  const barangays = ['Bagong Silang', 'Calendola', 'Chrysanthemum', 'Cuyab', 'Estrella', 'Fatima', 'G.S.I.S.', 'Landayan', 'Langgam', 'Laram', 'Magsaysay', 'Maharlika', 'Narra', 'Nueva', 'Pacita 1', 'Pacita 2', 'Poblacion', 'Riverside', 'Rosario', 'Sampaguita Village', 'San Antonio', 'San Lorenzo Ruiz', 'San Roque', 'San Vicente', 'Santo Niño', 'United Bayanihan', 'United Better Living'];
  const escape = (value) => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const dateString = date => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  const money = amount => `₱ ${Number(amount || 0).toLocaleString('en-PH')}`;
  const location = barangay => `${barangay}, San Pedro, Laguna`;
  const barangayOf = profile => barangays.find(b => profile.location === location(b)) || '';
  const image = value => /^(https:\/\/|data:image\/(png|jpeg|webp|svg\+xml)[;,])/i.test(value || '') ? value : '';
  const link = value => { try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) ? url.href : ''; } catch { return ''; } };
  async function rpc(name, args = {}) {
    const db = await Envisage.client();
    const { data, error } = await db.rpc(name, args);
    if (error) throw error;
    return data;
  }
  async function rows(table, configure = q => q) {
    const db = await Envisage.client();
    const { data, error } = await configure(db.from(table).select('*'));
    if (error) throw error;
    return data;
  }
  async function message(id, body) {
    const db = await Envisage.client();
    const { error } = await db.from('booking_messages').insert({ booking_id: id, body });
    if (error) throw error;
  }
  const schedule = (id, from, to) => rpc('freelancer_schedule', {p_freelancer:id,p_from:from,p_to:to});
  function dayStatus(items) {
    if (!items.length) return 'Available';
    if (items.some(x=>x.kind==='Unavailable' && x.all_day)) return 'Unavailable';
    if (items.some(x=>x.kind==='Partially Booked')) return 'Partially Booked';
    if (items.some(x=>['Awaiting Confirmation','Awaiting Deposit'].includes(x.kind))) return 'Awaiting Deposit / Reserved';
    if (items.some(x=>x.kind==='Fully Booked')) return 'Fully Booked';
    const ranges = items.map(x => [x.start_time.slice(0,5), x.end_time.slice(0,5)]).sort((a,b) => a[0].localeCompare(b[0]));
    let end = '00:00';
    for (const range of ranges) { if (range[0] > end) break; if (range[1] > end) end = range[1]; }
    return items.some(x => x.all_day) || end === '24:00' ? 'Fully booked / unavailable' : 'Partly booked';
  }
  function watch(refresh) {
    let running = false;
    const run = async () => { if (running || document.hidden) return; running = true; try { await refresh(); } catch (error) { console.error(error); } finally { running = false; } };
    const timer = setInterval(run, 15000);
    window.addEventListener('focus', run);
    window.addEventListener('pagehide', () => clearInterval(timer), {once:true});
  }
  async function calendar(root, freelancerId, onSelect, options = {}) {
    const showClients = options.showClients === true && Envisage.profile.role === 'freelancer' && Envisage.profile.id === freelancerId;
    const month = new Date(`${today()}T12:00:00`); month.setDate(1);
    let selected = today(), version = 0;
    root.innerHTML = '<div class="calendar-heading"><button type="button" data-prev aria-label="Previous month">←</button><h3></h3><button type="button" data-next aria-label="Next month">→</button></div><div class="calendar-weekdays"><span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span></div><div class="calendar-grid"></div><p class="schedule-detail" role="status"></p><p class="calendar-note">Times are in Philippine time. Yellow: deposit received. Green: fully paid. Accepted requests reserve their listed time even before payment. Other times remain available.</p>';
    async function refresh() {
      const current = ++version;
      const from = dateString(month), to = dateString(new Date(month.getFullYear(),month.getMonth()+1,0));
      const [items, bookings] = await Promise.all([
        schedule(freelancerId,from,to),
        showClients ? rows('bookings',q=>q.eq('freelancer_id',freelancerId).gte('event_date',from).lte('event_date',to).in('status',['Awaiting Confirmation','Awaiting Deposit','Partially Booked','Fully Booked']).order('start_time')) : Promise.resolve([])
      ]);
      if (current !== version || !root.isConnected) return;
      root.querySelector('h3').textContent = month.toLocaleDateString('en-PH',{month:'long',year:'numeric'});
      const grid = root.querySelector('.calendar-grid');
      grid.innerHTML = '<span></span>'.repeat(month.getDay()) + Array.from({length:Number(to.slice(-2))}, (_,i) => {
        const date = `${from.slice(0,8)}${String(i+1).padStart(2,'0')}`;
        const state = dayStatus(items.filter(x => x.event_date === date));
        const dayBookings = bookings.filter(b=>b.event_date === date);
        const names = dayBookings.length ? '<span class="calendar-client-name">' + escape(dayBookings[0].client_name) + '</span>' + (dayBookings.length > 1 ? '<span class="calendar-booking-count">+' + (dayBookings.length-1) + ' more</span>' : '') : '';
        const clientLabel = dayBookings.map(b=>b.client_name).join(', ');
        const displayState = showClients ? ({'Fully Booked':'Booked','Partially Booked':'Deposit received','Awaiting Deposit / Reserved':'Reserved'}[state] || state) : state;
        return `<button type="button" data-day="${date}" class="calendar-day ${state === 'Fully Booked' ? 'fully-paid' : state === 'Partially Booked' ? 'partially-paid' : state !== 'Available' ? 'blocked' : ''} ${date===selected ? 'today' : ''} ${showClients && state === 'Awaiting Deposit / Reserved' ? 'calendar-reserved' : ''}" aria-label="${date}: ${state}${clientLabel ? ': ' + escape(clientLabel) : ''}"><b>${i+1}</b>${names}<small>${escape(displayState)}</small></button>`;
      }).join('');
      const detail = () => {
        const day = items.filter(x => x.event_date === selected).sort((a,b)=>a.start_time.localeCompare(b.start_time));
        root.querySelector('.schedule-detail').textContent = `${selected}: ${dayStatus(day)}. ${day.map(x=>`${x.all_day ? 'All day' : `${x.start_time.slice(0,5)}–${x.end_time.slice(0,5)}`} ${x.kind}`).join('; ')}`;
        if (showClients) {
          const summary = root.querySelector('.schedule-detail');
          const list = document.createElement('div');
          list.className = 'calendar-booking-details';
          bookings.filter(b=>b.event_date === selected).forEach(b=>{
            const link = document.createElement('a');
            link.className = 'calendar-booking-detail';
            link.href = detailUrl(b.id) + '#booking-record';
            const name = document.createElement('strong');
            name.textContent = b.client_name;
            const description = document.createElement('span');
            description.textContent = b.event_type + ' · ' + ({'Fully Booked':'Booked','Partially Booked':'Deposit received','Awaiting Confirmation':'Reserved','Awaiting Deposit':'Reserved'}[b.status] || b.status);
            link.append(name, description);
            list.append(link);
          });
          root.querySelector('.calendar-booking-details')?.remove();
          summary.after(list);
        }
      };
      detail();
      grid.querySelectorAll('[data-day]').forEach(button=>button.addEventListener('click',()=>{
        selected=button.dataset.day; grid.querySelectorAll('button').forEach(b=>b.classList.toggle('today',b===button)); detail(); onSelect?.(selected);
      }));
    }
    root.querySelector('[data-prev]').onclick = () => {month.setMonth(month.getMonth()-1); selected=dateString(month); refresh().catch(error=>root.querySelector('.schedule-detail').textContent=error.message);};
    root.querySelector('[data-next]').onclick = () => {month.setMonth(month.getMonth()+1); selected=dateString(month); refresh().catch(error=>root.querySelector('.schedule-detail').textContent=error.message);};
    await refresh();
    return refresh;
  }
  const activeBooking = b => ['Awaiting Confirmation','Awaiting Deposit','Partially Booked','Fully Booked'].includes(b.status);
  const depositReceived = b => ['Deposit Paid','Balance Due','Balance Payment Submitted','Fully Paid'].includes(b.payment_status);
  const paymentStatus = b => b.status === 'Partially Booked' && b.payment_status === 'Deposit Paid' && b.balance_due_date <= today() ? 'Balance Due' : b.payment_status;
  const bookingLabel = b => b.status + ' — ' + (b.status === 'Partially Booked' && b.payment_status === 'Deposit Paid' ? 'Deposit Paid' : paymentStatus(b));
  function paymentAmounts(b) {
    const total = Number(b.budget), deposit = b.deposit_amount == null ? null : Number(b.deposit_amount);
    const balance = deposit == null ? null : Math.round((total-deposit)*100)/100;
    return {total,deposit,balance,outstanding:b.payment_status==='Fully Paid'?0:depositReceived(b)?balance:total};
  }
  function actions(b) {
    const role = Envisage.profile.role, result = [];
    if (role==='freelancer' && b.status==='Inquiry Sent') result.push(['accept','Accept Request'],['decline','Decline Request']);
    if (role==='client' && !b.cancellation_requested_at) {
      if (b.status==='Awaiting Confirmation') result.push(['acknowledge','Acknowledge & Continue']);
      if (b.status==='Awaiting Deposit' && b.payment_status==='Deposit Required') result.push(['pay_deposit','Pay Deposit']);
      if (b.status==='Partially Booked' && ['Deposit Paid','Balance Due'].includes(b.payment_status)) result.push(['pay_balance','Pay Remaining Balance']);
      if (b.status==='Fully Booked' && b.payment_status==='Fully Paid' && b.event_date<=today() && !b.client_completed) result.push(['client_complete','Mark service completed']);
    }
    if (role==='freelancer') {
      if (b.status==='Awaiting Deposit' && b.payment_status==='Deposit Payment Submitted') result.push(['confirm_deposit','Confirm Deposit Received'],['report_payment','Report Payment Issue']);
      if (b.status==='Partially Booked' && b.payment_status==='Balance Payment Submitted') result.push(['confirm_final','Confirm Balance Received'],['report_payment','Report Payment Issue']);
      if (b.status==='Fully Booked' && b.payment_status==='Fully Paid' && b.event_date<=today() && b.client_completed) result.push(['complete','Confirm service completed']);
    }
    if (role==='freelancer' && (b.status==='Inquiry Sent' || activeBooking(b))) result.push(['cancel','Cancel booking']);
    return b.cancellation_requested_at ? result.filter(([action]) => ['confirm_deposit','confirm_final','report_payment','cancel'].includes(action)) : result;
  }
  const actionButtons = (b,omit=[]) => actions(b).filter(([action])=>!omit.includes(action)).map(([action,label])=>{
    const attribute = ['pay_deposit','pay_balance','report_payment','accept'].includes(action) ? 'data-payment-action' : 'data-action';
    return '<button type="button" class="lifecycle-button '+(['cancel','decline','report_payment'].includes(action)?'secondary':'')+'" '+attribute+'="'+action+'" data-id="'+escape(b.id)+'">'+label+'</button>';
  }).join('');
  const detailUrl = id => `${Envisage.profile.role==='client'?'client-booking.html':'accepted-booking.html'}?id=${encodeURIComponent(id)}`;
  const listBookingLabel = b => {
    if (b.cancellation_requested_at && b.status !== 'Cancelled') return 'Cancellation requested';
    if (['Cancelled','Declined','Completed'].includes(b.status)) return b.status;
    if (b.payment_status === 'Fully Paid') return 'Fully paid · Booking confirmed';
    if (b.payment_status === 'Balance Payment Submitted') return 'Balance sent · Awaiting confirmation';
    if (b.payment_status === 'Deposit Payment Submitted') return 'Deposit sent · Awaiting confirmation';
    if (depositReceived(b)) return 'Deposit received · Balance due';
    if (b.status === 'Awaiting Confirmation') return 'Accepted · Review agreement';
    if (b.status === 'Awaiting Deposit') return 'Accepted · Deposit due';
    return 'Waiting for freelancer';
  };
  const listPaymentSummary = b => {
    const amounts = paymentAmounts(b), paid = amounts.total - amounts.outstanding;
    return 'Total ' + money(amounts.total) + ' · Paid ' + money(paid) +
      (['Cancelled','Declined'].includes(b.status) ? '' : ' · Remaining ' + money(amounts.outstanding));
  };
  const bookingCard = (b, context = 'detail') => context !== 'detail' && Envisage.profile.role !== 'admin' ? `<article class="booking-request compact-booking"><div class="request-summary"><div>${context === 'messages' ? '' : `<p class="booking-status-badge ${b.status === 'Partially Booked' ? 'status-partial' : ['Fully Booked','Completed'].includes(b.status) ? 'status-complete' : ''}">${escape(b.status)}</p>`}<h2>${escape(b.event_type)}</h2><p>${escape(Envisage.profile.role === 'client' ? b.freelancer_name : b.client_name)}</p></div></div><p>${escape(b.event_date)} · ${escape(b.start_time.slice(0,5))}–${escape(b.end_time.slice(0,5))}</p>${context === 'bookings' ? `<p>${escape(listBookingLabel(b))}</p><p>${escape(listPaymentSummary(b))}</p>` : '<p>View your conversation and shared payment receipts.</p>'}<div class="request-actions"><a class="accept-request" href="${detailUrl(b.id)}${context === 'messages' ? '#shared-messages' : '#booking-record'}">${context === 'messages' ? 'Open conversation →' : 'View booking →'}</a></div></article>` : `<article class="booking-request"><div class="request-summary"><div><p class="eyebrow">${escape(context === 'detail' ? bookingLabel(b) : listBookingLabel(b))}</p><h2>${escape(b.event_type)}</h2><p class="booking-participants">${escape(b.client_name)} → ${escape(b.freelancer_name)}</p></div><strong>${money(b.budget)}</strong></div><dl class="request-details"><div><dt>Date</dt><dd>${escape(b.event_date)}</dd></div><div><dt>Time</dt><dd>${escape(b.start_time.slice(0,5))}–${escape(b.end_time.slice(0,5))}</dd></div><div><dt>Location</dt><dd>${escape(b.location)}</dd></div><div><dt>Services</dt><dd>${escape(b.services.join(', '))}</dd></div></dl><p>${escape(b.note)}</p><p>Booking: <strong>${escape(b.status)}</strong> — Payment: <strong>${escape(paymentStatus(b))}</strong></p><p>${escape(listPaymentSummary(b))}</p><div class="request-actions">${Envisage.profile.role==='admin'?actionButtons(b):`<a class="accept-request" href="${detailUrl(b.id)}${context === 'messages' ? '#shared-messages' : ''}">${context === 'messages' ? 'Open conversation →' : 'View booking →'}</a>`}</div></article>`;
  async function bindActions(root, refresh, status) {
    root.addEventListener('click', async event => {
      const button = event.target.closest('[data-action]'); if (!button) return;
      button.disabled=true;
      try { await rpc('transition_booking',{p_id:button.dataset.id,p_action:button.dataset.action}); status.textContent='Booking updated.'; await refresh(); }
      catch(error) {status.textContent=error.message; button.disabled=false;}
    });
  }
  for (const id of ['profile-location','creative-location']) {
    const old = document.getElementById(id); if (!old) continue;
    const select = document.createElement('select'); select.id=id; select.name=old.name; select.required=old.required;
    select.innerHTML='<option value="">Choose a San Pedro barangay</option>'+barangays.map(b=>`<option value="${escape(location(b))}">${escape(b)}</option>`).join(''); old.replaceWith(select);
  }
  window.Marketplace = {barangays,escape,today,dateString,money,location,barangayOf,image,link,rpc,rows,message,schedule,dayStatus,watch,calendar,activeBooking,depositReceived,paymentStatus,bookingLabel,paymentAmounts,actions,actionButtons,detailUrl,bookingCard,bindActions};
})();

