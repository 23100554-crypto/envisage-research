window.BookingFormControls = (() => {
  const amount = value => Number(String(value).replaceAll(',', ''));
  const formatAmount = value => Number(value).toLocaleString('en-PH', { maximumFractionDigits: 2 });
  function bindAmounts(root) {
    root.querySelectorAll('[data-currency]').forEach(input => {
      if (input.dataset.currencyBound) return;
      input.dataset.currencyBound = 'true';
      input.type = 'text';
      input.inputMode = 'decimal';
      if (input.value) input.value = formatAmount(amount(input.value));
      input.addEventListener('input', () => {
        const raw = input.value.replaceAll(',', '');
        const position = input.selectionStart;
        const before = input.value.slice(0, position).replaceAll(',', '').length;
        if (!/^\d*(\.\d{0,2})?$/.test(raw)) {
          input.setCustomValidity('Enter an amount with up to two decimal places.');
          return;
        }
        const minimum = Number(input.dataset.minimum || 0);
        input.setCustomValidity(raw && (!Number.isFinite(amount(raw)) || amount(raw) < minimum) ? 'Enter at least ₱' + formatAmount(minimum) + '.' : '');
        const [whole, fraction] = raw.split('.');
        input.value = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (fraction === undefined ? '' : '.' + fraction);
        let caret = 0, count = 0;
        while (caret < input.value.length && count < before) {
          if (input.value[caret] !== ',') count++;
          caret++;
        }
        input.setSelectionRange(caret, caret);
      });
    });
  }
  function bindDate(input) {
    input.type = 'text';
    input.readOnly = true;
    input.placeholder = 'Choose a date';
    input.setAttribute('aria-haspopup', 'dialog');
    input.setAttribute('aria-expanded', 'false');
    const host = document.createElement('div');
    host.className = 'booking-date-field';
    input.before(host);
    host.append(input);
    const popup = document.createElement('div');
    popup.className = 'booking-date-picker';
    popup.hidden = true;
    popup.setAttribute('role', 'dialog');
    popup.setAttribute('aria-label', 'Choose event date');
    popup.innerHTML = '<div class="booking-date-bar"><button type="button" data-month="-1" aria-label="Previous month">←</button><strong aria-live="polite"></strong><button type="button" data-month="1" aria-label="Next month">→</button></div><div class="booking-date-weekdays" aria-hidden="true"><span>Su</span><span>Mo</span><span>Tu</span><span>We</span><span>Th</span><span>Fr</span><span>Sa</span></div><div class="booking-date-days"></div>';
    host.append(popup);
    let month;
    function close() {
      popup.hidden = true;
      input.setAttribute('aria-expanded', 'false');
    }
    function render() {
      popup.querySelector('strong').textContent = month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      const days = popup.querySelector('.booking-date-days');
      days.replaceChildren();
      for (let i = 0; i < month.getDay(); i++) days.append(document.createElement('span'));
      const count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
      for (let day = 1; day <= count; day++) {
        const value = [month.getFullYear(), String(month.getMonth() + 1).padStart(2, '0'), String(day).padStart(2, '0')].join('-');
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = day;
        button.disabled = Boolean(input.min && value < input.min);
        button.classList.toggle('selected', input.value === value);
        button.setAttribute('aria-label', new Date(value + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }));
        button.setAttribute('aria-pressed', String(input.value === value));
        button.onclick = () => {
          input.value = value;
          input.dispatchEvent(new Event('change', { bubbles: true }));
          close();
          input.focus();
        };
        days.append(button);
      }
    }
    input.onclick = () => {
      month = input.value || input.min ? new Date((input.value || input.min) + 'T12:00:00') : new Date();
      month.setDate(1);
      popup.hidden = false;
      input.setAttribute('aria-expanded', 'true');
      render();
    };
    popup.querySelectorAll('[data-month]').forEach(button => button.onclick = () => {
      month.setMonth(month.getMonth() + Number(button.dataset.month));
      render();
    });
    input.addEventListener('keydown', event => {
      if (['Enter', ' ', 'ArrowDown'].includes(event.key)) {
        event.preventDefault();
        input.click();
        popup.querySelector('.selected:not(:disabled), .booking-date-days button:not(:disabled)')?.focus();
      }
    });
    host.addEventListener('keydown', event => {
      if (event.key === 'Escape') { event.preventDefault(); close(); input.focus(); }
    });
    document.addEventListener('click', event => { if (!host.contains(event.target)) close(); });
    input.form?.addEventListener('reset', close);
  }
  return { amount, formatAmount, bindAmounts, bindDate };
})();
