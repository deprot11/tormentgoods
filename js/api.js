/*
 * Penghubung ke backend Apps Script.
 * Semua permintaan dikirim sebagai POST text/plain (tanpa CORS preflight):
 *   body: {"fn": "apiNamaFungsi", "args": [...]}
 * Jawaban selalu JSON: {success, data, message, code}
 */
function urlApiValid() {
  return typeof GAS_URL === 'string' && /^https:\/\/script\.google(usercontent)?\.com\/.+\/exec$/.test(GAS_URL.trim());
}

function api(fn, ...args) {
  if (!urlApiValid() && !(typeof GAS_URL === 'string' && /^http:\/\/(localhost|127\.0\.0\.1)/.test(GAS_URL))) {
    return Promise.resolve({ success: false, message: 'Alamat server belum diatur. Pemilik perlu mengisi GAS_URL di file js/config.js.', code: 'CONFIG' });
  }
  const ctrl = window.AbortController ? new AbortController() : null;
  const batas = setTimeout(() => ctrl && ctrl.abort(), 90000);
  return fetch(GAS_URL.trim(), {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ fn: fn, args: args, asal: location.origin + location.pathname }),
    redirect: 'follow',
    signal: ctrl ? ctrl.signal : undefined
  })
    .then(res => res.text())
    .then(teks => {
      let r;
      try { r = JSON.parse(teks); }
      catch (e) { return { success: false, message: 'Server mengirim jawaban yang tidak dikenali. Pastikan Web App Apps Script di-deploy dengan akses "Siapa saja" dan URL di js/config.js benar.', code: 'NET' }; }
      r = r || { success: false, message: 'Respons kosong dari server.' };
      if (!r.success && r.code === 'AUTH' && S.token) sesiBerakhir(r.message);
      return r;
    })
    .catch(err => ({
      success: false, code: 'NET',
      message: navigator.onLine === false ? 'Tidak ada koneksi internet. Coba lagi setelah tersambung.'
        : (err && err.name === 'AbortError' ? 'Server terlalu lama merespons. Coba lagi.' : 'Tidak bisa menghubungi server. Periksa koneksi lalu coba lagi.')
    }))
    .finally(() => clearTimeout(batas));
}
