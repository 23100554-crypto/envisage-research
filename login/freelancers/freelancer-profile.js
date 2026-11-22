const profileForm = document.querySelector('#profile-form');
const profileMessage = document.querySelector('.form-message');
const savedProfile = JSON.parse(localStorage.getItem('envisageFreelancerProfile') || 'null');
const freelancerSetup = JSON.parse(localStorage.getItem('envisageFreelancerSetup') || 'null');
const profilePhoto = document.querySelector('#profile-photo');
const profilePhotoImage = document.querySelector('#profile-photo-image');
const profilePhotoInitials = document.querySelector('#profile-photo-initials');
let photoData = savedProfile?.photoData || '';
let savingProfile = false;
let paymentQrData = savedProfile?.paymentQrData || '';
let loadingPaymentQr = false;
const qrInput = document.querySelector('#profile-payment-qr');
const qrPreview = document.querySelector('#profile-payment-qr-preview');
const qrStatus = document.querySelector('#profile-payment-qr-status');
document.querySelector('#profile-payment-payee').value = savedProfile?.paymentPayee || '';
function showPaymentQr() {
  qrPreview.hidden = !paymentQrData;
  if (paymentQrData) qrPreview.src = paymentQrData;
  qrStatus.textContent = paymentQrData ? 'QR ready. Save your profile to keep these payment details.' : 'You can add your payment QR later.';
}
showPaymentQr();
qrInput.addEventListener('change', () => {
  const file = qrInput.files?.[0];
  if (!file) return;
  if (!['image/png','image/jpeg','image/webp'].includes(file.type) || file.size > 1000000) {
    qrStatus.textContent = 'Choose a PNG, JPEG or WebP image no larger than 1 MB.';
    qrInput.value = '';
    return;
  }
  loadingPaymentQr = true;
  qrStatus.textContent = 'Reading QR image…';
  const reader = new FileReader();
  reader.onload = () => { paymentQrData = reader.result; loadingPaymentQr = false; showPaymentQr(); };
  reader.onerror = () => { loadingPaymentQr = false; qrStatus.textContent = 'Could not read the QR image. Please choose it again.'; };
  reader.readAsDataURL(file);
});

function showPhoto(data) {
  profilePhotoImage.hidden = !data;
  profilePhotoInitials.hidden = Boolean(data);
  if (data) profilePhotoImage.src = data;
}

if (savedProfile) {
  document.querySelector('#display-name').value =
    savedProfile.displayName || localStorage.getItem('envisageName') || '';
  document.querySelector('#profile-headline').value = savedProfile.headline || '';
  document.querySelector('#profile-description').value = savedProfile.description || '';
  document.querySelector('#profile-location').value = savedProfile.location || '';
  document.querySelector('#profile-address').value = savedProfile.address || '';
  document.querySelector('#profile-facebook').value = savedProfile.facebookName || '';
  document.querySelector('#starting-rate').value = savedProfile.startingRate || '';
  document.querySelector('#portfolio-url').value = savedProfile.portfolioUrl || '';
  document.querySelectorAll('.service-options input').forEach((input) => {
    input.checked = savedProfile.services?.includes(input.value);
  });
  showPhoto(photoData);
  profileMessage.textContent = 'Your saved profile is ready to edit.';
}
if (!savedProfile) {
  document.querySelector('#display-name').value = localStorage.getItem('envisageName') || '';
  document.querySelector('#profile-location').value = freelancerSetup?.serviceArea || '';
  document.querySelectorAll('.service-options input').forEach((input) => {
    input.checked = input.value === freelancerSetup?.service;
  });
}

BookingFormControls.bindAmounts(profileForm);

profilePhoto.addEventListener('change', () => {
  const [file] = profilePhoto.files;
  if (!file) return;
  if (file.size > 1_500_000) {
    profileMessage.textContent = 'Choose an image smaller than 1.5 MB for this prototype.';
    profilePhoto.value = '';
    return;
  }
  const reader = new FileReader();
  reader.addEventListener('load', () => {
    photoData = reader.result;
    showPhoto(photoData);
  });
  reader.readAsDataURL(file);
});

profileForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (savingProfile || !profileForm.reportValidity()) return;
  if (loadingPaymentQr) { profileMessage.textContent = 'Wait for your QR image to finish loading.'; return; }
  const services = [...document.querySelectorAll('.service-options input:checked')];
  if (!services.length) {
    profileMessage.textContent = 'Select at least one service you offer.';
    return;
  }
  const updatedProfile = {
      ownerId: savedProfile?.ownerId || localStorage.getItem('envisageUserId') || '',
      displayName: document.querySelector('#display-name').value.trim(),
      headline: document.querySelector('#profile-headline').value.trim(),
      description: document.querySelector('#profile-description').value.trim(),
      location: document.querySelector('#profile-location').value.trim(),
      address: document.querySelector('#profile-address').value.trim(),
      facebookName: document.querySelector('#profile-facebook').value.trim(),
      startingRate: BookingFormControls.amount(document.querySelector('#starting-rate').value),
      services: services.map((service) => service.value),
      portfolioUrl: document.querySelector('#portfolio-url').value.trim(),
      photoData,
      paymentQrData,
      paymentPayee: document.querySelector('#profile-payment-payee').value.trim(),
  };
  if (!updatedProfile.displayName) { profileMessage.textContent = 'Enter your display name.'; return; }
  if (!Number.isFinite(updatedProfile.startingRate) || updatedProfile.startingRate < 1) { profileMessage.textContent = 'Enter a starting rate of at least ₱1.'; return; }
  savingProfile = true;
  const button = profileForm.querySelector('[type="submit"]');
  button.disabled = true;
  try {
    await Envisage.saveProfile({
      name: updatedProfile.displayName,
      onboarding_complete: true,
      freelancer_profile_complete: true,
      freelancer_profile: updatedProfile,
      freelancer_setup: { service: updatedProfile.services[0], serviceArea: updatedProfile.location },
    });
  } catch (error) {
    profileMessage.textContent = error.message;
    savingProfile = false;
    button.disabled = false;
    return;
  }
  profileMessage.textContent = 'Profile saved. Opening your availability schedule…';
  window.setTimeout(() => {
    window.location.href = 'availability.html';
  }, 650);
});

document.querySelector('#freelancer-logout').addEventListener('click', () => {
  Envisage.logout();
});
(async () => {
  try {
    const categories = await Marketplace.rows('service_categories', q => q.order('name'));
    const selected = savedProfile?.services || [freelancerSetup?.service];
    document.querySelector('.service-options').innerHTML = categories.map(c => `<label><input type="checkbox" value="${Marketplace.escape(c.name)}" ${selected.includes(c.name) ? 'checked' : ''}><span>${Marketplace.escape(c.name)}</span></label>`).join('');
    document.querySelector('#select-all-services').disabled = !categories.length;
    if (Envisage.profile.application_status !== 'Approved') profileMessage.textContent = `Application: ${Envisage.profile.application_status || 'Pending'}. Complete your profile for administrator review before accepting bookings.`;
  } catch(error) {profileMessage.textContent = error.message;}
})();

const selectAllServices = document.querySelector('#select-all-services');
selectAllServices.addEventListener('click', () => {
  document.querySelectorAll('.service-options input[type="checkbox"]').forEach(input => { input.checked = true; });
});
