const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
module.exports = async function run(parseHTML, options = {}) {
  const root = path.join(__dirname,'..');
  const {window} = parseHTML(fs.readFileSync(path.join(root,'admin/dashboard.html'),'utf8'));
  const document = window.document, calls = [];
  const location = {hash:'#dashboard'};
  const tables = {
    profiles: [
      {id:'admin',name:'Administrator',role:'admin',account_status:'Active'},
      {id:'client',name:'Test Client',role:'client',account_status:'Active',client_profile:{barangay:'Pacita 1'}},
      {id:'freelancer',name:'Test <Freelancer>',role:'freelancer',account_status:'Active',application_status:'Pending',freelancer_profile_complete:true,freelancer_profile:{headline:'Photographer',location:'Pacita 1, San Pedro, Laguna',services:['Photography'],startingRate:5000}}
    ],
    bookings: [{id:'booking',client_id:'client',freelancer_id:'freelancer',client_name:'Test Client',freelancer_name:'Test Freelancer',event_type:'Birthday',services:['Photography'],event_date:'2099-10-15',start_time:'09:00',end_time:'12:00',location:'Pacita 1, San Pedro, Laguna',status:'Partially Booked',payment_status:'Deposit Paid',budget:5000,deposit_amount:2000,balance_due_date:'2099-10-15'}],
    reports: [{id:'report',booking_id:'booking',reporter_id:'client',reason:'Test complaint',status:'Pending',created_at:'2026-10-01T00:00:00Z'}],
    service_categories: [{id:'category',name:'Photography'}],
    website_settings: [{id:true,site_name:'envisage',announcement:'Test announcement'}],
    admin_preferences: []
  };
  const db = {
    from(name) {
      let operation = 'select', value, id;
      const query = {
        select: () => query, order: () => query,
        eq: (key,v) => {id = v; return query;},
        insert: v => {operation='insert';value=v;return query;},
        update: v => {operation='update';value=v;return query;},
        delete: () => {operation='delete';return query;},
        upsert: v => {operation='upsert';value=v;return query;},
        then(resolve) {
          calls.push({table:name,operation,value,id});
          if(operation === 'update') Object.assign(tables[name].find(r => r.id===id),value);
          if(operation === 'insert') tables[name].push({id:'added',...value});
          return Promise.resolve({data:tables[name]}).then(resolve);
        }
      };
      return query;
    },
    rpc: async (name,args) => {
      calls.push({name,args});
      if (options.missingSchema && name === 'admin_message_summary') return {error:{code:'PGRST202',message:'Could not find the function public.admin_message_summary without parameters in the schema cache'}};
      if(name==='admin_manage_user') {
        const user=tables.profiles.find(u => u.id === args.p_id);
        if(['Approved','Rejected'].includes(args.p_action)) user.application_status=args.p_action;
        else user.account_status=args.p_action;
      }
      return {data:name==='admin_message_summary' ? {conversations:1,new_messages:2,reported:1} : name==='admin_report_messages' ? [{sender_id:'client',body:'<script>private evidence</script>',created_at:'2026-10-01'}] : []};
    }
  };
  const dialog = document.querySelector('dialog');
  dialog.showModal=() => {dialog.open=true;}; dialog.close=() => {dialog.open=false;};
  const Envisage={profile:tables.profiles[0],client:async () => db,saveProfile:async fields => Object.assign(tables.profiles[0],fields)};
  const context=vm.createContext({window,document,location,Envisage,URL,Date,Intl,console,confirm:()=>true,prompt:()=>null,setInterval:()=>0,clearInterval(){}});
  vm.runInContext(fs.readFileSync(path.join(root,'marketplace.js'),'utf8'),context);
  context.Marketplace=window.Marketplace;
  vm.runInContext(fs.readFileSync(path.join(root,'admin/admin-dashboard.js'),'utf8'),context);
  const tick = () => new Promise(resolve => setTimeout(resolve,5));
  const route = async hash => {location.hash='#'+hash;window.dispatchEvent(new window.Event('hashchange'));await tick();};
  await tick();
  if (options.missingSchema) {
    assert.match(document.querySelector('#panel-content').textContent,/Finish the Supabase database update/);
    assert.match(document.querySelector('#panel-content').textContent,/NOTIFY pgrst/);
    assert.equal(document.querySelectorAll('.admin-metric').length,0);
    assert.ok(document.querySelector('a[href="../supabase/migrations/202610020001_admin_management.sql"]'));
    options.missingSchema = false;
    document.querySelector('#refresh-panel').click();
    await tick();
    assert.equal(document.querySelectorAll('.admin-metric').length,9);
    return 'PASS: missing schema shows setup instructions and refresh recovers after migration';
  }
  assert.equal(document.querySelectorAll('.admin-metric').length,9);
  assert.match(document.querySelector('#panel-content').textContent,/Active Bookings1/);
  assert.match(document.querySelector('#panel-content').textContent,/Partially Booked/);
  assert.doesNotMatch(document.querySelector('#panel-content').textContent,/Confirmed booking/);
  assert.equal(document.querySelectorAll('[data-action="approve"]').length,0);
  for(const page of ['users','freelancers','clients','bookings','services','reports','messages','notifications','settings']) {
    await route(page);
    assert.ok(document.querySelector('#panel-content').textContent.trim(),page);
  }
  await route('messages');
  assert.equal(document.querySelector('[data-cancel]'),null);
  assert.ok(!calls.some(c => c.name==='admin_report_messages'));
  assert.ok(!calls.some(c => c.table==='booking_messages'));
  await route('freelancers');
  const search = document.querySelector('#people-search');
  search.value='missing';search.dispatchEvent(new window.Event('input'));
  assert.match(document.querySelector('#people-results').textContent,/No matching/);
  search.value='';search.dispatchEvent(new window.Event('input'));
  document.querySelector('[data-user="freelancer"]').click();await tick();
  assert.equal(dialog.open,true);
  assert.ok(!document.querySelector('freelancer'));
  document.querySelector('[data-account="Approved"]').click();await tick();
  assert.ok(calls.some(c => c.name==='admin_manage_user' && c.args.p_action==='Approved'));
  assert.equal(tables.profiles[2].application_status,'Approved');
  await route('reports');
  assert.equal(document.querySelectorAll('[data-conversation]').length,0);
  const reportSelect=document.querySelector('[data-report]');
  reportSelect.querySelector('option[value="Reviewing"]')?.setAttribute('selected','');
  Object.defineProperty(reportSelect,'value',{value:'Reviewing',configurable:true});
  reportSelect.dispatchEvent(new window.Event('change',{bubbles:true}));await tick();
  document.querySelector('[data-conversation]').click();await tick();
  assert.ok(calls.some(c => c.name==='admin_report_messages' && c.args.p_report==='report'));
  assert.match(document.querySelector('#dialog-content').textContent,/<script>private evidence<\/script>/);
  assert.equal(document.querySelector('#dialog-content script'),null);
  document.querySelector('[data-warn-report]').click();await tick();
  document.querySelector('#warning-form textarea').value='Please address the reported service issue.';
  document.querySelector('#warning-form').dispatchEvent(new window.Event('submit',{cancelable:true}));await tick();
  assert.ok(calls.some(c => c.name==='warn_reported_freelancer' && c.args.p_report==='report'));
  await route('bookings');
  assert.equal(document.querySelector('[data-cancel]'),null);
  return 'PASS: nine metrics, all admin sections, search, application approval, metadata-only messages, reported conversation and escaping';
};
