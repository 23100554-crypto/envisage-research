(async () => {
  const M=Marketplace;
  const root=document.querySelector('#booking-queue, #client-booking-queue, #transaction-list, #inquiry-list, #client-message-list');
  const status=document.createElement('p');status.setAttribute('role','status');root.before(status);
  const isInbox=['inquiry-list','client-message-list'].includes(root.id);
  async function refresh(){
    let bookings=await M.rows('bookings',q=>q.order('created_at',{ascending:false}));

    root.innerHTML=bookings.length?bookings.map(b=>M.bookingCard(b,isInbox?'messages':'bookings')).join(''):'<div class="empty-bookings"><strong>No '+(isInbox?'conversations':'booking requests')+' yet.</strong><span>Your shared records will appear here.</span></div>';
  }
  M.bindActions(root,refresh,status);
  try{await refresh();M.watch(refresh);}catch(error){status.textContent=error.message;}
})();
