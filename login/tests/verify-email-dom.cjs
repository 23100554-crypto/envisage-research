const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict');
module.exports = async function run(parseHTML) {
  const tick = () => new Promise(resolve => setTimeout(resolve,0));
  function setup(email = 'new@gmail.com') {
    const {window} = parseHTML(fs.readFileSync(path.join(__dirname,'../auth/verify-email.html'),'utf8'));
    const document = window.document, calls = [], stored = email ? {envisagePendingSignup:email} : {};
    let failure;
    window.location = {href:''};
    document.querySelector('form').reportValidity = () => true;
    const context = vm.createContext({window,document,Date,setInterval:()=>0,clearInterval(){},
      sessionStorage:{getItem:key=>stored[key] || null,setItem:(key,value)=>stored[key]=value,removeItem:key=>delete stored[key]},
      Envisage:{confirmSignup:async (...args)=>{calls.push(['verify',...args]);if(failure)throw failure;return {verified:true};},resendSignup:async value=>{calls.push(['resend',value]);if(failure)throw failure;}},
    });
    for (const file of ['signup-flow.js','verify-email.js']) vm.runInContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),context);
    return {window,document,stored,calls,fail(error){failure=error;},submit(value){document.querySelector('#verification-code').value=value;document.querySelector('form').dispatchEvent(new window.Event('submit',{cancelable:true}));}};
  }
  const missing = setup('');
  assert.equal(missing.document.querySelector('#verification-missing').hidden,false);
  assert.equal(missing.document.querySelector('#verification-step').hidden,true);
  const state = setup();
  state.submit('abc'); await tick();
  assert.equal(state.calls.length,0,'invalid codes are rejected without a network request');
  state.fail({code:'otp_expired'});
  state.submit('123456'); await tick();
  assert.match(state.document.querySelector('#verification-message').textContent,/invalid or has expired/);
  assert.equal(state.document.querySelector('#verification-success').hidden,true);
  state.fail(null);
  state.document.querySelector('#resend-code').click(); await tick();
  assert.equal(state.calls.filter(c=>c[0]==='resend').length,1);
  state.document.querySelector('#resend-code').click(); await tick();
  assert.equal(state.calls.filter(c=>c[0]==='resend').length,1,'cooldown prevents repeated requests');
  assert.ok(Number(state.stored.envisageSignupResendAt)>Date.now());
  state.submit('654321'); await tick();
  assert.deepEqual(state.calls.at(-1),['verify','new@gmail.com','654321']);
  assert.equal(state.document.querySelector('#verification-success').hidden,false);
  assert.equal(state.document.querySelector('#verification-step').hidden,true);
  assert.equal(state.document.querySelector('#verification-code').value,'');
  assert.equal(state.stored.envisagePendingSignup,undefined);
  assert.equal(state.stored.envisageSignupResendAt,undefined);
  assert.equal(state.window.location.href,'','success must wait for the Back to homepage button');
  assert.equal(state.document.querySelector('.verification-home').getAttribute('href'),'../landing/index.html');
  const change = setup();change.document.querySelector('#change-email').click();
  assert.equal(change.stored.envisagePendingSignup,undefined);
  assert.equal(change.window.location.href,'register.html');
  return 'PASS: OTP missing state, invalid/expired codes, resend cooldown, verified success, no automatic login, homepage link and change email';
};
