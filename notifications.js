/* Notifications: storage, bell dropdown and notifications page */
const Notify = (() => {
  const K = 'rs_notes';
  let L; try { L = JSON.parse(localStorage.getItem(K)); } catch (e) {}
  if (!L) { // first run: sample notifications
    const n = Date.now();
    L = [{ to: 'admin', title: 'Rental Started', text: 'Juan Dela Cruz started renting Device 01.', t: n - 75 * 6e4 },
         { to: 'renter', who: 'Juan Dela Cruz', title: 'Your rental has started.', text: 'Device 01 for 2 Hours.', t: n - 75 * 6e4 }]
      .map((x, i) => ({ id: i, read: false, ...x }));
    localStorage.setItem(K, JSON.stringify(L));
  }
  const save = () => { localStorage.setItem(K, JSON.stringify(L)); window.dispatchEvent(new Event('rs:notes')); };
  window.addEventListener('storage', e => { if (e.key === K && e.newValue) { L = JSON.parse(e.newValue); window.dispatchEvent(new Event('rs:notes')); } });
  // Admin sees admin notifications; a renter only sees their own
  const mine = () => { const u = Auth.user(); return L.filter(n => u && (u.role === 'admin' ? n.to === 'admin' : n.to === 'renter' && n.who === u.name)); };
  const ago = t => { const m = Math.round((Date.now() - t) / 6e4); return m < 1 ? 'Just now' : m < 60 ? m + ' min ago' : Math.round(m / 60) + ' hr ago'; };
  const item = n => `<div class="note ${n.read ? '' : 'new'}"><span class="ico blue">${Auth.icon('bell')}</span><div><b>${n.title}</b><p>${n.text}</p><small>${ago(n.t)}</small></div></div>`;
  return {
    push(to, title, text, who) { L.unshift({ id: Date.now() + Math.random(), to, who, title, text, t: Date.now(), read: false }); save(); },
    unread: () => mine().filter(n => !n.read).length,
    markAll() { mine().forEach(n => n.read = true); save(); },
    clear() { const m = mine(); L = L.filter(n => !m.includes(n)); save(); },
    page() {
      const m = mine();
      return `<div class="bar"><h2>All Notifications</h2><span><button class="btn sm ghost" data-act="readall">Mark all read</button> <button class="btn sm ghost" data-act="clear">Clear all</button></span></div>
      <div class="panel notes">${m.length ? m.map(item).join('') : '<p class="empty">No notifications yet.</p>'}</div>`;
    },
    // Refresh sidebar/bell badges and dropdown list
    bell() {
      const c = Notify.unread();
      document.querySelectorAll('[data-nb]').forEach(e => { e.textContent = c; e.hidden = !c; });
      const d = document.querySelector('[data-drop]');
      if (d) d.innerHTML = '<h4>Notifications</h4>' + (mine().slice(0, 5).map(item).join('') || '<p class="empty">Nothing yet.</p>') + '<a href="notifications.html">View all</a>';
    }
  };
})();
window.addEventListener('rs:notes', () => Notify.bell());
