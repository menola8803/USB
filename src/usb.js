// Kopplingen till telefonens USB-lås (UsbLockPlugin.java).
// I webbläsaren (npm run dev) används en låtsasversion så att gränssnittet går att prova.
import { Capacitor, registerPlugin } from '@capacitor/core';

export const isNative = Capacitor.isNativePlatform();

const Native = registerPlugin('UsbLock');

const KEY = 'usb-mock';
const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };
const save = (s) => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {} };

function addEvent(s, e) {
  s.events = [{ t: Date.now(), ...e }, ...(s.events || [])].slice(0, 200);
}

const Mock = {
  async status() {
    const s = load();
    if (s.until && Date.now() >= s.until) { s.until = 0; addEvent(s, { type: 'unlock', reason: 'timer' }); save(s); }
    return { owner: s.owner !== false, signaling: true, locked: !!s.until, until: s.until || 0, started: s.started || 0, mode: 'signal', now: Date.now(), hasPin: !!s.pin, sdk: 0, model: 'Webbläsare', admin: 'se.menola.usb/.AdminReceiver' };
  },
  async setPin({ pin, old }) {
    const s = load();
    if (s.pin && s.pin !== old) return { ok: false, wait: 0, left: 4 };
    s.pin = pin; save(s); return { ok: true };
  },
  async verifyPin({ pin }) { return { ok: load().pin === pin, wait: 0, left: 4 }; },
  async lock({ pin, minutes }) {
    const s = load();
    if (s.pin !== pin) return { ok: false, wait: 0, left: 4 };
    s.started = Date.now(); s.until = s.started + minutes * 60000;
    addEvent(s, { type: 'lock', reason: 'pin', minutes, mode: 'signal' }); save(s);
    return { ok: true, status: await Mock.status() };
  },
  async unlock({ pin }) {
    const s = load();
    if (s.pin !== pin) return { ok: false, wait: 0, left: 4 };
    s.until = 0; addEvent(s, { type: 'unlock', reason: 'pin' }); save(s);
    return { ok: true, status: await Mock.status() };
  },
  async release({ pin }) {
    const s = load();
    if (s.pin !== pin) return { ok: false, wait: 0, left: 4 };
    s.until = 0; s.owner = false; addEvent(s, { type: 'release', reason: 'pin' }); save(s);
    return { ok: true, status: await Mock.status() };
  },
  async log() { return { events: load().events || [] }; },
  async clearLog() { const s = load(); s.events = []; save(s); },
};

export const UsbLock = isNative ? Native : Mock;
