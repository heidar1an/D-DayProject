import { useEffect, useRef, useState } from 'react';
import Icon from './icons';

/* نمایشگر تصویر پزشکی: زوم، پن، چرخش، بازنشانی — با مودال انیمیشن‌دار */
export default function ImageViewer({ image, onClose }) {
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [rotation, setRotation] = useState(0);
  const dragRef = useRef(null);
  const stageRef = useRef(null);

  useEffect(() => {
    // هر تصویر تازه از حالت fit شروع می‌شود
    setScale(1);
    setOffset({ x: 0, y: 0 });
    setRotation(0);
  }, [image]);

  const zoomBy = (factor) => setScale((current) => Math.min(6, Math.max(1, current * factor)));

  const reset = () => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
    setRotation(0);
  };

  const toggleFullscreen = () => {
    const stage = stageRef.current;
    if (!stage) return;
    if (document.fullscreenElement) document.exitFullscreen();
    else stage.requestFullscreen?.();
  };

  const onPointerDown = (event) => {
    if (scale <= 1) return;
    dragRef.current = { startX: event.clientX - offset.x, startY: event.clientY - offset.y };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event) => {
    if (!dragRef.current) return;
    setOffset({
      x: event.clientX - dragRef.current.startX,
      y: event.clientY - dragRef.current.startY,
    });
  };

  const onPointerUp = () => {
    dragRef.current = null;
  };

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') onClose();
      if (event.key === '+' || event.key === '=') zoomBy(1.25);
      if (event.key === '-') zoomBy(0.8);
      if (event.key === '0') reset();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!image) return null;

  return (
    <div className="rdr-viewer" role="dialog" aria-modal="true" aria-label="نمایشگر تصویر" onClick={onClose}>
      <div className="rdr-viewer__stage" ref={stageRef} onClick={(event) => event.stopPropagation()}>
        <div className="rdr-viewer__bar">
          <strong>{image.caption ?? 'تصویر'}</strong>
          <div className="rdr-viewer__tools">
            <button type="button" className="rdr-icon-btn" onClick={() => zoomBy(1.25)} title="بزرگ‌نمایی (+)" aria-label="بزرگ‌نمایی">
              <Icon name="plus" />
            </button>
            <span className="rdr-viewer__scale">{toFaPercent(scale)}</span>
            <button type="button" className="rdr-icon-btn" onClick={() => zoomBy(0.8)} title="کوچک‌نمایی (−)" aria-label="کوچک‌نمایی">
              <Icon name="minus" />
            </button>
            <button type="button" className="rdr-icon-btn" onClick={reset} title="اندازه اصلی (0)" aria-label="اندازه اصلی">
              <Icon name="fit" />
            </button>
            <button type="button" className="rdr-icon-btn" onClick={() => setRotation((r) => (r + 90) % 360)} title="چرخش" aria-label="چرخش تصویر">
              <Icon name="rotate" />
            </button>
            <button type="button" className="rdr-icon-btn" onClick={toggleFullscreen} title="تمام‌صفحه" aria-label="تمام‌صفحه">
              <Icon name="expand" />
            </button>
            <button type="button" className="rdr-icon-btn" onClick={onClose} title="بستن (Esc)" aria-label="بستن نمایشگر">
              <Icon name="close" />
            </button>
          </div>
        </div>

        <div
          className={`rdr-viewer__canvas ${scale > 1 ? 'is-pannable' : ''}`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
          onWheel={(event) => {
            if (Math.abs(event.deltaY) > 8) zoomBy(event.deltaY < 0 ? 1.08 : 0.92);
          }}
          onDoubleClick={() => setScale((current) => (current > 1.5 ? 1 : 2.4))}
        >
          <img
            src={image.src}
            alt={image.alt ?? ''}
            draggable={false}
            style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale}) rotate(${rotation}deg)` }}
          />
        </div>

        {image.caption && <p className="rdr-viewer__caption">{image.caption}</p>}
      </div>
    </div>
  );
}

const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const toFaPercent = (value) => `${String(Math.round(value * 100)).replace(/\d/g, (d) => FA_DIGITS[Number(d)])}٪`;
