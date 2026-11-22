(async()=>{
  const M=Marketplace,e=M.escape,row=Envisage.profile,p=row.freelancer_profile || {};
  const message=document.querySelector('#block-message');
  document.querySelector('#profile-name').textContent=row.name;
  document.querySelector('#profile-description-summary').textContent=p.description || '';
  document.querySelector('#profile-services').textContent=(p.services || []).join(' · ');
  document.querySelector('#profile-rate').textContent=`From ${M.money(p.startingRate)}`;
  const avatar=document.querySelector('#profile-initials'),photo=M.image(p.photoData);
  avatar.classList.toggle('has-photo',Boolean(photo));
  avatar.innerHTML=photo?`<img src="${e(photo)}" alt="${e(row.name)}"/>`:e(row.name.split(' ').map(n=>n[0]).join(''));
  document.querySelector('#block-date').min=M.today();
  const calendarRoot=document.querySelector('.calendar-panel');
  let refreshCalendar;
  async function refreshBlocks(){
    const blocks=await M.rows('availability_blocks',q=>q.eq('freelancer_id',row.id).gte('block_date',M.today()).order('block_date'));
    document.querySelector('#blocked-count').textContent=`${blocks.length} personal / external blocks`;
    document.querySelector('#saved-block-total').textContent=blocks.length;
    document.querySelector('#saved-blocks').innerHTML=blocks.length?blocks.map(b=>`<li><span>${e(b.block_date)} · ${b.all_day?'All day':`${b.start_time.slice(0,5)}–${b.end_time.slice(0,5)}`}<br/><small>${e(b.label || b.reason)}</small></span><button type="button" data-remove="${b.id}" aria-label="Remove block on ${b.block_date}">×</button></li>`).join(''):'<li>No personal blocks. Accepted bookings appear automatically in your calendar.</li>';
  }
  async function refresh(){await Promise.all([refreshBlocks(),refreshCalendar?.()]);}
  document.querySelector('#saved-blocks').addEventListener('click',async event=>{
    const button=event.target.closest('[data-remove]');if(!button)return;button.disabled=true;
    try{await M.rpc('remove_availability',{p_id:button.dataset.remove});message.textContent='Block removed. This time is open again.';await refresh();}catch(error){message.textContent=error.message;button.disabled=false;}
  });
  document.querySelector('#all-day').addEventListener('change',event=>document.querySelector('#block-times').hidden=event.target.checked);
  document.querySelectorAll('[name="calendar-color"]').forEach(input=>input.addEventListener('change',()=>document.querySelector('#block-color').value=input.value));
  document.querySelector('#block-form').addEventListener('submit',async event=>{
    event.preventDefault();const button=event.target.querySelector('[type="submit"]');button.disabled=true;
    try{
      const value=id=>document.getElementById(id).value;
      await M.rpc('save_availability',{p_block:{block_date:value('block-date'),all_day:document.querySelector('#all-day').checked,start_time:value('block-start'),end_time:value('block-end'),label:value('block-label'),reason:value('block-reason'),color:value('block-color')}});
      message.textContent='Unavailable time saved. Clients can now see it in your schedule.';
      await refresh();
    }catch(error){message.textContent=error.message;}finally{button.disabled=false;}
  });
  try{refreshCalendar=await M.calendar(calendarRoot,row.id,date=>document.querySelector('#block-date').value=date,{showClients:true});await refreshBlocks();M.watch(refresh);}catch(error){message.textContent=error.message;}
})();

