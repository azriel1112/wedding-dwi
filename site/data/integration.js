/*
  KONFIGURASI RSVP TANPA HOSTING NODE.JS

  Pilihan mode:
  1. "whatsapp"          -> langsung membuka WhatsApp keluarga, tanpa database.
  2. "google-apps-script" -> menyimpan RSVP ke Google Sheets melalui Apps Script gratis.

  Setelah Apps Script di-deploy, isi webAppUrl dan ubah mode menjadi
  "google-apps-script".
*/
window.WEDDING_INTEGRATION = {
  mode: 'google-apps-script',
  webAppUrl: 'https://script.google.com/macros/s/AKfycbwuchKWHAfC9i6GQxsUpAdUfqHybHKVjXEqklcySNaTVN-EpfLNMl41K-IYuXl4SA7XSQ/exec',
  spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/1p8qH64T-z2Uca8cYa7UJiHE747mjJbP39lMl5OxKYK4/edit?gid=0#gid=0',
  fallbackWishesUrl: '/data/wishes.json'
};
 