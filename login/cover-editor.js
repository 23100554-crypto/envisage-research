window.EnvisageCover = (() => {
  const media = '(max-width: 780px)';
  async function load(table, id) {
    const db = await Envisage.client();
    const {data,error} = await db.from(table).select('*').eq('freelancer_id',id).maybeSingle();
    if(error) throw error;
    return data;
  }
  const read = id => load('freelancer_covers',id);
  function picture(row) {
    const desktop = FreelancerWork.image(row?.desktop_image);
    const mobile = FreelancerWork.image(row?.mobile_image);
    if (!desktop || !mobile) return null;
    const pic = document.createElement('picture');
    pic.className = 'saved-cover-picture';
    const source = document.createElement('source');
    source.media=media; source.srcset=mobile;
    const img=document.createElement('img'); img.alt=''; img.src=desktop;
    pic.append(source,img);
    return pic;
  }
  async function mount(banner) {
    const id=Envisage.profile.id;
    const key='envisageFreelancerCover:'+id;
    let local='';
    try { local=FreelancerWork.image(localStorage.getItem(key)); } catch {}
    const edit=banner.querySelector('#edit-cover');
    const status=document.querySelector('#cover-status');
    const view=document.createElement('button');
    view.type='button';view.className='view-full-cover';view.hidden=true;
    view.setAttribute('aria-label','View full cover photo');
    banner.append(view);
    const viewer=document.createElement('dialog');
    viewer.className='cover-full-dialog';viewer.setAttribute('aria-label','Full cover photo');
    viewer.innerHTML='<button type="button">Close</button><img alt="Full uncropped cover photo"><p role="status"></p>';
    document.body.append(viewer);
    const full=viewer.querySelector('img'), viewerStatus=viewer.querySelector('p');
    viewer.querySelector('button').onclick=()=>viewer.close();
    viewer.addEventListener('close',()=>{full.removeAttribute('src');view.focus();});
    view.onclick=async()=>{
      full.hidden=true;viewerStatus.textContent='Loading full photo…';viewer.showModal();
      try{
        const row=await load('freelancer_cover_originals',id);
        const source=FreelancerWork.image(row?.source_image)||local;
        if(!source)throw new Error('The original cover is not available.');
        if(!viewer.open)return;
        full.src=source;full.hidden=false;viewerStatus.textContent='';
      }catch(error){if(viewer.open)viewerStatus.textContent=error.message;}
    };
    let saved, original, busy=false, loading=false, version=0;
    if(local){banner.style.backgroundImage='url("'+local+'")';view.hidden=false;}
    function display(row) {
      const pic=picture(row);
      if(!pic)return;
      banner.querySelector('picture')?.remove();
      banner.prepend(pic);view.hidden=false;
      banner.style.backgroundImage='';
    }
    try { saved=await read(id); display(saved); } catch { status.textContent='Could not load the saved cover. You can try again in Edit cover.'; }
    const dialog=document.createElement('dialog');
    dialog.className='cover-crop-dialog';
    dialog.setAttribute('aria-labelledby','cover-crop-title');
    dialog.innerHTML='<h2 id="cover-crop-title">Reposition cover</h2><p>Drag the photo up or down, or use the Up and Down arrow keys.</p><label>Choose a photo <input type="file" accept="image/jpeg,image/png,image/webp"></label><div class="cover-crop-frame" tabindex="0" aria-label="Reposition cover up or down"><img alt=""></div><p class="cover-editor-status" role="status"></p><div class="cover-editor-actions"><button type="button" data-reset>Reset</button><button type="button" data-cancel>Cancel</button><button type="button" data-save disabled>Save cover</button></div>';
    document.body.append(dialog);
    const stage=dialog.querySelector('.cover-crop-frame'), frames=[stage];
    const file=dialog.querySelector('[type=file]');
    const save=dialog.querySelector('[data-save]'), note=dialog.querySelector('.cover-editor-status');
    const cancel=dialog.querySelector('[data-cancel]'), reset=dialog.querySelector('[data-reset]');
    let image, src='', x=.5,y=.5,zoom=1,drag;
    const clamp=n=>Math.min(1,Math.max(0,n));
    function geometry(w,h) {
      const scale=Math.max(w/image.naturalWidth,h/image.naturalHeight)*zoom;
      const iw=image.naturalWidth*scale, ih=image.naturalHeight*scale;
      return {iw,ih,left:-(iw-w)*x,top:-(ih-h)*y};
    }
    function render() {
      save.disabled=!image || busy || loading;
      frames.forEach(box=>{
        const img=box.querySelector('img'); img.hidden=!image;
        if(!image)return;
        if(img.getAttribute('src')!==src) img.src=src;
        const {iw,ih,left,top}=geometry(box.clientWidth,box.clientHeight);
        Object.assign(img.style,{width:iw+'px',height:ih+'px',left:left+'px',top:top+'px'});
      });
    }
    async function select(source, crop={}, ticket=++version) {
      const img=new Image(); img.src=source; await img.decode();
      if(ticket!==version)return;
      src=source; image=img; x=crop.crop_x??.5; y=crop.crop_y??.5;zoom=crop.zoom??1;
      render();
    }
    const observer=new ResizeObserver(render);frames.forEach(box=>observer.observe(box));
    edit.onclick=async()=>{
      if(dialog.open)return;
      const ticket=++version; image=null;src='';loading=true;file.value='';note.textContent='Loading cover…';dialog.showModal();render();
      try {
        original=await load('freelancer_cover_originals',id);
        if(ticket!==version)return;
        const source=FreelancerWork.image(original?.source_image)||local;
        if(source)await select(source,original||{},ticket);
        if(ticket===version)note.textContent=local&&!original?'This cover is on this browser only. Save it to publish the crop.':'';
      }catch(error){if(ticket===version)note.textContent='Could not load the original. You can choose a new photo. '+error.message;}
      finally {if(ticket===version){loading=false;render();}}
    };
    file.onchange=async()=>{
      if(!file.files.length)return;
      const ticket=++version;loading=true;render();note.textContent='';
      try{const [source]=await FreelancerWork.read([...file.files],1);await select(source,{},ticket);}
      catch(error){if(ticket===version)note.textContent=error.message||'Could not open this photo.';}
      finally{if(ticket===version){loading=false;file.value='';render();}}
    };
    stage.onpointerdown=event=>{
      if(!image || busy || !event.isPrimary || event.button!==0)return;
      const g=geometry(stage.clientWidth,stage.clientHeight);
      drag={id:event.pointerId,py:event.clientY,y,dy:Math.max(1,g.ih-stage.clientHeight)};
      stage.setPointerCapture(event.pointerId);
    };
    stage.onpointermove=event=>{if(!drag||drag.id!==event.pointerId)return;y=clamp(drag.y-(event.clientY-drag.py)/drag.dy);render();};
    stage.onpointerup=stage.onpointercancel=stage.onlostpointercapture=()=>{drag=null;};
    stage.onkeydown=event=>{
      if(!image||busy)return;
      const step={ArrowUp:.04,ArrowDown:-.04}[event.key];
      if(step){event.preventDefault();y=clamp(y+step);render();}
    };
    reset.onclick=()=>{x=.5;y=.5;zoom=1;render();};
    cancel.onclick=()=>dialog.close();
    dialog.addEventListener('cancel',event=>{if(busy)event.preventDefault();});
    dialog.addEventListener('close',()=>{version++;drag=null;edit.focus();});
    function crop(w,h) {
      const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
      const ctx=canvas.getContext('2d'),g=geometry(w,h);
      ctx.fillStyle='#fffefa';ctx.fillRect(0,0,w,h);ctx.drawImage(image,g.left,g.top,g.iw,g.ih);
      return canvas.toDataURL('image/jpeg',.86);
    }
    save.onclick=async()=>{
      if(!image||busy||loading)return;
      busy=true;render();[file,cancel,reset].forEach(control=>control.disabled=true);note.textContent='Saving cover…';
      try{
        const desktop_image=crop(1320,240),mobile_image=crop(780,300);
        await Marketplace.rpc('save_freelancer_cover',{p_source:src,p_desktop:desktop_image,p_mobile:mobile_image,p_x:x,p_y:y,p_zoom:zoom});
        display({desktop_image,mobile_image});status.textContent='Cover saved to your profile.';
        local='';try{localStorage.removeItem(key);}catch{}
        dialog.close();
      }catch(error){note.textContent=error.message||'Could not save the cover. Try again.';}
      finally{busy=false;[file,cancel,reset].forEach(control=>control.disabled=false);render();}
    };
  }
  return {read,picture,mount};
})();
