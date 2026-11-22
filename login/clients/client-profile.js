const clientProfileForm = document.querySelector('#client-profile-form');
const clientProfileMessage = document.querySelector('#client-profile-message');
const savedClientProfile = JSON.parse(localStorage.getItem('envisageClientProfile') || 'null');
const clientPhoto = document.querySelector('#client-photo');
const clientPhotoImage = document.querySelector('#client-photo-image');
const clientPhotoInitials = document.querySelector('#client-photo-initials');
let photoData = savedClientProfile?.photoData || '';

document.querySelector('#client-name').value =
  savedClientProfile?.name || localStorage.getItem('envisageName') || '';
document.querySelector('#client-phone').value = savedClientProfile?.phone || '';
document.querySelector('#client-barangay').value = savedClientProfile?.barangay || '';
document.querySelector('#client-address').value = savedClientProfile?.address || '';
document.querySelector('#client-facebook').value = savedClientProfile?.facebookName || '';
clientPhotoInitials.textContent = (
  savedClientProfile?.name ||
  localStorage.getItem('envisageName') ||
  'Client'
)
  .split(' ')
  .map((part) => part[0])
  .join('')
  .slice(0, 2)
  .toUpperCase();
if (photoData) {
  clientPhotoImage.src = photoData;
  clientPhotoImage.hidden = false;
  clientPhotoInitials.hidden = true;
}

clientPhoto.addEventListener('change', () => {
  const [file] = clientPhoto.files;
  if (!file) return;
  if (file.size > 1_500_000) {
    clientProfileMessage.textContent = 'Choose an image smaller than 1.5 MB for this prototype.';
    clientPhoto.value = '';
    return;
  }
  const reader = new FileReader();
  reader.addEventListener('load', () => {
    photoData = reader.result;
    clientPhotoImage.src = photoData;
    clientPhotoImage.hidden = false;
    clientPhotoInitials.hidden = true;
  });
  reader.readAsDataURL(file);
});

clientProfileForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const profile = {
    name: document.querySelector('#client-name').value.trim(),
    phone: document.querySelector('#client-phone').value.trim(),
    barangay: document.querySelector('#client-barangay').value,
    address: document.querySelector('#client-address').value.trim(),
    facebookName: document.querySelector('#client-facebook').value.trim(),
    photoData,
  };
  localStorage.setItem('envisageClientProfile', JSON.stringify(profile));
  localStorage.setItem('envisageName', profile.name);
  try {
    await Envisage.saveProfile({ name: profile.name, onboarding_complete: true, client_profile: profile });
  } catch (error) { clientProfileMessage.textContent = error.message; return; }
  clientProfileMessage.textContent = 'Client profile saved.';
});

document.querySelector('#logout-button').addEventListener('click', () => {
  Envisage.logout();
});
