'use strict';

const BOOT = (() => { try { return JSON.parse(localStorage.getItem('bc_boot')) || {}; } catch (e) { return {}; } })();
const S = {
  pub: { designs: BOOT.designs || [], settings: BOOT.settings || {}, ver: BOOT.ver || '', loaded: !!BOOT.ver, err: '' },
  token: null, me: null, adm: null,
  route: null, params: {}, stack: [],
  forms: {},
  ui: {
    katQ: '',
    pf: { tab: 'semua', q: '', desain: '', dari: '', sampai: '', page: 1 },
    verifSel: null, setTab: 'toko', pelTab: 'semua', pelQ: '', pelSort: 'n', desTab: 'semua', desQ: '', topMode: 'bulan', notifTab: 'semua'
  },
  cache: { bukti: {}, detail: {}, status: {} },
  pollTimer: null, syncing: false, lastOrder: null
};
const SB = { BELUM: 'Belum Bayar', MENUNGGU: 'Menunggu Verifikasi', LUNAS: 'Terverifikasi' };
const SP = { MASUK: 'Pesanan Masuk', KONFIRM: 'Dikonfirmasi', PRODUKSI: 'Diproduksi', SIAP: 'Siap Diambil', SELESAI: 'Selesai', BATAL: 'Dibatalkan' };
const ALUR = [SP.KONFIRM, SP.PRODUKSI, SP.SIAP, SP.SELESAI];
const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const HURUF = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const rp = n => 'Rp ' + Math.round(Number(n) || 0).toLocaleString('id-ID');
const rpSingkat = n => { n = Number(n) || 0; if (n >= 1e9) return (n / 1e9).toFixed(1).replace('.', ',') + ' M'; if (n >= 1e6) return (n / 1e6).toFixed(1).replace('.', ',') + ' jt'; if (n >= 1e3) return Math.round(n / 1e3) + ' rb'; return String(n); };
const angka = n => (Number(n) || 0).toLocaleString('id-ID');
const isSuper = () => S.me && S.me.role === 'superadmin';
const inisial = n => String(n || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';
const warnaAv = s => ['', 'c1', 'c2', 'c3'][String(s || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 4];
const pad = n => String(n).padStart(2, '0');
const isoHari = d => { d = d || new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
const tambahHari = (iso, n) => { const d = new Date(iso + 'T00:00:00'); d.setDate(d.getDate() + n); return isoHari(d); };
function tgl(iso, jam) {
  if (!iso) return '\u2014';
  const s = String(iso);
  const d = s.length <= 10 ? new Date(s + 'T00:00:00') : new Date(s);
  if (isNaN(d)) return s;
  let out = pad(d.getDate()) + ' ' + BULAN[d.getMonth()] + ' ' + d.getFullYear();
  if (jam) out += ', ' + pad(d.getHours()) + '.' + pad(d.getMinutes());
  return out;
}
function relatif(iso) {
  const d = new Date(iso); if (isNaN(d)) return '';
  const m = Math.round((Date.now() - d) / 60000);
  if (m < 1) return 'baru saja'; if (m < 60) return m + ' mnt lalu';
  const h = Math.round(m / 60); if (h < 24) return h + ' jam lalu';
  const hr = Math.round(h / 24); if (hr < 7) return hr + ' hari lalu';
  return tgl(iso);
}
function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
const ls = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } },
  del(k) { try { localStorage.removeItem(k); } catch (e) { } }
};

let progCount = 0;
function progres(on) {
  const el = $('#topProgress');
  progCount = Math.max(0, progCount + (on ? 1 : -1));
  if (progCount > 0) { el.classList.remove('done'); el.classList.add('on'); }
  else { el.classList.remove('on'); el.classList.add('done'); }
}

function toast(msg, type) {
  type = type || 'success';
  const ic = { success: 'bi-check-circle-fill', error: 'bi-exclamation-octagon-fill', warn: 'bi-exclamation-triangle-fill', info: 'bi-info-circle-fill' }[type];
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.setAttribute('role', type === 'error' ? 'alert' : 'status');
  el.innerHTML = `<i class="bi ${ic}"></i><span>${esc(msg)}</span>`;
  $('#toasts').appendChild(el);
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 220); }, type === 'error' ? 5500 : 3200);
}

async function salin(teks, label) {
  try { await navigator.clipboard.writeText(teks); }
  catch (e) {
    const ta = document.createElement('textarea'); ta.value = teks; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); } catch (x) { } ta.remove();
  }
  toast((label || 'Teks') + ' disalin', 'info');
}

function sibuk(btn, on, teks) {
  if (!btn) return;
  if (on) { btn.dataset.html = btn.innerHTML; btn.classList.add('is-loading'); if (teks) btn.textContent = teks; }
  else { btn.classList.remove('is-loading'); if (btn.dataset.html) btn.innerHTML = btn.dataset.html; }
}

function pillBayar(sb) { const c = { [SB.BELUM]: 'st-belum', [SB.MENUNGGU]: 'st-menunggu', [SB.LUNAS]: 'st-lunas' }[sb] || ''; return `<span class="pill ${c}">${esc(sb)}</span>`; }
function pillPesanan(sp) { const c = { [SP.MASUK]: 'st-masuk', [SP.KONFIRM]: 'st-konfirm', [SP.PRODUKSI]: 'st-produksi', [SP.SIAP]: 'st-siap', [SP.SELESAI]: 'st-selesai', [SP.BATAL]: 'st-batal' }[sp] || ''; return `<span class="pill ${c}">${esc(sp)}</span>`; }
function emptyState(ic, judul, teks, aksi) { return `<div class="empty"><div class="em-ic"><i class="bi ${ic}"></i></div><h4>${esc(judul)}</h4><p class="small">${esc(teks || '')}</p>${aksi || ''}</div>`; }
function skel(h, w) { return `<div class="skel" style="height:${h}px;${w ? 'width:' + w : ''}"></div>`; }

let lastFocus = null;
function bukaModal(html, opt) {
  opt = opt || {};
  lastFocus = document.activeElement;
  const m = $('#modal'), c = $('#modalCard');
  c.className = 'modal-card' + (opt.wide ? ' wide' : '');
  c.innerHTML = html;
  m.hidden = false;
  setTimeout(() => { const f = c.querySelector('[autofocus], input, textarea, select, button'); if (f) f.focus(); }, 30);
}
function tutupModal() { $('#modal').hidden = true; $('#modalCard').innerHTML = ''; if (lastFocus) try { lastFocus.focus(); } catch (e) { } }
$('#modal').addEventListener('click', e => { if (e.target.id === 'modal') tutupModal(); });

function konfirmasi(o) {
  return new Promise(res => {
    bukaModal(`
      <h3>${esc(o.judul)}</h3>
      <p class="muted">${esc(o.teks || '')}</p>
      ${o.input ? `<div class="field mt16"><label for="kfIn">${esc(o.input.label)} ${o.input.wajib ? '<span class="req">*</span>' : ''}</label>
        <textarea id="kfIn" class="textarea" rows="3" placeholder="${esc(o.input.ph || '')}"></textarea><div class="err-msg"><i class="bi bi-exclamation-circle"></i>${esc(o.input.label)} wajib diisi.</div></div>` : ''}
      <div class="modal-actions">
        <button class="btn btn-soft" id="kfNo">Batal</button>
        <button class="btn ${o.bahaya ? 'btn-danger' : 'btn-primary'}" id="kfYes">${esc(o.ok || 'Ya, lanjutkan')}</button>
      </div>`);
    $('#kfNo').onclick = () => { tutupModal(); res(null); };
    $('#kfYes').onclick = () => {
      if (o.input) {
        const v = $('#kfIn').value.trim();
        if (o.input.wajib && v.length < 3) { $('#kfIn').closest('.field').classList.add('err'); $('#kfIn').focus(); return; }
        tutupModal(); res(v); return;
      }
      tutupModal(); res(true);
    };
  });
}

function bukaDrawer(html) {
  lastFocus = document.activeElement;
  const d = $('#drawer');
  d.innerHTML = html; d.hidden = false; $('#scrim').hidden = false;
  setTimeout(() => { const f = d.querySelector('[autofocus], .drawer-body input, button'); if (f) f.focus(); }, 40);
}
function tutupDrawer() { $('#drawer').hidden = true; $('#scrim').hidden = true; $('#drawer').innerHTML = ''; if (lastFocus) try { lastFocus.focus(); } catch (e) { } }
$('#scrim').addEventListener('click', tutupDrawer);
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  if (!$('#modal').hidden) tutupModal(); else if (!$('#drawer').hidden) tutupDrawer();
});

function gantiTema() {
  const now = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', now);
  try { localStorage.setItem('bc_theme', now); } catch (e) { }
  ikonTema();
}
function ikonTema() {
  const dark = document.documentElement.getAttribute('data-theme') === 'dark';
  $$('[data-action="theme"] i').forEach(i => { i.className = 'bi ' + (dark ? 'bi-sun' : 'bi-moon-stars'); });
}

const ROUTES = {
  katalog: { shell: 'pub', render: () => renderKatalog() },
  pesan: { shell: 'pub', render: p => renderPesan(p) },
  sukses: { shell: 'pub', render: () => renderSukses() },
  status: { shell: 'pub', render: p => renderStatus(p) },
  login: { shell: 'pub', render: () => renderLogin() },
  beranda: { shell: 'adm', title: 'Beranda', render: () => renderBeranda() },
  pesanan: { shell: 'adm', title: 'Daftar Pesanan', render: () => renderPesanan() },
  detail: { shell: 'adm', title: 'Detail Pesanan', render: p => renderDetail(p) },
  verifikasi: { shell: 'adm', title: 'Verifikasi Pembayaran', render: () => renderVerifikasi() },
  input: { shell: 'adm', title: 'Input Pesanan', render: p => renderInput(p) },
  pelanggan: { shell: 'adm', title: 'Pelanggan', superOnly: true, render: () => renderPelanggan() },
  desain: { shell: 'adm', title: 'Kelola Desain', superOnly: true, render: () => renderDesain() },
  marketplace: { shell: 'adm', title: 'Penjualan Marketplace', superOnly: true, render: () => renderMarketplace() },
  pengaturan: { shell: 'adm', title: 'Pengaturan', render: () => renderPengaturan() }
};

function go(route, params, opt) {
  opt = opt || {};
  const r = ROUTES[route];
  if (!r) return;
  if (r.shell === 'adm' && !S.token) { route = 'login'; }
  if (route === 'login' && S.token) { route = 'beranda'; }
  if (ROUTES[route].superOnly && !isSuper()) { toast('Halaman ini khusus Super Admin.', 'warn'); route = 'beranda'; }
  if (S.route && S.route !== route && !opt.back) S.stack.push({ route: S.route, params: S.params[S.route] });
  if (S.stack.length > 30) S.stack.shift();
  S.route = route;
  if (params) S.params[route] = params;
  const shell = ROUTES[route].shell;
  $('#shellPublik').hidden = shell !== 'pub';
  $('#shellAdmin').hidden = shell !== 'adm';
  $$('.view').forEach(v => v.classList.remove('active'));
  const view = $('#v-' + route);
  view.classList.add('active');
  if (ROUTES[route].title) $('#admTitle').textContent = ROUTES[route].title;
  ROUTES[route].render(S.params[route] || {});
  tandaiNav(route);
  if (!opt.keepScroll) window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
}
function kembali(def) {
  const prev = S.stack.pop();
  if (prev) go(prev.route, prev.params, { back: true }); else go(def || (S.token ? 'beranda' : 'katalog'), null, { back: true });
}
function tandaiNav(route) {
  const map = { detail: 'pesanan', sukses: 'pesan' };
  const r = map[route] || route;
  $$('[data-go]').forEach(b => b.classList.toggle('on', b.dataset.go === r));
  $$('.pub-link').forEach(b => b.classList.toggle('on', b.dataset.go === r));
}

function segarkan() { if (S.route && ROUTES[S.route]) ROUTES[S.route].render(S.params[S.route] || {}); }

document.addEventListener('click', e => {
  const g = e.target.closest('[data-go]');
  if (g && !g.disabled) {
    e.preventDefault();
    const p = g.dataset.arg ? JSON.parse(g.dataset.arg) : null;
    if ($('#drawer').hidden === false && g.closest('#drawer')) tutupDrawer();
    go(g.dataset.go, p);
    return;
  }
  const a = e.target.closest('[data-action]');
  if (!a) return;
  const act = a.dataset.action;
  if (act === 'theme') gantiTema();
  else if (act === 'logout') logout();
  else if (act === 'notif') bukaNotif();
  else if (act === 'akun') bukaMenuAkun();
  else if (act === 'lainnya') bukaLainnya();
  else if (act === 'back') kembali();
  else if (act === 'close-drawer') tutupDrawer();
  else if (act === 'close-modal') tutupModal();
});

function siapkanFile(file, opt) {
  opt = opt || {};
  const maks = opt.maks || 1600, kualitas = opt.q || 0.82;
  return new Promise((resolve, reject) => {
    if (!file) return reject(new Error('Pilih file terlebih dahulu.'));
    const ok = opt.hanyaGambar ? ['image/jpeg', 'image/png', 'image/webp'] : ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (ok.indexOf(file.type) === -1) return reject(new Error(opt.hanyaGambar ? 'Format foto harus JPG, PNG, atau WEBP.' : 'Format file harus JPG, PNG, atau PDF.'));
    const baca = new FileReader();
    if (file.type === 'application/pdf') {
      if (file.size > 5 * 1024 * 1024) return reject(new Error('Ukuran PDF maksimal 5 MB.'));
      baca.onload = () => resolve({ b64: baca.result.split(',')[1], mime: file.type, nama: file.name, ukuran: file.size, preview: '' });
      baca.onerror = () => reject(new Error('Gagal membaca file.'));
      return baca.readAsDataURL(file);
    }
    if (file.size > 20 * 1024 * 1024) return reject(new Error('Ukuran gambar terlalu besar (maks 20 MB sebelum dikompres).'));
    baca.onload = () => {
      const img = new Image();
      img.onload = () => {
        if (opt.kotak) {
          const sisi = Math.min(img.naturalWidth, img.naturalHeight), out = Math.min(maks, sisi);
          const c2 = document.createElement('canvas'); c2.width = out; c2.height = out;
          c2.getContext('2d').drawImage(img, (img.naturalWidth - sisi) / 2, (img.naturalHeight - sisi) / 2, sisi, sisi, 0, 0, out, out);
          const u2 = c2.toDataURL('image/png'), b2 = u2.split(',')[1];
          return resolve({ b64: b2, mime: 'image/png', nama: 'logo.png', ukuran: Math.round(b2.length * 3 / 4), preview: u2 });
        }
        let w = img.naturalWidth, h = img.naturalHeight;
        const sk = Math.min(1, maks / Math.max(w, h));
        w = Math.round(w * sk); h = Math.round(h * sk);
        const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
        const cx = cv.getContext('2d'); cx.fillStyle = '#fff'; cx.fillRect(0, 0, w, h); cx.drawImage(img, 0, 0, w, h);
        const url = cv.toDataURL('image/jpeg', kualitas);
        const b64 = url.split(',')[1];
        const ukuran = Math.round(b64.length * 3 / 4);
        if (ukuran > 5 * 1024 * 1024) return reject(new Error('Ukuran file setelah dikompres masih di atas 5 MB.'));
        resolve({ b64, mime: 'image/jpeg', nama: file.name.replace(/\.\w+$/, '') + '.jpg', ukuran, preview: url });
      };
      img.onerror = () => reject(new Error('File gambar tidak dapat dibaca.'));
      img.src = baca.result;
    };
    baca.onerror = () => reject(new Error('Gagal membaca file.'));
    baca.readAsDataURL(file);
  });
}
const ukuranFile = b => b > 1048576 ? (b / 1048576).toFixed(1).replace('.', ',') + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB';

function pasangDropzone(root, onPilih, opt) {
  const dz = $('.dropzone', root), inp = $('input[type=file]', root), out = $('.dz-out', root);
  const tampil = f => {
    out.innerHTML = f ? `<div class="file-row mt12">
      <div class="fi">${f.preview ? `<img src="${f.preview}" alt="">` : '<i class="bi bi-file-earmark-pdf"></i>'}</div>
      <div class="grow"><div class="bold small ellipsis">${esc(f.nama)}</div><div class="xs muted">${ukuranFile(f.ukuran)} \u00b7 siap dikirim</div></div>
      <button type="button" class="icon-btn sm" data-x aria-label="Hapus file"><i class="bi bi-trash3"></i></button></div>` : '';
    dz.hidden = !!f;
    const x = $('[data-x]', out); if (x) x.onclick = () => { inp.value = ''; tampil(null); onPilih(null); };
  };
  const proses = async file => {
    try { const f = await siapkanFile(file, opt); tampil(f); onPilih(f); }
    catch (e) { toast(e.message, 'error'); inp.value = ''; }
  };
  inp.addEventListener('change', () => proses(inp.files[0]));
  ['dragenter', 'dragover'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.remove('over'); }));
  dz.addEventListener('drop', e => { if (e.dataTransfer.files[0]) proses(e.dataTransfer.files[0]); });
}
function htmlDropzone(judul, sub, gambarSaja) {
  return `<div class="dz-root"><label class="dropzone"><input type="file" accept="${gambarSaja ? 'image/\*' : 'image/\*,application/pdf'}" aria-label="${esc(judul)}">
    <span class="dz-ic"><i class="bi bi-cloud-arrow-up"></i></span>
    <div class="bold small">${esc(judul)}</div><div class="xs muted mt8">${esc(sub)}</div></label><div class="dz-out"></div></div>`;
}

function fotoDesain(d, kelas) {
  return d && d.foto
    ? `<img src="${esc(d.foto)}" alt="${esc(d.nama)}" loading="lazy" referrerpolicy="no-referrer" onerror="this.replaceWith(Object.assign(document.createElement('i'),{className:'bi bi-image'}))">`
    : `<div class="ph ${kelas || ''}"><i class="bi bi-image"></i><span>Foto belum ada</span></div>`;
}

const IKON_BAJU = '<svg class="ic-baju" viewBox="0 0 24 24" width="1.15em" height="1.15em" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true"><path d="M8 3 3.5 5.6 2 10l3 1.3V21h14v-9.7L22 10l-1.5-4.4L16 3c-.6 1.6-2.1 2.6-4 2.6S8.6 4.6 8 3Z"/></svg>';
function htmlLogo(st) { return st && st.logo ? `<img src="${esc(st.logo)}" alt="" referrerpolicy="no-referrer" onerror="this.replaceWith(document.createRange().createContextualFragment(IKON_BAJU))">` : IKON_BAJU; }
function terapkanIdentitas() {
  const st = S.pub.settings || {};
  const lg = htmlLogo(st);
  $$('.brand-mark, .rail-logo').forEach(el => { if (el.dataset.logo !== (st.logo || '-')) { el.innerHTML = lg; el.dataset.logo = st.logo || '-'; } });
  $$('[data-bind="namaToko"]').forEach(el => el.textContent = st.namaToko || 'Baju Custom');
  $$('[data-bind="tagline"]').forEach(el => el.textContent = st.tagline || 'Pre-order baju custom');
  document.title = st.namaToko || 'Baju Custom';
  const wa = st.wa ? `<a href="https:\/\/wa.me/${esc(st.wa)}" target="_blank" rel="noopener"><i class="bi bi-whatsapp"></i> WhatsApp ${esc(st.wa)}</a>` : '';
  $('#pubFoot').innerHTML = `<div class="pub-foot-in">
    <div><h4>${esc(st.namaToko || 'Baju Custom')}</h4><p>${esc(st.tagline || '')}</p><p class="mt8"><i class="bi bi-geo-alt"></i> ${esc(st.alamatAmbil || '')}</p></div>
    <div><h4>Tautan cepat</h4>
      <a href="javascript:void(0)" data-go="katalog">Katalog desain</a>
      <a href="javascript:void(0)" data-go="pesan">Form pre-order</a>
      <a href="javascript:void(0)" data-go="status">Cek status pesanan</a>
      <a href="javascript:void(0)" data-go="login">Masuk admin</a></div>
    <div><h4>Layanan pelanggan</h4><p>${esc(st.jam || '')}</p>${wa}</div></div>`;
}

function renderKatalog() {
  const v = $('#v-katalog');
  if (!S.pub.loaded) {
    v.innerHTML = S.pub.err
      ? `<div class="card narrower center">${emptyState('bi-cloud-slash', 'Katalog belum bisa dimuat', S.pub.err, '<button class="btn btn-primary btn-sm mt12" onclick="muatKatalog(true)"><i class="bi bi-arrow-clockwise"></i> Coba lagi</button>')}</div>`
      : `<div class="grid g3">${[1, 2, 3].map(() => `<div class="card">${skel(180)}<div class="mt12">${skel(18, '60%')}</div><div class="mt8">${skel(14, '40%')}</div></div>`).join('')}</div>`;
    return;
  }
  const q = S.ui.katQ.toLowerCase();
  const ds = S.pub.designs.filter(d => !q || (d.nama + ' ' + d.deskripsi).toLowerCase().includes(q));
  const pesananSaya = ls.get('bc_orders', []);
  v.innerHTML = `
    <div class="card hero">
      <div class="hero-deco"></div><div class="hero-deco b"></div>
      <span class="tag peri"><i class="bi bi-stars"></i> 1 form untuk banyak desain sekaligus</span>
      <h1 class="mt16">Pre-Order Baju Custom untuk Kamu &amp; <em>Komunitasmu</em></h1>
      <p class="lead">Pilih desain, isi jumlah per ukuran untuk lengan pendek dan panjang. Total pcs dan tagihan langsung terhitung otomatis.</p>
      <div class="row wrap mt24">
        <button class="btn btn-primary" data-go="pesan"><i class="bi bi-bag-plus"></i> Pesan Sekarang</button>
        <button class="btn btn-outline" data-go="status"><i class="bi bi-search"></i> Cek Status Pesanan</button>
      </div>
      <div class="divider mt24"></div>
      <div class="row between mb16"><b class="small">4 langkah pre-order</b>${pesananSaya.length ? `<button class="btn btn-ghost btn-sm" data-go="status"><i class="bi bi-clock-history"></i> ${pesananSaya.length} pesanan saya</button>` : ''}</div>
      <div class="steps4">
        ${[['Pilih desain', 'Dari katalog di bawah'], ['Isi ukuran & lengan', 'Pendek / panjang, S\u20133XL'], ['Unggah bukti bayar', 'Transfer ke rekening toko'], ['Ambil pesanan', 'Sesuai jadwal siap ambil']]
      .map((s, i) => `<div class="step4"><span class="n">${i + 1}</span><div><b>${s[0]}</b><small>${s[1]}</small></div></div>`).join('')}
      </div>
    </div>
    <div class="row between wrap mt24 mb16">
      <h2 style="font-size:22px">Katalog desain</h2>
      <label class="search-pill" style="min-width:min(320px,100%)"><i class="bi bi-search"></i><input id="katQ" type="search" placeholder="Cari desain\u2026" value="${esc(S.ui.katQ)}" aria-label="Cari desain"></label>
    </div>
    ${ds.length ? `<div class="pgrid">${ds.map(kartuDesainPublik).join('')}</div>`
      : `<div class="card">${emptyState('bi-palette', q ? 'Desain tidak ditemukan' : 'Belum ada desain aktif', q ? 'Coba kata kunci lain.' : 'Katalog sedang disiapkan. Cek kembali nanti ya.')}</div>`}
    <div class="card dark mt24 row between wrap">
      <div><span class="tag" style="background:rgba(255,255,255,.12);color:#fff"><i class="bi bi-people"></i> Pesanan rombongan</span>
        <h3 class="mt8" style="font-size:20px">Butuh bantuan menghitung pesanan komunitas?</h3>
        <p class="muted mt8">Kami bantu cek ukuran, jumlah, dan jadwal produksi.</p></div>
      ${S.pub.settings.wa ? `<a class="btn btn-on-dark" href="https:\/\/wa.me/${esc(S.pub.settings.wa)}" target="_blank" rel="noopener"><i class="bi bi-whatsapp"></i> Hubungi via WhatsApp</a>` : `<button class="btn btn-on-dark" data-go="pesan">Mulai isi form</button>`}
    </div>`;
  const inp = $('#katQ');
  inp.addEventListener('input', debounce(() => { S.ui.katQ = inp.value; const pos = inp.selectionStart; renderKatalog(); const n = $('#katQ'); n.focus(); n.setSelectionRange(pos, pos); }, 200));
}

function kartuDesainPublik(d) {
  const uk = (d.ukuran && d.ukuran.length ? d.ukuran : S.pub.settings.ukuran || []);
  return `<article class="pcard">
    <div class="pimg">${fotoDesain(d)}</div>
    <div><h3 style="font-size:18px">${esc(d.nama)}</h3><p class="small muted mt8">${esc(d.deskripsi || '')}</p></div>
    <div class="price2"><div><small>Lengan pendek</small><b>${rp(d.hargaPendek)}</b></div><div><small>Lengan panjang</small><b>${rp(d.hargaPanjang)}</b></div></div>
    <div><div class="xs muted mb8">Ukuran tersedia</div><div class="sizes">${uk.map(u => `<span>${esc(u)}</span>`).join('')}</div></div>
    <button class="btn btn-primary btn-block" data-go="pesan" data-arg='${esc(JSON.stringify({ pre: d.id }))}'><i class="bi bi-bag-plus"></i> Pesan Desain Ini</button>
  </article>`;
}

class FormPesanan {
  constructor(host, mode, opt) {
    this.host = host; this.mode = mode; this.opt = opt || {};
    this.bukti = null;
    const o = this.opt.order;
    if (o) {
      this.data = { nama: o.nama, hp: o.hp, komunitas: o.kom, alamat: o.alamat, catatan: o.catatan };
      this.blocks = this.dariDetail(this.opt.detail || []);
    } else {
      const draft = mode === 'publik' ? ls.get('bc_draft', null) : null;
      this.data = draft ? draft.data : { nama: '', hp: '', komunitas: '', alamat: '', catatan: '' };
      this.blocks = draft && draft.blocks && draft.blocks.length ? draft.blocks : [this.blokBaru()];
      this.blocks = this.blocks.filter(b => !b.idDesain || this.desain(b.idDesain));
      if (!this.blocks.length) this.blocks = [this.blokBaru()];
    }
    this.simpanDraft = debounce(() => { if (this.mode === 'publik') ls.set('bc_draft', { data: this.data, blocks: this.blocks }); }, 400);
  }
  daftarDesain() {
    if (this.mode === 'publik') return S.pub.designs;
    const ids = {}; this.blocks.forEach(b => { ids[b.idDesain] = 1; });
    return (S.adm ? S.adm.designs : []).filter(d => d.aktif || ids[d.id]);
  }
  desain(id) { return this.daftarDesain().find(d => d.id === id); }
  ukuranDesain(d) { const st = this.mode === 'publik' ? S.pub.settings : (S.adm ? S.adm.settings : S.pub.settings); return d && d.ukuran && d.ukuran.length ? d.ukuran : (st.ukuran || []); }
  blokBaru(idDesain) { return { uid: 'b' + Math.random().toString(36).slice(2, 8), idDesain: idDesain || '', q: {}, tutup: false }; }
  dariDetail(det) {
    const m = {}, urut = [];
    det.forEach(x => {
      if (!m[x.d]) { m[x.d] = this.blokBaru(x.d); urut.push(m[x.d]); }
      const q = m[x.d].q; q[x.u] = q[x.u] || { p: 0, l: 0 };
      q[x.u][x.l === 'Panjang' ? 'l' : 'p'] += x.q;
    });
    return urut.length ? urut : [this.blokBaru()];
  }
  tambahDesain(id) {
    if (id && this.blocks.some(b => b.idDesain === id)) return;
    const kosong = this.blocks.find(b => !b.idDesain);
    if (kosong && id) kosong.idDesain = id;
    else this.blocks.push(this.blokBaru(id));
    this.simpanDraft();
  }
  hitungBlok(b) {
    const d = this.desain(b.idDesain);
    let p = 0, l = 0;
    if (d) this.ukuranDesain(d).forEach(u => { const x = b.q[u] || {}; p += +x.p || 0; l += +x.l || 0; });
    return { p, l, pcs: p + l, rp: d ? p * d.hargaPendek + l * d.hargaPanjang : 0 };
  }
  total() {
    let pcs = 0, harga = 0, desain = 0;
    this.blocks.forEach(b => { const t = this.hitungBlok(b); pcs += t.pcs; harga += t.rp; if (t.pcs) desain++; });
    return { pcs, harga, desain };
  }

  render() {
    const m = this.mode;
    const judul = m === 'edit' ? 'Ubah Pesanan ' + this.opt.order.id : (m === 'admin' ? 'Input Pesanan Baru' : 'Form Pre-Order');
    const sub = m === 'publik' ? 'Satu form untuk banyak desain. Jumlah pcs dan tagihan dihitung otomatis.' : (m === 'admin' ? 'Untuk pesanan yang masuk lewat WhatsApp atau datang langsung.' : 'Perubahan tercatat di log aktivitas.');
    const kosongKatalog = !this.daftarDesain().length;
    this.host.innerHTML = `
      <div class="${m === 'publik' ? 'narrow' : ''}" style="${m !== 'publik' ? 'max-width:860px' : ''}">
        <div class="row between wrap mb16">
          <div><button class="btn btn-ghost btn-sm" data-action="back" style="margin-left:-12px"><i class="bi bi-arrow-left"></i> Kembali</button>
            <h1 style="font-size:${m === 'publik' ? '30' : '24'}px;margin-top:4px">${esc(judul)}</h1><p class="muted small mt8">${esc(sub)}</p></div>
          ${m === 'publik' && (this.data.nama || this.total().pcs) ? `<button class="btn btn-ghost btn-sm" data-f="reset"><i class="bi bi-arrow-counterclockwise"></i> Kosongkan form</button>` : ''}
        </div>
        ${kosongKatalog ? `<div class="note warn mb16"><i class="bi bi-exclamation-triangle"></i>Belum ada desain aktif di katalog.</div>` : ''}
        <form novalidate data-form>
          <div class="card">
            <div class="section-title"><span class="step">1</span><div><h2>Data pemesan</h2><div class="sub">Pastikan No HP aktif \u2014 dipakai untuk cek status pesanan.</div></div></div>
            ${m !== 'publik' ? `<div class="field mb16"><label for="fCari">Cari pelanggan lama <span class="opt">(opsional)</span></label>
              <div class="input-icon"><i class="bi bi-search"></i><input id="fCari" class="input" placeholder="Ketik nama atau No HP\u2026" autocomplete="off" data-f="cari"></div><div data-cari-out></div></div>` : ''}
            <div class="grid g2" style="gap:16px">
              ${this.field('nama', 'Nama pemesan', 'text', true, 'Nama lengkap', 'name')}
              ${this.field('hp', 'No HP / WhatsApp', 'tel', true, '08xxxxxxxxxx', 'tel', 'Format Indonesia, 10\u201314 digit')}
            </div>
            <div class="grid mt16" style="gap:16px">
              ${this.field('komunitas', 'Nama komunitas / instansi', 'text', false, 'Contoh: Komunitas Lari Bintaro', 'organization')}
              ${this.field('alamat', 'Alamat', 'textarea', true, 'Alamat lengkap pemesan', 'street-address')}
            </div>
          </div>
          <div class="section-title mt24"><span class="step">2</span><div><h2>Pilihan desain & ukuran</h2><div class="sub">Isi jumlah per ukuran untuk lengan pendek dan panjang.</div></div></div>
          <div class="field" data-err-items><div class="err-msg mb8"><i class="bi bi-exclamation-circle"></i><span></span></div></div>
          <div class="stack" data-blocks>${this.blocks.map((b, i) => this.htmlBlok(b, i)).join('')}</div>
          <button type="button" class="add-design mt16" data-f="tambah"><i class="bi bi-plus-circle"></i> <span data-add-lbl>Tambah Desain ${HURUF[this.blocks.length] || ''}</span></button>
          <div class="card mt24">
            <div class="field"><label for="f_catatan"><i class="bi bi-pencil-square"></i> Catatan pesanan <span class="opt">(opsional)</span></label>
              <textarea id="f_catatan" class="textarea" data-f="catatan" rows="3" maxlength="500" placeholder="Contoh: mohon dipisah per ukuran saat dikemas">${esc(this.data.catatan || '')}</textarea></div>
          </div>
          ${m === 'admin' ? `<div class="card mt24"><div class="card-head"><div><h3>Bukti pembayaran</h3><div class="sub">Opsional \u2014 jika pelanggan sudah transfer.</div></div></div>${htmlDropzone('Pilih atau seret bukti transfer', 'JPG, PNG, atau PDF \u00b7 maks 5 MB')}</div>` : ''}
          <div class="sum-bar" role="region" aria-label="Ringkasan pesanan">
            <div class="grow"><div class="lbl" data-sum-lbl></div><div class="big" data-sum-rp></div></div>
            <button type="submit" class="btn btn-primary" data-submit>${m === 'edit' ? '<i class="bi bi-check2"></i> Simpan Perubahan' : m === 'admin' ? '<i class="bi bi-check2"></i> Simpan Pesanan' : 'Kirim Pesanan <i class="bi bi-arrow-right"></i>'}</button>
          </div>
        </form>
      </div>`;
    this.pasang();
    this.segarkanTotal();
  }
  field(k, label, type, wajib, ph, ac, help) {
    const id = 'f_' + k + '_' + this.mode;
    const ctl = type === 'textarea'
      ? `<textarea id="${id}" class="textarea" rows="2" data-f="${k}" maxlength="300" autocomplete="${ac}" placeholder="${esc(ph)}">${esc(this.data[k] || '')}</textarea>`
      : `<input id="${id}" class="input" type="${type}" data-f="${k}" value="${esc(this.data[k] || '')}" autocomplete="${ac}" placeholder="${esc(ph)}" ${type === 'tel' ? 'inputmode="tel" maxlength="16"' : 'maxlength="120"'}>`;
    return `<div class="field" data-field="${k}"><label for="${id}">${esc(label)} ${wajib ? '<span class="req">*</span>' : '<span class="opt">(opsional)</span>'}</label>${ctl}
      ${help ? `<div class="help">${esc(help)}</div>` : ''}<div class="err-msg"><i class="bi bi-exclamation-circle"></i><span></span></div></div>`;
  }
  htmlBlok(b, i) {
    const d = this.desain(b.idDesain);
    const opsi = this.daftarDesain().map(x => `<option value="${esc(x.id)}" ${x.id === b.idDesain ? 'selected' : ''} ${this.blocks.some(y => y !== b && y.idDesain === x.id) ? 'disabled' : ''}>${esc(x.nama)}${x.aktif === false ? ' (nonaktif)' : ''}</option>`).join('');
    const uk = this.ukuranDesain(d);
    const t = this.hitungBlok(b);
    const huruf = HURUF[i] || (i + 1);
    const stepper = (u, s) => { const v = (b.q[u] && b.q[u][s]) || 0; return `<div class="stepper ${v ? 'has' : ''}"><button type="button" data-q="-1" data-u="${esc(u)}" data-s="${s}" aria-label="Kurangi ${s === 'p' ? 'pendek' : 'panjang'} ${esc(u)}">\u2212</button><input type="number" inputmode="numeric" min="0" max="9999" value="${v}" data-qty data-u="${esc(u)}" data-s="${s}" aria-label="Jumlah lengan ${s === 'p' ? 'pendek' : 'panjang'} ukuran ${esc(u)}"><button type="button" data-q="1" data-u="${esc(u)}" data-s="${s}" aria-label="Tambah ${s === 'p' ? 'pendek' : 'panjang'} ${esc(u)}">+</button></div>`; };
    return `<div class="dblock ${b.tutup ? 'collapsed' : ''}" data-uid="${b.uid}">
      <div class="dblock-head">
        <span class="dlabel">Desain ${huruf}</span>
        <div class="dthumb">${d && d.foto ? `<img src="${esc(d.foto)}" alt="" referrerpolicy="no-referrer">` : '<i class="bi bi-image"></i>'}</div>
        <div class="grow" style="min-width:180px"><select class="select" data-f="desain" aria-label="Pilih desain ${huruf}"><option value="">\u2014 Pilih desain \u2014</option>${opsi}</select></div>
        ${d ? `<span class="tag peri hide-sm">Pendek ${rp(d.hargaPendek)} \u00b7 Panjang ${rp(d.hargaPanjang)}</span>` : ''}
        ${b.tutup && t.pcs ? `<span class="small bold nowrap" data-head-sum>${t.pcs} pcs \u00b7 ${rp(t.rp)}</span>` : ''}
        <div class="dblock-act">
          <button type="button" class="icon-btn sm" data-f="tutup" aria-label="${b.tutup ? 'Buka' : 'Ringkas'} desain ${huruf}"><i class="bi bi-chevron-${b.tutup ? 'down' : 'up'}"></i></button>
          ${this.blocks.length > 1 ? `<button type="button" class="icon-btn sm" data-f="hapus" aria-label="Hapus desain ${huruf}"><i class="bi bi-trash3"></i></button>` : ''}
        </div>
      </div>
      <div class="dblock-body">
        ${d ? `<div class="nested" style="padding:8px 10px 4px">
          <table class="matrix"><thead><tr><th>Ukuran</th><th>Lengan pendek</th><th>Lengan panjang</th><th class="hide-sm">Subtotal</th></tr></thead>
          <tbody>${uk.map(u => { const x = b.q[u] || {}; const s = (+x.p || 0) + (+x.l || 0); return `<tr><td><span class="size-tag">${esc(u)}</span></td><td class="cell-c">${stepper(u, 'p')}</td><td class="cell-c">${stepper(u, 'l')}</td><td class="hide-sm num ${s ? '' : 'zero'}" data-rowsum="${esc(u)}">${s} pcs</td></tr>`; }).join('')}</tbody>
          <tfoot><tr><td>Total</td><td class="cell-c num" data-tp>${t.p} pcs</td><td class="cell-c num" data-tl>${t.l} pcs</td><td class="hide-sm right num" data-tt>${t.pcs} pcs</td></tr></tfoot></table></div>
          <div class="row between wrap mt12"><span class="small muted" data-blk-info>Subtotal Desain ${huruf}: ${t.pcs} pcs (${t.p} pendek, ${t.l} panjang)</span><b class="num" style="font-size:18px" data-blk-rp>${rp(t.rp)}</b></div>`
        : `<div class="nested center small muted">Pilih desain terlebih dahulu untuk mengisi ukuran.</div>`}
      </div></div>`;
  }
  pasang() {
    const h = this.host, form = $('[data-form]', h);
    form.addEventListener('submit', e => { e.preventDefault(); this.kirim(); });
    form.addEventListener('input', e => {
      const t = e.target;
      if (t.matches('[data-qty]')) { this.setQty(t.closest('[data-uid]').dataset.uid, t.dataset.u, t.dataset.s, t.value, true); return; }
      const k = t.dataset.f;
      if (k === 'cari') { this.cariPelanggan(t.value); return; }
      if (k && k in this.data) { this.data[k] = t.value; t.closest('.field') && t.closest('.field').classList.remove('err'); this.simpanDraft(); }
    });
    form.addEventListener('change', e => {
      const t = e.target;
      if (t.dataset.f === 'desain') { const b = this.blok(t); b.idDesain = t.value; b.q = {}; this.simpanDraft(); this.renderBlok(); }
      if (t.matches('[data-qty]')) t.value = this.blok(t).q[t.dataset.u] ? (this.blok(t).q[t.dataset.u][t.dataset.s] || 0) : 0;
    });
    form.addEventListener('focusin', e => { if (e.target.matches('[data-qty]')) e.target.select(); });
    form.addEventListener('click', e => {
      const q = e.target.closest('[data-q]');
      if (q) { const b = this.blok(q); const cur = (b.q[q.dataset.u] && b.q[q.dataset.u][q.dataset.s]) || 0; this.setQty(b.uid, q.dataset.u, q.dataset.s, cur + Number(q.dataset.q)); return; }
      const f = e.target.closest('[data-f]');
      if (!f) return;
      if (f.dataset.f === 'tambah') { this.blocks.forEach(b => { if (this.hitungBlok(b).pcs) b.tutup = true; }); this.blocks.push(this.blokBaru()); this.simpanDraft(); this.renderBlok(); setTimeout(() => { const s = $$('[data-f="desain"]', h).pop(); if (s) { s.focus(); s.scrollIntoView({ block: 'center', behavior: 'smooth' }); } }, 30); }
      else if (f.dataset.f === 'hapus') { const b = this.blok(f); const t = this.hitungBlok(b); const lanjut = () => { this.blocks = this.blocks.filter(x => x !== b); this.simpanDraft(); this.renderBlok(); }; if (t.pcs) konfirmasi({ judul: 'Hapus desain ini?', teks: t.pcs + ' pcs yang sudah diisi akan dihapus.', ok: 'Hapus', bahaya: true }).then(y => y && lanjut()); else lanjut(); }
      else if (f.dataset.f === 'tutup') { const b = this.blok(f); b.tutup = !b.tutup; this.renderBlok(); }
      else if (f.dataset.f === 'pakai-pel') { const p = JSON.parse(f.dataset.p); Object.assign(this.data, { nama: p.nama, hp: p.hp, komunitas: p.kom || '', alamat: p.alamat || '' }); ['nama', 'hp', 'komunitas', 'alamat'].forEach(k => { const el = $(`[data-f="${k}"]`, h); if (el) el.value = this.data[k]; }); $('[data-cari-out]', h).innerHTML = `<div class="note ok mt8"><i class="bi bi-person-check"></i>Pelanggan lama: ${esc(p.nama)}${p.n ? ' \u00b7 ' + p.n + 'x pesanan' : ''}</div>`; $('#fCari').value = ''; }
    });
    if (this.mode === 'admin') pasangDropzone($('.dz-root', h), f => { this.bukti = f; });
    const rs = $('[data-f="reset"]', h);
    if (rs) rs.onclick = () => konfirmasi({ judul: 'Kosongkan form?', teks: 'Semua isian akan dihapus.', ok: 'Kosongkan', bahaya: true }).then(y => {
      if (!y) return; ls.del('bc_draft'); S.forms.publik = new FormPesanan(h, 'publik'); S.forms.publik.render();
    });
  }
  blok(el) { const uid = el.closest('[data-uid]').dataset.uid; return this.blocks.find(b => b.uid === uid); }
  renderBlok() {
    $('[data-blocks]', this.host).innerHTML = this.blocks.map((b, i) => this.htmlBlok(b, i)).join('');
    const l = $('[data-add-lbl]', this.host); if (l) l.textContent = 'Tambah Desain ' + (HURUF[this.blocks.length] || '');
    this.segarkanTotal();
  }
  setQty(uid, u, s, val, dariKetik) {
    const b = this.blocks.find(x => x.uid === uid); if (!b) return;
    let n = Math.max(0, Math.min(9999, Math.floor(Number(val) || 0)));
    b.q[u] = b.q[u] || { p: 0, l: 0 }; b.q[u][s] = n;
    const el = $(`[data-uid="${uid}"]`, this.host);
    const inp = $(`input[data-u="${CSS.escape(u)}"][data-s="${s}"]`, el);
    if (inp && !dariKetik) inp.value = n;
    if (inp) inp.closest('.stepper').classList.toggle('has', n > 0);
    const rs = $(`[data-rowsum="${CSS.escape(u)}"]`, el);
    if (rs) { const t = (+b.q[u].p || 0) + (+b.q[u].l || 0); rs.textContent = t + ' pcs'; rs.classList.toggle('zero', !t); }
    const t = this.hitungBlok(b), i = this.blocks.indexOf(b);
    $('[data-tp]', el).textContent = t.p + ' pcs'; $('[data-tl]', el).textContent = t.l + ' pcs'; $('[data-tt]', el).textContent = t.pcs + ' pcs';
    $('[data-blk-info]', el).textContent = `Subtotal Desain ${HURUF[i]}: ${t.pcs} pcs (${t.p} pendek, ${t.l} panjang)`;
    $('[data-blk-rp]', el).textContent = rp(t.rp);
    $('[data-err-items]', this.host).classList.remove('err');
    this.simpanDraft(); this.segarkanTotal();
  }
  segarkanTotal() {
    const t = this.total();
    $('[data-sum-lbl]', this.host).textContent = `Total pesanan \u00b7 ${t.desain} desain \u00b7 ${angka(t.pcs)} pcs`;
    $('[data-sum-rp]', this.host).textContent = rp(t.harga);
  }
  cariPelanggan(q) {
    const out = $('[data-cari-out]', this.host);
    q = q.trim().toLowerCase();
    if (q.length < 2) { out.innerHTML = ''; return; }
    const src = new Map();
    (S.adm.customers || []).forEach(c => src.set(c.hp, { nama: c.nama, hp: c.hp, kom: c.kom, alamat: c.alamat, n: c.n }));
    (S.adm.orders || []).forEach(o => { if (!src.has(o.hp)) src.set(o.hp, { nama: o.nama, hp: o.hp, kom: o.kom, alamat: o.alamat, n: 0 }); });
    const hasil = Array.from(src.values()).filter(c => (c.nama + ' ' + c.hp + ' ' + (c.kom || '')).toLowerCase().includes(q)).slice(0, 5);
    out.innerHTML = hasil.length ? `<div class="stack sm mt8">${hasil.map(c => `<button type="button" class="list-row click" style="width:100%;background:var(--input);border:1px solid var(--input-border);text-align:left" data-f="pakai-pel" data-p='${esc(JSON.stringify(c))}'><span class="avatar ${warnaAv(c.nama)}">${esc(inisial(c.nama))}</span><div class="grow"><b class="small">${esc(c.nama)}</b><div class="xs muted">${esc(c.hp)}${c.kom ? ' \u00b7 ' + esc(c.kom) : ''}</div></div><i class="bi bi-arrow-return-left muted"></i></button>`).join('')}</div>` : `<div class="xs muted mt8">Tidak ditemukan \u2014 isi data pelanggan baru di bawah.</div>`;
  }
  validasi() {
    const err = {};
    const d = this.data;
    if (String(d.nama || '').trim().length < 2) err.nama = 'Nama pemesan wajib diisi.';
    const hp = String(d.hp || '').replace(/\D/g, '').replace(/^62/, '0');
    if (!/^0?8\d{8,12}$/.test(hp)) err.hp = 'No HP harus 10\u201314 digit, contoh 081234567890.';
    if (String(d.alamat || '').trim().length < 5) err.alamat = 'Alamat wajib diisi.';
    if (!this.blocks.some(b => b.idDesain)) err.items = 'Pilih minimal satu desain.';
    else if (!this.total().pcs) err.items = 'Isi minimal 1 pcs pada salah satu ukuran.';
    return err;
  }
  tampilkanError(err) {
    $$('.field.err', this.host).forEach(f => f.classList.remove('err'));
    let pertama = null;
    Object.keys(err).forEach(k => {
      const f = k === 'items' || /^item/.test(k) ? $('[data-err-items]', this.host) : $(`[data-field="${k}"]`, this.host);
      if (!f) return;
      f.classList.add('err'); $('.err-msg span', f).textContent = err[k];
      pertama = pertama || f;
    });
    if (pertama) { pertama.scrollIntoView({ block: 'center', behavior: 'smooth' }); const i = $('input,textarea,select', pertama); if (i) setTimeout(() => i.focus(), 300); }
  }
  payload() {
    return {
      nama: this.data.nama, hp: this.data.hp, komunitas: this.data.komunitas, alamat: this.data.alamat, catatan: this.data.catatan,
      items: this.blocks.filter(b => b.idDesain).map(b => ({ idDesain: b.idDesain, rows: Object.keys(b.q).map(u => ({ ukuran: u, pendek: +b.q[u].p || 0, panjang: +b.q[u].l || 0 })) }))
    };
  }
  async kirim() {
    const err = this.validasi();
    if (Object.keys(err).length) { this.tampilkanError(err); toast('Periksa kembali isian yang ditandai.', 'warn'); return; }
    const btn = $('[data-submit]', this.host);
    sibuk(btn, true, this.mode === 'publik' ? 'Mengirim\u2026' : 'Menyimpan\u2026');
    let r;
    if (this.mode === 'edit') r = await api('apiUbahPesanan', S.token, this.opt.order.id, this.payload());
    else r = await api('apiSubmitPreOrder', this.payload(), this.mode === 'admin' ? S.token : null, this.mode === 'admin' && this.bukti ? { b64: this.bukti.b64, mime: this.bukti.mime, name: this.bukti.nama } : null);
    sibuk(btn, false);
    if (!r.success) { if (r.fields) this.tampilkanError(r.fields); toast(r.message, 'error'); return; }
    if (this.mode === 'publik') {
      const o = r.data;
      const daftar = ls.get('bc_orders', []).filter(x => x.kode !== o.kode);
      daftar.unshift({ kode: o.kode, hp4: o.hp4, nama: o.nama, total: o.totalHarga, pcs: o.totalPcs, tgl: new Date().toISOString() });
      ls.set('bc_orders', daftar.slice(0, 20));
      ls.del('bc_draft');
      S.lastOrder = Object.assign({}, o, { bukti: false });
      S.forms.publik = null;
      go('sukses', null);
      return;
    }
    if (this.mode === 'admin') {
      const o = r.data, t = this.total();
      const order = { id: o.kode, tgl: new Date().toISOString(), idPel: '', nama: this.data.nama, hp: this.data.hp, kom: this.data.komunitas, alamat: this.data.alamat, pcs: o.totalPcs, total: o.totalHarga, sb: o.statusBayar, sp: SP.MASUK, ambil: '', bukti: !!this.bukti, oleh: S.me.username, catatan: this.data.catatan, alasan: '' };
      S.adm.orders.unshift(order);
      S.adm.details[o.kode] = this.keDetail();
      S.forms.admin = null;
      toast(r.message);
      go('detail', { id: o.kode });
      sinkron();
      return;
    }

    const i = S.adm.orders.findIndex(x => x.id === r.data.order.id);
    if (i > -1) S.adm.orders[i] = r.data.order;
    S.adm.details[r.data.order.id] = r.data.detail;
    S.cache.detail[r.data.order.id] = null;
    toast(r.message);
    go('detail', { id: r.data.order.id }, { back: true });
    sinkron();
  }
  keDetail() {
    const out = [];
    this.blocks.forEach(b => { const d = this.desain(b.idDesain); if (!d) return; Object.keys(b.q).forEach(u => { if (b.q[u].p) out.push({ d: d.id, n: d.nama, l: 'Pendek', u, q: b.q[u].p, h: d.hargaPendek }); if (b.q[u].l) out.push({ d: d.id, n: d.nama, l: 'Panjang', u, q: b.q[u].l, h: d.hargaPanjang }); }); });
    return out;
  }
}

function renderPesan(p) {
  const v = $('#v-pesan');
  if (!S.forms.publik || S.forms.publik.host !== v) S.forms.publik = new FormPesanan(v, 'publik');
  if (p && p.pre) { S.forms.publik.tambahDesain(p.pre); S.params.pesan = {}; }
  S.forms.publik.render();
}

function htmlRekening(st, kode) {
  const rek = (st.rekening || []).filter(r => r.norek);
  return `<div class="card mt16">
    <div class="card-head"><h3>Rekening pembayaran</h3><span class="tag peri"><i class="bi bi-bank"></i> Transfer</span></div>
    ${rek.length ? rek.map(r => `<div class="file-row mb8"><div class="fi" style="font-weight:800;font-size:12px">${esc(String(r.bank).slice(0, 4).toUpperCase())}</div>
      <div class="grow"><div class="bold num">${esc(r.norek)}</div><div class="xs muted">${esc(r.bank)} \u00b7 a.n. ${esc(r.nama)}</div></div>
      <button class="btn btn-soft btn-sm" data-copy="${esc(r.norek)}" data-copy-lbl="Nomor rekening">Salin</button></div>`).join('')
      : `<div class="note warn"><i class="bi bi-info-circle"></i>Info rekening belum diatur. Hubungi admin untuk detail pembayaran.</div>`}
    <div class="note warn mt8"><i class="bi bi-exclamation-triangle"></i><span>Cantumkan <b class="code">${esc(kode)}</b> di berita transfer.</span></div>
  </div>`;
}
document.addEventListener('click', e => { const c = e.target.closest('[data-copy]'); if (c) salin(c.dataset.copy, c.dataset.copyLbl); });

function renderSukses() {
  const v = $('#v-sukses'), o = S.lastOrder;
  if (!o) { go('katalog', null, { back: true }); return; }
  const st = S.pub.settings;
  v.innerHTML = `<div class="narrower">
    <div class="card center">
      <div style="width:64px;height:64px;border-radius:50%;background:var(--charcoal);color:var(--on-charcoal);display:grid;place-items:center;margin:0 auto 16px;font-size:30px"><i class="bi bi-check-lg"></i></div>
      <h1 style="font-size:26px">Pesanan berhasil dikirim!</h1>
      <p class="muted mt8">Terima kasih${o.nama ? ', ' + esc(o.nama.split(' ')[0]) : ''}. Silakan transfer lalu unggah bukti pembayaran.</p>
      <div class="file-row mt24" style="text-align:left;padding:16px 16px 16px 20px">
        <div class="grow"><div class="xs muted bold" style="letter-spacing:.06em">KODE PESANAN</div><div class="code" style="font-size:26px">${esc(o.kode)}</div></div>
        <button class="btn btn-primary btn-sm" data-copy="${esc(o.kode)}" data-copy-lbl="Kode pesanan"><i class="bi bi-copy"></i> Salin</button>
      </div>
      <div class="note info mt12" style="text-align:left"><i class="bi bi-info-circle"></i><span>Simpan kode ini dan 4 digit akhir No HP Anda (<b>${esc(o.hp4)}</b>) untuk cek status pesanan. Pesanan juga tersimpan di perangkat ini.</span></div>
      <button class="btn btn-outline btn-block mt12" data-pdf='${esc(JSON.stringify({ kode: o.kode, hp4: o.hp4 }))}'><i class="bi bi-file-earmark-pdf"></i> Unduh bukti pesanan (PDF)</button>
    </div>
    <div class="card mt16"><div class="card-head"><h3>Rincian tagihan</h3>${pillBayar(o.statusBayar || SB.BELUM)}</div>
      <div class="nested"><dl class="kv"><dt>Pemesan</dt><dd>${esc(o.nama)}${o.komunitas ? ' <span class="muted">(' + esc(o.komunitas) + ')</span>' : ''}</dd><dt>Total produk</dt><dd>${o.jumlahDesain || 1} desain \u00b7 ${angka(o.totalPcs)} pcs</dd></dl>
      <div class="divider"></div><div class="row between"><span class="small bold muted">TOTAL PEMBAYARAN</span><b style="font-family:var(--f-head);font-size:26px" class="num">${rp(o.totalHarga)}</b></div></div></div>
    ${htmlRekening(st, o.kode)}
    <div class="card mt16" id="suksesUpload">${o.bukti ? `<div class="note ok"><i class="bi bi-check-circle"></i>Bukti bayar sudah terkirim. Admin akan segera memverifikasi.</div>`
      : `<div class="card-head"><div><h3>Unggah bukti pembayaran</h3><div class="sub">Bisa sekarang, atau nanti lewat menu Cek Status.</div></div></div>
      ${htmlDropzone('Pilih atau seret bukti transfer', 'JPG, PNG, atau PDF \u00b7 maks 5 MB')}
      <button class="btn btn-primary btn-block mt16" id="btnKirimBukti" disabled>Kirim Bukti Pembayaran <i class="bi bi-arrow-right"></i></button>`}
      <button class="btn btn-ghost btn-block mt8" data-go="status" data-arg='${esc(JSON.stringify({ kode: o.kode, hp4: o.hp4 }))}'>${o.bukti ? 'Lihat status pesanan' : 'Nanti saja, cek status nanti'} <i class="bi bi-arrow-right"></i></button>
    </div></div>`;
  if (!o.bukti) {
    let file = null;
    const btn = $('#btnKirimBukti');
    pasangDropzone($('.dz-root', v), f => { file = f; btn.disabled = !f; });
    btn.onclick = async () => {
      sibuk(btn, true, 'Mengunggah\u2026');
      const r = await api('apiUploadBukti', o.kode, o.hp4, { b64: file.b64, mime: file.mime, name: file.nama });
      sibuk(btn, false);
      if (!r.success) { toast(r.message, 'error'); return; }
      o.bukti = true; o.statusBayar = SB.MENUNGGU; S.cache.status[o.kode] = null;
      toast(r.message); renderSukses();
    };
  }
}

function renderStatus(p) {
  const v = $('#v-status');
  p = p || {};
  const saya = ls.get('bc_orders', []);
  const res = p.kode ? S.cache.status[p.kode] : null;
  v.innerHTML = `<div class="narrow">
    <h1 style="font-size:30px">Cek status pesanan</h1><p class="muted mt8">Pantau pembayaran, produksi, dan jadwal pengambilan pesanan Anda.</p>
    <form class="card mt16" id="fStatus" novalidate>
      <div class="grid" style="grid-template-columns:minmax(0,1.3fr) minmax(0,1fr) auto;gap:12px;align-items:end">
        <div class="field"><label for="sKode">Kode pesanan</label><div class="input-icon"><i class="bi bi-hash"></i><input id="sKode" class="input code" placeholder="PO-261105-001" value="${esc(p.kode || '')}" autocomplete="off" autocapitalize="characters"></div></div>
        <div class="field"><label for="sHp">4 digit akhir No HP</label><div class="input-icon"><i class="bi bi-telephone"></i><input id="sHp" class="input num" inputmode="numeric" maxlength="4" placeholder="7890" value="${esc(p.hp4 || '')}" autocomplete="off"></div></div>
        <button class="btn btn-primary" type="submit" id="sBtn"><i class="bi bi-search"></i> Cek Status</button>
      </div>
      ${saya.length ? `<div class="mt16"><div class="xs muted bold mb8">PESANAN DI PERANGKAT INI</div><div class="chips">${saya.map(x => `<button type="button" class="chip ${p.kode === x.kode ? 'on' : ''}" data-cek='${esc(JSON.stringify({ kode: x.kode, hp4: x.hp4 }))}'><i class="bi bi-receipt"></i> ${esc(x.kode)}</button>`).join('')}</div></div>` : ''}
    </form>
    <div id="statusOut" class="mt16">${res ? htmlStatus(res) : ''}</div>
  </div>`;
  if (window.innerWidth < 640) $('#fStatus .grid').style.gridTemplateColumns = '1fr';
  const cek = async (kode, hp4) => {
    kode = String(kode || '').trim().toUpperCase(); hp4 = String(hp4 || '').replace(/\D/g, '');
    if (!/^PO-\d{6}-\d{3,}$/.test(kode)) { toast('Format kode pesanan: PO-261105-001', 'warn'); $('#sKode').focus(); return; }
    if (hp4.length !== 4) { toast('Masukkan 4 digit terakhir No HP.', 'warn'); $('#sHp').focus(); return; }
    S.params.status = { kode, hp4 };
    const cached = S.cache.status[kode];
    if (cached) { $('#statusOut').innerHTML = htmlStatus(cached); pasangStatus(cached); }
    else $('#statusOut').innerHTML = `<div class="card">${skel(24, '40%')}<div class="mt16">${skel(80)}</div><div class="mt16">${skel(160)}</div></div>`;
    const btn = $('#sBtn'); sibuk(btn, true, 'Memeriksa\u2026');
    const r = await api('apiCekStatus', kode, hp4);
    sibuk(btn, false);
    if (!r.success) { $('#statusOut').innerHTML = `<div class="note err"><i class="bi bi-exclamation-circle"></i>${esc(r.message)}</div>`; return; }
    S.cache.status[kode] = r.data;
    $('#statusOut').innerHTML = htmlStatus(r.data); pasangStatus(r.data);
    $$('[data-cek]').forEach(c => c.classList.toggle('on', JSON.parse(c.dataset.cek).kode === kode));
  };
  $('#fStatus').onsubmit = e => { e.preventDefault(); cek($('#sKode').value, $('#sHp').value); };
  $$('[data-cek]', v).forEach(c => c.onclick = () => { const x = JSON.parse(c.dataset.cek); $('#sKode').value = x.kode; $('#sHp').value = x.hp4; cek(x.kode, x.hp4); });
  if (res) pasangStatus(res);
  if (p.kode && p.hp4) cek(p.kode, p.hp4);
}

function htmlTrack(o) {
  const step = [['Pesanan masuk', 'bi-receipt'], ['Bukti terkirim', 'bi-upload'], ['Dikonfirmasi', 'bi-patch-check'], ['Diproduksi', 'bi-scissors'], ['Siap diambil', 'bi-box-seam'], ['Selesai', 'bi-bag-check']];
  let idx = 0;
  if (o.sb === SB.MENUNGGU) idx = 1;
  if (o.sb === SB.LUNAS) idx = 2;
  const ip = [SP.KONFIRM, SP.PRODUKSI, SP.SIAP, SP.SELESAI].indexOf(o.sp);
  if (ip > -1) idx = Math.max(idx, ip + 2);
  if (o.sp === SP.SELESAI) idx = 6;
  return `<div class="track">${step.map((s, i) => `<div class="tstep ${i < idx ? 'done' : i === idx ? 'cur' : 'todo'}"><span class="tnode"><i class="bi ${i < idx ? 'bi-check-lg' : s[1]}"></i></span><span class="tl">${s[0]}</span>${i === 4 && o.ambil ? `<span class="td">${tgl(o.ambil)}</span>` : ''}</div>`).join('')}</div>`;
}

function htmlDetailItem(detail) {
  const g = {};
  detail.forEach(x => { g[x.d] = g[x.d] || { nama: x.n, p: [], l: [], pcs: 0, rp: 0 }; g[x.d][x.l === 'Panjang' ? 'l' : 'p'].push(x.u + ':' + x.q); g[x.d].pcs += x.q; g[x.d].rp += x.q * x.h; });
  return Object.keys(g).map(k => { const x = g[k]; return `<div class="nested mb8"><div class="row between"><b>${esc(x.nama)}</b><b class="num">${rp(x.rp)}</b></div><div class="small muted">${x.pcs} pcs</div>
    ${x.p.length ? `<div class="small mt8"><span class="bold">Lengan pendek:</span> <span class="num">${esc(x.p.join(' \u00b7 '))}</span></div>` : ''}${x.l.length ? `<div class="small"><span class="bold">Lengan panjang:</span> <span class="num">${esc(x.l.join(' \u00b7 '))}</span></div>` : ''}</div>`; }).join('');
}

function htmlStatus(o) {
  const st = S.pub.settings;
  let banner = '';
  if (o.sp === SP.BATAL) banner = `<div class="note err mb16"><i class="bi bi-x-octagon"></i><span>Pesanan ini dibatalkan.${o.alasan ? ' Alasan: ' + esc(o.alasan) : ''}</span></div>`;
  else if (o.sp === SP.SIAP) banner = `<div class="banner dark mb16"><span class="bi-ic"><i class="bi bi-box-seam"></i></span><div class="grow"><h2>Pesanan siap diambil${o.ambil ? ' ' + tgl(o.ambil) : ''}</h2><p class="small muted mt8" style="color:rgba(255,255,255,.75)"><i class="bi bi-geo-alt"></i> ${esc(st.alamatAmbil || '')} ${st.jam ? '\u00b7 ' + esc(st.jam) : ''}</p></div><span class="pill st-siap hide-sm">Siap Diambil</span></div>`;
  else if (o.sp === SP.PRODUKSI && o.ambil) banner = `<div class="banner dark mb16"><span class="bi-ic"><i class="bi bi-calendar-check"></i></span><div class="grow"><h2>Pesanan Anda siap diambil tanggal ${tgl(o.ambil)}</h2><p class="small mt8" style="color:rgba(255,255,255,.75)">Sedang diproduksi. Ambil di ${esc(st.alamatAmbil || 'workshop')}.</p></div></div>`;
  const perluBukti = o.sb === SB.BELUM && o.sp !== SP.BATAL;
  return `${banner}
    <div class="card"><div class="row between wrap top">
      <div><div class="xs muted bold" style="letter-spacing:.06em">KODE PESANAN</div><div class="row"><span class="code" style="font-size:22px">${esc(o.id)}</span><button class="icon-btn sm" data-copy="${esc(o.id)}" data-copy-lbl="Kode" aria-label="Salin kode"><i class="bi bi-copy"></i></button></div>
        <div class="small muted">${tgl(o.tgl, true)} \u00b7 ${esc(o.nama)}${o.kom ? ' (' + esc(o.kom) + ')' : ''}</div></div>
      <div class="row wrap">${pillBayar(o.sb)}${pillPesanan(o.sp)}</div></div>
      <div class="mt24">${htmlTrack(o)}</div>
      <button class="btn btn-outline btn-sm mt16" data-pdf='${esc(JSON.stringify({ kode: o.id, hp4: o.hp4 }))}'><i class="bi bi-file-earmark-pdf"></i> Unduh bukti pesanan (PDF)</button></div>
    ${perluBukti ? `<div class="card mt16" id="stUpload">
      ${o.alasan ? `<div class="note err mb16"><i class="bi bi-exclamation-circle"></i><span>Bukti bayar sebelumnya ditolak: ${esc(o.alasan)}. Silakan unggah ulang.</span></div>` : ''}
      <div class="card-head"><div><h3>Unggah bukti pembayaran</h3><div class="sub">Total tagihan ${rp(o.total)}</div></div></div>
      ${htmlDropzone('Pilih atau seret bukti transfer', 'JPG, PNG, atau PDF \u00b7 maks 5 MB')}
      <button class="btn btn-primary btn-block mt16" id="stKirim" disabled>Kirim Bukti Pembayaran</button></div>${htmlRekening(st, o.id)}` : ''}
    <div class="split mt16">
      <div class="card"><div class="card-head"><h3>Rincian pesanan</h3><span class="tag">${angka(o.pcs)} pcs</span></div>
        ${htmlDetailItem(o.detail || [])}
        <div class="row between mt12"><span class="bold">Total tagihan</span><b class="num" style="font-family:var(--f-head);font-size:22px">${rp(o.total)}</b></div></div>
      <div class="card"><div class="card-head"><h3>Riwayat</h3></div>
        <div class="timeline">${(o.riwayat || []).map(x => `<div class="tl-item"><span class="tl-dot"></span><div><div class="small bold">${esc(x.teks)}</div><div class="xs muted">${tgl(x.waktu, true)}</div></div></div>`).join('') || '<p class="small muted">Belum ada riwayat.</p>'}</div>
        ${st.wa ? `<a class="btn btn-soft btn-block mt16" target="_blank" rel="noopener" href="https:\/\/wa.me/${esc(st.wa)}?text=${encodeURIComponent('Halo, saya ingin bertanya tentang pesanan ' + o.id)}"><i class="bi bi-whatsapp"></i> Tanya admin</a>` : ''}</div>
    </div>`;
}
function pasangStatus(o) {
  const box = $('#stUpload');
  if (!box) return;
  let file = null;
  const btn = $('#stKirim');
  pasangDropzone($('.dz-root', box), f => { file = f; btn.disabled = !f; });
  btn.onclick = async () => {
    sibuk(btn, true, 'Mengunggah\u2026');
    const r = await api('apiUploadBukti', o.id, o.hp4, { b64: file.b64, mime: file.mime, name: file.nama });
    sibuk(btn, false);
    if (!r.success) { toast(r.message, 'error'); return; }
    toast(r.message);
    o.sb = SB.MENUNGGU; o.alasan = '';
    o.riwayat = [{ waktu: new Date().toISOString(), teks: 'Bukti bayar diunggah' }].concat(o.riwayat || []);
    S.cache.status[o.id] = o;
    $('#statusOut').innerHTML = htmlStatus(o);
  };
}

function renderLogin() {
  const v = $('#v-login');
  v.innerHTML = `<div style="max-width:440px;margin:24px auto">
    <form class="card" id="fLogin" novalidate>
      <div class="center"><div class="brand-mark" style="width:56px;height:56px;border-radius:16px;margin:0 auto 14px;font-size:24px"><i class="bi bi-shield-lock"></i></div>
        <h1 style="font-size:24px">Masuk admin</h1><p class="muted small mt8">Khusus pemilik dan karyawan ${esc(S.pub.settings.namaToko || 'Baju Custom')}.</p></div>
      <div class="note err mt16" id="lgErr" hidden><i class="bi bi-exclamation-circle"></i><span></span></div>
      <div class="field mt16"><label for="lgU">Username</label><div class="input-icon"><i class="bi bi-person"></i><input id="lgU" class="input" autocomplete="username" autocapitalize="none" spellcheck="false" required></div></div>
      <div class="field mt16"><label for="lgP">Kata sandi</label><div class="input-icon"><i class="bi bi-lock"></i><input id="lgP" class="input" type="password" autocomplete="current-password" required style="padding-right:52px">
        <button type="button" class="icon-btn sm trail" id="lgEye" aria-label="Tampilkan kata sandi" style="border:0;background:transparent"><i class="bi bi-eye"></i></button></div></div>
      <button class="btn btn-primary btn-block mt24" id="lgBtn" type="submit">Masuk <i class="bi bi-arrow-right"></i></button>
      <p class="xs muted center mt16">Lupa kata sandi? Hubungi pemilik usaha.</p>
    </form>
    <button class="btn btn-ghost btn-block mt16" data-go="katalog"><i class="bi bi-arrow-left"></i> Kembali ke katalog</button></div>`;
  $('#lgEye').onclick = () => { const p = $('#lgP'); p.type = p.type === 'password' ? 'text' : 'password'; $('#lgEye i').className = 'bi ' + (p.type === 'password' ? 'bi-eye' : 'bi-eye-slash'); };
  $('#fLogin').onsubmit = async e => {
    e.preventDefault();
    const u = $('#lgU').value.trim(), p = $('#lgP').value;
    const er = $('#lgErr');
    if (!u || !p) { er.hidden = false; $('span', er).textContent = 'Isi username dan kata sandi.'; return; }
    const btn = $('#lgBtn'); sibuk(btn, true, 'Memeriksa\u2026');
    const r = await api('apiLogin', u, p);
    sibuk(btn, false);
    if (!r.success) { er.hidden = false; $('span', er).textContent = r.message; $('#lgP').select(); return; }
    S.token = r.data.token; S.me = r.data.me;
    ls.set('bc_sesi', { token: S.token, me: S.me });
    toast(r.message);
    masukAdmin();
  };
  setTimeout(() => $('#lgU').focus(), 50);
}

const MENU = [
  { r: 'beranda', ic: 'bi-grid-1x2', t: 'Beranda' },
  { r: 'pesanan', ic: 'bi-receipt', t: 'Pesanan' },
  { r: 'verifikasi', ic: 'bi-patch-check', t: 'Verifikasi', badge: 'verif' },
  { r: 'input', ic: 'bi-plus-circle', t: 'Input Pesanan' },
  { r: 'marketplace', ic: 'bi-shop-window', t: 'Marketplace', su: true },
  { r: 'pelanggan', ic: 'bi-people', t: 'Pelanggan', su: true },
  { r: 'desain', ic: 'bi-palette', t: 'Kelola Desain', su: true },
  { r: 'pengaturan', ic: 'bi-sliders', t: 'Pengaturan' }
];
function bangunNavAdmin() {
  const items = MENU.filter(m => !m.su || isSuper());
  $('#railItems').innerHTML = items.map(m => `<button class="rail-btn" data-go="${m.r}" data-tip="${m.t}" aria-label="${m.t}"><i class="bi ${m.ic}"></i>${m.badge ? '<span class="count-badge" data-badge="' + m.badge + '" hidden></span>' : ''}</button>`).join('');
  $('#admBottom').innerHTML = `
    <button class="bn-item" data-go="beranda"><i class="bi bi-grid-1x2"></i><span>Beranda</span></button>
    <button class="bn-item" data-go="pesanan"><i class="bi bi-receipt"></i><span>Pesanan</span></button>
    <button class="bn-item" data-go="verifikasi"><i class="bi bi-patch-check"></i><span>Verifikasi</span><span class="count-badge" data-badge="verif" hidden></span></button>
    <button class="bn-item" data-action="notif"><i class="bi bi-bell"></i><span>Notifikasi</span><span class="count-badge" data-badge="notif" hidden></span></button>
    <button class="bn-item" data-action="lainnya"><i class="bi bi-three-dots"></i><span>Lainnya</span></button>`;
  $('#meAvatar').textContent = inisial(S.me.nama);
  ikonTema();
}
function masukAdmin() {
  bangunNavAdmin();
  S.stack = [];
  go('beranda');
  muatBoot();
  mulaiPolling();
}
async function muatBoot() {
  progres(true);
  const r = await api('apiAdminBoot', S.token);
  progres(false);
  if (!r.success) { if (r.code !== 'AUTH') { toast(r.message, 'error'); } return; }
  terapkanBoot(r.data);
  segarkan();
}
function terapkanBoot(b) {
  S.adm = b;
  S.me = b.me || S.me;
  S.pub.settings = Object.assign({}, S.pub.settings, { namaToko: b.settings.namaToko, tagline: b.settings.tagline, ukuran: b.settings.ukuran, rekening: b.settings.rekening, alamatAmbil: b.settings.alamatAmbil, jam: b.settings.jam, wa: b.settings.wa, logo: b.settings.logo });
  S.pub.designs = b.designs.filter(d => d.aktif);
  S.pub.loaded = true;
  terapkanIdentitas();
  perbaruiBadge();
}

async function sinkron() {
  if (!S.token || S.syncing) return;
  S.syncing = true; progres(true);
  const r = await api('apiPoll', S.token, S.adm ? S.adm.ver : '');
  S.syncing = false; progres(false);
  if (!r.success) return;
  if (r.data.changed) { terapkanBoot(r.data.boot); if (bolehRenderUlang()) segarkan(); }
  else if (S.adm) { S.adm.notifs = r.data.notifs; perbaruiBadge(); }
}
function bolehRenderUlang() {

  if (!$('#modal').hidden || !$('#drawer').hidden) return false;
  if (S.route === 'input') return false;
  const a = document.activeElement;
  if (a && /INPUT|TEXTAREA|SELECT/.test(a.tagName) && a.closest('.view.active')) return false;
  return true;
}
function mulaiPolling() {
  clearInterval(S.pollTimer);
  S.pollTimer = setInterval(() => { if (document.visibilityState === 'visible') sinkron(); }, 60000);
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && S.token && S.adm) sinkron(); });

function perbaruiBadge() {
  if (!S.adm) return;
  const verif = S.adm.orders.filter(o => o.sb === SB.MENUNGGU && o.sp !== SP.BATAL).length;
  const notif = (S.adm.notifs || []).filter(n => !n.baca).length;
  $$('[data-badge="verif"]').forEach(b => { b.hidden = !verif; b.textContent = verif > 99 ? '99+' : verif; });
  $$('[data-badge="notif"]').forEach(b => { b.hidden = !notif; b.textContent = notif > 99 ? '99+' : notif; });
  $('#bellBadge').hidden = !notif;
}
async function logout() {
  const ok = await konfirmasi({ judul: 'Keluar dari panel admin?', ok: 'Keluar' });
  if (!ok) return;
  api('apiLogout', S.token);
  bersihkanSesi();
  toast('Anda telah keluar.', 'info');
  go('katalog');
}
function bersihkanSesi() {
  clearInterval(S.pollTimer);
  S.token = null; S.me = null; S.adm = null; S.stack = []; S.forms.admin = null; S.cache.bukti = {}; S.cache.detail = {};
  ls.del('bc_sesi');
  tutupDrawer(); tutupModal();
}
function sesiBerakhir(msg) {
  bersihkanSesi();
  toast(msg || 'Sesi berakhir. Silakan masuk lagi.', 'warn');
  go('login');
}

function ubahLokal(id, perubahan) {
  const o = S.adm.orders.find(x => x.id === id);
  if (!o) return () => { };
  const lama = Object.assign({}, o);
  Object.assign(o, perubahan);
  perbaruiBadge();
  return () => { Object.assign(o, lama); perbaruiBadge(); };
}
function gantiLokal(baru) {
  const i = S.adm.orders.findIndex(x => x.id === baru.id);
  if (i > -1) S.adm.orders[i] = Object.assign({}, S.adm.orders[i], baru);
  perbaruiBadge();
}

function grafikBatang(data) {
  const maks = Math.max(1, ...data.map(d => d.v));
  return `<div class="bars" role="img" aria-label="Grafik batang ${data.map(d => d.l + ' ' + d.t).join(', ')}">${data.map(d => `<div class="bar-col ${d.now ? 'show' : ''}">
    <span class="bv num">${esc(d.t)}</span><div class="bar ${d.now ? 'now' : ''} ${d.v ? '' : 'zero'}" style="height:${Math.max(6, d.v / maks * 100)}%" title="${esc(d.l + ': ' + d.t)}"></div><span class="bl ${d.now ? 'bold' : ''}">${esc(d.l)}</span></div>`).join('')}</div>`;
}
function gauge(seg, tengah, label) {
  const r = 80, L = Math.PI * r, total = seg.reduce((a, s) => a + s.v, 0) || 1;
  let off = 0;
  const gap = seg.filter(s => s.v).length > 1 ? 6 : 0;
  const arcs = seg.filter(s => s.v).map(s => { const len = Math.max(0, s.v / total * L - gap); const el = `<path d="M20 100 A80 80 0 0 1 180 100" fill="none" stroke="${s.c}" stroke-width="18" stroke-linecap="round" stroke-dasharray="${len} ${L}" stroke-dashoffset="${-off}"/>`; off += s.v / total * L; return el; }).join('');
  return `<div class="gauge-wrap" role="img" aria-label="${esc(label)}"><svg viewBox="0 0 200 112" width="100%" style="max-width:260px"><path d="M20 100 A80 80 0 0 1 180 100" fill="none" stroke="var(--nested)" stroke-width="18" stroke-linecap="round"/>${arcs}</svg>
    <div class="gauge-center"><div class="v num">${esc(tengah)}</div><div class="xs muted">${esc(label)}</div></div></div>`;
}

function perluBoot(v) {
  if (S.adm) return false;
  v.innerHTML = `<div class="grid g4">${[1, 2, 3, 4].map(() => `<div class="card">${skel(14, '50%')}<div class="mt16">${skel(34, '70%')}</div><div class="mt16">${skel(12, '40%')}</div></div>`).join('')}</div>
    <div class="grid g2 mt24"><div class="card">${skel(220)}</div><div class="card">${skel(220)}</div></div>`;
  return true;
}

function renderBeranda() {
  const v = $('#v-beranda');
  if (perluBoot(v)) return;
  const A = S.adm, hari = isoHari(), besok = tambahHari(hari, 1);
  const aktif = A.orders.filter(o => o.sp !== SP.BATAL);
  const menunggu = aktif.filter(o => o.sb === SB.MENUNGGU);
  const ambilDekat = aktif.filter(o => o.ambil && o.sp !== SP.SELESAI && o.ambil >= hari && o.ambil <= tambahHari(hari, 7)).sort((a, b) => a.ambil < b.ambil ? -1 : 1);
  const ambilHariIni = ambilDekat.filter(o => o.ambil === hari || o.ambil === besok);
  const nama = (S.me.nama || '').split(' ')[0];
  const tglHariIni = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
  const kartuTindakan = `<div class="card dark stat">
      <div class="k" style="color:rgba(255,255,255,.7)">Perlu tindakan <span class="tag" style="background:var(--pink);color:#1c1c1e">${menunggu.length + ambilHariIni.length}</span></div>
      <div class="stack sm mt8 small">
        <div class="row"><i class="bi bi-receipt"></i><span class="grow">${menunggu.length} bukti bayar menunggu verifikasi</span></div>
        <div class="row"><i class="bi bi-alarm"></i><span class="grow">${ambilHariIni.length} pesanan diambil hari ini/besok</span></div>
      </div>
      <button class="btn btn-on-dark btn-sm mt12" data-go="verifikasi" style="align-self:flex-start">Tinjau verifikasi <i class="bi bi-arrow-right"></i></button></div>`;
  const kartuJadwal = `<div class="card"><div class="card-head"><div><h3>Jadwal ambil terdekat</h3><div class="sub">7 hari ke depan</div></div><span class="tag butter">${ambilDekat.length} pesanan</span></div>
    ${ambilDekat.length ? ambilDekat.slice(0, 6).map(o => `<div class="list-row click" data-go="detail" data-arg='${esc(JSON.stringify({ id: o.id }))}'><span class="avatar ${o.ambil === hari ? 'c2' : 'c1'}"><i class="bi bi-calendar-event"></i></span><div class="grow"><b class="small">${esc(o.nama)}</b><div class="xs muted code">${esc(o.id)} \u00b7 ${o.pcs} pcs</div></div><div class="right"><div class="small bold">${o.ambil === hari ? 'Hari ini' : o.ambil === besok ? 'Besok' : tgl(o.ambil)}</div>${pillPesanan(o.sp)}</div></div>`).join('') : emptyState('bi-calendar2-check', 'Tidak ada jadwal', 'Belum ada pesanan dijadwalkan diambil minggu ini.')}</div>`;
  const transaksi = (tampilRp) => `<div class="card"><div class="card-head"><div><h3>Transaksi terbaru</h3><div class="sub">Pesanan masuk paling baru</div></div><button class="btn btn-soft btn-sm" data-go="pesanan">Lihat semua <i class="bi bi-chevron-right"></i></button></div>
    ${A.orders.length ? A.orders.slice(0, 6).map(o => `<div class="list-row click" data-go="detail" data-arg='${esc(JSON.stringify({ id: o.id }))}'><span class="avatar ${warnaAv(o.nama)}">${esc(inisial(o.nama))}</span><div class="grow"><b class="small ellipsis" style="display:block">${esc(o.nama)}${o.kom ? ' \u00b7 ' + esc(o.kom) : ''}</b><div class="xs muted"><span class="code">${esc(o.id)}</span> \u00b7 ${relatif(o.tgl)}</div></div>
      <div class="right">${tampilRp ? `<div class="bold num small">${rp(o.total)}</div>` : `<div class="bold small">${o.pcs} pcs</div>`}${o.sb === SB.MENUNGGU ? pillBayar(o.sb) : pillPesanan(o.sp)}</div></div>`).join('') : emptyState('bi-receipt', 'Belum ada pesanan', 'Bagikan link katalog ke pelanggan.')}</div>`;

  if (!isSuper()) {
    v.innerHTML = `<div class="row between wrap mb16"><div><h2 class="greet">Halo, <em>${esc(nama)}</em></h2><p class="muted">${esc(tglHariIni)}</p></div>
      <button class="btn btn-primary" data-go="input"><i class="bi bi-plus-lg"></i> Input Pesanan</button></div>
      <div class="grid g4">
        <div class="card stat"><div class="k">Pesanan baru <span class="ic"><i class="bi bi-inbox"></i></span></div><div class="v">${aktif.filter(o => o.sp === SP.MASUK).length}</div><div class="s">Belum dikonfirmasi</div></div>
        <div class="card stat"><div class="k">Dalam produksi <span class="ic"><i class="bi bi-scissors"></i></span></div><div class="v">${aktif.filter(o => o.sp === SP.PRODUKSI).length}</div><div class="s">${angka(aktif.filter(o => o.sp === SP.PRODUKSI).reduce((a, o) => a + o.pcs, 0))} pcs</div></div>
        <div class="card stat"><div class="k">Siap diambil <span class="ic"><i class="bi bi-box-seam"></i></span></div><div class="v">${aktif.filter(o => o.sp === SP.SIAP).length}</div><div class="s">Menunggu pelanggan</div></div>
        ${kartuTindakan}
      </div>
      <div class="grid g2 mt24">${kartuJadwal}${transaksi(false)}</div>`;
    return;
  }
  const D = A.dash || { bulan: [], ini: {}, lalu: {}, topBulan: [], topAll: [], loyal: [] };
  const mpB = mpPerBulan();
  const gab = b => { const m = mpB[b.b] || { omzet: 0, n: 0, pcs: 0 }; return { omzet: b.omzet + m.omzet, pesanan: b.pesanan + m.n, pcs: b.pcs + m.pcs, web: b.omzet, mp: m.omzet }; };
  const bulanGab = (D.bulan || []).map(b => Object.assign({ b: b.b }, gab(b)));
  const ini = bulanGab[bulanGab.length - 1] || { omzet: 0, pesanan: 0, pcs: 0, web: 0, mp: 0 }, lalu = bulanGab[bulanGab.length - 2] || { omzet: 0, pesanan: 0 };
  const naik = lalu.omzet ? Math.round((ini.omzet - lalu.omzet) / lalu.omzet * 100) : null;
  const nBulan = window.innerWidth < 640 ? 6 : 12;
  const bulanData = bulanGab.slice(-nBulan).map((b, i, arr) => ({ l: BULAN[+b.b.slice(5, 7) - 1], v: b.omzet, t: rpSingkat(b.omzet), now: i === arr.length - 1 }));
  const kanalIni = rekapKanal(isoHari().slice(0, 7));
  const cnt = s => aktif.filter(o => o.sp === s).length;
  const selesai = cnt(SP.SELESAI), proses = cnt(SP.KONFIRM) + cnt(SP.PRODUKSI) + cnt(SP.SIAP), tunggu = cnt(SP.MASUK);
  const tot = selesai + proses + tunggu;
  const top = S.ui.topMode === 'bulan' ? D.topBulan : D.topAll;
  const maxTop = Math.max(1, ...top.map(t => t.pcs));
  v.innerHTML = `<div class="row between wrap mb16"><div><h2 class="greet">Halo, <em>${esc(nama)}</em></h2><p class="muted">Pantau pesanan dan penjualan di sini \u00b7 ${esc(tglHariIni)}</p></div>
      <button class="btn btn-primary" data-go="input"><i class="bi bi-plus-lg"></i> Input Pesanan</button></div>
    <div class="grid g4">
      <div class="card stat"><div class="k">Omzet bulan ini <span class="ic"><i class="bi bi-wallet2"></i></span></div><div class="v">${rp(ini.omzet)}</div>
        <div class="s">${naik === null ? 'Web + marketplace' : `<span class="trend ${naik < 0 ? 'down' : ''}"><i class="bi bi-arrow-${naik < 0 ? 'down' : 'up'}-right"></i>${Math.abs(naik)}%</span> vs bulan lalu`}</div></div>
      <div class="card stat"><div class="k">Pesanan bulan ini <span class="ic"><i class="bi bi-receipt"></i></span></div><div class="v">${angka(ini.pesanan)}</div><div class="s">Web ${angka(D.ini.pesanan || 0)} \u00b7 Marketplace ${angka(ini.pesanan - (D.ini.pesanan || 0))}</div></div>
      <div class="card stat"><div class="k">Total pcs bulan ini <span class="ic"><i class="bi bi-layers"></i></span></div><div class="v">${angka(ini.pcs)}</div><div class="s">Semua kanal penjualan</div></div>
      ${kartuTindakan}
    </div>
    <div class="grid mt24" style="grid-template-columns:minmax(0,1.5fr) minmax(0,1fr)" id="rowGrafik">
      <div class="card"><div class="card-head"><div><h3>Omzet per bulan</h3><div class="sub">Web (pembayaran terverifikasi) + marketplace</div></div><span class="tag peri">${nBulan} bulan</span></div>${grafikBatang(bulanData)}</div>
      <div class="card"><div class="card-head"><div><h3>Progres pesanan</h3><div class="sub">${HARI_INFO} terakhir + semua yang aktif</div></div></div>
        ${gauge([{ v: selesai, c: 'var(--peri)' }, { v: proses, c: 'var(--butter)' }, { v: tunggu, c: 'var(--pink)' }], tot ? Math.round(selesai / tot * 100) + '%' : '0%', 'selesai')}
        <div class="legend mt16"><div class="li"><span class="sw" style="background:var(--peri)"></span>Selesai<b>${selesai}</b></div><div class="li"><span class="sw" style="background:var(--butter)"></span>Diproses<b>${proses}</b></div><div class="li"><span class="sw" style="background:var(--pink)"></span>Menunggu konfirmasi<b>${tunggu}</b></div></div></div>
    </div>
    <div class="grid g2 mt24">
      <div class="card"><div class="card-head"><div><h3>Pelanggan loyal</h3><div class="sub">Minimal ${A.settings.ambangLoyal} pesanan \u00b7 ${D.jumlahLoyal || 0} pelanggan</div></div><button class="icon-btn sm" data-go="pelanggan" aria-label="Lihat semua pelanggan"><i class="bi bi-chevron-right"></i></button></div>
        ${D.loyal.length ? `<div class="avatar-row">${D.loyal.map(c => `<button class="av-item" style="border:0;background:transparent" data-pel="${esc(c.id)}"><span class="avatar ${warnaAv(c.nama)}">${esc(inisial(c.nama))}<span class="n">${c.n}x</span></span><div class="nm ellipsis">${esc(c.nama.split(' ')[0])}</div><div class="xs muted">${rpSingkat(c.total)}</div></button>`).join('')}</div>` : emptyState('bi-people', 'Belum ada pelanggan loyal', 'Pelanggan dengan ' + A.settings.ambangLoyal + '+ pesanan akan muncul di sini.')}</div>
      <div class="card"><div class="card-head"><div><h3>Desain terlaris</h3><div class="sub">Berdasarkan jumlah pcs</div></div>
        <div class="chips"><button class="chip ${S.ui.topMode === 'bulan' ? 'on' : ''}" data-top="bulan">Bulan ini</button><button class="chip ${S.ui.topMode === 'all' ? 'on' : ''}" data-top="all">Semua</button></div></div>
        ${top.length ? top.map((t, i) => `<div class="mb16"><div class="row between small"><span class="row"><span class="tag ${i ? '' : 'dark'}">#${i + 1}</span><b>${esc(t.nama)}</b></span><b class="num">${angka(t.pcs)} pcs</b></div><div class="hbar mt8"><span style="width:${t.pcs / maxTop * 100}%;${i ? '' : 'background:var(--primary-bg)'}"></span></div></div>`).join('') : emptyState('bi-bar-chart', 'Belum ada data', 'Data muncul setelah ada pesanan.')}</div>
    </div>
    <div class="card mt24"><div class="card-head"><div><h3>Penjualan per kanal</h3><div class="sub">Bulan ini \u00b7 web dan marketplace</div></div><button class="btn btn-soft btn-sm" data-go="marketplace">Marketplace <i class="bi bi-chevron-right"></i></button></div>${htmlKanal(kanalIni)}</div>
    <div class="grid g2 mt24">${transaksi(true)}${kartuJadwal}</div>`;
  if (window.innerWidth < 1100) $('#rowGrafik').style.gridTemplateColumns = '1fr';
  $$('[data-top]', v).forEach(b => b.onclick = () => { S.ui.topMode = b.dataset.top; renderBeranda(); });
  $$('[data-pel]', v).forEach(b => b.onclick = () => bukaPelanggan(b.dataset.pel));
}
const HARI_INFO = '180 hari';

const TAB_PESANAN = [
  { k: 'semua', t: 'Semua', f: () => true },
  { k: 'verif', t: 'Perlu verifikasi', f: o => o.sb === SB.MENUNGGU && o.sp !== SP.BATAL, warn: true },
  { k: 'belum', t: 'Belum bayar', f: o => o.sb === SB.BELUM && o.sp !== SP.BATAL },
  { k: 'konfirm', t: 'Dikonfirmasi', f: o => o.sp === SP.KONFIRM },
  { k: 'produksi', t: 'Diproduksi', f: o => o.sp === SP.PRODUKSI },
  { k: 'siap', t: 'Siap diambil', f: o => o.sp === SP.SIAP },
  { k: 'selesai', t: 'Selesai', f: o => o.sp === SP.SELESAI },
  { k: 'batal', t: 'Dibatalkan', f: o => o.sp === SP.BATAL }
];
function filterPesanan() {
  const f = S.ui.pf, q = f.q.trim().toLowerCase();
  const tab = TAB_PESANAN.find(t => t.k === f.tab) || TAB_PESANAN[0];
  return S.adm.orders.filter(o => {
    if (!tab.f(o)) return false;
    if (q && !(o.id + ' ' + o.nama + ' ' + o.hp + ' ' + (o.kom || '')).toLowerCase().includes(q)) return false;
    const d = String(o.tgl).slice(0, 10);
    if (f.dari && d < f.dari) return false;
    if (f.sampai && d > f.sampai) return false;
    if (f.desain) { const det = S.adm.details[o.id] || S.cache.detail[o.id]; if (!det || !det.some(x => x.d === f.desain)) return false; }
    return true;
  });
}
function renderPesanan() {
  const v = $('#v-pesanan');
  if (perluBoot(v)) return;
  const f = S.ui.pf;
  const v0 = v.querySelector('#pfQ');
  if (!v0) {
    v.innerHTML = `<div class="row between wrap mb16"><p class="muted">Kelola pesanan, verifikasi bukti bayar, dan jadwal ambil.</p><button class="btn btn-primary" data-go="input"><i class="bi bi-plus-lg"></i> Input Pesanan</button></div>
      <div class="chips mb16" id="pfTabs"></div>
      <div class="card tight mb16"><div class="row wrap" style="gap:10px">
        <label class="search-pill grow" style="min-width:220px"><i class="bi bi-search"></i><input id="pfQ" type="search" placeholder="Cari kode, nama, No HP, komunitas\u2026" aria-label="Cari pesanan"></label>
        <select id="pfDesain" class="select" style="width:auto;min-width:170px" aria-label="Filter desain"></select>
        <input id="pfDari" type="date" class="input" style="width:auto" aria-label="Dari tanggal"><input id="pfSampai" type="date" class="input" style="width:auto" aria-label="Sampai tanggal">
        <button class="btn btn-ghost btn-sm" id="pfReset"><i class="bi bi-arrow-counterclockwise"></i> Reset</button></div>
        <div class="xs muted mt8" id="pfInfo"></div></div>
      <div id="pfOut"></div>`;
    const ulang = debounce(() => { f.page = 1; isiPesanan(); }, 150);
    $('#pfQ').addEventListener('input', e => { f.q = e.target.value; $('#globalSearch').value = f.q; ulang(); });
    $('#pfDesain').onchange = e => { f.desain = e.target.value; f.page = 1; isiPesanan(); };
    $('#pfDari').onchange = e => { f.dari = e.target.value; f.page = 1; isiPesanan(); };
    $('#pfSampai').onchange = e => { f.sampai = e.target.value; f.page = 1; isiPesanan(); };
    $('#pfReset').onclick = () => { Object.assign(f, { tab: 'semua', q: '', desain: '', dari: '', sampai: '', page: 1 }); $('#globalSearch').value = ''; isiPesanan(true); };
  }
  isiPesanan(true);
}
function isiPesanan(semua) {
  const f = S.ui.pf, v = $('#v-pesanan');
  if (semua) {
    $('#pfQ').value = f.q; $('#pfDari').value = f.dari; $('#pfSampai').value = f.sampai;
    $('#pfDesain').innerHTML = `<option value="">Semua desain</option>` + S.adm.designs.map(d => `<option value="${esc(d.id)}" ${f.desain === d.id ? 'selected' : ''}>${esc(d.nama)}</option>`).join('');
  }
  $('#pfTabs').innerHTML = TAB_PESANAN.map(t => { const n = S.adm.orders.filter(t.f).length; return `<button class="chip ${f.tab === t.k ? 'on' : ''} ${t.warn && n ? 'warn' : ''}" data-tab="${t.k}">${t.t} <span class="cnt">${n}</span></button>`; }).join('');
  $$('[data-tab]', v).forEach(b => b.onclick = () => { f.tab = b.dataset.tab; f.page = 1; isiPesanan(); });
  const list = filterPesanan();
  const per = 15, hal = Math.max(1, Math.ceil(list.length / per));
  f.page = Math.min(f.page, hal);
  const potong = list.slice((f.page - 1) * per, f.page * per);
  $('#pfInfo').textContent = `Menampilkan pesanan ${HARI_INFO} terakhir dan semua yang masih aktif.` + (f.desain ? ' Filter desain berlaku untuk pesanan aktif.' : '');
  const aksi = o => o.sb === SB.MENUNGGU && o.sp !== SP.BATAL ? `<button class="btn btn-secondary btn-sm" data-verif="${esc(o.id)}"><i class="bi bi-patch-check"></i> Verifikasi</button>` : `<button class="btn btn-soft btn-sm">Lihat</button>`;
  const item = o => { const det = S.adm.details[o.id]; const ring = det ? ringkasDesain(det) : ''; return { o, ring }; };
  $('#pfOut').innerHTML = !list.length ? `<div class="card">${emptyState('bi-inbox', 'Tidak ada pesanan', 'Ubah filter atau kata kunci pencarian.')}</div>` : `
    <div class="card tight table-desk"><div class="table-wrap"><table class="table"><thead><tr><th>Kode & tanggal</th><th>Pemesan</th><th>Item</th><th class="right">Total</th><th>Bayar</th><th>Pesanan</th><th>Siap ambil</th><th></th></tr></thead><tbody>
      ${potong.map(item).map(({ o, ring }) => `<tr class="click" data-open="${esc(o.id)}"><td><b class="code">${esc(o.id)}</b><div class="t-sub">${tgl(o.tgl, true)}</div></td>
        <td><b>${esc(o.nama)}</b><div class="t-sub">${esc(o.kom || o.hp)}</div></td>
        <td><span class="tag">${o.pcs} pcs</span>${ring ? `<div class="t-sub ellipsis" style="max-width:200px">${esc(ring)}</div>` : ''}</td>
        <td class="right num bold">${rp(o.total)}</td><td>${pillBayar(o.sb)}</td><td>${pillPesanan(o.sp)}</td>
        <td class="nowrap ${o.ambil && o.ambil <= isoHari() && o.sp !== SP.SELESAI && o.sp !== SP.BATAL ? 'bold' : ''}">${o.ambil ? tgl(o.ambil) : '<span class="muted">\u2014</span>'}</td><td class="right">${aksi(o)}</td></tr>`).join('')}
    </tbody></table></div></div>
    <div class="olist">${potong.map(item).map(({ o, ring }) => `<div class="ocard" data-open="${esc(o.id)}"><div class="row between"><span class="code">${esc(o.id)}</span>${o.sb === SB.MENUNGGU && o.sp !== SP.BATAL ? pillBayar(o.sb) : pillPesanan(o.sp)}</div>
      <div class="mt8"><b>${esc(o.nama)}</b>${o.kom ? ` <span class="muted small">\u00b7 ${esc(o.kom)}</span>` : ''}</div>
      <div class="nested mt12 row between"><div><div class="xs muted">${o.pcs} pcs${ring ? ' \u00b7 ' + esc(ring) : ''}</div><b class="num" style="font-size:18px">${rp(o.total)}</b></div>${o.ambil ? `<span class="tag butter"><i class="bi bi-calendar-event"></i>${tgl(o.ambil)}</span>` : ''}</div>
      <div class="row mt12">${o.sb === SB.MENUNGGU && o.sp !== SP.BATAL ? `<button class="btn btn-primary btn-sm grow" data-verif="${esc(o.id)}"><i class="bi bi-patch-check"></i> Verifikasi bukti</button>` : `<button class="btn btn-soft btn-sm grow">Lihat detail</button>`}</div></div>`).join('')}</div>
    <div class="pager"><span class="small muted">Menampilkan ${(f.page - 1) * per + 1}\u2013${Math.min(f.page * per, list.length)} dari ${list.length} pesanan</span>
      ${hal > 1 ? `<div class="pages"><button class="pg" data-pg="${f.page - 1}" ${f.page === 1 ? 'disabled' : ''} aria-label="Sebelumnya"><i class="bi bi-chevron-left"></i></button>${halaman(f.page, hal).map(p => p === '\u2026' ? '<span class="pg" style="border:0;background:none">\u2026</span>' : `<button class="pg ${p === f.page ? 'on' : ''}" data-pg="${p}">${p}</button>`).join('')}<button class="pg" data-pg="${f.page + 1}" ${f.page === hal ? 'disabled' : ''} aria-label="Berikutnya"><i class="bi bi-chevron-right"></i></button></div>` : ''}</div>`;
  $$('[data-open]', v).forEach(r => r.onclick = e => { const vb = e.target.closest('[data-verif]'); if (vb) { S.ui.verifSel = vb.dataset.verif; go('verifikasi'); return; } go('detail', { id: r.dataset.open }); });
  $$('[data-pg]', v).forEach(b => b.onclick = () => { f.page = +b.dataset.pg; isiPesanan(); window.scrollTo({ top: 0 }); });
}
function halaman(p, n) { const s = new Set([1, n, p - 1, p, p + 1].filter(x => x >= 1 && x <= n)); const a = [...s].sort((x, y) => x - y), out = []; a.forEach((x, i) => { if (i && x - a[i - 1] > 1) out.push('\u2026'); out.push(x); }); return out; }
function ringkasDesain(det) { const m = {}; det.forEach(x => { m[x.n] = (m[x.n] || 0) + x.q; }); return Object.keys(m).map(k => k.split('\u2013')[0].trim() + ' (' + m[k] + ')').join(' \u00b7 '); }

$('#globalSearch').addEventListener('input', debounce(e => {
  S.ui.pf.q = e.target.value; S.ui.pf.page = 1;
  if (S.route !== 'pesanan') go('pesanan'); else { $('#pfQ').value = S.ui.pf.q; isiPesanan(); }
}, 180));

async function ambilDetailServer(id, paksa) {
  if (!paksa && S.cache.detail[id]) return S.cache.detail[id];
  const r = await api('apiGetDetail', S.token, id);
  if (!r.success) { toast(r.message, 'error'); return null; }
  S.cache.detail[id] = r.data;
  return r.data;
}
function renderDetail(p) {
  const v = $('#v-detail');
  if (perluBoot(v)) return;
  const o = S.adm.orders.find(x => x.id === (p && p.id));
  if (!o) { v.innerHTML = `<div class="card">${emptyState('bi-search', 'Pesanan tidak ditemukan', 'Mungkin sudah lebih dari ' + HARI_INFO + ' atau kode salah.', '<button class="btn btn-soft mt16" data-go="pesanan">Kembali ke daftar</button>')}</div>`; return; }
  const ext = S.cache.detail[o.id];
  const det = S.adm.details[o.id] || (ext && ext.detail);
  const bisaUbah = o.sp !== SP.BATAL && o.sp !== SP.SELESAI && (isSuper() || o.sp === SP.MASUK);
  $('#admTitle').textContent = o.id;
  v.innerHTML = `
    <div class="row between wrap mb16">
      <button class="btn btn-ghost btn-sm" data-action="back" style="margin-left:-12px"><i class="bi bi-arrow-left"></i> Kembali</button>
      <div class="row wrap">
        <button class="btn btn-primary btn-sm" data-pdf='${esc(JSON.stringify({ kode: o.id }))}'><i class="bi bi-file-earmark-pdf"></i> Bukti pesanan (PDF)</button>
        <button class="btn btn-outline btn-sm" id="dtCetak" ${det ? '' : 'disabled'}><i class="bi bi-printer"></i> Cetak lembar produksi</button>
        ${bisaUbah ? `<button class="btn btn-outline btn-sm" id="dtUbah" ${det ? '' : 'disabled'}><i class="bi bi-pencil"></i> Ubah pesanan</button>` : (o.sp !== SP.BATAL && o.sp !== SP.SELESAI ? `<span class="tag" title="Hanya Super Admin yang bisa mengubah pesanan yang sudah dikonfirmasi"><i class="bi bi-lock"></i> Terkunci</span>` : '')}
        ${isSuper() && o.sp !== SP.BATAL && o.sp !== SP.SELESAI ? `<button class="btn btn-danger-outline btn-sm" id="dtBatal"><i class="bi bi-x-circle"></i> Batalkan</button>` : ''}
      </div></div>
    <div class="split">
      <div class="stack lg">
        <div class="card"><div class="row between wrap top"><div><div class="xs muted bold" style="letter-spacing:.06em">KODE PESANAN</div><div class="row"><span class="code" style="font-size:24px">${esc(o.id)}</span><button class="icon-btn sm" data-copy="${esc(o.id)}" data-copy-lbl="Kode" aria-label="Salin kode"><i class="bi bi-copy"></i></button></div>
          <div class="small muted">${tgl(o.tgl, true)} \u00b7 dibuat oleh ${esc(o.oleh || '\u2014')}</div></div><div class="row wrap">${pillBayar(o.sb)}${pillPesanan(o.sp)}</div></div>
          <div class="mt24">${htmlTrack(o)}</div>
          ${o.alasan && o.sb === SB.BELUM ? `<div class="note err mt16"><i class="bi bi-exclamation-circle"></i>Bukti ditolak: ${esc(o.alasan)}</div>` : ''}
          ${o.alasan && o.sp === SP.BATAL ? `<div class="note err mt16"><i class="bi bi-x-octagon"></i>Dibatalkan: ${esc(o.alasan)}</div>` : ''}</div>
        <div class="card"><div class="card-head"><h3>Data pemesan</h3>${S.pub.settings.wa || o.hp ? `<a class="btn btn-soft btn-sm" target="_blank" rel="noopener" href="https:\/\/wa.me/${esc(o.hp.replace(/^0/, '62'))}?text=${encodeURIComponent('Halo ' + o.nama + ', terkait pesanan ' + o.id)}"><i class="bi bi-whatsapp"></i> Chat</a>` : ''}</div>
          <dl class="kv"><dt>Nama</dt><dd>${esc(o.nama)}</dd><dt>No HP</dt><dd class="num">${esc(o.hp)}</dd><dt>Komunitas</dt><dd>${esc(o.kom || '\u2014')}</dd><dt>Alamat</dt><dd>${esc(o.alamat || '\u2014')}</dd>${o.catatan ? `<dt>Catatan</dt><dd>${esc(o.catatan)}</dd>` : ''}</dl></div>
        <div class="card"><div class="card-head"><div><h3>Rekap produksi</h3><div class="sub">Desain \u00d7 lengan \u00d7 ukuran</div></div><span class="tag">${o.pcs} pcs</span></div>
          <div id="dtRekap">${det ? htmlRekap(det) : skel(160)}</div>
          <div class="nested row between mt16"><span class="bold">Total tagihan</span><b class="num" style="font-family:var(--f-head);font-size:24px">${rp(o.total)}</b></div></div>
      </div>
      <div class="stack lg">
        <div class="card" id="dtStatus">${htmlKartuStatus(o)}</div>
        <div class="card"><div class="card-head"><h3>Bukti pembayaran</h3>${pillBayar(o.sb)}</div>${htmlKartuBukti(o)}</div>
        <div class="card"><div class="card-head"><h3>Log aktivitas</h3></div><div id="dtLog">${ext ? htmlLog(ext.riwayat) : skel(120)}</div></div>
      </div>
    </div>`;
  pasangDetail(o);

  ambilDetailServer(o.id, !ext).then(d => {
    if (!d || S.route !== 'detail' || S.params.detail.id !== o.id) return;
    $('#dtLog').innerHTML = htmlLog(d.riwayat);
    if (!S.adm.details[o.id]) { $('#dtRekap').innerHTML = htmlRekap(d.detail); ['#dtCetak', '#dtUbah'].forEach(s => { const b = $(s); if (b) b.disabled = false; }); }
  });
}
function htmlRekap(det) {
  if (!det.length) return `<p class="muted small">Tidak ada item.</p>`;
  const g = {}, urutUk = (S.adm.settings.ukuran || []);
  det.forEach(x => { g[x.d] = g[x.d] || { nama: x.n, uk: {}, p: 0, l: 0, rp: 0 }; const r = g[x.d].uk[x.u] = g[x.d].uk[x.u] || { p: 0, l: 0 }; r[x.l === 'Panjang' ? 'l' : 'p'] += x.q; g[x.d][x.l === 'Panjang' ? 'l' : 'p'] += x.q; g[x.d].rp += x.q * x.h; });
  return Object.keys(g).map((k, i) => { const x = g[k]; const uks = Object.keys(x.uk).sort((a, b) => (urutUk.indexOf(a) + 99) % 99 - (urutUk.indexOf(b) + 99) % 99); return `<div class="nested mb12">
    <div class="row between wrap mb8"><b><span class="dlabel" style="margin-right:6px">${HURUF[i]}</span>${esc(x.nama)}</b><b class="num">${rp(x.rp)}</b></div>
    <table class="matrix"><thead><tr><th>Ukuran</th><th>Pendek</th><th>Panjang</th><th>Total</th></tr></thead><tbody>
    ${uks.map(u => `<tr><td><span class="size-tag">${esc(u)}</span></td><td class="cell-c num ${x.uk[u].p ? 'bold' : 'zero'}">${x.uk[u].p}</td><td class="cell-c num ${x.uk[u].l ? 'bold' : 'zero'}">${x.uk[u].l}</td><td class="num bold">${x.uk[u].p + x.uk[u].l} pcs</td></tr>`).join('')}</tbody>
    <tfoot><tr><td>Subtotal</td><td class="cell-c num">${x.p}</td><td class="cell-c num">${x.l}</td><td class="right num">${x.p + x.l} pcs</td></tr></tfoot></table></div>`; }).join('');
}
function htmlLog(r) { return (r || []).length ? `<div class="timeline">${r.map(x => `<div class="tl-item"><span class="tl-dot"></span><div><div class="small bold">${esc(x.teks)}</div><div class="xs muted">${tgl(x.waktu, true)}${x.oleh ? ' \u00b7 ' + esc(x.oleh) : ''}</div></div></div>`).join('')}</div>` : '<p class="small muted">Belum ada aktivitas.</p>'; }
function htmlKartuStatus(o) {
  const head = `<div class="card-head"><h3>Status pesanan</h3>${pillPesanan(o.sp)}</div>`;
  if (o.sp === SP.BATAL) return head + `<p class="small muted">Pesanan dibatalkan. Tidak ada tindakan lagi.</p>`;
  if (o.sp === SP.SELESAI) return head + `<div class="note ok"><i class="bi bi-bag-check"></i>Pesanan sudah diambil pelanggan.</div>`;
  if (o.sb !== SB.LUNAS) return head + `<div class="note ${o.sb === SB.MENUNGGU ? 'info' : 'warn'}"><i class="bi bi-info-circle"></i>${o.sb === SB.MENUNGGU ? 'Verifikasi bukti bayar dulu untuk mengonfirmasi pesanan.' : 'Menunggu pelanggan mengunggah bukti bayar.'}</div>`;
  const i = ALUR.indexOf(o.sp), next = ALUR[i + 1];
  const butuhTgl = next === SP.PRODUKSI;
  const defTgl = o.ambil || tambahHari(isoHari(), 7);
  return head + `
    <div class="field"><label for="dtTgl">Tanggal siap ambil ${butuhTgl ? '<span class="req">*</span>' : ''}</label>
      <div class="row"><input id="dtTgl" type="date" class="input" value="${esc(butuhTgl ? defTgl : o.ambil)}" min="${isoHari()}" style="flex:1">${o.sp !== SP.KONFIRM ? `<button class="btn btn-soft btn-sm" id="dtSimpanTgl">Simpan</button>` : ''}</div>
      <div class="help">${butuhTgl ? 'Wajib diisi saat pesanan masuk produksi.' : 'Pelanggan melihat tanggal ini di halaman Cek Status.'}</div></div>
    ${next ? `<button class="btn btn-primary btn-block mt16" id="dtMaju"><i class="bi bi-arrow-right-circle"></i> Ubah ke "${next}"</button>` : ''}`;
}
function htmlKartuBukti(o) {
  if (!o.bukti) return o.sp === SP.BATAL ? `<p class="small muted">Tidak ada bukti bayar.</p>` : `<p class="small muted mb16">Belum ada bukti bayar. Anda bisa mengunggah atas nama pelanggan.</p>${htmlDropzone('Unggah bukti transfer', 'JPG, PNG, atau PDF \u00b7 maks 5 MB')}<button class="btn btn-primary btn-block mt12" id="dtKirimBukti" disabled>Kirim bukti</button>`;
  return `<button class="file-row" style="width:100%;text-align:left;cursor:pointer" id="dtLihatBukti"><span class="fi"><i class="bi bi-file-earmark-image"></i></span><span class="grow"><b class="small">Lihat bukti transfer</b><span class="xs muted" style="display:block">${o.konfOleh ? 'Diverifikasi ' + esc(o.konfOleh) + (o.tglKonf ? ' \u00b7 ' + tgl(o.tglKonf, true) : '') : 'Dibuka di jendela pratinjau'}</span></span><i class="bi bi-arrows-fullscreen muted"></i></button>
    ${o.sb === SB.MENUNGGU && o.sp !== SP.BATAL ? `<div class="row mt12"><button class="btn btn-danger-outline grow" data-tolak="${esc(o.id)}"><i class="bi bi-x-lg"></i> Tolak</button><button class="btn btn-primary grow" data-terima="${esc(o.id)}"><i class="bi bi-check2"></i> Terima</button></div>` : ''}`;
}
function pasangDetail(o) {
  const v = $('#v-detail');
  const maju = $('#dtMaju');
  if (maju) maju.onclick = () => {
    const i = ALUR.indexOf(o.sp), next = ALUR[i + 1];
    const t = $('#dtTgl') ? $('#dtTgl').value : '';
    if (next === SP.PRODUKSI && !t) { toast('Isi tanggal siap ambil dulu.', 'warn'); $('#dtTgl').focus(); return; }
    const kirimTgl = next === SP.PRODUKSI || (t && t !== o.ambil) ? t : '';
    ubahStatusOptimis(o.id, next, kirimTgl);
  };
  const st = $('#dtSimpanTgl');
  if (st) st.onclick = async () => {
    const t = $('#dtTgl').value; if (!t) return;
    const batal = ubahLokal(o.id, { ambil: t }); toast('Tanggal siap ambil disimpan');
    const r = await api('apiUbahTglAmbil', S.token, o.id, t);
    if (!r.success) { batal(); toast(r.message, 'error'); if (S.route === 'detail') segarkan(); } else { gantiLokal(r.data); S.cache.detail[o.id] = null; sinkron(); }
  };
  const lb = $('#dtLihatBukti'); if (lb) lb.onclick = () => lihatBukti(o.id);
  $$('[data-terima]', v).forEach(b => b.onclick = () => verifikasi(o.id, true));
  $$('[data-tolak]', v).forEach(b => b.onclick = () => verifikasi(o.id, false));
  const kb = $('#dtKirimBukti');
  if (kb) { let file = null; pasangDropzone($('.dz-root', v), f => { file = f; kb.disabled = !f; });
    kb.onclick = async () => { sibuk(kb, true, 'Mengunggah\u2026'); const r = await api('apiUploadBukti', o.id, o.hp.slice(-4), { b64: file.b64, mime: file.mime, name: file.nama }); sibuk(kb, false);
      if (!r.success) { toast(r.message, 'error'); return; } ubahLokal(o.id, { sb: SB.MENUNGGU, bukti: true, alasan: '' }); delete S.cache.bukti[o.id]; S.cache.detail[o.id] = null; toast('Bukti terkirim \u2014 silakan verifikasi.'); segarkan(); sinkron(); }; }
  const ub = $('#dtUbah'); if (ub) ub.onclick = () => go('input', { edit: o.id });
  const cb = $('#dtCetak'); if (cb) cb.onclick = () => cetakProduksi(o);
  const bt = $('#dtBatal'); if (bt) bt.onclick = async () => {
    const alasan = await konfirmasi({ judul: 'Batalkan pesanan ' + o.id + '?', teks: 'Pesanan dibatalkan dan tidak dihitung dalam omzet. Tindakan ini tercatat di log.', ok: 'Batalkan pesanan', bahaya: true, input: { label: 'Alasan pembatalan', wajib: true, ph: 'Contoh: pelanggan membatalkan lewat WhatsApp' } });
    if (!alasan) return;
    const batal = ubahLokal(o.id, { sp: SP.BATAL, alasan }); segarkan(); toast('Pesanan dibatalkan');
    const r = await api('apiBatalkan', S.token, o.id, alasan);
    if (!r.success) { batal(); toast(r.message, 'error'); if (S.route === 'detail') segarkan(); } else { gantiLokal(r.data); S.cache.detail[o.id] = null; sinkron(); }
  };
}
async function ubahStatusOptimis(id, next, tglAmbil) {
  const perub = { sp: next }; if (tglAmbil) perub.ambil = tglAmbil;
  const batal = ubahLokal(id, perub);
  if (S.route === 'detail') segarkan();
  toast('Status ' + id + ' \u2192 ' + next);
  const r = await api('apiUbahStatus', S.token, id, next, tglAmbil || '');
  if (!r.success) { batal(); toast(r.message, 'error'); if (S.route === 'detail') segarkan(); return; }
  gantiLokal(r.data); S.cache.detail[id] = null;
  if (next === SP.SELESAI || next === SP.BATAL) {  }
  sinkron();
}

function cetakProduksi(o) {
  const ext = S.cache.detail[o.id];
  const det = S.adm.details[o.id] || (ext && ext.detail) || [];
  const g = {}; const urut = S.adm.settings.ukuran || [];
  det.forEach(x => { g[x.d] = g[x.d] || { nama: x.n, uk: {} }; const r = g[x.d].uk[x.u] = g[x.d].uk[x.u] || { p: 0, l: 0 }; r[x.l === 'Panjang' ? 'l' : 'p'] += x.q; });
  $('#printArea').innerHTML = `<div class="pa-head"><div><h1>LEMBAR KERJA PRODUKSI</h1><div>${esc(S.adm.settings.namaToko)}</div></div><div style="text-align:right"><b style="font-size:18px">${esc(o.id)}</b><div>Dicetak ${tgl(new Date().toISOString(), true)}</div></div></div>
    <p><b>Pemesan:</b> ${esc(o.nama)}${o.kom ? ' (' + esc(o.kom) + ')' : ''} \u00b7 ${esc(o.hp)}<br><b>Status:</b> ${esc(o.sp)} \u00b7 <b>Siap ambil:</b> ${o.ambil ? tgl(o.ambil) : '-'} \u00b7 <b>Total:</b> ${o.pcs} pcs</p>
    ${o.catatan ? `<p><b>Catatan:</b> ${esc(o.catatan)}</p>` : ''}
    ${Object.keys(g).map((k, i) => { const x = g[k]; const uks = urut.filter(u => x.uk[u]).concat(Object.keys(x.uk).filter(u => urut.indexOf(u) < 0)); let tp = 0, tl = 0; return `<h3>Desain ${HURUF[i]} \u2014 ${esc(x.nama)}</h3><table><thead><tr><th>Ukuran</th><th>Lengan pendek</th><th>Lengan panjang</th><th>Jumlah</th><th>Cek</th></tr></thead><tbody>${uks.map(u => { tp += x.uk[u].p; tl += x.uk[u].l; return `<tr><td>${esc(u)}</td><td>${x.uk[u].p || ''}</td><td>${x.uk[u].l || ''}</td><td><b>${x.uk[u].p + x.uk[u].l}</b></td><td></td></tr>`; }).join('')}<tr><td><b>Total</b></td><td><b>${tp}</b></td><td><b>${tl}</b></td><td><b>${tp + tl}</b></td><td></td></tr></tbody></table>`; }).join('')}`;
  setTimeout(() => window.print(), 50);
}

function b64keUrl(b64, mime) {
  const bin = atob(b64), arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return URL.createObjectURL(new Blob([arr], { type: mime }));
}
S.cache.pdf = {};
async function bukaPdfPesanan(btn, kode, hp4) {
  const admin = !hp4;
  sibuk(btn, true, 'Membuat PDF\u2026');
  const r = admin ? await api('apiPdfPesanan', S.token, kode) : await api('apiPdfPesananPublik', kode, hp4);
  sibuk(btn, false);
  if (!r.success) { toast(r.message, 'error'); return; }
  const d = r.data, url = b64keUrl(d.b64, 'application/pdf');
  if (S.cache.pdf[kode]) URL.revokeObjectURL(S.cache.pdf[kode]);
  S.cache.pdf[kode] = url;
  let wa = '';
  if (admin && d.hp) {
    const no = String(d.hp).replace(/\D/g, '').replace(/^0/, '62');
    const teks = 'Halo ' + d.namaPel + ', berikut bukti pesanan ' + d.id + ' (total ' + rp(d.total) + ', ' + d.sb + ').' +
      (d.url ? '\n\nUnduh PDF: ' + d.url : '') + '\n\nCek status pesanan dengan kode ' + d.id + ' dan 4 digit akhir No HP Anda. Terima kasih!';
    wa = `<a class="btn btn-primary" target="_blank" rel="noopener" href="https:\/\/wa.me/${esc(no)}?text=${encodeURIComponent(teks)}"><i class="bi bi-whatsapp"></i> Kirim via WhatsApp</a>`;
  }
  bukaModal(`<div class="row between mb16"><h3>Bukti pesanan siap</h3><button class="icon-btn sm" data-action="close-modal" aria-label="Tutup"><i class="bi bi-x-lg"></i></button></div>
    <div class="file-row"><div class="fi"><i class="bi bi-file-earmark-pdf"></i></div><div class="grow"><div class="bold small ellipsis">${esc(d.nama)}</div><div class="xs muted">PDF \u00b7 ${ukuranFile(Math.round(d.b64.length * 0.75))}</div></div></div>
    ${admin ? `<p class="small muted mt12">${d.url ? 'Tombol WhatsApp mengirim pesan berisi link PDF. Bisa juga unduh lalu lampirkan PDF di chat.' : 'Unduh PDF, lalu lampirkan di chat WhatsApp pelanggan.'}</p>` : '<p class="small muted mt12">Simpan PDF ini dan tunjukkan saat mengambil pesanan.</p>'}
    <div class="modal-actions"><a class="btn btn-soft" href="${url}" download="${esc(d.nama)}"><i class="bi bi-download"></i> Unduh PDF</a>
      ${d.url ? `<a class="btn btn-ghost" href="${esc(d.url)}" target="_blank" rel="noopener"><i class="bi bi-box-arrow-up-right"></i> Buka</a>` : ''}${wa}</div>`);
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-pdf]');
  if (!b || b.disabled) return;
  const x = JSON.parse(b.dataset.pdf);
  bukaPdfPesanan(b, x.kode, x.hp4 || '');
});

async function muatBukti(id) {
  if (S.cache.bukti[id]) return S.cache.bukti[id];
  const r = await api('apiGetBukti', S.token, id);
  if (!r.success) return { error: r.message };
  const url = b64keUrl(r.data.b64, r.data.mime);
  S.cache.bukti[id] = { url, mime: r.data.mime, nama: r.data.nama, ukuran: r.data.ukuran };
  return S.cache.bukti[id];
}
function htmlBukti(b) {
  if (!b) return `<div class="center muted"><div class="skel" style="width:220px;height:280px;margin:0 auto"></div><p class="small mt12">Memuat bukti\u2026</p></div>`;
  if (b.error) return `<div class="note err"><i class="bi bi-exclamation-circle"></i>${esc(b.error)}</div>`;
  if (/pdf/.test(b.mime)) return `<object data="${b.url}" type="application/pdf" style="width:100%;height:70vh"><div class="center"><p class="small muted">Pratinjau PDF tidak tersedia di peramban ini.</p><a class="btn btn-soft mt12" href="${b.url}" download="${esc(b.nama)}"><i class="bi bi-download"></i> Unduh PDF</a></div></object>`;
  return `<img src="${b.url}" alt="Bukti transfer" onclick="this.classList.toggle('zoom')">`;
}
async function lihatBukti(id) {
  bukaModal(`<div class="row between mb16"><h3>Bukti transfer ${esc(id)}</h3><button class="icon-btn sm" data-action="close-modal" aria-label="Tutup"><i class="bi bi-x-lg"></i></button></div><div class="proof" id="mdProof">${htmlBukti(null)}</div><div class="modal-actions" id="mdAct"></div>`, { wide: true });
  const b = await muatBukti(id);
  if (!$('#mdProof')) return;
  $('#mdProof').innerHTML = htmlBukti(b);
  if (b.url) $('#mdAct').innerHTML = `<a class="btn btn-soft" href="${b.url}" download="${esc(b.nama)}"><i class="bi bi-download"></i> Unduh</a><button class="btn btn-primary" data-action="close-modal">Tutup</button>`;
}
function antreanVerif() { return S.adm.orders.filter(o => o.sb === SB.MENUNGGU && o.sp !== SP.BATAL).sort((a, b) => String(a.upd || a.tgl) < String(b.upd || b.tgl) ? -1 : 1); }
function renderVerifikasi() {
  const v = $('#v-verifikasi');
  if (perluBoot(v)) return;
  const q = antreanVerif();
  if (!q.length) { v.innerHTML = `<div class="card">${emptyState('bi-patch-check', 'Semua bukti bayar sudah diverifikasi', 'Antrean kosong. Bukti baru akan muncul otomatis di sini.', '<button class="btn btn-soft mt16" data-go="pesanan">Lihat daftar pesanan</button>')}</div>`; return; }
  if (!q.find(o => o.id === S.ui.verifSel)) S.ui.verifSel = q[0].id;
  const o = q.find(x => x.id === S.ui.verifSel);
  const det = S.adm.details[o.id] || [];
  const totalTunda = q.reduce((a, x) => a + x.total, 0);
  const rek = (S.adm.settings.rekening || []).filter(r => r.norek);
  v.innerHTML = `<p class="muted mb16">Cocokkan nominal, rekening tujuan, dan berita transfer dengan tagihan sebelum menerima.</p>
    <div class="grid verif-grid" style="grid-template-columns:minmax(220px,280px) minmax(0,1.3fr) minmax(260px,1fr);align-items:start">
      <div class="card tight"><div class="row between mb12"><b>Antrean</b><span class="tag" style="background:var(--pink-tint);color:var(--pink-ink)">${q.length} menunggu</span></div>
        <div style="max-height:60vh;overflow:auto">${q.map(x => `<button class="queue-item ${x.id === o.id ? 'on' : ''}" data-sel="${esc(x.id)}"><div class="row between"><b class="code small">${esc(x.id)}</b><span class="xs muted">${relatif(x.upd || x.tgl)}</span></div><div class="row between mt8"><span class="small ellipsis grow">${esc(x.nama)}</span><b class="small num nowrap">${rp(x.total)}</b></div></button>`).join('')}</div>
        <div class="nested row between mt8"><span class="xs muted">Total tertunda</span><b class="small num">${rp(totalTunda)}</b></div></div>
      <div class="card tight"><div class="row between mb12"><b>Pratinjau bukti</b><span class="xs muted">Klik gambar untuk memperbesar</span></div><div class="proof" id="vfProof">${htmlBukti(S.cache.bukti[o.id])}</div></div>
      <div class="card"><div class="xs muted bold" style="letter-spacing:.06em">TAGIHAN</div><div class="code" style="font-size:20px">${esc(o.id)}</div>
        <div style="font-family:var(--f-head);font-size:30px;font-weight:700" class="num mt8">${rp(o.total)}</div>
        <dl class="kv mt16"><dt>Pemesan</dt><dd>${esc(o.nama)}</dd><dt>No HP</dt><dd class="num">${esc(o.hp)}</dd>${o.kom ? `<dt>Komunitas</dt><dd>${esc(o.kom)}</dd>` : ''}<dt>Item</dt><dd>${o.pcs} pcs</dd><dt>Dipesan</dt><dd>${tgl(o.tgl, true)}</dd></dl>
        ${det.length ? `<div class="nested mt16 small">${ringkasDesain(det).split(' \u00b7 ').map(x => `<div>${esc(x)}</div>`).join('')}</div>` : ''}
        ${rek.length ? `<div class="xs muted mt16">Rekening tujuan: ${rek.map(r => esc(r.bank + ' ' + r.norek)).join(', ')}</div>` : ''}
        <button class="btn btn-primary btn-block mt24" id="vfTerima"><i class="bi bi-check2-circle"></i> Terima pembayaran</button>
        <button class="btn btn-danger-outline btn-block mt8" id="vfTolak"><i class="bi bi-x-lg"></i> Tolak bukti bayar</button>
        <button class="btn btn-ghost btn-block mt8" data-go="detail" data-arg='${esc(JSON.stringify({ id: o.id }))}'>Buka detail pesanan</button></div>
    </div>`;
  $$('[data-sel]', v).forEach(b => b.onclick = () => { S.ui.verifSel = b.dataset.sel; renderVerifikasi(); });
  $('#vfTerima').onclick = () => verifikasi(o.id, true);
  $('#vfTolak').onclick = () => verifikasi(o.id, false);
  if (!S.cache.bukti[o.id]) muatBukti(o.id).then(b => { if (S.route === 'verifikasi' && S.ui.verifSel === o.id && $('#vfProof')) $('#vfProof').innerHTML = htmlBukti(b); });

  const nx = q[q.indexOf(o) + 1]; if (nx && !S.cache.bukti[nx.id]) setTimeout(() => muatBukti(nx.id), 400);
}
async function verifikasi(id, terima) {
  let alasan = '';
  if (!terima) {
    alasan = await konfirmasi({ judul: 'Tolak bukti bayar ' + id + '?', teks: 'Status bayar kembali ke "Belum Bayar" dan pelanggan melihat alasan ini di halaman Cek Status.', ok: 'Tolak bukti', bahaya: true, input: { label: 'Alasan penolakan', wajib: true, ph: 'Contoh: nominal transfer kurang Rp 50.000' } });
    if (!alasan) return;
  }
  const q = antreanVerif(), idx = q.findIndex(x => x.id === id);
  const o = S.adm.orders.find(x => x.id === id);
  const batal = ubahLokal(id, terima ? { sb: SB.LUNAS, sp: o.sp === SP.MASUK ? SP.KONFIRM : o.sp, konfOleh: S.me.username } : { sb: SB.BELUM, alasan });
  if (S.route === 'verifikasi') { const sisa = antreanVerif(); S.ui.verifSel = sisa.length ? (sisa[Math.min(idx, sisa.length - 1)] || sisa[0]).id : null; }
  segarkan();
  toast(terima ? 'Pembayaran ' + id + ' diterima' : 'Bukti ' + id + ' ditolak', terima ? 'success' : 'info');
  const r = await api('apiVerifikasi', S.token, id, terima, alasan);
  if (!r.success) { batal(); toast(r.message, 'error'); segarkan(); return; }
  gantiLokal(r.data); S.cache.detail[id] = null;
  if (!terima) { const b = S.cache.bukti[id]; if (b && b.url) URL.revokeObjectURL(b.url); delete S.cache.bukti[id]; }
  sinkron();
}

function renderInput(p) {
  const v = $('#v-input');
  if (perluBoot(v)) return;
  if (p && p.edit) {
    const o = S.adm.orders.find(x => x.id === p.edit);
    const ext = S.cache.detail[p.edit];
    const det = S.adm.details[p.edit] || (ext && ext.detail);
    if (!o || !det) { v.innerHTML = `<div class="card">${emptyState('bi-search', 'Pesanan tidak bisa diubah', 'Data rincian belum tersedia.')}</div>`; return; }
    $('#admTitle').textContent = 'Ubah Pesanan';
    const f = new FormPesanan(v, 'edit', { order: o, detail: det });
    f.render();
    return;
  }
  $('#admTitle').textContent = 'Input Pesanan';
  if (!S.forms.admin) S.forms.admin = new FormPesanan(v, 'admin');
  S.forms.admin.render();
}

function renderPelanggan() {
  const v = $('#v-pelanggan');
  if (perluBoot(v)) return;
  const amb = S.adm.settings.ambangLoyal, q = S.ui.pelQ.toLowerCase();
  const terakhir = {}; S.adm.orders.forEach(o => { if (!terakhir[o.hp] || o.tgl > terakhir[o.hp]) terakhir[o.hp] = o.tgl; });
  let list = S.adm.customers.filter(c => (S.ui.pelTab !== 'loyal' || c.n >= amb) && (!q || (c.nama + ' ' + c.hp + ' ' + (c.kom || '')).toLowerCase().includes(q)));
  const key = S.ui.pelSort;
  list.sort((a, b) => key === 'nama' ? a.nama.localeCompare(b.nama) : key === 'total' ? b.total - a.total : b.n - a.n || b.total - a.total);
  const nLoyal = S.adm.customers.filter(c => c.n >= amb).length;
  if (!$('#pelQ', v)) {
    v.innerHTML = `<div class="row between wrap mb16"><div class="chips" id="pelTabs"></div>
      <div class="row wrap"><label class="search-pill" style="min-width:240px"><i class="bi bi-search"></i><input id="pelQ" type="search" placeholder="Cari nama atau No HP\u2026" aria-label="Cari pelanggan"></label>
      <select id="pelSort" class="select" style="width:auto" aria-label="Urutkan"><option value="n">Jumlah pesanan</option><option value="total">Total belanja</option><option value="nama">Nama A\u2013Z</option></select></div></div><div id="pelOut"></div>`;
    $('#pelQ').addEventListener('input', debounce(e => { S.ui.pelQ = e.target.value; renderPelanggan(); }, 150));
    $('#pelSort').onchange = e => { S.ui.pelSort = e.target.value; renderPelanggan(); };
  }
  $('#pelSort').value = S.ui.pelSort;
  $('#pelTabs').innerHTML = `<button class="chip ${S.ui.pelTab === 'semua' ? 'on' : ''}" data-pt="semua">Semua <span class="cnt">${S.adm.customers.length}</span></button><button class="chip ${S.ui.pelTab === 'loyal' ? 'on' : ''}" data-pt="loyal"><i class="bi bi-star"></i> Loyal <span class="cnt">${nLoyal}</span></button>`;
  $$('[data-pt]', v).forEach(b => b.onclick = () => { S.ui.pelTab = b.dataset.pt; renderPelanggan(); });
  $('#pelOut').innerHTML = !list.length ? `<div class="card">${emptyState('bi-people', 'Belum ada pelanggan', 'Pelanggan tercatat otomatis dari setiap pesanan.')}</div>` : `
    <div class="card tight table-desk"><div class="table-wrap"><table class="table"><thead><tr><th>Pelanggan</th><th>No HP</th><th>Komunitas</th><th class="right">Pesanan</th><th class="right">Total belanja</th><th>Pesanan terakhir</th><th></th></tr></thead><tbody>
    ${list.slice(0, 300).map(c => `<tr class="click" data-c="${esc(c.id)}"><td><div class="row"><span class="avatar ${warnaAv(c.nama)}" style="width:36px;height:36px;font-size:12px">${esc(inisial(c.nama))}</span><b>${esc(c.nama)}</b></div></td><td class="num">${esc(c.hp)}</td><td>${esc(c.kom || '\u2014')}</td><td class="right num bold">${c.n}</td><td class="right num">${rp(c.total)}</td><td>${terakhir[c.hp] ? tgl(terakhir[c.hp]) : '<span class="muted">\u2014</span>'}</td><td>${c.n >= amb ? '<span class="tag peri"><i class="bi bi-star-fill"></i> Loyal</span>' : ''}</td></tr>`).join('')}</tbody></table></div></div>
    <div class="olist">${list.slice(0, 200).map(c => `<div class="ocard row" data-c="${esc(c.id)}"><span class="avatar ${warnaAv(c.nama)}">${esc(inisial(c.nama))}</span><div class="grow"><b>${esc(c.nama)}</b> ${c.n >= amb ? '<i class="bi bi-star-fill" style="color:var(--peri)"></i>' : ''}<div class="xs muted">${esc(c.hp)}${c.kom ? ' \u00b7 ' + esc(c.kom) : ''}</div></div><div class="right"><b class="small">${c.n}x</b><div class="xs muted num">${rpSingkat(c.total)}</div></div></div>`).join('')}</div>
    ${list.length > 300 ? `<p class="xs muted mt12">Menampilkan 300 teratas. Gunakan pencarian untuk mempersempit.</p>` : ''}`;
  $$('[data-c]', v).forEach(r => r.onclick = () => bukaPelanggan(r.dataset.c));
}
function bukaPelanggan(id) {
  const c = (S.adm.customers || []).find(x => x.id === id);
  if (!c) return;
  const os = S.adm.orders.filter(o => o.hp === c.hp);
  bukaDrawer(`<div class="drawer-head"><span class="avatar lg ${warnaAv(c.nama)}">${esc(inisial(c.nama))}</span><div class="grow"><h3 id="drawerTitle">${esc(c.nama)}</h3><div class="small muted">${esc(c.kom || 'Perorangan')}</div></div><button class="icon-btn sm" data-action="close-drawer" aria-label="Tutup"><i class="bi bi-x-lg"></i></button></div>
    <div class="drawer-body">
      <div class="grid g2" style="gap:12px"><div class="nested"><div class="xs muted">Jumlah pesanan</div><b style="font-size:22px">${c.n}</b></div><div class="nested"><div class="xs muted">Total belanja</div><b style="font-size:18px" class="num">${rp(c.total)}</b></div></div>
      <dl class="kv mt16"><dt>No HP</dt><dd class="num">${esc(c.hp)}</dd><dt>Alamat</dt><dd>${esc(c.alamat || '\u2014')}</dd><dt>Pelanggan sejak</dt><dd>${tgl(c.sejak)}</dd></dl>
      <a class="btn btn-soft btn-block mt16" target="_blank" rel="noopener" href="https:\/\/wa.me/${esc(c.hp.replace(/^0/, '62'))}"><i class="bi bi-whatsapp"></i> Chat WhatsApp</a>
      <h4 class="mt24 mb8" style="font-size:15px">Pesanan (${HARI_INFO} terakhir)</h4>
      ${os.length ? os.map(o => `<div class="list-row click" data-go="detail" data-arg='${esc(JSON.stringify({ id: o.id }))}'><div class="grow"><b class="code small">${esc(o.id)}</b><div class="xs muted">${tgl(o.tgl)} \u00b7 ${o.pcs} pcs</div></div><div class="right"><div class="small bold num">${rp(o.total)}</div>${pillPesanan(o.sp)}</div></div>`).join('') : '<p class="small muted">Tidak ada pesanan dalam periode ini.</p>'}
    </div>`);
}

function renderDesain() {
  const v = $('#v-desain');
  if (perluBoot(v)) return;
  const ds = S.adm.designs, q = S.ui.desQ.toLowerCase();
  const pcsBulan = {}; ((S.adm.dash && S.adm.dash.topAll) || []).forEach(t => { pcsBulan[t.id] = t.pcs; });
  const list = ds.filter(d => (S.ui.desTab === 'semua' || (S.ui.desTab === 'aktif') === d.aktif) && (!q || d.nama.toLowerCase().includes(q)));
  if (!$('#desQ', v)) {
    v.innerHTML = `<div class="grid g4 mb16" id="desStat"></div>
      <div class="row between wrap mb16"><div class="chips" id="desTabs"></div><div class="row wrap"><label class="search-pill" style="min-width:220px"><i class="bi bi-search"></i><input id="desQ" type="search" placeholder="Cari desain\u2026" aria-label="Cari desain"></label>
      <button class="btn btn-primary" id="desBaru"><i class="bi bi-plus-lg"></i> Tambah desain</button></div></div>
      <div class="note info mb16"><i class="bi bi-lock"></i>Desain yang sudah pernah dipesan tidak bisa dihapus, hanya dinonaktifkan agar riwayat pesanan tetap utuh.</div><div id="desOut"></div>`;
    $('#desQ').addEventListener('input', debounce(e => { S.ui.desQ = e.target.value; renderDesain(); }, 150));
    $('#desBaru').onclick = () => formDesain(null);
  }
  $('#desStat').innerHTML = `<div class="card stat"><div class="k">Total desain</div><div class="v">${ds.length}</div></div><div class="card stat"><div class="k">Aktif</div><div class="v">${ds.filter(d => d.aktif).length}</div><div class="s">Tampil di katalog publik</div></div><div class="card stat"><div class="k">Nonaktif</div><div class="v">${ds.filter(d => !d.aktif).length}</div><div class="s">Disembunyikan</div></div><div class="card stat"><div class="k">Terlaris</div><div class="v" style="font-size:18px">${esc(((S.adm.dash && S.adm.dash.topAll[0]) || {}).nama || '\u2014')}</div><div class="s">${angka(((S.adm.dash && S.adm.dash.topAll[0]) || {}).pcs || 0)} pcs</div></div>`;
  $('#desTabs').innerHTML = ['semua', 'aktif', 'nonaktif'].map(k => `<button class="chip ${S.ui.desTab === k ? 'on' : ''}" data-dt="${k}">${k[0].toUpperCase() + k.slice(1)} <span class="cnt">${k === 'semua' ? ds.length : ds.filter(d => (k === 'aktif') === d.aktif).length}</span></button>`).join('');
  $$('[data-dt]', v).forEach(b => b.onclick = () => { S.ui.desTab = b.dataset.dt; renderDesain(); });
  $('#desOut').innerHTML = list.length ? `<div class="pgrid">${list.map(d => `<article class="pcard dcard ${d.aktif ? '' : 'off'}">
      <div class="pimg dcard-img">${fotoDesain(d)}<span class="tag ${d.aktif ? 'dark' : ''}" style="position:absolute;top:10px;left:10px">${d.aktif ? 'Aktif' : 'Nonaktif'}</span></div>
      <div><h3 style="font-size:17px">${esc(d.nama)}</h3><p class="small muted mt8">${esc(d.deskripsi || '')}</p></div>
      <div class="price2"><div><small>Pendek</small><b>${rp(d.hargaPendek)}</b></div><div><small>Panjang</small><b>${rp(d.hargaPanjang)}</b></div></div>
      <div class="sizes">${(d.ukuran.length ? d.ukuran : S.adm.settings.ukuran).map(u => `<span>${esc(u)}</span>`).join('')}</div>
      <div class="row between"><span class="xs muted">${pcsBulan[d.id] ? angka(pcsBulan[d.id]) + ' pcs terjual' : 'Belum ada penjualan'}${d.kuota ? ' \u00b7 kuota ' + d.kuota : ''}</span></div>
      <div class="row between"><label class="row small" style="gap:10px"><span class="switch"><input type="checkbox" data-tg="${esc(d.id)}" ${d.aktif ? 'checked' : ''} aria-label="Aktifkan ${esc(d.nama)}"><span></span></span>${d.aktif ? 'Aktif' : 'Nonaktif'}</label>
        <button class="btn btn-soft btn-sm" data-ed="${esc(d.id)}"><i class="bi bi-pencil"></i> Edit</button></div></article>`).join('')}</div>`
    : `<div class="card">${emptyState('bi-palette', 'Belum ada desain', 'Tambahkan desain pertama untuk ditampilkan di katalog.', '<button class="btn btn-primary mt16" onclick="formDesain(null)"><i class="bi bi-plus-lg"></i> Tambah desain</button>')}</div>`;
  $$('[data-ed]', v).forEach(b => b.onclick = () => formDesain(b.dataset.ed));
  $$('[data-tg]', v).forEach(c => c.onchange = async () => {
    const d = S.adm.designs.find(x => x.id === c.dataset.tg), lama = d.aktif;
    d.aktif = c.checked; renderDesain(); toast(d.aktif ? 'Desain diaktifkan' : 'Desain dinonaktifkan');
    const r = await api('apiToggleDesain', S.token, d.id, d.aktif);
    if (!r.success) { d.aktif = lama; toast(r.message, 'error'); renderDesain(); } else { S.pub.designs = S.adm.designs.filter(x => x.aktif); sinkron(); }
  });
}
function formDesain(id) {
  const d = id ? S.adm.designs.find(x => x.id === id) : { nama: '', deskripsi: '', hargaPendek: '', hargaPanjang: '', ukuran: S.adm.settings.ukuran.slice(), kuota: 0, aktif: true };
  let foto = null;
  const ukAll = S.adm.settings.ukuran;
  const ukSel = new Set(d.ukuran.length ? d.ukuran : ukAll);
  bukaDrawer(`<div class="drawer-head"><div class="grow"><div class="xs muted bold">${id ? 'EDIT DESAIN' : 'DESAIN BARU'}</div><h3 id="drawerTitle">${id ? esc(d.nama) : 'Tambah desain'}</h3></div><button class="icon-btn sm" data-action="close-drawer" aria-label="Tutup"><i class="bi bi-x-lg"></i></button></div>
    <form class="drawer-body stack" id="fDes" novalidate>
      <div class="field"><span class="lbl">Foto desain</span>${d.foto ? `<div class="pimg mb8" style="aspect-ratio:16/9" id="fdPrev"><img src="${esc(d.foto)}" alt="" referrerpolicy="no-referrer"></div>` : ''}${htmlDropzone(d.foto ? 'Ganti foto' : 'Pilih foto desain', 'JPG, PNG, WEBP \u00b7 dikompres otomatis', true)}</div>
      <div class="field" data-field="nama"><label for="fdNama">Nama desain <span class="req">*</span></label><input id="fdNama" class="input" maxlength="100" value="${esc(d.nama)}" placeholder="Contoh: Desain A \u2013 Kaos Komunitas"><div class="err-msg"><i class="bi bi-exclamation-circle"></i><span>Nama wajib diisi.</span></div></div>
      <div class="field"><label for="fdDesk">Deskripsi singkat</label><textarea id="fdDesk" class="textarea" rows="2" maxlength="400" placeholder="Bahan, teknik sablon, posisi desain">${esc(d.deskripsi || '')}</textarea></div>
      <div class="grid g2" style="gap:12px"><div class="field" data-field="hp"><label for="fdHp">Harga lengan pendek <span class="req">*</span></label><input id="fdHp" class="input num" inputmode="numeric" value="${esc(d.hargaPendek)}" placeholder="85000"><div class="err-msg"><span>Wajib diisi.</span></div></div>
        <div class="field" data-field="hl"><label for="fdHl">Harga lengan panjang <span class="req">*</span></label><input id="fdHl" class="input num" inputmode="numeric" value="${esc(d.hargaPanjang)}" placeholder="95000"><div class="err-msg"><span>Wajib diisi.</span></div></div></div>
      <div class="field"><span class="lbl">Ukuran tersedia</span><div class="chips" style="flex-wrap:wrap" id="fdUk">${ukAll.map(u => `<button type="button" class="chip ${ukSel.has(u) ? 'on' : ''}" data-u="${esc(u)}" aria-pressed="${ukSel.has(u)}">${esc(u)}</button>`).join('')}</div></div>
      <div class="field"><label for="fdKuota">Kuota maksimal <span class="opt">(opsional, 0 = tanpa batas)</span></label><input id="fdKuota" class="input num" inputmode="numeric" value="${esc(d.kuota || 0)}"></div>
      <label class="row nested" style="cursor:pointer"><span class="switch"><input type="checkbox" id="fdAktif" ${d.aktif ? 'checked' : ''}><span></span></span><div><b class="small">Tampilkan di katalog publik</b><div class="xs muted">Nonaktifkan untuk menyembunyikan tanpa menghapus.</div></div></label>
      ${id ? `<button type="button" class="btn btn-ghost btn-sm" id="fdHapus" style="align-self:flex-start;color:var(--danger)"><i class="bi bi-trash3"></i> Hapus desain</button>` : ''}
    </form>
    <div class="drawer-foot"><button class="btn btn-soft" data-action="close-drawer">Batal</button><button class="btn btn-primary grow" id="fdSimpan"><i class="bi bi-check2"></i> Simpan</button></div>`);
  const dr = $('#drawer');
  pasangDropzone($('.dz-root', dr), f => { foto = f; const p = $('#fdPrev'); if (p && f) p.innerHTML = `<img src="${f.preview}" alt="">`; }, { hanyaGambar: true, maks: 1200, q: 0.8 });
  $$('#fdUk .chip', dr).forEach(c => c.onclick = () => { const u = c.dataset.u; ukSel.has(u) ? ukSel.delete(u) : ukSel.add(u); c.classList.toggle('on'); c.setAttribute('aria-pressed', ukSel.has(u)); });
  const hapus = $('#fdHapus');
  if (hapus) hapus.onclick = async () => {
    if (!await konfirmasi({ judul: 'Hapus desain ini?', teks: 'Hanya bisa jika desain belum pernah dipesan.', ok: 'Hapus', bahaya: true })) return;
    sibuk(hapus, true);
    const r = await api('apiHapusDesain', S.token, id);
    sibuk(hapus, false);
    if (!r.success) { toast(r.message, 'error'); return; }
    S.adm.designs = S.adm.designs.filter(x => x.id !== id); tutupDrawer(); toast(r.message); renderDesain(); sinkron();
  };
  $('#fdSimpan').onclick = async () => {
    const data = { id: id || '', nama: $('#fdNama').value.trim(), deskripsi: $('#fdDesk').value.trim(), hargaPendek: +$('#fdHp').value.replace(/\D/g, ''), hargaPanjang: +$('#fdHl').value.replace(/\D/g, ''), ukuran: ukAll.filter(u => ukSel.has(u)), kuota: +$('#fdKuota').value.replace(/\D/g, '') || 0, aktif: $('#fdAktif').checked };
    let ok = true;
    [['nama', data.nama.length >= 2], ['hp', data.hargaPendek > 0], ['hl', data.hargaPanjang > 0]].forEach(([k, v]) => { const f = $(`[data-field="${k}"]`, dr); f.classList.toggle('err', !v); if (!v) ok = false; });
    if (!data.ukuran.length) { toast('Pilih minimal satu ukuran.', 'warn'); ok = false; }
    if (!ok) return;
    const btn = $('#fdSimpan'); sibuk(btn, true, foto ? 'Mengunggah foto\u2026' : 'Menyimpan\u2026');
    const r = await api('apiSimpanDesain', S.token, data, foto ? { b64: foto.b64, mime: foto.mime, name: foto.nama } : null);
    sibuk(btn, false);
    if (!r.success) { toast(r.message, 'error'); return; }
    const i = S.adm.designs.findIndex(x => x.id === r.data.id);
    if (i > -1) S.adm.designs[i] = r.data; else S.adm.designs.push(r.data);
    S.pub.designs = S.adm.designs.filter(x => x.aktif);
    tutupDrawer(); toast(r.message); renderDesain(); sinkron();
  };
}

function renderPengaturan() {
  const v = $('#v-pengaturan');
  if (perluBoot(v)) return;
  const tabs = isSuper() ? [['toko', 'bi-shop', 'Toko & pembayaran'], ['ukuran', 'bi-rulers', 'Ukuran'], ['pengingat', 'bi-bell', 'Pengingat & loyal'], ['akun', 'bi-people', 'Akun admin'], ['sandi', 'bi-key', 'Kata sandi saya']] : [['sandi', 'bi-key', 'Kata sandi saya']];
  if (!tabs.find(t => t[0] === S.ui.setTab)) S.ui.setTab = tabs[0][0];
  const st = S.adm.settings;
  const tab = S.ui.setTab;
  let isi = '';
  if (tab === 'toko') isi = `<div class="card-head"><div><h3>Toko & pembayaran</h3><div class="sub">Tampil di katalog, halaman sukses, dan cek status.</div></div></div>
    <div class="nested row wrap mb16" style="gap:16px;align-items:center">
      <div class="logo-prev" id="lgPrev">${htmlLogo(st)}</div>
      <div class="grow" style="min-width:220px"><b>Logo toko</b><div class="xs muted mt8">Tampil di menu kiri dan di atas katalog. Gambar dipotong persegi otomatis (thumbnail 256 \u00d7 256 px). Paling bagus logo persegi berlatar polos.</div>
        <div class="dz-root mt12"><label class="btn btn-soft btn-sm"><input type="file" accept="image/png,image/jpeg,image/webp" hidden id="lgFile"><i class="bi bi-upload"></i> Pilih gambar</label>
        <button class="btn btn-primary btn-sm" id="lgSimpan" disabled><i class="bi bi-check2"></i> Simpan logo</button>
        ${st.logo ? '<button class="btn btn-ghost btn-sm" id="lgHapus"><i class="bi bi-trash3"></i> Pakai ikon baju</button>' : ''}</div></div></div>
    <div class="grid g2" style="gap:16px">
      <div class="field"><label for="stNama">Nama toko</label><input id="stNama" class="input" maxlength="60" value="${esc(st.namaToko)}"></div>
      <div class="field"><label for="stWa">No WhatsApp</label><input id="stWa" class="input num" inputmode="tel" value="${esc(st.wa || '')}" placeholder="6281234567890"><div class="help">Format internasional tanpa +, contoh 6281234567890</div></div></div>
    <div class="field mt16"><label for="stTag">Tagline</label><input id="stTag" class="input" maxlength="120" value="${esc(st.tagline || '')}"></div>
    <div class="field mt16"><label for="stAlamat">Alamat pengambilan</label><textarea id="stAlamat" class="textarea" rows="2" maxlength="300">${esc(st.alamatAmbil || '')}</textarea></div>
    <div class="field mt16"><label for="stJam">Jam operasional</label><input id="stJam" class="input" maxlength="80" value="${esc(st.jam || '')}"></div>
    <div class="field mt16"><label for="stKanal">Daftar marketplace</label><input id="stKanal" class="input" maxlength="300" value="${esc((st.kanal || []).join(', '))}"><div class="help">Pisahkan dengan koma. Dipakai di menu Marketplace.</div></div>
    <div class="divider"></div><div class="row between mb12"><b>Rekening pembayaran</b><button class="btn btn-soft btn-sm" id="rekTambah"><i class="bi bi-plus-lg"></i> Tambah</button></div>
    <div id="rekList" class="stack sm"></div>`;
  if (tab === 'ukuran') isi = `<div class="card-head"><div><h3>Daftar ukuran</h3><div class="sub">Urutkan dari terkecil ke terbesar. Dipakai di form pesanan & rekap produksi.</div></div></div>
    <div id="ukList" class="stack sm"></div>
    <div class="row mt16"><input id="ukBaru" class="input" maxlength="8" placeholder="Contoh: 4XL" style="max-width:200px" aria-label="Ukuran baru"><button class="btn btn-soft" id="ukTambah"><i class="bi bi-plus-lg"></i> Tambah ukuran</button></div>`;
  if (tab === 'pengingat') isi = `<div class="card-head"><div><h3>Pengingat & pelanggan loyal</h3></div></div>
    <div class="grid g2" style="gap:16px">
      <div class="field"><label for="stH">Pengingat H- (hari)</label><input id="stH" class="input num" type="number" min="0" max="14" value="${st.hariPengingat}"><div class="help">Notifikasi "siapkan pesanan" dibuat setiap pagi pada H-${st.hariPengingat} dan hari H.</div></div>
      <div class="field"><label for="stL">Ambang pelanggan loyal</label><input id="stL" class="input num" type="number" min="1" value="${st.ambangLoyal}"><div class="help">Jumlah pesanan minimal agar ditandai loyal.</div></div></div>`;
  if (tab === 'akun') isi = `<div class="card-head"><div><h3>Akun admin</h3><div class="sub">Admin bisa input pesanan, verifikasi bayar, dan mengubah status.</div></div><button class="btn btn-primary btn-sm" id="akBaru"><i class="bi bi-person-plus"></i> Tambah admin</button></div>
    ${S.adm.users.map(u => `<div class="list-row"><span class="avatar ${u.peran === 'superadmin' ? 'c3' : warnaAv(u.nama)}">${esc(inisial(u.nama))}</span><div class="grow"><b class="small">${esc(u.nama)}</b> ${u.username === S.me.username ? '<span class="tag">Anda</span>' : ''}<div class="xs muted">@${esc(u.username)} \u00b7 ${u.peran === 'superadmin' ? 'Super Admin' : 'Admin'}</div></div>
      <span class="pill ${u.aktif ? 'st-lunas' : 'st-batal'}">${u.aktif ? 'Aktif' : 'Nonaktif'}</span>${u.username !== S.me.username ? `<button class="icon-btn sm" data-ak="${esc(u.username)}" aria-label="Kelola ${esc(u.nama)}"><i class="bi bi-three-dots"></i></button>` : ''}</div>`).join('')}`;
  if (tab === 'sandi') isi = `<div class="card-head"><div><h3>Kata sandi saya</h3><div class="sub">Minimal 8 karakter, berisi huruf dan angka. Sesi di perangkat lain akan berakhir.</div></div></div>
    <div class="stack" style="max-width:420px"><div class="field"><label for="pwL">Kata sandi lama</label><input id="pwL" class="input" type="password" autocomplete="current-password"></div>
    <div class="field"><label for="pwB">Kata sandi baru</label><input id="pwB" class="input" type="password" autocomplete="new-password"></div>
    <div class="field"><label for="pwK">Ulangi kata sandi baru</label><input id="pwK" class="input" type="password" autocomplete="new-password"></div></div>`;
  const simpanBtn = ['toko', 'ukuran', 'pengingat', 'sandi'].includes(tab);
  v.innerHTML = `<div class="grid" style="grid-template-columns:minmax(200px,240px) minmax(0,1fr);align-items:start" id="setGrid">
    <div class="card tight"><div class="tabs v">${tabs.map(t => `<button class="tab ${t[0] === tab ? 'on' : ''}" data-st="${t[0]}"><i class="bi ${t[1]}"></i>${t[2]}</button>`).join('')}</div></div>
    <div class="card">${isi}${simpanBtn ? `<div class="row mt24" style="justify-content:flex-end"><button class="btn btn-primary" id="setSimpan"><i class="bi bi-check2"></i> ${tab === 'sandi' ? 'Ganti kata sandi' : 'Simpan pengaturan'}</button></div>` : ''}</div></div>`;
  if (window.innerWidth < 860) $('#setGrid').style.gridTemplateColumns = '1fr';
  $$('[data-st]', v).forEach(b => b.onclick = () => { S.ui.setTab = b.dataset.st; renderPengaturan(); });
  if (tab === 'toko') { pasangRekening(st.rekening || []); pasangLogo(); }
  if (tab === 'ukuran') pasangUkuran(st.ukuran.slice());
  if (tab === 'akun') { $('#akBaru').onclick = () => formAkun(null); $$('[data-ak]', v).forEach(b => b.onclick = () => formAkun(b.dataset.ak)); }
  const sb = $('#setSimpan');
  if (sb) sb.onclick = () => simpanPengaturan(tab, sb);
}
function pasangLogo() {
  let foto = null;
  const inp = $('#lgFile'), sb = $('#lgSimpan'), hb = $('#lgHapus');
  inp.onchange = async () => {
    try { foto = await siapkanFile(inp.files[0], { hanyaGambar: true, kotak: true, maks: 256 }); $('#lgPrev').innerHTML = `<img src="${foto.preview}" alt="">`; sb.disabled = false; }
    catch (e) { toast(e.message, 'error'); inp.value = ''; }
  };
  const kirim = async (btn, f) => {
    sibuk(btn, true, 'Menyimpan\u2026');
    const r = await api('apiSimpanLogo', S.token, f ? { b64: f.b64, mime: f.mime, name: f.nama } : null);
    sibuk(btn, false);
    if (!r.success) { toast(r.message, 'error'); return; }
    if (f) r.data.logo = f.preview;
    S.adm.settings = r.data; terapkanBoot(S.adm);
    toast(r.message); renderPengaturan(); sinkron();
  };
  sb.onclick = () => kirim(sb, foto);
  if (hb) hb.onclick = () => kirim(hb, null);
}
let _rek = [], _uk = [];
function pasangRekening(rek) {
  _rek = rek.map(r => Object.assign({}, r));
  const gambar = () => { $('#rekList').innerHTML = _rek.length ? _rek.map((r, i) => `<div class="nested row wrap" style="gap:8px"><input class="input" style="flex:1 1 90px" placeholder="Bank" value="${esc(r.bank)}" data-ri="${i}" data-rk="bank" aria-label="Nama bank"><input class="input num" style="flex:2 1 150px" placeholder="No rekening" value="${esc(r.norek)}" data-ri="${i}" data-rk="norek" aria-label="Nomor rekening"><input class="input" style="flex:2 1 150px" placeholder="Atas nama" value="${esc(r.nama)}" data-ri="${i}" data-rk="nama" aria-label="Atas nama"><button class="icon-btn sm" data-rx="${i}" aria-label="Hapus rekening"><i class="bi bi-trash3"></i></button></div>`).join('') : '<p class="small muted">Belum ada rekening.</p>';
    $$('[data-ri]').forEach(inp => inp.oninput = () => { _rek[+inp.dataset.ri][inp.dataset.rk] = inp.value; });
    $$('[data-rx]').forEach(b => b.onclick = () => { _rek.splice(+b.dataset.rx, 1); gambar(); }); };
  $('#rekTambah').onclick = () => { _rek.push({ bank: '', norek: '', nama: S.adm.settings.namaToko }); gambar(); };
  gambar();
}
function pasangUkuran(uk) {
  _uk = uk;
  const gambar = () => { $('#ukList').innerHTML = _uk.map((u, i) => `<div class="nested row" style="padding:8px 12px"><span class="size-tag">${esc(u)}</span><span class="grow"></span><button class="icon-btn sm" data-um="${i}" data-d="-1" ${i === 0 ? 'disabled' : ''} aria-label="Naikkan ${esc(u)}"><i class="bi bi-arrow-up"></i></button><button class="icon-btn sm" data-um="${i}" data-d="1" ${i === _uk.length - 1 ? 'disabled' : ''} aria-label="Turunkan ${esc(u)}"><i class="bi bi-arrow-down"></i></button><button class="icon-btn sm" data-ux="${i}" aria-label="Hapus ${esc(u)}"><i class="bi bi-trash3"></i></button></div>`).join('');
    $$('[data-um]').forEach(b => b.onclick = () => { const i = +b.dataset.um, j = i + +b.dataset.d; [_uk[i], _uk[j]] = [_uk[j], _uk[i]]; gambar(); });
    $$('[data-ux]').forEach(b => b.onclick = () => { if (_uk.length <= 1) { toast('Minimal satu ukuran.', 'warn'); return; } _uk.splice(+b.dataset.ux, 1); gambar(); }); };
  const tambah = () => { const v = $('#ukBaru').value.trim().toUpperCase(); if (!v) return; if (_uk.includes(v)) { toast('Ukuran sudah ada.', 'warn'); return; } _uk.push(v); $('#ukBaru').value = ''; gambar(); };
  $('#ukTambah').onclick = tambah;
  $('#ukBaru').onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); tambah(); } };
  gambar();
}
async function simpanPengaturan(tab, btn) {
  if (tab === 'sandi') {
    const l = $('#pwL').value, b = $('#pwB').value, k = $('#pwK').value;
    if (b !== k) { toast('Ulangi kata sandi baru tidak sama.', 'warn'); return; }
    if (b.length < 8 || !/\d/.test(b) || !/[A-Za-z]/.test(b)) { toast('Kata sandi minimal 8 karakter dengan huruf dan angka.', 'warn'); return; }
    sibuk(btn, true, 'Menyimpan\u2026');
    const r = await api('apiGantiSandi', S.token, l, b);
    sibuk(btn, false);
    if (!r.success) { toast(r.message, 'error'); return; }
    S.token = r.data.token; ls.set('bc_sesi', { token: S.token, me: S.me });
    toast(r.message); renderPengaturan(); return;
  }
  let data = {};
  if (tab === 'toko') data = { namaToko: $('#stNama').value, tagline: $('#stTag').value, wa: $('#stWa').value, alamatAmbil: $('#stAlamat').value, jam: $('#stJam').value, rekening: _rek, kanal: $('#stKanal').value.split(',').map(x => x.trim()).filter(Boolean) };
  if (tab === 'ukuran') data = { ukuran: _uk };
  if (tab === 'pengingat') data = { hariPengingat: $('#stH').value, ambangLoyal: $('#stL').value };
  sibuk(btn, true, 'Menyimpan\u2026');
  const r = await api('apiSimpanPengaturan', S.token, data);
  sibuk(btn, false);
  if (!r.success) { toast(r.message, 'error'); return; }
  S.adm.settings = r.data;
  terapkanBoot(S.adm);
  toast(r.message); renderPengaturan(); sinkron();
}
function formAkun(username) {
  const u = username ? S.adm.users.find(x => x.username === username) : { username: '', nama: '', peran: 'admin', aktif: true };
  bukaDrawer(`<div class="drawer-head"><div class="grow"><div class="xs muted bold">${username ? 'KELOLA AKUN' : 'AKUN BARU'}</div><h3 id="drawerTitle">${username ? esc(u.nama) : 'Tambah admin'}</h3></div><button class="icon-btn sm" data-action="close-drawer" aria-label="Tutup"><i class="bi bi-x-lg"></i></button></div>
    <div class="drawer-body stack">
      <div class="field"><label for="akU">Username</label><input id="akU" class="input" value="${esc(u.username)}" ${username ? 'disabled' : ''} autocapitalize="none" placeholder="contoh: siti"><div class="help">Huruf kecil, angka, titik, atau garis bawah.</div></div>
      <div class="field"><label for="akN">Nama</label><input id="akN" class="input" value="${esc(u.nama)}" maxlength="60"></div>
      <div class="field"><label for="akP">Peran</label><select id="akP" class="select"><option value="admin" ${u.peran === 'admin' ? 'selected' : ''}>Admin (karyawan)</option><option value="superadmin" ${u.peran === 'superadmin' ? 'selected' : ''}>Super Admin</option></select></div>
      ${username ? `<label class="row nested" style="cursor:pointer"><span class="switch"><input type="checkbox" id="akA" ${u.aktif ? 'checked' : ''}><span></span></span><div><b class="small">Akun aktif</b><div class="xs muted">Nonaktifkan untuk mencabut akses seketika.</div></div></label>
        <button class="btn btn-outline" id="akReset"><i class="bi bi-key"></i> Buat kata sandi baru</button>` : `<div class="note info"><i class="bi bi-info-circle"></i>Kata sandi awal dibuat otomatis dan ditampilkan sekali setelah disimpan.</div>`}
      <div id="akOut"></div>
    </div>
    <div class="drawer-foot"><button class="btn btn-soft" data-action="close-drawer">Batal</button><button class="btn btn-primary grow" id="akSimpan"><i class="bi bi-check2"></i> Simpan</button></div>`);
  const tampilSandi = s => { $('#akOut').innerHTML = `<div class="note warn"><i class="bi bi-key"></i><div>Kata sandi: <b class="code">${esc(s)}</b><div class="xs mt8">Catat dan sampaikan ke pemilik akun. Tidak akan ditampilkan lagi.</div><button class="btn btn-soft btn-sm mt8" data-copy="${esc(s)}" data-copy-lbl="Kata sandi">Salin</button></div></div>`; };
  const rs = $('#akReset');
  if (rs) rs.onclick = async () => { if (!await konfirmasi({ judul: 'Buat kata sandi baru?', teks: 'Sandi lama tidak berlaku dan sesi akun ini berakhir.', ok: 'Buat sandi baru' })) return; sibuk(rs, true); const r = await api('apiResetSandi', S.token, username); sibuk(rs, false); if (!r.success) { toast(r.message, 'error'); return; } tampilSandi(r.data.sandi); };
  $('#akSimpan').onclick = async () => {
    const btn = $('#akSimpan');
    const data = { username: $('#akU').value.trim().toLowerCase(), nama: $('#akN').value.trim(), peran: $('#akP').value, aktif: $('#akA') ? $('#akA').checked : true, baru: !username };
    sibuk(btn, true, 'Menyimpan\u2026');
    const r = await api('apiSimpanPengguna', S.token, data);
    sibuk(btn, false);
    if (!r.success) { toast(r.message, 'error'); return; }
    const i = S.adm.users.findIndex(x => x.username === r.data.user.username);
    if (i > -1) S.adm.users[i] = r.data.user; else S.adm.users.push(r.data.user);
    toast(r.message); renderPengaturan();
    if (r.data.sandiAwal) { tampilSandi(r.data.sandiAwal); btn.remove(); } else tutupDrawer();
    sinkron();
  };
}

const IKON_NOTIF = { pesanan_baru: ['bi-bag-plus', 'var(--peri-tint)', 'var(--peri-dark)'], bukti: ['bi-receipt', 'var(--pink-tint)', 'var(--pink-ink)'], pengingat: ['bi-alarm', 'var(--butter-tint)', 'var(--butter-ink)'], diubah: ['bi-pencil-square', 'var(--nested)', 'var(--ink)'] };
function bukaNotif() {
  if (!S.adm) return;
  const gambar = () => {
    const semua = S.adm.notifs || [];
    const list = S.ui.notifTab === 'belum' ? semua.filter(n => !n.baca) : semua;
    const nBelum = semua.filter(n => !n.baca).length;
    const hari = isoHari(), kemarin = tambahHari(hari, -1);
    const grup = {};
    list.forEach(n => { const d = String(n.waktu).slice(0, 10); const k = d === hari ? 'Hari ini' : d === kemarin ? 'Kemarin' : tgl(d); (grup[k] = grup[k] || []).push(n); });
    $('#drawer').innerHTML = `<div class="drawer-head"><div class="grow"><h3 id="drawerTitle">Notifikasi</h3>${nBelum ? `<span class="tag dark mt8">${nBelum} belum dibaca</span>` : ''}</div>
      ${nBelum ? `<button class="btn btn-ghost btn-sm" id="ntSemua"><i class="bi bi-check2-all"></i> Tandai semua</button>` : ''}<button class="icon-btn sm" data-action="close-drawer" aria-label="Tutup"><i class="bi bi-x-lg"></i></button></div>
      <div style="padding:0 20px 8px"><div class="chips"><button class="chip ${S.ui.notifTab === 'semua' ? 'on' : ''}" data-nt="semua">Semua <span class="cnt">${semua.length}</span></button><button class="chip ${S.ui.notifTab === 'belum' ? 'on' : ''}" data-nt="belum">Belum dibaca <span class="cnt">${nBelum}</span></button></div></div>
      <div class="drawer-body">${list.length ? Object.keys(grup).map(k => `<div class="xs muted bold mt12 mb8" style="letter-spacing:.06em">${esc(k.toUpperCase())}</div>${grup[k].map(n => { const ic = IKON_NOTIF[n.jenis] || ['bi-bell', 'var(--nested)', 'var(--ink)']; return `<div class="notif-item ${n.baca ? 'read' : ''}" data-n="${esc(n.id)}" data-kode="${esc(n.kode)}" role="button" tabindex="0"><span class="notif-ic" style="background:${ic[1]};color:${ic[2]}"><i class="bi ${ic[0]}"></i></span><div class="grow"><div class="nt">${esc(n.pesan)}</div><div class="xs muted mt8">${relatif(n.waktu)}</div></div>${n.baca ? '' : '<span class="unread-dot"></span>'}</div>`; }).join('')}`).join('') : emptyState('bi-bell', 'Tidak ada notifikasi', S.ui.notifTab === 'belum' ? 'Semua notifikasi sudah dibaca.' : 'Notifikasi pesanan baru dan pengingat muncul di sini.')}
        <p class="xs muted center mt16"><i class="bi bi-arrow-repeat"></i> Diperbarui otomatis setiap 60 detik</p></div>`;
    $$('[data-nt]').forEach(b => b.onclick = () => { S.ui.notifTab = b.dataset.nt; gambar(); });
    const ts = $('#ntSemua'); if (ts) ts.onclick = () => { S.adm.notifs.forEach(n => { n.baca = true; }); perbaruiBadge(); gambar(); api('apiTandaiDibaca', S.token, 'semua'); };
    $$('[data-n]').forEach(el => { const buka = () => { const n = S.adm.notifs.find(x => x.id === el.dataset.n); if (n && !n.baca) { n.baca = true; perbaruiBadge(); api('apiTandaiDibaca', S.token, [n.id]); } tutupDrawer(); if (el.dataset.kode) { if (n && n.jenis === 'bukti' && S.adm.orders.some(o => o.id === n.kode && o.sb === SB.MENUNGGU)) { S.ui.verifSel = n.kode; go('verifikasi'); } else go('detail', { id: el.dataset.kode }); } }; el.onclick = buka; el.onkeydown = e => { if (e.key === 'Enter') buka(); }; });
  };
  bukaDrawer('');
  gambar();
}
function bukaMenuAkun() {
  bukaDrawer(`<div class="drawer-head"><span class="avatar lg c3">${esc(inisial(S.me.nama))}</span><div class="grow"><h3 id="drawerTitle">${esc(S.me.nama)}</h3><div class="small muted">@${esc(S.me.username)} \u00b7 ${isSuper() ? 'Super Admin' : 'Admin'}</div></div><button class="icon-btn sm" data-action="close-drawer" aria-label="Tutup"><i class="bi bi-x-lg"></i></button></div>
    <div class="drawer-body sheet-menu">
      <div class="list-row click" data-go="pengaturan"><span class="avatar"><i class="bi bi-key"></i></span><div class="grow"><b class="small">Pengaturan & kata sandi</b></div><i class="bi bi-chevron-right muted"></i></div>
      <div class="list-row click" data-action="theme"><span class="avatar c1"><i class="bi bi-moon-stars"></i></span><div class="grow"><b class="small">Ganti tema terang/gelap</b></div></div>
      <div class="list-row click" data-go="katalog"><span class="avatar"><i class="bi bi-shop"></i></span><div class="grow"><b class="small">Lihat katalog publik</b><div class="xs muted">Tetap masuk sebagai admin</div></div></div>
      <div class="list-row click" data-action="logout"><span class="avatar c2"><i class="bi bi-box-arrow-right"></i></span><div class="grow"><b class="small">Keluar</b></div></div>
    </div>`);
  $$('#drawer [data-go="pengaturan"]').forEach(b => b.addEventListener('click', () => { S.ui.setTab = isSuper() ? 'toko' : 'sandi'; }, true));
}
const WARNA_KANAL = ['var(--charcoal)', 'var(--peri)', 'var(--butter)', 'var(--pink)', 'var(--primary-bg)', '#9BC7A8', '#C9A7E0'];
function mpSah(m) { return m.status !== 'Retur'; }
function mpPerBulan() {
  const o = {};
  ((S.adm && S.adm.mp) || []).filter(mpSah).forEach(m => { const b = m.tgl.slice(0, 7); o[b] = o[b] || { omzet: 0, bersih: 0, n: 0, pcs: 0 }; o[b].omzet += m.omzet; o[b].bersih += m.bersih; o[b].n++; o[b].pcs += m.pcs; });
  return o;
}
function rekapKanal(bulan) {
  const A = S.adm, D = A.dash || { bulan: [] };
  const w = (D.bulan || []).find(b => b.b === bulan) || { omzet: 0, pesanan: 0, pcs: 0 };
  const rows = [{ k: 'Web (aplikasi ini)', omzet: w.omzet, bersih: w.omzet, n: w.pesanan, pcs: w.pcs }];
  const per = {};
  (A.mp || []).filter(m => mpSah(m) && m.tgl.slice(0, 7) === bulan).forEach(m => { const x = per[m.kanal] = per[m.kanal] || { k: m.kanal, omzet: 0, bersih: 0, n: 0, pcs: 0 }; x.omzet += m.omzet; x.bersih += m.bersih; x.n++; x.pcs += m.pcs; });
  Object.keys(per).sort((a, b) => per[b].omzet - per[a].omzet).forEach(k => rows.push(per[k]));
  return rows;
}
function htmlKanal(rows) {
  const tot = rows.reduce((a, r) => a + r.omzet, 0);
  if (!tot && rows.length < 2) return emptyState('bi-shop-window', 'Belum ada penjualan bulan ini', 'Catat penjualan marketplace di menu Marketplace.');
  return `<div class="hbar mb16" style="height:14px;display:flex;gap:3px;background:transparent">${rows.filter(r => r.omzet).map((r, i) => `<span style="width:${r.omzet / tot * 100}%;background:${WARNA_KANAL[rows.indexOf(r) % WARNA_KANAL.length]};border-radius:99px" title="${esc(r.k)}"></span>`).join('')}</div>
    ${rows.map((r, i) => `<div class="list-row"><span class="sw" style="width:12px;height:12px;border-radius:4px;flex:none;background:${WARNA_KANAL[i % WARNA_KANAL.length]}"></span><div class="grow"><b class="small">${esc(r.k)}</b><div class="xs muted">${angka(r.n)} pesanan \u00b7 ${angka(r.pcs)} pcs${r.bersih !== r.omzet ? ' \u00b7 bersih ' + rp(r.bersih) : ''}</div></div><div class="right"><div class="bold num small">${rp(r.omzet)}</div><div class="xs muted">${tot ? Math.round(r.omzet / tot * 100) : 0}%</div></div></div>`).join('')}
    <div class="nested row between mt12"><span class="bold">Total semua kanal</span><b class="num" style="font-family:var(--f-head);font-size:20px">${rp(tot)}</b></div>`;
}
function renderMarketplace() {
  const v = $('#v-marketplace');
  if (perluBoot(v)) return;
  const A = S.adm, bulan = S.ui.mpBulan || isoHari().slice(0, 7);
  S.ui.mpBulan = bulan;
  const fk = S.ui.mpKanal || '';
  const data = (A.mp || []).filter(m => m.tgl.slice(0, 7) === bulan && (!fk || m.kanal === fk));
  const sah = data.filter(mpSah);
  const sum = k => sah.reduce((a, m) => a + m[k], 0);
  const nm = BULAN[+bulan.slice(5, 7) - 1] + ' ' + bulan.slice(0, 4);
  const kanalAda = [...new Set((A.mp || []).filter(m => m.tgl.slice(0, 7) === bulan).map(m => m.kanal))];
  v.innerHTML = `<div class="row between wrap mb16" style="gap:12px">
      <div><p class="muted small" style="max-width:520px">Catat pesanan dari Shopee, Tokopedia, TikTok Shop, dan lainnya agar laporan penjualan lengkap.</p></div>
      <div class="row wrap"><input type="month" id="mpBulan" class="input" style="width:auto" value="${bulan}" aria-label="Pilih bulan">
        <button class="btn btn-outline" id="mpCsv"><i class="bi bi-download"></i> Unduh laporan</button>
        <button class="btn btn-primary" id="mpBaru"><i class="bi bi-plus-lg"></i> Catat penjualan</button></div></div>
    <div class="grid g4">
      <div class="card stat"><div class="k">Omzet marketplace <span class="ic"><i class="bi bi-shop-window"></i></span></div><div class="v">${rp(sum('omzet'))}</div><div class="s">${esc(nm)}${fk ? ' \u00b7 ' + esc(fk) : ''}</div></div>
      <div class="card stat"><div class="k">Potongan & biaya <span class="ic"><i class="bi bi-percent"></i></span></div><div class="v">${rp(sum('biaya'))}</div><div class="s">Admin, ongkir, promo</div></div>
      <div class="card stat"><div class="k">Pendapatan bersih <span class="ic"><i class="bi bi-wallet2"></i></span></div><div class="v">${rp(sum('bersih'))}</div><div class="s">Omzet dikurangi potongan</div></div>
      <div class="card stat"><div class="k">Pesanan & pcs <span class="ic"><i class="bi bi-layers"></i></span></div><div class="v">${angka(sah.length)}</div><div class="s">${angka(sum('pcs'))} pcs${data.length - sah.length ? ' \u00b7 ' + (data.length - sah.length) + ' retur' : ''}</div></div>
    </div>
    <div class="grid mt24" style="grid-template-columns:minmax(0,1.6fr) minmax(0,1fr);align-items:start" id="mpGrid">
      <div class="card"><div class="card-head"><div><h3>Daftar penjualan</h3><div class="sub">${data.length} catatan \u00b7 klik untuk ubah</div></div></div>
        ${kanalAda.length > 1 ? `<div class="chips mb12" style="flex-wrap:wrap"><button class="chip ${fk ? '' : 'on'}" data-mpk="">Semua</button>${kanalAda.map(k => `<button class="chip ${fk === k ? 'on' : ''}" data-mpk="${esc(k)}">${esc(k)}</button>`).join('')}</div>` : ''}
        ${data.length ? data.map(m => `<div class="list-row click" data-mp="${esc(m.id)}"><span class="avatar ${warnaAv(m.kanal)}">${esc(inisial(m.kanal))}</span>
          <div class="grow" style="min-width:0"><b class="small ellipsis" style="display:block">${esc(m.desain || 'Tanpa desain')} \u00b7 ${angka(m.pcs)} pcs</b><div class="xs muted ellipsis">${tgl(m.tgl)} \u00b7 ${esc(m.kanal)}${m.no ? ' \u00b7 <span class="code">' + esc(m.no) + '</span>' : ''}${m.pembeli ? ' \u00b7 ' + esc(m.pembeli) : ''}</div></div>
          <div class="right"><div class="bold num small" ${mpSah(m) ? '' : 'style="text-decoration:line-through;opacity:.6"'}>${rp(m.omzet)}</div>${mpSah(m) ? `<div class="xs muted num">bersih ${rp(m.bersih)}</div>` : '<span class="pill st-batal">Retur</span>'}</div></div>`).join('')
          : emptyState('bi-shop-window', 'Belum ada catatan di ' + nm, 'Klik "Catat penjualan" setiap ada pesanan dari marketplace, atau catat rekap harian.', '<button class="btn btn-primary btn-sm mt12" data-mpbaru>Catat penjualan</button>')}</div>
      <div class="card"><div class="card-head"><div><h3>Semua kanal</h3><div class="sub">${esc(nm)}</div></div></div>${htmlKanal(rekapKanal(bulan))}</div>
    </div>`;
  if (window.innerWidth < 1000) $('#mpGrid').style.gridTemplateColumns = '1fr';
  $('#mpBulan').onchange = e => { if (e.target.value) { S.ui.mpBulan = e.target.value; S.ui.mpKanal = ''; renderMarketplace(); } };
  $('#mpBaru').onclick = () => formMp(null);
  $$('[data-mpbaru]', v).forEach(b => b.onclick = () => formMp(null));
  $$('[data-mpk]', v).forEach(b => b.onclick = () => { S.ui.mpKanal = b.dataset.mpk; renderMarketplace(); });
  $$('[data-mp]', v).forEach(b => b.onclick = () => formMp(b.dataset.mp));
  $('#mpCsv').onclick = () => unduhLaporan(bulan);
}
function formMp(id) {
  const A = S.adm, kanal = A.settings.kanal && A.settings.kanal.length ? A.settings.kanal : ['Shopee', 'Tokopedia', 'TikTok Shop', 'Lazada', 'Lainnya'];
  const m = id ? A.mp.find(x => x.id === id) : { tgl: isoHari(), kanal: ls.get('bc_mp_kanal', kanal[0]), no: '', pembeli: '', idDesain: '', desain: '', pcs: 1, omzet: '', biaya: '', status: 'Selesai', catatan: '' };
  if (!m) return;
  const kanalOpsi = kanal.indexOf(m.kanal) > -1 ? kanal : kanal.concat([m.kanal]);
  bukaDrawer(`<div class="drawer-head"><div class="grow"><div class="xs muted bold">${id ? 'UBAH CATATAN' : 'PENJUALAN MARKETPLACE'}</div><h3 id="drawerTitle">${id ? esc(m.kanal) + ' \u00b7 ' + tgl(m.tgl) : 'Catat penjualan'}</h3></div><button class="icon-btn sm" data-action="close-drawer" aria-label="Tutup"><i class="bi bi-x-lg"></i></button></div>
    <form class="drawer-body stack" id="fMp" novalidate>
      <div class="field"><span class="lbl">Marketplace</span><div class="chips" style="flex-wrap:wrap" id="mpKanal">${kanalOpsi.map(k => `<button type="button" class="chip ${k === m.kanal ? 'on' : ''}" data-k="${esc(k)}">${esc(k)}</button>`).join('')}</div></div>
      <div class="grid g2" style="gap:12px"><div class="field"><label for="mpTgl">Tanggal</label><input id="mpTgl" type="date" class="input" value="${esc(m.tgl)}"></div>
        <div class="field"><label for="mpNo">No pesanan <span class="opt">(opsional)</span></label><input id="mpNo" class="input code" maxlength="40" value="${esc(m.no)}" placeholder="2411068ABCD"></div></div>
      <div class="field"><label for="mpDes">Desain</label><select id="mpDes" class="select"><option value="">\u2014 Lainnya / campuran \u2014</option>${A.designs.map(d => `<option value="${esc(d.id)}" ${d.id === m.idDesain ? 'selected' : ''}>${esc(d.nama)}</option>`).join('')}</select></div>
      <div class="field"><label for="mpPembeli">Nama pembeli <span class="opt">(opsional)</span></label><input id="mpPembeli" class="input" maxlength="80" value="${esc(m.pembeli)}"></div>
      <div class="grid g2" style="gap:12px">
        <div class="field" data-field="pcs"><label for="mpPcs">Jumlah pcs <span class="req">*</span></label><input id="mpPcs" class="input num" inputmode="numeric" value="${esc(m.pcs)}"><div class="err-msg"><span>Minimal 1.</span></div></div>
        <div class="field" data-field="omzet"><label for="mpOmzet">Nilai penjualan (Rp) <span class="req">*</span></label><input id="mpOmzet" class="input num" inputmode="numeric" value="${esc(m.omzet)}" placeholder="255000"><div class="err-msg"><span>Wajib diisi.</span></div></div></div>
      <div class="field" data-field="biaya"><label for="mpBiaya">Potongan marketplace (Rp) <span class="opt">(admin, ongkir, voucher)</span></label><input id="mpBiaya" class="input num" inputmode="numeric" value="${esc(m.biaya)}" placeholder="0"><div class="err-msg"><span>Tidak boleh melebihi nilai penjualan.</span></div></div>
      <div class="nested row between"><span class="small bold muted">PENDAPATAN BERSIH</span><b class="num" id="mpBersih" style="font-family:var(--f-head);font-size:22px">Rp 0</b></div>
      <div class="field"><span class="lbl">Status</span><div class="chips" id="mpStatus"><button type="button" class="chip ${m.status !== 'Retur' ? 'on' : ''}" data-s="Selesai">Selesai</button><button type="button" class="chip ${m.status === 'Retur' ? 'on' : ''}" data-s="Retur">Retur / batal</button></div><div class="help">Retur tidak dihitung dalam omzet.</div></div>
      <div class="field"><label for="mpCat">Catatan <span class="opt">(opsional)</span></label><textarea id="mpCat" class="textarea" rows="2" maxlength="300" placeholder="Contoh: rekap penjualan Shopee tanggal ini">${esc(m.catatan || '')}</textarea></div>
      ${id ? '<button type="button" class="btn btn-ghost btn-sm" id="mpHapus" style="align-self:flex-start;color:var(--danger)"><i class="bi bi-trash3"></i> Hapus catatan</button>' : ''}
    </form>
    <div class="drawer-foot"><button class="btn btn-soft" data-action="close-drawer">Batal</button><button class="btn btn-primary grow" id="mpSimpan"><i class="bi bi-check2"></i> Simpan</button></div>`);
  const dr = $('#drawer'); let pilKanal = m.kanal, status = m.status || 'Selesai';
  const num = el => +String(el.value).replace(/\D/g, '') || 0;
  const hitung = () => { $('#mpBersih').textContent = rp(Math.max(0, num($('#mpOmzet')) - num($('#mpBiaya')))); };
  ['#mpOmzet', '#mpBiaya'].forEach(q => $(q, dr).addEventListener('input', hitung)); hitung();
  $$('#mpKanal .chip', dr).forEach(c => c.onclick = () => { pilKanal = c.dataset.k; $$('#mpKanal .chip', dr).forEach(x => x.classList.toggle('on', x === c)); });
  $$('#mpStatus .chip', dr).forEach(c => c.onclick = () => { status = c.dataset.s; $$('#mpStatus .chip', dr).forEach(x => x.classList.toggle('on', x === c)); });
  const hb = $('#mpHapus');
  if (hb) hb.onclick = async () => {
    if (!await konfirmasi({ judul: 'Hapus catatan ini?', teks: 'Omzet bulan ' + BULAN[+m.tgl.slice(5, 7) - 1] + ' akan berkurang ' + rp(m.omzet) + '.', ok: 'Hapus', bahaya: true })) return;
    const lama = A.mp.slice(); A.mp = A.mp.filter(x => x.id !== id); tutupDrawer(); segarkan(); toast('Catatan dihapus');
    const r = await api('apiHapusMp', S.token, id);
    if (!r.success) { A.mp = lama; segarkan(); toast(r.message, 'error'); return; }
    sinkron();
  };
  $('#mpSimpan').onclick = async () => {
    const des = A.designs.find(d => d.id === $('#mpDes').value);
    const d = { id: id || '', tgl: $('#mpTgl').value, kanal: pilKanal, no: $('#mpNo').value.trim(), pembeli: $('#mpPembeli').value.trim(), idDesain: des ? des.id : '', desain: des ? des.nama : '',
      pcs: num($('#mpPcs')), omzet: num($('#mpOmzet')), biaya: num($('#mpBiaya')), status, catatan: $('#mpCat').value.trim() };
    let ok = true;
    [['pcs', d.pcs >= 1], ['omzet', d.omzet >= 1], ['biaya', d.biaya <= d.omzet]].forEach(([k, val]) => { $(`[data-field="${k}"]`, dr).classList.toggle('err', !val); if (!val) ok = false; });
    if (!d.tgl) { toast('Isi tanggal.', 'warn'); ok = false; }
    if (!ok) return;
    ls.set('bc_mp_kanal', d.kanal);
    const lama = A.mp.slice();
    const lokal = Object.assign({}, d, { id: id || 'tmp' + Date.now(), bersih: d.omzet - d.biaya });
    A.mp = id ? A.mp.map(x => x.id === id ? lokal : x) : [lokal].concat(A.mp);
    A.mp.sort((a, b) => a.tgl < b.tgl ? 1 : a.tgl > b.tgl ? -1 : 0);
    S.ui.mpBulan = d.tgl.slice(0, 7);
    tutupDrawer(); segarkan(); toast(id ? 'Penjualan diperbarui' : 'Penjualan tercatat');
    const r = await api('apiSimpanMp', S.token, d);
    if (!r.success) { A.mp = lama; segarkan(); toast(r.message, 'error'); return; }
    A.mp = A.mp.map(x => x.id === lokal.id ? r.data : x);
    sinkron();
  };
}
function unduhLaporan(bulan) {
  const A = S.adm, nm = BULAN[+bulan.slice(5, 7) - 1] + ' ' + bulan.slice(0, 4);
  const q = x => '"' + String(x == null ? '' : x).replace(/"/g, '""') + '"';
  const baris = [['Tanggal', 'Kanal', 'No Pesanan', 'Pembeli', 'Desain', 'Pcs', 'Omzet', 'Potongan', 'Bersih', 'Status']];
  A.orders.filter(o => String(o.tgl).slice(0, 7) === bulan && o.sp !== SP.BATAL).forEach(o => baris.push([String(o.tgl).slice(0, 10), 'Web', o.id, o.nama, '', o.pcs, o.total, 0, o.total, o.sb === SB.LUNAS ? 'Lunas' : o.sb]));
  (A.mp || []).filter(m => m.tgl.slice(0, 7) === bulan).forEach(m => baris.push([m.tgl, m.kanal, m.no, m.pembeli, m.desain, m.pcs, m.omzet, m.biaya, m.bersih, m.status]));
  baris.splice(1, baris.length - 1, ...baris.slice(1).sort((a, b) => a[0] < b[0] ? -1 : 1));
  const rk = rekapKanal(bulan);
  baris.push([], ['REKAP ' + nm.toUpperCase()], ['Kanal', 'Pesanan', 'Pcs', 'Omzet', 'Bersih']);
  rk.forEach(r => baris.push([r.k, r.n, r.pcs, r.omzet, r.bersih]));
  baris.push(['Total', rk.reduce((a, r) => a + r.n, 0), rk.reduce((a, r) => a + r.pcs, 0), rk.reduce((a, r) => a + r.omzet, 0), rk.reduce((a, r) => a + r.bersih, 0)]);
  baris.push([], ['Catatan: omzet Web dihitung dari pembayaran terverifikasi. Pesanan web yang belum lunas tetap tercantum di daftar.']);
  const csv = '\ufeff' + baris.map(r => r.map(q).join(';')).join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a.download = 'Laporan-Penjualan-' + bulan + '.csv';
  document.body.appendChild(a); a.click(); a.remove();
  toast('Laporan ' + nm + ' diunduh');
}
function bukaLainnya() {
  const items = MENU.filter(m => !m.su || isSuper()).filter(m => !['beranda', 'pesanan', 'verifikasi'].includes(m.r));
  bukaDrawer(`<div class="drawer-head"><h3 id="drawerTitle" class="grow">Menu lainnya</h3><button class="icon-btn sm" data-action="close-drawer" aria-label="Tutup"><i class="bi bi-x-lg"></i></button></div>
    <div class="drawer-body sheet-menu">${items.map(m => `<div class="list-row click" data-go="${m.r}"><span class="avatar"><i class="bi ${m.ic}"></i></span><div class="grow"><b class="small">${m.t}</b></div><i class="bi bi-chevron-right muted"></i></div>`).join('')}
      <div class="divider"></div>
      <div class="list-row click" data-action="theme"><span class="avatar c1"><i class="bi bi-moon-stars"></i></span><div class="grow"><b class="small">Ganti tema</b></div></div>
      <div class="list-row click" data-action="logout"><span class="avatar c2"><i class="bi bi-box-arrow-right"></i></span><div class="grow"><b class="small">Keluar</b></div></div></div>`);
}

document.addEventListener('click', e => { const a = e.target.closest('#drawer [data-action="theme"]'); if (a) setTimeout(tutupDrawer, 120); }, true);

async function muatKatalog(ulang) {
  if (ulang) { S.pub.err = ''; if (S.route === 'katalog') renderKatalog(); }
  const r = await api('apiKatalog');
  if (!r.success) {
    if (!S.pub.loaded) { S.pub.err = r.message; if (S.route === 'katalog') renderKatalog(); }
    return;
  }
  const baru = !S.pub.loaded;
  if (!baru && r.data.ver === S.pub.ver) return;
  S.pub = { designs: r.data.designs, settings: r.data.settings, ver: r.data.ver, loaded: true, err: '' };
  try { localStorage.setItem('bc_boot', JSON.stringify(r.data)); } catch (e) { }
  terapkanIdentitas();
  if (S.route === 'katalog' || (baru && S.route === 'pesan')) segarkan();
}
(function mulai() {
  window.__APP_OK__ = true;
  terapkanIdentitas();
  ikonTema();
  const sesi = ls.get('bc_sesi', null);
  if (sesi && sesi.token) {
    S.token = sesi.token; S.me = sesi.me;
    masukAdmin();
  } else {
    const h = location.hash.slice(1).toLowerCase();
    go(['login', 'pesan', 'status'].indexOf(h) > -1 ? h : 'katalog');
  }
  window.addEventListener('hashchange', () => { const h = location.hash.slice(1).toLowerCase(); if (['login', 'pesan', 'status', 'katalog'].indexOf(h) > -1) go(h); });
  muatKatalog(false);
})();
