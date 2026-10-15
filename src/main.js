import { UsbLock, isNative } from './usb.js';
import { STR } from './i18n.js';
// Samma typsnitt som Conversation. De ingår i appen så att de fungerar utan internet.
import '@fontsource/amiri/arabic-400.css';
import '@fontsource/cormorant-garamond/latin-600.css';
import '@fontsource/cormorant-garamond/latin-700.css';
import '@fontsource/space-grotesk/latin-500.css';
import '@fontsource/space-grotesk/latin-700.css';
import '@fontsource/ibm-plex-sans/latin-400.css';
import '@fontsource/ibm-plex-sans/latin-500.css';
import '@fontsource/ibm-plex-sans/latin-600.css';
import '@fontsource/ibm-plex-sans/latin-ext-400.css';
import '@fontsource/ibm-plex-sans/latin-ext-600.css';

const app = document.getElementById('app');
const VERSION = __APP_VERSION__;

// ---------- Inställningar (endast på enheten) ----------
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};
const settings = Object.assign({ ui: 'sv', minutes: 180 }, store.get('settings', {}));
const T = () => STR[settings.ui] || STR.sv;

const PRESETS = [30, 60, 120, 180, 360, 720];
const STEP = 15;
const MIN_MIN = 15;
const MAX_MIN = 24 * 60;

// ---------- Tillstånd ----------
const S = {
  view: 'lock',
  st: null,              // status från telefonen
  minutes: settings.minutes,
  events: [],
  pin: null,             // { purpose, step, value, first, error, busy }
  notice: '',
  error: '',
  copied: false,
};

// ---------- Hjälpare ----------
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const versionTag = () => `<div class="version">${esc(T().version(VERSION))}</div>`;
const fmtDur = (m) => {
  const t = T(); const h = Math.floor(m / 60); const r = m % 60;
  if (!h) return `${r} ${t.min}`;
  return r ? `${h} ${t.h} ${r} ${t.min}` : `${h} ${t.h}`;
};
const fmtClock = (ms) => new Date(ms).toLocaleTimeString(T().locale, { hour: '2-digit', minute: '2-digit' });
const fmtDate = (ms) => new Date(ms).toLocaleString(T().locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const fmtLeft = (ms) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600); const m = Math.floor((s % 3600) / 60); const x = s % 60;
  return `${h}:${String(m).padStart(2, '0')}:${String(x).padStart(2, '0')}`;
};
// Telefonens klocka och appens klocka kan skilja sig lite; räkna med skillnaden.
let skew = 0;
const now = () => Date.now() + skew;

const I = {
  gear: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1 7 17M17 7l2.1-2.1"/></svg>',
  usb: (s = 22) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2v16"/><path d="M9.5 5 12 2l2.5 3"/><path d="M12 14 7 10.5V8"/><circle cx="7" cy="6.5" r="1.6" fill="currentColor" stroke="none"/><path d="M12 11.5 17 8.5V7"/><rect x="15.4" y="4" width="3.2" height="3.2" fill="currentColor" stroke="none"/><circle cx="12" cy="20" r="2.2" fill="currentColor" stroke="none"/></svg>`,
  lock: (s = 22) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>`,
  unlock: (s = 22) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 7.5-2"/></svg>`,
  bolt: '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M13 2 4 14h7l-1 8 9-12h-7z"/></svg>',
  info: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 16v-5"/><path d="M12 8h.01"/></svg>',
  hist: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l3 2"/></svg>',
  back: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>',
  minus: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M5 12h14"/></svg>',
  plus: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M5 12h14M12 5v14"/></svg>',
  erase: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 5H9l-6 7 6 7h12z"/><path d="m17 9-6 6M11 9l6 6"/></svg>',
  warn: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3 2 21h20z"/><path d="M12 10v5M12 18h.01"/></svg>',
  trash: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/></svg>',
};

// ---------- Vyer ----------
function nav() {
  const t = T();
  const b = (v, icon, label) => `<button data-go="${v}" class="${S.view === v ? 'on' : ''}">${icon}${label}</button>`;
  return `<nav class="nav">${b('lock', I.lock(22), t.navLock)}${b('log', I.hist, t.navLog)}${b('about', I.info, t.navAbout)}</nav>`;
}

/** Appens namn i samma stil som Conversation: serif i guld, med det arabiska ordet för lås (qufl) under. */
function wordmark(small) {
  return `<div class="wordmark${small ? ' sm' : ''}"><span class="wm-name">USB</span><span class="wm-ar" lang="ar" dir="rtl">قفل</span></div>`;
}

function langSwitch() {
  const b = (v, label) => `<button data-ui="${v}" class="${settings.ui === v ? 'on' : ''}" aria-pressed="${settings.ui === v}">${label}</button>`;
  return `<div class="seg" role="group" aria-label="${esc(T().appLang)}">${b('sv', 'Svenska')}${b('en', 'English')}</div>`;
}

const R = 84; // radien på nedräkningsringen
const CIRC = 2 * Math.PI * R;
function ringOffset(st) {
  const total = Math.max(1, st.until - (st.started || st.until - 1));
  const left = Math.max(0, st.until - now());
  return CIRC * (1 - left / total);
}

function viewLock() {
  const t = T();
  const st = S.st;
  const locked = st?.locked;
  const notOwner = st && !st.owner;
  return `
  <header class="masthead">
    <div class="mast-row">${wordmark()}<button class="icon-btn glass" data-go="settings" aria-label="${esc(t.settings)}">${I.gear}</button></div>
    <p class="mast-tag">${esc(t.tagline)}</p>
  </header>
  ${S.error ? `<div class="err">${esc(S.error)}</div>` : ''}
  ${S.notice ? `<div class="note">${esc(S.notice)}</div>` : ''}
  ${notOwner && !locked ? `
  <section class="card alert">
    <div class="row"><div class="label">${I.warn} ${esc(t.notOwnerTitle)}</div></div>
    <p class="muted">${esc(t.notOwnerText)}</p>
    <button class="secondary" data-go="setup">${esc(t.howTo)}</button>
  </section>` : ''}
  <section class="hero">
    ${locked ? `
    <div class="ring1 ring-lock">
      <svg class="arc" viewBox="0 0 188 188" aria-hidden="true">
        <circle cx="94" cy="94" r="${R}" class="arc-bg"/>
        <circle cx="94" cy="94" r="${R}" class="arc-fg" id="arc" stroke-dasharray="${CIRC.toFixed(1)}" stroke-dashoffset="${ringOffset(st).toFixed(1)}"/>
      </svg>
      <div class="ring2 closed"><div class="cd"><span id="cd">${fmtLeft(st.until - now())}</span><small>${esc(t.left)}</small></div></div>
    </div>
    <div class="pill live paused"><span class="dot"></span>${esc(t.closed)}</div>
    <p>${esc(t.closedSub(fmtClock(st.until)))}</p>` : `
    <div class="ring1"><div class="ring2"><button class="mic" data-act="lock" aria-label="${esc(t.lockBtn)}" ${notOwner ? 'disabled' : ''}>${I.usb(40)}</button></div></div>
    <div class="pill"><span class="dot"></span>${esc(t.open)}</div>`}
    <div class="charge">${I.bolt} ${esc(t.charging)}</div>
  </section>
  ${locked ? `
  <section class="card">
    <div class="label teal">${esc(st.mode === 'signal' ? t.modeSignal : t.modeRestrict)}</div>
    <p class="muted">${esc(t.unlockHint)}</p>
  </section>
  <div class="controls"><button class="secondary wide" data-act="unlock">${I.unlock(20)} ${esc(t.unlockBtn)}</button></div>` : `
  <section class="card">
    <div class="label teal">${esc(t.duration)}</div>
    <div class="stepper">
      <button class="icon-btn lg" data-act="less" aria-label="${esc(t.less)}" ${S.minutes <= MIN_MIN ? 'disabled' : ''}>${I.minus}</button>
      <div class="dur" aria-live="polite">${esc(fmtDur(S.minutes))}</div>
      <button class="icon-btn lg" data-act="more" aria-label="${esc(t.more)}" ${S.minutes >= MAX_MIN ? 'disabled' : ''}>${I.plus}</button>
    </div>
    <div class="presets">${PRESETS.map((m) => `<button data-min="${m}" class="${S.minutes === m ? 'on' : ''}">${esc(fmtDur(m))}</button>`).join('')}</div>
  </section>
  <div class="controls"><button class="primary" data-act="lock" ${notOwner ? 'disabled' : ''}>${I.lock(20)} ${esc(t.lockBtn)}</button></div>
  <p class="hint">${esc(t.durationHint)}</p>`}
  ${versionTag()}
  ${nav()}`;
}

function eventText(e) {
  const t = T();
  const reason = { timer: t.rTimer, pin: t.rPin, boot: t.rBoot, release: t.rRelease }[e.reason] || '';
  if (e.type === 'lock') return { title: t.evLock(fmtDur(e.minutes || 0)), sub: e.mode === 'signal' ? t.modeSignal : t.modeRestrict, cls: 'ev-lock' };
  if (e.type === 'release') return { title: t.evRelease, sub: '', cls: 'ev-rel' };
  return { title: t.evUnlock, sub: reason, cls: 'ev-open' };
}

function viewLog() {
  const t = T();
  return `
  <header class="top"><h1 class="h1">${esc(t.logTitle)}</h1></header>
  ${S.events.length ? `<div class="list">${S.events.map((e) => {
    const x = eventText(e);
    return `<div class="item ${x.cls}"><span class="ev-ic">${e.type === 'lock' ? I.lock(18) : I.unlock(18)}</span><div class="grow"><div class="t">${esc(x.title)}</div><div class="s">${esc(fmtDate(e.t))}${x.sub ? ` · ${esc(x.sub)}` : ''}</div></div></div>`;
  }).join('')}</div>
  <button class="danger wide" data-act="clearlog">${I.trash} ${esc(t.logClear)}</button>` : `<div class="card"><p class="empty">${esc(t.logEmpty)}</p></div>`}
  ${nav()}`;
}

function viewAbout() {
  const t = T();
  return `
  <header class="top"><h1 class="h1">${esc(t.aboutTitle)}</h1></header>
  <section class="card about">
    ${wordmark(true)}
    <p class="muted">${esc(t.tagline)}</p>
    <dl>
      <dt>${esc(t.aboutVersion)}</dt><dd>${esc(VERSION)}</dd>
    </dl>
    <p class="about-line">${esc(t.aboutLine)}</p>
  </section>
  ${nav()}`;
}

function viewSettings() {
  const t = T();
  const st = S.st || {};
  return `
  <header class="top"><button class="icon-btn" data-act="back" aria-label="${esc(t.back)}">${I.back}</button><h1 class="h1" style="flex-grow:1">${esc(t.settings)}</h1></header>
  ${S.notice ? `<div class="note">${esc(S.notice)}</div>` : ''}
  ${S.error ? `<div class="err">${esc(S.error)}</div>` : ''}
  <section class="card">
    <div class="field"><span class="flabel">${esc(t.appLang)}</span>${langSwitch()}</div>
  </section>
  <section class="card">
    <div class="label teal">${esc(t.defaultTime)}</div>
    <div class="presets">${PRESETS.map((m) => `<button data-defmin="${m}" class="${settings.minutes === m ? 'on' : ''}">${esc(fmtDur(m))}</button>`).join('')}</div>
    <p class="muted">${esc(t.defaultTimeHelp)}</p>
  </section>
  <section class="card">
    <div class="label teal">${esc(t.pinTitle)}</div>
    <button class="secondary" data-act="changepin">${esc(t.changePin)}</button>
  </section>
  <section class="card about">
    <div class="label teal">${esc(t.status)}</div>
    <dl>
      <dt>${esc(t.stOwner)}</dt><dd>${esc(st.owner ? t.yes : t.no)}</dd>
      <dt>${esc(t.stSignal)}</dt><dd>${esc(st.signaling ? t.yes : t.stSignalNo)}</dd>
      ${st.model ? `<dt>${esc(t.stPhone)}</dt><dd>${esc(st.model)}${st.sdk ? ` · Android API ${esc(st.sdk)}` : ''}</dd>` : ''}
    </dl>
    <button class="secondary" data-go="setup">${esc(t.setupTitle)}</button>
  </section>
  ${st.owner ? `
  <section class="card">
    <div class="label">${esc(t.releaseTitle)}</div>
    <p class="muted">${esc(t.releaseText)}</p>
    <button class="danger wide" data-act="release">${esc(t.releaseBtn)}</button>
  </section>` : ''}
  ${versionTag()}`;
}

function viewSetup() {
  const t = T();
  const cmd = `adb shell dpm set-device-owner ${S.st?.admin || 'se.menola.usb/.AdminReceiver'}`;
  return `
  <header class="top"><button class="icon-btn" data-act="back" aria-label="${esc(t.back)}">${I.back}</button><h1 class="h1" style="flex-grow:1">${esc(t.setupTitle)}</h1></header>
  <section class="card">
    <p class="muted">${esc(t.setupIntro)}</p>
    <ol class="steps">${t.setupSteps.map((s, i) => `<li><span class="num">${i + 1}</span><span>${esc(s)}</span></li>`).join('')}</ol>
    <div class="code"><code id="cmd">${esc(cmd)}</code><button class="secondary" data-act="copy">${esc(S.copied ? t.copied : t.copy)}</button></div>
    <p class="muted">${esc(t.setupNote)}</p>
  </section>`;
}

// ---------- PIN-tangentbord ----------
function pinTitle(p) {
  const t = T();
  if (p.purpose === 'new') return p.step === 0 ? t.pinNew : t.pinConfirm;
  if (p.purpose === 'change') return [t.pinOld, t.pinNew, t.pinConfirm][p.step];
  return t.pinEnter;
}
function pinSub(p) {
  const t = T();
  if (p.purpose === 'lock') return t.pinForLock(fmtDur(S.minutes));
  if (p.purpose === 'unlock') return t.pinForUnlock;
  if (p.purpose === 'release') return t.pinForRelease;
  if (p.purpose === 'new' && p.step === 0) return t.pinNewSub;
  if (p.purpose === 'change' && p.step === 1) return t.pinNewSub;
  return '';
}

function pinSheet() {
  const p = S.pin;
  if (!p) return '';
  const t = T();
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'del', '0', 'ok'];
  return `
  <div class="scrim" data-act="pincancel"></div>
  <div class="sheet pin-sheet" role="dialog" aria-modal="true" aria-label="${esc(pinTitle(p))}">
    <div class="sheet-grip"></div>
    <div class="pin-head">
      <h2>${esc(pinTitle(p))}</h2>
      ${pinSub(p) ? `<p>${esc(pinSub(p))}</p>` : ''}
    </div>
    <div class="pin-dots${p.error ? ' shake' : ''}" aria-live="polite" aria-label="${p.value.length}">${Array.from({ length: Math.max(4, p.value.length) }, (_, i) => `<i class="${i < p.value.length ? 'on' : ''}"></i>`).join('')}</div>
    <div class="pin-err">${esc(p.error || '')}</div>
    <div class="pad">${keys.map((k) => {
      if (k === 'del') return `<button data-key="del" aria-label="${esc(t.erase)}">${I.erase}</button>`;
      if (k === 'ok') return `<button data-key="ok" class="ok" ${p.value.length < 4 || p.busy ? 'disabled' : ''}>${esc(t.ok)}</button>`;
      return `<button data-key="${k}">${k}</button>`;
    }).join('')}</div>
    <button class="sheet-btn plain" data-act="pincancel">${esc(t.cancel)}</button>
  </div>`;
}

function openPin(purpose) {
  S.pin = { purpose, step: 0, value: '', first: '', old: '', error: '', busy: false };
  S.error = '';
  S.notice = '';
  render();
}

function failText(r) {
  const t = T();
  if (r.wait > 0) return t.pinWait(Math.ceil(r.wait / 1000));
  return t.pinWrong(r.left ?? 0);
}

async function submitPin() {
  const p = S.pin;
  const t = T();
  const v = p.value;
  if (v.length < 4) { p.error = t.pinShort; return render(); }
  // Ny PIN-kod: skriv två gånger.
  if (p.purpose === 'new' || (p.purpose === 'change' && p.step > 0)) {
    const confirmStep = p.purpose === 'new' ? 1 : 2;
    if (p.step < confirmStep) { p.first = v; p.step++; p.value = ''; p.error = ''; return render(); }
    if (v !== p.first) { p.step = confirmStep - 1; p.first = ''; p.value = ''; p.error = t.pinMismatch; return render(); }
    p.busy = true; render();
    try {
      const r = await UsbLock.setPin({ pin: v, old: p.old });
      if (!r.ok) { S.pin = { ...p, purpose: 'change', step: 0, value: '', first: '', old: '', busy: false, error: failText(r) }; return render(); }
      const next = p.then;
      S.pin = null;
      S.notice = t.pinSaved;
      await refresh();
      if (next) return openPin(next);
    } catch (e) { p.busy = false; p.error = e.message || String(e); }
    return render();
  }
  if (p.purpose === 'change') {
    // Kontrollera den nuvarande koden först.
    p.busy = true; render();
    const r = await UsbLock.verifyPin({ pin: v });
    p.busy = false;
    if (!r.ok) { p.value = ''; p.error = failText(r); return render(); }
    p.old = v; p.step = 1; p.value = ''; p.error = '';
    return render();
  }
  p.busy = true; render();
  try {
    let r;
    if (p.purpose === 'lock') r = await UsbLock.lock({ pin: v, minutes: S.minutes });
    else if (p.purpose === 'unlock') r = await UsbLock.unlock({ pin: v });
    else if (p.purpose === 'release') r = await UsbLock.release({ pin: v });
    if (!r.ok) { p.busy = false; p.value = ''; p.error = failText(r); return render(); }
    if (r.status) setStatus(r.status);
    S.pin = null;
    if (p.purpose === 'release') S.notice = t.released;
    loadLog();
  } catch (e) {
    S.pin = null;
    S.error = e.message || String(e);
  }
  render();
}

function pressKey(k) {
  const p = S.pin;
  if (!p || p.busy) return;
  if (k === 'del') p.value = p.value.slice(0, -1);
  else if (k === 'ok') return submitPin();
  else if (p.value.length < 8) p.value += k;
  p.error = '';
  if (navigator.vibrate) navigator.vibrate(8);
  render();
}

// ---------- Rita ----------
const from = { settings: 'lock', setup: 'lock' }; // varifrån man kom till Inställningar och Aktivera
function render() {
  document.documentElement.lang = settings.ui;
  const v = { lock: viewLock, log: viewLog, about: viewAbout, settings: viewSettings, setup: viewSetup }[S.view] || viewLock;
  app.className = `v-${S.view}`;
  app.innerHTML = v() + pinSheet();
}

/** Uppdaterar bara nedräkningen varje sekund, utan att rita om hela sidan. */
function tick() {
  const st = S.st;
  if (!st?.locked) return;
  if (now() >= st.until) { refresh(); return; }
  const cd = document.getElementById('cd');
  if (cd) cd.textContent = fmtLeft(st.until - now());
  const arc = document.getElementById('arc');
  if (arc) arc.setAttribute('stroke-dashoffset', ringOffset(st).toFixed(1));
}

function setStatus(st) {
  S.st = st;
  if (st.now) skew = st.now - Date.now();
}

async function refresh() {
  try {
    const before = S.st?.locked;
    setStatus(await UsbLock.status());
    if (before !== S.st.locked) loadLog();
  } catch (e) {
    S.error = e.message || String(e);
  }
  render();
}

async function loadLog() {
  try {
    const r = await UsbLock.log();
    S.events = r.events || [];
    if (S.view === 'log') render();
  } catch {}
}

// ---------- Händelser ----------
app.addEventListener('click', async (e) => {
  const el = e.target.closest('[data-go],[data-act],[data-ui],[data-min],[data-defmin],[data-key]');
  if (!el || el.disabled) return;
  if (el.dataset.key) return pressKey(el.dataset.key);
  if (el.dataset.ui) { settings.ui = el.dataset.ui; store.set('settings', settings); return render(); }
  if (el.dataset.min) { S.minutes = +el.dataset.min; return render(); }
  if (el.dataset.defmin) { settings.minutes = +el.dataset.defmin; store.set('settings', settings); if (!S.st?.locked) S.minutes = settings.minutes; return render(); }
  if (el.dataset.go) {
    if (el.dataset.go in from) from[el.dataset.go] = S.view;
    S.view = el.dataset.go;
    S.notice = ''; S.error = ''; S.copied = false;
    window.scrollTo(0, 0);
    if (S.view === 'log') loadLog();
    return render();
  }
  switch (el.dataset.act) {
    case 'less': S.minutes = Math.max(MIN_MIN, S.minutes - STEP); return render();
    case 'more': S.minutes = Math.min(MAX_MIN, S.minutes + STEP); return render();
    case 'lock':
      if (!S.st?.hasPin) { openPin('new'); S.pin.then = 'lock'; return; }
      return openPin('lock');
    case 'unlock': return openPin('unlock');
    case 'release':
      if (confirm(T().confirmRelease)) openPin('release');
      return;
    case 'changepin': return openPin(S.st?.hasPin ? 'change' : 'new');
    case 'pincancel':
      if (S.pin?.busy) return;
      S.pin = null; return render();
    case 'clearlog':
      if (confirm(T().confirmClear)) { await UsbLock.clearLog(); await loadLog(); render(); }
      return;
    case 'copy': {
      const text = document.getElementById('cmd').textContent;
      try { await navigator.clipboard.writeText(text); } catch {
        const r = document.createRange(); r.selectNodeContents(document.getElementById('cmd'));
        const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); document.execCommand('copy');
      }
      S.copied = true; return render();
    }
    case 'back':
      S.view = from[S.view] || 'lock';
      S.notice = ''; S.error = ''; S.copied = false;
      window.scrollTo(0, 0);
      return render();
  }
});

// Siffror från ett fysiskt tangentbord (t.ex. i webbläsaren).
document.addEventListener('keydown', (e) => {
  if (!S.pin) return;
  if (/^\d$/.test(e.key)) pressKey(e.key);
  else if (e.key === 'Backspace') pressKey('del');
  else if (e.key === 'Enter') pressKey('ok');
  else if (e.key === 'Escape' && !S.pin.busy) { S.pin = null; render(); }
});

document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') refresh(); });
setInterval(tick, 1000);
setInterval(refresh, 30000);

// ---------- Start ----------
render();
(async () => {
  await refresh();
  loadLog();
  if (S.st && !S.st.hasPin) openPin('new');
  if (!isNative) console.info('USB körs i webbläsaren med en låtsasversion av USB-låset.');
})();
