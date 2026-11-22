(() => {
  // Account access uses normal navigation, including in local file previews.
  for (const [selector, destination] of [
    ['.nav-join', '../auth/register.html'],
    ['.hero-secondary', '../auth/register.html?role=freelancer'],
  ]) {
    document.querySelectorAll(selector).forEach(link => {
      link.href = destination;
    });
  }
})();
