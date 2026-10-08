/* Authentication, role-based access, and the app shell (sidebar + topbar) */
const USERS = [ // demo accounts (front-end only)
  { username: 'admin',  password: 'admin123',  role: 'admin',  name: 'Administrator' },
  { username: 'renter', password: 'renter123', role: 'renter', name: 'Juan Dela Cruz' }
];
const ICONS = {
  grid: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  monitor: '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>',
  users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
  bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0"/>',
  history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/>',
  sliders: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  check: '<path d="M22 11.1V12a10 10 0 1 1-5.9-9.1M22 4 12 14l-3-3"/>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h8"/>',
  menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
  map: '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>',
  lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  alert: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01"/>',
  archive: '<path d="M21 8v13H3V8M1 3h22v5H1zM10 12h4"/>'
};
const NAV = {
  admin: [['dashboard.html', 'Dashboard', 'grid'], ['tracker.html', 'Rental Tracker', 'clock'], ['gps.html', 'GPS Tracking', 'map'], ['units.html', 'Units / Devices', 'monitor'],
          ['security.html', 'Remote Control', 'lock'], ['renters.html', 'Renters', 'users'], ['logs.html', 'Damage & Tamper Logs', 'alert'],
          ['notifications.html', 'Notifications', 'bell'], ['history.html', 'Rental History', 'history'], ['settings.html', 'Settings', 'sliders']],
  renter: [['dashboard.html', 'Dashboard', 'grid'], ['rental.html', 'My Rental', 'clock'], ['rental.html#details', 'Rental Details', 'file'],
           ['notifications.html', 'Notifications', 'bell'], ['profile.html', 'Profile', 'user']]
};

const Auth = {
  home: { admin: 'admin/dashboard.html', renter: 'renter/dashboard.html' },
  icon: n => `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">${ICONS[n]}</svg>`,
  user() { try { return JSON.parse(sessionStorage.getItem('rs_user') || localStorage.getItem('rs_user')); } catch (e) { return null; } },
  login(name, pass, keep) {
    const u = USERS.find(x => x.username === name.trim().toLowerCase() && x.password === pass);
    if (!u) return null;
    sessionStorage.removeItem('rs_user'); localStorage.removeItem('rs_user');
    (keep ? localStorage : sessionStorage).setItem('rs_user', JSON.stringify({ username: u.username, role: u.role, name: u.name }));
    return u;
  },
  logout() { sessionStorage.removeItem('rs_user'); localStorage.removeItem('rs_user'); location.href = '../login.html'; },
  // ROLE SECURITY: call at the top of every dashboard page.
  // Not logged in -> login. Wrong role (e.g. renter opening an admin page) -> own dashboard.
  guard(role) {
    const u = Auth.user();
    if (!u) { document.documentElement.hidden = true; return location.replace('../login.html'); }
    if (u.role !== role) { document.documentElement.hidden = true; location.replace('../' + Auth.home[u.role]); }
  },
  shell() {
    const b = document.body, role = b.dataset.role, pg = b.dataset.page + '.html', u = Auth.user();
    document.getElementById('app').innerHTML = `<div class="scrim"></div>
    <aside class="side"><div class="brand"><img src="../assets/logo.png" alt="RentSafe"></div>
      <nav>${NAV[role].map(([f, l, i]) => `<a href="${f}"${f === pg ? ' class="on"' : ''}>${Auth.icon(i)}<span>${l}</span>${f === 'notifications.html' ? '<em class="nb" data-nb hidden></em>' : ''}</a>`).join('')}</nav>
      <button class="out" data-act="logout">${Auth.icon('logout')}<span>Logout</span></button></aside>
    <div class="main"><header class="top"><button class="burger" aria-label="Menu">${Auth.icon('menu')}</button><h1>${b.dataset.title}</h1>
      <span class="mini" data-clock="time"></span>
      <div class="bell"><button class="ib" data-bellbtn aria-label="Notifications">${Auth.icon('bell')}<em class="nb" data-nb hidden></em></button><div class="drop" data-drop hidden></div></div>
      <div class="who"><span class="av">${u.name[0]}</span><div><b>${u.name}</b><br><small>${role}</small></div></div></header>
      <main id="page"></main></div>`;
    document.addEventListener('click', e => {
      const t = e.target;
      if (t.closest('.burger')) b.classList.toggle('nav-open');
      else if (t.closest('.scrim') || t.closest('.side a')) b.classList.remove('nav-open');
      const dd = document.querySelector('[data-drop]');
      if (t.closest('[data-bellbtn]')) dd.hidden = !dd.hidden; else if (!t.closest('.drop')) dd.hidden = true;
      if (t.closest('[data-act="logout"]')) Auth.logout();
    });
  }
};

/* ===== Landing + login page behaviour ===== */
document.addEventListener('DOMContentLoaded', () => {
  const lb = document.getElementById('loginBtn');             // landing: fade out then go to login
  if (lb) lb.addEventListener('click', e => { e.preventDefault(); document.getElementById('landing').classList.add('is-leaving'); setTimeout(() => location.href = lb.href, 380); });

  const f = document.getElementById('loginForm');
  if (!f) return;
  const cur = Auth.user(); if (cur) return location.replace(Auth.home[cur.role]); // already signed in
  const $ = id => document.getElementById(id), user = $('username'), pass = $('password'), btn = $('submitBtn');
  const err = (el, m) => { el.closest('.field').classList.toggle('invalid', !!m); $(el.id + 'Error').textContent = m || ''; return !m; };
  $('togglePw').addEventListener('click', () => {
    const s = pass.type === 'password'; pass.type = s ? 'text' : 'password'; $('togglePw').textContent = s ? 'Hide' : 'Show'; pass.focus();
  });
  [user, pass].forEach(el => el.addEventListener('input', () => { err(el, ''); $('formError').hidden = true; }));
  f.addEventListener('submit', e => {
    e.preventDefault();
    const ok = err(user, user.value.trim() ? '' : 'Enter your username.') & err(pass, pass.value ? '' : 'Enter your password.');
    if (!ok) return;
    btn.disabled = true; btn.classList.add('loading'); btn.firstElementChild.textContent = 'Signing in';
    setTimeout(() => {
      const u = Auth.login(user.value, pass.value, $('remember').checked);
      if (u) return location.href = Auth.home[u.role];          // admin -> admin dashboard, renter -> renter dashboard
      btn.disabled = false; btn.classList.remove('loading'); btn.firstElementChild.textContent = 'Login';
      $('formError').hidden = false;
      const c = document.querySelector('.card'); c.classList.remove('shake'); void c.offsetWidth; c.classList.add('shake');
    }, 900);
  });
});
