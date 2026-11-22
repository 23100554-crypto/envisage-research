window.FreelancerWork = (() => {
  const M = Marketplace, e = M.escape;
  const image = src => /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(src || '') ? src : '';
  function gallery(images, compact = false) {
    const photos = (images || []).filter(image);
    return '<div class="post-gallery work-photo-grid ' + (photos.length === 1 ? 'work-photo-single' : '') + '">' +
      photos.map((src, index) => {
        const extra = compact && index > 3;
        const overlay = compact && index === 3 && photos.length > 4;
        return `<button class="work-photo" type="button" data-work-photo ${extra ? 'hidden' : ''} aria-label="View photo ${index + 1} in full"><img src="${e(src)}" alt="Work sample ${index + 1}" loading="lazy">${overlay ? `<span class="work-photo-more">+${photos.length - 4}</span>` : '<span aria-hidden="true">View photo ↗</span>'}</button>`;
      }).join('') + '</div>';
  }
  function viewPhotos(photos, index, opener, title = '') {
    const dialog = document.createElement('dialog');
    dialog.className = 'work-lightbox';
    dialog.setAttribute('aria-label', title || 'Portfolio photo viewer');
    dialog.innerHTML = '<div class="work-lightbox-bar"><span aria-live="polite"></span><button type="button" data-close-photo aria-label="Close photo viewer">×</button></div><img alt=""><div class="work-lightbox-controls"><button type="button" data-previous-photo>← Previous</button><button type="button" data-next-photo>Next →</button></div>';
    function render() {
      dialog.querySelector('img').src = photos[index].src;
      dialog.querySelector('img').alt = photos[index].alt;
      dialog.querySelector('span').textContent = title || `Photo ${index + 1} of ${photos.length}`;
      dialog.querySelector('[data-previous-photo]').disabled = index === 0;
      dialog.querySelector('[data-next-photo]').disabled = index === photos.length - 1;
      dialog.querySelector('.work-lightbox-controls').hidden = Boolean(title);
    }
    function close() { dialog.remove(); opener?.focus(); }
    dialog.querySelector('[data-close-photo]').onclick = close;
    dialog.querySelector('[data-previous-photo]').onclick = () => { if (index > 0) { index--; render(); } };
    dialog.querySelector('[data-next-photo]').onclick = () => { if (index < photos.length - 1) { index++; render(); } };
    dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
    dialog.addEventListener('click', event => { if (event.target === dialog) close(); });
    dialog.addEventListener('keydown', event => {
      if (event.key === 'ArrowLeft' && index > 0) { event.preventDefault(); index--; render(); }
      if (event.key === 'ArrowRight' && index < photos.length - 1) { event.preventDefault(); index++; render(); }
    });
    document.body.append(dialog);
    render();
    if (dialog.showModal) dialog.showModal(); else dialog.setAttribute('open', '');
  }
  document.addEventListener('click', event => {
    const avatar = event.target.closest('[data-profile-photo]');
    if (avatar) {
      const img = avatar.querySelector('img');
      if (img) viewPhotos([{ src: img.src, alt: img.alt }], 0, avatar, 'Profile photo');
      return;
    }
    const opener = event.target.closest('[data-work-photo]');
    if (!opener) return;
    const photos = [...opener.closest('.post-gallery').querySelectorAll('img')];
    viewPhotos(photos, photos.indexOf(opener.querySelector('img')), opener);
  });
  function card(post, owner = false) {
    const menu = owner && post.kind === 'post' ? `<details class="post-options"><summary aria-label="Post options">⋯</summary><div class="post-options-menu"><button type="button" data-post-action="hide" data-post-id="${e(post.id)}">${post.hidden ? 'Show on profile' : 'Hide'}</button><button type="button" data-post-action="edit" data-post-id="${e(post.id)}">Edit</button><button type="button" class="post-delete-action" data-post-action="delete" data-post-id="${e(post.id)}">Delete</button></div></details>` :
      owner ? `<button type="button" data-remove-work="${e(post.id)}" aria-label="Remove published work">Remove</button>` : '';
    return `<article class="creative-post"><div class="post-author"><strong>${post.kind === 'portfolio' ? 'Portfolio sample' : 'Project post'}</strong>${menu}</div>${owner && post.hidden ? '<span class="post-hidden-label">Hidden from clients</span>' : ''}${post.caption ? `<p style="white-space:pre-wrap;overflow-wrap:anywhere">${e(post.caption)}</p>` : ''}${gallery(post.images, post.kind === 'post')}${M.link(post.link) ? `<a class="post-link" href="${e(M.link(post.link))}" target="_blank" rel="noopener noreferrer">View portfolio / video ↗</a>` : ''}${post.kind === 'post' && post.images?.length ? `<p class="post-photo-count">${post.images.length} photo${post.images.length === 1 ? '' : 's'}</p>` : ''}</article>`;
  }
  async function read(files, max = 10) {
    if (files.length > max) throw new Error(`Choose up to ${max} photos.`);
    return Promise.all(files.map(file => new Promise((resolve, reject) => {
      if (file.size > 1500000 || !['image/jpeg','image/png','image/webp'].includes(file.type)) {
        reject(new Error('Use JPG, PNG or WebP photos up to 1.5 MB each.'));
        return;
      }
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('Could not read the selected photo.'));
      reader.readAsDataURL(file);
    })));
  }
  const load = id => M.rpc('freelancer_public_work', { p_freelancer: id });
  const publish = (kind, caption, link, images) => M.rpc('publish_freelancer_work', { p_kind: kind, p_caption: caption, p_link: link, p_images: images });
  return { image, gallery, card, read, load, publish };
})();
