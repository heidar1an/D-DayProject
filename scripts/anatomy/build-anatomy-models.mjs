/*
 * build-anatomy-models — تبدیل مدل‌های FBX پروژه Z-Anatomy به GLB بهینه برای WebGL
 * و تولید manifest ساختارهای آناتومیک.
 *
 * ورودی:  Z-Anatomy-Beta/Assets/Models/1.0 Models/*.fbx   (۹ سیستم آناتومیک)
 *         Z-Anatomy-Beta/Assets/Models/Layers/*.txt        (دسته‌بندی واقعی Z-Anatomy)
 * خروجی:  public/anatomy/models/<slug>.glb                 (فشرده meshopt)
 *         public/anatomy/manifest.json                     (سیستم‌ها + دسته هر ساختار + bbox)
 *
 * اجرا:  node scripts/anatomy/build-anatomy-models.mjs
 */

import fbx2gltf from 'fbx2gltf';
const convert = fbx2gltf; // ماژول CJS — تابع تبدیل خودِ default export است
import { NodeIO } from '@gltf-transform/core';
import { EXTMeshoptCompression, KHRMeshQuantization } from '@gltf-transform/extensions';
import { weld, prune, dedup } from '@gltf-transform/functions';
import { MeshoptEncoder } from 'meshoptimizer';
import { readdirSync, readFileSync, writeFileSync, mkdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const FBX_DIR = join(ROOT, 'Z-Anatomy-Beta', 'Assets', 'Models', '1.0 Models');
const LAYERS_DIR = join(ROOT, 'Z-Anatomy-Beta', 'Assets', 'Models', 'Layers');
const OUT_DIR = join(ROOT, 'public', 'anatomy');
const MODELS_DIR = join(OUT_DIR, 'models');
const TMP_DIR = join(ROOT, 'node_modules', '.cache', 'anatomy-fbx');

/* ── تعریف سیستم‌ها: فایل FBX ← واحد بارگذاری Viewer ───────────────────────── */
const SYSTEMS = [
  { slug: 'skeletal',    fbx: 'SkeletalSystem100.fbx',                        label: 'Skeletal system',        fa: 'دستگاه اسکلتی' },
  { slug: 'muscular',    fbx: 'MuscularSystem100.fbx',                        label: 'Muscular system',        fa: 'دستگاه عضلانی' },
  { slug: 'nervous',     fbx: 'NervousSystem100.fbx',                         label: 'Nervous system',         fa: 'دستگاه عصبی' },
  { slug: 'cardio',      fbx: 'CardioVascular41.fbx',                         label: 'Cardiovascular system',  fa: 'دستگاه قلبی‌عروقی' },
  { slug: 'visceral',    fbx: 'VisceralSystem100.fbx',                        label: 'Visceral system',        fa: 'احشا' },
  { slug: 'joints',      fbx: 'Joints100.fbx',                                label: 'Joints & ligaments',     fa: 'مفاصل و رباط‌ها' },
  { slug: 'lymph',       fbx: 'LymphoidOrgans100.fbx',                        label: 'Lymphoid system',        fa: 'دستگاه لنفی' },
  { slug: 'regions',     fbx: 'Regions of human body100.fbx',                 label: 'Body regions (skin)',    fa: 'نواحی بدن (پوست)' },
  { slug: 'refs',        fbx: 'Reference lines, planes and movements 1.fbx',  label: 'Reference planes',       fa: 'خطوط و صفحات مرجع' },
];

/* پسوندهای فنی گره‌ها — مبنای گروه‌بندی به «ساختار» */
const AUX_RE = /\.(t|j|i|s|g)$/;          // زیرمش‌های سطح/مفصلی/گروهی
const ORIGIN_ENDING_RE = /^(.+)\.(o|e)(\d*)(r|l)$/; // origin/ending عضله: BaseName.o1r
const SIDE_RE = /\.(r|l)$/;               // راست/چپ
const UNDERSCORE_RE = /_/;                // قرارداد دوم نام‌گذاری: Masseteric_fasciar

/* ── ۱) دسته‌بندی واقعی Z-Anatomy از فایل‌های Layers ───────────────────────── */
function readLayerCategories() {
  /** نام دقیق خط txt → {cat, depth} */
  const map = new Map();
  /** نام پایه (بدون هر پسوند کوتاه نقطه‌دار: .r/.l/.g/.t/.o1r/…) → cat */
  const baseIndex = new Map();
  for (const dir of readdirSync(LAYERS_DIR)) {
    const dirPath = join(LAYERS_DIR, dir);
    try { if (!statSync(dirPath).isDirectory()) continue; } catch { continue; }
    const cat = dir.toLowerCase(); // Bones, Muscles, ... → bones, muscles
    for (const file of readdirSync(dirPath).filter((f) => f.endsWith('.txt'))) {
      const depth = parseInt(file.match(/-(\d+)\.txt$/)?.[1] ?? '0', 10);
      const lines = readFileSync(join(dirPath, file), 'utf8').split(/\r?\n/).filter(Boolean);
      for (let i = 1; i < lines.length; i++) {
        const name = lines[i].trim();
        if (!name) continue;
        if (!map.has(name)) map.set(name, { cat, depth });
        for (const base of baseCandidates(name)) {
          if (!baseIndex.has(base)) baseIndex.set(base, cat);
        }
      }
    }
  }
  return { map, baseIndex };
}

/* فرم‌های پایهٔ یک نام txt — برای تطبیق قراردادهای مختلف نام‌گذاری FBX */
function baseCandidates(name) {
  const stripped = name.replace(/\.[a-z0-9]{1,4}$/i, ''); // .r / .g / .o1r / …
  const out = new Set();
  for (const v of [name, stripped]) {
    const lower = v.toLowerCase();
    out.add(lower);
    out.add(lower.replace(/_/g, ' '));
  }
  return out;
}

/*
 * همان نرمال‌سازی نامی که GLTFLoader سه‌جی‌اس روی نودها انجام می‌دهد
 * (PropertyBinding.sanitizeNodeName): فاصله → زیرخط، حذف . [ ] : /
 * کلیدهای manifest باید با همین فرم ساخته شوند تا lookup در runtime مستقیم بخورد.
 */
function sanitizeThreeName(name) {
  return name.replace(/\s/g, '_').replace(/[\[\].:/]/g, '');
}

/**
 * یک نام گره را به ساختار والدش تحویل می‌کند. دو قرارداد نام‌گذاری Z-Anatomy پشتیبانی
 * می‌شوند: «Base.r/.t/…» و «Base_with_underscoresr» (سمت با حرف پایانی بدون نقطه).
 * تشخیص سمت در قرارداد دوم فقط وقتی پذیرفته می‌شود که نام پایه در txt تأیید شود.
 * خروجی: {base, side, cat} یا null (اگر هیچ گره اصلی در زنجیره والد نباشد)
 */
function resolveNodeName(rawName, layerMap, baseIndex, systemSlug, seen = new Set()) {
  if (seen.has(rawName)) return null;
  seen.add(rawName);

  const tryMatch = (name) => {
    /* ۱) origin/ending عضله */
    const oe = name.match(ORIGIN_ENDING_RE);
    if (oe) {
      const base = oe[1].replace(/_/g, ' ');
      const cat = baseIndex.get(base.toLowerCase());
      return { base, side: oe[oe.length - 1].toUpperCase(), cat: cat ?? null, matched: !!cat };
    }

    /* حذف شمارهٔ قطعهٔ انتهایی: "Urogenital regionr 1" → "Urogenital regionr" */
    const noPiece = name.replace(/[\s_-]+\d+$/, '');

    /* ۲) تطبیق مستقیم با txt (خام یا با فاصله به‌جای زیرخط) */
    const flat = noPiece.replace(/_/g, ' ');
    const direct = layerMap.get(noPiece) ?? layerMap.get(flat);
    if (direct) {
      const side = SIDE_RE.test(noPiece) ? noPiece.match(SIDE_RE)[1].toUpperCase() : null;
      return { base: baseOfDisplay(noPiece), side, cat: direct.cat, matched: true };
    }
    /* ۳) نام پایهٔ نقطه‌دار در baseIndex */
    const dotSide = SIDE_RE.test(noPiece);
    const dotBase = noPiece.replace(SIDE_RE, '').replace(/_/g, ' ');
    const dotCat = baseIndex.get(dotBase.toLowerCase());
    if (dotCat) {
      return { base: dotBase, side: dotSide ? noPiece.match(SIDE_RE)[1].toUpperCase() : null, cat: dotCat, matched: true };
    }
    /* ۴) سمت با حرف پایانی بی‌نقطه: "Urogenital regionr" → "Urogenital region" + R
       (با تأیید نام پایه در txt؛ در نبود آن با کلیدواژه/سیستم) */
    const cand = flat.trim();
    if (/[a-z][rl]$/i.test(cand) && cand.length > 5) {
      const stripped = cand.slice(0, -1).trim();
      if (stripped.length >= 5) {
        const catV = baseIndex.get(stripped.toLowerCase());
        const cat = catV ?? fallbackKeyword(stripped);
        if (cat) return { base: stripped, side: cand.slice(-1).toUpperCase(), cat, matched: !!catV };
      }
    }
    /* ۵) پایهٔ با شمارهٔ قطعه، بدون سمت */
    const flatBase = baseOfDisplay(noPiece);
    const catB = baseIndex.get(flatBase.toLowerCase());
    if (catB) return { base: flatBase, side: null, cat: catB, matched: true };
    return null;
  };

  const hit = tryMatch(rawName);
  if (hit) {
    return hit.matched ? hit : { ...hit, cat: fallbackKeyword(hit.base) ?? fallbackSystem(systemSlug) };
  }

  /* زیرمش فنی (.t/.j/…) — از گره اصلی والد ارث می‌برد */
  if (AUX_RE.test(rawName)) {
    const stripped = rawName.replace(AUX_RE, '');
    const inherited = tryMatch(stripped) ?? resolveNodeName(stripped, layerMap, baseIndex, systemSlug, seen);
    if (inherited) return inherited;
  }
  return null;
}

function baseOfDisplay(name) {
  return name.replace(SIDE_RE, '').replace(/_/g, ' ');
}

function fallbackKeyword(name) {
  const n = name.toLowerCase();
  if (/\bartery\b|\barterial\b|branch of middle cerebral|\bcoronary\b/.test(n)) return 'arteries';
  if (/\bnerve\b|\bnerves\b|\bsulcus\b/.test(n)) return 'nerves';
  if (/\bsinus\b/.test(n)) return 'veins'; // سینوس‌های سخت‌شامه، وریدی هستند
  if (/ligament/.test(n)) return 'ligaments';
  if (/\bbone\b|\bcells of ethmoid\b/.test(n)) return 'bones';
  if (/\bmuscle\b|\btendon\b/.test(n)) return 'muscles';
  if (/fascia/.test(n)) return 'fasciae';
  if (/perionyx/.test(n)) return 'skin';
  return null;
}

function fallbackSystem(systemSlug) {
  const bySystem = {
    refs: 'refs',
    regions: 'skin',
    lymph: 'lymph',
    visceral: 'viscera',
    joints: 'ligaments',
  };
  return bySystem[systemSlug] ?? 'other';
}

/* ── ۲) تبدیل یک FBX به GLB بهینه ─────────────────────────────────────────── */

/*
 * حذف مارکرهای زائد FBX قبل از بهینه‌سازی:
 *   ۱) «خط‌های مویی» — مارکرهای .j (محور مفصل/خط استخوانی) با ضخامت زیر ۱.۵mm که
 *      در صحنه مثل خط‌های بیرون‌زده از بدن دیده می‌شوند. سیستم refs مستثناست چون
 *      خطوط و صفحات مرجع، خودِ محتوای آموزشی آن سیستم هستند.
 *   ۲) مارکرهای دورافتاده — گره‌هایی خارج از محدودهٔ بدن (مثل Vertebral column.j در z≈-7m).
 */
function stripJunkMarkers(doc, { keepRefs = true } = {}) {
  const THIN = 0.0015;
  const LONG = 0.02;
  const BOUNDS = { x: 2.5, yMin: -0.6, yMax: 2.6, z: 2.5 };
  let removed = 0;
  const removedNames = new Set();

  for (const node of [...doc.getRoot().listNodes()]) {
    const mesh = node.getMesh();
    if (!mesh) continue;
    const raw = (node.getName() ?? '').trim();
    if (!raw) continue;

    const isRefs = keepRefs && raw.toLowerCase().includes('ref');
    const isMarker = /j$/i.test(raw.replace(/\s/g, '_')); // پسوند .j بعد از sanitize

    /* محور world برای بررسی موقعیت/ابعاد */
    let hasSize = false;
    let minD = Infinity, maxD = 0;
    let cx = 0, cy = 0, cz = 0;

    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute('POSITION');
      if (!pos) continue;
      const pMin = pos.getMin([0, 0, 0]) ?? [0, 0, 0];
      const pMax = pos.getMax([0, 0, 0]) ?? [0, 0, 0];
      /* ۸ گوشه AABB محلی ← world */
      const wmArr = node.getWorldMatrix();
      let lmin = [Infinity, Infinity, Infinity], lmax = [-Infinity, -Infinity, -Infinity];
      for (let c = 0; c < 8; c++) {
        const p = [c & 1 ? pMax[0] : pMin[0], c & 2 ? pMax[1] : pMin[1], c & 4 ? pMax[2] : pMin[2], 1];
        const w = [0, 0, 0];
        for (let r = 0; r < 3; r++) w[r] = wmArr[r * 4] * p[0] + wmArr[r * 4 + 1] * p[1] + wmArr[r * 4 + 2] * p[2] + wmArr[r * 4 + 3];
        for (let a = 0; a < 3; a++) {
          lmin[a] = Math.min(lmin[a], w[a]);
          lmax[a] = Math.max(lmax[a], w[a]);
        }
      }
      const d = [lmax[0] - lmin[0], lmax[1] - lmin[1], lmax[2] - lmin[2]];
      minD = Math.min(minD, ...d);
      maxD = Math.max(maxD, ...d);
      cx = (lmin[0] + lmax[0]) / 2; cy = (lmin[1] + lmax[1]) / 2; cz = (lmin[2] + lmax[2]) / 2;
      hasSize = true;
    }
    if (!hasSize) continue;

    const isHairline = isMarker && minD < THIN && maxD > LONG;
    const isFar = Math.abs(cx) > BOUNDS.x || Math.abs(cz) > BOUNDS.z || cy < BOUNDS.yMin || cy > BOUNDS.yMax;

    if (isFar || (isHairline && !isRefs)) {
      const parent = node.getParentNode();
      if (parent) parent.removeChild(node);
      removed += 1;
      removedNames.add(raw);
    }
  }
  return { removed, removedNames: [...removedNames] };
}

async function optimizeToGlb(srcGlb, outPath, systemSlug) {
  await MeshoptEncoder.ready;
  const io = new NodeIO()
    .registerExtensions([EXTMeshoptCompression, KHRMeshQuantization])
    .registerDependencies({ 'meshopt.encoder': MeshoptEncoder });

  const doc = await io.read(srcGlb);
  const junk = stripJunkMarkers(doc, { keepRefs: systemSlug === 'refs' });
  await doc.transform(weld(), dedup(), prune());

  doc.createExtension(EXTMeshoptCompression)
    .setRequired(true)
    .setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });

  await io.write(outPath, doc);
  return { doc, junk };
}

/* bbox در فضای world — با three.js (مرجع حقیقت رندر؛ GLTFLoader خودش dequantize را اعمال می‌کند) */
async function computeBBox(rawGlbPath) {
  const { readFileSync } = await import('node:fs');
  const THREE = await import('three');
  const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
  const buf = readFileSync(rawGlbPath);
  const arrayBuf = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  const gltf = await new Promise((res, rej) => new GLTFLoader().parse(arrayBuf, '', res, rej));
  const box = new THREE.Box3().setFromObject(gltf.scene);
  const min = box.min.toArray();
  const max = box.max.toArray();
  return { min, max };
}

/* دسته جایگزین — اول کلیدواژه‌ای، بعد بر اساس سیستم مبدأ (فایل FBX) */
function fallbackCategory(name, systemSlug) {
  return fallbackKeyword(name) ?? fallbackSystem(systemSlug);
}

/* ── ۳) main ──────────────────────────────────────────────────────────────── */
mkdirSync(MODELS_DIR, { recursive: true });
mkdirSync(TMP_DIR, { recursive: true });

console.log('⏳ reading Z-Anatomy layer categories…');
const { map: layerMap, baseIndex } = readLayerCategories();
console.log(`   ${layerMap.size} entries from Layers/*.txt`);

const manifest = { version: 1, units: null, systems: [], structures: {} };
const stats = [];

for (const sys of SYSTEMS) {
  const fbxPath = join(FBX_DIR, sys.fbx);
  const tmpGlb = join(TMP_DIR, `${sys.slug}-raw.glb`);
  const outGlb = join(MODELS_DIR, `${sys.slug}.glb`);

  console.log(`⏳ converting ${sys.fbx} …`);
  await convert(fbxPath, tmpGlb, ['--pbr-metallic-roughness', '--no-flip-v']);

  const { doc, junk } = await optimizeToGlb(tmpGlb, outGlb, sys.slug);
  if (junk.removed > 0) console.log(`   🧹 ${junk.removed} مارکر زائد حذف شد`);
  const bbox = await computeBBox(tmpGlb);
  const bytes = statSync(outGlb).size;

  manifest.systems.push({ id: sys.slug, file: `models/${sys.slug}.glb`, label: sys.label, labelFa: sys.fa, bytes, bbox: { min: bbox.min, max: bbox.max } });

  /* تحویل هر گرهٔ مش به ساختار والدش — کلید با فرمت sanitize سه‌جی‌اس ذخیره می‌شود */
  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh();
    if (!mesh) continue;
    const raw = (node.getName() ?? '').trim();
    if (!raw || raw === 'RootNode') continue;
    const key = sanitizeThreeName(raw);
    if (manifest.structures[key]) continue;

    const resolved = resolveNodeName(raw, layerMap, baseIndex, sys.slug)
      ?? resolveAncestor(node, layerMap, baseIndex, sys.slug)
      ?? { base: raw.replace(/_/g, ' '), side: null, cat: fallbackCategory(raw, sys.slug) };

    manifest.structures[key] = [resolved.base, resolved.side, resolved.cat];
  }

  let tris = 0;
  let meshCount = 0;
  for (const node of doc.getRoot().listNodes()) {
    const m = node.getMesh();
    if (!m) continue;
    meshCount += 1;
    for (const prim of m.listPrimitives()) {
      const idx = prim.getIndices();
      tris += Math.round((idx ? idx.getCount() : prim.getAttribute('POSITION').getCount()) / 3);
    }
  }
  stats.push({ sys: sys.slug, bytes: `${(bytes / 1048576).toFixed(1)}MB`, meshes: meshCount, tris });
  console.log(`   ✓ ${sys.slug}: ${(bytes / 1048576).toFixed(1)}MB, ${meshCount} meshes, ${Math.round(tris / 1000)}k tris`);
}

/* اگر خود گره حل نشد، نزدیک‌ترین جدِ قابل‌حل را پیدا می‌کند (زیرمش‌های تودرتو) */
function resolveAncestor(node, layerMap, baseIndex, systemSlug) {
  let parent = node.getParentNode();
  while (parent) {
    const pname = (parent.getName() ?? '').trim();
    if (pname && pname !== 'RootNode') {
      const hit = resolveNodeName(pname, layerMap, baseIndex, systemSlug);
      if (hit) return hit;
    }
    parent = parent.getParentNode();
  }
  return null;
}

/* یکسان‌سازی واحدها: همه سیستم‌ها باید هم‌مقیاس باشند — بازه کلی را ذخیره می‌کنیم */
const globalMin = [Infinity, Infinity, Infinity];
const globalMax = [-Infinity, -Infinity, -Infinity];
for (const s of manifest.systems) {
  for (let a = 0; a < 3; a++) {
    globalMin[a] = Math.min(globalMin[a], s.bbox.min[a]);
    globalMax[a] = Math.max(globalMax[a], s.bbox.max[a]);
  }
}
manifest.units = { min: globalMin, max: globalMax };

const manifestPath = join(OUT_DIR, 'manifest.json');
writeFileSync(manifestPath, JSON.stringify(manifest));

const catCounts = {};
for (const [, , c] of Object.values(manifest.structures)) catCounts[c] = (catCounts[c] ?? 0) + 1;
const sideCounts = { r: 0, l: 0, none: 0 };
for (const [, s] of Object.values(manifest.structures)) sideCounts[s ? 'yes' : 'none'] = (sideCounts[s ? 'yes' : 'none'] ?? 0) + 1;

console.log('\n✅ build complete');
console.table(stats);
console.log('structure categories:', catCounts);
console.log('side-resolved:', sideCounts);
console.log(`manifest: ${(statSync(manifestPath).size / 1024).toFixed(0)}KB → ${manifestPath}`);
