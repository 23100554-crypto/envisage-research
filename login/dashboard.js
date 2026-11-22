const dashboardRole =
  new URLSearchParams(window.location.search).get('role') ||
  localStorage.getItem('envisageRole') ||
  'client';
const dashboardMessage = document.querySelector('#dashboard-message');
const dashboardLink = document.querySelector('#dashboard-link');
dashboardMessage.textContent =
  dashboardRole === 'freelancer'
    ? 'Your profile is ready for you to add a portfolio, services, and availability.'
    : 'You can now discover creative professionals near you and send a booking request.';
if (dashboardRole === 'freelancer') {
  dashboardLink.textContent = 'Set up your creative profile →';
  dashboardLink.href = '../freelancers/freelancer-profile.html';
} else {
  dashboardLink.href = '../clients/discovery.html';
}
