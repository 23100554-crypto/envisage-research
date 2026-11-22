(() => {
  const M = Marketplace, root = document.querySelector('#profile-warnings');
  async function refresh() {
    try {
      const warnings = await M.rows('account_warnings',q => q.eq('user_id',Envisage.profile.id).order('created_at',{ascending:false}));
      root.innerHTML = warnings.length ? warnings.map(w => `<article class="payment-issue"><h3>Admin warning</h3><small>${M.escape(new Date(w.created_at).toLocaleDateString('en-PH'))}</small><p style="white-space:pre-wrap;overflow-wrap:anywhere">${M.escape(w.message)}</p><p>Contact support if you need to respond to this warning.</p></article>`).join('') : '<p>No admin warnings.</p>';
    } catch(error) { root.textContent = 'Could not load warnings. '+error.message; }
    await BookingReviews.load(document.querySelector('#profile-reviews'),Envisage.profile.id);
  }
  refresh(); M.watch(refresh);
})();
