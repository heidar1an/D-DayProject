/*
 * پوستهٔ React بازی: HUD، کنترل‌های لمسی، و صفحهٔ پایان.
 * خودِ منطق بازی در `pixelGameEngine.js` است؛ اینجا فقط نمایش و ورودی.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { GameEngine, VIEW_W, VIEW_H } from './pixelGameEngine';
import './easterEgg.css';

const EMPTY_HUD = {
  score: 0,
  health: 5,
  maxHealth: 5,
  wave: 1,
  best: 0,
  shield: false,
  rapid: false,
  double: false,
  boss: null,
};

const FA_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
function fa(value) {
  return String(value).replace(/\d/g, (digit) => FA_DIGITS[Number(digit)]);
}

function pad(value, size = 5) {
  return fa(String(value).padStart(size, '0'));
}

export default function TapeshPixelGame({ onExit }) {
  const canvasRef = useRef(null);
  const stageRef = useRef(null);
  const engineRef = useRef(null);
  const dragRef = useRef(false);
  const [hud, setHud] = useState(EMPTY_HUD);
  const [result, setResult] = useState(null);
  const [scale, setScale] = useState(1);

  /* ساخت موتور — یک بار در طول عمرِ این کامپوننت */
  useEffect(() => {
    const engine = new GameEngine({
      canvas: canvasRef.current,
      onHud: setHud,
      onGameOver: setResult,
    });
    engineRef.current = engine;
    engine.start();

    return () => {
      engine.destroy();
      engineRef.current = null;
    };
  }, []);

  /* مقیاسِ صحیح (integer) تا پیکسل‌ها تار نشوند */
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return undefined;

    const measure = () => {
      const rect = stage.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const raw = Math.min(rect.width / VIEW_W, rect.height / VIEW_H);
      setScale(raw >= 1 ? Math.floor(raw) : Math.max(0.4, raw));
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);

  const press = useCallback((action, active) => (event) => {
    event.preventDefault();
    const engine = engineRef.current;
    if (!engine) return;
    engine.setInput(action, active);
    if (active && event.currentTarget.setPointerCapture) {
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        /* بعضی مرورگرها در لمسِ چندنقطه‌ای خطا می‌دهند؛ بی‌اهمیت است */
      }
    }
  }, []);

  const pointerToLogical = useCallback((event) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width) return null;
    return ((event.clientX - rect.left) / rect.width) * VIEW_W;
  }, []);

  const handleDragStart = useCallback(
    (event) => {
      const engine = engineRef.current;
      if (!engine) return;
      event.preventDefault();
      dragRef.current = true;
      const x = pointerToLogical(event);
      if (x != null) engine.setInput('pointer', x);
      engine.setInput('shoot', true); // یک‌دستی: کشیدن = حرکت + شلیک
      if (event.currentTarget.setPointerCapture) {
        try {
          event.currentTarget.setPointerCapture(event.pointerId);
        } catch {
          /* بی‌اهمیت */
        }
      }
    },
    [pointerToLogical],
  );

  const handleDragMove = useCallback(
    (event) => {
      if (!dragRef.current) return;
      const engine = engineRef.current;
      if (!engine) return;
      const x = pointerToLogical(event);
      if (x != null) engine.setInput('pointer', x);
    },
    [pointerToLogical],
  );

  const handleDragEnd = useCallback(() => {
    if (!dragRef.current) return;
    dragRef.current = false;
    const engine = engineRef.current;
    if (!engine) return;
    engine.setInput('pointer', null);
    engine.setInput('shoot', false);
  }, []);

  const handleRestart = useCallback(() => {
    setResult(null);
    setHud((current) => ({ ...current, score: 0, health: EMPTY_HUD.maxHealth, wave: 1 }));
    engineRef.current?.restart();
  }, []);

  const boss = hud.boss;

  return (
    <div className="eg-game">
      <div className="eg-hud">
        <div className="eg-hud__row">
          <span className="eg-hud__chip eg-hud__chip--score" aria-label="امتیاز">
            {pad(hud.score)}
          </span>
          <span className="eg-hud__chip eg-hud__chip--wave" aria-label="موج">
            موج {fa(hud.wave)}
          </span>
          <span className="eg-hud__chip eg-hud__chip--best" aria-label="رکورد">
            رکورد {pad(hud.best)}
          </span>
        </div>

        <div className="eg-hud__row eg-hud__row--sub">
          <span className="eg-hearts" aria-label={`جان: ${fa(hud.health)} از ${fa(hud.maxHealth)}`}>
            {Array.from({ length: hud.maxHealth }, (_, index) => (
              <span key={index} className={`eg-heart ${index < hud.health ? 'is-on' : ''}`} aria-hidden="true">
                ♥
              </span>
            ))}
          </span>

          <span className="eg-buffs">
            {hud.rapid && <span className="eg-buff eg-buff--rapid">شلیک سریع</span>}
            {hud.double && <span className="eg-buff eg-buff--double">دوگانه</span>}
            {hud.shield && <span className="eg-buff eg-buff--shield">سپر</span>}
          </span>
        </div>

        {boss && (
          <div className="eg-bossbar" aria-label="جان باس">
            <span className="eg-bossbar__fill" style={{ width: `${(boss.hp / boss.max) * 100}%` }} />
          </div>
        )}
      </div>

      <div
        className="eg-stage"
        ref={stageRef}
        onPointerDown={handleDragStart}
        onPointerMove={handleDragMove}
        onPointerUp={handleDragEnd}
        onPointerCancel={handleDragEnd}
        onPointerLeave={handleDragEnd}
        onContextMenu={(event) => event.preventDefault()}
      >
        <div className="eg-screen" style={{ width: VIEW_W * scale, height: VIEW_H * scale }}>
          <canvas
            ref={canvasRef}
            className="eg-canvas"
            width={VIEW_W}
            height={VIEW_H}
            tabIndex={-1}
            aria-label="بازی پیکسلی تپش"
          />
          <span className="eg-scanlines" aria-hidden="true" />

          {result && (
            <div
              className="eg-over"
              role="dialog"
              aria-modal="true"
              aria-label="پایان بازی"
              onPointerDown={(event) => event.stopPropagation()}
            >
              <p className="eg-over__title">GAME OVER</p>
              {result.isNew && <p className="eg-over__badge">NEW HIGH SCORE!</p>}
              <dl className="eg-over__stats">
                <div>
                  <dt>امتیاز</dt>
                  <dd>{fa(result.score)}</dd>
                </div>
                <div>
                  <dt>موج</dt>
                  <dd>{fa(result.wave)}</dd>
                </div>
                <div>
                  <dt>رکورد</dt>
                  <dd>{fa(result.best)}</dd>
                </div>
              </dl>
              <div className="eg-over__actions">
                <button type="button" className="eg-btn eg-btn--primary" onClick={handleRestart} aria-label="بازی دوباره">
                  PLAY AGAIN
                </button>
                <button type="button" className="eg-btn" onClick={onExit} aria-label="خروج از بازی">
                  EXIT
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="eg-controls" aria-label="کنترل‌های لمسی">
        <button
          type="button"
          className="eg-pad"
          aria-label="حرکت به چپ"
          onPointerDown={press('left', true)}
          onPointerUp={press('left', false)}
          onPointerCancel={press('left', false)}
          onPointerLeave={press('left', false)}
          onContextMenu={(event) => event.preventDefault()}
        >
          ◀
        </button>
        <button
          type="button"
          className="eg-pad eg-pad--fire"
          aria-label="شلیک"
          onPointerDown={press('shoot', true)}
          onPointerUp={press('shoot', false)}
          onPointerCancel={press('shoot', false)}
          onPointerLeave={press('shoot', false)}
          onContextMenu={(event) => event.preventDefault()}
        >
          FIRE
        </button>
        <button
          type="button"
          className="eg-pad"
          aria-label="حرکت به راست"
          onPointerDown={press('right', true)}
          onPointerUp={press('right', false)}
          onPointerCancel={press('right', false)}
          onPointerLeave={press('right', false)}
          onContextMenu={(event) => event.preventDefault()}
        >
          ▶
        </button>
      </div>
    </div>
  );
}
