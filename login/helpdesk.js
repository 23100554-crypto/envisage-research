const isFreelancerHelpdesk =
  new URLSearchParams(window.location.search).get('role') === 'freelancer';

if (isFreelancerHelpdesk) {
  const header = document.querySelector('.app-header');
  header.querySelector('.brand').href = '../freelancers/freelancer-profile.html';
  header.querySelector('nav').innerHTML =
    '<a href="../freelancers/freelancer-profile.html">Profile</a><a href="../freelancers/availability.html">Availability</a><a href="../freelancers/inquiries.html">Inquiries</a><a href="../freelancers/bookings.html">Bookings</a><a class="active" href="helpdesk.html?role=freelancer">Helpdesk</a>';
  const accountLink = header.querySelector('.user-chip');
  accountLink.href = '../freelancers/freelancer-profile.html';
  accountLink.textContent = 'Creative account ↗';
  document.querySelector('.back-link').href = '../freelancers/bookings.html';
  document.querySelector('.back-link').textContent = '← Back to bookings';
  document.querySelector('#reporter-role').value = 'Freelancer';
}


document.querySelector('label[for="evidence"]')?.remove();
document.querySelector('#evidence').hidden = true;
document.querySelector('#booking-id').placeholder = 'Booking UUID from your booking details';
const bookingReference = new URLSearchParams(location.search).get('booking');
if (/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(bookingReference || '')) document.querySelector('#booking-id').value = bookingReference;
document.querySelector('#helpdesk-form').addEventListener('submit', async event => {
  event.preventDefault();
  const button = event.target.querySelector('button[type="submit"]'), status = document.querySelector('#case-message');
  button.disabled = true;
  try {
    const db = await Envisage.client();
    const {data,error} = await db.from('reports').insert({booking_id:document.querySelector('#booking-id').value.trim(),reason:document.querySelector('#issue-type').value + ': ' + document.querySelector('#issue-details').value.trim()}).select('id').single();
    if(error) throw error;
    status.textContent = `Report ${data.id} submitted for admin review.`;
    event.target.reset();
  } catch(error) {status.textContent = error.message;} finally {button.disabled = false;}
});

