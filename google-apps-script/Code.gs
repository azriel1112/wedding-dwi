const SETTINGS = Object.freeze({
  sheetName: 'RSVP',
  maxGuests: 5,
  maxPublicWishes: 50
});

function setupWeddingRsvp() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (!spreadsheet) {
    throw new Error('Buka Apps Script dari Google Sheet: Ekstensi > Apps Script.');
  }

  PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID', spreadsheet.getId());
  const sheet = getRsvpSheet_();
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, 9);

  return `Siap. Spreadsheet ID tersimpan: ${spreadsheet.getId()}`;
}

function doGet(event) {
  const action = cleanText_(event?.parameter?.action, 30) || 'health';

  if (action === 'wishes') {
    const requestedLimit = Number.parseInt(event?.parameter?.limit || '12', 10);
    const limit = Math.min(Math.max(requestedLimit || 12, 1), SETTINGS.maxPublicWishes);
    return respond_(event, { ok: true, wishes: readPublicWishes_(limit) });
  }

  return respond_(event, {
    ok: true,
    service: 'wedding-rsvp-google-apps-script',
    time: new Date().toISOString()
  });
}

function doPost(event) {
  try {
    const params = event?.parameter || {};
    const action = cleanText_(params.action, 30) || 'rsvp';

    if (action !== 'rsvp') {
      return json_({ ok: false, message: 'Aksi tidak didukung.' });
    }

    const validated = validateRsvp_(params);
    if (!validated.valid) {
      return json_({ ok: false, message: 'Data RSVP tidak valid.', errors: validated.errors });
    }

    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      getRsvpSheet_().appendRow([
        new Date(),
        validated.data.name,
        validated.data.phone,
        validated.data.attendance,
        validated.data.guestCount,
        validated.data.message,
        cleanText_(params.guestFromUrl, 100),
        cleanText_(params.sourceUrl, 500),
        'website'
      ]);
    } finally {
      lock.releaseLock();
    }

    return json_({ ok: true, message: 'Konfirmasi berhasil disimpan.' });
  } catch (error) {
    return json_({ ok: false, message: error.message || 'Terjadi kesalahan.' });
  }
}

function getSpreadsheet_() {
  const id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (!id) {
    throw new Error('Jalankan fungsi setupWeddingRsvp satu kali sebelum deployment.');
  }
  return SpreadsheetApp.openById(id);
}

function getRsvpSheet_() {
  const spreadsheet = getSpreadsheet_();
  let sheet = spreadsheet.getSheetByName(SETTINGS.sheetName);

  if (!sheet) sheet = spreadsheet.insertSheet(SETTINGS.sheetName);

  if (sheet.getLastRow() === 0) {
    sheet.appendRow([
      'Waktu',
      'Nama',
      'WhatsApp',
      'Status',
      'Jumlah Tamu',
      'Ucapan',
      'Nama dari URL',
      'URL Sumber',
      'Sumber'
    ]);
  }

  return sheet;
}

function validateRsvp_(params) {
  const errors = {};
  const name = cleanText_(params.name, 80);
  const phone = cleanText_(params.phone, 30);
  const attendance = cleanText_(params.attendance, 20);
  const message = cleanText_(params.message, 500);
  let guestCount = Number.parseInt(params.guestCount || '0', 10);

  if (name.length < 2) errors.name = 'Nama minimal terdiri dari 2 karakter.';
  if (!['attending', 'not_attending', 'maybe'].includes(attendance)) {
    errors.attendance = 'Status kehadiran tidak valid.';
  }

  if (!Number.isInteger(guestCount)) guestCount = 0;
  if (attendance === 'attending') {
    if (guestCount < 1 || guestCount > SETTINGS.maxGuests) {
      errors.guestCount = `Jumlah tamu harus antara 1 sampai ${SETTINGS.maxGuests}.`;
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

function readPublicWishes_(limit) {
  const sheet = getRsvpSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];

  const values = sheet.getRange(2, 1, lastRow - 1, 6).getValues();

  return values
    .filter((row) => cleanText_(row[5], 500))
    .slice(-limit)
    .reverse()
    .map((row, index) => ({
      id: `${lastRow - index}`,
      name: cleanText_(row[1], 80),
      attendance: cleanText_(row[3], 20),
      message: cleanText_(row[5], 500),
      createdAt: row[0] instanceof Date ? row[0].toISOString() : String(row[0] || '')
    }));
}

function cleanText_(value, maxLength) {
  return String(value || '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function respond_(event, payload) {
  const callback = cleanText_(event?.parameter?.callback, 100);
  if (callback && /^[A-Za-z_$][0-9A-Za-z_$\.]*$/.test(callback)) {
    return ContentService
      .createTextOutput(`${callback}(${JSON.stringify(payload)});`)
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return json_(payload);
}

function json_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
