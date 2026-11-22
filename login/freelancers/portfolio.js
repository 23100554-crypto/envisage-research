(() => {
 const W=FreelancerWork,M=Marketplace,input=document.querySelector('#portfolio-files'),grid=document.querySelector('#portfolio-grid');
 const status=document.createElement('p');status.setAttribute('role','status');grid.before(status);
 async function refresh(){try{const items=(await W.load(Envisage.profile.id)).filter(p=>p.kind==='portfolio');grid.innerHTML=items.map(p=>W.card(p,true)).join('') || '<p>No published portfolio samples yet.</p>';}catch(error){status.textContent=error.message;}}
 input.onchange=async()=>{input.disabled=true;status.textContent='Publishing portfolio photos…';try{const images=await W.read([...input.files],6);if(images.length)await W.publish('portfolio','','',images);await refresh();status.textContent='Portfolio photos published for clients.';}catch(error){status.textContent=error.message;}finally{input.disabled=false;input.value='';}};
 grid.onclick=async event=>{const button=event.target.closest('[data-remove-work]');if(!button)return;button.disabled=true;try{await M.rpc('remove_freelancer_work',{p_id:button.dataset.removeWork});await refresh();}catch(error){status.textContent=error.message;button.disabled=false;}};
 let saved=[];try{saved=JSON.parse(localStorage.getItem('envisagePortfolio') || '[]');}catch{}
 if(Array.isArray(saved) && saved.length){const draft=document.createElement('section');grid.before(draft);draft.innerHTML='<h2>Portfolio saved on this browser</h2><p>Publish these samples if they belong to you so clients can see them.</p>'+W.gallery(saved)+'<button type="button">Publish saved portfolio</button>';draft.querySelector('button').onclick=async event=>{event.target.disabled=true;try{await W.publish('portfolio','','',saved.slice(0,6));localStorage.removeItem('envisagePortfolio');draft.remove();await refresh();}catch(error){status.textContent=error.message;event.target.disabled=false;}};}
 refresh();
})();
