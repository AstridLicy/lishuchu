/* ============================================================
   过往文章 · 3D 山水探索
   把平面山水画 + AI 深度图，渲染成可旋转/缩放/平移的立体浮雕，
   并在画中埋设文章锚点。
   ============================================================ */

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const SITE = window.SITE;
const PAINT = SITE.painting;
const ARTICLES = SITE.articles || [];

/* —— 可调参数 —— */
const PLANE_W = 16;                       // 画平面宽度（世界单位）
const ASPECT_IMG = 941 / 1672;            // 画作高/宽
const PLANE_H = PLANE_W * ASPECT_IMG;
const SEG_X = 320, SEG_Y = 180;           // 网格细分（越高越细腻）
const DISPLACE = 2.5;                      // 立体起伏强度（略降，减小孤立物体被拉成的尖壁）
const SEG_DIST = { min: 3, max: 24 };      // 缩放范围（min 越小可凑得越近看细节）
const NORMAL_STRENGTH = 2.6;               // 由深度图生成法线的强度（立体感主要靠它，转视角不会线条化）
const DEPTH_BLUR = 11;                      // 深度图平滑半径（越大越柔；避免人物/桃花等小物体转视角时线条化）
const FOCUS_DIST = 6;                      // 点击锚点后聚焦的镜头距离
const OVERVIEW_DIST = 15.5;                // 全景镜头距离

const stage = document.getElementById("stage");
const anchorLayer = document.getElementById("anchors");
const loadingEl = document.getElementById("loading");

/* —— 画布尺寸（仅占导航下方区域，而非整窗）—— */
const stageW = () => stage.clientWidth || window.innerWidth;
const stageH = () => stage.clientHeight || window.innerHeight;

/* —— 场景 / 相机 / 渲染器 —— */
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf6f2e9);

const camera = new THREE.PerspectiveCamera(
  42, stageW() / stageH(), 0.1, 100
);
camera.position.set(2.2, 1.6, 15.5);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(stageW(), stageH());
stage.appendChild(renderer.domElement);

/* —— 控制器：限制角度，画面始终朝向用户 —— */
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.screenSpacePanning = true;
controls.minDistance = SEG_DIST.min;
controls.maxDistance = SEG_DIST.max;
controls.maxPolarAngle = Math.PI / 2 + 0.28;
controls.minPolarAngle = Math.PI / 2 - 0.45;
controls.minAzimuthAngle = -0.7;
controls.maxAzimuthAngle = 0.7;
controls.rotateSpeed = 0.5;
controls.panSpeed = 0.6;
controls.target.set(0, 0, 0);

/* —— 加载纹理 —— */
const manager = new THREE.LoadingManager();
const texLoader = new THREE.TextureLoader(manager);

const paintingTex = texLoader.load(PAINT.image);
paintingTex.colorSpace = THREE.SRGBColorSpace;
paintingTex.anisotropy = renderer.capabilities.getMaxAnisotropy();

const depthTex = texLoader.load(PAINT.depth);

/* —— 浮雕网格 —— */
const geometry = new THREE.PlaneGeometry(PLANE_W, PLANE_H, SEG_X, SEG_Y);
const material = new THREE.MeshStandardMaterial({
  map: paintingTex,
  displacementMap: depthTex,
  displacementScale: DISPLACE,
  displacementBias: -DISPLACE * 0.35,     // 让画面整体居中于 z=0 附近
  roughness: 1,
  metalness: 0,
});
const mesh = new THREE.Mesh(geometry, material);
scene.add(mesh);

/* —— 灯光：以环境光为主，保留画作原色；少量平行光增添立体形体感 —— */
scene.add(new THREE.AmbientLight(0xffffff, 0.95));
const keyLight = new THREE.DirectionalLight(0xfff4e2, 1.15);
keyLight.position.set(-1.4, 1.8, 1.6);
scene.add(keyLight);
const fillLight = new THREE.DirectionalLight(0xdfe6ef, 0.35);
fillLight.position.set(1.6, -0.5, 1.2);
scene.add(fillLight);

/* —— 深度采样（用于把锚点贴到画面表面）—— */
let depthSampler = null;

/* 对高度场做可分离盒式模糊：抹平细小高频（细树、人物笔触），
   保留大尺度起伏（山体），避免位移后出现尖刺、法线放大成黑线条。 */
function blurField(src, W, H, r) {
  if (r <= 0) return src;
  const clamp = (n, lo, hi) => (n < lo ? lo : n > hi ? hi : n);
  const tmp = new Float32Array(src.length);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let s = 0, c = 0;
      for (let k = -r; k <= r; k++) {
        const xx = x + k;
        if (xx < 0 || xx >= W) continue;
        s += src[y * W + xx]; c++;
      }
      tmp[y * W + x] = s / c;
    }
  }
  const out = new Float32Array(src.length);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let s = 0, c = 0;
      for (let k = -r; k <= r; k++) {
        const yy = y + k;
        if (yy < 0 || yy >= H) continue;
        s += tmp[yy * W + x]; c++;
      }
      out[y * W + x] = s / c;
    }
  }
  return out;
}

/* 读取深度图：① 平滑高度场 → 位移贴图（更柔的浮雕）；
   ② 提供 (u,v)→高度 采样器（贴锚点用）；
   ③ 由平滑高度场算法线贴图，使浮雕在光照下显出明暗立体感。 */
function buildDepthAssets(imgUrl) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const c = document.createElement("canvas");
      const W = (c.width = img.width), H = (c.height = img.height);
      const ctx = c.getContext("2d");
      ctx.drawImage(img, 0, 0);
      const data = ctx.getImageData(0, 0, W, H).data;

      // 原始高度（红色通道，0~1）→ 平滑
      const raw = new Float32Array(W * H);
      for (let i = 0; i < W * H; i++) raw[i] = data[i * 4] / 255;
      const hb = blurField(raw, W, H, DEPTH_BLUR);

      const at = (x, y) => {
        x = x < 0 ? 0 : x >= W ? W - 1 : x;
        y = y < 0 ? 0 : y >= H ? H - 1 : y;
        return hb[y * W + x];
      };
      const sampler = (u, v) =>
        at(Math.round(u * (W - 1)), Math.round(v * (H - 1)));

      // 平滑后的位移贴图（取代原始深度图，浮雕更柔和）
      const dCanvas = document.createElement("canvas");
      dCanvas.width = W; dCanvas.height = H;
      const dctx = dCanvas.getContext("2d");
      const dImg = dctx.createImageData(W, H);
      for (let i = 0; i < W * H; i++) {
        const v = Math.max(0, Math.min(255, hb[i] * 255));
        dImg.data[i * 4] = v;
        dImg.data[i * 4 + 1] = v;
        dImg.data[i * 4 + 2] = v;
        dImg.data[i * 4 + 3] = 255;
      }
      dctx.putImageData(dImg, 0, 0);
      const displaceTexture = new THREE.CanvasTexture(dCanvas);
      displaceTexture.colorSpace = THREE.NoColorSpace;

      // 由平滑高度梯度生成法线贴图（中心差分）
      const nCanvas = document.createElement("canvas");
      nCanvas.width = W; nCanvas.height = H;
      const nctx = nCanvas.getContext("2d");
      const nImg = nctx.createImageData(W, H);
      const nd = nImg.data;
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const dzdx = (at(x + 1, y) - at(x - 1, y)) * NORMAL_STRENGTH;
          const dzdy = (at(x, y + 1) - at(x, y - 1)) * NORMAL_STRENGTH;
          let nx = -dzdx, ny = dzdy, nz = 1;
          const inv = 1 / Math.hypot(nx, ny, nz);
          nx *= inv; ny *= inv; nz *= inv;
          const i = (y * W + x) * 4;
          nd[i]     = (nx * 0.5 + 0.5) * 255;
          nd[i + 1] = (ny * 0.5 + 0.5) * 255;
          nd[i + 2] = (nz * 0.5 + 0.5) * 255;
          nd[i + 3] = 255;
        }
      }
      nctx.putImageData(nImg, 0, 0);
      const normalTexture = new THREE.CanvasTexture(nCanvas);
      normalTexture.colorSpace = THREE.NoColorSpace; // 法线数据为线性，勿做 sRGB 转换

      resolve({ sampler, normalTexture, displaceTexture });
    };
    img.onerror = () =>
      resolve({ sampler: () => 0.5, normalTexture: null, displaceTexture: null });
    img.src = imgUrl;
  });
}

/* —— 锚点 —— */
const anchors = [];     // { article, pos:Vector3, el, labelEl, open }

function anchorWorldPos(u, v) {
  const x = (u - 0.5) * PLANE_W;
  const y = (0.5 - v) * PLANE_H;
  const d = depthSampler ? depthSampler(u, v) : 0.5;
  const z = d * DISPLACE - DISPLACE * 0.35 + 0.12; // 与浮雕同步，并略微抬起
  return new THREE.Vector3(x, y, z);
}

function buildAnchors() {
  ARTICLES.forEach((art) => {
    const pos = anchorWorldPos(art.anchor.x, art.anchor.y);

    const el = document.createElement("button");
    el.className = "anchor";
    el.innerHTML = `<span class="anchor__dot"></span><span class="anchor__ring"></span>`;
    el.setAttribute("aria-label", art.spot);

    const label = document.createElement("div");
    label.className = "anchor__label";
    label.innerHTML =
      `<span class="anchor__spot">${esc(art.spot)}</span>` +
      `<span class="anchor__title">${esc(art.title)}</span>` +
      `<span class="anchor__meta">${esc(art.meta || "")}</span>` +
      `<a class="anchor__read" href="article.html?id=${encodeURIComponent(art.id)}">阅读全文 →</a>`;

    anchorLayer.appendChild(el);
    anchorLayer.appendChild(label);

    const a = { article: art, pos, el, labelEl: label, open: false };
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      focusAnchor(a);
    });
    anchors.push(a);
  });

  // 点击空白处收起标签
  anchorLayer.addEventListener("click", () => closeAll());
  renderer.domElement.addEventListener("pointerdown", () => closeAll());
}

const resetBtn = document.getElementById("g-reset");
if (resetBtn) resetBtn.addEventListener("click", resetView);

// 点击锚点：聚焦并飞近该区域；再次点击同一锚点则返回全景
function focusAnchor(a) {
  const wasOpen = a.open;
  closeAll();
  if (wasOpen) { resetView(); return; }
  a.open = true;
  a.el.classList.add("is-active");
  a.labelEl.classList.add("is-open");
  flyTo(a.pos, FOCUS_DIST);
  if (resetBtn) resetBtn.hidden = false;
}

// 返回全景
function resetView() {
  closeAll();
  flyTo(new THREE.Vector3(0, 0, 0), OVERVIEW_DIST);
  if (resetBtn) resetBtn.hidden = true;
}

function closeAll() {
  anchors.forEach((a) => {
    a.open = false;
    a.el.classList.remove("is-active");
    a.labelEl.classList.remove("is-open");
  });
}

/* —— 把 3D 锚点投影到屏幕，更新 HTML 位置 —— */
const _v = new THREE.Vector3();
function updateAnchors() {
  const halfW = stageW() / 2;
  const halfH = stageH() / 2;
  const camDir = new THREE.Vector3();
  camera.getWorldDirection(camDir);

  anchors.forEach((a) => {
    _v.copy(a.pos);
    // 判断是否在相机背面
    const toPoint = _v.clone().sub(camera.position);
    const facing = toPoint.dot(camDir) > 0;
    _v.project(camera);
    const x = _v.x * halfW + halfW;
    const y = -_v.y * halfH + halfH;
    const visible = facing && _v.z < 1;
    a.el.style.display = visible ? "block" : "none";
    a.labelEl.style.display = visible ? "" : "none";
    if (visible) {
      a.el.style.transform = `translate(-50%,-50%) translate(${x}px,${y}px)`;
      a.labelEl.style.transform = `translate(-50%, 0) translate(${x}px,${y + 18}px)`;
    }
  });
}

/* —— 镜头平滑飞行（聚焦锚点 / 返回全景）—— */
let flyStep = null;
function flyTo(targetVec, dist, dur = 52) {
  const startTarget = controls.target.clone();
  const startPos = camera.position.clone();
  const dir = startPos.clone().sub(startTarget);
  if (dir.lengthSq() < 1e-6) dir.set(0.16, 0.12, 1);
  dir.normalize();
  const endPos = targetVec.clone().add(dir.multiplyScalar(dist));
  let t = 0;
  flyStep = () => {
    t++;
    const k = easeOutCubic(Math.min(1, t / dur));
    controls.target.lerpVectors(startTarget, targetVec, k);
    camera.position.lerpVectors(startPos, endPos, k);
    if (t >= dur) flyStep = null;
  };
}

/* —— 渲染循环 —— */
let paused = false;
function animate() {
  requestAnimationFrame(animate);
  if (paused) return;
  if (flyStep) flyStep();
  controls.update();
  renderer.render(scene, camera);
  updateAnchors();
}

/* —— 列表视图 + 视图切换 —— */
const listEl = document.getElementById("listview");
const listUl = document.getElementById("listview-list");
const subtitleEl = document.getElementById("g-subtitle");
const hintEl = document.getElementById("hint");
const toggleBtns = [...document.querySelectorAll(".g-toggle__btn")];

function renderList() {
  ARTICLES.forEach((art, i) => {
    const li = document.createElement("li");
    li.className = "listview__item";
    li.innerHTML =
      `<a href="article.html?id=${encodeURIComponent(art.id)}">` +
      `<span class="listview__num">${String(i + 1).padStart(2, "0")}</span>` +
      `<span class="listview__body">` +
        `<span class="listview__t">${esc(art.title)}` +
        (art.spot ? `<span class="listview__spot">${esc(art.spot)}</span>` : "") +
        `</span>` +
        (art.excerpt ? `<span class="listview__excerpt">${esc(art.excerpt)}</span>` : "") +
      `</span>` +
      `<span class="listview__meta">${esc(art.meta || "")}</span>` +
      `</a>`;
    listUl.appendChild(li);
  });
}
renderList();

function setView(v) {
  const isList = v === "list";
  listEl.hidden = !isList;
  paused = isList;                       // 列表时暂停 3D 渲染
  toggleBtns.forEach((b) => b.classList.toggle("is-active", b.dataset.view === v));
  if (hintEl) hintEl.style.display = isList ? "none" : "";
  if (subtitleEl)
    subtitleEl.textContent = isList
      ? "按篇目与发表年月浏览"
      : "入画寻章 · 点击山水间的光点";
}
toggleBtns.forEach((b) => b.addEventListener("click", () => setView(b.dataset.view)));

// 支持 gallery.html?view=list 直接进入列表
if (new URLSearchParams(location.search).get("view") === "list") setView("list");

/* —— 自适应 —— */
window.addEventListener("resize", () => {
  camera.aspect = stageW() / stageH();
  camera.updateProjectionMatrix();
  renderer.setSize(stageW(), stageH());
});

/* —— 启动 —— */
manager.onLoad = async () => {
  const assets = await buildDepthAssets(PAINT.depth);
  depthSampler = assets.sampler;
  if (assets.displaceTexture) material.displacementMap = assets.displaceTexture;
  if (assets.normalTexture) {
    material.normalMap = assets.normalTexture;
    material.normalScale.set(0.9, 0.9);
  }
  material.needsUpdate = true;
  buildAnchors();
  loadingEl.classList.add("is-hidden");
  // 入场：从略微俯视缓缓回正
  introAnimation();
  animate();
};
manager.onError = (url) => {
  loadingEl.innerHTML = `<p>加载失败：${esc(url)}</p>`;
};

function introAnimation() {
  const start = { polar: Math.PI / 2 - 0.42, azim: 0.0, dist: 22 };
  const end = { polar: Math.PI / 2 - 0.12, azim: 0.16, dist: 15.5 }; // 稍带俯视与侧角，立体感更明显
  controls.minPolarAngle = 0; controls.maxPolarAngle = Math.PI; // 临时放开做入场
  controls.minAzimuthAngle = -Math.PI; controls.maxAzimuthAngle = Math.PI;
  let t = 0;
  const dur = 90;
  const spherical = new THREE.Spherical();
  function step() {
    t++;
    const k = easeOutCubic(Math.min(1, t / dur));
    const polar = start.polar + (end.polar - start.polar) * k;
    const azim = start.azim + (end.azim - start.azim) * k;
    const dist = start.dist + (end.dist - start.dist) * k;
    spherical.set(dist, polar, azim);
    camera.position.setFromSpherical(spherical).add(controls.target);
    camera.lookAt(controls.target);
    if (t < dur) requestAnimationFrame(step);
    else {
      // 恢复角度限制
      controls.minPolarAngle = Math.PI / 2 - 0.45;
      controls.maxPolarAngle = Math.PI / 2 + 0.28;
      controls.minAzimuthAngle = -0.7;
      controls.maxAzimuthAngle = 0.7;
    }
  }
  step();
}

// 调试用：在控制台可访问相机/控制器
window.__cam = camera;
window.__controls = controls;

/* —— 工具 —— */
function easeOutCubic(x) { return 1 - Math.pow(1 - x, 3); }
function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
