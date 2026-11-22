const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
module.exports=async function run(parseHTML) {
  const tick=()=>new Promise(resolve=>setTimeout(resolve,0));
  for(const role of ['client','freelancer']) {
    const {window}=parseHTML(fs.readFileSync(path.join(__dirname,'..',role==='client'?'clients/notifications.html':'freelancers/notifications.html'),'utf8'));
    const document=window.document,stored={},calls=[];
    window.location={href:''};
    delete window.BookingNotifications;
    const notices=[{id:'n1',booking_id:'b1',title:role==='client'?'Booking Request Accepted':'New Booking Request',body:'<img src=x onerror=alert(1)>',created_at:'2026-10-03T05:00:00Z',read_at:null}];
    const db={from:()=>({select:()=>({is:async()=>({count:notices.filter(n=>!n.read_at).length})}),update:value=>({eq:async(key,id)=>{calls.push(id);notices.find(n=>n.id===id).read_at=value.read_at;return {};}})})};
    const context=vm.createContext({window,document,URL,Intl,Date,console,Envisage:{profile:{id:role,role},client:async()=>db},sessionStorage:{getItem:k=>stored[k],setItem:(k,v)=>stored[k]=v}});
    vm.runInContext(fs.readFileSync(path.join(__dirname,'../marketplace.js'),'utf8'),context);
    context.Marketplace=window.Marketplace;
    context.Marketplace.rows=async()=>notices;
    context.Marketplace.watch=()=>{};
    vm.runInContext(fs.readFileSync(path.join(__dirname,'../booking-notifications.js'),'utf8'),context);
    await window.BookingNotifications.ready;
    assert.equal(document.querySelector('#booking-unread-count').textContent,'1');
    assert.match(document.querySelector('#notification-list').textContent,new RegExp(notices[0].title));
    assert.equal(document.querySelector('#booking-notification-preview img'),null,'notification content is escaped');
    assert.equal(document.querySelector('.booking-notification-toast').hidden,false);
    assert.match(document.querySelector('[data-notification]').getAttribute('href'),role==='client'?/client-booking.html\?id=b1/:/accepted-booking.html\?id=b1/);
    assert.match(document.querySelector('[data-notification]').getAttribute('href'),/#shared-messages$/);
    assert.equal(document.querySelector('#notification-list .booking-request'),null,'notifications contain updates, not booking/payment forms');
    assert.ok(document.querySelector('.notification-unread-dot'));
    document.querySelector('[data-read-notification]').click();await tick();await tick();
    assert.equal(calls[0],'n1');
    assert.equal(document.querySelector('#booking-unread-count').textContent,'0');
    assert.equal(document.querySelector('.booking-notification-toast').hidden,true);
    notices.unshift({id:'n2',booking_id:'b2',title:'Deposit Payment Submitted',body:'Please verify receipt.',created_at:'2026-10-03T05:01:00Z'});
    await window.BookingNotifications.refresh();
    assert.equal(document.querySelector('#booking-unread-count').textContent,'1');
    assert.equal(document.querySelector('.booking-notification-toast').hidden,false);
    assert.match(document.querySelector('.booking-notification-toast').textContent,/Deposit Payment Submitted/);
    assert.match(document.querySelector('[data-notification="n2"]').getAttribute('href'),/#chat-payment-controls$/);
    document.querySelector('[data-notification="n2"]').click();await tick();await tick();
    assert.equal(calls.at(-1),'n2','opening a notification marks it read');
    assert.match(window.location.href,role==='client'?/client-booking.html\?id=b2#chat-payment-controls$/:/accepted-booking.html\?id=b2#chat-payment-controls$/);
    if(role==='freelancer') {
      notices.unshift({id:'warning',booking_id:'b2',kind:'account_warning',title:'Admin warning',body:'Read your warning',created_at:'2026-10-03T05:02:00Z'});
      await window.BookingNotifications.refresh();
      assert.equal(document.querySelector('[data-notification="warning"]').getAttribute('href'),'freelancer-profile.html#warnings');
      notices[0].kind='booking_review';await window.BookingNotifications.refresh();
      assert.equal(document.querySelector('[data-notification="warning"]').getAttribute('href'),'freelancer-profile.html#client-reviews');
    }
  }
  return 'PASS: compact notifications, unread indicators, click-to-read, original message/payment destinations, escaped content and profile exceptions';
};
