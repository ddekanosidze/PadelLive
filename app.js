(() => {
'use strict';

/* ---------- helpers ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const store = {
  get(k, d) { try { const v = localStorage.getItem('padelhub.' + k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem('padelhub.' + k, JSON.stringify(v)); } catch { /* private mode */ } }
};
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const clone = o => JSON.parse(JSON.stringify(o));

/* ---------- state ---------- */
const PAGES = ['home', 'tv', 'score', 'bracket', 'ranks', 'profile'];
let streams, matches, bracket, ranks, fav;
let operator = false, scoreFilter = 'all', rankGender = 'men', rankEdit = false, rankQuery = '', bracketEdit = false;
let currentPage = 'home';
let isAdmin = false;

function loadState() {
  streams = store.get('streams', { list: [], layout: 1, slots: [null, null, null, null], active: 0 });
  matches = store.get('matches', null) || defaultMatches();
  bracket = store.get('bracket', null) || defaultBracket(8);
  if (bracket.title === 'PadelHub Open') bracket.title = 'PadelLive Open';
  ranks = store.get('ranks', null) || clone(RANKS_DEFAULT);
  try { localStorage.removeItem('padelhub.profile'); } catch { /* profile is no longer stored */ }
  fav = store.get('fav', []);
}

/* ---------- routing ---------- */
function show(page) {
  if (!PAGES.includes(page)) page = 'home';
  if (currentPage === 'profile' && page !== 'profile') resetProfile();   // wipe on tab change
  currentPage = page;
  PAGES.forEach(p => { $('#page-' + p).hidden = p !== page; });
  $$('#tabs a').forEach(a => a.setAttribute('aria-current', a.dataset.page === page ? 'page' : 'false'));
  renderPage();
  window.scrollTo({ top: 0 });
}
function renderPage() {
  ({ home: renderHome, tv: renderTV, score: renderScore, bracket: renderBracket, ranks: renderRanks, profile: renderProfile })[currentPage]();
}
window.addEventListener('hashchange', () => show(location.hash.slice(1)));

/* ---------- theme ---------- */
function applyTheme(t) { if (t) document.documentElement.dataset.theme = t; }
applyTheme(store.get('theme', null));
$('#theme-btn').addEventListener('click', () => {
  const cur = document.documentElement.dataset.theme ||
    (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
  const next = cur === 'dark' ? 'light' : 'dark';
  applyTheme(next); store.set('theme', next);
});

/* =============================================================
   AUTH — admin (seeded in data.js) + registered users.
   Client-side only: PBKDF2-hashed passwords kept in this browser.
   Login / register / change-password UI lives on the home page only.
   ============================================================= */
const PBKDF2_ITER = 150000, SESSION_MS = 8 * 3600e3, MAX_FAILS = 5, LOCK_MS = 30e3;
let fails = 0, lockUntil = 0, authTab = 'login', authMsg = null, user = null;   // user = { u, role }
const hex = b => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
const newSalt = () => hex(crypto.getRandomValues(new Uint8Array(16)));
async function hashPw(pw, saltHex) {
  if (!globalThis.crypto?.subtle) throw new Error('nocrypto');
  const salt = Uint8Array.from(saltHex.match(/../g).map(h => parseInt(h, 16)));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveBits']);
  return hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: PBKDF2_ITER, hash: 'SHA-256' }, key, 256));
}
const getAdmin = () => store.get('adminpw', null) || DEFAULT_ADMIN;
const getUsers = () => store.get('users', []);
const sameName = (a, b) => a.toLowerCase() === b.toLowerCase();
function findAccount(name) {
  const a = getAdmin();
  if (sameName(a.u, name)) return { ...a, role: 'admin' };
  const u = getUsers().find(x => sameName(x.u, name));
  return u ? { ...u, role: 'user' } : null;
}
function readSession() {
  try { const s = JSON.parse(sessionStorage.getItem('padelhub.session')); return s && s.exp > Date.now() ? s : null; } catch { return null; }
}
const writeSession = u => { try { sessionStorage.setItem('padelhub.session', JSON.stringify({ u, exp: Date.now() + SESSION_MS })); } catch { /* ignore */ } };
const clearSession = () => { try { sessionStorage.removeItem('padelhub.session'); } catch { /* ignore */ } };

function checkSession() {
  const s = readSession(), acc = s && findAccount(s.u);
  user = acc ? { u: acc.u, role: acc.role } : null;
  isAdmin = user?.role === 'admin';
  document.body.classList.toggle('is-admin', isAdmin);
  $('#auth-btn').firstElementChild.textContent = user ? '👤' : '🔐';
  $('#auth-btn-t').textContent = user ? user.u : 'შესვლა';
}
function applyAuth() {
  checkSession();
  if (!isAdmin) { operator = false; bracketEdit = false; rankEdit = false; }
  if ($('#auth-dlg').open) renderAuth();
  if (currentPage === 'tv') renderTVList(); else renderPage();   // don't reload playing iframes
}
/* every admin-only action calls this first; guests get the login dialog from the header */
function need() {
  if (isAdmin) return true;
  authMsg = { err: true, t: user ? 'ამ მოქმედებას მხოლოდ ადმინი ასრულებს.' : 'ამ მოქმედებისთვის შედი ადმინად.' };
  openAuth('login');
  return false;
}
function renderAuth() { $('#auth-body').innerHTML = authCardHTML(); }
function openAuth(tab) {
  if (tab) authTab = tab;
  renderAuth();
  const dlg = $('#auth-dlg');
  if (!dlg.open) dlg.showModal();
  $('#auth-body input')?.focus();
}
const closeAuth = () => { $('#auth-dlg').open && $('#auth-dlg').close(); };
$('#auth-btn').addEventListener('click', () => openAuth(user ? 'login' : authTab === 'register' ? 'register' : 'login'));
$('#auth-dlg').addEventListener('click', e => { if (e.target === e.currentTarget) closeAuth(); });   // backdrop

function authCardHTML() {
  const msg = authMsg; authMsg = null;
  const msgHTML = `<p class="hint ${msg?.err ? 'err' : ''}" role="alert">${esc(msg?.t || '')}</p>`;
  if (user) {
    const pw = authTab === 'pw';
    return `<div class="auth-card">
      <div class="auth-head">
        <div><h3>👤 ${esc(user.u)} <span class="badge ${isAdmin ? 'live' : ''}">${isAdmin ? 'ადმინი' : 'მომხმარებელი'}</span></h3>
          <p class="muted">${isAdmin ? 'ადმინის რეჟიმი ჩართულია — სხვა გვერდებზე გამოჩნდა რედაქტირების, დამატებისა და წაშლის ღილაკები.' : 'შესული ხარ. რედაქტირება მხოლოდ ადმინს შეუძლია.'}</p></div>
        <div class="row gap">
          <button class="btn" data-action="auth-tab" data-t="${pw ? 'login' : 'pw'}">🔑 პაროლის შეცვლა</button>
          <button class="btn danger" data-action="logout">🚪 გასვლა</button>
        </div>
      </div>
      ${pw ? `<form id="pw-form" class="auth-form" autocomplete="off">
        <input name="old" type="password" placeholder="მიმდინარე პაროლი" required autocomplete="current-password">
        <input name="pass" type="password" placeholder="ახალი პაროლი (მინ. 6)" required minlength="6" autocomplete="new-password">
        <input name="pass2" type="password" placeholder="გაიმეორე ახალი პაროლი" required minlength="6" autocomplete="new-password">
        <button class="btn primary" type="submit">შენახვა</button></form>` : ''}
      ${msgHTML}</div>`;
  }
  const reg = authTab === 'register';
  return `<div class="auth-card">
    <div class="auth-head">
      <div><h3>🔐 ავტორიზაცია</h3><p class="muted">შედი ან დარეგისტრირდი.</p></div>
      <div class="seg"><button class="${reg ? '' : 'on'}" data-action="auth-tab" data-t="login">შესვლა</button><button class="${reg ? 'on' : ''}" data-action="auth-tab" data-t="register">რეგისტრაცია</button></div>
    </div>
    ${reg
      ? `<form id="reg-form" class="auth-form" autocomplete="on">
          <input name="user" placeholder="მომხმარებლის სახელი" required minlength="3" maxlength="20" autocomplete="username">
          <input name="pass" type="password" placeholder="პაროლი (მინ. 6)" required minlength="6" autocomplete="new-password">
          <input name="pass2" type="password" placeholder="გაიმეორე პაროლი" required minlength="6" autocomplete="new-password">
          <button class="btn primary" type="submit">რეგისტრაცია</button></form>`
      : `<form id="login-form" class="auth-form" autocomplete="on">
          <input name="user" placeholder="მომხმარებელი" required maxlength="20" autocomplete="username">
          <input name="pass" type="password" placeholder="პაროლი" required autocomplete="current-password">
          <button class="btn primary" type="submit">შესვლა</button></form>`}
    ${msgHTML}</div>`;
}

document.addEventListener('submit', async e => {
  const form = e.target, id = form.id;
  if (!['login-form', 'reg-form', 'pw-form'].includes(id)) return;
  e.preventDefault();
  const fail = t => { authMsg = { err: true, t }; renderAuth(); };
  const btn = $('button[type=submit]', form);
  btn.disabled = true;
  try {
    if (id === 'login-form') {
      if (Date.now() < lockUntil) return fail(`ძალიან ბევრი მცდელობა. სცადე ${Math.ceil((lockUntil - Date.now()) / 1000)} წამში.`);
      const acc = findAccount(form.user.value.trim());
      const ok = acc && acc.hash === await hashPw(form.pass.value, acc.salt);
      if (!ok) {
        if (++fails >= MAX_FAILS) { lockUntil = Date.now() + LOCK_MS; fails = 0; return fail('ძალიან ბევრი მცდელობა. დაელოდე 30 წამს.'); }
        return fail('მომხმარებელი ან პაროლი არასწორია.');
      }
      fails = 0; writeSession(acc.u);
      closeAuth();
    } else if (id === 'reg-form') {
      const name = form.user.value.trim();
      if (!/^[\w.\-ა-ჰ]{3,20}$/u.test(name)) return fail('სახელი: 3-20 სიმბოლო (ასოები, ციფრები, _ . -).');
      if (form.pass.value !== form.pass2.value) return fail('პაროლები არ ემთხვევა.');
      if (findAccount(name)) return fail('ეს სახელი დაკავებულია.');
      const salt = newSalt();
      store.set('users', [...getUsers(), { u: name, salt, hash: await hashPw(form.pass.value, salt) }]);
      writeSession(name);
      closeAuth();
    } else {                                                  // change password
      if (!user) return fail('ჯერ შედი.');
      const acc = findAccount(user.u);
      if (acc.hash !== await hashPw(form.old.value, acc.salt)) return fail('მიმდინარე პაროლი არასწორია.');
      if (form.pass.value !== form.pass2.value) return fail('პაროლები არ ემთხვევა.');
      const salt = newSalt(), hash = await hashPw(form.pass.value, salt);
      if (acc.role === 'admin') store.set('adminpw', { u: acc.u, salt, hash });
      else store.set('users', getUsers().map(x => sameName(x.u, acc.u) ? { ...x, salt, hash } : x));
      authTab = 'login';
      authMsg = { t: 'პაროლი შეიცვალა ✓' };
    }
    applyAuth();
  } catch (ex) {
    fail(ex.message === 'nocrypto' ? 'ბრაუზერში დაშიფვრა მიუწვდომელია. გახსენი საიტი start.bat-ით (localhost).' : 'შეცდომა: ' + ex.message);
  } finally { btn.disabled = false; }
});

/* =============================================================
   LIVE TV
   ============================================================= */
function toEmbed(input) {
  let s = String(input || '').trim();
  const m = s.match(/src\s*=\s*["']([^"']+)["']/i);
  if (m) s = m[1];
  if (s.startsWith('//')) s = 'https:' + s;
  let u;
  try { u = new URL(s); } catch { return { err: 'ბმული არასწორია.' }; }
  if (!/^https?:$/.test(u.protocol)) return { err: 'მხოლოდ http/https ბმულებია დაშვებული.' };
  const h = u.hostname.replace(/^www\./, '').replace(/^m\./, '');
  const yt = id => id ? { url: `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?autoplay=1&mute=1&rel=0` } : { err: 'YouTube ვიდეოს ID ვერ ვიპოვე.' };
  const parent = location.hostname || 'localhost';

  if (h === 'youtu.be') return yt(u.pathname.slice(1));
  if (h.endsWith('youtube.com') || h.endsWith('youtube-nocookie.com')) {
    const p = u.pathname.split('/').filter(Boolean);
    if (u.pathname === '/watch') return yt(u.searchParams.get('v'));
    if (p[0] === 'embed' && p[1] === 'live_stream') return { url: `https://www.youtube-nocookie.com/embed/live_stream?channel=${encodeURIComponent(u.searchParams.get('channel') || '')}&autoplay=1&mute=1` };
    if (['embed', 'live', 'shorts'].includes(p[0])) return yt(p[1]);
    if (p[0] === 'channel' && p[1]) return { url: `https://www.youtube-nocookie.com/embed/live_stream?channel=${encodeURIComponent(p[1])}&autoplay=1&mute=1` };
    return { err: 'არხის @handle ან /c/ ბმული ვერ ჩაიდგმება. გამოიყენე კონკრეტული ვიდეოს/ლაივის ბმული ან youtube.com/channel/UC… ფორმატი.' };
  }
  if (h === 'twitch.tv') {
    const p = u.pathname.split('/').filter(Boolean);
    if (p[0] === 'videos' && p[1]) return { url: `https://player.twitch.tv/?video=${encodeURIComponent(p[1])}&parent=${parent}&autoplay=true&muted=true` };
    if (p[0]) return { url: `https://player.twitch.tv/?channel=${encodeURIComponent(p[0])}&parent=${parent}&autoplay=true&muted=true` };
  }
  if (h === 'player.twitch.tv') { u.searchParams.set('parent', parent); return { url: u.toString() }; }
  if (h === 'vimeo.com') {
    const id = u.pathname.split('/').filter(Boolean)[0];
    if (/^\d+$/.test(id)) return { url: `https://player.vimeo.com/video/${id}?autoplay=1&muted=1` };
  }
  return { url: u.toString() };
}
const embedFor = st => (toEmbed(st.url).url) || '';
const hostOf = url => { try { return new URL(url.match(/src\s*=\s*["']([^"']+)["']/i)?.[1] || url).hostname.replace(/^www\./, ''); } catch { return ''; } };
const saveStreams = () => store.set('streams', streams);

/* phones always show a single player */
const mobileMQ = matchMedia('(max-width: 640px)');
const nSlots = () => mobileMQ.matches ? 1 : streams.layout;
mobileMQ.addEventListener('change', () => { if (currentPage === 'tv') renderTV(); });

function renderTV() {
  renderTVList();
  renderTVSlots();
}
function renderTVList() {
  const playing = new Set(streams.slots.slice(0, nSlots()));
  $('#tv-list').innerHTML = streams.list.length
    ? streams.list.map(s => `
      <li data-action="stream-play" data-id="${s.id}" class="${playing.has(s.id) ? 'playing' : ''}" title="ჩართვა არჩეულ ეკრანში">
        <span>${playing.has(s.id) ? '🔴' : '▶️'}</span>
        <span class="nm"><b>${esc(s.name)}</b><small>${esc(hostOf(s.url))}</small></span>
        ${isAdmin ? `<button data-action="stream-del" data-id="${s.id}" title="წაშლა" aria-label="წაშლა">✕</button>` : ''}
      </li>`).join('')
    : `<li style="cursor:default" class="hint">${isAdmin ? 'ჯერ არცერთი სტრიმი არ გაქვს დამატებული.' : 'ამჟამად ეთერი არ არის.'}</li>`;
  $$('#tv-layout button').forEach(b => b.classList.toggle('on', +b.dataset.n === streams.layout));
  updateDots();
}
function slotHTML(i) {
  const st = streams.list.find(s => s.id === streams.slots[i]);
  return `
    <div class="slot-head" data-action="slot" data-i="${i}">
      <span class="t">${i + 1}. ${st ? esc(st.name) : 'ცარიელი ეკრანი'}</span>
      ${st ? `<button data-action="slot-full" data-i="${i}" title="სრულ ეკრანზე">⛶</button><button data-action="slot-clear" data-i="${i}" title="გამორთვა">✕</button>` : ''}
    </div>
    <div class="slot-body">
      ${st
        ? `<iframe src="${esc(embedFor(st))}" title="${esc(st.name)}" allow="autoplay; fullscreen; picture-in-picture; encrypted-media" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>`
        : `<div class="slot-empty"><div><b>📺</b>აირჩიე სტრიმი სიიდან,<br>რომ აქ ჩაირთოს</div></div>`}
    </div>`;
}
function renderTVSlots() {
  const n = nSlots();
  const act = Math.min(streams.active, n - 1);
  const grid = $('#tv-grid');
  grid.className = 'tv-grid g' + n;
  grid.innerHTML = Array.from({ length: n }, (_, i) =>
    `<div class="slot ${i === act && n > 1 ? 'active' : ''}" id="slot-${i}">${slotHTML(i)}</div>`).join('');
}
function renderTVSlot(i) {
  const el = $('#slot-' + i);
  if (el) el.innerHTML = slotHTML(i);
  renderTVList();
}
function updateDots() {
  $('#tv-dot').hidden = !streams.slots.slice(0, nSlots()).some(Boolean);
  $('#score-dot').hidden = !matches.some(m => m.status === 'live');
}

$('#tv-form').addEventListener('submit', e => {
  e.preventDefault();
  if (!need()) return;
  const f = e.target, msg = $('#tv-msg');
  const r = toEmbed(f.url.value);
  if (r.err) { msg.textContent = r.err; msg.className = 'hint err'; return; }
  const st = { id: 's' + Date.now(), name: f.name.value.trim(), url: f.url.value.trim() };
  streams.list.push(st);
  const free = streams.slots.slice(0, nSlots()).findIndex(x => !x);
  if (free !== -1) { streams.slots[free] = st.id; renderTVSlot(free); }
  saveStreams();
  renderTVList();
  f.reset();
  msg.textContent = 'სტრიმი დაემატა ✓'; msg.className = 'hint';
});

/* =============================================================
   LIVE SCORE (padel scoring engine)
   ============================================================= */
function makeMatch(t1, t2, court) {
  return { id: 'm' + Date.now() + Math.random().toString(36).slice(2, 5), t1, t2, court, status: 'upcoming', sets: [], g: [0, 0], p: [0, 0], tb: false, history: [] };
}
function defaultMatches() {
  const b = (id, t1, t2, court, x) => ({ id, t1, t2, court, status: 'upcoming', sets: [], g: [0, 0], p: [0, 0], tb: false, history: [], ...x });
  return [
    b('m1', 'ბერიძე / კაპანაძე', 'ჯანელიძე / მაისურაძე', 'კორტი 1 · ნახევარფინალი', { status: 'live', sets: [[6, 4]], g: [3, 2], p: [2, 1] }),
    b('m2', 'გელაშვილი / ლომიძე', 'ხუციშვილი / წულაია', 'კორტი 2 · ნახევარფინალი', { status: 'live', sets: [[4, 6], [6, 3]], g: [2, 2], p: [3, 3] }),
    b('m3', 'ქავთარაძე / ბარათაშვილი', 'სვანიძე / ცაავა', 'კორტი 1 · ფინალი', {}),
    b('m4', 'მგალობლიშვილი / დოლიძე', 'აბაშიძე / ჩხეიძე', 'კორტი 3 · ოთხფინალი', { status: 'finished', sets: [[6, 3], [7, 5]] })
  ];
}
const snap = m => JSON.stringify({ sets: m.sets, g: m.g, p: m.p, tb: m.tb, status: m.status });

function endSet(m) {
  m.sets.push([m.g[0], m.g[1]]);
  m.g = [0, 0]; m.p = [0, 0]; m.tb = false;
  if (setsWon(m).some(w => w >= 2)) m.status = 'finished';
}
function setsWon(m) {
  return [m.sets.filter(s => s[0] > s[1]).length, m.sets.filter(s => s[1] > s[0]).length];
}
function addPoint(m, s) {
  if (m.status === 'finished') return;
  m.history.push(snap(m));
  if (m.history.length > 60) m.history.shift();
  m.status = 'live';
  const o = 1 - s;
  m.p[s]++;
  if (m.tb) {                                   // tie-break to 7, win by 2
    if (m.p[s] >= 7 && m.p[s] - m.p[o] >= 2) { m.g[s]++; endSet(m); }
    return;
  }
  if (m.p[s] === 4) {                           // golden point: 40-40 -> next point wins the game
    m.g[s]++; m.p = [0, 0];
    if (m.g[s] >= 6 && m.g[s] - m.g[o] >= 2) endSet(m);
    else if (m.g[0] === 6 && m.g[1] === 6) m.tb = true;
  }
}
function undo(m) {
  const last = m.history.pop();
  if (!last) return;
  Object.assign(m, JSON.parse(last));
}
const ptLabel = (m, i) => m.tb ? String(m.p[i]) : ['0', '15', '30', '40'][m.p[i]];
const saveMatches = () => { store.set('matches', matches); updateDots(); };

function matchCard(m, ops) {
  const won = setsWon(m);
  const win = m.status === 'finished' ? (won[0] > won[1] ? 0 : 1) : -1;
  const badge = m.status === 'live' ? '<span class="badge live">LIVE</span>'
    : m.status === 'finished' ? '<span class="badge done">დასრულდა</span>'
    : '<span class="badge">მალე</span>';
  const rows = [0, 1].map(i => `
    <div class="sb-row ${win === i ? 'win' : ''}">
      <div class="sb-team">${win === i ? '🏆 ' : ''}${esc(i ? m.t2 : m.t1)}</div>
      ${m.status === 'upcoming' ? '' : m.sets.map(s => `<div class="sb-set ${s[i] > s[1 - i] ? 'won' : ''}">${s[i]}</div>`).join('')}
      ${m.status === 'live' ? `<div class="sb-game">${m.g[i]}</div><div class="sb-pt">${ptLabel(m, i)}</div>` : ''}
    </div>`).join('');
  const gold = m.status === 'live' && !m.tb && m.p[0] === 3 && m.p[1] === 3
    ? '<div class="sb-gold">⚡ ოქროს ქულა — შემდეგი ქულა გადამწყვეტია</div>' : '';
  const tb = m.status === 'live' && m.tb ? '<div class="sb-gold">ტაიბრეიკი (7 ქულამდე, 2 ქულის სხვაობით)</div>' : '';
  const controls = ops ? `
    <div class="ops">
      ${m.status !== 'finished' ? `
        <button class="btn primary sm" data-action="point" data-id="${m.id}" data-s="0">+ ${esc(m.t1)}</button>
        <button class="btn primary sm" data-action="point" data-id="${m.id}" data-s="1">+ ${esc(m.t2)}</button>` : ''}
      <button class="btn sm" data-action="undo" data-id="${m.id}" ${m.history.length ? '' : 'disabled'}>↩ უკან</button>
      <select class="mstatus" data-id="${m.id}" style="min-width:0">
        <option value="upcoming" ${m.status === 'upcoming' ? 'selected' : ''}>მალე</option>
        <option value="live" ${m.status === 'live' ? 'selected' : ''}>LIVE</option>
        <option value="finished" ${m.status === 'finished' ? 'selected' : ''}>დასრულდა</option>
      </select>
      <button class="btn sm danger" data-action="mdel" data-id="${m.id}" title="წაშლა">🗑</button>
    </div>` : '';
  return `<article class="card mcard">
    <div class="mhead"><span>${esc(m.court || 'მატჩი')}</span>${badge}</div>
    <div class="sb">${rows}</div>${gold}${tb}${controls}
  </article>`;
}

function renderScore() {
  const ops = operator && isAdmin;
  $('#operator-toggle').checked = ops;
  $('#match-form').hidden = !ops;
  $$('#score-filter button').forEach(b => b.classList.toggle('on', b.dataset.f === scoreFilter));
  const order = { live: 0, upcoming: 1, finished: 2 };
  const list = matches.filter(m => scoreFilter === 'all' || m.status === scoreFilter)
    .sort((a, b) => order[a.status] - order[b.status]);
  $('#score-list').innerHTML = list.length
    ? list.map(m => matchCard(m, ops)).join('')
    : '<div class="card empty" style="grid-column:1/-1"><div class="big-emoji">⚡</div><p>ამ ფილტრით მატჩები არ არის.</p></div>';
}
$('#operator-toggle').addEventListener('change', e => { operator = need() && e.target.checked; renderScore(); });
$('#match-form').addEventListener('submit', e => {
  e.preventDefault();
  if (!need()) return;
  const f = e.target;
  matches.unshift(makeMatch(f.t1.value.trim(), f.t2.value.trim(), f.court.value.trim()));
  saveMatches(); f.reset(); renderScore();
});

/* =============================================================
   BRACKET
   ============================================================= */
const DEMO_NAMES = ['ბერიძე / კაპანაძე', 'ჯანელიძე / მაისურაძე', 'გელაშვილი / ლომიძე', 'ხუციშვილი / წულაია',
  'ქავთარაძე / ბარათაშვილი', 'სვანიძე / ცაავა', 'მგალობლიშვილი / დოლიძე', 'აბაშიძე / ჩხეიძე'];
function defaultBracket(size, old) {
  return {
    title: old?.title || 'PadelLive Open', size,
    names: Array.from({ length: size }, (_, i) => old?.names?.[i] || DEMO_NAMES[i] || `წყვილი ${i + 1}`),
    win: {}
  };
}
const saveBracket = () => store.set('bracket', bracket);
const roundsCount = () => Math.log2(bracket.size);
function teamAt(r, i, s) {
  if (r === 0) return bracket.names[2 * i + s];
  const w = bracket.win[`${r - 1}-${2 * i + s}`];
  return w === undefined ? null : teamAt(r - 1, 2 * i + s, w);
}
function roundName(r) {
  const left = roundsCount() - r;           // 1 = final
  return left === 1 ? 'ფინალი' : left === 2 ? 'ნახევარფინალი' : left === 3 ? 'ოთხფინალი (1/4)' : 'ფინალის 1/8';
}
function renderBracket() {
  const R = roundsCount();
  const editing = bracketEdit && isAdmin;
  $('#bracket-size').value = bracket.size;
  $('#bracket-edit').checked = editing;
  $('#bracket-title-wrap').hidden = !editing;
  $('#bracket-title').value = bracket.title;
  $('#bracket-title-h').textContent = bracket.title;
  let html = '';
  for (let r = 0; r < R; r++) {
    const n = bracket.size / 2 ** (r + 1);
    let ms = '';
    for (let i = 0; i < n; i++) {
      const w = bracket.win[`${r}-${i}`];
      const slots = [0, 1].map(s => {
        const t = teamAt(r, i, s);
        if (r === 0 && editing) {
          return `<div class="bslot"><span class="seed">${2 * i + s + 1}</span><input data-bname="${2 * i + s}" value="${esc(t)}" maxlength="40" aria-label="წყვილი ${2 * i + s + 1}"></div>`;
        }
        if (t === null) return '<div class="bslot tbd"><span class="seed"></span>ელოდება…</div>';
        const cls = w === undefined ? '' : w === s ? 'win' : 'lose';
        return `<div class="bslot ${cls}" ${isAdmin ? `data-action="bpick" data-r="${r}" data-i="${i}" data-s="${s}"` : 'style="cursor:default"'}>
          <span class="seed">${r === 0 ? 2 * i + s + 1 : ''}</span>${esc(t)}${w === s ? ' ✓' : ''}</div>`;
      }).join('');
      ms += `<div class="bm">${slots}</div>`;
    }
    html += `<div class="round"><h4>${roundName(r)}</h4><div class="round-body">${ms}</div></div>`;
  }
  const cw = bracket.win[`${R - 1}-0`];
  const champ = cw === undefined ? null : teamAt(R - 1, 0, cw);
  html += `<div class="round champion"><div class="cup">🏆</div><h4>ჩემპიონი</h4>
    <div class="cn">${champ ? esc(champ) : '—'}</div></div>`;
  $('#bracket').innerHTML = html;
}
function pickWinner(r, i, s) {
  if (!need()) return;
  if (r > 0 && (teamAt(r, i, 0) === null || teamAt(r, i, 1) === null)) return;
  const key = `${r}-${i}`;
  if (bracket.win[key] === s) delete bracket.win[key]; else bracket.win[key] = s;
  // downstream results depend on this one — clear them
  let r2 = r + 1, i2 = i >> 1;
  while (r2 < roundsCount()) { delete bracket.win[`${r2}-${i2}`]; r2++; i2 >>= 1; }
  saveBracket(); renderBracket();
}
$('#bracket-size').addEventListener('change', e => {
  if (!need()) { e.target.value = bracket.size; return; }
  if (!confirm('ბადის ზომის შეცვლისას შედეგები გასუფთავდება. გავაგრძელოთ?')) { e.target.value = bracket.size; return; }
  bracket = defaultBracket(+e.target.value, bracket); saveBracket(); renderBracket();
});
$('#bracket-edit').addEventListener('change', e => { bracketEdit = need() && e.target.checked; renderBracket(); });
$('#bracket-title').addEventListener('input', e => { if (!isAdmin) return; bracket.title = e.target.value || 'ტურნირის ბადე'; $('#bracket-title-h').textContent = bracket.title; saveBracket(); });
$('#bracket').addEventListener('change', e => {
  const inp = e.target.closest('[data-bname]');
  if (!inp || !need()) return;
  bracket.names[+inp.dataset.bname] = inp.value.trim() || `წყვილი ${+inp.dataset.bname + 1}`;
  saveBracket(); renderBracket();
});

/* =============================================================
   RANKINGS
   ============================================================= */
const saveRanks = () => store.set('ranks', ranks);
function renderRanks() {
  const editing = rankEdit && isAdmin;
  $('#rank-edit').checked = editing;
  $('#rank-form').hidden = !editing;
  $$('#rank-gender button').forEach(b => b.classList.toggle('on', b.dataset.g === rankGender));
  const list = ranks[rankGender];
  const q = rankQuery.trim().toLowerCase();
  const rows = list.map((p, idx) => ({ p, idx }))
    .filter(({ p }) => !q || p.n.toLowerCase().includes(q) || (p.c || '').toLowerCase().includes(q));
  $('#rank-body').innerHTML = rows.length ? rows.map(({ p, idx }) => `
    <tr>
      <td><b>${idx + 1}</b></td>
      <td class="pl"><button class="star ${fav.includes(p.n) ? 'on' : ''}" data-action="star" data-n="${esc(p.n)}" title="ფავორიტებში" aria-label="ფავორიტებში">${fav.includes(p.n) ? '★' : '☆'}</button> ${esc(p.n)}</td>
      <td><span class="ctry">${esc(p.c || '—')}</span></td>
      <td class="num">${editing ? `<input type="number" min="0" value="${p.p}" data-rpts="${idx}">` : p.p.toLocaleString('ka-GE')}</td>
      <td class="num">${editing ?`<button class="btn sm danger" data-action="rdel" data-i="${idx}">🗑</button>` : ''}</td>
    </tr>`).join('')
    : '<tr><td colspan="5" class="empty">მოთამაშე ვერ მოიძებნა.</td></tr>';
}
$('#rank-search').addEventListener('input', e => { rankQuery = e.target.value; renderRanks(); });
$('#rank-edit').addEventListener('change', e => { rankEdit = need() && e.target.checked; renderRanks(); });
$('#rank-form').addEventListener('submit', e => {
  e.preventDefault();
  if (!need()) return;
  const f = e.target;
  ranks[rankGender].push({ n: f.n.value.trim(), c: f.c.value.trim().toUpperCase(), p: +f.p.value || 0 });
  ranks[rankGender].sort((a, b) => b.p - a.p);
  saveRanks(); f.reset(); renderRanks();
});
$('#rank-body').addEventListener('change', e => {
  const inp = e.target.closest('[data-rpts]');
  if (!inp || !need()) return;
  ranks[rankGender][+inp.dataset.rpts].p = Math.max(0, +inp.value || 0);
  ranks[rankGender].sort((a, b) => b.p - a.p);
  saveRanks(); renderRanks();
});

/* =============================================================
   HOME
   ============================================================= */
function renderHome() {
  const live = matches.filter(m => m.status === 'live');
  const top = g => ranks[g].slice(0, 5).map((p, i) =>
    `<li><span class="pos">${i + 1}</span><span><b>${esc(p.n)}</b> <span class="ctry">${esc(p.c)}</span></span><span class="pts">${p.p.toLocaleString('ka-GE')}</span></li>`).join('');
  const fmt = off => {
    const d = new Date(Date.now() + off * 864e5);
    return { d: d.getDate(), m: d.toLocaleDateString('ka-GE', { month: 'short' }) };
  };
  const favs = fav.length ? `<div class="card" style="margin-top:16px"><h3>⭐ ჩემი ფავორიტები</h3>${fav.map(n => `<span class="fav-chip">${esc(n)}</span>`).join('')}</div>` : '';
  $('#page-home').innerHTML = `
    <div class="hero">
      <span class="badge live" style="background:rgba(255,255,255,.12);color:#fff">${live.length ? live.length + ' მატჩი ახლა LIVE-ია' : 'PadelLive'}</span>
      <h1 style="margin-top:12px">პადელი — ყველაფერი <em>ერთ ადგილას</em></h1>
      <p>უყურე პირდაპირ ეთერს, თვალი ადევნე ქულებს რეალურ დროში, გაყევი ტურნირის ბადეს და იპოვე შენთვის იდეალური ჩოგანი.</p>
      <div class="btns">
        <a class="btn primary" href="#tv">📺 ჩართე Live TV</a>
        <a class="btn" href="#score">⚡ Live Score</a>
        <a class="btn" href="#profile">🎾 მირჩიე ჩოგანი</a>
      </div>
    </div>

    <div class="stats">
      <div class="stat"><b>${live.length}</b><span>LIVE მატჩი</span></div>
      <div class="stat"><b>${streams.list.length}</b><span>დამატებული სტრიმი</span></div>
      <div class="stat"><b>${bracket.size}</b><span>წყვილი ბადეში</span></div>
      <div class="stat"><b>${ranks.men.length + ranks.women.length}</b><span>მოთამაშე რეიტინგში</span></div>
    </div>

    <div class="section-title"><h2>⚡ ახლა თამაშობენ</h2><a href="#score">ყველა მატჩი →</a></div>
    <div class="match-grid">${live.length ? live.slice(0, 3).map(m => matchCard(m, false)).join('') : '<div class="card empty" style="grid-column:1/-1">ამჟამად LIVE მატჩი არ არის.</div>'}</div>
    ${favs}

    <div class="cols">
      <div class="card">
        <div class="section-title" style="margin-top:0"><h3>🏆 TOP 5 — მამაკაცები</h3><a href="#ranks">სრული →</a></div>
        <ol class="mini-rank">${top('men')}</ol>
      </div>
      <div class="card">
        <div class="section-title" style="margin-top:0"><h3>🏆 TOP 5 — ქალები</h3><a href="#ranks">სრული →</a></div>
        <ol class="mini-rank">${top('women')}</ol>
      </div>
    </div>

    <div class="cols even">
      <div class="card">
        <h3>📅 უახლოესი ტურნირები <span class="badge">დემო</span></h3>
        ${EVENTS.map(ev => { const f = fmt(ev.off); return `
          <div class="event"><div class="date"><b>${f.d}</b><small>${f.m}</small></div>
          <div><b>${esc(ev.t)}</b><div class="muted">${esc(ev.place)} · ${esc(ev.lvl)}</div></div></div>`; }).join('')}
      </div>
      <div class="card">
        <h3>📖 პადელის ლექსიკონი</h3>
        ${GLOSSARY.map(g => `<p><b>${esc(g.t)}</b> — <span class="muted">${esc(g.d)}</span></p>`).join('')}
      </div>
    </div>

    <div class="section-title"><h2>პადელი 60 წამში</h2></div>
    <div class="cards-3">${RULES.map(r => `<div class="rule"><i>${r.i}</i><h4>${esc(r.t)}</h4><p>${esc(r.d)}</p></div>`).join('')}</div>

    <div class="card cta-racket">
      <div><h2>რომელი ჩოგანი გერგება?</h2><p class="muted">მიუთითე სიმაღლე, წონა, წამყვანი ხელი და თამაშის სტილი — შეგირჩევ 3 საუკეთესო ვარიანტს.</p></div>
      <a class="btn primary big" href="#profile">დავიწყოთ →</a>
    </div>`;
}

/* =============================================================
   PROFILE + RACKET RECOMMENDER
   ============================================================= */
const SH = ['round', 'teardrop', 'diamond'], BA = ['low', 'mid', 'high'], HA = ['soft', 'medium', 'hard'];
const L = {
  shape: { round: 'მრგვალი', teardrop: 'ცრემლისებური', diamond: 'რომბისებური' },
  bal: { low: 'დაბალი', mid: 'საშუალო', high: 'მაღალი' },
  hard: { soft: 'რბილი', medium: 'საშუალო', hard: 'მაგარი' },
  level: { beginner: 'დამწყები', intermediate: 'საშუალო', advanced: 'მოწინავე' },
  style: { attack: 'შეტევითი', allround: 'უნივერსალური', defense: 'დაცვითი' },
  hand: { right: 'მარჯვენა', left: 'მარცხენა' },
  side: { both: 'ორივე მხარე', drive: 'Drive (მარჯვენა)', reves: 'Revés (მარცხენა)' }
};
const LV = { beginner: 1, intermediate: 2, advanced: 3 };

function readProfile(f) {
  return {
    name: f.name.value.trim(), gender: f.gender.value, age: +f.age.value, height: +f.height.value, weight: +f.weight.value,
    hand: f.hand.value, side: f.side.value, level: f.level.value, style: f.style.value, freq: f.freq.value, budget: +f.budget.value,
    inj: $$('input[name=inj]:checked', f).map(i => i.value)
  };
}

function idealSpec(p) {
  const lv = LV[p.level];
  const hurt = p.inj.some(x => ['elbow', 'shoulder', 'wrist'].includes(x));
  let shape = p.style === 'attack' ? 2 : p.style === 'allround' ? 1 : 0;
  let bal = shape;
  let hard = lv === 1 ? 0 : (p.style === 'attack' && lv === 3 ? 2 : 1);
  if (lv === 1) { shape = 0; bal = 0; }
  if (p.age >= 50) { hard = Math.min(hard, 1); bal = Math.min(bal, 1); }
  if (hurt) { shape = Math.min(shape, 1); bal = 0; hard = p.inj.includes('elbow') ? 0 : Math.min(hard, 1); }
  const f = p.gender === 'f';
  let w = (f ? 345 : 362) + (p.height - (f ? 165 : 178)) * (f ? 0.2 : 0.25) + (p.weight - (f ? 62 : 78)) * 0.08;
  if (lv === 1) w -= 5;
  if (p.age >= 55) w -= 6;
  if (hurt) w -= 6;
  if (p.freq === 'often') w += 2;
  w = clamp(Math.round(w), 335, 368);
  return { shape, bal, hard, w, hurt, lv };
}

function scoreRacket(r, p, T) {
  let s = 60;
  s += [18, 4, -12][Math.abs(SH.indexOf(r.shape) - T.shape)];
  s += [14, 2, -10][Math.abs(BA.indexOf(r.bal) - T.bal)];
  s += [6, 0, -8][Math.abs(HA.indexOf(r.hard) - T.hard)];
  s += 14 - Math.min(Math.abs(r.w - T.w) * 1.4, 26);
  if (r.lvl > T.lv) s -= (r.lvl - T.lv) * 16;
  if (r.lvl < T.lv) s -= 3 * (T.lv - r.lvl);
  if (r.price > p.budget) s -= (r.price - p.budget) * 10;
  if (T.hurt && r.hard === 'hard') s -= 14;
  return clamp(Math.round(s / 112 * 100), 5, 99);
}

function reasons(r, p, T) {
  const out = [];
  const shapeWhy = {
    round: 'მრგვალი ფორმა — დიდი „sweet spot“ და მაქსიმალური კონტროლი',
    teardrop: 'ცრემლისებური ფორმა — ძალისა და კონტროლის ბალანსი',
    diamond: 'რომბისებური ფორმა — მაქსიმალური ძალა სმეშებისა და ბადისთან თამაშისთვის'
  };
  if (SH.indexOf(r.shape) === T.shape) out.push('✓ ' + shapeWhy[r.shape] + ` (${L.style[p.style]} სტილისთვის)`);
  const balWhy = { low: 'დაბალი ბალანსი — მსუბუქი მართვა, ნაკლები დატვირთვა ხელზე', mid: 'საშუალო ბალანსი — უნივერსალური შეგრძნება', high: 'მაღალი ბალანსი — მეტი ძალა დარტყმაზე' };
  if (BA.indexOf(r.bal) === T.bal) out.push('✓ ' + balWhy[r.bal]);
  const dw = r.w - T.w;
  if (Math.abs(dw) <= 6) out.push(`✓ წონა ~${r.w} გ — შენი იდეალური ~${T.w} გ-ის გვერდითაა`);
  else if (dw > 6) out.push(`⚠ ~${r.w} გ შენთვის ცოტა მძიმეა (იდეალური ~${T.w} გ) — დაღლას შეიძლება გრძნობდე`);
  else out.push(`⚠ ~${r.w} გ შენთვის მსუბუქია (იდეალური ~${T.w} გ) — ნაკლები სტაბილურობა დარტყმაზე`);
  if (T.hurt && r.hard !== 'hard') out.push('✓ არ არის მკაცრი ჩარჩო — ვიბრაცია ნაკლებად გადადის ხელზე');
  if (T.hurt && r.hard === 'hard') out.push('⚠ მაგარი ჩარჩო ტრავმისას არ არის რეკომენდებული');
  if (r.lvl > T.lv) out.push('⚠ ამ ჩოგანს უფრო მაღალი დონე სჭირდება — პატიება შეცდომებს ნაკლებად ახასიათებს');
  if (r.price > p.budget) out.push('⚠ ბიუჯეტზე ძვირია');
  out.push('ℹ ' + r.note);
  return out;
}

function tipsFor(p, T) {
  const t = [];
  if (p.hand === 'left') t.push('მემარცხენეს ხშირად Drive (მარჯვენა) მხარეს ათამაშებენ, რომ წყვილს ორივე ფორხენდი შუაში ჰქონდეს — სცადე ორივე პოზიცია.');
  if (p.side === 'drive') t.push('Drive მხარეს სტაბილურობა და სწრაფი რეაქცია უფრო მნიშვნელოვანია — ეს ხშირად უფრო დაბალანსებული ჩოგნის არჩევას გულისხმობს.');
  if (p.side === 'reves') t.push('Revés მხარეს ძლიერი ბექჰენდი და ბანდეხა გჭირდება — ძალის ჩოგანი აქ უფრო გამართლებულია.');
  if (p.height >= 185) t.push('მაღალი ტანი უპირატესობას გაძლევს სერვასა და სმეშებში — გამოიყენე ბადესთან თამაში.');
  if (p.height <= 165) t.push('ლობები (globo) და სწრაფი ფეხები შენი იარაღია — სიმაღლის ნაკლს ტაქტიკით ანაზღაურებ.');
  if (T.hurt) t.push('ტკივილის შემთხვევაში ჯერ ექიმს ან ფიზიოთერაპევტს მიმართე; რბილი ჩოგანი ტკივილს არ მკურნალობს, მხოლოდ ამცირებს ვიბრაციას.');
  if (p.age >= 45) t.push('ყოველთვის გაიმართე 10 წუთი — თბობა ტრავმების რისკს მკვეთრად ამცირებს.');
  if (p.freq === 'often') t.push('კვირაში 3+ თამაშზე ჩოგანი სწრაფად ცვდება (3-6 თვე) — კარგია სათადარიგოს ქონა.');
  t.push('იყიდე პადელის სპეციალური ფეხსაცმელი (ქვიშიანი/ქაოტური ტერფით) და სახელურზე overgrip.');
  t.push('ჩოგნის ყიდვამდე სცადე დემო-ჩოგანი კლუბში — შეგრძნება ცხრილზე მნიშვნელოვანია.');
  return t;
}

function renderResult(p) {
  const T = idealSpec(p);
  const list = RACKETS.map(r => ({ r, s: scoreRacket(r, p, T) })).sort((a, b) => b.s - a.s).slice(0, 3);
  const medals = ['🥇', '🥈', '🥉'];
  const name = p.name ? esc(p.name) : 'მოთამაშე';
  $('#profile-result').innerHTML = `
    <div class="card">
      <h2>👤 ${name} — შენი პროფილი</h2>
      <div class="summary">
        <span class="pill">სიმაღლე <b>${p.height} სმ</b></span>
        <span class="pill">წონა <b>${p.weight} კგ</b></span>
        <span class="pill">ასაკი <b>${p.age}</b></span>
        <span class="pill">ხელი <b>${L.hand[p.hand]}</b></span>
        <span class="pill">პოზიცია <b>${L.side[p.side]}</b></span>
        <span class="pill">დონე <b>${L.level[p.level]}</b></span>
        <span class="pill">სტილი <b>${L.style[p.style]}</b></span>
      </div>
      <p style="margin-top:14px"><b>შენი იდეალური ჩოგანი:</b>
        ${L.shape[SH[T.shape]]} ფორმა · ${L.bal[BA[T.bal]]} ბალანსი · ${L.hard[HA[T.hard]]} ჩარჩო ·
        წონა ~${T.w - 5}-${T.w + 5} გ</p>
    </div>
    ${list.map(({ r, s }, i) => `
      <article class="card rk ${i === 0 ? 'top' : ''}">
        <span class="medal">${medals[i]}</span>
        <div class="score-ring" style="--v:${s}"><span>${s}%</span></div>
        <div>
          <h3>${esc(r.name)}</h3>
          <div class="muted">${esc(r.brand)}</div>
          <div class="specs">
            <span class="pill">ფორმა: <b>${L.shape[r.shape]}</b></span>
            <span class="pill">ბალანსი: <b>${L.bal[r.bal]}</b></span>
            <span class="pill">წონა: <b>~${r.w} გ</b></span>
            <span class="pill">ჩარჩო: <b>${L.hard[r.hard]}</b></span>
            <span class="pill">${'€'.repeat(r.price)}</span>
          </div>
          <ul>${reasons(r, p, T).map(x => `<li>${esc(x)}</li>`).join('')}</ul>
        </div>
      </article>`).join('')}
    <div class="card">
      <h3>💡 რჩევები</h3>
      <ul class="tips">${tipsFor(p, T).map(x => `<li>${esc(x)}</li>`).join('')}</ul>
      <p class="hint">ჩოგნის მახასიათებლები დაახლოებითია და მწარმოებლის ახალ მოდელებთან შეიძლება განსხვავდებოდეს — გადაამოწმე ოფიციალურ საიტზე.</p>
    </div>`;
}
/* The profile form is never saved: it starts empty and is wiped again whenever the user switches tabs. */
const PROFILE_EMPTY = $('#profile-result').innerHTML;
function resetProfile() {
  $('#profile-form').reset();
  $('#profile-result').innerHTML = PROFILE_EMPTY;
}
function renderProfile() { /* nothing to restore — see resetProfile() */ }
$('#profile-form').addEventListener('submit', e => {
  e.preventDefault();
  renderResult(readProfile(e.target));
  if (matchMedia('(max-width: 980px)').matches) $('#profile-result').scrollIntoView({ behavior: 'smooth' });
});

/* =============================================================
   global click / change delegation
   ============================================================= */
const ADMIN_ACTIONS = new Set(['stream-del', 'point', 'undo', 'mdel', 'bracket-reset', 'rdel']);
document.addEventListener('click', e => {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const d = el.dataset;
  if (ADMIN_ACTIONS.has(d.action) && !need()) return;
  switch (d.action) {
    case 'layout':
      streams.layout = +d.n; saveStreams(); renderTVList(); renderTVSlots(); break;
    case 'slot':
      streams.active = +d.i; saveStreams();
      $$('.slot').forEach((s, i) => s.classList.toggle('active', i === streams.active && nSlots() > 1));
      break;
    case 'slot-full': {
      const body = $('#slot-' + d.i + ' .slot-body');
      (body.requestFullscreen || body.webkitRequestFullscreen)?.call(body);
      break;
    }
    case 'slot-clear':
      streams.slots[+d.i] = null; saveStreams(); renderTVSlot(+d.i); break;
    case 'stream-play': {
      const i = streams.active;
      streams.slots[i] = d.id;
      const next = streams.slots.slice(0, nSlots()).findIndex((x, k) => !x && k !== i);
      saveStreams(); renderTVSlot(i);
      if (next !== -1 && nSlots() > 1) {
        streams.active = next; saveStreams();
        $$('.slot').forEach((s, k) => s.classList.toggle('active', k === next));
      }
      break;
    }
    case 'stream-del':
      e.stopPropagation();
      streams.list = streams.list.filter(s => s.id !== d.id);
      streams.slots = streams.slots.map(x => x === d.id ? null : x);
      saveStreams(); renderTV(); break;
    case 'auth-tab': authTab = d.t; renderAuth(); break;
    case 'auth-close': closeAuth(); break;
    case 'logout': clearSession(); authTab = 'login'; closeAuth(); applyAuth(); break;
    case 'sfilter': scoreFilter = d.f; renderScore(); break;
    case 'point': { const m = matches.find(x => x.id === d.id); if (m) { addPoint(m, +d.s); saveMatches(); renderScore(); } break; }
    case 'undo': { const m = matches.find(x => x.id === d.id); if (m) { undo(m); saveMatches(); renderScore(); } break; }
    case 'mdel':
      if (confirm('წავშალო მატჩი?')) { matches = matches.filter(x => x.id !== d.id); saveMatches(); renderScore(); }
      break;
    case 'bpick': pickWinner(+d.r, +d.i, +d.s); break;
    case 'bracket-reset':
      if (confirm('გავასუფთავო ყველა შედეგი?')) { bracket.win = {}; saveBracket(); renderBracket(); }
      break;
    case 'rgender': rankGender = d.g; renderRanks(); break;
    case 'star':
      fav = fav.includes(d.n) ? fav.filter(x => x !== d.n) : [...fav, d.n];
      store.set('fav', fav); renderRanks(); break;
    case 'rdel':
      if (confirm('წავშალო მოთამაშე?')) { ranks[rankGender].splice(+d.i, 1); saveRanks(); renderRanks(); }
      break;
  }
});
document.addEventListener('change', e => {
  const sel = e.target.closest('.mstatus');
  if (!sel || !need()) return;
  const m = matches.find(x => x.id === sel.dataset.id);
  if (m) { m.status = sel.value; saveMatches(); renderScore(); }
});

/* sync between browser tabs (e.g. operator in one tab, public view in another) */
window.addEventListener('storage', e => {
  if (!e.key || !e.key.startsWith('padelhub.')) return;
  const keep = streams;
  loadState();
  checkSession();
  document.body.classList.toggle('is-admin', isAdmin);
  if (currentPage === 'tv') streams = keep;       // do not reload playing iframes
  updateDots();
  if (currentPage !== 'tv') show(currentPage);
});

/* ---------- init ---------- */
loadState();
updateDots();
checkSession();
show(location.hash.slice(1) || 'home');
})();
