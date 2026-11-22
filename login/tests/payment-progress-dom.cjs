const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
module.exports=async function run(parseHTML) {
  const tick=()=>new Promise(resolve=>setTimeout(resolve,0));
  async function setup(role,status,payment_status,extra={}) {
    const file=role==='client'?'clients/client-booking.html':'freelancers/accepted-booking.html';
    const {window}=parseHTML(fs.readFileSync(path.join(__dirname,'..',file),'utf8'));
    const document=window.document,calls=[];
    const booking={id:'booking',client_id:'client',freelancer_id:'freelancer',client_name:'Client',freelancer_name:'Freelancer',event_type:'Birthday',event_date:'2099-01-01',start_time:'09:00',end_time:'12:00',location:'Pacita 1, San Pedro, Laguna',services:['Videography'],budget:5000,deposit_amount:2000,balance_due_date:'2000-01-01',payment_qr:'data:image/png;base64,aGVsbG8=',payment_payee:'Freelancer account',status,payment_status,...extra};
    let failure;
    const context=vm.createContext({window,document,location:{search:'?id=booking'},URL,URLSearchParams,Intl,Date,console,setInterval:()=>0,clearInterval(){},Envisage:{profile:{id:role,role}}});
    vm.runInContext(fs.readFileSync(path.join(__dirname,'../marketplace.js'),'utf8'),context);
    vm.runInContext(fs.readFileSync(path.join(__dirname,'../booking-form-controls.js'),'utf8'),context);
    context.BookingFormControls=window.BookingFormControls;
    const bindAmounts = context.BookingFormControls.bindAmounts;
    context.BookingFormControls.bindAmounts = root => {
      root.querySelectorAll('form').forEach(form => Object.defineProperty(form, 'elements', { configurable:true, value:Object.fromEntries([...form.querySelectorAll('[name]')].map(input=>[input.name,input])) }));
      bindAmounts(root);
    };
    const M=window.Marketplace;context.Marketplace=M;
    let reviews=[];
    M.rows=async table=>table==='bookings'?[booking]:table==='booking_reviews'?reviews:[];
    M.watch=()=>{};
    M.rpc=async (name,args)=>{
      calls.push({name,args});if(failure)throw new Error(failure);
      if(name==='submit_booking_review')reviews=[{rating:args.p_rating,comment:args.p_comment}];
      if(name==='transition_booking'){
        if(args.p_action==='acknowledge')booking.status='Awaiting Deposit';
        if(args.p_action==='deposit')booking.payment_status='Deposit Payment Submitted';
        if(args.p_action==='final_paid')booking.payment_status='Balance Payment Submitted';
        if(args.p_action==='confirm_deposit'){booking.status='Partially Booked';booking.payment_status='Deposit Paid';}
        if(args.p_action==='confirm_final'){booking.status='Fully Booked';booking.payment_status='Fully Paid';}
      }
    };
    context.Envisage.client=async()=>({rpc:async(name,args)=>{await M.rpc(name,args);return {data:booking};}});
    vm.runInContext(fs.readFileSync(path.join(__dirname,'../booking-chat-payments.js'),'utf8'),context);
    vm.runInContext(fs.readFileSync(path.join(__dirname,'../booking-documents.js'),'utf8'),context);
    vm.runInContext(fs.readFileSync(path.join(__dirname,'../review-controls.js'),'utf8'),context);
    await vm.runInContext(fs.readFileSync(path.join(__dirname,'../booking-detail.js'),'utf8'),context);
    return {window,document,calls,booking,fail(value){failure=value;},click(selector){const button=document.querySelector(selector);assert.ok(button,selector);button.click();},submit(selector){const form=document.querySelector(selector);form.dispatchEvent(new window.Event('submit',{cancelable:true}));}};
  }
  const client=await setup('client','Awaiting Confirmation','Deposit Required');
  assert.equal(client.document.querySelector('#booking-ack-dialog').hasAttribute('open'),false);
  assert.ok(client.document.querySelector('#chat-agreement-form'));
  client.submit('#chat-agreement-form');await tick();
  assert.equal(client.calls.length,0,'agreement requires explicit acceptance');
  client.document.querySelector('#chat-agreement-form input').checked=true;
  client.submit('#chat-agreement-form');await tick();
  assert.equal(client.booking.status,'Awaiting Deposit');
  assert.ok(client.document.querySelector('#chat-payment-form'));
  assert.match(client.document.querySelector('#chat-payment-controls').textContent,/GCash/);
  assert.equal(client.document.querySelectorAll('[data-action="deposit"]').length,0,'no photo-free shortcut');
  const missing=await setup('client','Awaiting Deposit','Deposit Required',{payment_qr:''});
  assert.equal(missing.document.querySelector('#chat-payment-form'),null);
  const freelancer=await setup('freelancer','Awaiting Deposit','Deposit Payment Submitted');
  assert.match(freelancer.document.querySelector('#chat-payment-form').textContent,/Confirm payment received/);
  assert.equal(freelancer.document.querySelector('[data-action="confirm_deposit"]'),null);
  const balance=await setup('freelancer','Partially Booked','Balance Payment Submitted');
  balance.click('[data-payment-action="report_payment"]');
  balance.document.querySelector('#payment-reason').value='Payment amount does not match';
  balance.submit('#payment-issue-form');await tick();
  assert.equal(balance.calls.at(-1).name,'report_booking_payment');
  const future=await setup('client','Partially Booked','Deposit Paid',{balance_due_date:'2099-01-01'});
  assert.match(future.document.querySelector('#chat-payment-form').textContent,/3,000/);
  assert.ok(future.document.querySelector('#chat-payment-photo').hasAttribute('required'));
  const waiting=await setup('client','Awaiting Deposit','Deposit Payment Submitted');
  assert.equal(waiting.document.querySelector('#chat-payment-form'),null);
  assert.match(waiting.document.querySelector('#chat-payment-controls').textContent,/Waiting for the freelancer/);
  const inquiry=await setup('freelancer','Inquiry Sent','Deposit Required');
  assert.ok(inquiry.document.querySelector('#payment-terms-form'));
  assert.match(inquiry.document.querySelector('#payment-terms-form button').textContent,/Accept request/i);
  assert.ok(inquiry.document.querySelector('[data-document-action="cancel"]'));
  const unfinished=await setup('client','Fully Booked','Fully Paid');
  assert.equal(unfinished.document.querySelector('#booking-review-form'),null);
  assert.equal(unfinished.document.querySelector('[data-action="cancel"]'),null);
  const completed=await setup('client','Completed','Fully Paid');
  const rating=completed.document.querySelector('[name="rating"]');
  Object.defineProperty(rating,'value',{value:'5',writable:true});rating.checked=true;rating.setAttribute('checked','');
  completed.document.querySelector('[name="comment"]').value='Wonderful service for our birthday event.';
  completed.submit('#booking-review-form');await tick();
  assert.equal(completed.calls.at(-1).name,'submit_booking_review');
  assert.equal(completed.calls.at(-1).args.p_rating,5);
  assert.equal(completed.document.querySelector('#booking-review-form'),null,'submitted review cannot be written twice');
  assert.match(completed.document.querySelector('#booking-record').textContent,/Wonderful service/);
  const other=await setup('client','Completed','Fully Paid',{client_id:'another-client'});
  assert.equal(other.document.querySelector('#booking-review-form'),null);
  return 'PASS: inline agreement, chat payment stages, receipt waiting, payment reports, acceptance terms and completed reviews';
};
