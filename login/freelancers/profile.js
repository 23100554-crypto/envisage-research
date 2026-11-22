(() => {
 const M=Marketplace,W=FreelancerWork,e=M.escape,p=Envisage.profile.freelancer_profile || {},name=Envisage.profile.name;
 const form=document.querySelector('#create-post-form'),input=document.querySelector('#post-media'),message=document.querySelector('#post-message'),feed=document.querySelector('#creative-post-feed');
 const preview=document.createElement('div');preview.className='post-draft-preview';preview.setAttribute('aria-label','Selected photos');input.closest('.composer-actions').before(preview);
 let images=[],reading=0,busy=false,loading=false;
 const renderPreview=()=>{preview.innerHTML=W.gallery(images)+images.map((_,i)=>`<button type="button" data-remove-preview="${i}">Remove photo ${i+1}</button>`).join('');};
 preview.onclick=event=>{const button=event.target.closest('[data-remove-preview]');if(button && !busy){images.splice(Number(button.dataset.removePreview),1);renderPreview();}};
 input.onchange=async()=>{
  const version=++reading;loading=true;form.querySelector('[type="submit"]').disabled=true;message.textContent='Loading preview…';
  try{if(images.length+input.files.length>10)throw new Error('Choose up to 10 photos per post.');const selected=await W.read([...input.files],10);if(version!==reading)return;images=images.concat(selected);renderPreview();message.textContent=images.length?'Photos ready to publish.':'';}
  catch(error){if(version===reading){message.textContent=error.message;}}
  finally{if(version===reading){loading=false;input.value='';form.querySelector('[type="submit"]').disabled=false;}}
 };
 const photo=M.image(p.photoData);
 document.querySelector('#creative-identity').innerHTML=`<div class="creative-hub-avatar">${photo?`<button type="button" class="profile-photo-opener" data-profile-photo aria-label="View profile photo"><img src="${e(photo)}" alt="${e(name)}"></button>`:e(name?.[0] || 'E')}</div><div><h1>${e(name)}</h1><p>${e(p.headline)}</p></div><div class="creative-hub-actions"><a href="freelancer-profile.html">Edit profile</a><a href="portfolio.html">Portfolio gallery</a></div>`;
 document.querySelector('#creative-profile-details').innerHTML=`<section class="creative-detail-card"><h2>About</h2><p>${e(p.description)}</p><p>${e(p.location)}</p><p>${e((p.services || []).join(' · '))}</p></section>`;
 const galleryStatus=document.querySelector('#post-gallery-status');
 let posts=new Map(),showHidden=false,mutating=false;
 const tabs=document.createElement('div');
 tabs.className='post-feed-tabs';
 tabs.setAttribute('aria-label','Post visibility');
 tabs.innerHTML='<button type="button" data-post-tab="published" aria-pressed="true">Published</button><button type="button" data-post-tab="hidden" aria-pressed="false">Hidden</button>';
 feed.before(tabs);
 function renderPosts(){
  tabs.querySelectorAll('button').forEach(button=>button.setAttribute('aria-pressed',String((button.dataset.postTab==='hidden')===showHidden)));
  feed.innerHTML=[...posts.values()].filter(item=>Boolean(item.hidden)===showHidden).map(item=>W.card(item,true)).join('') ||
   '<p>'+(showHidden?'No hidden posts.':'No posts yet. Share your latest work above.')+'</p>';
 }
 tabs.onclick=event=>{
  const button=event.target.closest('[data-post-tab]');
  if(!button)return;
  showHidden=button.dataset.postTab==='hidden';
  renderPosts();
 };
 async function refresh(){
  try{
   const items=await W.load(Envisage.profile.id);
   posts=new Map(items.filter(item=>item.kind==='post').map(item=>[item.id,item]));
   renderPosts();
  }catch(error){galleryStatus.textContent='Could not load posts. '+error.message;}
 }
 function managePost(post,action){
  const dialog=document.createElement('dialog');
  dialog.className='post-manage-dialog';
  dialog.setAttribute('aria-label',action==='edit'?'Edit post':'Delete post');
  dialog.innerHTML=action==='edit'?
   '<form><h2>Edit post</h2><label for="edit-post-caption">Caption</label><textarea id="edit-post-caption" maxlength="3000" rows="4">'+e(post.caption)+'</textarea><label for="edit-post-link">Portfolio or video link</label><input id="edit-post-link" type="url" maxlength="2000" value="'+e(post.link)+'"><p class="post-dialog-message" role="status"></p><div class="post-dialog-actions"><button type="button" data-cancel>Cancel</button><button type="submit">Save changes</button></div></form>':
   '<form><h2>Delete post?</h2><p>This permanently deletes this post and its photos.</p><p class="post-dialog-message" role="status"></p><div class="post-dialog-actions"><button type="button" data-cancel>Cancel</button><button type="submit">Delete post</button></div></form>';
  const close=()=>{if(!mutating){dialog.remove();feed.querySelector('.post-options summary')?.focus();}};
  dialog.querySelector('[data-cancel]').onclick=close;
  dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
  dialog.querySelector('form').onsubmit=async event=>{
   event.preventDefault();
   if(mutating)return;
   mutating=true;
   dialog.querySelectorAll('button').forEach(button=>button.disabled=true);
   try{
    if(action==='edit'){
     const updated=await M.rpc('edit_freelancer_post',{p_id:post.id,p_caption:dialog.querySelector('#edit-post-caption').value.trim(),p_link:dialog.querySelector('#edit-post-link').value.trim()});
     posts.set(post.id,updated);
    }else{
     await M.rpc('remove_freelancer_work',{p_id:post.id});
     posts.delete(post.id);
    }
    renderPosts();
    dialog.remove();
    galleryStatus.textContent=action==='edit'?'Post updated.':'Post deleted.';
   }catch(error){
    dialog.querySelector('.post-dialog-message').textContent=error.message;
    dialog.querySelectorAll('button').forEach(button=>button.disabled=false);
   }finally{mutating=false;}
  };
  document.body.append(dialog);
  dialog.showModal();
 }
 feed.onclick=async event=>{
  const button=event.target.closest('[data-post-action]');
  if(!button || mutating)return;
  const post=posts.get(button.dataset.postId);
  if(!post)return;
  button.closest('details').open=false;
  const action=button.dataset.postAction;
  if(action==='edit'||action==='delete'){managePost(post,action);return;}
  mutating=true;
  button.disabled=true;
  try{
   const updated=await M.rpc('set_freelancer_post_hidden',{p_id:post.id,p_hidden:!post.hidden});
   posts.set(post.id,updated);
   renderPosts();
   galleryStatus.textContent=updated.hidden?'Post hidden from clients. Find it under Hidden to restore it.':'Post shown on your profile.';
  }catch(error){galleryStatus.textContent=error.message;button.disabled=false;}
  finally{mutating=false;}
 };
 document.addEventListener('click',event=>{
  feed.querySelectorAll('.post-options[open]').forEach(menu=>{if(!menu.contains(event.target))menu.open=false;});
 });
 form.onsubmit=async event=>{
  event.preventDefault();if(busy || loading)return;busy=true;const controls=[...form.querySelectorAll('input,textarea,button')];controls.forEach(c=>c.disabled=true);
  try{await W.publish('post',document.querySelector('#post-caption').value.trim(),document.querySelector('#post-link').value.trim(),images);form.reset();images=[];renderPreview();message.textContent='Post published. Clients can see it on your profile once your application is approved.';await refresh();}
  catch(error){message.textContent=error.message;}finally{busy=false;controls.forEach(c=>c.disabled=false);}
 };
 let drafts=[];try{drafts=JSON.parse(localStorage.getItem('envisageFreelancerPosts') || '[]');}catch{}
 if(Array.isArray(drafts) && drafts.length){
  const section=document.createElement('section');form.after(section);
  const render=()=>{section.innerHTML='<h2>Saved browser drafts</h2><p>These were saved only on this device. Publish only work that belongs to you.</p>'+drafts.map((d,i)=>W.card({...d,kind:'post'})+`<button type="button" data-publish-draft="${i}">Publish this saved post</button>`).join('');};render();
  section.onclick=async event=>{const button=event.target.closest('[data-publish-draft]');if(!button)return;section.querySelectorAll('button').forEach(b=>b.disabled=true);const index=Number(button.dataset.publishDraft),draft=drafts[index];try{await W.publish('post',draft.caption || '',draft.link || '',draft.images || []);drafts.splice(index,1);localStorage.setItem('envisageFreelancerPosts',JSON.stringify(drafts));render();await refresh();}catch(error){message.textContent=error.message;section.querySelectorAll('button').forEach(b=>b.disabled=false);}};
 }
 window.EnvisageCover?.mount(document.querySelector('#creative-cover')).then(()=>{document.querySelector('#edit-cover').disabled=false;});refresh();
})();
