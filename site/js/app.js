const state = {
  config: null,
  countdownTimer: null
};

const attendanceLabels = {
  attending: 'Akan hadir',
  not_attending: 'Tidak dapat hadir',
  maybe: 'Masih ragu'
};


function getIntegrationConfig() {
  const config = window.WEDDING_INTEGRATION ?? {};
  return {
    mode: config.mode === 'google-apps-script' ? 'google-apps-script' : 'whatsapp',
    webAppUrl: String(config.webAppUrl ?? '').trim(),
    spreadsheetUrl: String(config.spreadsheetUrl ?? '').trim(),
    fallbackWishesUrl: String(config.fallbackWishesUrl ?? '/data/wishes.json').trim()
  };
}

function validateStaticRsvp(payload) {
  const errors = {};
  const maxGuests = Number(state.config?.settings?.maxGuests ?? 5);
  const name = String(payload.name ?? '').replace(/\s+/g, ' ').trim().slice(0, 80);
  const phone = String(payload.phone ?? '').replace(/\s+/g, ' ').trim().slice(0, 30);
  const attendance = String(payload.attendance ?? '').trim();
  const message = String(payload.message ?? '').trim().slice(0, 500);
  let guestCount = Number.parseInt(payload.guestCount, 10);

  if (name.length < 2) errors.name = 'Nama minimal terdiri dari 2 karakter.';
  if (!['attending', 'not_attending', 'maybe'].includes(attendance)) {
    errors.attendance = 'Silakan pilih status kehadiran.';
  }

  if (!Number.isInteger(guestCount)) guestCount = 0;
  if (attendance === 'attending') {
    if (guestCount < 1 || guestCount > maxGuests) {
      errors.guestCount = `Jumlah tamu harus antara 1 sampai ${maxGuests}.`;
    }
  } else {
    guestCount = 0;
  }

  if (phone && !/^[+0-9()\-\s]{7,30}$/.test(phone)) {
    errors.phone = 'Format nomor WhatsApp tidak valid.';
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    data: { name, phone, attendance, guestCount, message }
  };
}

async function sendRsvpToAppsScript(webAppUrl, payload) {
  const body = new URLSearchParams({
    action: 'rsvp',
    name: payload.name,
    phone: payload.phone,
    attendance: payload.attendance,
    guestCount: String(payload.guestCount),
    message: payload.message,
    guestFromUrl: getGuestName('Tamu Undangan'),
    sourceUrl: window.location.href
  });

  await fetch(webAppUrl, {
    method: 'POST',
    mode: 'no-cors',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
    body
  });
}

function buildWhatsappRsvpUrl(payload) {
  const number = String(state.config?.contact?.whatsapp ?? '').replace(/\D/g, '');
  if (!number) return '';

  const status = attendanceLabels[payload.attendance] ?? payload.attendance;
  const lines = [
    `Halo, saya ingin mengonfirmasi kehadiran pada pernikahan ${state.config.couple.brideShort} & ${state.config.couple.groomShort}.`,
    '',
    `Nama: ${payload.name}`,
    `Status: ${status}`,
    `Jumlah tamu: ${payload.guestCount}`
  ];

  if (payload.phone) lines.push(`WhatsApp: ${payload.phone}`);
  if (payload.message) lines.push(`Ucapan: ${payload.message}`);

  return `https://wa.me/${number}?text=${encodeURIComponent(lines.join('\n'))}`;
}

function loadJsonp(url, params = {}) {
  return new Promise((resolve, reject) => {
    const callbackName =
      `weddingJsonp_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    const script = document.createElement('script');

    const timeout = window.setTimeout(() => {
      cleanup(new Error('Waktu pengambilan ucapan habis.'));
    }, 15000);

    function cleanup(error, value) {
      window.clearTimeout(timeout);

      if (script.parentNode) {
        script.remove();
      }

      delete window[callbackName];

      if (error) {
        reject(error);
      } else {
        resolve(value);
      }
    }

    window[callbackName] = (value) => {
      cleanup(null, value);
    };

    const target = new URL(url);

    Object.entries(params).forEach(([key, value]) => {
      target.searchParams.set(key, value);
    });

    target.searchParams.set('callback', callbackName);

    // Anti-cache terutama untuk browser mobile
    target.searchParams.set('_', Date.now().toString());

    script.src = target.toString();
    script.async = true;

    script.onerror = () => {
      cleanup(
        new Error('Google Apps Script tidak dapat diakses.')
      );
    };

    document.head.appendChild(script);
  });
}
function setText(selector, value) {
  const element = document.querySelector(selector);
  if (element) element.textContent = value ?? '';
}

function setAllText(selector, value) {
  document.querySelectorAll(selector).forEach((element) => {
    element.textContent = value ?? '';
  });
}

function getGuestName(defaultName) {
  const params = new URLSearchParams(window.location.search);
  const rawName = params.get('to') ?? params.get('guest') ?? defaultName;
  return rawName.replace(/\s+/g, ' ').trim().slice(0, 100) || defaultName;
}

function formatDate(dateValue) {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return '';

  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Jakarta'
  }).format(date);
}

async function copyText(text, button) {
  const originalLabel = button.textContent;

  try {
    await navigator.clipboard.writeText(text);
    button.textContent = 'Tersalin';
  } catch {
    const input = document.createElement('textarea');
    input.value = text;
    input.style.position = 'fixed';
    input.style.opacity = '0';
    document.body.appendChild(input);
    input.select();
    document.execCommand('copy');
    input.remove();
    button.textContent = 'Tersalin';
  }

  window.setTimeout(() => {
    button.textContent = originalLabel;
  }, 1600);
}

function renderConfig(config) {
  document.title = config.siteTitle || 'Undangan Pernikahan';
  setAllText('[data-bride-short]', config.couple.brideShort);
  setAllText('[data-groom-short]', config.couple.groomShort);
  setText('#heroDate', config.event.displayDate);
  setText('#openingText', config.openingText);
  setText('#brideFull', config.couple.brideFull);
  setText('#brideParents', config.couple.brideParents);
  setText('#groomFull', config.couple.groomFull);
  setText('#groomParents', config.couple.groomParents);
  setText('#eventDisplayDate', config.event.displayDate);
  setText('#akadTitle', config.event.akad?.title);
  setText('#akadTime', config.event.akad?.time);
  setText('#receptionTitle', config.event.reception?.title);
  setText('#receptionTime', config.event.reception?.time);
  setText('#venueName', config.venue.name);
  setText('#venueAddress', config.venue.address);

  const guestName = getGuestName(config.settings?.defaultGuestName ?? 'Tamu Undangan');
  setText('#guestName', guestName);

  const mapsFrame = document.querySelector('#mapsFrame');
  mapsFrame.src = config.venue.mapsEmbedUrl;

  const directionsLink = document.querySelector('#directionsLink');
  directionsLink.href = config.venue.mapsDirectionsUrl;

  const whatsappLink = document.querySelector('#whatsappLink');
  const whatsappNumber = String(config.contact?.whatsapp ?? '').replace(/\D/g, '');
  if (whatsappNumber) {
    whatsappLink.href = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(
      `Halo, saya ingin bertanya mengenai undangan pernikahan ${config.couple.brideShort} dan ${config.couple.groomShort}.`
    )}`;
    whatsappLink.textContent = config.contact?.whatsappLabel ?? 'Hubungi Keluarga';
  } else {
    whatsappLink.hidden = true;
  }

  const maxGuests = Number(config.settings?.maxGuests ?? 5);
  const guestInput = document.querySelector('[name="guestCount"]');
  guestInput.max = String(maxGuests);

  const deadline = config.settings?.rsvpDeadline;
  if (deadline) {
    const deadlineDate = new Date(`${deadline}T23:59:59+07:00`);
    setText(
      '#rsvpDeadline',
      `Mohon konfirmasi paling lambat ${new Intl.DateTimeFormat('id-ID', {
        dateStyle: 'long',
        timeZone: config.event.timeZone || 'Asia/Jakarta'
      }).format(deadlineDate)}.`
    );
  }

  renderStory(config.story ?? []);
  renderGallery(config.gallery ?? []);
  renderAccounts(config.bankAccounts ?? []);

  const wishesSection = document.querySelector('#wishesSection');
  if (config.settings?.showWishes === false) wishesSection.hidden = true;

  startCountdown(config.event.dateTime);
}

function renderStory(items) {
  const list = document.querySelector('#storyList');

  // Section Our Story boleh tidak ada di index.html.
  // Kalau elemen #storyList tidak ditemukan, lanjutkan proses website.
  if (!list) return;

  list.replaceChildren();

  for (const item of items) {
    const article = document.createElement('article');
    article.className = 'timeline-item reveal';

    const year = document.createElement('div');
    year.className = 'timeline-year';
    year.textContent = item.year;

    const content = document.createElement('div');
    content.className = 'timeline-content';

    const title = document.createElement('h3');
    title.textContent = item.title;

    const description = document.createElement('p');
    description.textContent = item.description;

    content.append(title, description);
    article.append(year, content);
    list.append(article);
  }
}

function renderGallery(images) {
  const grid = document.querySelector('#galleryGrid');
  grid.replaceChildren();

  images.forEach((src, index) => {
    const figure = document.createElement('figure');
    figure.className = 'reveal';

    const image = document.createElement('img');
    image.src = src;
    image.alt = `Foto galeri pernikahan ${index + 1}`;
    image.loading = 'lazy';

    figure.append(image);
    grid.append(figure);
  });
}

function renderAccounts(accounts) {
  const list = document.querySelector('#accountList');
  list.replaceChildren();

  for (const account of accounts) {
    const card = document.createElement('article');
    card.className = 'account-card reveal';

    const info = document.createElement('div');
    const bank = document.createElement('h3');
    bank.textContent = account.bank;
    const number = document.createElement('p');
    number.className = 'account-number';
    number.textContent = account.number;
    const holder = document.createElement('p');
    holder.className = 'account-holder';
    holder.textContent = `a.n. ${account.holder}`;
    info.append(bank, number, holder);

    const copyButton = document.createElement('button');
    copyButton.type = 'button';
    copyButton.className = 'copy-button';
    copyButton.textContent = 'Salin';
    copyButton.addEventListener('click', () => copyText(account.number, copyButton));

    card.append(info, copyButton);
    list.append(card);
  }
}

function startCountdown(targetDate) {
  const target = new Date(targetDate).getTime();

  if (Number.isNaN(target)) {
    console.error('Tanggal countdown tidak valid:', targetDate);
    return;
  }

  if (state.countdownTimer) {
    window.clearInterval(state.countdownTimer);
    state.countdownTimer = null;
  }

  const update = () => {
    const difference = Math.max(target - Date.now(), 0);

    const days = Math.floor(difference / 86_400_000);
    const hours = Math.floor((difference % 86_400_000) / 3_600_000);
    const minutes = Math.floor((difference % 3_600_000) / 60_000);
    const seconds = Math.floor((difference % 60_000) / 1000);

    setText('#days', String(days));
    setText('#hours', String(hours).padStart(2, '0'));
    setText('#minutes', String(minutes).padStart(2, '0'));
    setText('#seconds', String(seconds).padStart(2, '0'));

    if (difference === 0 && state.countdownTimer) {
      window.clearInterval(state.countdownTimer);
      state.countdownTimer = null;
    }
  };

  update();
  state.countdownTimer = window.setInterval(update, 1000);
}

function setFieldErrors(errors = {}) {
  document.querySelectorAll('[data-error-for]').forEach((element) => {
    const field = element.dataset.errorFor;
    element.textContent = errors[field] ?? '';
  });
}

function setFormStatus(message, type = '') {
  const status = document.querySelector('#formStatus');
  status.textContent = message;
  status.className = `form-status ${type}`.trim();
}

async function submitRsvp(event) {
  event.preventDefault();
  setFieldErrors();
  setFormStatus('');

  const form = event.currentTarget;
  const submitButton = document.querySelector('#submitRsvp');
  const formData = new FormData(form);
  const validation = validateStaticRsvp({
    name: formData.get('name'),
    phone: formData.get('phone'),
    attendance: formData.get('attendance'),
    guestCount: formData.get('guestCount'),
    message: formData.get('message')
  });

  if (!validation.valid) {
    setFieldErrors(validation.errors);
    setFormStatus('Mohon periksa kembali data yang diisi.', 'error');
    return;
  }

  const payload = validation.data;
  const integration = getIntegrationConfig();
  submitButton.disabled = true;
  submitButton.textContent = 'Mengirim...';

  try {
    if (integration.mode === 'google-apps-script' && integration.webAppUrl) {
      await sendRsvpToAppsScript(integration.webAppUrl, payload);
      setFormStatus('Konfirmasi berhasil dikirim. Terima kasih.', 'success');
      window.setTimeout(loadWishes, 1800);
    } else {
      const whatsappUrl = buildWhatsappRsvpUrl(payload);
      if (!whatsappUrl) {
        throw new Error('Nomor WhatsApp keluarga belum dikonfigurasi.');
      }
      window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
      setFormStatus('Konfirmasi sudah disiapkan. Silakan kirim pesan melalui WhatsApp.', 'success');
    }

    form.reset();
    document.querySelector('[name="guestCount"]').value = '1';
    updateGuestCountVisibility();
  } catch (error) {
    setFormStatus(error.message || 'Konfirmasi gagal dikirim.', 'error');
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = 'Kirim Konfirmasi';
  }
}

function updateGuestCountVisibility() {
  const attendance = document.querySelector('[name="attendance"]').value;
  const field = document.querySelector('#guestCountField');
  const input = document.querySelector('[name="guestCount"]');
  const isAttending = attendance === 'attending';

  field.hidden = !isAttending;
  input.disabled = !isAttending;
  input.required = isAttending;
  if (isAttending && Number(input.value) < 1) input.value = '1';
}

async function loadWishes() {
  if (state.config?.settings?.showWishes === false) return;

  const list = document.querySelector('#wishesList');
  const integration = getIntegrationConfig();

  try {
    let result;

    if (integration.mode === 'google-apps-script' && integration.webAppUrl) {
      result = await loadJsonp(integration.webAppUrl, { action: 'wishes', limit: '12' });
    } else {
      const response = await fetch(integration.fallbackWishesUrl, { cache: 'no-store' });
      result = await response.json();
      if (!response.ok) throw new Error('Gagal mengambil ucapan.');
    }

    const wishes = Array.isArray(result?.wishes) ? result.wishes : [];
    list.replaceChildren();

    if (!wishes.length) {
      const empty = document.createElement('p');
      empty.className = 'empty-state';
      empty.textContent = 'Belum ada ucapan. Jadilah tamu pertama yang memberikan doa.';
      list.append(empty);
      return;
    }

    for (const wish of wishes) {
      const card = document.createElement('article');
      card.className = 'wish-card reveal';

      const name = document.createElement('h3');
      name.textContent = wish.name;

      const meta = document.createElement('p');
      meta.className = 'wish-meta';
      meta.textContent = `${attendanceLabels[wish.attendance] ?? 'Tamu'} • ${formatDate(wish.createdAt)}`;

      const message = document.createElement('p');
      message.textContent = wish.message;

      card.append(name, meta, message);
      list.append(card);
    }

    observeRevealElements();
  } catch {
    list.replaceChildren();
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = 'Ucapan belum dapat ditampilkan.';
    list.append(empty);
  }
}

let revealObserver;
function observeRevealElements() {
  if (!('IntersectionObserver' in window)) {
    document.querySelectorAll('.reveal').forEach((element) => element.classList.add('visible'));
    return;
  }

  if (!revealObserver) {
    revealObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            revealObserver.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.12 }
    );
  }

  document.querySelectorAll('.reveal:not(.visible)').forEach((element) => {
    revealObserver.observe(element);
  });
}

function setupPageInteractions() {
  document.querySelector('#openInvitation').addEventListener('click', () => {
    document.body.classList.remove('locked');
    document.querySelector('#home').scrollIntoView({ block: 'start' });
  });

  document.querySelector('#rsvpForm').addEventListener('submit', submitRsvp);
  document.querySelector('[name="attendance"]').addEventListener('change', updateGuestCountVisibility);

  const backToTop = document.querySelector('#backToTop');
  window.addEventListener('scroll', () => {
    backToTop.classList.toggle('visible', window.scrollY > 700);
  });
  backToTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
}

async function initialize() {
  setupPageInteractions();
  updateGuestCountVisibility();

  try {
    const response = await fetch('/data/wedding.json', { cache: 'no-store' });
    const config = await response.json();
    if (!response.ok) throw new Error(config.message || 'Konfigurasi tidak tersedia.');

    state.config = config;
    renderConfig(config);
    await loadWishes();
    observeRevealElements();
  } catch (error) {
    setFormStatus(`Website belum dapat dimuat: ${error.message}`, 'error');
    observeRevealElements();
  }
}

document.addEventListener('DOMContentLoaded', initialize);
function setupBackgroundMusic() {
  const music = document.querySelector('#backgroundMusic');
  const musicControl = document.querySelector('#musicControl');
  const openInvitationButton = document.querySelector('#openInvitation');

  if (!music) {
    console.warn('Elemen backgroundMusic tidak ditemukan.');
    return;
  }

  music.volume = 0.35;

  function updateMusicButton() {
    if (!musicControl) {
      return;
    }

    const isPlaying = !music.paused;

    musicControl.textContent = isPlaying ? '♫' : '▶';
    musicControl.title = isPlaying ? 'Jeda musik' : 'Putar musik';
    musicControl.setAttribute(
      'aria-label',
      isPlaying ? 'Jeda musik' : 'Putar musik'
    );

    musicControl.classList.toggle('playing', isPlaying);
  }

  async function playMusic() {
    try {
      await music.play();
      updateMusicButton();
      return true;
    } catch (error) {
      console.info(
        'Autoplay diblokir browser. Musik akan diputar setelah pengunjung berinteraksi.'
      );

      updateMusicButton();
      return false;
    }
  }

  async function unlockMusic(event) {
    if (event.target.closest('#musicControl')) {
      return;
    }

    const berhasilDiputar = await playMusic();

    if (berhasilDiputar) {
      document.removeEventListener('pointerdown', unlockMusic);
      document.removeEventListener('keydown', unlockMusic);
    }
  }

  // Mencoba memutar musik saat halaman dibuka.
  playMusic();

  // Memutar musik saat tombol Buka Undangan ditekan.
  if (openInvitationButton) {
    openInvitationButton.addEventListener('click', playMusic);
  }

  // Fallback apabila autoplay diblokir browser.
  document.addEventListener('pointerdown', unlockMusic);
  document.addEventListener('keydown', unlockMusic);

  // Tombol play dan pause.
  if (musicControl) {
    musicControl.addEventListener('click', async () => {
      if (music.paused) {
        await playMusic();
      } else {
        music.pause();
      }

      updateMusicButton();
    });
  }

  music.addEventListener('play', updateMusicButton);
  music.addEventListener('pause', updateMusicButton);

  updateMusicButton();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', setupBackgroundMusic);
} else {
  setupBackgroundMusic();
}
