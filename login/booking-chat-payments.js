window.BookingChatPayments = (() => {
  const M = Marketplace, e = M.escape;
  const methods = ['GCash', 'Bank transfer', 'Maya', 'GoTyme', 'Other'];
  const bucket = 'booking-chat';
  const imageTypes = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
  const signedImages = new Map();
  let saving = false, draftPhoto = null, previewUrl = null, paymentDraft = false;

  function validatePhoto(file) {
    if (!file || !imageTypes[file.type] || file.size < 1 || file.size > 6 * 1024 * 1024) {
      throw new Error('Choose a JPG, PNG or WebP photo up to 6 MB.');
    }
  }
  async function upload(bookingId, file) {
    validatePhoto(file);
    const db = await Envisage.client();
    const path = `${bookingId}/${Envisage.profile.id}/${crypto.randomUUID()}.${imageTypes[file.type]}`;
    const { error } = await db.storage.from(bucket).upload(path, file, { contentType: file.type, upsert: false });
    if (error) throw error;
    return path;
  }
  async function discard(path) {
    if (!path) return;
    try { const db = await Envisage.client(); await db.storage.from(bucket).remove([path]); } catch { /* A retry never deletes published evidence. */ }
  }
  function resetDraft() {
    draftPhoto = null;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = null;
  }
  const pending = () => saving || paymentDraft || Boolean(draftPhoto) || Boolean(document.querySelector('#chat-payment-form input[type="file"]')?.files?.length);

  async function renderMessages(container, messages, booking) {
    const scrollTop = container.scrollTop;
    const atBottom = container.scrollHeight - container.clientHeight - scrollTop < 40;
    container.innerHTML = messages.length ? messages.map(m => {
      const isPayment = ['payment_sent', 'payment_received'].includes(m.kind);
      const confirmed = m.kind === 'payment_received' || (m.payment_stage === 'deposit' ? M.depositReceived(booking) : booking.payment_status === 'Fully Paid');
      const heading = m.kind === 'payment_received' ? 'Payment received' : 'Payment proof';
      return `<article class="chat-message ${m.sender_id === Envisage.profile.id ? 'chat-sent' : 'chat-received'} ${isPayment ? 'chat-payment-entry' : ''}">
        ${isPayment ? `<strong>${heading} · ${e(m.payment_stage === 'deposit' ? 'Deposit' : 'Balance')}</strong><p>${e(M.money(m.payment_amount))} · ${e(m.payment_method)}</p><small class="chat-payment-state">${confirmed ? 'Receipt confirmed by freelancer' : booking.payment_issue ? 'Needs review — see payment issue' : 'Submitted — awaiting freelancer confirmation'}</small>` : ''}
        <span>${e(m.body)}</span>${m.image_path ? `<div class="chat-image" data-chat-image="${e(m.image_path)}"><small>Loading photo…</small></div>` : ''}
        <small>${e(new Date(m.created_at).toLocaleString('en-PH', { timeZone: 'Asia/Manila' }))}</small>
      </article>`;
    }).join('') : '<p>No messages yet. Discuss your booking and send payment receipts here.</p>';
    await Promise.all([...container.querySelectorAll('[data-chat-image]')].map(async holder => {
      const path = holder.dataset.chatImage;
      try {
        let cached = signedImages.get(path);
        if (!cached || cached.expires < Date.now()) {
          const db = await Envisage.client();
          const { data, error } = await db.storage.from(bucket).createSignedUrl(path, 600);
          if (error) throw error;
          cached = { url: data.signedUrl, expires: Date.now() + 540000 };
          signedImages.set(path, cached);
        }
        if (!/^https?:\/\//.test(cached.url)) throw new Error('Photo unavailable');
        holder.innerHTML = `<a href="${e(cached.url)}" target="_blank" rel="noopener"><img src="${e(cached.url)}" alt="${messages.find(m => m.image_path === path)?.kind === 'payment_sent' ? 'Payment receipt photo' : 'Booking conversation photo'}" loading="lazy"></a>`;
      } catch { holder.innerHTML = '<small>Photo could not load. Refresh to try again.</small>'; }
    }));
    if (atBottom) container.scrollTop = container.scrollHeight;
    else container.scrollTop = scrollTop;
  }

  function renderControls(host, booking, messages, refresh) {
    const role = Envisage.profile.role, amounts = M.paymentAmounts(booking);
    const actions = M.actions(booking);
    const canSend = role === 'client' && Boolean(booking.payment_qr) && actions.some(([action]) => ['pay_deposit', 'pay_balance'].includes(action));
    const canReceive = role === 'freelancer' && actions.some(([action]) => ['confirm_deposit', 'confirm_final'].includes(action));
    const stage = booking.status === 'Awaiting Deposit' ? 'deposit' : 'balance';
    const amount = stage === 'deposit' ? amounts.deposit : amounts.balance;
    const lastProof = [...messages].reverse().find(m => m.kind === 'payment_sent' && m.payment_stage === stage);
    const qr = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(booking.payment_qr || '') ? booking.payment_qr : '';
    const wasOpen = host.querySelector('.chat-payment-drawer')?.open || false;
    const label = canSend ? 'Send receipt' : canReceive ? 'Review payment' : role === 'client' && booking.status === 'Awaiting Confirmation' ? 'Review agreement' : 'Payment details';
    const balance = amounts.outstanding;
    host.innerHTML = `<details class="chat-payment-drawer" ${wasOpen ? 'open' : ''}><summary><span><strong>${e(booking.payment_status)}</strong><small>${e(M.money(balance))} remaining</small></span><span class="chat-payment-toggle">${e(label)}</span></summary><div class="chat-payment-drawer-content">
      ${booking.payment_issue ? `<p class="payment-issue">${e(booking.payment_issue)}</p>` : ''}
      ${booking.status !== 'Inquiry Sent' ? `<details class="chat-payee"><summary>Payment details & agreement</summary><p>Pay to <strong>${e(booking.payment_payee || booking.freelancer_name)}</strong>. Confirm the recipient’s account for your chosen method in this conversation.</p>${qr ? `<img class="payment-qr" src="${e(qr)}" alt="Freelancer payment QR"><a href="${e(qr)}" download="envisage-payment-qr.png">Save QR</a>` : ''}<p>Total ${e(M.money(amounts.total))} · Balance due ${e(booking.balance_due_date || 'To be agreed')}</p><p>${e(window.BookingDocuments?.policy(booking) || '')}</p></details>` : ''}
      ${role === 'client' && booking.status === 'Awaiting Confirmation' && !booking.cancellation_requested_at ? `<form id="chat-agreement-form"><p>Your request was accepted. Review the payment details and agreement above.</p><label><input type="checkbox" required> I agree to the booking’s amounts and cancellation terms.</label><button type="submit">Accept agreement</button></form>` : ''}
      ${canSend || canReceive ? `<form id="chat-payment-form" class="chat-payment-form"><h3>${canSend ? 'Send payment proof' : 'Confirm payment received'} · ${e(stage)}</h3><p class="chat-payment-due">${e(M.money(amount))}</p>
        <fieldset><legend>${canSend ? 'How did you pay?' : 'Payment method received'}</legend><div class="chat-payment-methods">${methods.map(method => `<label><input type="radio" name="method" value="${e(method)}" ${method === (lastProof?.payment_method || 'GCash') ? 'checked' : ''} required><span>${e(method)}</span></label>`).join('')}</div></fieldset>
        <label class="chat-payment-photo-label" for="chat-payment-photo">${canSend ? 'Receipt photo from your gallery' : 'Receipt photo (optional)'}</label><input id="chat-payment-photo" type="file" accept="image/jpeg,image/png,image/webp" ${canSend ? 'required' : ''} aria-describedby="chat-photo-help"><small id="chat-photo-help">JPG, PNG or WebP · up to 6 MB</small>
        <div id="chat-payment-preview" class="chat-attachment-preview" hidden></div>
        <label for="chat-payment-note">Note (optional)</label><input id="chat-payment-note" maxlength="2000" placeholder="Reference number or a short note">
        ${canReceive ? '<p>Check that the money arrived in your account before confirming.</p>' : '<p>Transfer in your payment app, then send the receipt here.</p>'}
        <button type="submit">${canSend ? 'Send payment proof' : 'Confirm payment received'}</button>
        ${canReceive ? '<button class="chat-payment-report" type="button" data-payment-action="report_payment">Payment not received?</button>' : ''}
      </form>` : `<p class="chat-payment-wait">${booking.cancellation_requested_at ? 'Cancellation is awaiting review. New payment submissions are paused.' : booking.status === 'Inquiry Sent' ? 'Payment becomes available once the freelancer accepts the booking.' : role === 'client' && /Submitted/.test(booking.payment_status) ? 'Receipt sent. Waiting for the freelancer to confirm the money arrived.' : role === 'client' && !booking.payment_qr ? 'Ask the freelancer to add their payment details in this conversation before paying.' : role === 'freelancer' && ['Deposit Required', 'Deposit Paid', 'Balance Due'].includes(booking.payment_status) ? 'The client can send a receipt photo here after paying.' : ''}</p>`}
      <p id="chat-payment-feedback" role="status" aria-live="polite"></p></div></details>`;
    const feedback = host.querySelector('#chat-payment-feedback');
    const form = host.querySelector('#chat-payment-form');
    const photo = host.querySelector('#chat-payment-photo');
    paymentDraft = false;
    form?.addEventListener('input', () => { paymentDraft = true; });
    form?.addEventListener('change', () => { paymentDraft = true; });
    photo?.addEventListener('change', () => {
      feedback.textContent = '';
      const preview = host.querySelector('#chat-payment-preview');
      if (preview.dataset.url) URL.revokeObjectURL(preview.dataset.url);
      preview.innerHTML = ''; preview.hidden = true;
      const file = photo.files?.[0]; if (!file) return;
      try {
        validatePhoto(file);
        const url = URL.createObjectURL(file); preview.dataset.url = url;
        preview.innerHTML = `<img src="${e(url)}" alt="Selected receipt photo"><span>${e(file.name)}</span><button type="button" id="remove-payment-photo">Remove</button>`;
        preview.hidden = false;
        preview.querySelector('button').onclick = () => { URL.revokeObjectURL(url); photo.value = ''; preview.hidden = true; preview.innerHTML = ''; };
      } catch (error) { photo.value = ''; feedback.textContent = error.message; }
    });
    form?.addEventListener('submit', async event => {
      event.preventDefault(); if (saving) return;
      saving = true;
      const button = form.querySelector('button[type="submit"]'); button.disabled = true;
      let path = null, published = false;
      try {
        const method = form.querySelector('input[name="method"]:checked')?.value;
        if (!methods.includes(method)) throw new Error('Choose a payment method.');
        const file = photo.files?.[0];
        if (canSend && !file) throw new Error('Attach your payment receipt photo.');
        if (file) path = await upload(booking.id, file);
        await M.rpc('send_booking_payment', { p_id: booking.id, p_kind: canSend ? 'payment_sent' : 'payment_received', p_method: method, p_path: path, p_note: host.querySelector('#chat-payment-note').value.trim() });
        published = true;
        host.querySelector('.chat-payment-drawer').open = false;
        if (host.querySelector('#chat-payment-preview')?.dataset.url) URL.revokeObjectURL(host.querySelector('#chat-payment-preview').dataset.url);
        await refresh();
      } catch (error) {
        if (!published) await discard(path);
        (host.querySelector('#chat-payment-feedback') || feedback).textContent = published ? 'Payment was saved. Refresh the conversation to see it.' : error.message;
      } finally { saving = false; if (button.isConnected) button.disabled = false; }
    });
    host.querySelector('#chat-agreement-form')?.addEventListener('submit', async event => {
      event.preventDefault(); if (saving) return;
      const form = event.target, button = form.querySelector('button');
      if (!form.querySelector('input').checked) { feedback.textContent = 'Review and accept the agreement first.'; return; }
      saving = true; button.disabled = true;
      try { await M.rpc('transition_booking', { p_id: booking.id, p_action: 'acknowledge' }); await refresh(); }
      catch (error) { feedback.textContent = error.message; button.disabled = false; }
      finally { saving = false; }
    });
  }

  function bindComposer(form, bookingId, refresh) {
    const input = form.querySelector('#shared-message');
    const photoLabel = document.createElement('label');
    photoLabel.className = 'chat-photo-button';
    photoLabel.innerHTML = 'Photo<input id="chat-message-photo" type="file" accept="image/jpeg,image/png,image/webp" aria-label="Attach a photo from your gallery">';
    form.insertBefore(photoLabel, form.querySelector('button'));
    input.required = false;
    const preview = document.createElement('div'); preview.className = 'chat-attachment-preview'; preview.hidden = true;
    form.before(preview);
    const feedback = document.createElement('p'); feedback.className = 'chat-composer-feedback'; feedback.setAttribute('role', 'status'); form.after(feedback);
    photoLabel.querySelector('input').addEventListener('change', event => {
      resetDraft(); preview.hidden = true; feedback.textContent = '';
      const file = event.target.files?.[0]; if (!file) return;
      try {
        validatePhoto(file); draftPhoto = file; previewUrl = URL.createObjectURL(file);
        preview.innerHTML = `<img src="${e(previewUrl)}" alt="Selected conversation photo"><span>${e(file.name)}</span><button type="button">Remove</button>`;
        preview.hidden = false;
        preview.querySelector('button').onclick = () => { resetDraft(); event.target.value = ''; preview.hidden = true; };
      } catch (error) { event.target.value = ''; feedback.textContent = error.message; }
    });
    form.addEventListener('submit', async event => {
      event.preventDefault(); if (saving) return;
      if (!input.value.trim() && !draftPhoto) { feedback.textContent = 'Write a message or choose a photo.'; return; }
      saving = true;
      const button = form.querySelector('button'); button.disabled = true;
      let path = null, published = false;
      try {
        if (draftPhoto) {
          path = await upload(bookingId, draftPhoto);
          await M.rpc('send_booking_photo', { p_id: bookingId, p_path: path, p_note: input.value.trim() });
        } else await M.message(bookingId, input.value.trim());
        published = true; input.value = ''; resetDraft(); photoLabel.querySelector('input').value = ''; preview.hidden = true; feedback.textContent = '';
        await refresh();
      } catch (error) { if (!published) await discard(path); feedback.textContent = published ? 'Message was sent. Refresh to see it.' : error.message; }
      finally { saving = false; button.disabled = false; }
    });
    window.addEventListener('pagehide', resetDraft, { once: true });
  }
  return { renderMessages, renderControls, bindComposer, pending, validatePhoto };
})();
