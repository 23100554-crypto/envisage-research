(async () => {
  const M = Marketplace, e = M.escape, role = Envisage.profile.role;
  const root = document.querySelector('#client-booking, #accepted-booking, #client-inquiry-thread, #freelancer-inquiry-thread');
  const id = new URLSearchParams(location.search).get('id');
  const embedded = new URLSearchParams(location.search).get('embed') === 'chat';
  if (embedded) document.body.classList.add('embedded-conversation');
  let booking, busy = false;
  root.innerHTML = `<p id="booking-feedback" role="status"></p><section class="booking-chat payment-conversation"><h2>Messages & payments</h2><div class="chat-messages" id="shared-messages" aria-live="polite"></div><div id="chat-payment-controls"></div><form id="shared-message-form"><label class="visually-hidden" for="shared-message">Message</label><input id="shared-message" maxlength="2000" required placeholder="Message about this event…"><button type="submit">Send</button></form></section>
    <details class="booking-detail-drawer"><summary>Booking details, agreement & receipts</summary><div id="booking-record"></div></details>
    <dialog id="booking-ack-dialog" class="payment-dialog" aria-labelledby="ack-title"><div id="ack-content"></div><button type="button" data-close-payment>Review later</button></dialog>
    <dialog id="booking-payment-dialog" class="payment-dialog" aria-labelledby="payment-dialog-title"><div id="payment-content"></div><button type="button" data-close-payment>Close</button></dialog>`;
  const feedback = root.querySelector('#booking-feedback'), record = root.querySelector('#booking-record');
  const viewNav = document.createElement('nav');
  viewNav.className = 'booking-view-nav';
  viewNav.setAttribute('aria-label','Booking sections');
  viewNav.innerHTML = '<a href="#booking-record">Booking details</a><a href="#shared-messages">Messages & payments</a>';
  feedback.after(viewNav);
  function selectView() {
    const conversation = ['#shared-messages','#chat-payment-controls'].includes(location.hash) || (!location.hash && root.id.includes('inquiry-thread'));
    root.querySelector('.payment-conversation').hidden = !conversation;
    const drawer = root.querySelector('.booking-detail-drawer');
    drawer.hidden = conversation;
    drawer.open = !conversation;
    viewNav.querySelectorAll('a').forEach(link => {
      if ((link.hash === '#shared-messages') === conversation) link.setAttribute('aria-current','page');
      else link.removeAttribute('aria-current');
    });
  }
  if (embedded) viewNav.querySelector('a[href="#booking-record"]').addEventListener('click',event => { event.preventDefault(); parent.postMessage('envisage-booking-details',location.origin); });
  window.addEventListener('hashchange',selectView);
  selectView();
  const ackDialog = root.querySelector('#booking-ack-dialog'), paymentDialog = root.querySelector('#booking-payment-dialog');
  const show = dialog => { if (dialog.showModal) dialog.showModal(); else dialog.setAttribute('open',''); };
  const close = dialog => { if (dialog.close) dialog.close(); else dialog.removeAttribute('open'); };
  const paymentImage = value => /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value || '') ? value : '';
  function notice(b) {
    const a = M.paymentAmounts(b);
    if (b.status === 'Inquiry Sent') return role === 'client' ? 'Inquiry sent. Waiting for the freelancer to review your request.' : 'Review this inquiry, agree the payment terms, and accept or decline the request.';
    if (b.status === 'Awaiting Confirmation') return role === 'client' ? 'Booking Request Accepted. Review the details and acknowledge to continue to your deposit.' : 'Waiting for the client to acknowledge the accepted booking.';
    if (b.payment_status === 'Deposit Payment Submitted') return role === 'freelancer' ? `Deposit Payment Submitted. The client indicated that the ${M.money(a.deposit)} deposit has been paid. Verify your payment account before confirming receipt.` : 'Waiting for Freelancer Confirmation. Your deposit submission has not yet been verified.';
    if (b.payment_status === 'Balance Payment Submitted') return role === 'freelancer' ? `Balance Payment Submitted. The client indicated that the ${M.money(a.balance)} remaining balance has been paid. Verify your payment account before confirming receipt.` : 'Waiting for Freelancer Confirmation. Your balance submission has not yet been verified.';
    if (b.status === 'Awaiting Deposit') return role === 'client' ? 'Payment Required. Pay the deposit using the freelancer’s QR, then submit your payment for verification.' : 'Waiting for Deposit. The client has acknowledged the booking.';
    if (b.status === 'Partially Booked') return `Deposit Confirmed ✓. ${M.money(a.balance)} remaining balance, due ${b.balance_due_date}. The client can pay early. Once the freelancer confirms the balance, this becomes Fully Booked; there is no need to wait for the event.`;
    if (b.status === 'Fully Booked') return 'Fully Paid ✓. Your booking is fully booked / confirmed. Completion is recorded separately after the service.';
    return b.status === 'Completed' ? 'The event/service has been marked completed by both parties.' : 'This request is closed. Any refund must be arranged directly between the client and freelancer.';
  }
  function termsForm(b) {
    if (role !== 'freelancer' || !['Inquiry Sent','Awaiting Confirmation','Awaiting Deposit','Partially Booked'].includes(b.status)) return '';
    const draft = b.status === 'Inquiry Sent', locked = draft ? '' : 'readonly';
    const savedQr = b.payment_qr || Envisage.profile.freelancer_profile?.paymentQrData || '';
    const savedPayee = b.payment_payee || Envisage.profile.freelancer_profile?.paymentPayee || '';
    const dueDate = draft ? b.event_date : (b.balance_due_date || b.event_date);
    return `<section class="payment-terms simplified-payment">
      <form id="payment-terms-form">
        <div class="payment-amounts payment-edit-amounts">
          <label>Total price (₱)<input name="total" type="text" inputmode="decimal" data-currency data-minimum="0.02" value="${e(b.budget)}" ${locked} required></label>
          <label>Deposit (₱)<input name="deposit" type="text" inputmode="decimal" data-currency data-minimum="0.01" value="${e(b.deposit_amount ?? Math.round(Number(b.budget)*50)/100)}" ${locked} required></label>
        </div>
        <p class="payment-live-balance">Balance <strong id="terms-balance"></strong></p>
        <div class="payment-fixed-date">${draft || dueDate === b.event_date ? 'Balance due on event date' : 'Agreed balance due date'}<strong>${e(dueDate)}</strong></div>
        <input name="balance_due" type="hidden" value="${e(dueDate)}">
        <details class="payment-account-details"><summary>Payment account & QR</summary>
          <label>Account name<input name="payee" maxlength="150" value="${e(savedPayee)}" required autocomplete="off"></label>
          <label>Payment QR<input name="qr" type="file" accept="image/png,image/jpeg,image/webp" ${savedQr ? '' : 'required'}></label>
          <p>PNG, JPEG or WebP, up to 1 MB.</p>
          ${paymentImage(savedQr) ? `<img class="payment-qr-preview" src="${e(savedQr)}" alt="Current freelancer payment QR">` : ''}
        </details>
        <details><summary>Cancellation terms</summary><div class="payment-amounts payment-edit-amounts">
          <label>Cancellation window (days)<input name="cancellation_days" type="number" min="0" max="365" step="1" value="${e(b.cancellation_days ?? 3)}" ${locked} required></label>
          <label>Deposit retained (%)<input name="cancellation_percent" type="number" min="0" max="100" step="0.01" value="${e(b.cancellation_percent ?? 50)}" ${locked} required></label>
        </div><p>The client reviews these terms before confirming.</p></details>
        <button class="lifecycle-button" type="submit">${draft ? 'Accept request' : 'Save payment QR'}</button>
      </form></section>`;
  }
  async function refresh() {
    const [b] = await M.rows('bookings',q => q.eq('id',id));
    if (!b) { record.textContent = 'This booking was not found or is not available to your account.'; return; }
    booking = b;
    const a = M.paymentAmounts(b);
    const statusLabel = { 'Inquiry Sent': 'Pending', 'Awaiting Confirmation': 'Pending', 'Awaiting Deposit': 'Deposit Due', 'Fully Booked': 'Booked' }[b.status] || b.status;
    record.innerHTML = M.bookingCard(b) + `<section class="agreement-card payment-progress"><h2>Payment</h2>
      <ol class="payment-steps" aria-label="Current booking status"><li class="reached">${e(statusLabel)}</li></ol>
      ${b.status === 'Inquiry Sent' ? '' : `<p class="payment-status" role="status">${e(M.paymentStatus(b))}</p>`}
      <p class="payment-notice">${e(notice(b))}</p>
      ${b.status === 'Inquiry Sent' ? '' : `<dl class="payment-amounts"><div><dt>Total</dt><dd>${M.money(a.total)}</dd></div><div><dt>Deposit ${M.depositReceived(b) ? '✓ Received' : ''}</dt><dd>${a.deposit == null ? 'To be agreed' : M.money(a.deposit)}</dd></div><div><dt>Remaining balance ${b.payment_status === 'Fully Paid' ? '✓ Received' : ''}</dt><dd>${a.balance == null ? 'To be agreed' : M.money(b.payment_status === 'Fully Paid' ? 0 : a.balance)}</dd></div></dl>`}
      ${b.balance_due_date ? `<p>Balance due: ${e(b.balance_due_date)}</p>` : ''}
      ${b.payment_issue ? `<p class="payment-issue"><strong>Payment issue reported:</strong> ${e(b.payment_issue)}. Please discuss it in the chat before submitting again.</p>` : ''}
      <div class="request-actions">${M.actionButtons(b,['accept','cancel','client_complete','complete'])}${paymentImage(b.payment_qr) ? '<button type="button" class="lifecycle-button secondary" data-payment-action="view_qr">View Payment QR</button>' : ''}</div>
      ${termsForm(b)}
      <p><a class="booking-payment-link" href="#chat-payment-controls">Open messages & payments →</a></p><p class="payment-help">Scan the freelancer’s QR in your payment app. Envisage records payment submissions and freelancer confirmations; it does not transfer money.</p>
      <p>To reschedule, ask the freelancer to cancel this request, then send a new inquiry for the agreed date.</p></section>`;
    if (['Partially Booked','Fully Booked','Completed'].includes(b.status)) {
      const ready = M.actions(b).find(([action]) => action === (role==='client' ? 'client_complete' : 'complete'));
      record.insertAdjacentHTML('beforeend', `<section class="agreement-card"><h2>Finish the event / service</h2><p>${b.status==='Completed' ? 'Completed by both participants. The client can now write a review.' : b.payment_status!=='Fully Paid' ? 'First pay and confirm the remaining balance to become Fully Booked. After the event, the client marks the service completed and the freelancer confirms it.' : b.event_date>M.today() ? 'Your booking is Fully Booked. Completion becomes available on the event date after the service has been delivered.' : b.client_completed ? 'The client marked the service completed. Waiting for the freelancer’s final confirmation.' : 'After the service is delivered, the client marks it completed. The freelancer then confirms completion.'}</p>${b.status==='Completed' ? '' : `<button type="button" class="lifecycle-button" ${ready ? `data-action="${ready[0]}" data-id="${e(id)}"` : 'disabled'}>${role==='client' ? 'Mark Service Completed' : 'Confirm Service Completed'}</button>`}</section>`);
    }
    await window.BookingDocuments?.mount(record,b,refresh);
    if (b.status === 'Completed' && role === 'client' && b.client_id === Envisage.profile.id) {
      const reviews = await M.rows('booking_reviews',q => q.eq('booking_id',id));
      record.insertAdjacentHTML('beforeend', `<section class="agreement-card"><h2>Your review</h2>${reviews.length ? `<p>${e(reviews[0].rating)} / 5 stars</p><p>${e(reviews[0].comment)}</p><p>Your review is visible on the freelancer’s profile.</p>` : '<form id="booking-review-form"><p>Review your completed service. Your name and review will be visible to other users. One review per booking.</p><label>Rating<select name="rating" required><option value="">Choose stars</option><option value="5">5 stars</option><option value="4">4 stars</option><option value="3">3 stars</option><option value="2">2 stars</option><option value="1">1 star</option></select></label><label>Your experience<textarea name="comment" minlength="10" maxlength="2000" required></textarea></label><button type="submit">Publish review</button><p id="review-feedback" role="status"></p></form>'}</section>`);
      const reviewForm = record.querySelector('#booking-review-form');
      if (reviewForm) window.BookingReviewControls.bind(reviewForm);
      record.querySelector('#booking-review-form')?.addEventListener('submit',async event => {
        event.preventDefault(); if (busy) return; busy = true;
        const form = event.target, button = form.querySelector('[type="submit"]'); button.disabled = true;
        try { await M.rpc('submit_booking_review',{p_booking:id,p_rating:Number(form.querySelector('[name="rating"]:checked').value),p_comment:form.querySelector('[name="comment"]').value.trim()}); await refresh(); }
        catch(error) { form.querySelector('#review-feedback').textContent = error.message; button.disabled = false; }
        finally { busy = false; }
      });
    }
    record.querySelector('.accept-request')?.remove();
    BookingFormControls.bindAmounts(record);
    const terms = record.querySelector('#payment-terms-form');
    if (terms) {
      const updateBalance = () => {
        const total = BookingFormControls.amount(terms.elements.total.value);
        const deposit = BookingFormControls.amount(terms.elements.deposit.value);
        terms.querySelector('#terms-balance').textContent = M.money(total - deposit);
      };
      terms.addEventListener('input', updateBalance);
      updateBalance();
    }
    terms?.addEventListener('invalid', event => {
      event.target.closest('details')?.setAttribute('open', '');
    }, true);
    terms?.addEventListener('submit',saveTerms);
    const messages = await M.rows('booking_messages',q => q.eq('booking_id',id).order('created_at'));
    // Payment actions live next to the conversation; booking details stay available below.
    record.querySelectorAll('[data-payment-action],[data-action="confirm_deposit"],[data-action="confirm_final"],[data-action="acknowledge"]').forEach(button => button.remove());
    if (b.status === 'Inquiry Sent' && role === 'freelancer') root.querySelector('.booking-detail-drawer').open = true;
    await window.BookingChatPayments.renderMessages(root.querySelector('#shared-messages'), messages, b);
    window.BookingChatPayments.renderControls(root.querySelector('#chat-payment-controls'), b, messages, refresh);
  }

  async function saveTerms(event) {
    event.preventDefault();
    if (busy) return;
    const form = event.target, button = form.querySelector('[type="submit"]'), field = name => form.querySelector(`[name="${name}"]`);
    busy = true; button.disabled = true;
    try {
      let qr = booking.payment_qr || Envisage.profile.freelancer_profile?.paymentQrData || '';
      const file = field('qr').files?.[0];
      if (file) {
        if (!['image/png','image/jpeg','image/webp'].includes(file.type) || file.size > 1000000) throw new Error('Choose a PNG, JPEG or WebP QR image under 1 MB.');
        qr = await new Promise((resolve,reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(new Error('Could not read the QR image.')); reader.readAsDataURL(file); });
      }
      await M.rpc('set_booking_payment_details',{p_id:id,p_details:{total:BookingFormControls.amount(field('total').value),deposit:BookingFormControls.amount(field('deposit').value),balance_due:booking.status === 'Inquiry Sent' ? booking.event_date : (booking.balance_due_date || booking.event_date),cancellation_days:field('cancellation_days').value,cancellation_percent:field('cancellation_percent').value,payee:field('payee').value.trim(),qr}});
      if (booking.status === 'Inquiry Sent') await M.rpc('transition_booking',{p_id:id,p_action:'accept'});
      feedback.textContent = booking.status === 'Inquiry Sent' ? 'Request accepted. Waiting for client confirmation.' : 'Payment QR updated.';
      await refresh();
    } catch(error) { feedback.textContent = error.message; button.disabled = false; }
    finally { busy = false; }
  }
  root.addEventListener('click',event => {
    if (event.target.closest('[data-close-payment]')) { close(ackDialog); close(paymentDialog); return; }
    const button = event.target.closest('[data-payment-action]');
    if (!button || !booking) return;
    const action = button.dataset.paymentAction, b = booking, a = M.paymentAmounts(b);
    if (action === 'report_payment') {
      root.querySelector('#payment-content').innerHTML = '<h2 id="payment-dialog-title">Report Payment Issue</h2><form id="payment-issue-form"><label for="payment-reason">What could not be verified?</label><textarea id="payment-reason" minlength="5" maxlength="2000" required></textarea><p>The client and admin will receive this report. The payment will remain unconfirmed.</p><button class="lifecycle-button" type="submit">Report Payment Issue</button><p id="issue-feedback" role="status"></p></form>';
      root.querySelector('#payment-issue-form').onsubmit = async event => {
        event.preventDefault(); if (busy) return; busy = true;
        const submit = event.target.querySelector('button'); submit.disabled = true;
        try { await M.rpc('report_booking_payment',{p_id:id,p_reason:root.querySelector('#payment-reason').value.trim()}); close(paymentDialog); feedback.textContent = 'Payment issue reported. Receipt was not confirmed.'; await refresh(); }
        catch(error) { root.querySelector('#issue-feedback').textContent = error.message; submit.disabled = false; }
        finally { busy = false; }
      };
    } else if (['pay_deposit','pay_balance','view_qr'].includes(action)) {
      const viewing = action === 'view_qr', deposit = action === 'pay_deposit', qr = paymentImage(b.payment_qr);
      root.querySelector('#payment-content').innerHTML = `<h2 id="payment-dialog-title">${viewing ? 'Payment QR' : deposit ? 'Pay Deposit' : 'Pay Remaining Balance'}</h2>${viewing ? '' : '<p class="payment-due">'+M.money(deposit ? a.deposit : a.balance)+'</p>'}${qr ? `<p>Pay to: <strong>${e(b.payment_payee)}</strong>. Check this name in your payment app before paying.</p><img class="payment-qr" src="${e(qr)}" alt="Freelancer payment QR"><a href="${e(qr)}" download="envisage-payment-qr.png">Download QR</a>${viewing ? "" : "<p>After paying in your payment app, submit below. The freelancer will verify receipt.</p>"}<button class="lifecycle-button" data-action="${deposit ? 'deposit' : 'final_paid'}" data-id="${e(id)}">${deposit ? 'I’ve Paid the Deposit' : 'I’ve Paid the Balance'}</button>` : '<p>The freelancer has not added a payment QR yet. Ask them to upload it in this booking’s payment section.</p>'}<p class="payment-dialog-feedback" role="status"></p>`;
    } else return;
    if (action === 'view_qr') {
      root.querySelector('#payment-content [data-action]')?.remove();
      const note = document.createElement('p');
      note.textContent = 'Use Payment Progress to submit a deposit or remaining balance. You can pay the balance early after the deposit is confirmed.';
      root.querySelector('#payment-content').append(note);
    }
    show(paymentDialog);
  });
  // Keep errors visible in the open payment dialog; closing happens only after a successful transition.
  const actionStatus = {set textContent(value) {feedback.textContent=value;const local=root.querySelector('.payment-dialog-feedback');if(local)local.textContent=value;}};
  M.bindActions(root,async () => {close(ackDialog);close(paymentDialog);await refresh();},actionStatus);
  window.BookingChatPayments.bindComposer(root.querySelector('#shared-message-form'), id, refresh);
  try {
    await refresh();
    // Notification links reach the original conversation or payment controls after rendering.
    const notificationTarget = ['#booking-record','#shared-messages','#chat-payment-controls'].includes(location.hash) ? document.querySelector(location.hash) : null;
    notificationTarget?.scrollIntoView?.({block:'start'});
    M.watch(async () => { if (!busy && !window.BookingChatPayments.pending() && !root.querySelector('#shared-message-form')?.contains(document.activeElement) && !root.querySelector('#chat-payment-controls')?.contains(document.activeElement) && !root.querySelector('dialog[open]') && !root.querySelector('#payment-terms-form')?.contains(document.activeElement) && !root.querySelector('#booking-review-form')?.contains(document.activeElement)) await refresh(); });
  } catch(error) {feedback.textContent=error.message;}
})();
