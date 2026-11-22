const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('node:assert/strict');
module.exports = async function run(parseHTML) {
  const tick = () => new Promise(resolve => setTimeout(resolve, 0));
  async function setup(role = 'client', state = 'Awaiting Deposit', payment = 'Deposit Required') {
    const {window} = parseHTML('<html><body><main id="client-booking"></main></body></html>');
    const document = window.document, calls = [], uploads = [], removed = [], messages = [];
    const booking = {id:'b',client_id:'client',freelancer_id:'freelancer',client_name:'Client',freelancer_name:'Freelancer',event_type:'Birthday',event_date:'2099-01-01',start_time:'09:00',end_time:'12:00',location:'San Pedro',services:['Photography'],budget:5000,deposit_amount:2000,balance_due_date:'2099-01-01',payment_payee:'Freelancer account',payment_qr:'data:image/png;base64,aGVsbG8=',status:state,payment_status:payment};
    let failure = '', uploadFailure = '', refreshFailure = false;
    const storage = {
      upload: async (p,file,options) => {uploads.push({p,file,options});return {error:uploadFailure ? new Error(uploadFailure) : null};},
      remove: async paths => {removed.push(...paths); return {};},
      createSignedUrl: async p => ({data:{signedUrl:'https://private.test/'+p}}),
    };
    const context = vm.createContext({window,document,location:{search:'?id=b'},URL:Object.assign(class extends URL {},{createObjectURL:()=> 'blob:preview',revokeObjectURL:()=>{}}),URLSearchParams,Date,Intl,crypto:{randomUUID:()=> 'photo-id'},Envisage:{profile:{id:role,role},client:async()=>({storage:{from:()=>storage}})},console,setInterval:()=>0,clearInterval(){}});
    vm.runInContext(fs.readFileSync(path.join(__dirname,'../marketplace.js'),'utf8'),context);
    vm.runInContext(fs.readFileSync(path.join(__dirname,'../booking-form-controls.js'),'utf8'),context);
    context.BookingFormControls=window.BookingFormControls;
    const bindAmounts = context.BookingFormControls.bindAmounts;
    context.BookingFormControls.bindAmounts = root => {
      root.querySelectorAll('form').forEach(form => Object.defineProperty(form, 'elements', { configurable:true, value:Object.fromEntries([...form.querySelectorAll('[name]')].map(input=>[input.name,input])) }));
      bindAmounts(root);
    };
    const M = window.Marketplace;context.Marketplace = M;
    M.rows = async table => {if(refreshFailure) throw new Error('Refresh failed');return table==='bookings'?[booking]:table==='booking_messages'?messages:[];};
    M.watch = () => {};
    M.message = async (id,body) => { calls.push({name:'text',body}); };
    M.rpc = async (name,args) => {
      calls.push({name,args});if(failure)throw new Error(failure);
      if(name==='send_booking_payment') {
        const stage=booking.status==='Awaiting Deposit'?'deposit':'balance';
        messages.push({id:String(messages.length),sender_id:role,kind:args.p_kind,body:args.p_note||'Saved payment',image_path:args.p_path,payment_stage:stage,payment_method:args.p_method,payment_amount:stage==='deposit'?2000:3000,created_at:new Date().toISOString()});
        if(args.p_kind==='payment_sent')booking.payment_status=stage==='deposit'?'Deposit Payment Submitted':'Balance Payment Submitted';
        else {booking.status=stage==='deposit'?'Partially Booked':'Fully Booked';booking.payment_status=stage==='deposit'?'Deposit Paid':'Fully Paid';}
      }
      if(name==='send_booking_photo')messages.push({sender_id:role,kind:'photo',image_path:args.p_path,body:args.p_note,created_at:new Date().toISOString()});
    };
    vm.runInContext(fs.readFileSync(path.join(__dirname,'../booking-chat-payments.js'),'utf8'),context);
    await vm.runInContext(fs.readFileSync(path.join(__dirname,'../booking-detail.js'),'utf8'),context);
    return {window,document,calls,uploads,removed,booking,messages,M,
      file(selector,file){const input=document.querySelector(selector);Object.defineProperty(input,'files',{value:file?[file]:[],configurable:true});input.dispatchEvent(new window.Event('change'));},
      submit(selector){document.querySelector(selector).dispatchEvent(new window.Event('submit',{cancelable:true}));},
      fail(value){failure=value;},failUpload(value){uploadFailure=value;},failRefresh(value){refreshFailure=value;}};
  }
  const photo = {name:'receipt.png',type:'image/png',size:100};
  const client = await setup();
  assert.equal(client.document.querySelectorAll('.chat-payment-methods input').length,5);
  client.submit('#chat-payment-form');await tick();
  assert.equal(client.uploads.length,0);assert.equal(client.calls.length,0);
  assert.match(client.document.querySelector('#chat-payment-feedback').textContent,/Attach/);
  client.file('#chat-payment-photo',{name:'receipt.svg',type:'image/svg+xml',size:20});
  assert.match(client.document.querySelector('#chat-payment-feedback').textContent,/JPG/);
  client.file('#chat-payment-photo',photo);
  assert.equal(client.document.querySelector('#chat-payment-preview').hidden,false);
  client.failUpload('Upload failed');client.submit('#chat-payment-form');await tick();
  assert.equal(client.calls.length,0,'failed upload must not change payment status');
  assert.match(client.document.querySelector('#chat-payment-feedback').textContent,/Upload failed/);
  client.failUpload('');client.fail('Payment stage changed');client.submit('#chat-payment-form');await tick();
  assert.equal(client.removed.length,1,'unpublished upload cleaned after RPC rejection');
  assert.ok(client.document.querySelector('#chat-payment-form'),'failed submission stays editable');
  client.fail('');client.document.querySelector('#chat-payment-note').value='<img onerror=bad> reference';
  client.submit('#chat-payment-form');await tick();await tick();
  assert.equal(client.booking.payment_status,'Deposit Payment Submitted');
  assert.equal(client.calls.at(-1).args.p_kind,'payment_sent');
  assert.equal(client.calls.at(-1).args.p_method,'GCash');
  assert.ok(client.calls.at(-1).args.p_path.startsWith('b/client/'));
  assert.equal(client.uploads.at(-1).options.upsert,false);
  assert.equal(client.document.querySelector('#chat-payment-form'),null);
  assert.match(client.document.querySelector('#shared-messages').textContent,/awaiting freelancer confirmation/);
  assert.equal(client.document.querySelectorAll('#shared-messages img').length,1,'one receipt photo, no injected image');
  const freelancer = await setup('freelancer','Awaiting Deposit','Deposit Payment Submitted');
  freelancer.file('#chat-payment-photo',photo);freelancer.submit('#chat-payment-form');await tick();await tick();
  assert.equal(freelancer.calls.at(-1).args.p_kind,'payment_received');
  assert.equal(freelancer.booking.status,'Partially Booked');
  assert.match(freelancer.document.querySelector('#shared-messages').textContent,/Receipt confirmed by freelancer/);
  const balance = await setup('client','Partially Booked','Deposit Paid');
  assert.match(balance.document.querySelector('.chat-payment-due').textContent,/3,000/);
  balance.file('#chat-payment-photo',photo);balance.submit('#chat-payment-form');await tick();await tick();
  assert.equal(balance.booking.payment_status,'Balance Payment Submitted');
  const receipt = await setup('freelancer','Partially Booked','Balance Payment Submitted');
  receipt.submit('#chat-payment-form');await tick();await tick();
  assert.equal(receipt.calls.at(-1).args.p_path,null,'freelancer can confirm without an optional receipt photo');
  assert.equal(receipt.booking.payment_status,'Fully Paid');
  const chat = await setup();
  chat.file('#chat-message-photo',photo);chat.document.querySelector('#shared-message').value='Photo note';chat.submit('#shared-message-form');await tick();await tick();
  assert.equal(chat.calls.at(-1).name,'send_booking_photo');assert.equal(chat.booking.payment_status,'Deposit Required','ordinary photos never mark a booking paid');
  chat.document.querySelector('#shared-message').value='Plain message';chat.submit('#shared-message-form');await tick();
  assert.equal(chat.calls.at(-1).name,'text');
  const saved = await setup();
  saved.file('#chat-payment-photo',photo);saved.failRefresh(true);saved.submit('#chat-payment-form');await tick();await tick();
  assert.equal(saved.removed.length,0,'saved evidence survives a subsequent refresh failure');
  assert.match(saved.document.querySelector('#chat-payment-feedback').textContent,/Payment was saved/);
  return 'PASS: gallery photo preview, five payment methods, client proof, freelancer receipt, staged amounts, failed upload and RPC retry, private photos, ordinary chat and saved evidence retention';
};
