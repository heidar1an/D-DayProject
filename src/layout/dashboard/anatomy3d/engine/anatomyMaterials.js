/*
 * مواد سه‌بعدی آناتومی — یک نمونهٔ مشترک برای هر دسته (performance: هیچ تخصیصی در فریم).
 *
 * رنگ‌ها عیناً از متریال‌های واقعی Z-Anatomy (Assets/Models/1.0 Materials) برداشته شده
 * و مثل خود Z-Anatomy، لایه‌های پوشاننده (فاسیا، رباط، …) نیمه‌شفاف‌اند تا ساختارهای
 * زیرین — از جمله عضلات عمقی — قابل مشاهده باشند.
 *
 * سه حالت Default / Hover / Selected؛ جابه‌جایی حالت‌ها فقط swap مرجع متریال است.
 */

import * as THREE from 'three';

/* زبری پایه — کمی براق‌تر از مات تا relief عضله در نور دیده شود */
const ROUGHNESS = 0.68;
const METALNESS = 0.02;

/* دسته‌هایی که مثل Z-Anatomy نیمه‌شفاف رندر می‌شوند (α از فایل‌های .mat) */
const TRANSPARENT_CATS = {
  fasciae: 0.42,   /* Fascia.mat → a: 0.44 */
  ligaments: 0.5,  /* Ligament.mat → a: 0.44 */
  skin: 0.92,      /* پوست کمی رو‌ح‌دار تا لایهٔ زیرین حدس زده شود */
};

export function buildCategoryMaterials(colors) {
  const materials = { default: {}, hover: {}, selected: {} };

  for (const [catId, color] of Object.entries(colors)) {
    const base = new THREE.Color(color);
    const opacity = TRANSPARENT_CATS[catId] ?? 1;
    const transparent = opacity < 1;
    const extra = transparent
      ? { transparent: true, opacity, depthWrite: false }
      : {};

    materials.default[catId] = new THREE.MeshStandardMaterial({
      color: base,
      roughness: ROUGHNESS,
      metalness: METALNESS,
      ...extra,
    });

    /* Hover — روشن‌شدن ظریف بدون تغییر شدید رنگ */
    materials.hover[catId] = new THREE.MeshStandardMaterial({
      color: base.clone().lerp(new THREE.Color('#ffffff'), 0.22),
      roughness: ROUGHNESS,
      metalness: METALNESS,
      emissive: base,
      emissiveIntensity: 0.12,
      ...extra,
    });

    /* Selected — متمایز و واضح ولی حرفه‌ای؛ برای لایه‌های شفاف، پررنگ می‌شود */
    materials.selected[catId] = new THREE.MeshStandardMaterial({
      color: base.clone().lerp(new THREE.Color('#ffffff'), 0.28),
      roughness: ROUGHNESS,
      metalness: METALNESS,
      emissive: base,
      emissiveIntensity: transparent ? 0.5 : 0.38,
      transparent,
      opacity: transparent ? Math.min(1, opacity + 0.3) : 1,
      depthWrite: true,
    });
  }

  return materials;
}
