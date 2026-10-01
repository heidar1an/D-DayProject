/*
 * موتور بازیِ پیکسلیِ تپش — مستقل از React.
 *
 * چرا کلاس و نه کامپوننت: حلقهٔ بازی ۶۰ بار در ثانیه وضعیت را عوض می‌کند؛
 * اگر این وضعیت در state ری‌اکت بنشیند، هر فریم یک render درخت می‌سازد و
 * هزینه‌اش روی سایت می‌ماند. اینجا تمام وضعیت در یک آبجکتِ ساده است و
 * تنها چیزی که به React می‌رود، خلاصهٔ HUD با نرخِ ۱۰Hz است.
 *
 * زمان: گامِ ثابت (1/60) با انباره؛ پس روی نمایشگر ۱۴۴ هرتز و ۶۰ هرتز
 * سرعتِ بازی یکی است. `setInterval` هیچ‌جا استفاده نمی‌شود.
 */

import {
  PLAYER_PIXELS,
  ENEMY_HEART_PIXELS,
  ENEMY_BRAIN_PIXELS,
  ENEMY_BACTERIA_PIXELS,
  ENEMY_DNA_PIXELS,
  ENEMY_TEST_PIXELS,
  ENEMY_BOOK_PIXELS,
  ENEMY_FLASHCARD_PIXELS,
  POWERUP_RAPID_PIXELS,
  POWERUP_DOUBLE_PIXELS,
  POWERUP_SHIELD_PIXELS,
  POWERUP_PULSE_PIXELS,
  EXPLOSION_COLORS,
} from './pixelArts';
import { BOSS_PIXELS } from './sprites';
import { hits, clamp, rand, pick } from './egCollision';
import { sfx } from './egAudio';
import { readHighScore, submitScore } from './egStorage';

export const VIEW_W = 320;
export const VIEW_H = 560;

const PIXEL = 4;
const STEP = 1 / 60;
const MAX_HEALTH = 5;
const PLAYER_SPEED = 200;
const BULLET_SPEED = 430;
const ENEMY_BULLET_SPEED = 165;
const FIRE_INTERVAL = 0.2;
const RAPID_INTERVAL = 0.085;
const INVULN_TIME = 1.1;
const BOSS_EVERY = 3;

const ARCHETYPES = {
  heart: { rows: ENEMY_HEART_PIXELS, hp: 1, score: 10, speed: 44, shoots: false },
  card: { rows: ENEMY_FLASHCARD_PIXELS, hp: 1, score: 15, speed: 76, shoots: false },
  bacteria: { rows: ENEMY_BACTERIA_PIXELS, hp: 1, score: 20, speed: 58, shoots: false },
  brain: { rows: ENEMY_BRAIN_PIXELS, hp: 2, score: 30, speed: 40, shoots: true },
  dna: { rows: ENEMY_DNA_PIXELS, hp: 2, score: 35, speed: 52, shoots: true },
  test: { rows: ENEMY_TEST_PIXELS, hp: 2, score: 40, speed: 46, shoots: true },
  book: { rows: ENEMY_BOOK_PIXELS, hp: 3, score: 55, speed: 34, shoots: false },
};

const POWERUPS = {
  rapid: { rows: POWERUP_RAPID_PIXELS, color: '#ff9717', label: 'شلیک سریع' },
  double: { rows: POWERUP_DOUBLE_PIXELS, color: '#61d192', label: 'شلیک دوگانه' },
  shield: { rows: POWERUP_SHIELD_PIXELS, color: '#5b8cc7', label: 'سپر' },
  pulse: { rows: POWERUP_PULSE_PIXELS, color: '#937fcd', label: 'موج انفجاری' },
};
const POWERUP_ORDER = ['rapid', 'double', 'shield', 'pulse'];

const KEY_MAP = {
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
  Space: 'shoot',
  KeyJ: 'shoot',
  ArrowUp: 'shoot',
  KeyW: 'shoot',
};

const FA_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
function fa(value) {
  return String(value).replace(/\d/g, (digit) => FA_DIGITS[Number(digit)]);
}

/* هر اسپرایت یک بار روی یک canvas آفلاین کش می‌شود؛ درون حلقه فقط
   drawImage می‌زنیم، نه صدها fillRect. */
const spriteCache = new WeakMap();
function spriteCanvas(rows, size) {
  let bySize = spriteCache.get(rows);
  if (!bySize) {
    bySize = new Map();
    spriteCache.set(rows, bySize);
  }
  const cached = bySize.get(size);
  if (cached) return cached;

  const canvas = document.createElement('canvas');
  canvas.width = rows[0].length * size;
  canvas.height = rows.length * size;
  const ctx = canvas.getContext('2d');
  rows.forEach((row, r) => {
    row.forEach((color, c) => {
      if (!color) return;
      ctx.fillStyle = color;
      ctx.fillRect(c * size, r * size, size, size);
    });
  });
  bySize.set(size, canvas);
  return canvas;
}

function drawSprite(ctx, rows, x, y, size) {
  const canvas = spriteCanvas(rows, size);
  ctx.drawImage(canvas, Math.round(x - canvas.width / 2), Math.round(y - canvas.height / 2));
}

function wavePlan(n) {
  if (n % BOSS_EVERY === 0) return { boss: true };
  const patterns = n <= 2 ? ['straight'] : n === 3 ? ['straight', 'sine'] : ['straight', 'sine', 'zigzag'];
  const types =
    n === 1
      ? ['heart', 'bacteria', 'card']
      : n === 2
        ? ['heart', 'bacteria', 'card', 'brain', 'dna']
        : ['heart', 'bacteria', 'card', 'brain', 'dna', 'test', 'book'];
  return {
    boss: false,
    count: 5 + n * 2,
    gap: Math.max(0.34, 0.95 - n * 0.05),
    types,
    patterns,
    speedMul: 1 + (n - 1) * 0.07,
    shootChance: n < 2 ? 0 : Math.min(0.5, 0.12 + n * 0.05),
  };
}

export class GameEngine {
  constructor({ canvas, onHud, onGameOver }) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;
    this.onHud = onHud || (() => {});
    this.onGameOver = onGameOver || (() => {});

    this.input = { left: false, right: false, shoot: false, pointerX: null };
    this.raf = 0;
    this.running = false;
    this.lastTime = 0;
    this.accumulator = 0;
    this.hudTick = 0;

    this.reset();

    /*
     * فازِ capture: پوستهٔ بازی هم روی `window` و در فاز capture یک شنونده
     * دارد که برای جلوگیری از رسیدنِ کلیدها به میان‌برهای سایت
     * `stopPropagation` می‌زند. اگر این دو شنونده در فازهای مختلف بودند،
     * توقفِ فاز capture باعث می‌شد شنوندهٔ bubbleِ موتور هرگز صدا نخورد و
     * کنترلِ کیبورد بمیرد. هر دو در یک فاز ⇒ هر دو مستقل از ترتیب اجرا
     * می‌شوند.
     */
    window.addEventListener('keydown', this.handleKeyDown, true);
    window.addEventListener('keyup', this.handleKeyUp, true);
    window.addEventListener('blur', this.handleBlur);
    document.addEventListener('visibilitychange', this.handleVisibility);
  }

  /* ---------- چرخهٔ عمر ---------- */

  start() {
    if (this.running || this.over) return;
    this.running = true;
    this.lastTime = 0;
    this.accumulator = 0;
    this.raf = requestAnimationFrame(this.loop);
  }

  stop() {
    this.running = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  pause() {
    this.stop();
  }

  resume() {
    if (this.over || this.running) return;
    this.start();
  }

  restart() {
    this.stop();
    this.reset();
    this.start();
  }

  destroy() {
    this.stop();
    window.removeEventListener('keydown', this.handleKeyDown, true);
    window.removeEventListener('keyup', this.handleKeyUp, true);
    window.removeEventListener('blur', this.handleBlur);
    document.removeEventListener('visibilitychange', this.handleVisibility);
    sfx.dispose();
  }

  /* ---------- ورودی ---------- */

  setInput(action, active) {
    if (action === 'pointer') {
      this.input.pointerX = active;
      return;
    }
    if (!(action in this.input)) return;
    this.input[action] = Boolean(active);
    if (action === 'left' || action === 'right') this.input.pointerX = null;
  }

  handleKeyDown = (event) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    /* اگر تمرکز روی یک کنترلِ UI باشد، Space/Enter باید همان دکمه را
       فعال کند نه شلیک؛ پس بازی کنار می‌کشد. */
    const target = event.target;
    if (target && typeof target.closest === 'function' && target.closest('button, a, input, textarea, select, [contenteditable="true"]')) {
      return;
    }
    const action = KEY_MAP[event.code];
    if (!action) return;
    event.preventDefault();
    this.input[action] = true;
    if (action === 'shoot') this.input.pointerX = null;
  };

  handleKeyUp = (event) => {
    const action = KEY_MAP[event.code];
    if (!action) return;
    event.preventDefault();
    this.input[action] = false;
  };

  handleBlur = () => {
    this.input.left = false;
    this.input.right = false;
    this.input.shoot = false;
    this.input.pointerX = null;
  };

  handleVisibility = () => {
    if (document.hidden) this.pause();
    else this.resume();
  };

  /* ---------- وضعیت ---------- */

  reset() {
    this.player = {
      x: VIEW_W / 2,
      y: VIEW_H - 56,
      w: PLAYER_PIXELS[0].length * PIXEL,
      h: PLAYER_PIXELS.length * PIXEL,
      invuln: 0.8,
    };
    this.enemies = [];
    this.bullets = [];
    this.enemyBullets = [];
    this.powerups = [];
    this.particles = [];
    this.popups = [];
    this.boss = null;

    this.score = 0;
    this.health = MAX_HEALTH;
    this.wave = 0;
    this.rapid = 0;
    this.double = 0;
    this.shield = false;
    this.fireTimer = 0;
    this.spawnTimer = 0;
    this.remaining = 0;
    this.plan = null;
    this.pendingWave = false;
    this.banner = { text: '', t: 0 };
    this.shake = 0;
    this.over = false;
    this.best = readHighScore();
    this.stars = Array.from({ length: 64 }, () => ({
      x: rand(0, VIEW_W),
      y: rand(0, VIEW_H),
      z: Math.random(),
    }));

    this.input.left = false;
    this.input.right = false;
    this.input.shoot = false;
    this.input.pointerX = null;

    this.enterWave(1);
    this.syncHud(true);
  }

  enterWave(n) {
    this.wave = n;
    this.plan = wavePlan(n);
    this.pendingWave = false;
    this.remaining = this.plan.boss ? 0 : this.plan.count;
    this.spawnTimer = 0.5;
    this.banner = { text: this.plan.boss ? 'هشدار — باس' : `موج ${fa(n)}`, t: 1.7 };
    if (n > 1) sfx.wave();
    if (this.plan.boss) this.spawnBoss();
    this.syncHud(true);
  }

  /* ---------- ساخت موجودیت‌ها ---------- */

  spawnEnemy() {
    const plan = this.plan;
    const type = pick(plan.types);
    const def = ARCHETYPES[type];
    const w = def.rows[0].length * PIXEL;
    const h = def.rows.length * PIXEL;
    const margin = w / 2 + 10;
    const x = rand(margin, VIEW_W - margin);
    const hp = def.hp + (this.wave > 6 ? 1 : 0);

    this.enemies.push({
      rows: def.rows,
      type,
      x,
      y: -h,
      baseX: x,
      w,
      h,
      hp,
      maxHp: hp,
      score: def.score,
      speed: def.speed * plan.speedMul,
      pattern: pick(plan.patterns),
      t: rand(0, Math.PI * 2),
      amp: rand(16, 44),
      dir: Math.random() < 0.5 ? -1 : 1,
      fireTimer: def.shoots && Math.random() < plan.shootChance ? rand(1.6, 3.6) : Infinity,
      flash: 0,
    });
  }

  spawnBoss() {
    const hp = 60 + this.wave * 22;
    this.boss = {
      rows: BOSS_PIXELS,
      size: 8,
      x: VIEW_W / 2,
      y: -70,
      w: BOSS_PIXELS[0].length * 8,
      h: BOSS_PIXELS.length * 8,
      hp,
      maxHp: hp,
      t: 0,
      dir: Math.random() < 0.5 ? -1 : 1,
      entering: true,
      fireTimer: 1.8,
      burstTimer: 3.4,
      dropTimer: 6,
      flash: 0,
    };
  }

  dropPowerup(x, y) {
    const type = pick(POWERUP_ORDER);
    const rows = POWERUPS[type].rows;
    this.powerups.push({
      type,
      rows,
      x: clamp(x, 14, VIEW_W - 14),
      y,
      w: rows[0].length * PIXEL + 6,
      h: rows.length * PIXEL + 6,
      t: 0,
    });
  }

  burst(x, y, count, colors, speed) {
    for (let i = 0; i < count; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const v = rand(speed * 0.3, speed);
      const life = rand(0.24, 0.62);
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * v,
        vy: Math.sin(angle) * v,
        life,
        max: life,
        size: rand(1.5, 3.5),
        color: pick(colors),
      });
    }
    if (this.particles.length > 340) this.particles.splice(0, this.particles.length - 340);
  }

  popup(x, y, text, color = '#e0b45c') {
    this.popups.push({ x, y, text, color, life: 0.9, max: 0.9 });
    if (this.popups.length > 14) this.popups.shift();
  }

  /* ---------- به‌روزرسانی ---------- */

  loop = (time) => {
    if (!this.running) return;
    if (!this.lastTime) this.lastTime = time;
    let dt = (time - this.lastTime) / 1000;
    this.lastTime = time;
    if (dt > 0.25) dt = 0.25; // بازگشت از تبِ پنهان یا پرشِ سنگین

    this.accumulator += dt;
    let steps = 0;
    while (this.accumulator >= STEP && steps < 5) {
      this.update(STEP);
      this.accumulator -= STEP;
      steps += 1;
    }
    if (steps >= 5) this.accumulator = 0;

    this.render();
    this.syncHud();
    this.raf = requestAnimationFrame(this.loop);
  };

  update(dt) {
    this.updateStars(dt);
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 26);

    this.updateParticles(dt);
    this.updatePopups(dt);
    if (this.banner.t > 0) this.banner.t -= dt;
    if (this.over) return;

    this.updatePlayer(dt);

    const frozen = this.banner.t > 0.95;
    if (!frozen) {
      this.updateEnemies(dt);
      this.updateBoss(dt);
      this.updateBullets(dt);
      this.updateEnemyBullets(dt);
      this.updatePowerups(dt);
      this.resolveCollisions();
    }

    this.updateWaveFlow(dt);
  }

  updateStars(dt) {
    for (const star of this.stars) {
      star.y += (16 + star.z * 90) * dt;
      if (star.y > VIEW_H) {
        star.y = -2;
        star.x = rand(0, VIEW_W);
      }
    }
  }

  updatePlayer(dt) {
    const p = this.player;
    let dir = 0;
    if (this.input.left) dir -= 1;
    if (this.input.right) dir += 1;

    if (dir !== 0) {
      p.x += dir * PLAYER_SPEED * dt;
    } else if (this.input.pointerX != null) {
      const step = PLAYER_SPEED * 1.5 * dt;
      p.x += clamp(this.input.pointerX - p.x, -step, step);
    }
    p.x = clamp(p.x, p.w / 2 + 4, VIEW_W - p.w / 2 - 4);
    if (p.invuln > 0) p.invuln -= dt;

    if (this.rapid > 0) this.rapid -= dt;
    if (this.double > 0) this.double -= dt;

    this.fireTimer -= dt;
    if (this.input.shoot && this.fireTimer <= 0) {
      this.fireTimer = this.rapid > 0 ? RAPID_INTERVAL : FIRE_INTERVAL;
      this.shoot();
    }
  }

  shoot() {
    const p = this.player;
    const offsets = this.double > 0 ? [-7, 7] : [0];
    for (const offset of offsets) {
      this.bullets.push({ x: p.x + offset, y: p.y - p.h / 2 - 4, w: 4, h: 10, vy: -BULLET_SPEED, dmg: 1 });
    }
    sfx.shoot();
  }

  updateEnemies(dt) {
    for (let i = this.enemies.length - 1; i >= 0; i -= 1) {
      const e = this.enemies[i];
      e.t += dt;
      if (e.flash > 0) e.flash -= dt;

      if (e.pattern === 'sine') {
        e.y += e.speed * dt;
        e.x = clamp(e.baseX + Math.sin(e.t * 2.3) * e.amp, e.w / 2 + 4, VIEW_W - e.w / 2 - 4);
      } else if (e.pattern === 'zigzag') {
        e.y += e.speed * 0.55 * dt;
        e.x += e.dir * e.speed * 0.75 * dt;
        if (e.x < e.w / 2 + 4) {
          e.x = e.w / 2 + 4;
          e.dir = 1;
        } else if (e.x > VIEW_W - e.w / 2 - 4) {
          e.x = VIEW_W - e.w / 2 - 4;
          e.dir = -1;
        }
      } else {
        e.y += e.speed * dt;
      }

      if (e.fireTimer !== Infinity) {
        e.fireTimer -= dt;
        if (e.fireTimer <= 0) {
          e.fireTimer = rand(2.6, 5.2);
          this.enemyShoot(e.x, e.y + e.h / 2, e.x, e.y);
        }
      }

      if (e.y - e.h / 2 > VIEW_H) {
        this.enemies.splice(i, 1);
        this.damagePlayer();
      }
    }
  }

  enemyShoot(x, y, fromX, fromY) {
    const p = this.player;
    const dx = p.x - fromX;
    const dy = Math.max(20, p.y - fromY);
    const len = Math.hypot(dx, dy) || 1;
    this.enemyBullets.push({
      x,
      y,
      w: 5,
      h: 5,
      vx: (dx / len) * ENEMY_BULLET_SPEED,
      vy: (dy / len) * ENEMY_BULLET_SPEED,
    });
  }

  updateBoss(dt) {
    const boss = this.boss;
    if (!boss) return;
    boss.t += dt;
    if (boss.flash > 0) boss.flash -= dt;

    if (boss.entering) {
      boss.y += 100 * dt;
      if (boss.y >= 96) {
        boss.y = 96;
        boss.entering = false;
      }
      return;
    }

    const speed = 40 + this.wave * 2;
    boss.x += boss.dir * speed * dt;
    if (boss.x < boss.w / 2 + 6) {
      boss.x = boss.w / 2 + 6;
      boss.dir = 1;
    } else if (boss.x > VIEW_W - boss.w / 2 - 6) {
      boss.x = VIEW_W - boss.w / 2 - 6;
      boss.dir = -1;
    }
    boss.y = 96 + Math.sin(boss.t * 1.3) * 10;

    boss.fireTimer -= dt;
    if (boss.fireTimer <= 0) {
      boss.fireTimer = 1.6;
      for (const spread of [-0.42, 0, 0.42]) {
        this.enemyBullets.push({
          x: boss.x,
          y: boss.y + boss.h / 2,
          w: 6,
          h: 6,
          vx: Math.sin(spread) * ENEMY_BULLET_SPEED,
          vy: Math.cos(spread) * ENEMY_BULLET_SPEED,
        });
      }
    }

    boss.burstTimer -= dt;
    if (boss.burstTimer <= 0) {
      boss.burstTimer = 3.6;
      const p = this.player;
      for (let i = -2; i <= 2; i += 1) {
        const dx = p.x - boss.x + i * 26;
        const dy = Math.max(30, p.y - boss.y);
        const len = Math.hypot(dx, dy) || 1;
        this.enemyBullets.push({
          x: boss.x + i * 12,
          y: boss.y + boss.h / 2 - 8,
          w: 5,
          h: 5,
          vx: (dx / len) * ENEMY_BULLET_SPEED * 1.15,
          vy: (dy / len) * ENEMY_BULLET_SPEED * 1.15,
        });
      }
    }

    boss.dropTimer -= dt;
    if (boss.dropTimer <= 0) {
      boss.dropTimer = 8;
      this.dropPowerup(boss.x + rand(-40, 40), boss.y + boss.h / 2);
    }
  }

  updateBullets(dt) {
    for (let i = this.bullets.length - 1; i >= 0; i -= 1) {
      const b = this.bullets[i];
      b.y += b.vy * dt;
      if (b.y + b.h < 0) this.bullets.splice(i, 1);
    }
  }

  updateEnemyBullets(dt) {
    for (let i = this.enemyBullets.length - 1; i >= 0; i -= 1) {
      const b = this.enemyBullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.y - b.h > VIEW_H || b.y + b.h < 0 || b.x < -12 || b.x > VIEW_W + 12) {
        this.enemyBullets.splice(i, 1);
      }
    }
  }

  updatePowerups(dt) {
    for (let i = this.powerups.length - 1; i >= 0; i -= 1) {
      const u = this.powerups[i];
      u.t += dt;
      u.y += 74 * dt;
      if (u.y - u.h / 2 > VIEW_H) this.powerups.splice(i, 1);
    }
  }

  updateParticles(dt) {
    for (let i = this.particles.length - 1; i >= 0; i -= 1) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 90 * dt;
      p.life -= dt;
      if (p.life <= 0) this.particles.splice(i, 1);
    }
  }

  updatePopups(dt) {
    for (let i = this.popups.length - 1; i >= 0; i -= 1) {
      const s = this.popups[i];
      s.y -= 26 * dt;
      s.life -= dt;
      if (s.life <= 0) this.popups.splice(i, 1);
    }
  }

  updateWaveFlow(dt) {
    if (this.banner.t > 0) return;
    if (this.pendingWave) {
      this.enterWave(this.wave + 1);
      return;
    }
    if (!this.plan || this.plan.boss) return;

    if (this.remaining > 0) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        this.spawnTimer = this.plan.gap;
        this.remaining -= 1;
        this.spawnEnemy();
      }
      return;
    }
    if (this.enemies.length === 0 && this.enemyBullets.length === 0) {
      this.pendingWave = true;
      this.banner = { text: 'موج پاک شد', t: 1.4 };
    }
  }

  /* ---------- برخورد ---------- */

  resolveCollisions() {
    const p = this.player;

    for (let i = this.bullets.length - 1; i >= 0; i -= 1) {
      const b = this.bullets[i];
      let consumed = false;

      for (let j = this.enemies.length - 1; j >= 0; j -= 1) {
        const e = this.enemies[j];
        if (!hits(b, e)) continue;
        consumed = true;
        e.hp -= b.dmg;
        e.flash = 0.08;
        this.burst(b.x, b.y, 3, EXPLOSION_COLORS, 90);
        if (e.hp <= 0) this.killEnemy(j);
        else sfx.hit();
        break;
      }

      if (!consumed && this.boss && hits(b, this.boss)) {
        consumed = true;
        this.boss.hp -= b.dmg;
        this.boss.flash = 0.07;
        this.shake = Math.max(this.shake, 1.5);
        this.burst(b.x, b.y, 3, EXPLOSION_COLORS, 90);
        if (this.boss.hp <= 0) this.killBoss();
        else sfx.hit();
      }

      if (consumed) this.bullets.splice(i, 1);
    }

    for (let i = this.enemyBullets.length - 1; i >= 0; i -= 1) {
      if (hits(this.enemyBullets[i], p)) {
        this.enemyBullets.splice(i, 1);
        this.damagePlayer();
      }
    }

    for (let j = this.enemies.length - 1; j >= 0; j -= 1) {
      if (hits(this.enemies[j], p)) {
        this.burst(this.enemies[j].x, this.enemies[j].y, 8, EXPLOSION_COLORS, 130);
        this.enemies.splice(j, 1);
        this.damagePlayer();
      }
    }

    if (this.boss && !this.boss.entering && hits(this.boss, p)) this.damagePlayer();

    for (let i = this.powerups.length - 1; i >= 0; i -= 1) {
      if (hits(this.powerups[i], p)) {
        const type = this.powerups[i].type;
        this.powerups.splice(i, 1);
        this.applyPowerup(type);
      }
    }
  }

  killEnemy(index) {
    const e = this.enemies[index];
    this.enemies.splice(index, 1);
    this.score += e.score;
    this.popup(e.x, e.y, `+${fa(e.score)}`);
    this.burst(e.x, e.y, 10, EXPLOSION_COLORS, 150);
    this.shake = Math.max(this.shake, 2.5);
    sfx.explode();
    if (Math.random() < 0.12) this.dropPowerup(e.x, e.y);
    this.syncHud(true);
  }

  killBoss() {
    const boss = this.boss;
    if (!boss) return;
    const reward = 200 + this.wave * 30;
    this.score += reward;
    this.popup(boss.x, boss.y, `+${fa(reward)}`);
    this.shake = 18;
    sfx.bigExplode();
    for (let i = 0; i < 6; i += 1) {
      this.burst(boss.x + rand(-60, 60), boss.y + rand(-44, 44), 16, EXPLOSION_COLORS, 230);
    }
    this.dropPowerup(boss.x, boss.y + boss.h / 2);
    this.dropPowerup(boss.x - 44, boss.y + boss.h / 2);
    this.boss = null;
    this.enemies = [];
    this.enemyBullets = [];
    this.pendingWave = true;
    this.banner = { text: 'باس نابود شد', t: 1.8 };
    this.syncHud(true);
  }

  damagePlayer() {
    const p = this.player;
    if (this.over || p.invuln > 0) return;

    if (this.shield) {
      this.shield = false;
      p.invuln = 0.7;
      this.shake = Math.max(this.shake, 6);
      this.burst(p.x, p.y, 14, ['#5b8cc7', '#ffffff'], 160);
      sfx.hit();
      this.syncHud(true);
      return;
    }

    this.health -= 1;
    p.invuln = INVULN_TIME;
    this.shake = Math.max(this.shake, 9);
    this.burst(p.x, p.y, 12, ['#e26d6d', '#ffffff'], 150);
    sfx.hurt();
    this.syncHud(true);
    if (this.health <= 0) this.endGame();
  }

  applyPowerup(type) {
    const def = POWERUPS[type];
    sfx.powerup();
    this.burst(this.player.x, this.player.y, 12, [def.color, '#ffffff'], 140);
    this.popup(this.player.x, this.player.y - 26, def.label, def.color);

    if (type === 'rapid') this.rapid = 7;
    else if (type === 'double') this.double = 10;
    else if (type === 'shield') this.shield = true;
    else if (type === 'pulse') this.firePulse();

    this.syncHud(true);
  }

  firePulse() {
    this.shake = 12;
    sfx.pulse();
    let cleared = 0;
    for (let i = this.enemies.length - 1; i >= 0 && cleared < 8; i -= 1) {
      const e = this.enemies[i];
      this.score += e.score;
      this.burst(e.x, e.y, 10, EXPLOSION_COLORS, 180);
      this.enemies.splice(i, 1);
      cleared += 1;
    }
    if (this.boss) {
      this.boss.hp -= 18;
      this.boss.flash = 0.24;
      this.burst(this.boss.x, this.boss.y, 20, EXPLOSION_COLORS, 200);
      if (this.boss.hp <= 0) this.killBoss();
    }
    this.enemyBullets = [];
    this.syncHud(true);
  }

  endGame() {
    this.over = true;
    this.health = 0;
    this.shake = 16;
    this.burst(this.player.x, this.player.y, 40, EXPLOSION_COLORS, 260);
    sfx.bigExplode();
    sfx.gameOver();

    const result = submitScore(this.score);
    this.best = result.best;
    this.syncHud(true);
    this.onGameOver({ score: this.score, wave: this.wave, best: result.best, isNew: result.isNew });

    this.stop();
    this.render();
  }

  syncHud(force = false) {
    this.hudTick += 1;
    if (!force && this.hudTick % 6 !== 0) return;
    this.onHud({
      score: this.score,
      health: Math.max(0, this.health),
      maxHealth: MAX_HEALTH,
      wave: this.wave,
      best: this.best,
      shield: this.shield,
      rapid: this.rapid > 0,
      double: this.double > 0,
      boss: this.boss ? { hp: Math.max(0, this.boss.hp), max: this.boss.maxHp } : null,
    });
  }

  /* ---------- رندر ---------- */

  render() {
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#0a0a10';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    for (const star of this.stars) {
      ctx.fillStyle = star.z > 0.66 ? '#c9bdf0' : star.z > 0.33 ? '#9cc0e8' : '#4a4a58';
      const size = star.z > 0.66 ? 2 : 1;
      ctx.fillRect(Math.round(star.x), Math.round(star.y), size, size);
    }

    ctx.save();
    if (this.shake > 0.1) {
      const s = this.shake;
      ctx.translate(rand(-s, s), rand(-s, s));
    }

    for (const u of this.powerups) {
      const bob = Math.sin(u.t * 5) * 2;
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = POWERUPS[u.type].color;
      ctx.fillRect(Math.round(u.x - 8), Math.round(u.y + bob - 8), 16, 16);
      ctx.globalAlpha = 1;
      drawSprite(ctx, u.rows, u.x, u.y + bob, PIXEL);
    }

    for (const e of this.enemies) {
      drawSprite(ctx, e.rows, e.x, e.y, PIXEL);
      if (e.flash > 0) {
        ctx.globalAlpha = 0.75;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(Math.round(e.x - e.w / 2), Math.round(e.y - e.h / 2), e.w, e.h);
        ctx.globalAlpha = 1;
      }
    }

    const boss = this.boss;
    if (boss) {
      const pulse = boss.entering ? 1 : 0.6 + Math.sin(boss.t * 6) * 0.25;
      ctx.globalAlpha = 0.25 * pulse;
      ctx.fillStyle = boss.flash > 0 ? '#ffffff' : '#e26d6d';
      ctx.fillRect(Math.round(boss.x - boss.w / 2 - 5), Math.round(boss.y - boss.h / 2 - 5), boss.w + 10, boss.h + 10);
      ctx.globalAlpha = 1;
      drawSprite(ctx, boss.rows, boss.x, boss.y, boss.size);
      if (boss.flash > 0) {
        ctx.globalAlpha = 0.6;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(Math.round(boss.x - boss.w / 2), Math.round(boss.y - boss.h / 2), boss.w, boss.h);
        ctx.globalAlpha = 1;
      }
    }

    for (const b of this.enemyBullets) {
      ctx.fillStyle = '#e26d6d';
      ctx.fillRect(Math.round(b.x - b.w / 2), Math.round(b.y - b.h / 2), b.w, b.h);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(Math.round(b.x - 1), Math.round(b.y - 1), 2, 2);
    }

    for (const b of this.bullets) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(Math.round(b.x - b.w / 2), Math.round(b.y - b.h / 2), b.w, b.h);
      ctx.fillStyle = '#e0b45c';
      ctx.fillRect(Math.round(b.x - b.w / 2), Math.round(b.y - b.h / 2), b.w, 4);
    }

    const p = this.player;
    if (!this.over) {
      const flicker = Math.random() < 0.5 ? 0 : 2;
      ctx.fillStyle = '#ff9717';
      ctx.fillRect(Math.round(p.x - 3), Math.round(p.y + p.h / 2), 6, 5 + flicker);
      ctx.fillStyle = '#e0b45c';
      ctx.fillRect(Math.round(p.x - 1), Math.round(p.y + p.h / 2), 2, 4 + flicker);

      if (p.invuln > 0 && Math.floor(p.invuln * 12) % 2 === 0) ctx.globalAlpha = 0.35;
      drawSprite(ctx, PLAYER_PIXELS, p.x, p.y, PIXEL);
      ctx.globalAlpha = 1;

      if (this.shield) {
        ctx.strokeStyle = '#5b8cc7';
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.6 + Math.sin(Date.now() / 140) * 0.25;
        ctx.beginPath();
        ctx.arc(Math.round(p.x), Math.round(p.y), p.w * 0.9, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }

    for (const particle of this.particles) {
      ctx.globalAlpha = clamp(particle.life / particle.max, 0, 1);
      ctx.fillStyle = particle.color;
      ctx.fillRect(
        Math.round(particle.x),
        Math.round(particle.y),
        Math.ceil(particle.size),
        Math.ceil(particle.size),
      );
    }
    ctx.globalAlpha = 1;

    ctx.textAlign = 'center';
    ctx.direction = 'rtl';
    ctx.font = '700 12px Doran, Tahoma, sans-serif';
    for (const s of this.popups) {
      ctx.globalAlpha = clamp(s.life / s.max, 0, 1);
      ctx.fillStyle = s.color;
      ctx.fillText(s.text, Math.round(s.x), Math.round(s.y));
    }
    ctx.globalAlpha = 1;

    ctx.restore();

    if (this.banner.t > 0) {
      const alpha = clamp(this.banner.t / 0.45, 0, 1);
      ctx.globalAlpha = alpha * 0.62;
      ctx.fillStyle = '#0a0a10';
      ctx.fillRect(0, VIEW_H / 2 - 34, VIEW_W, 68);
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = '#e0b45c';
      ctx.lineWidth = 2;
      ctx.strokeRect(0.5, VIEW_H / 2 - 34.5, VIEW_W - 1, 67);
      ctx.fillStyle = '#e0b45c';
      ctx.font = '700 20px Doran, Tahoma, sans-serif';
      ctx.textAlign = 'center';
      ctx.direction = 'rtl';
      ctx.fillText(this.banner.text, VIEW_W / 2, VIEW_H / 2 + 7);
      ctx.globalAlpha = 1;
    }
  }
}

export default GameEngine;
