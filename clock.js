/* Live clock + time formatting helpers */
const Clock = {
  pad: n => String(n).padStart(2, '0'),
  hms(ms) { ms = Math.max(0, Math.floor(ms / 1000)); return [ms / 3600 | 0, ms % 3600 / 60 | 0, ms % 60].map(Clock.pad).join(':'); },
  t: ms => new Date(ms).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
  d: ms => new Date(ms).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
  dur: m => m % 60 ? m + ' Minutes' : m / 60 + (m > 60 ? ' Hours' : ' Hour'),
  // Fills every [data-clock] element: "time" = 06:15:42 PM, "date" = full date, "short" = 6:15 PM
  update() {
    const n = new Date();
    document.querySelectorAll('[data-clock]').forEach(e => {
      const k = e.dataset.clock;
      e.textContent = k === 'time' ? n.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        : k === 'date' ? n.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
        : Clock.t(n);
    });
  },
  start() { Clock.update(); setInterval(Clock.update, 1000); }
};
