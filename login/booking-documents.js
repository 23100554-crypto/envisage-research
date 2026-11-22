window.BookingDocuments = (() => {
  const M = Marketplace, e = M.escape;
  function policy(b) {
    if (b.status !== 'Inquiry Sent' && b.cancellation_terms_version !== 1) return 'No cancellation deduction was agreed in this booking. Confirmed payments are refundable if it is cancelled.';
    return `If the client requests cancellation within ${b.cancellation_days ?? 3} calendar days of the event (including the event day, Manila time), ${b.cancellation_percent ?? 50}% of the deposit is retained. Earlier client cancellations and freelancer-initiated cancellations receive a full refund of confirmed payments. Only the freelancer finalizes cancellation. Refunds are arranged directly.`;
  }
  function settlement(q) {
    return `<p>${q.requested_by ? `Cancellation requested by: ${e(q.requested_by)}` : ''}${q.reason ? `<br>Reason: ${e(q.reason)}` : ''}</p><dl class="payment-amounts"><div><dt>Confirmed payments</dt><dd>${M.money(q.paid)}</dd></div><div><dt>Cancellation deduction</dt><dd>${M.money(q.deduction)}</dd></div><div><dt>Refund due</dt><dd>${M.money(q.refund_due)}</dd></div></dl><p>${e(q.refund_status)}. This statement does not confirm that a refund has been sent.</p>`;
  }
  function receipt(r) {
    const d = r.details;
    return `<article class="receipt-document"><p>ENVISAGE · Booking payment record</p><h2>${e(r.kind)}</h2><p>Receipt / statement ID: ${e(r.id)}<br>Booking: ${e(r.booking_id)}<br>Date: ${e(new Date(r.created_at).toLocaleString('en-PH',{timeZone:'Asia/Manila'}))}</p><p>Client: ${e(d.client)}<br>Freelancer: ${e(d.freelancer)}<br>Event: ${e(d.event)} · ${e(d.event_date)}<br>Service: ${e((d.services || []).join(', '))}</p><dl class="payment-amounts"><div><dt>Booking total</dt><dd>${M.money(d.total)}</dd></div><div><dt>This payment</dt><dd>${M.money(d.amount)}</dd></div><div><dt>Total confirmed paid</dt><dd>${M.money(d.paid)}</dd></div><div><dt>Remaining booking balance${d.settlement ? ' (cancelled)' : ''}</dt><dd>${M.money(d.balance)}</dd></div></dl>${d.settlement ? settlement(d.settlement) : '<p>Payment receipt confirmed by the freelancer.</p>'}<h3>Agreed cancellation terms</h3><p>${e(policy({status:'receipt',cancellation_terms_version:d.terms_version,cancellation_days:d.cancellation_days,cancellation_percent:d.cancellation_percent}))}</p><p>Envisage records payments verified by the freelancer. Payments and refunds are transferred directly between the participants.</p></article>`;
  }
  async function mount(root,b,refresh) {
    const role = Envisage.profile.role;
    const panel = document.createElement('section');panel.className='agreement-card booking-documents';
    root.append(panel);
    let receipts = [], error = '';
    try { receipts = await M.rows('booking_receipts',q => q.eq('booking_id',b.id).order('created_at')); }
    catch(problem) { error = problem.message; }
    const open = ['Inquiry Sent','Awaiting Confirmation','Awaiting Deposit','Partially Booked','Fully Booked'].includes(b.status);
    panel.innerHTML = `<h2>Agreement & receipts</h2><h3>Cancellation and refund agreement</h3><p>${e(policy(b))}</p>${b.cancellation_requested_at ? `<p class="payment-issue">Client cancellation requested on ${e(new Date(b.cancellation_requested_at).toLocaleString('en-PH',{timeZone:'Asia/Manila'}))}. Reason: ${e(b.cancellation_reason)}. ${b.status === 'Cancelled' ? 'Cancellation finalized.' : 'Waiting for the freelancer to finalize cancellation. Further payment submissions are paused.'}</p>` : ''}${b.cancellation_settlement ? settlement(b.cancellation_settlement) : ''}<div class="request-actions">${open && role==='client' && !b.cancellation_requested_at ? '<button type="button" data-document-action="request_cancel" class="lifecycle-button secondary">Request Cancellation</button>' : ''}${open && role==='freelancer' ? `<button type="button" data-document-action="cancel" class="lifecycle-button secondary">${b.cancellation_requested_at ? 'Review & Confirm Cancellation' : 'Cancel Booking & Review Refund'}</button>` : ''}</div><h3>Payment receipts</h3><p>Receipts appear after the freelancer confirms receipt of payment.</p>${error ? `<p role="status">Could not load receipts: ${e(error)}</p>` : receipts.map((r,i) => `<button class="lifecycle-button secondary" type="button" data-receipt="${i}">View ${e(r.kind)}${r.kind === 'Cancellation statement' ? '' : ' Receipt'}</button>`).join('') || '<p>No confirmed-payment receipts yet.</p>'}<dialog class="payment-dialog" aria-label="Booking document"><div class="document-content"></div><button type="button" data-close-document>Close</button></dialog>`;
    const dialog = panel.querySelector('dialog'), content = panel.querySelector('.document-content');
    const show = () => {
      dialog.tabIndex = -1;
      if (dialog.showModal) dialog.showModal(); else dialog.setAttribute('open','');
      dialog.focus({preventScroll:true});
      dialog.scrollTop = 0;
    };
    const close = () => dialog.close ? dialog.close() : dialog.removeAttribute('open');
    panel.addEventListener('click',async event => {
      const button = event.target.closest('button');if (!button) return;
      if (button.hasAttribute('data-close-document')) {close();return;}
      if (button.dataset.receipt !== undefined) {
        const r = receipts[Number(button.dataset.receipt)];if (!r) return;
        content.innerHTML = receipt(r)+'<button type="button" data-print-receipt>Print / Save as PDF</button><p class="document-status" role="status"></p>';
        content.querySelector('[data-print-receipt]').onclick = () => {
          const page = window.open('','_blank','width=800,height=800');
          if (!page) {content.querySelector('.document-status').textContent='Allow the receipt window to open, then try again.';return;}
          page.opener=null;
          page.document.write('<!doctype html><html><head><meta charset="utf-8"><title>Envisage payment receipt</title><style>body{font:15px/1.6 system-ui,sans-serif;max-width:760px;margin:40px auto;padding:0 24px;color:#16382d}dt{font-weight:bold}dd{margin:0 0 12px}p{overflow-wrap:anywhere}@media print{body{margin:0}}</style></head><body>'+receipt(r)+'</body></html>');
          page.document.close();page.focus();page.print();
        };
        show();return;
      }
      const action = button.dataset.documentAction;if (!action) return;
      button.disabled=true;
      try {
        const q = await M.rpc('booking_cancellation_preview',{p_id:b.id});
        content.innerHTML = `<h2>${action==='request_cancel' ? 'Request cancellation' : 'Confirm cancellation'}</h2><p>${e(policy(b))}</p>${settlement(q)}<p>${action==='request_cancel' ? 'This requests cancellation; the freelancer must finalize it. The request date determines the deduction.' : 'This closes the booking and releases its calendar slot. Any refund due must still be transferred directly.'}</p><form class="cancellation-form"><label>Reason<textarea name="reason" minlength="5" maxlength="2000" required>${e(b.cancellation_reason || '')}</textarea></label><button type="submit">${action==='request_cancel' ? 'Submit Cancellation Request' : 'Confirm Cancellation'}</button><p class="document-status" role="status"></p></form>`;
        content.querySelector('form').onsubmit = async event => {
          event.preventDefault();const form = event.target, submit = form.querySelector('button');submit.disabled=true;
          try {
            await M.rpc(action==='request_cancel' ? 'request_booking_cancellation' : 'cancel_booking_with_refund',{p_id:b.id,p_reason:form.querySelector('textarea').value.trim()});
            close();await refresh();
          } catch(problem) {form.querySelector('.document-status').textContent=problem.message;submit.disabled=false;}
        };
        show();
      } catch(problem) {content.textContent=problem.message;show();}
      finally {button.disabled=false;}
    });
  }
  return {policy,mount,receipt};
})();
