/* Rental data, countdowns, security features (lock, GPS, wipe, logs) and page rendering */
const App = (() => {
  const KEY = 'rs_data2', M = 6e4, C = Clock, $ = s => document.querySelector(s);
  const BASE = { lat: 14.676, lng: 121.0437 }, RADIUS = 0.8;   // main depot + safe-zone radius (km)
  let D; try { D = JSON.parse(localStorage.getItem(KEY)); } catch (e) {}
  if (!D) { // first run: sample data. Start times are relative to "now" so timers are live
    const n = Date.now(), R = (renter, ago, dur) => ({ renter, start: n - ago * M, dur, f: [] });
    const off = [[.001, -.0008], [-.0012, .0015], [0, 0], [.002, .001], [.0035, .006]];
    D = { soon: 15, autoLock: true, wipeReturn: true, wipeOver: 60,
      renters: [['Juan Dela Cruz', 'renter', '0917 555 0101'], ['Maria Santos', 'maria', '0917 555 0102'], ['Pedro Reyes', 'pedro', '0917 555 0103'], ['Ana Lopez', 'ana', '0917 555 0104'], ['Carlo Mendoza', 'carlo', '0917 555 0105']].map(([name, username, phone]) => ({ name, username, phone })),
      units: [['Juan Dela Cruz', 75, 120], ['Maria Santos', 45, 60], null, ['Pedro Reyes', 10, 180], ['Ana Lopez', 70, 60]].map((x, i) => ({ id: 'Unit 0' + (i + 1), name: 'Device 0' + (i + 1), r: x && R(...x), lock: 'unlocked', wipe: null, gf: false, gps: { lat: BASE.lat + off[i][0], lng: BASE.lng + off[i][1] } })),
      history: [['Carlo Mendoza', 'Device 03', 300, 120], ['Maria Santos', 'Device 01', 500, 60], ['Pedro Reyes', 'Device 02', 700, 90]].map(([renter, unit, ago, dur]) => ({ renter, unit, start: n - ago * M, end: n - (ago - dur) * M, dur })),
      logs: [{ t: n - 240 * M, unit: 'Device 02', type: 'damage', text: 'Cracked screen: found on return', by: 'Administrator' }, { t: n - 200 * M, unit: 'Device 03', type: 'wipe', text: 'Data privacy wipe after rental', by: 'System' }] };
  }
  const save = () => localStorage.setItem(KEY, JSON.stringify(D));
  const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const rem = r => r.start + r.dur * M - Date.now();
  const end = r => r.start + r.dur * M;
  const stat = u => !u.r ? 'available' : rem(u.r) <= 0 ? 'expired' : rem(u.r) <= D.soon * M ? 'soon' : 'active';
  const wstate = u => !u.wipe ? 'none' : Date.now() - u.wipe.t < 8000 ? 'wiping' : 'wiped';
  const unit = id => D.units.find(x => x.id === id);
  const B = { available: ['Available', 'green'], active: ['Active', 'blue'], soon: ['Ending Soon', 'amber'], expired: ['Expired', 'red'] };
  const badge = s => `<span class="badge ${B[s][1]}">${B[s][0]}</span>`;
  const lockBadge = u => `<span class="badge ${u.lock === 'locked' ? 'red' : 'green'}">${u.lock === 'locked' ? 'Locked' : 'Unlocked'}</span>`;
  const cd = u => `<b class="cd" data-cd="${u.id}">${C.hms(rem(u.r))}</b>`;
  const exp = u => stat(u) === 'expired' ? `<small class="exp">TIME EXPIRED</small><small class="od">Overdue +<span data-od="${u.id}">${C.hms(-rem(u.r))}</span></small>` : '';
  const kv = a => `<div class="kv">${a.map(([l, v]) => `<div><small>${l}</small><span>${v}</span></div>`).join('')}</div>`;
  const table = (h, rows) => `<div class="panel tw"><table><thead><tr>${h.map(x => `<th>${x}</th>`).join('')}</tr></thead><tbody>${rows.length ? rows.map(r => `<tr>${r.map((c, i) => `<td data-label="${h[i]}">${c}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${h.length}" class="empty">Nothing to show yet.</td></tr>`}</tbody></table></div>`;
  const clockBox = () => '<div class="clockbox"><div><small>CURRENT TIME</small><div class="big" data-clock="time"></div><div data-clock="date"></div></div></div>';
  const mine = () => { const u = Auth.user(); return D.units.find(x => x.r && x.r.renter === u.name); };
  const none = () => '<div class="panel empty">You have no active rental right now.</div>';
  const log = (type, unit, text, by = 'System') => { D.logs.unshift({ t: Date.now(), type, unit, text, by }); if (D.logs.length > 200) D.logs.length = 200; };

  // ---- GPS helpers (simulated feed) ----
  const km = g => { const dx = (g.lng - BASE.lng) * 111.32 * Math.cos(BASE.lat * Math.PI / 180), dy = (g.lat - BASE.lat) * 110.57; return { dx, dy, d: Math.hypot(dx, dy) }; };
  const pos = g => { const k = km(g), cl = v => Math.min(96, Math.max(4, v)); return `left:${cl(50 + k.dx / 2.2 * 100)}%;top:${cl(50 - k.dy / 2.2 * 100)}%`; };
  const paintGps = () => D.units.forEach(u => {
    const g = u.gps, q = a => document.querySelectorAll(`[${a}="${u.id}"]`);
    q('data-pin').forEach(e => e.style.cssText = pos(g));
    q('data-gps').forEach(e => e.textContent = g.lat.toFixed(5) + ', ' + g.lng.toFixed(5));
    q('data-dist').forEach(e => e.textContent = km(g).d.toFixed(2) + ' km');
    q('data-gl').forEach(e => e.href = `https://www.google.com/maps?q=${g.lat},${g.lng}`);
  });

  // ---- security actions ----
  const lockU = (u, why, by) => { if (u.lock === 'locked') return; u.lock = 'locked'; log('lock', u.name, why, by); save();
    Notify.push('admin', 'Device Locked', `${u.name}: ${why}`); if (u.r) Notify.push('renter', 'Your device has been locked.', `${u.name}: ${why}`, u.r.renter); };
  const unlockU = (u, why, by) => { if (u.lock !== 'locked') return; u.lock = 'unlocked'; log('unlock', u.name, why, by); save();
    Notify.push('admin', 'Device Unlocked', `${u.name}: ${why}`); if (u.r) Notify.push('renter', 'Your device has been unlocked.', u.name, u.r.renter); };
  const wipeU = (u, why, by) => { u.wipe = { t: Date.now() }; log('wipe', u.name, why, by); save(); Notify.push('admin', 'Data Wipe Started', `${u.name}: ${why}`); };
  const start = (id, renter, dur) => {
    const u = unit(id); u.r = { renter, start: Date.now(), dur, f: [] }; u.wipe = null; save(); unlockU(u, 'New rental started', 'System');
    Notify.push('admin', 'Rental Started', `${renter} started renting ${u.name}.`);
    Notify.push('renter', 'Your rental has started.', `${u.name} for ${C.dur(dur)}.`, renter);
  };
  const finish = id => {
    const u = unit(id), r = u.r;
    D.history.unshift({ renter: r.renter, unit: u.name, start: r.start, end: Date.now(), dur: r.dur });
    u.r = null; u.gf = false; u.gps = { lat: BASE.lat, lng: BASE.lng };
    if (D.wipeReturn) wipeU(u, 'Data privacy wipe after rental', 'System');
    u.lock = 'unlocked'; save();
    Notify.push('admin', 'Rental Completed', `${r.renter}'s rental for ${u.name} is completed.`);
    Notify.push('admin', 'Unit Available', `${u.name} is now available.`);
  };
  // Runs every second: one-time alerts (15 min, 5 min, expired), auto-lock, overdue warnings, auto-wipe
  const check = u => {
    const r = u.r; if (!r) return; const m = rem(r), f = r.f, N = Notify.push, over = -m;
    if (m <= 0 && !f.includes('x')) { f.push('x', '5', '15'); save();
      N('admin', 'Rental Time Expired', `${r.renter}'s rental for ${u.name} has expired.`); N('renter', 'Your rental time has expired.', u.name, r.renter);
      if (D.autoLock) lockU(u, 'Auto-locked: rental time expired', 'System'); }
    else if (m > 0 && m <= 5 * M && !f.includes('5')) { f.push('5', '15'); save();
      N('admin', 'Rental Ending Soon', `${r.renter}'s rental for ${u.name} will end in ${Math.ceil(m / M)} minutes.`); N('renter', 'Your rental will end in 5 minutes.', u.name, r.renter); }
    else if (m > 5 * M && m <= 15 * M && !f.includes('15')) { f.push('15'); save();
      N('admin', 'Rental Ending Soon', `${r.renter}'s rental for ${u.name} will end in ${Math.ceil(m / M)} minutes.`); N('renter', 'Your rental will end in 15 minutes.', u.name, r.renter); }
    if (over >= 10 * M && !f.includes('o10')) { f.push('o10'); save(); log('overdue', u.name, `Overdue warning sent to ${r.renter} (${Math.floor(over / M)} min)`);
      N('admin', 'Overdue Warning', `${r.renter} has not returned ${u.name} (overdue ${Math.floor(over / M)} min).`); N('renter', 'Warning: please return the device.', `${u.name} is overdue. Return it immediately.`, r.renter); }
    if (over >= 30 * M && !f.includes('o30')) { f.push('o30'); save(); log('overdue', u.name, `Critical overdue: final warning sent to ${r.renter}`);
      N('admin', 'Critical Overdue', `${u.name} is ${Math.floor(over / M)} min overdue (${r.renter}).`); N('renter', 'Final warning: device overdue.', `${u.name} must be returned now.`, r.renter); }
    if (D.wipeOver > 0 && over >= D.wipeOver * M && !u.wipe) wipeU(u, `Auto-wipe: overdue more than ${D.wipeOver} min`, 'System');
  };
  // Simulated GPS movement + geofence check (admin tab)
  const move = () => {
    D.units.forEach(u => { if (!u.r) return; const g = u.gps, e = stat(u) === 'expired';
      g.lat += (Math.random() - .5) * 8e-5 + (e ? 4e-5 : 0); g.lng += (Math.random() - .5) * 8e-5 + (e ? 5e-5 : 0);
      const d = km(g).d;
      if (d > RADIUS && !u.gf) { u.gf = true; log('geofence', u.name, `Left the safe zone (${d.toFixed(2)} km from depot)`);
        Notify.push('admin', 'Geofence Alert', `${u.name} left the ${RADIUS} km safe zone.`); if (D.autoLock) lockU(u, 'Auto-locked: left safe zone', 'System'); }
      else if (d <= RADIUS) u.gf = false; });
    save(); paintGps();
  };

  // ---- reusable blocks ----
  const warn = u => { const s = stat(u);
    return (s === 'expired' ? `<div class="warn">${Auth.icon('alert')}<div><b>Rental time expired. Please return the device now.</b><br>Overdue: <span data-od="${u.id}">${C.hms(-rem(u.r))}</span></div></div>`
      : s === 'soon' ? `<div class="warn amber">${Auth.icon('bell')}<div><b>Your rental ends soon.</b><br>Please prepare to return the device.</div></div>` : '')
      + (u.lock === 'locked' ? `<div class="warn">${Auth.icon('lock')}<div><b>This device is locked.</b><br>Return it or request an unlock from the admin.</div></div>` : ''); };
  const rcard = u => { const r = u.r, s = stat(u);
    return `<article class="panel rc ${s}"><header><div><h3>${r.renter}</h3><p>${u.name}</p></div>${badge(s)}</header>
    <div class="timer sm">${cd(u)}${exp(u)}</div>${kv([['Start Time', C.t(r.start)], ['Duration', C.dur(r.dur)], ['Current Time', '<span data-clock="short"></span>'], ['End Time', C.t(end(r))], ['Device Lock', lockBadge(u)]])}</article>`; };
  const hero = u => { const s = stat(u), r = u.r;
    return `<div class="panel hero ${s}"><div class="label">CURRENT RENTAL</div><h2>${u.name}</h2><div class="label">TIME REMAINING</div>
    <div class="timer">${cd(u)}</div>${exp(u)}<div style="margin:.75rem 0">${badge(s)} ${lockBadge(u)}</div>
    <div class="acts c">${u.lock === 'locked' ? '<button class="btn sm" data-act="req">Request Unlock</button>' : ''}<button class="btn sm ghost" data-act="report">Report Damage</button></div>
    ${kv([['Unit', u.name], ['Started', C.t(r.start)], ['Duration', C.dur(r.dur)], ['Current Time', '<span data-clock="short"></span>'], ['Ends', C.t(end(r))]])}</div>`; };
  let lf = 'all';

  // ---- pages: P[role][page]() returns HTML ----
  const P = {
    admin: {
      dashboard() {
        const us = D.units, c = s => us.filter(u => stat(u) === s).length, act = us.filter(u => ['active', 'soon'].includes(stat(u))), od = us.filter(u => stat(u) === 'expired');
        return clockBox() + (od.length ? `<div class="warn">${Auth.icon('alert')}<div><b>${od.length} overdue rental${od.length > 1 ? 's' : ''}</b><br>${od.map(u => `${u.r.renter} (${u.name}) +<b data-od="${u.id}">${C.hms(-rem(u.r))}</b>`).join(' &nbsp;·&nbsp; ')}</div></div>` : '')
          + '<div class="cards">' + [['Total Units', us.length, 'monitor', 'navy'], ['Available', c('available'), 'check', 'green'], ['Currently Rented', us.filter(u => u.r).length, 'clock', 'blue'],
          ['Active Renters', new Set(act.map(u => u.r.renter)).size, 'users', 'blue'], ['Ending Soon', c('soon'), 'bell', 'amber'], ['Completed Rentals', D.history.length, 'archive', 'green'],
          ['Overdue', od.length, 'alert', 'red'], ['Locked Devices', us.filter(u => u.lock === 'locked').length, 'lock', 'navy']]
          .map(([l, v, i, k]) => `<div class="panel stat"><span class="ico ${k}">${Auth.icon(i)}</span><div><small>${l}</small><b>${v}</b></div></div>`).join('') + '</div><h2>Live Rentals</h2>' +
          table(['Renter', 'Unit', 'Remaining', 'Status', 'Lock'], us.filter(u => u.r).map(u => [u.r.renter, u.name, cd(u), badge(stat(u)), lockBadge(u)]));
      },
      tracker() { const us = D.units.filter(u => u.r); return clockBox() + (us.length ? `<div class="rgrid">${us.map(rcard).join('')}</div>` : '<div class="panel empty">No active rentals.</div>'); },
      gps() {
        return `<div class="mapwrap"><div><div class="map"><div class="geo"></div><div class="depot" title="Main depot">${Auth.icon('monitor')}</div>
          ${D.units.map(u => `<button class="pin ${stat(u)}" data-pin="${u.id}" style="${pos(u.gps)}" title="${u.name}">${u.id.slice(-2)}</button>`).join('')}</div>
          <p class="cap">Dashed ring = ${RADIUS} km safe zone around the main depot. Positions are simulated; connect your GPS tracker feed to show real coordinates.</p></div>`
          + table(['Unit', 'Renter', 'Coordinates', 'From depot', 'Map'], D.units.map(u => [u.name, u.r ? u.r.renter : 'In depot', `<span data-gps="${u.id}"></span>`, `<span data-dist="${u.id}"></span>`, `<a class="link" data-gl="${u.id}" target="_blank" rel="noopener" href="#">Open</a>`])) + '</div>';
      },
      units() {
        return table(['Unit', 'Name', 'Renter', 'Start', 'Duration', 'End', 'Remaining', 'Status', 'Lock', 'Action'], D.units.map(u => { const r = u.r, d = '—';
          return [u.id, u.name, r ? r.renter : d, r ? C.t(r.start) : d, r ? C.dur(r.dur) : d, r ? C.t(end(r)) : d, r ? cd(u) : d, badge(stat(u)), lockBadge(u),
            r ? `<button class="btn sm danger" data-act="end" data-u="${u.id}">End Rental</button>` : `<button class="btn sm" data-act="start" data-u="${u.id}">Start Rental</button>`]; }));
      },
      security() {
        return table(['Unit', 'Renter', 'Status', 'Lock', 'Data', 'Remote Actions'], D.units.map(u => { const w = wstate(u), L = u.lock === 'locked';
          return [u.name, u.r ? u.r.renter : '—', badge(stat(u)), lockBadge(u),
            w === 'none' ? '—' : w === 'wiping' ? `<span class="badge amber" data-wp="${u.id}">Wiping ${Math.min(99, Math.floor((Date.now() - u.wipe.t) / 80))}%</span>` : '<span class="badge gray">Wiped</span>',
            `<button class="btn sm ${L ? '' : 'danger'}" data-act="${L ? 'unlock' : 'lock'}" data-u="${u.id}">${L ? 'Remote Unlock' : 'Remote Lock'}</button> <button class="btn sm ghost" data-act="wipe" data-u="${u.id}">Wipe Data</button>`]; }));
      },
      logs() {
        const T = { damage: ['Damage', 'amber'], tamper: ['Tamper', 'red'], lock: ['Locked', 'blue'], unlock: ['Unlocked', 'green'], wipe: ['Data Wipe', 'gray'], geofence: ['Geofence', 'amber'], overdue: ['Overdue', 'red'] };
        const L = D.logs.filter(l => lf === 'all' || l.type === lf || (lf === 'lock' && l.type === 'unlock'));
        return `<div class="bar" style="margin-bottom:.75rem"><select id="lf" class="sel" aria-label="Filter">${[['all', 'All events'], ['damage', 'Damage'], ['tamper', 'Tamper'], ['lock', 'Lock / Unlock'], ['wipe', 'Data wipe'], ['geofence', 'Geofence'], ['overdue', 'Overdue']].map(([v, l]) => `<option value="${v}"${v === lf ? ' selected' : ''}>${l}</option>`).join('')}</select><button class="btn sm" data-act="report">Report Incident</button></div>`
          + table(['Time', 'Unit', 'Type', 'Details', 'By'], L.map(l => [`${C.d(l.t)}, ${C.t(l.t)}`, l.unit, `<span class="badge ${T[l.type][1]}">${T[l.type][0]}</span>`, `<span class="wrap">${l.text}</span>`, l.by]));
      },
      renters() {
        return table(['Renter', 'Username', 'Phone', 'Current Unit', 'Status'], D.renters.map(p => { const u = D.units.find(x => x.r && x.r.renter === p.name);
          return [p.name, p.username, p.phone, u ? u.name : '—', u ? badge(stat(u)) : '<span class="badge gray">Idle</span>']; }));
      },
      notifications: () => Notify.page(),
      history() { return table(['Renter', 'Unit', 'Date', 'Start', 'End', 'Duration'], D.history.map(h => [h.renter, h.unit, C.d(h.start), C.t(h.start), C.t(h.end), C.dur(h.dur)])); },
      settings() {
        return `<div class="panel form"><h3>Rental Alerts</h3><label>"Ending Soon" threshold (minutes)<input id="soon" type="number" min="1" max="120" value="${D.soon}"></label>
        <h3>Security Automation</h3>
        <label class="chk"><input type="checkbox" id="autolock" ${D.autoLock ? 'checked' : ''}> Auto-lock when rental expires, device leaves the safe zone, or tamper is reported</label>
        <label class="chk"><input type="checkbox" id="wiperet" ${D.wipeReturn ? 'checked' : ''}> Wipe user data after every rental</label>
        <label>Auto-wipe when overdue more than (minutes, 0 = off)<input id="wipeover" type="number" min="0" max="1440" value="${D.wipeOver}"></label>
        <button class="btn" data-act="save">Save settings</button></div>
        <div class="panel form"><h3>Demo Data</h3><p>Restore the sample rentals, renters, logs and notifications.</p><button class="btn danger" data-act="reset">Reset demo data</button></div>`;
      }
    },
    renter: {
      dashboard() { const u = mine(); return `<h1 class="wel">Welcome, ${Auth.user().name}</h1>` + (u ? warn(u) + hero(u) : none()); },
      rental() {
        const u = mine(); if (!u) return none(); const r = u.r, s = stat(u);
        return warn(u) + hero(u) + `<h2 id="details">Rental Details</h2><div class="panel">${kv([['Renter', r.renter], ['Unit', u.name], ['Rental Date', C.d(r.start)], ['Start Time', C.t(r.start)], ['Rental Duration', C.dur(r.dur)],
          ['End Time', C.t(end(r))], ['Current Time', '<span data-clock="short"></span>'], ['Remaining', cd(u)], ['Status', badge(s)], ['Device Lock', lockBadge(u)]])}</div>`;
      },
      notifications: () => Notify.page(),
      profile() { const me = Auth.user(), u = mine(); return `<div class="panel">${kv([['Name', me.name], ['Username', me.username], ['Role', 'Renter'], ['Current Unit', u ? u.name : '—']])}<div style="margin-top:1.5rem"><button class="btn danger" data-act="logout">Logout</button></div></div>`; }
    }
  };

  // ---- render + live loop ----
  let sig = '', n = 0;
  const role = () => document.body.dataset.role, pg = () => document.body.dataset.page;
  const key = () => D.units.map(u => stat(u) + u.lock + wstate(u)).join();
  const render = () => { sig = key(); $('#page').innerHTML = P[role()][pg()](); C.update(); Notify.bell(); paintGps();
    if (location.hash) { const t = document.querySelector(location.hash); t && t.scrollIntoView(); } };
  const tick = () => {
    D.units.forEach(check);
    if (role() === 'admin' && ++n % 3 === 0) move();
    if (key() !== sig) return render();                          // status/lock/wipe changed
    document.querySelectorAll('[data-cd]').forEach(e => { const u = unit(e.dataset.cd); if (u && u.r) e.textContent = C.hms(rem(u.r)); });
    document.querySelectorAll('[data-od]').forEach(e => { const u = unit(e.dataset.od); if (u && u.r) e.textContent = C.hms(-rem(u.r)); });
    document.querySelectorAll('[data-wp]').forEach(e => { const u = unit(e.dataset.wp); if (u && u.wipe) e.textContent = 'Wiping ' + Math.min(99, Math.floor((Date.now() - u.wipe.t) / 80)) + '%'; });
  };
  const toast = m => { const t = document.createElement('div'); t.className = 'toast'; t.textContent = m; document.body.append(t); setTimeout(() => t.remove(), 2200); };
  const TYPES = [['damage|Cracked screen', 'Damage: Cracked screen'], ['damage|Water damage', 'Damage: Water damage'], ['damage|Missing parts', 'Damage: Missing parts / accessories'], ['damage|Other damage', 'Damage: Other'],
    ['tamper|Case opened', 'Tamper: Case opened'], ['tamper|SIM or storage removed', 'Tamper: SIM / storage removed'], ['tamper|Lock bypass attempt', 'Tamper: Lock bypass attempt']];

  return { boot() {
    Auth.shell(); C.start();
    const adm = role() === 'admin', me = Auth.user();
    document.body.insertAdjacentHTML('beforeend', (adm ? `<dialog id="dlg"><form method="dialog"><h3>Start Rental</h3><label>Renter<select id="dr"></select></label>
      <label>Duration<select id="dd"><option value="30">30 Minutes</option><option value="60">1 Hour</option><option value="120" selected>2 Hours</option><option value="180">3 Hours</option></select></label>
      <div class="acts"><button class="btn ghost" value="cancel">Cancel</button><button class="btn" value="ok">Start</button></div></form></dialog>` : '')
      + `<dialog id="rdlg"><form method="dialog"><h3>${adm ? 'Report Incident' : 'Report Damage'}</h3><label>Unit<select id="ru"></select></label>
      <label>Type<select id="rt">${TYPES.filter(t => adm || t[0][0] === 'd').map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select></label>
      <label>Notes (optional)<input id="rn" maxlength="120" placeholder="Describe what happened"></label>
      <div class="acts"><button class="btn ghost" value="cancel">Cancel</button><button class="btn" value="ok">Submit</button></div></form></dialog>`);
    if (adm) $('#dlg').addEventListener('close', e => { if (e.target.returnValue === 'ok') { start(e.target.dataset.u, $('#dr').value, +$('#dd').value); render(); toast('Rental started'); } });
    $('#rdlg').addEventListener('close', e => {
      if (e.target.returnValue !== 'ok') return;
      const [type, label] = $('#rt').value.split('|'), note = esc($('#rn').value.trim()), u = unit($('#ru').value);
      log(type, u.name, label + (note ? ': ' + note : ''), me.name); save();
      Notify.push('admin', type === 'tamper' ? 'Tamper Alert' : 'Damage Reported', `${u.name}: ${label}${adm ? '' : ' (reported by ' + me.name + ')'}`);
      if (type === 'tamper' && D.autoLock) lockU(u, 'Auto-locked: tamper detected', 'System');
      render(); toast('Report logged');
    });
    document.addEventListener('change', e => { if (e.target.id === 'lf') { lf = e.target.value; render(); } });
    document.addEventListener('click', e => {
      const b = e.target.closest('[data-act]'); if (!b) return; const a = b.dataset.act, u = b.dataset.u && unit(b.dataset.u);
      if (a === 'start') { $('#dr').innerHTML = D.renters.filter(p => !D.units.some(x => x.r && x.r.renter === p.name)).map(p => `<option>${p.name}</option>`).join(''); $('#dlg').dataset.u = u.id; $('#dlg').returnValue = ''; $('#dlg').showModal(); }
      if (a === 'end' && confirm('End this rental and mark the unit available?')) { finish(u.id); render(); }
      if (a === 'lock') { lockU(u, 'Remote lock by admin', me.name); render(); }
      if (a === 'unlock') { unlockU(u, 'Remote unlock by admin', me.name); render(); }
      if (a === 'wipe' && confirm(`Wipe all user data on ${u.name}? This cannot be undone.`)) { wipeU(u, 'Remote wipe by admin', me.name); render(); }
      if (a === 'report') { const list = adm ? D.units : [mine()].filter(Boolean); if (!list.length) return toast('No active rental'); $('#ru').innerHTML = list.map(x => `<option value="${x.id}">${x.name}</option>`).join(''); $('#rn').value = ''; $('#rdlg').returnValue = ''; $('#rdlg').showModal(); }
      if (a === 'req') { const x = mine(); log('unlock', x.name, 'Unlock requested by renter', me.name); save(); Notify.push('admin', 'Unlock Requested', `${me.name} requested an unlock for ${x.name}.`); toast('Request sent to admin'); }
      if (a === 'save') { D.soon = Math.max(1, +$('#soon').value || 15); D.autoLock = $('#autolock').checked; D.wipeReturn = $('#wiperet').checked; D.wipeOver = Math.max(0, +$('#wipeover').value || 0); save(); render(); toast('Settings saved'); }
      if (a === 'reset' && confirm('Reset all demo data?')) { localStorage.removeItem(KEY); localStorage.removeItem('rs_notes'); location.reload(); }
      if (a === 'readall') Notify.markAll();
      if (a === 'clear') Notify.clear();
    });
    window.addEventListener('rs:notes', () => { if (pg() === 'notifications') render(); });
    window.addEventListener('storage', e => { if (e.key === KEY && e.newValue) { D = JSON.parse(e.newValue); render(); } }); // keep admin + renter tabs in sync
    render(); D.units.forEach(check); setInterval(tick, 1000);
  } };
})();
