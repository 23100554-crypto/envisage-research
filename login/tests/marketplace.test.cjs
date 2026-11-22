const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function setup(role = 'client') {
  const window = {};
  const context = vm.createContext({ window, document: { getElementById: () => null }, Envisage: { profile: { role } }, URL, Intl, Date });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../marketplace.js'), 'utf8'), context);
  return window.Marketplace;
}

test('location matching uses exact San Pedro barangays', () => {
  const api = setup();
  assert.equal(api.barangayOf({ location: 'Pacita 1, San Pedro, Laguna' }), 'Pacita 1');
  assert.equal(api.barangayOf({ location: 'Pacita 2, San Pedro, Laguna' }), 'Pacita 2');
  assert.equal(api.barangayOf({ location: 'Metro Manila' }), '');
  assert.equal(api.barangays.length, 27);
});
test('calendar distinguishes open, partial, and fully occupied days', () => {
  const api = setup();
  assert.equal(api.dayStatus([]), 'Available');
  assert.equal(api.dayStatus([{ start_time: '09:00:00', end_time: '17:00:00' }]), 'Partly booked');
  assert.equal(api.dayStatus([{ start_time: '00:00:00', end_time: '24:00:00', all_day: true }]), 'Fully booked / unavailable');
  assert.equal(api.dayStatus([{ start_time: '12:00:00', end_time: '24:00:00' }, { start_time: '00:00:00', end_time: '12:00:00' }]), 'Fully booked / unavailable');
  assert.equal(api.dayStatus([{ start_time: '00:00:00', end_time: '10:00:00' }, { start_time: '11:00:00', end_time: '24:00:00' }]), 'Partly booked');
});
test('freelancers accept requests without an admin approval action', () => {
  for (const role of ['client','freelancer','admin']) {
    for (const status of ['Inquiry','Inquiry Sent','Awaiting Confirmation','Completed']) {
      assert.ok(!setup(role).actions({status}).some(([action]) => ['approve','reject'].includes(action)));
    }
  }
  assert.ok(setup('freelancer').actions({status:'Inquiry Sent'}).some(([action,label]) => action === 'accept' && label === 'Accept Request'));
});
test('inquiries and requests show the next action for the correct role', () => {
  assert.ok(!setup('client').actions({ status: 'Inquiry Sent' }).some(([action]) => action === 'request'));
  assert.ok(setup('freelancer').actions({ status: 'Inquiry Sent' }).some(([action]) => action === 'accept'));
  assert.equal(setup('client').actions({ status: 'Cancelled' }).length, 0);
});
test('profile output escapes markup and rejects executable links', () => {
  const api = setup();
  assert.equal(api.link('javascript:alert(1)'), '');
  assert.equal(api.image('javascript:alert(1)'), '');
  assert.equal(api.escape('<img src=x onerror="alert(1)">'), '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
});
test('all booking pages load shared Supabase scripts', () => {
  for (const file of ['clients/client-bookings.html', 'freelancers/bookings.html']) {
    assert.match(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), /data-app-src="\.\.\/booking-list\.js"/);
  }
  for (const file of ['clients/client-messages.html', 'freelancers/inquiries.html']) {
    assert.match(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), /data-app-src="\.\.\/booking-inbox\.js"/);
  }
  for (const file of ['clients/client-booking.html', 'freelancers/accepted-booking.html', 'clients/client-inquiry-thread.html', 'freelancers/inquiry-thread.html']) {
    assert.match(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), /data-app-src="\.\.\/booking-detail\.js"/);
  }
  assert.doesNotMatch(fs.readFileSync(path.join(__dirname, '../clients/discovery.html'), 'utf8'), /Maria Ortega|Jiro Lim|Ana Cruz/);
});

test('payment actions follow acknowledgement, submission and freelancer receipt in order', () => {
 const client=setup('client'),freelancer=setup('freelancer');
 const names=(api,b)=>api.actions(b).map(([action])=>action);
 assert.ok(names(client,{status:'Awaiting Confirmation'}).includes('acknowledge'));
 assert.ok(!names(client,{status:'Awaiting Confirmation'}).includes('pay_deposit'));
 assert.ok(names(client,{status:'Awaiting Deposit',payment_status:'Deposit Required'}).includes('pay_deposit'));
 assert.ok(!names(client,{status:'Awaiting Deposit',payment_status:'Deposit Required'}).includes('pay_balance'));
 assert.ok(!names(freelancer,{status:'Awaiting Deposit',payment_status:'Deposit Required'}).includes('confirm_deposit'));
 assert.ok(names(freelancer,{status:'Awaiting Deposit',payment_status:'Deposit Payment Submitted'}).includes('confirm_deposit'));
 assert.ok(names(freelancer,{status:'Awaiting Deposit',payment_status:'Deposit Payment Submitted'}).includes('report_payment'));
 assert.ok(names(client,{status:'Partially Booked',payment_status:'Deposit Paid',balance_due_date:'2000-01-01'}).includes('pay_balance'));
 assert.ok(names(client,{status:'Partially Booked',payment_status:'Deposit Paid',balance_due_date:'2999-01-01'}).includes('pay_balance'));
 assert.ok(!names(client,{status:'Partially Booked',payment_status:'Balance Payment Submitted'}).includes('pay_balance'));
 assert.ok(names(freelancer,{status:'Partially Booked',payment_status:'Balance Payment Submitted'}).includes('confirm_final'));
 assert.ok(!names(client,{status:'Partially Booked',payment_status:'Deposit Paid',event_date:'2000-01-01'}).includes('client_complete'));
});
test('calendar and admin distinguish verified deposit from verified balance', () => {
 const api=setup('admin');
 assert.equal(api.dayStatus([{kind:'Partially Booked'}]),'Partially Booked');
 assert.equal(api.dayStatus([{kind:'Fully Booked'}]),'Fully Booked');
 assert.equal(api.dayStatus([{kind:'Awaiting Deposit'}]),'Awaiting Deposit / Reserved');
 const partial={status:'Partially Booked',payment_status:'Deposit Paid',budget:5000,deposit_amount:2000};
 assert.equal(api.bookingLabel(partial),'Partially Booked — Deposit Paid');
 assert.equal(api.paymentAmounts(partial).balance,3000);
 assert.equal(api.paymentAmounts({...partial,payment_status:'Fully Paid'}).outstanding,0);
 assert.equal(api.bookingLabel({status:'Fully Booked',payment_status:'Fully Paid'}),'Fully Booked — Fully Paid');
});
