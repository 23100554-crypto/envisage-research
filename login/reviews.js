window.BookingReviews = {
  async load(root,id) {
    const M = Marketplace, e = M.escape;
    try {
      const reviews = await M.rpc('freelancer_reviews',{p_freelancer:id});
      root.innerHTML = reviews.length ? `<p><strong>${(reviews.reduce((sum,r) => sum+r.rating,0)/reviews.length).toFixed(1)} / 5</strong> · ${reviews.length} verified completed booking review${reviews.length === 1 ? '' : 's'}</p>` + reviews.map(r => `<article class="booking-review"><h3>${e(r.author_name)} · ${e(r.rating)} / 5 stars</h3><div class="review-stars" aria-label="${e(r.rating)} out of 5 stars">${'★'.repeat(Math.max(0,Math.min(5,Number(r.rating))))}${'☆'.repeat(Math.max(0,5-Math.min(5,Number(r.rating))))}</div><small>Verified completed booking · ${e(new Date(r.created_at).toLocaleDateString('en-PH'))}</small><p style="white-space:pre-wrap;overflow-wrap:anywhere">${e(r.comment)}</p></article>`).join('') : '<p>No reviews yet. Only clients with completed bookings can publish a review.</p>';
    } catch(error) { root.textContent = 'Could not load reviews. '+error.message; }
  }
};
