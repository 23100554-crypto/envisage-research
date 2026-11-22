(async()=>{
  const M=Marketplace,e=M.escape,root=document.querySelector('#public-profile');
  try{
    const id=new URLSearchParams(location.search).get('id');
    const row=(await M.rpc('freelancer_directory')).find(r=>r.id===id);
    if(!row)throw new Error('Freelancer profile not found.');
    const p=row.profile,photo=M.image(p.photoData),portfolio=M.link(p.portfolioUrl);
    root.innerHTML=`<section class="creative-profile-layout"><aside class="creative-profile-sidebar"><div class="creative-profile-photo">${photo?`<img src="${e(photo)}" alt="${e(row.name)}"/>`:e(row.name[0])}</div><h1>${e(row.name)}</h1><p>${e(p.headline)}</p><p>${e(p.location)}</p><p>From ${M.money(p.startingRate)}</p><div class="creative-skill-tags">${p.services.map(s=>`<span>${e(s)}</span>`).join('')}</div><a class="public-inquiry-button creative-profile-inquiry" href="discovery.html?inquire=${row.id}">Send inquiry →</a></aside><div class="creative-profile-content"><nav class="profile-section-nav" aria-label="Freelancer profile sections"><a href="#portfolio-posts">Portfolio gallery</a><a href="#project-posts">Posts</a><a href="#profile-about">About</a><a href="#profile-reviews">Reviews</a><a href="#public-calendar">Availability</a></nav><section class="creative-profile-panel work-showcase" id="portfolio-posts"><div class="work-section-heading"><div><p class="eyebrow">SELECTED WORK</p><h2>Portfolio gallery</h2><p>A closer look at the work. Select a photo to view it in full.</p></div>${portfolio?`<a class="work-external-link" href="${e(portfolio)}" target="_blank" rel="noopener noreferrer">Portfolio website ↗</a>`:''}</div><div id="public-work" aria-live="polite"></div></section><section class="creative-profile-panel" id="project-posts"><div class="work-section-heading"><div><p class="eyebrow">FROM THE CREATIVE</p><h2>Posts</h2></div></div><div id="public-posts"></div></section><section class="creative-profile-panel" id="profile-about"><h2>About</h2><p>${e(p.description)}</p></section><section class="creative-profile-panel" id="profile-reviews"><h2>Client reviews</h2><div id="public-reviews"></div></section><section class="calendar-panel" id="public-calendar"></section></div></section>`;
    if(window.EnvisageCover) EnvisageCover.read(id).then(cover=>{const picture=EnvisageCover.picture(cover);if(picture){const banner=document.createElement('div');banner.className='client-profile-cover';banner.append(picture);root.prepend(banner);}}).catch(()=>{});
    let lastWork='';
    const loadWork=async()=>{try{
      const items=await FreelancerWork.load(id),signature=JSON.stringify(items);
      if(signature===lastWork)return;lastWork=signature;
      const samples=items.filter(item=>item.kind==='portfolio').flatMap(item=>item.images || []);
      const posts=items.filter(item=>item.kind==='post');
      root.querySelector('#public-work').innerHTML=samples.length?FreelancerWork.gallery(samples):'<p class="work-empty">Portfolio photos will appear here when this freelancer shares them.</p>';
      root.querySelector('#public-posts').innerHTML=posts.length?posts.map(item=>FreelancerWork.card(item)).join(''):'<p class="work-empty">No project updates yet.</p>';
    }catch(error){root.querySelector('#public-work').textContent='Could not load work. '+error.message;}};
    await loadWork();
    const refresh=await M.calendar(root.querySelector('#public-calendar'),id);
    const reviews=()=>BookingReviews.load(root.querySelector('#public-reviews'),id);
    await reviews();
    M.watch(async()=>{await refresh();await reviews();await loadWork();});
  }catch(error){root.textContent=error.message;}
})();
