/*
 * AnatomyEngine — هستهٔ نمایش سه‌بعدی آناتومی تپش (فاز اول: Viewer).
 *
 * موتور مستقل از React است؛ UI فقط از طریق متدهای عمومی و callback ها با آن حرف می‌زند
 * تا state های React هیچ‌وقت باعث re-render صحنهٔ سه‌بعدی نشوند.
 *
 * ویژگی‌ها:
 *   - OrbitControls (چرخش/زوم/پن، لمس و موس) + رندر بر تقاضا (بدون لوپ بی‌دلیل)
 *   - بارگذاری تدریجی سیستم‌ها بر اساس ترتیب اولویت + درصد پیشرفت واقعی بایت
 *   - ساخت «ثبت ساختارها» از نام گره‌های Z-Anatomy (پسوندهای فنی سمت و origin/ending)
 *   - Hover / Selected با swap متریال مشترک، Raycast محدود به مش‌های قابل انتخاب
 *   - نمای جلو/عقب/چپ/راست/ریست + فوکوس نرم دوربین روی ساختار جست‌وجوشده
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { buildCategoryMaterials } from './anatomyMaterials.js';
import { ANATOMY_CATEGORIES, resolveDisplayCategory } from '../data/anatomyCategories.js';
import { persianOf } from '../data/persianNames.js';

/* ── قواعد نام‌گذاری Z-Anatomy ────────────────────────────────────────────── */
const SIDE_RE = /\.(r|l)$/;                              // پسوند راست/چپ
const GROUP_RE = /\.(t|j|i|s|g)$/;                       // زیرمش فنی سطح/مفصل/گروه
const ORIGIN_ENDING_RE = /^(.+)\.[oe]\d*(r|l)$/;         // origin/ending عضله

const norm = (s) => (s ?? '').trim();

const isMainName = (name) => !GROUP_RE.test(name) && !ORIGIN_ENDING_RE.test(name);
const sideOf = (name) => (SIDE_RE.test(name) ? (name.match(SIDE_RE)[1].toUpperCase()) : null);
const baseOf = (name) => name.replace(SIDE_RE, '');

/* کلید یکتای ساختار: نام پایه + سمت */
const keyOf = (base, side) => `${base.toLowerCase()}|${side ?? ''}`;

/* ── دوربین: مقاصد نمای استاندارد (مدل 1.75m ایستاده در مبدأ) ─────────────── */
const BODY_CENTER = new THREE.Vector3(0, 0.92, 0);
const BODY_HEIGHT = 1.8;
const VIEWS = {
  front: { pos: [0, 0.95, 3.6] },
  back: { pos: [0, 0.95, -3.6] },
  left: { pos: [3.6, 0.95, 0] },
  right: { pos: [-3.6, 0.95, 0] },
  reset: { pos: [0.35, 1.25, 3.9], target: [0, 0.92, 0] },
};

export class AnatomyEngine {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {object} handlers  { onProgress, onReady, onError, onHover, onSelect, onLoadingDone }
   */
  constructor(canvas, handlers = {}) {
    this.canvas = canvas;
    this.handlers = handlers;
    this.disposed = false;

    this.renderer = null;
    this.scene = null;
    this.camera = null;
    this.controls = null;
    this.raycaster = new THREE.Raycaster();
    this.pointerNdc = new THREE.Vector2();
    this.pointerDirty = false;
    this.lastRaycastAt = 0;

    this.manifest = null;
    this.loader = null;

    /** کلید ساختار → { key, label, side, cat, selectable, meshes[], fa, bbox } */
    this.structures = new Map();
    /** نام پایه + سمت → دستهٔ نمایشی؛ ساخته‌شده از manifest قبل از لود */
    this.categoryIndex = new Map();
    /** دستهٔ نمایشی → Set(کلید ساختار) برای toggle سریع */
    this.categoryStructures = new Map();
    /** مش‌های قابل انتخاب و آشکار — بازسازی با هر تغییر visibility */
    this.pickables = [];

    this.visibility = {};
    this.hoveredKey = null;
    this.selectedKey = null;

    this.materials = null;
    this.systemsLoaded = 0;
    this.bytesLoaded = 0;
    this.bytesTotal = 0;

    this.tween = null;
    this.needsRender = true;
    this.frameId = 0;
    this.clock = new THREE.Clock();
  }

  /* ── چرخهٔ حیات ─────────────────────────────────────────────────────────── */

  async init() {
    try {
      this.initScene();
      await this.loadManifest();
      this.buildCategoryIndex();
      await this.loadAllSystems();
      this.handlers.onLoadingDone?.();
    } catch (err) {
      console.error('[Anatomy] بارگذاری مدل آناتومی با خطا مواجه شد:', err);
      this.handlers.onError?.(err?.message ?? 'خطای ناشناخته در بارگذاری مدل');
    }
  }

  initScene() {
    const canvas = this.canvas;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(40, 1, 0.05, 60);
    this.camera.position.set(...VIEWS.reset.pos);

    /* نورپردازی مطالعهٔ آناتومیک: آمبینس ملایم + کلید قوی برای relief عضلات + پرکننده و ریم */
    const hemi = new THREE.HemisphereLight(0xffffff, 0x525c6b, 0.85);
    this.scene.add(hemi);
    const key = new THREE.DirectionalLight(0xffffff, 2.4);
    key.position.set(3, 5, 4);
    this.scene.add(key);
    const fill = new THREE.DirectionalLight(0xdde6f0, 0.6);
    fill.position.set(-4, 2.5, -3);
    this.scene.add(fill);
    const rim = new THREE.DirectionalLight(0xf2f6ff, 0.85);
    rim.position.set(-1.5, 3.2, -4);
    this.scene.add(rim);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.target.copy(BODY_CENTER);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.screenSpacePanning = true;
    this.controls.minDistance = 0.12;
    this.controls.maxDistance = 14;
    this.controls.addEventListener('change', () => { this.needsRender = true; });

    this.materials = buildCategoryMaterials(this.categoryColors());
    /* متریال fallback — اگر دسته‌ای رنگ نداشت صحنه سیاه نشود */
    this.fallbackMaterial = new THREE.MeshStandardMaterial({ color: 0xb9bec7, roughness: 0.85 });
    this.attachPointerHandlers();
    this.resize();
    window.addEventListener('resize', this.resize);
    this.startLoop();
  }

  categoryColors() {
    if (!this._catColors) {
      this._catColors = {};
      for (const cat of ANATOMY_CATEGORIES) this._catColors[cat.id] = cat.color;
    }
    return this._catColors;
  }

  resize = () => {
    const width = this.canvas.clientWidth || 1;
    const height = this.canvas.clientHeight || 1;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.needsRender = true;
  };

  /* ── داده ──────────────────────────────────────────────────────────────── */

  async loadManifest() {
    const res = await fetch('/anatomy/manifest.json');
    if (!res.ok) throw new Error(`manifest در دسترس نیست (HTTP ${res.status})`);
    this.manifest = await res.json();
    this.bytesTotal = this.manifest.systems.reduce((s, sys) => s + sys.bytes, 0);
  }

  /**
   * ایندکس دسته از manifest.structures — build script هر نام مش را به
   * [نام پایه، سمت، دستهٔ بومی] تحویل کرده؛ اینجا دستهٔ نمایشی از آن ساخته می‌شود.
   */
  buildCategoryIndex() {
    const records = this.manifest.structures ?? {};
    for (const [base, side, rawCat] of Object.values(records)) {
      const cat = resolveDisplayCategory(rawCat, base);
      this.categoryIndex.set(keyOf(base, side), cat);
      this.categoryIndex.set(keyOf(base, null), cat);
    }
  }

  async loadAllSystems() {
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    this.loader = loader;

    /* بارگذاری با پهنای باند کنترل‌شده: دو سیستم هم‌زمان، به ترتیب اولویت */
    const queue = [...this.manifest.systems];
    const workers = Array.from({ length: 2 }, () => this.drainQueue(queue));
    await Promise.all(workers);
  }

  async drainQueue(queue) {
    while (queue.length > 0 && !this.disposed) {
      const system = queue.shift();
      await this.loadSystem(system);
    }
  }

  loadSystem(system) {
    return new Promise((resolve) => {
      const finish = (gltf) => {
        try {
          this.integrateSystem(system, gltf);
          this.systemsLoaded += 1;
          this.handlers.onReady?.({
            systemsLoaded: this.systemsLoaded,
            totalSystems: this.manifest.systems.length,
          });
        } catch (err) {
          console.error(`[Anatomy] خطا در پردازش سیستم ${system.id}:`, err);
        }
        resolve();
      };
      this.loader.load(
        /* فایل‌های مدل در public/anatomy/ سرو می‌شوند؛ مسیر manifest نسبت به همان پوشه است */
        `/anatomy/${String(system.file).replace(/^\/+/, '')}`,
        finish,
        (xhr) => {
          if (this.disposed) return;
          const loaded = this.bytesLoaded + xhr.loaded;
          const pct = this.bytesTotal > 0 ? Math.min(100, (loaded / this.bytesTotal) * 100) : 0;
          this.handlers.onProgress?.({
            percent: pct,
            systemLabel: system.labelFa,
            systemIndex: this.systemsLoaded,
          });
        },
        (err) => {
          console.error(`[Anatomy] خطا در بارگذاری ${system.file}:`, err);
          resolve();
        },
      );
    });
  }

  /* ── ساخت ثبت ساختارها از گره‌های GLB ───────────────────────────────────── */

  integrateSystem(system, gltf) {
    this.scene.add(gltf.scene);

    gltf.scene.traverse((node) => {
      if (!node.isMesh) return;
      const rawName = norm(node.name);
      if (!rawName) return;

      const resolved = this.resolveStructureNode(node, rawName);
      if (!resolved) return;
      const { base, side, selectable, mainRawName } = resolved;

      const key = keyOf(base, side);
      let structure = this.structures.get(key);
      if (!structure) {
        const cat = this.categoryIndex.get(keyOf(base, side))
          ?? this.categoryIndex.get(keyOf(base, null))
          ?? 'other';
        structure = {
          key,
          label: base,
          side,
          cat,
          selectable,
          fa: persianOf(base),
          meshes: [],
          bbox: null,
          origin: { system: system.id, node: mainRawName },
        };
        this.structures.set(key, structure);
        if (!this.categoryStructures.has(cat)) this.categoryStructures.set(cat, new Set());
        this.categoryStructures.get(cat).add(key);
      }
      if (!selectable) structure.selectable = false;

      structure.meshes.push(node);
      node.userData.structureKey = key;
      node.visible = this.isVisible(structure);
      node.material = this.materialFor(structure);
    });

    this.rebuildPickables();
    this.needsRender = true;
  }

  /**
   * گرهٔ مش را به ساختار والدش نگاشت می‌کند. منبع اصلی: manifest.structures که
   * build script با تأیید فایل‌های Layers ساخته است (کلیدها با فرمت sanitize
   * سه‌جی‌اس؛ GLTFLoader هم نام نودها را با همین قانون تغییر می‌دهد).
   * قواعد محلی فقط fallback اند.
   */
  resolveStructureNode(node, rawName) {
    /* GLTFLoader برای نودهای هم‌نام پسوند _N می‌سازد؛ قبل از lookup تراشیده می‌شود */
    const record = this.manifest.structures?.[rawName]
      ?? this.manifest.structures?.[rawName.replace(/_\d+$/, '')];
    if (record) {
      return {
        base: record[0],
        side: record[1],
        selectable: !GROUP_RE.test(rawName),
        mainRawName: rawName,
      };
    }

    const originEnding = rawName.match(ORIGIN_ENDING_RE);
    if (originEnding) {
      return {
        base: originEnding[1],
        side: originEnding[2].toUpperCase(),
        selectable: true,
        mainRawName: rawName,
      };
    }

    if (isMainName(rawName)) {
      return {
        base: baseOf(rawName),
        side: sideOf(rawName),
        selectable: true,
        mainRawName: rawName,
      };
    }

    /* زیرمش فنی: نزدیک‌ترین جد اصلی */
    let parent = node.parent;
    while (parent) {
      const pname = norm(parent.name);
      if (pname && pname !== 'RootNode' && isMainName(pname)) {
        return {
          base: baseOf(pname),
          side: sideOf(pname),
          selectable: true,
          mainRawName: pname,
        };
      }
      parent = parent.parent;
    }

    /* گروه یا یتیم — بدون ساختار والد */
    return {
      base: rawName,
      side: null,
      selectable: !GROUP_RE.test(rawName),
      mainRawName: rawName,
    };
  }

  /* ── visibility و متریال ───────────────────────────────────────────────── */

  isVisible(structure) {
    return this.visibility[structure.cat] !== false;
  }

  materialFor(structure) {
    const mats = this.materials;
    const group = structure.key === this.selectedKey ? mats.selected
      : structure.key === this.hoveredKey ? mats.hover
        : mats.default;
    return group[structure.cat] ?? this.fallbackMaterial;
  }

  applyStructureMaterial(structure) {
    const mat = this.materialFor(structure);
    for (const mesh of structure.meshes) mesh.material = mat;
  }

  setCategoryVisible(catId, visible) {
    this.visibility[catId] = visible;
    const keys = this.categoryStructures.get(catId);
    if (keys) {
      for (const key of keys) {
        const structure = this.structures.get(key);
        if (!structure) continue;
        for (const mesh of structure.meshes) mesh.visible = visible;
        if (!visible && structure.key === this.hoveredKey) this.setHover(null);
        if (!visible && structure.key === this.selectedKey) this.select(null);
      }
    }
    this.rebuildPickables();
    this.needsRender = true;
  }

  applyVisibilityMap(map) {
    this.visibility = { ...map };
    for (const structure of this.structures.values()) {
      const visible = this.isVisible(structure);
      for (const mesh of structure.meshes) mesh.visible = visible;
    }
    if (this.hoveredKey && !this.isVisible(this.structures.get(this.hoveredKey))) this.setHover(null);
    if (this.selectedKey && !this.isVisible(this.structures.get(this.selectedKey))) this.select(null);
    this.rebuildPickables();
    this.needsRender = true;
  }

  rebuildPickables() {
    const list = [];
    for (const structure of this.structures.values()) {
      if (!structure.selectable || !this.isVisible(structure)) continue;
      for (const mesh of structure.meshes) {
        mesh.matrixWorldNeedsUpdate = true;
        list.push(mesh);
      }
    }
    this.pickables = list;
  }

  /* ── hover / select ────────────────────────────────────────────────────── */

  setHover(key) {
    if (key === this.hoveredKey) return;
    const prev = this.structures.get(this.hoveredKey);
    if (prev) this.applyStructureMaterial(prev);
    this.hoveredKey = key;
    const next = this.structures.get(key);
    if (next) this.applyStructureMaterial(next);
    this.needsRender = true;
    this.handlers.onHover?.(next ?? null);
  }

  select(key) {
    if (key === this.selectedKey) return;
    const prev = this.structures.get(this.selectedKey);
    if (prev) this.applyStructureMaterial(prev);
    this.selectedKey = key ?? null;
    const next = this.structures.get(this.selectedKey);
    if (next) this.applyStructureMaterial(next);
    this.needsRender = true;
    this.handlers.onSelect?.(next ?? null);
  }

  structureByKey(key) {
    return this.structures.get(key) ?? null;
  }

  /* ── pointer و raycast ─────────────────────────────────────────────────── */

  attachPointerHandlers() {
    const canvas = this.canvas;
    let downX = 0;
    let downY = 0;
    let downTime = 0;

    canvas.addEventListener('pointermove', (e) => {
      const rect = canvas.getBoundingClientRect();
      this.pointerNdc.set(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1,
      );
      this.pointerDirty = true;
    });

    canvas.addEventListener('pointerleave', () => {
      this.pointerDirty = false;
      this.setHover(null);
    });

    canvas.addEventListener('pointerdown', (e) => {
      downX = e.clientX;
      downY = e.clientY;
      downTime = performance.now();
      this.cancelTween(); /* لمس کاربر هر انیمیشن دوربین را قطع می‌کند */
    });

    canvas.addEventListener('pointerup', (e) => {
      /* کلیک واقعی، نه پایان درگ */
      const moved = Math.hypot(e.clientX - downX, e.clientY - downY);
      if (moved > 6 || performance.now() - downTime > 450) return;
      const hit = this.raycastAt(this.pointerNdc);
      this.select(hit ? hit.key : null);
    });
  }

  raycastAt(ndc) {
    if (this.pickables.length === 0) return null;
    this.raycaster.setFromCamera(ndc, this.camera);
    const hits = this.raycaster.intersectObjects(this.pickables, false);
    for (const hit of hits) {
      const key = hit.object.userData.structureKey;
      if (!key) continue;
      const structure = this.structures.get(key);
      if (structure?.selectable && this.isVisible(structure)) return structure;
    }
    return null;
  }

  /* ── حلقهٔ رندر بر تقاضا ────────────────────────────────────────────────── */

  startLoop() {
    let errored = false;
    const loop = () => {
      if (this.disposed) return;
      this.frameId = requestAnimationFrame(loop);
      if (errored) return;

      try {
        /* hover فقط با ترد مقایسه می‌شود (حداکثر هر ~70ms) */
        const now = performance.now();
        if (this.pointerDirty && now - this.lastRaycastAt > 70) {
          this.lastRaycastAt = now;
          this.pointerDirty = false;
          const hit = this.raycastAt(this.pointerNdc);
          this.setHover(hit ? hit.key : null);
          this.canvas.style.cursor = hit ? 'pointer' : 'grab';
        }

        if (this.tween) this.stepTween();
        if (this.controls.enableDamping) this.controls.update();
        if (this.needsRender) {
          this.renderer.render(this.scene, this.camera);
          this.needsRender = false;
        }
      } catch (err) {
        /* خطای حلقهٔ رندر را یک‌بار چاپ می‌کنیم — سکوت کامل دیباگ را غیرممکن می‌کند */
        errored = true;
        console.error('[Anatomy] خطا در حلقهٔ رندر:', err);
      }
    };
    this.frameId = requestAnimationFrame(loop);
  }

  /* ── دوربین: نمای‌ها و فوکوس ────────────────────────────────────────────── */

  setView(name) {
    const view = VIEWS[name] ?? VIEWS.reset;
    this.animateCamera(
      new THREE.Vector3(...view.pos),
      new THREE.Vector3(...(view.target ?? [0, 0.92, 0])),
      650,
    );
  }

  focusStructure(key, { zoom = 3.1 } = {}) {
    const structure = this.structures.get(key);
    if (!structure || structure.meshes.length === 0) return;

    if (!structure.bbox) {
      const box = new THREE.Box3();
      const tmp = new THREE.Box3();
      for (const mesh of structure.meshes) {
        if (!mesh.visible) continue;
        tmp.setFromObject(mesh);
        box.union(tmp);
      }
      if (box.isEmpty()) {
        for (const mesh of structure.meshes) {
          tmp.setFromObject(mesh);
          box.union(tmp);
        }
      }
      structure.bbox = box;
    }

    const center = structure.bbox.getCenter(new THREE.Vector3());
    const size = structure.bbox.getSize(new THREE.Vector3()).length() || 0.3;
    /* فاصلهٔ مناسب برای قاب‌بندی ساختار */
    const dir = new THREE.Vector3().subVectors(this.camera.position, this.controls.target).normalize();
    if (dir.lengthSq() < 0.5) dir.set(0.25, 0.15, 1).normalize();
    const pos = center.clone().add(dir.multiplyScalar(size * zoom + 0.12));
    this.animateCamera(pos, center, 750);
  }

  animateCamera(toPos, toTarget, durationMs) {
    this.tween = {
      fromPos: this.camera.position.clone(),
      fromTarget: this.controls.target.clone(),
      toPos: toPos.clone(),
      toTarget: toTarget.clone(),
      start: performance.now(),
      duration: durationMs,
    };
  }

  stepTween() {
    const t = this.tween;
    const raw = (performance.now() - t.start) / t.duration;
    if (raw >= 1) {
      this.camera.position.copy(t.toPos);
      this.controls.target.copy(t.toTarget);
      this.tween = null;
    } else {
      const k = raw < 0.5 ? 4 * raw ** 3 : 1 - (-2 * raw + 2) ** 3 / 2; /* easeInOutCubic */
      this.camera.position.lerpVectors(t.fromPos, t.toPos, k);
      this.controls.target.lerpVectors(t.fromTarget, t.toTarget, k);
    }
    this.camera.lookAt(this.controls.target);
    this.needsRender = true;
  }

  cancelTween() {
    this.tween = null;
  }

  /* ── جست‌وجو ───────────────────────────────────────────────────────────── */

  listStructures() {
    return [...this.structures.values()];
  }

  /* ── تخریب ─────────────────────────────────────────────────────────────── */

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    window.removeEventListener('resize', this.resize);
    this.controls?.dispose();
    this.scene?.traverse((node) => {
      if (node.isMesh) {
        node.geometry?.dispose?.();
      }
    });
    for (const group of Object.values(this.materials ?? {})) {
      for (const mat of Object.values(group)) mat?.dispose?.();
    }
    this.fallbackMaterial?.dispose?.();
    this.renderer?.dispose();
  }
}
