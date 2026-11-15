const PersonalSection = (() => {

  let photoDataUrl = '';



  function countryOptions(selected = 'Malaysia') {

    return ZeekeLookups.COUNTRIES.filter(country => country !== 'Worldwide').map(country =>

      `<option value="${window.ZeekeSafe.attr(country)}" ${country === selected ? 'selected' : ''}>${window.ZeekeSafe.attr(country)}</option>`

    ).join('');

  }



  function stateOptions(selected = '') {

    return [''].concat(ZeekeLookups.MALAYSIA_STATES).map(state =>

      `<option value="${window.ZeekeSafe.attr(state)}" ${state === selected ? 'selected' : ''}>${state ? window.ZeekeSafe.attr(state) : 'Select state'}</option>`

    ).join('');

  }



  function render(stepNum) {

    return `

      <div class="step-header">

        <div class="step-header-info">

          <div class="step-count">Step ${stepNum}</div>

          <h2 class="step-title">Personal details</h2>

          <p class="step-subtitle">Use contact details you want employers to see.</p>

        </div>

      </div>

      <div class="form-body form-section">





        <div class="form-row">

          <div class="form-group">

            <label class="form-label" for="p-fullname">Full Name <span class="req">*</span></label>

            <input type="text" id="p-fullname" class="form-input" placeholder="e.g. Ashraf Zaini" maxlength="120" autocomplete="name" required>

            <div class="form-error">Name is required.</div>

          </div>

          <div class="form-group">

            <label class="form-label" for="p-jobtitle">Job Title <span class="req">*</span></label>

            <input type="text" id="p-jobtitle" class="form-input" placeholder="e.g. Graduate Software Engineer" maxlength="120" autocomplete="organization-title" data-suggestions="job-titles" required>

            <div class="form-error">Job title is required.</div>

          </div>

        </div>

        <div class="form-row">

          <div class="form-group">

            <label class="form-label" for="p-email">Email <span class="req">*</span></label>

            <input type="email" id="p-email" class="form-input" placeholder="name@example.com" maxlength="200" autocomplete="email" required>

            <div class="form-error">Valid email is required.</div>

          </div>

          <div class="form-group">

            <label class="form-label" for="p-phone">Phone Number <span class="req">*</span></label>

            <input type="tel" id="p-phone" class="form-input" placeholder="e.g. 012-345 6789" maxlength="30" autocomplete="tel" inputmode="tel" data-phone-country="#p-country" required>

            <div class="form-error">Enter a valid phone number.</div>

          </div>

        </div>

        <div class="form-row">

          <div class="form-group">

            <label class="form-label" for="p-linkedin">LinkedIn</label>

            <input type="text" id="p-linkedin" class="form-input" placeholder="linkedin.com/in/username" maxlength="200" inputmode="url" autocomplete="url" data-url="linkedin">

            <div class="form-error">Enter a valid LinkedIn profile URL or username.</div>

          </div>

          <div class="form-group">

            <label class="form-label" for="p-country">Country</label>

            <select id="p-country" class="form-select">${countryOptions()}</select>

          </div>

        </div>

        <div class="form-group form-group-full">

          <label class="form-label" for="p-portfolio">Portfolio or professional website <span class="optional-label">(optional)</span></label>

          <input type="text" id="p-portfolio" class="form-input" placeholder="https://your-portfolio.example" maxlength="300" inputmode="url" autocomplete="url">

        </div>

        <div class="form-row malaysia-location-row">

          <div class="form-group">

            <label class="form-label" for="p-state">State <span class="req">*</span></label>

            <select id="p-state" class="form-select">${stateOptions()}</select>

          </div>

          <div class="form-group">

            <label class="form-label" for="p-postcode">Postcode <span class="req">*</span></label>

            <input type="text" id="p-postcode" class="form-input" list="p-postcode-list" placeholder="e.g. 50000" maxlength="5" inputmode="numeric" autocomplete="postal-code">

            <datalist id="p-postcode-list"></datalist>

            <div class="form-error">Postcode must match the selected Malaysian state.</div>

          </div>

        </div>

        <div class="photo-upload-area mb-md">

          <div class="photo-preview-wrap" id="photo-preview-box">

            <div class="photo-placeholder" aria-hidden="true">${ReGenIcons.icon('personal')}</div>

          </div>

          <div class="photo-upload-controls"><p class="form-hint" id="photo-template-context">Your photo appears only in dedicated photo layouts. Text-only designs keep it private.</p>

            <input type="file" id="photo-upload" accept="image/jpeg, image/png" class="hidden">

            <div class="photo-actions">

              <button type="button" class="btn btn-secondary btn-sm" id="photo-choose-btn">${ReGenIcons.icon('upload')} Add photo</button>

              <button type="button" class="btn btn-danger btn-sm btn-icon hidden" id="remove-photo-btn" aria-label="Remove photo" title="Remove photo">${ReGenIcons.icon('trash')}</button>

            </div>

          </div>

        </div>

      </div>

    `;

  }



  function attachEvents(data) {

    photoDataUrl = data?.photoBase64 || '';



    if (data) {

      document.getElementById('p-fullname').value = data.fullName || '';

      document.getElementById('p-jobtitle').value = data.jobTitle || '';

      document.getElementById('p-email').value    = data.email || '';

      document.getElementById('p-phone').value    = data.phone || '';

      document.getElementById('p-linkedin').value = data.linkedin || '';

      document.getElementById('p-portfolio').value = data.portfolio || '';

      document.getElementById('p-country').value  = data.locationCountry || data.country || inferCountry(data.address);

      document.getElementById('p-state').value    = data.locationState || data.state || inferState(data.address);

      document.getElementById('p-postcode').value = data.postcode || extractPostcode(data.address);

    }



    if (photoDataUrl) setPhotoPreview(photoDataUrl);

    updateTemplateContext();



    const fileInput = document.getElementById('photo-upload');

    const chooseBtn = document.getElementById('photo-choose-btn');

    const removeBtn = document.getElementById('remove-photo-btn');

    const country = document.getElementById('p-country');

    const state = document.getElementById('p-state');

    const postcode = document.getElementById('p-postcode');

    const phone = document.getElementById('p-phone');



    chooseBtn.addEventListener('click', () => fileInput.click());

    country.addEventListener('change', () => {

      toggleMalaysiaLocation();

      formatPhoneField();

    });

    state.addEventListener('change', () => {

      renderPostcodeOptions();

      validatePostcode();

    });

    postcode.addEventListener('input', () => {

      postcode.value = postcode.value.replace(/\D/g, '').slice(0, 5);

      validatePostcode();

    });

    phone.addEventListener('input', (e) => {

      const cursor = e.target.selectionStart;

      const oldLen = e.target.value.length;

      

      const formatted = ZeekeLookups.formatPhone(phone.value, document.getElementById('p-country')?.value || 'Malaysia');

      if (formatted !== phone.value) {

        phone.value = formatted;

        const diff = formatted.length - oldLen;

        let newCursor = cursor + diff;

        if (newCursor < 0) newCursor = 0;

        e.target.setSelectionRange(newCursor, newCursor);

      }



      if (typeof Stepper !== 'undefined' && typeof Preview !== 'undefined') {

        Preview.renderDraft(Stepper.getDraftResume());

      }

    });



    renderPostcodeOptions();

    toggleMalaysiaLocation();

    formatPhoneField();



    fileInput.addEventListener('change', async (e) => {

      const file = e.target.files[0];

      if (!file) return;



      if (!['image/jpeg', 'image/png'].includes(file.type)) {

        App.showToast('Please choose a JPG or PNG photo.', 'error');

        fileInput.value = '';

        return;

      }



      if (file.size > 5 * 1024 * 1024) {

        App.showToast('Photo is too large. Please choose an image below 5MB.', 'error');

        fileInput.value = '';

        return;

      }



      try {
        App.showLoader('Preparing photo...');
        const uploadFile = await preparePhoto(file);
        App.showLoader('Uploading photo...');
        const res = await Api.uploadPhoto(uploadFile);
        if (!res.success) throw new Error(res.message || 'Failed to upload photo.');
        setPhotoPreview(res.photoBase64);
        ZeekeAccountMenu?.setPhoto(res.photoBase64);
        Preview.refreshNow();
        if(Math.min(res.width,res.height)<360)App.showToast('Photo saved. A larger original will look sharper in print.','info');
      } catch (error) {
        App.showToast(error.message || 'This photo could not be prepared. Try another JPG or PNG.', 'error');
      } finally {
        App.hideLoader();
      }
      fileInput.value = '';

    });



    removeBtn.addEventListener('click', async () => {

      App.showLoader('Removing photo...');

      const res = await Api.deletePhoto();

      App.hideLoader();

      if (res.success) {

        photoDataUrl = '';

        resetPhotoPreview();

        ZeekeAccountMenu?.setPhoto('');

        Preview.refreshNow();

      }

    });

  }



  async function updateTemplateContext(){

    const hint=document.getElementById('photo-template-context');if(!hint)return;

    try{const template=(await ReGenTemplates.catalog()).find(t=>t.id===Stepper.getDraftResume().templateId);if(!hint.isConnected)return;

      hint.textContent=template?.photo?`${template.name} has a dedicated portrait layout. Add a JPG or PNG with your face centred and space around your head. Frame and placement are in Document settings.`:'This text-only design does not display a photo. Choose a layout marked With photo in Change design to use your saved portrait.';

    }catch{}

  }

  document.addEventListener('regen:template-changed',updateTemplateContext);



  function inferCountry(address = '') {

    const text = String(address || '');

    return ZeekeLookups.COUNTRIES.find(country => country !== 'Worldwide' && new RegExp(`\\b${escapeRegExp(country)}\\b`, 'i').test(text)) || 'Malaysia';

  }



  function inferState(address = '') {

    const text = String(address || '').toLowerCase();

    return ZeekeLookups.MALAYSIA_STATES.find((state) => {

      const stateLower = state.toLowerCase();

      return text.includes(stateLower) || (stateLower.includes('kuala lumpur') && text.includes('kuala lumpur'));

    }) || '';

  }



  function extractPostcode(address = '') {

    return (String(address).match(/\b\d{5}\b/) || [''])[0];

  }



  function escapeRegExp(value) {

    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  }



  function toggleMalaysiaLocation() {

    const isMalaysia = document.getElementById('p-country').value === 'Malaysia';

    document.querySelectorAll('.malaysia-location-row').forEach(row => row.classList.toggle('hidden', !isMalaysia));

    const state = document.getElementById('p-state');

    const postcode = document.getElementById('p-postcode');

    if (state) state.required = isMalaysia;

    if (postcode) postcode.required = isMalaysia;

  }



  function renderPostcodeOptions() {

    const state = document.getElementById('p-state').value;

    const list = document.getElementById('p-postcode-list');

    if (!list) return;

    list.innerHTML = ZeekeLookups.postcodeOptions(state).map(item =>

      `<option value="${window.ZeekeSafe.attr(item.postcode)}" label="${window.ZeekeSafe.attr(`${item.town}, ${item.state}`)}"></option>`

    ).join('');

  }



  function validatePostcode() {

    const country = document.getElementById('p-country').value;

    const state = document.getElementById('p-state').value;

    const postcode = document.getElementById('p-postcode');

    const err = postcode.closest('.form-group')?.querySelector('.form-error');

    if (country !== 'Malaysia' || !postcode.value.trim()) {

      postcode.classList.remove('is-error');

      err?.classList.remove('visible');

      return true;

    }



    const result = ZeekeLookups.validateMalaysiaPostcode(postcode.value, state);

    postcode.value = result.postcode;

    postcode.classList.toggle('is-error', !result.ok);

    err?.classList.toggle('visible', !result.ok);

    return result.ok;

  }



  function formatPhoneField() {

    const phone = document.getElementById('p-phone');

    if (!phone) return;

    phone.value = ZeekeLookups.formatPhone(phone.value, document.getElementById('p-country')?.value || 'Malaysia');

  }



  function buildAddress() {

    const country = window.ZeekeSafe.value(document.getElementById('p-country'));

    const state = window.ZeekeSafe.value(document.getElementById('p-state'));

    const postcode = window.ZeekeSafe.value(document.getElementById('p-postcode'));



    if (country === 'Malaysia') {

      return [postcode, state, country].filter(Boolean).join(', ');

    }

    return country === 'Worldwide' ? '' : country;

  }



  async function preparePhoto(file) {

    if (file.size <= 1450 * 1024) {

      return file;

    }



    const bitmap = typeof createImageBitmap === 'function'

      ? await createImageBitmap(file, {imageOrientation:'from-image'})

      : await loadImage(file);

    const maxSide = 1600;

    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));

    const canvas = document.createElement('canvas');

    canvas.width = Math.max(1, Math.round(bitmap.width * scale));

    canvas.height = Math.max(1, Math.round(bitmap.height * scale));

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) { bitmap.close?.(); throw new Error('Your browser could not prepare this photo.'); }

    ctx.imageSmoothingQuality = 'high';
    ctx.fillStyle = '#ffffff';

    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    bitmap.close?.();



    let quality = 0.94;

    let blob = await canvasToBlob(canvas, quality);
    if (!blob) throw new Error('This photo could not be encoded. Please try another image.');

    while (blob.size > 1450 * 1024 && quality > 0.7) {

      quality -= 0.08;

      blob = await canvasToBlob(canvas, quality);
      if (!blob) throw new Error('This photo could not be encoded. Please try another image.');

    }



    return new File([blob], 'resume-photo.jpg', { type: 'image/jpeg' });

  }



  function canvasToBlob(canvas, quality) {

    return new Promise((resolve) => {

      canvas.toBlob((blob) => resolve(blob), 'image/jpeg', quality);

    });

  }



  function loadImage(file) {

    return new Promise((resolve, reject) => {

      const url = URL.createObjectURL(file);

      const image = new Image();

      image.onload = () => {

        URL.revokeObjectURL(url);

        resolve(image);

      };

      image.onerror = () => {

        URL.revokeObjectURL(url);

        reject(new Error('Photo could not be decoded.'));

      };

      image.src = url;

    });

  }



  function setPhotoPreview(base64Url) {

    photoDataUrl = base64Url;

    const box = document.getElementById('photo-preview-box');

    if (!box) return;

    box.innerHTML = '';

    const img = document.createElement('img');

    img.src = base64Url;

    img.alt = 'Applicant photo';

    box.appendChild(img);

    document.getElementById('remove-photo-btn')?.classList.remove('hidden');

  }



  function resetPhotoPreview() {

    const box = document.getElementById('photo-preview-box');

    if (!box) return;

    box.innerHTML = `

      <div class="photo-placeholder" aria-hidden="true">${ReGenIcons.icon('personal')}</div>`;

    document.getElementById('remove-photo-btn')?.classList.add('hidden');

  }



  function getData() {

    let isValid = true;

    formatPhoneField();

    const fields = ['p-fullname', 'p-jobtitle', 'p-email', 'p-phone'];



    fields.forEach(id => {

      const el = document.getElementById(id);

      const err = el.nextElementSibling;

      if (!el.value.trim() || (el.type === 'email' && !el.checkValidity())) {

        el.classList.add('is-error');

        if (err) err.classList.add('visible');

        isValid = false;

      } else {

        el.classList.remove('is-error');

        if (err) err.classList.remove('visible');

      }

    });



    if (!validatePostcode()) isValid = false;

    if (!isValid) return { isValid: false, data: null };



    return {

      isValid: true,

      data: {

        fullName: window.ZeekeSafe.value(document.getElementById('p-fullname')),

        jobTitle: window.ZeekeSafe.value(document.getElementById('p-jobtitle')),

        email:    window.ZeekeSafe.value(document.getElementById('p-email')),

        phone:    window.ZeekeSafe.value(document.getElementById('p-phone')),

        linkedin: window.ZeekeSafe.value(document.getElementById('p-linkedin')),

        portfolio: window.ZeekeSafe.value(document.getElementById('p-portfolio')),

        address:  buildAddress(),

        streetAddress: '',

        locationCountry: window.ZeekeSafe.value(document.getElementById('p-country')),

        locationState: window.ZeekeSafe.value(document.getElementById('p-state')),

        locationCity: '',

        postcode: window.ZeekeSafe.value(document.getElementById('p-postcode')),

        photoBase64: photoDataUrl,

      }

    };

  }



  function getPreviewData() {

    formatPhoneField();

    return {

      fullName: window.ZeekeSafe.value(document.getElementById('p-fullname')),

      jobTitle: window.ZeekeSafe.value(document.getElementById('p-jobtitle')),

      email:    window.ZeekeSafe.value(document.getElementById('p-email')),

      phone:    window.ZeekeSafe.value(document.getElementById('p-phone')),

      linkedin: window.ZeekeSafe.value(document.getElementById('p-linkedin')),

      portfolio: window.ZeekeSafe.value(document.getElementById('p-portfolio')),

      address:  buildAddress(),

      streetAddress: '',

      locationCountry: window.ZeekeSafe.value(document.getElementById('p-country')),

      locationState: window.ZeekeSafe.value(document.getElementById('p-state')),

      locationCity: '',

      postcode: window.ZeekeSafe.value(document.getElementById('p-postcode')),

      photoBase64: photoDataUrl,

    };

  }



  return { render, attachEvents, getData, getPreviewData };

})();
