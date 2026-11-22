const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('node:assert/strict');
module.exports=async function run(parseHTML){
 const tick=()=>new Promise(resolve=>setTimeout(resolve,0));
 for(const search of ['','?role=freelancer']){
  const {window}=parseHTML(fs.readFileSync(path.join(__dirname,'../auth/login.html'),'utf8')),document=window.document,calls=[];
  window.location={search,hash:'',href:''};
  const context=vm.createContext({window,document,URLSearchParams,sessionStorage:{removeItem(){}},Envisage:{signIn:async(...args)=>{calls.push(args);throw new Error('Wrong role');},home:()=>'/workspace'}});
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../script.js'),'utf8'),context);
  const controls=[...document.querySelectorAll('#login-form input,#login-form button,#login-form a')];
  assert.equal(controls[0].id,'email');assert.equal(controls[1].id,'password');
  document.querySelector('#email').value='person@example.com';document.querySelector('#password').value='secret';
  document.querySelector('form').dispatchEvent(new window.Event('submit',{cancelable:true}));await tick();
  assert.equal(calls[0][2],search?'freelancer':'client');
  assert.equal(window.location.href,'');
  document.querySelector('[data-role="freelancer"]').click();
  assert.equal(document.querySelector('[data-role="freelancer"]').getAttribute('aria-pressed'),'true');
  assert.equal(document.querySelector('#password').value,'');
  assert.equal(document.body.dataset.signinRole,'freelancer');
  assert.match(document.querySelector('#login-form [type="submit"]').textContent,/freelancer/);
  document.querySelector('.show-password').click();assert.equal(document.querySelector('#password').type,'text');
 }
 const {window}=parseHTML(fs.readFileSync(path.join(__dirname,'../admin/login.html'),'utf8')),document=window.document;
 assert.ok(document.querySelector('.password-wrap #admin-password'));
 assert.ok(document.querySelector('#admin-login-form > .submit'));
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../admin/admin-login.js'),'utf8'),{window,document,Envisage:{}});
 document.querySelector('.show-password').click();assert.equal(document.querySelector('#admin-password').type,'text');
 return 'PASS: email-to-password tab order, explicit default role, role switching, wrong-role feedback and admin password controls';
};
