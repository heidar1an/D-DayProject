/*
 * صدا — کاملاً سنتز‌شده با Web Audio API.
 *
 * هیچ فایل صوتی، هیچ موسیقی و هیچ سمپلِ بیرونی وارد پروژه نمی‌شود؛ پس
 * مسئلهٔ copyright منتفی است. بافتِ صدا فقط با اولین اشارهٔ کاربر ساخته
 * می‌شود (مرورگرها پیش از gesture اجازهٔ پخش نمی‌دهند) و بازی بدون صدا
 * هم کاملاً قابل‌بازی است.
 */

let ctx = null;
let master = null;
let muted = false;

function ensure() {
  if (ctx) {
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  }
  const AudioCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtor) return null;
  ctx = new AudioCtor();
  master = ctx.createGain();
  master.gain.value = muted ? 0 : 0.5;
  master.connect(ctx.destination);
  return ctx;
}

function tone({ freq, to, dur = 0.1, type = 'square', vol = 0.22, delay = 0 }) {
  if (muted) return;
  const ac = ensure();
  if (!ac) return;
  const t0 = ac.currentTime + delay;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), t0 + dur);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain).connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.03);
}

function noise({ dur = 0.25, vol = 0.3, delay = 0, sweep = 900 }) {
  if (muted) return;
  const ac = ensure();
  if (!ac) return;
  const t0 = ac.currentTime + delay;
  const frames = Math.max(1, Math.floor(ac.sampleRate * dur));
  const buffer = ac.createBuffer(1, frames, ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i += 1) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
  }
  const src = ac.createBufferSource();
  src.buffer = buffer;
  const filter = ac.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(sweep, t0);
  filter.frequency.exponentialRampToValueAtTime(120, t0 + dur);
  const gain = ac.createGain();
  gain.gain.setValueAtTime(vol, t0);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(filter).connect(gain).connect(master);
  src.start(t0);
}

export const sfx = {
  setMuted(next) {
    muted = Boolean(next);
    if (master) master.gain.value = muted ? 0 : 0.5;
  },
  isMuted() {
    return muted;
  },
  unlock() {
    ensure();
  },
  shoot() {
    tone({ freq: 880, to: 1500, dur: 0.06, type: 'square', vol: 0.1 });
  },
  hit() {
    tone({ freq: 420, to: 240, dur: 0.05, type: 'triangle', vol: 0.12 });
  },
  explode() {
    noise({ dur: 0.22, vol: 0.24, sweep: 1200 });
    tone({ freq: 180, to: 60, dur: 0.18, type: 'sawtooth', vol: 0.12 });
  },
  bigExplode() {
    noise({ dur: 0.7, vol: 0.34, sweep: 1800 });
    tone({ freq: 120, to: 40, dur: 0.6, type: 'sawtooth', vol: 0.18 });
  },
  powerup() {
    tone({ freq: 660, dur: 0.08, type: 'square', vol: 0.16 });
    tone({ freq: 990, dur: 0.09, type: 'square', vol: 0.16, delay: 0.08 });
    tone({ freq: 1320, dur: 0.12, type: 'square', vol: 0.16, delay: 0.16 });
  },
  pulse() {
    tone({ freq: 1400, to: 120, dur: 0.5, type: 'sawtooth', vol: 0.22 });
  },
  hurt() {
    tone({ freq: 320, to: 90, dur: 0.3, type: 'square', vol: 0.22 });
  },
  wave() {
    tone({ freq: 520, dur: 0.1, type: 'triangle', vol: 0.16 });
    tone({ freq: 780, dur: 0.14, type: 'triangle', vol: 0.16, delay: 0.1 });
  },
  gameOver() {
    tone({ freq: 440, to: 110, dur: 0.9, type: 'sawtooth', vol: 0.2 });
  },
  dispose() {
    if (ctx) {
      ctx.close().catch(() => {});
      ctx = null;
      master = null;
    }
  },
};
