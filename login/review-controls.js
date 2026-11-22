window.BookingReviewControls = {
  bind(form) {
    const select = form.querySelector('select[name="rating"]');
    if (!select) return;
    const fieldset = document.createElement('fieldset');
    fieldset.className = 'review-rating';
    const legend = document.createElement('legend');
    legend.textContent = 'Rating';
    fieldset.append(legend);
    const choices = document.createElement('div');
    choices.className = 'star-choice';
    for (let value = 1; value <= 5; value++) {
      const label = document.createElement('label');
      const input = document.createElement('input');
      input.type = 'radio';
      input.name = 'rating';
      input.value = String(value);
      input.required = true;
      input.setAttribute('aria-label', value + (value === 1 ? ' star' : ' stars'));
      const star = document.createElement('span');
      star.textContent = '☆';
      star.setAttribute('aria-hidden', 'true');
      label.append(input, star);
      choices.append(label);
      input.addEventListener('change', () => {
        choices.querySelectorAll('label').forEach((choice, index) => {
          choice.querySelector('span').textContent = index < value ? '★' : '☆';
          choice.classList.toggle('rating-filled', index < value);
        });
      });
    }
    fieldset.append(choices);
    const help = document.createElement('p');
    help.className = 'star-hint';
    help.textContent = 'Choose 1–5 stars. Reviews are available after both participants mark the booking completed.';
    fieldset.append(help);
    select.closest('label').replaceWith(fieldset);
    form.querySelector('textarea').placeholder = 'Tell others about the quality of work, communication, and your experience.';
  }
};
