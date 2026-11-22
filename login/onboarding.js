(() => {
  const account = Envisage.profile;
  const isFreelancer = account.role === 'freelancer';
  const form = document.querySelector('#onboarding-form');
  const message = document.querySelector('#onboarding-message');
  const clientFields = document.querySelector('#client-fields');
  const freelancerFields = document.querySelector('#freelancer-fields');
  const photoInput = document.querySelector('#client-photo');
  const preview = document.querySelector('#client-photo-image');
  const initials = document.querySelector('#client-photo-initials');
  const saved = account.client_profile || {};
  let photoData = saved.photoData || '', readingPhoto = false, saving = false;

  clientFields.hidden = isFreelancer;
  freelancerFields.hidden = !isFreelancer;
  // Disabled fields cannot block validation for the other account type.
  clientFields.querySelectorAll('input, select').forEach(input => { input.disabled = isFreelancer; });
  freelancerFields.querySelectorAll('input, select').forEach(input => { input.disabled = !isFreelancer; });
  document.querySelector('#service').required = isFreelancer;
  document.querySelector('#creative-location').required = isFreelancer;
  document.querySelector('#welcome-title').textContent = `Welcome, ${account.name}.`;
  document.querySelector('#onboarding-copy').textContent = isFreelancer
    ? 'Choose your service and San Pedro barangay, then complete your public freelancer profile.'
    : 'Choose your San Pedro barangay to start discovering and booking local freelancers.';
  document.querySelector('#client-name-confirm').value = saved.name || account.name;
  for (const [id, key] of [['client-phone', 'phone'], ['client-barangay', 'barangay'], ['client-address', 'address'], ['client-facebook', 'facebookName']]) {
    document.getElementById(id).value = saved[key] || '';
  }
  document.querySelector('#service').value = account.freelancer_setup?.service || '';
  document.querySelector('#creative-location').value = account.freelancer_setup?.serviceArea || '';
  let serviceNames = [];
  const serviceSelect = document.querySelector('#service');
  if (isFreelancer) {
    serviceSelect.disabled = true;
    Marketplace.rows('service_categories', query => query.order('name')).then(categories => {
      serviceNames = categories.map(category => category.name);
      serviceSelect.innerHTML = '<option value="">Select your service</option>' + serviceNames.map(name => `<option value="${Marketplace.escape(name)}">${Marketplace.escape(name)}</option>`).join('');
      serviceSelect.value = account.freelancer_setup?.service || '';
      serviceSelect.disabled = false;
    }).catch(error => { message.textContent = error.message; });
  }
  initials.textContent = account.name.split(' ').map(part => part[0]).join('').slice(0, 2).toUpperCase();
  function showPhoto() {
    preview.hidden = !photoData;
    initials.hidden = Boolean(photoData);
    if (photoData) preview.src = photoData;
  }
  showPhoto();
  photoInput.addEventListener('change', () => {
    const [file] = photoInput.files;
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 1500000) {
      message.textContent = 'Choose a JPG, PNG, or WebP photo smaller than 1.5 MB.';
      photoInput.value = '';
      return;
    }
    readingPhoto = true;
    const reader = new FileReader();
    reader.onload = () => { photoData = reader.result; readingPhoto = false; message.textContent = ''; showPhoto(); };
    reader.onerror = () => { readingPhoto = false; message.textContent = 'Could not read this photo. Choose another image.'; };
    reader.readAsDataURL(file);
  });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (saving || !form.reportValidity()) return;
    if (readingPhoto) { message.textContent = 'Please wait for your photo to finish loading.'; return; }
    saving = true;
    const button = form.querySelector('[type="submit"]');
    button.disabled = true;
    message.textContent = 'Saving your profile…';
    try {
      let fields;
      if (isFreelancer) {
        const service = document.querySelector('#service').value;
        const serviceArea = document.querySelector('#creative-location').value;
        if (!serviceNames.includes(service) || !Marketplace.barangays.some(b => Marketplace.location(b) === serviceArea)) throw new Error('Choose your service and a San Pedro barangay.');
        fields = { onboarding_complete: true, freelancer_setup: { service, serviceArea } };
      } else {
        const profile = {
          name: document.querySelector('#client-name-confirm').value.trim(),
          phone: document.querySelector('#client-phone').value.trim(),
          barangay: document.querySelector('#client-barangay').value,
          address: document.querySelector('#client-address').value.trim(),
          facebookName: document.querySelector('#client-facebook').value.trim(),
          photoData,
        };
        if (!profile.name || !Marketplace.barangays.includes(profile.barangay)) throw new Error('Enter your name and choose a San Pedro barangay.');
        fields = { name: profile.name, onboarding_complete: true, client_profile: profile };
      }
      const savedProfile = await Envisage.saveProfile(fields);
      window.location.href = Envisage.home(savedProfile);
    } catch (error) { message.textContent = error.message; }
    finally { saving = false; button.disabled = false; }
  });
})();
