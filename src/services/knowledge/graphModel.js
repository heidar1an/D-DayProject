/* ── موتور خالص «شبکه دانش» (Knowledge Graph Engine) ──
   هیچ state و وابستگی UI ندارد؛ همهٔ توابع داده را پارامتر می‌گیرند.
   همین قرارداد در نسخهٔ بک‌اند به endpoint تبدیل می‌شود (BFS مسیر و توپولوژیک
   مسیر یادگیری سمت سرور هم قابل اجراست). */

import { relationLabel, nodeTypeMeta } from './graphData';

/* ─────────────────────────── نرمال‌سازی متن ───────────────────────────
   همان قواعد جست‌وجوی تپش: ی/ك عربی → فارسی، آ→ا، حذف اعراب، ارقام → لاتین. */
const DIACRITICS = /[\u064B-\u0652\u0670\u0640]/g;
const NON_WORD = /[^a-z0-9\u0600-\u06FF ]+/g;

export const normalize = (text) =>
  String(text ?? '')
    .toLowerCase()
    .replace(/[يى]/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ؤ/g, 'و')
    .replace(DIACRITICS, '')
    .replace(/\u200c/g, ' ')
    .replace(NON_WORD, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/* فاصلهٔ لونشتاین برای جست‌وجوی حروف‌گردی */
const editDistance = (a, b) => {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > 2) return 3;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const cur = [i];
    for (let j = 1; j <= b.length; j += 1) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
};

/* ─────────────────────────── ساخت شاخص گراف ───────────────────────────
   buildGraph یک‌بار در بوت اجرا می‌شود؛ افزودن نود/یال فقط یعنی بازسازی آن. */
export function buildGraph(nodes, edges) {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));

  /* روابط خروجی و ورودی هر نود — برای همسایگی بدون‌جهت + فهرست ارتباطات جهت‌دار */
  const outEdges = new Map();
  const inEdges = new Map();
  edges.forEach((edge) => {
    if (!nodeById.has(edge.source) || !nodeById.has(edge.target)) return;
    if (!outEdges.has(edge.source)) outEdges.set(edge.source, []);
    if (!inEdges.has(edge.target)) inEdges.set(edge.target, []);
    outEdges.get(edge.source).push(edge);
    inEdges.get(edge.target).push(edge);
  });

  /* همسایه‌های بدون‌جهت با شکل یکسان: { node, edge, direction } */
  const neighborsOf = (nodeId) => {
    const result = [];
    (outEdges.get(nodeId) ?? []).forEach((edge) => {
      result.push({ node: nodeById.get(edge.target), edge, direction: 'out' });
    });
    (inEdges.get(nodeId) ?? []).forEach((edge) => {
      result.push({ node: nodeById.get(edge.source), edge, direction: 'in' });
    });
    return result.filter((entry) => entry.node);
  };

  /* درجهٔ بدون‌جهت — برای اندازهٔ نود در گراف */
  const degreeOf = (nodeId) =>
    (outEdges.get(nodeId)?.length ?? 0) + (inEdges.get(nodeId)?.length ?? 0);

  return { nodes, edges, nodeById, outEdges, inEdges, neighborsOf, degreeOf };
}

/* ─────────────────────────── اکتشاف ارتباطات (N-Hop) ───────────────────────────
   Relationship Explorer: نودهای تا عمق hop از یک نود + یال‌های داخلی همان زیرگراف.
   خروجی برای هایلایت در Graph View و شمارش «۱-هاپ / ۲-هاپ / ۳-هاپ». */
export function getNeighborhood(graph, nodeId, hops = 1) {
  const visited = new Map([[nodeId, 0]]);
  const frontier = [nodeId];

  for (let depth = 0; depth < hops; depth += 1) {
    const next = [];
    frontier.forEach((id) => {
      graph.neighborsOf(id).forEach(({ node }) => {
        if (!visited.has(node.id)) {
          visited.set(node.id, depth + 1);
          next.push(node.id);
        }
      });
    });
    frontier.length = 0;
    frontier.push(...next);
  }

  const nodeIds = [...visited.keys()];
  const nodeSet = new Set(nodeIds);
  const edges = graph.edges.filter((edge) => nodeSet.has(edge.source) && nodeSet.has(edge.target));
  return { nodeIds, nodeSet, edges, depthByNode: visited };
}

/* ─────────────────────────── مسیر بین دو مفهوم (Path View) ───────────────────────────
   BFS بدون‌جهت برای کوتاه‌ترین مسیر مفهومی؛ یال‌ها با جهت و برچسب علمی گزارش می‌شوند. */
export function findPath(graph, fromId, toId) {
  if (fromId === toId) return fromId ? [graph.nodeById.get(fromId)] : [];
  if (!graph.nodeById.has(fromId) || !graph.nodeById.has(toId)) return [];

  const prev = new Map([[fromId, null]]);
  const queue = [fromId];

  while (queue.length > 0) {
    const current = queue.shift();
    if (current === toId) break;
    graph.neighborsOf(current).forEach(({ node, edge, direction }) => {
      if (prev.has(node.id)) return;
      prev.set(node.id, { from: current, edge, direction });
      queue.push(node.id);
    });
  }

  if (!prev.has(toId)) return [];

  /* بازسازی مسیر از مقصد به مبدأ */
  const steps = [];
  let cursor = toId;
  while (cursor !== fromId) {
    const back = prev.get(cursor);
    steps.unshift({ node: graph.nodeById.get(cursor), edge: back.edge, direction: back.direction, from: back.from });
    cursor = back.from;
  }
  steps.unshift({ node: graph.nodeById.get(fromId), edge: null, direction: null, from: null });
  return steps;
}

/* ─────────────────────────── مسیر یادگیری (Learning Path) ───────────────────────────
   از گراف پیش‌نیازها (نه ترتیب فصل‌های کتاب): همهٔ پیش‌نیازهای تراگذریِ مفهوم هدف
   جمع و توپولوژیک مرتب می‌شوند؛ مفاهیم بنیادی اول، هدف آخر. */
export function computeLearningPath(graph, targetId) {
  const target = graph.nodeById.get(targetId);
  if (!target) return { steps: [], target: null };

  /* DFS از پیش‌نیازها به پایین؛ همان مرتب‌سازی توپولوژیک پس‌از-پردازش */
  const ordered = [];
  const visiting = new Set();
  const done = new Set();

  const visit = (nodeId) => {
    if (done.has(nodeId) || visiting.has(nodeId)) return;
    visiting.add(nodeId);
    (graph.nodeById.get(nodeId)?.prerequisites ?? []).forEach(visit);
    visiting.delete(nodeId);
    done.add(nodeId);
    ordered.push(nodeId);
  };
  visit(targetId);

  /* سهم هر گام در مسیر: از پیش‌نیاز مستقیمِ کدام گام‌های بعدی است */
  const requiredBy = new Map();
  ordered.forEach((nodeId) => {
    (graph.nodeById.get(nodeId)?.prerequisites ?? []).forEach((prereqId) => {
      if (!requiredBy.has(prereqId)) requiredBy.set(prereqId, []);
      requiredBy.get(prereqId).push(nodeId);
    });
  });

  return {
    target,
    steps: ordered.map((nodeId, index) => ({
      node: graph.nodeById.get(nodeId),
      order: index + 1,
      isTarget: nodeId === targetId,
      /* این گام برای فهم کدام گام بعدی لازم است */
      feedsInto: (requiredBy.get(nodeId) ?? [])
        .filter((id) => ordered.indexOf(id) > index)
        .map((id) => graph.nodeById.get(id))
        .slice(0, 2),
    })),
  };
}

/* پیش‌نیازهای مستقیم و وابسته‌ها (چه مفاهیمی روی این مفهوم سوارند) */
export function getPrerequisites(graph, nodeId) {
  return (graph.nodeById.get(nodeId)?.prerequisites ?? [])
    .map((id) => graph.nodeById.get(id))
    .filter(Boolean);
}

export function getDependents(graph, nodeId) {
  return graph.nodes.filter((node) => (node.prerequisites ?? []).includes(nodeId));
}

/* ─────────────────────────── جست‌وجو و پیشنهاد ───────────────────────────
   عنوان فارسی/انگلیسی > مترادف > مخفف > کلیدواژه؛ ضعیف‌ترین حالت با حروف‌گردی. */
export function searchNodes(graph, query, { limit = 8 } = {}) {
  const phrase = normalize(query);
  if (!phrase) return [];

  const scored = [];
  graph.nodes.forEach((node) => {
    const title = normalize(node.title);
    const english = normalize(node.englishTitle);
    let score = 0;

    if (title === phrase) score = 1000;
    else if (title.startsWith(phrase)) score = 860;
    else if (title.includes(phrase)) score = 720;
    else if (english === phrase) score = 900;
    else if (english.startsWith(phrase)) score = 800;
    else if (english.includes(phrase)) score = 650;
    else if ((node.aliases ?? []).some((alias) => normalize(alias).includes(phrase))) score = 480;
    else if ((node.keywords ?? []).some((keyword) => normalize(keyword).includes(phrase))) score = 300;

    /* جایگاه علمی: اهمیت فقط نتایج واقعاً مرتبط را بالا می‌برد */
    if (score > 0) score += node.importance * 4;
    if (score > 0) scored.push({ node, score });
  });

  scored.sort((a, b) => b.score - a.score || b.node.importance - a.node.importance);

  /* هیچ تطبیق مستقیمی نبود؟ حروف‌گردی روی عنوان‌ها */
  if (scored.length === 0) {
    const fuzzy = [];
    graph.nodes.forEach((node) => {
      const tokens = tokenize(phrase);
      const labelTokens = [...tokenize(node.title), ...tokenize(node.englishTitle)];
      let best = Infinity;
      tokens.forEach((token) => {
        if (token.length < 3) return;
        const allowed = token.length >= 6 ? 2 : 1;
        labelTokens.forEach((labelToken) => {
          const distance = editDistance(token, labelToken);
          if (distance > 0 && distance <= allowed) best = Math.min(best, distance);
        });
      });
      if (best !== Infinity) fuzzy.push({ node, score: -best });
    });
    fuzzy.sort((a, b) => b.score - a.score);
    return fuzzy.slice(0, limit);
  }

  return scored.slice(0, limit);
}

const tokenize = (text) => (normalize(text) ? normalize(text).split(' ') : []);

/* پیشنهادهای مرتبط با یک نود — برای نتایج جست‌وجو و پنل جزئیات */
export function getRelatedSuggestions(graph, nodeId, { limit = 4 } = {}) {
  return graph
    .neighborsOf(nodeId)
    .sort((a, b) => b.node.importance - a.node.importance)
    .slice(0, limit)
    .map(({ node }) => node);
}

/* ─────────────────────────── آمار و دسته‌بندی ─────────────────────────── */

export function getGraphStats(graph) {
  const byCourse = {};
  const byType = {};
  graph.nodes.forEach((node) => {
    (node.courses ?? []).forEach((course) => {
      byCourse[course] = (byCourse[course] ?? 0) + 1;
    });
    byType[node.type] = (byType[node.type] ?? 0) + 1;
  });
  return {
    nodes: graph.nodes.length,
    edges: graph.edges.length,
    byCourse,
    byType,
    /* مفاهیم بین‌درسی — همان‌هایی که شبکه را معنادار می‌کنند */
    interdisciplinary: graph.nodes.filter((node) => (node.courses ?? []).length > 1).length,
  };
}

/* درس‌های مرتبط با یک نود با برچسب */
export const nodeCourses = (node) => node?.courses ?? [];

/* ─────────────────────────── چیدمان نیرویی (Force Layout) ───────────────────────────
   ساده، قطعی و بدون وابستگی: دافعهٔ کولنی + فنر یال‌ها + گرانش مرکز.
   با seed ثابت اجرا می‌شود تا چیدمان بین رندرها پایدار بماند؛ نتیجه نرمال‌سازی
   می‌شود به یک باکس با ابعاد معلوم تا Zoom/Fit ساده باشد. */

const mulberry32 = (seed) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

export function computeLayout(graph, { width = 1200, height = 900, seed = 42, iterations = 320 } = {}) {
  const rand = mulberry32(seed);
  const nodes = graph.nodes.map((node, index) => {
    const angle = (index / graph.nodes.length) * Math.PI * 2;
    const ring = 0.35 + rand() * 0.12;
    return {
      id: node.id,
      x: Math.cos(angle) * width * ring,
      y: Math.sin(angle) * height * ring,
    };
  });

  const nodeIndex = new Map(nodes.map((node, index) => [node.id, index]));
  const degrees = new Map(nodes.map((node) => [node.id, graph.degreeOf(node.id)]));
  const edges = graph.edges
    .filter((edge) => nodeIndex.has(edge.source) && nodeIndex.has(edge.target))
    .map((edge) => [nodeIndex.get(edge.source), nodeIndex.get(edge.target)]);

  const repulsion = 26000;
  const springLength = 190;
  const springStrength = 0.015;
  const gravity = 0.012;

  for (let step = 0; step < iterations; step += 1) {
    /* دافعه — O(n²) برای شبکه‌های چندصدتایی قابل‌قبول است */
    for (let i = 0; i < nodes.length; i += 1) {
      for (let j = i + 1; j < nodes.length; j += 1) {
        const dx = nodes[j].x - nodes[i].x;
        const dy = nodes[j].y - nodes[i].y;
        const distanceSq = dx * dx + dy * dy || 1;
        const distance = Math.sqrt(distanceSq);
        const force = repulsion / distanceSq;
        const fx = (dx / distance) * force;
        const fy = (dy / distance) * force;
        nodes[i].x -= fx * 0.5;
        nodes[i].y -= fy * 0.5;
        nodes[j].x += fx * 0.5;
        nodes[j].y += fy * 0.5;
      }
    }

    /* فنر یال‌ها */
    edges.forEach(([a, b]) => {
      const dx = nodes[b].x - nodes[a].x;
      const dy = nodes[b].y - nodes[a].y;
      const distance = Math.sqrt(dx * dx + dy * dy) || 1;
      const force = (distance - springLength) * springStrength;
      const fx = (dx / distance) * force;
      const fy = (dy / distance) * force;
      nodes[a].x += fx;
      nodes[a].y += fy;
      nodes[b].x -= fx;
      nodes[b].y -= fy;
    });

    /* گرانش مرکز + میرایی تدریجی */
    const damping = 1 - step / iterations;
    nodes.forEach((node) => {
      node.x *= 1 - gravity;
      node.y *= 1 - gravity;
      /* نودهای پرترافیک کمی به مرکز کشیده می‌شوند — هاب‌ها وسط نقشه می‌نشینند */
      const pull = (degrees.get(node.id) ?? 0) * 0.0004 * damping;
      node.x -= node.x * pull;
      node.y -= node.y * pull;
    });
  }

  /* نرمال‌سازی به باکس مشخص با حاشیهٔ ثابت */
  const padding = 140;
  const minX = Math.min(...nodes.map((n) => n.x)) - padding;
  const maxX = Math.max(...nodes.map((n) => n.x)) + padding;
  const minY = Math.min(...nodes.map((n) => n.y)) - padding;
  const maxY = Math.max(...nodes.map((n) => n.y)) + padding;
  const scaleX = width / (maxX - minX || 1);
  const scaleY = height / (maxY - minY || 1);
  const scale = Math.min(scaleX, scaleY);

  const positions = {};
  nodes.forEach((node) => {
    positions[node.id] = {
      x: (node.x - minX) * scale,
      y: (node.y - minY) * scale,
    };
  });

  return { positions, width, height };
}

/* شعاع نمایش نود: اهمیت + درجه — تفاوت ظریف، نه شلوغی */
export const nodeRadius = (node, degree) => 13 + Math.min(node.importance, 5) * 1.8 + Math.min(degree, 8) * 0.9;

/* برچسب رابطه برای نمایش کنار یال */
export const edgeLabel = (edge) => relationLabel(edge.type);

/* متادیتای نوع نود */
export const nodeTypeOf = (node) => nodeTypeMeta(node?.type);
