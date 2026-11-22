const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('node:assert/strict');
module.exports=async function run(parseHTML){
 const source=fs.readFileSync(path.join(__dirname,'../navigation-controls.js'),'utf8');
 function setup(route,referrer='',role='client'){
  const {window}=parseHTML('<html><body><a class="user-chip back-link" data-policy-back href="../auth/register.html">Back</a><a href="#privacy">Privacy</a><section id="privacy"></section></body></html>');
  const document=window.document,url=new URL(route,'https://app.test/login/');let backs=0,replacements=0;
  Object.defineProperty(document,'referrer',{value:referrer});window.location={pathname:url.pathname,search:url.search,origin:url.origin,href:url.href,assign(value){this.href=value;}};
  window.history={length:referrer?3:1,back:()=>backs++,replaceState:()=>replacements++};window.scrollTo=()=>{};window.scrollY=0;window.innerHeight=800;
  document.querySelector('#privacy').scrollIntoView=()=>{};
  vm.runInNewContext(source,{window,document,URL,URLSearchParams,localStorage:{getItem:()=>role}});
  return {window,document,backs:()=>backs,replacements:()=>replacements};
 }
 const legal=setup('legal/policies.html?return=register#terms','https://app.test/login/auth/register.html?role=freelancer');
 legal.document.querySelector('a[href="#privacy"]').click();assert.equal(legal.replacements(),1);
 legal.document.querySelector('[data-policy-back]').click();assert.equal(legal.window.location.href,'../auth/register.html');
 assert.match(legal.document.querySelector('[data-policy-back]').textContent,/create account/);
 const direct=setup('legal/policies.html?return=register');direct.document.querySelector('[data-policy-back]').click();assert.equal(direct.window.location.href,'../auth/register.html');
 const hostile=setup('legal/policies.html?return=https://evil.test','https://app.test.evil.test/path');hostile.document.querySelector('[data-policy-back]').click();assert.equal(hostile.backs(),0);assert.equal(hostile.window.location.href,'../landing/index.html');
 return 'PASS: registration return, policy sections without history traps, direct-entry fallback and external-origin rejection';
};
