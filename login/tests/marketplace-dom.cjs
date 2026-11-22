// Optional DOM regression suite: invoke run(parseHTML) with LinkeDOM's parser.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.join(__dirname, '..');
module.exports = async function run(parseHTML) {
  const directory = [
    { id: 'maya', name: 'Maya Santos', profile: { location: 'Pacita 1, San Pedro, Laguna', services: ['Photography'] } },
    { id: 'lucas', name: 'Lucas Reyes', profile: { location: 'San Vicente, San Pedro, Laguna', services: ['Videography'] } },
    { id: 'isabel', name: 'Isabel Cruz', profile: { location: 'Calendola, San Pedro, Laguna', services: ['Editing'] } },
  ];
  const booking = { id: 'booking-test', client_id: 'client', freelancer_id: 'maya', client_name: 'Daniel Garcia', freelancer_name: 'Maya Santos', event_type: 'Birthday', event_date: '2026-10-29', start_time: '09:00:00', end_time: '12:00:00', location: 'Pacita 1, San Pedro, Laguna', services: ['Photography'], budget: 5000, note: 'Test', status: 'Awaiting Deposit', payment_status: 'Deposit Required', deposit_amount:2000, balance_due_date:'2026-10-29', agreement_acknowledged:true };
  const tick = () => new Promise(resolve => setTimeout(resolve, 0));
  function setup(file, role = 'client') {
    const { window } = parseHTML(fs.readFileSync(path.join(root, file), 'utf8'));
    const document = window.document;
    const location = { search: '', pathname: '/' + file, href: 'http://localhost/' + file };
    window.location = location;
    for (const dialog of document.querySelectorAll('dialog')) {
      dialog.showModal = () => { dialog.open = true; };
      dialog.close = () => { dialog.open = false; };
    }
    for (const form of document.querySelectorAll('form')) form.reset = () => {};
    const calls = [];
    const profile = { id: role === 'freelancer' ? 'maya' : role, name: role, role, freelancer_profile: directory[0].profile };
    const db = {
      rpc: async (name, args) => {
        calls.push({ name, args });
        return { data: name === 'freelancer_directory' ? directory : name === 'freelancer_schedule' ? [] : booking };
      },
      from: table => {
        const query = { select: () => query, eq: () => query, gte: () => query, lte: () => query, in: () => query, order: () => query,
          then: resolve => Promise.resolve({ data: table === 'bookings' ? [booking] : table === 'service_categories' ? ['Photography','Videography','Editing'].map(name => ({name})) : [] }).then(resolve) };
        return query;
      },
    };
    const context = vm.createContext({ window, document, location, URL, URLSearchParams, Intl, Date, console, Envisage: { profile, client: async () => db }, setInterval: () => 0, clearInterval() {}, ResizeObserver: class { observe() {} }, requestAnimationFrame: fn => fn() });
    vm.runInContext(fs.readFileSync(path.join(root, 'marketplace.js'), 'utf8'), context);
    context.Marketplace = window.Marketplace;
    vm.runInContext(fs.readFileSync(path.join(root, 'booking-form-controls.js'), 'utf8'), context);
    context.BookingFormControls = window.BookingFormControls;
    const bindAmounts = context.BookingFormControls.bindAmounts;
    context.BookingFormControls.bindAmounts = root => {
      root.querySelectorAll('form').forEach(form => Object.defineProperty(form, 'elements', { configurable:true, value:Object.fromEntries([...form.querySelectorAll('[name]')].map(input=>[input.name,input])) }));
      bindAmounts(root);
    };
    vm.runInContext(fs.readFileSync(path.join(root, 'booking-chat-payments.js'), 'utf8'), context);
    return { window, document, context, calls, run: file => vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context) };
  }
  const d = setup('clients/discovery.html');
  await d.run('clients/discovery.js');
  assert.equal(d.document.querySelectorAll('.creative-card').length, 3);
  d.document.querySelector('[data-barangay="Pacita 1"]').click();
  assert.equal(d.document.querySelectorAll('.creative-card').length, 1);
  assert.match(d.document.querySelector('.profile-grid').textContent, /Maya Santos/);
  d.document.querySelector('[data-barangay="Cuyab"]').dispatchEvent(new d.window.Event('mouseenter'));
  assert.equal(d.document.querySelector('#location-preview'),null);
  assert.equal(d.document.querySelector('.discovery-map-section').hidden,true);
  assert.equal(d.document.querySelectorAll('.barangay-option span').length, 0);
  assert.doesNotMatch(d.document.querySelector('#result-summary').textContent, /\d+ freelancers?/);
  d.document.querySelector('[data-barangay="Cuyab"]').click();
  assert.equal(d.document.querySelectorAll('.creative-card').length, 0);
  d.document.querySelector('[data-barangay=""]').click();
  assert.equal(d.document.querySelector('.discovery-map-section').hidden,false);
  d.document.querySelectorAll('.filter')[2].click();
  assert.equal(d.document.querySelectorAll('.creative-card').length, 1);
  assert.match(d.document.querySelector('.profile-grid').textContent, /Lucas Reyes/);
  d.document.querySelectorAll('.filter')[0].click();
  d.document.querySelector('[data-id="maya"]').click();
  await tick();
  assert.equal(d.document.querySelector('#inquiry-thread').open, true);
  assert.ok(d.document.querySelectorAll('#inquiry-calendar [data-day]').length >= 28);
  for (const [id, value] of Object.entries({ 'event-type': 'Birthday', 'event-date': '2099-10-29', 'event-location': 'Pacita 1, San Pedro, Laguna', budget: '5000', details: 'Coverage' })) {
    const input = d.document.getElementById(id);
    if (input.tagName === 'SELECT') Object.defineProperty(input, 'value', { value, writable: true, configurable: true });
    else input.value = value;
  }
  d.document.querySelector('[name="requested-service"][value="Photography"]').setAttribute('checked', '');
  d.document.querySelector('#booking-form').dispatchEvent(new d.window.Event('submit', { cancelable: true }));
  await tick();
  const request = d.calls.find(call => call.name === 'create_booking').args.p_request;
  assert.equal(request.freelancer_id, 'maya');
  assert.equal(request.location, 'Pacita 1, San Pedro, Laguna');
  assert.match(d.context.location.href, /client-booking.html\?id=booking-test/);
  for (const [file, script, role] of [
    ['clients/client-bookings.html', 'booking-list.js', 'client'],
    ['freelancers/bookings.html', 'booking-list.js', 'freelancer'],
    ['clients/client-booking.html', 'booking-detail.js', 'client'],
    ['freelancers/accepted-booking.html', 'booking-detail.js', 'freelancer'],
  ]) {
    const page = setup(file, role);
    page.context.location.search = '?id=booking-test';
    await page.run(script);
    assert.equal(page.document.querySelectorAll('.booking-request').length, 1, file);
    assert.equal(page.document.querySelectorAll('[data-action="approve"]').length, 0, file);

  }
  const calendarPage = setup('freelancers/availability.html', 'freelancer');
  await calendarPage.run('freelancers/availability.js');
  assert.ok(calendarPage.document.querySelectorAll('[data-day]').length >= 28);
  const month = calendarPage.document.querySelector('.calendar-panel h3').textContent;
  calendarPage.document.querySelector('[data-next]').click();
  await tick();
  assert.notEqual(calendarPage.document.querySelector('.calendar-panel h3').textContent, month);
  return 'PASS: directory, location hover/filter, service filter, inquiry submission, role-specific booking pages without admin approval, and calendar navigation';
};
