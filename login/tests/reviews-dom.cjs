const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
module.exports=async function run(parseHTML) {
  const {window}=parseHTML('<html><body><div id="profile-warnings"></div><div id="profile-reviews"></div></body></html>');
  const document=window.document;
  const M={escape:s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;'),watch:()=>{},rows:async()=>[{message:'Warning <script>alert(1)</script>',created_at:'2026-10-03'}],rpc:async()=>[{rating:5,author_name:'Client <img>',comment:'Excellent <script>service</script>',created_at:'2026-10-03'}]};
  const context=vm.createContext({window,document,Marketplace:M,Envisage:{profile:{id:'freelancer'}},Date});
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../reviews.js'),'utf8'),context);
  context.BookingReviews=window.BookingReviews;
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../freelancers/freelancer-feedback.js'),'utf8'),context);
  await new Promise(resolve=>setTimeout(resolve,0));
  assert.match(document.querySelector('#profile-warnings').textContent,/Warning <script>/);
  assert.match(document.querySelector('#profile-reviews').textContent,/5.0 \/ 5/);
  assert.equal(document.querySelector('script,img'),null);
  M.rpc=async()=>[];await context.BookingReviews.load(document.querySelector('#profile-reviews'),'freelancer');
  assert.match(document.querySelector('#profile-reviews').textContent,/Only clients with completed bookings/);
  return 'PASS: freelancer warning display, public review ratings, escaped user text and empty review state';
};
