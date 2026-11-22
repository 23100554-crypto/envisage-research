(async () => {
  const M = Marketplace, e = M.escape;
  const root = document.querySelector('#client-message-list, #inquiry-list');
  root.className = 'message-workspace';
  root.innerHTML = '<aside class="inbox-sidebar"><label for="conversation-search" class="visually-hidden">Search conversations</label><input id="conversation-search" type="search" placeholder="Search conversations"><button type="button" class="inbox-archive-toggle" aria-pressed="false">Archived</button><div class="conversation-list"></div></aside><section class="inbox-chat"><p class="inbox-placeholder">Select a conversation to start chatting.</p></section><p class="inbox-feedback" role="status"></p>';
  const list = root.querySelector('.conversation-list'), panel = root.querySelector('.inbox-chat'), feedback = root.querySelector('.inbox-feedback');
  let bookings = [], messages = [], activeId = null;
  const stateKey = 'envisageInboxState:' + Envisage.profile.id;
  let inboxState = {};
  try { inboxState = JSON.parse(localStorage.getItem(stateKey) || '{}') || {}; } catch {}
  let archived = false, menuId = null, holdTimer, holdPoint, suppressClick = false;
  const archiveToggle = root.querySelector('.inbox-archive-toggle');
  const latest = b => messages.find(m => m.booking_id === b.id);
  const person = b => Envisage.profile.role === 'client' ? b.freelancer_name : b.client_name;
  const seenKey = id => 'envisageChatSeen:' + Envisage.profile.id + ':' + id;
  function render() {
    const term = root.querySelector('input').value.trim().toLowerCase();
    list.innerHTML = bookings.filter(b => (archived ? inboxState[b.id] === 'archived' : !inboxState[b.id]) && (person(b)+' '+b.event_type).toLowerCase().includes(term)).map(b => {
      const m = latest(b), name = person(b) || 'Conversation';
      const unread = m && m.sender_id !== Envisage.profile.id && new Date(m.created_at).getTime() > Number(localStorage.getItem(seenKey(b.id)) || 0);
      const preview = m ? (m.sender_id === Envisage.profile.id ? 'You: ' : '') + (m.kind === 'photo' ? 'Photo' : m.body || 'Payment update') : 'No messages yet';
      return '<div class="conversation-entry"><button type="button" class="conversation-row '+(activeId===b.id?'selected':'')+'" data-conversation="'+e(b.id)+'" '+(activeId===b.id?'aria-current="true"':'')+'><span class="conversation-avatar" aria-hidden="true">'+e(name.split(' ').map(n=>n[0]).slice(0,2).join(''))+'</span><span class="conversation-copy"><strong>'+e(name)+'</strong><small>'+e(b.event_type)+'</small><span>'+e(preview)+'</span></span><span class="conversation-meta">'+(m?'<time datetime="'+e(m.created_at)+'">'+e(new Date(m.created_at).toLocaleDateString('en-PH',{month:'short',day:'numeric'}))+'</time>':'')+(unread?'<span class="conversation-unread" aria-label="Unread message"></span>':'')+'</span></button><button type="button" class="conversation-options" aria-label="Actions for '+e(name)+'" aria-expanded="'+(menuId===b.id)+'" data-options="'+e(b.id)+'">⋯</button>'+(menuId===b.id?'<div class="conversation-actions"><button type="button" data-inbox-action="'+(archived?'restore':'archive')+'">'+(archived?'Restore to inbox':'Archive')+'</button><button type="button" data-inbox-action="delete">Delete from inbox</button><button type="button" data-inbox-action="report">Report</button></div>':'')+'</div>';
    }).join('') || '<p class="inbox-empty">'+(bookings.length?(archived?'No archived conversations.':'No conversations in your inbox.'):'No conversations yet. Send an inquiry to get started.')+'</p>';
  }
  function markSeen(id) { localStorage.setItem(seenKey(id),String(Date.now())); }
  function open(id) {
    const b = bookings.find(b=>b.id===id); if (!b || id===activeId) return;
    activeId=id; markSeen(id); render(); root.classList.add('chat-open');
    panel.innerHTML='<header class="inbox-chat-heading"><button type="button" class="inbox-back">← Conversations</button><div><strong>'+e(person(b))+'</strong><small>'+e(b.event_type)+'</small></div><a href="'+e(M.detailUrl(id))+'#booking-record">View booking</a></header><iframe title="Conversation with '+e(person(b))+'" src="'+e(M.detailUrl(id))+'&embed=chat#shared-messages"></iframe>';
    panel.querySelector('.inbox-back').onclick=()=>{root.classList.remove('chat-open');};
    panel.querySelector('iframe').onload=()=>{feedback.textContent='';};
  }
  function toggleMenu(id, focus) {
    menuId = menuId === id ? null : id;
    render();
    if (focus) {
      const entry = [...list.querySelectorAll('[data-options]')].find(button => button.dataset.options === id);
      (menuId ? entry?.nextElementSibling?.querySelector('button') : entry)?.focus();
    }
  }
  archiveToggle.addEventListener('click', () => {
    archived = !archived; menuId = null;
    archiveToggle.setAttribute('aria-pressed',String(archived));
    archiveToggle.textContent = archived ? 'Back to inbox' : 'Archived';
    render();
  });
  root.querySelector('input').addEventListener('input',()=>{menuId=null;render();});
  list.addEventListener('click',event=>{
    if (suppressClick && !event.target.closest('[data-inbox-action]')) { suppressClick=false; return; }
    const options = event.target.closest('[data-options]');
    if (options) { toggleMenu(options.dataset.options,event.detail===0); return; }
    const action=event.target.closest('[data-inbox-action]')?.dataset.inboxAction;
    if (action && menuId) {
      const id = menuId, previousState = inboxState[id];
      if (action === 'report') {
        const url = new URL('../support/helpdesk.html',location.href);
        url.searchParams.set('booking',id);
        url.searchParams.set('role',Envisage.profile.role);
        location.href=url.href;
        return;
      }
      if (action==='delete' && !window.confirm('Remove this conversation from your inbox on this browser? The booking and messages will still be available from My bookings.')) return;
      if (action==='restore') delete inboxState[id];
      else inboxState[id]=action==='archive'?'archived':'removed';
      localStorage.setItem(stateKey,JSON.stringify(inboxState));
      if (activeId===id) {
        activeId=null;root.classList.remove('chat-open');
        panel.innerHTML='<p class="inbox-placeholder">Select a conversation to start chatting.</p>';
      }
      menuId=null;render();
      feedback.textContent=action==='archive'?'Conversation archived.':action==='restore'?'Conversation restored.':'Conversation removed from this inbox.';
      if(action==='delete'){
        const undo=document.createElement('button'); undo.type='button';undo.textContent='Undo';
        undo.onclick=()=>{if(previousState)inboxState[id]=previousState;else delete inboxState[id];localStorage.setItem(stateKey,JSON.stringify(inboxState));render();feedback.textContent='Conversation restored.';};
        feedback.append(' ',undo);undo.focus();
      }
      return;
    }
    const row=event.target.closest('[data-conversation]');
    if(row){menuId=null;if(row.dataset.conversation===activeId){root.classList.add('chat-open');render();}else open(row.dataset.conversation);}
  });
  const cancelHold=()=>{clearTimeout(holdTimer);holdPoint=null;};
  list.addEventListener('pointerdown',event=>{
    suppressClick=false;
    const row=event.target.closest('[data-conversation]');
    if(event.pointerType!=='touch'||!row)return;
    holdPoint=[event.clientX,event.clientY];
    holdTimer=setTimeout(()=>{suppressClick=true;if(menuId!==row.dataset.conversation)toggleMenu(row.dataset.conversation,false);},550);
  });
  list.addEventListener('pointermove',event=>{if(holdPoint&&Math.hypot(event.clientX-holdPoint[0],event.clientY-holdPoint[1])>10)cancelHold();});
  window.addEventListener('pointerup',cancelHold);
  window.addEventListener('pointercancel',cancelHold);
  list.addEventListener('contextmenu',event=>{if(event.target.closest('[data-conversation]')&&(holdPoint||suppressClick))event.preventDefault();});
  document.addEventListener('click',event=>{if(menuId&&!event.composedPath().includes(list)&&!event.target.closest('.inbox-archive-toggle')){menuId=null;render();}});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&menuId)toggleMenu(menuId,true);});
  window.addEventListener('message',event=>{if(event.origin===location.origin && event.source===panel.querySelector('iframe')?.contentWindow && event.data==='envisage-booking-details')location.href=M.detailUrl(activeId)+'#booking-record';});
  async function refresh() {
    try {
      [bookings,messages]=await Promise.all([M.rows('bookings',q=>q.order('created_at',{ascending:false})),M.rows('booking_messages',q=>q.order('created_at',{ascending:false}))]);
      bookings.sort((a,b)=>new Date(latest(b)?.created_at || b.created_at)-new Date(latest(a)?.created_at || a.created_at));
      if(activeId && document.hasFocus() && root.classList.contains('chat-open'))markSeen(activeId);
      if (!menuId && !holdPoint && !list.contains(document.activeElement)) render();
    } catch(error) {feedback.textContent=error.message;}
  }
  await refresh(); M.watch(refresh);
})();

