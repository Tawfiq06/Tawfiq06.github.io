// ============================================================
// BASICS
// ============================================================
document.getElementById('year').textContent = new Date().getFullYear();

const navToggle = document.getElementById('navToggle');
const siteNav = document.getElementById('siteNav');
navToggle.addEventListener('click', () => {
  const open = siteNav.classList.toggle('open');
  navToggle.setAttribute('aria-expanded', String(open));
});
siteNav.querySelectorAll('a').forEach(a => {
  a.addEventListener('click', () => {
    siteNav.classList.remove('open');
    navToggle.setAttribute('aria-expanded', 'false');
  });
});

const REDUCE_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Stop space/arrow keys from scrolling the page (they drive the drone instead)
window.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)){
    e.preventDefault();
  }
}, { passive: false });

// ============================================================
// FULLSCREEN MODAL SYSTEM
// ============================================================
const modalOverlay = document.getElementById('modalOverlay');
const modalBody = document.getElementById('modalBody');
const modalCloseBtn = document.getElementById('modalClose');
let modalReturn = null; // { node, parent, next } for moved (not cloned) elements

function prepGalleries(root){
  root.querySelectorAll('.proj-gallery').forEach(g => { if (!g.children.length) g.remove(); });
}

function openModalMoveFeature(title, textColEl, stageWrapEl){
  modalReturn = { node: stageWrapEl, parent: stageWrapEl.parentNode, next: stageWrapEl.nextSibling };
  modalBody.innerHTML = '';
  const h = document.createElement('h3');
  h.textContent = title;
  modalBody.appendChild(h);

  const wrap = document.createElement('div');
  wrap.className = 'modal-feature';
  const textClone = textColEl.cloneNode(true);
  prepGalleries(textClone);
  wrap.appendChild(textClone);
  wrap.appendChild(stageWrapEl);
  modalBody.appendChild(wrap);

  modalOverlay.hidden = false;
  document.body.classList.add('modal-open');
  requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
}

function openModalClone(cardEl){
  modalReturn = null;
  modalBody.innerHTML = '';
  const clone = cardEl.cloneNode(true);
  clone.querySelectorAll('.expand-btn').forEach(b => b.remove());
  prepGalleries(clone);
  modalBody.appendChild(clone);
  modalOverlay.hidden = false;
  document.body.classList.add('modal-open');
}

function closeModal(){
  modalOverlay.hidden = true;
  document.body.classList.remove('modal-open');
  if (modalReturn){
    modalReturn.parent.insertBefore(modalReturn.node, modalReturn.next);
    modalReturn = null;
    requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
  }
}
modalCloseBtn.addEventListener('click', closeModal);
modalOverlay.addEventListener('click', (e) => { if (e.target === modalOverlay) closeModal(); });
window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !modalOverlay.hidden) closeModal(); });

// wire the 4 interactive feature cards
document.getElementById('dialExpand')?.addEventListener('click', () =>
  openModalMoveFeature('Flexible Radio Transceiver', document.getElementById('dialTextCol'), document.getElementById('dialStageWrap')));
document.getElementById('droneExpand')?.addEventListener('click', () =>
  openModalMoveFeature('Gesture-Controlled Quadcopter Sim', document.getElementById('droneTextCol'), document.getElementById('droneStageWrap')));
document.getElementById('paintExpand')?.addEventListener('click', () =>
  openModalMoveFeature('Mini Paint', document.getElementById('paintTextCol'), document.getElementById('paintStageWrap')));
document.getElementById('fighterExpand')?.addEventListener('click', () =>
  openModalMoveFeature('Adaptive Arena Fighter', document.getElementById('fighterTextCol'), document.getElementById('fighterStageWrap')));
document.getElementById('rovExpand')?.addEventListener('click', () => {
  const wrap = document.getElementById('rovStageWrap');
  modalReturn = { node: wrap, parent: wrap.parentNode, next: wrap.nextSibling };
  modalBody.innerHTML = '';
  const h = document.createElement('h3'); h.textContent = 'UTUX — ROV';
  modalBody.appendChild(h);
  modalBody.appendChild(wrap);
  modalOverlay.hidden = false;
  document.body.classList.add('modal-open');
  requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
});

// plain (non-feature) project cards
document.querySelectorAll('.card:not(.card-feature) .expand-btn').forEach(btn => {
  btn.addEventListener('click', () => openModalClone(btn.closest('.card')));
});

// ============================================================
// SHARED WIREFRAME STAGE HELPERS (three.js)
// ============================================================
function makeStage(canvas){
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  const group = new THREE.Group();
  scene.add(group);

  function resize(){
    const w = canvas.clientWidth || canvas.parentElement.clientWidth;
    const h = canvas.clientHeight && canvas.clientHeight > 20 ? canvas.clientHeight : w;
    renderer.setSize(w, h, false);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);

  return { renderer, scene, camera, group, resize };
}
function edgeMesh(geo, color){
  return new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color }));
}
function enableDragOrbit(canvas, group, idleX){
  let dragging = false, lastX = 0, lastY = 0;
  let velX = idleX, velY = 0.0012;
  canvas.addEventListener('pointerdown', (e) => {
    dragging = true; canvas.classList.add('dragging');
    lastX = e.clientX; lastY = e.clientY;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dx = e.clientX - lastX, dy = e.clientY - lastY;
    group.rotation.y += dx * 0.008;
    group.rotation.x += dy * 0.008;
    velX = dx * 0.0006; velY = dy * 0.0006;
    lastX = e.clientX; lastY = e.clientY;
  });
  window.addEventListener('pointerup', () => { dragging = false; canvas.classList.remove('dragging'); });
  return function idleStep(){
    if (dragging) return;
    group.rotation.y += velX; group.rotation.x += velY;
    velX *= 0.985; velY *= 0.985;
    velX += (idleX - velX) * 0.01; velY += (0 - velY) * 0.02;
  };
}

// ============================================================
// HERO — wireframe chip
// ============================================================
(function chip(){
  const canvas = document.getElementById('chipStage');
  if (!canvas) return;
  const stage = makeStage(canvas);
  stage.camera.position.set(0, 1.4, 6.5);
  stage.camera.lookAt(0, 0, 0);
  const g = stage.group;
  const lineColor = 0x1B1A17, accent = 0xC1440E;

  g.add(edgeMesh(new THREE.BoxGeometry(2.6, 0.4, 2.6), lineColor));
  const die = edgeMesh(new THREE.BoxGeometry(1.1, 0.12, 1.1), accent);
  die.position.y = 0.26; g.add(die);

  function addPins(count, axis){
    for (let i = 0; i < count; i++){
      const t = (i + 0.5) / count - 0.5;
      const pin = edgeMesh(new THREE.BoxGeometry(0.05, 0.05, 0.32), lineColor);
      const offset = 2.6 / 2 + 0.16;
      if (axis === 'x+'){ pin.position.set(offset, -0.1, t * 2.4); }
      if (axis === 'x-'){ pin.position.set(-offset, -0.1, t * 2.4); pin.rotation.y = Math.PI / 2; }
      if (axis === 'z+'){ pin.position.set(t * 2.4, -0.1, offset); pin.rotation.y = Math.PI / 2; }
      if (axis === 'z-'){ pin.position.set(t * 2.4, -0.1, -offset); pin.rotation.y = Math.PI / 2; }
      g.add(pin);
    }
  }
  addPins(8, 'x+'); addPins(8, 'x-'); addPins(8, 'z+'); addPins(8, 'z-');
  const notch = edgeMesh(new THREE.CircleGeometry(0.08, 16), accent);
  notch.rotation.x = -Math.PI / 2; notch.position.set(-1.05, 0.21, -1.05);
  g.add(notch);

  g.rotation.x = 0.5; g.rotation.y = 0.6;
  const idleStep = enableDragOrbit(canvas, g, 0.0035);
  stage.resize();
  (function animate(){
    requestAnimationFrame(animate);
    if (!REDUCE_MOTION) idleStep();
    stage.renderer.render(stage.scene, stage.camera);
  })();
})();

// ============================================================
// EXPERIENCE — wireframe ROV
// ============================================================
(function rov(){
  const canvas = document.getElementById('rovStage');
  if (!canvas) return;
  const stage = makeStage(canvas);
  stage.camera.position.set(0, 1.2, 6.5);
  stage.camera.lookAt(0, 0, 0);
  const g = stage.group;
  const lineColor = 0x1B1A17, accent = 0xC1440E;

  const hull = edgeMesh(new THREE.CylinderGeometry(0.75, 0.75, 2.6, 16), lineColor);
  hull.rotation.z = Math.PI / 2; g.add(hull);

  const nose = edgeMesh(new THREE.ConeGeometry(0.75, 0.6, 16), accent);
  nose.rotation.z = -Math.PI / 2; nose.position.x = 1.6; g.add(nose);

  for (let i = 0; i < 4; i++){
    const angle = (i / 4) * Math.PI * 2;
    const pod = edgeMesh(new THREE.TorusGeometry(0.32, 0.07, 6, 14), lineColor);
    pod.position.set(-1.2, Math.sin(angle) * 0.95, Math.cos(angle) * 0.95);
    pod.rotation.y = Math.PI / 2; g.add(pod);
    const strut = edgeMesh(new THREE.BoxGeometry(0.6, 0.05, 0.05), lineColor);
    strut.position.set(-0.9, Math.sin(angle) * 0.55, Math.cos(angle) * 0.55);
    strut.rotation.z = angle; g.add(strut);
  }
  const camHousing = edgeMesh(new THREE.BoxGeometry(0.4, 0.3, 0.4), accent);
  camHousing.position.set(0.5, 0.75, 0); g.add(camHousing);

  g.rotation.x = 0.28; g.rotation.y = 0.7;
  const idleStep = enableDragOrbit(canvas, g, 0.003);
  stage.resize();
  (function animate(){
    requestAnimationFrame(animate);
    if (!REDUCE_MOTION) idleStep();
    stage.renderer.render(stage.scene, stage.camera);
  })();
})();

// ============================================================
// PROJECTS — flyable wireframe drone (keyboard + optional hand control)
// ============================================================
(function drone(){
  const canvas = document.getElementById('droneStage');
  if (!canvas) return;
  const stage = makeStage(canvas);
  stage.camera.position.set(0, 2.4, 6.5);
  stage.camera.lookAt(0, 0, 0);
  const droneGroup = stage.group;
  const lineColor = 0x1B1A17, accent = 0xC1440E;

  droneGroup.add(edgeMesh(new THREE.BoxGeometry(0.5, 0.18, 0.5), accent));

  const props = [];
  [[1,1],[1,-1],[-1,1],[-1,-1]].forEach(([sx, sz]) => {
    const arm = edgeMesh(new THREE.BoxGeometry(1.0, 0.06, 0.06), lineColor);
    arm.position.set(sx * 0.5, 0, sz * 0.5);
    arm.rotation.y = Math.atan2(sz, sx);
    droneGroup.add(arm);

    const propGroup = new THREE.Group();
    propGroup.position.set(sx * 1.0, 0.08, sz * 1.0);
    const ring = edgeMesh(new THREE.TorusGeometry(0.32, 0.02, 6, 20), lineColor);
    ring.rotation.x = Math.PI / 2;
    propGroup.add(ring);
    propGroup.add(edgeMesh(new THREE.BoxGeometry(0.6, 0.01, 0.03), lineColor));
    droneGroup.add(propGroup);
    props.push(propGroup);
  });

  droneGroup.rotation.y = 0.5;
  stage.resize();

  const keys = {};
  window.addEventListener('keydown', (e) => { keys[e.key.toLowerCase()] = true; });
  window.addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });

  const vel = { x: 0, y: 0, z: 0 };
  const bounds = { x: 2.1, y: 1.4, z: 2.1 };
  let throttle = 0.4;

  (function animate(){
    requestAnimationFrame(animate);

    if (window.__handTarget){
      // hand-gesture control active: lerp toward mapped target, ignore keyboard inertia
      const t = window.__handTarget;
      const lerp = 0.07;
      droneGroup.position.x += (t.x * bounds.x - droneGroup.position.x) * lerp;
      droneGroup.position.z += (t.z * bounds.z - droneGroup.position.z) * lerp;
      droneGroup.position.y += (t.y * bounds.y - droneGroup.position.y) * lerp;
      vel.x = t.x * 0.02; vel.z = t.z * 0.02; vel.y = 0;
    } else {
      const accel = 0.0022;
      let ax = 0, az = 0, ay = 0;
      if (keys['w'] || keys['arrowup']) az -= accel;
      if (keys['s'] || keys['arrowdown']) az += accel;
      if (keys['a'] || keys['arrowleft']) ax -= accel;
      if (keys['d'] || keys['arrowright']) ax += accel;
      if (keys[' ']) ay += accel;
      if (keys['shift']) ay -= accel;

      vel.x = (vel.x + ax) * 0.94;
      vel.z = (vel.z + az) * 0.94;
      vel.y = (vel.y + ay) * 0.94;

      droneGroup.position.x = THREE.MathUtils.clamp(droneGroup.position.x + vel.x, -bounds.x, bounds.x);
      droneGroup.position.z = THREE.MathUtils.clamp(droneGroup.position.z + vel.z, -bounds.z, bounds.z);
      droneGroup.position.y = THREE.MathUtils.clamp(droneGroup.position.y + vel.y, -bounds.y, bounds.y);
    }

    droneGroup.rotation.z = THREE.MathUtils.clamp(-vel.x * 18, -0.5, 0.5);
    droneGroup.rotation.x = THREE.MathUtils.clamp(vel.z * 18, -0.5, 0.5);

    throttle = 0.35 + Math.min(1, (Math.abs(vel.x) + Math.abs(vel.z) + Math.abs(vel.y)) * 40);
    props.forEach((p, i) => { p.rotation.y += throttle * (i % 2 === 0 ? 1 : -1); });

    stage.renderer.render(stage.scene, stage.camera);
  })();
})();

// ============================================================
// HAND-GESTURE CONTROL (opt-in, powers window.__handTarget for the drone)
// ============================================================
(function handControl(){
  const btn = document.getElementById('handToggle');
  const video = document.getElementById('handVideo');
  const statusEl = document.getElementById('handStatus');
  if (!btn) return;

  window.__handTarget = null;
  let hands = null, active = false, stream = null;

  function loadScript(src){
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src; s.onload = resolve; s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  function onResults(results){
    if (!results.multiHandLandmarks || !results.multiHandLandmarks.length){
      statusEl.textContent = 'no hand detected';
      window.__handTarget = null;
      return;
    }
    const lm = results.multiHandLandmarks[0];
    const wrist = lm[0], middleMcp = lm[9], indexTip = lm[8], pinkyMcp = lm[17];
    const palmX = 1 - middleMcp.x; // mirror for a natural "move right = drone right" feel
    const palmY = middleMcp.y;
    const spread = Math.hypot(indexTip.x - wrist.x, indexTip.y - wrist.y) /
                    (Math.hypot(pinkyMcp.x - wrist.x, pinkyMcp.y - wrist.y) + 0.0001);
    const openness = Math.max(0, Math.min(1, (spread - 0.6)));
    window.__handTarget = {
      x: (palmX - 0.5) * 2,
      z: (palmY - 0.5) * 2,
      y: (openness - 0.5) * 2
    };
    statusEl.textContent = 'tracking — open hand = up, fist = down';
  }

  async function enable(){
    btn.disabled = true; btn.textContent = 'Loading…';
    try{
      stream = await navigator.mediaDevices.getUserMedia({ video: { width: 240, height: 180 } });
      video.srcObject = stream;
      video.classList.add('live');
      await video.play();

      if (!window.Hands){
        await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js');
      }
      hands = new window.Hands({ locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}` });
      hands.setOptions({ maxNumHands: 1, modelComplexity: 0, minDetectionConfidence: 0.6, minTrackingConfidence: 0.5 });
      hands.onResults(onResults);

      active = true;
      btn.textContent = 'Disable hand control';
      statusEl.textContent = 'starting…';

      (async function loop(){
        if (!active) return;
        try { await hands.send({ image: video }); } catch (err) { /* ignore transient frame errors */ }
        requestAnimationFrame(loop);
      })();
    } catch (err){
      statusEl.textContent = 'camera/hand tracking unavailable in this browser';
      btn.textContent = '🖐 Enable hand control';
      console.error(err);
    }
    btn.disabled = false;
  }

  function disable(){
    active = false;
    window.__handTarget = null;
    if (stream){ stream.getTracks().forEach(t => t.stop()); stream = null; }
    video.classList.remove('live');
    video.srcObject = null;
    btn.textContent = '🖐 Enable hand control';
    statusEl.textContent = '';
  }

  btn.addEventListener('click', () => { active ? disable() : enable(); });
})();

// ============================================================
// RADIO DIAL — 2D SVG tuning knob
// ============================================================
(function radioDial(){
  const svg = document.getElementById('dialSvg');
  if (!svg) return;
  const freqOut = document.getElementById('freqOut');
  const lockOut = document.getElementById('lockOut');
  const bars = document.querySelectorAll('#dialBars span');

  const NS = 'http://www.w3.org/2000/svg';
  const CX = 100, CY = 100, R = 78;
  const MIN_ANGLE = -135, MAX_ANGLE = 135;
  const MIN_FREQ = 3.5, MAX_FREQ = 21.0;
  const STATIONS = [7.1, 10.1, 14.2, 18.1];

  function el(tag, attrs){
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }

  for (let i = 0; i <= 12; i++){
    const a = (MIN_ANGLE + (i / 12) * (MAX_ANGLE - MIN_ANGLE) - 90) * Math.PI / 180;
    const inner = R + 4, outer = R + 12;
    svg.appendChild(el('line', {
      x1: CX + Math.cos(a) * inner, y1: CY + Math.sin(a) * inner,
      x2: CX + Math.cos(a) * outer, y2: CY + Math.sin(a) * outer,
      stroke: '#1B1A17', 'stroke-width': 1.5
    }));
  }
  svg.appendChild(el('circle', { cx: CX, cy: CY, r: R, fill: 'none', stroke: '#1B1A17', 'stroke-width': 2 }));
  const knob = el('circle', { cx: CX, cy: CY, r: R - 10, fill: '#F2EFE6', stroke: '#1B1A17', 'stroke-width': 1.5, style: 'cursor:grab' });
  svg.appendChild(knob);
  const pointer = el('line', { x1: CX, y1: CY, x2: CX, y2: CY - (R - 16), stroke: '#C1440E', 'stroke-width': 3, 'stroke-linecap': 'round' });
  svg.appendChild(pointer);
  svg.appendChild(el('circle', { cx: CX, cy: CY, r: 5, fill: '#1B1A17' }));

  function setAngle(a){
    const angle = Math.max(MIN_ANGLE, Math.min(MAX_ANGLE, a));
    pointer.setAttribute('transform', `rotate(${angle} ${CX} ${CY})`);

    const t = (angle - MIN_ANGLE) / (MAX_ANGLE - MIN_ANGLE);
    const freq = MIN_FREQ + t * (MAX_FREQ - MIN_FREQ);
    freqOut.textContent = freq.toFixed(3).padStart(6, '0');

    let closest = Infinity;
    STATIONS.forEach(s => { closest = Math.min(closest, Math.abs(s - freq)); });
    const locked = closest < 0.06;
    lockOut.classList.toggle('on', locked);
    lockOut.textContent = locked ? 'LOCK' : 'TUNE';

    const strength = Math.max(0, 1 - closest / 0.9);
    bars.forEach((b, i) => {
      b.style.height = (4 + i * 2.5) + 'px';
      b.classList.toggle('on', strength * 5 > i);
    });
  }
  setAngle(-40);

  let dragging = false;
  function angleFromEvent(e){
    const rect = svg.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const x = ((clientX - rect.left) / rect.width) * 200 - CX;
    const y = ((clientY - rect.top) / rect.height) * 200 - CY;
    return Math.atan2(x, -y) * 180 / Math.PI;
  }
  svg.addEventListener('pointerdown', (e) => { dragging = true; knob.style.cursor = 'grabbing'; setAngle(angleFromEvent(e)); });
  window.addEventListener('pointermove', (e) => { if (dragging) setAngle(angleFromEvent(e)); });
  window.addEventListener('pointerup', () => { dragging = false; knob.style.cursor = 'grab'; });
})();

// ============================================================
// MINI PAINT — canvas tribute (pen + eraser)
// ============================================================
(function paint(){
  const canvas = document.getElementById('paintCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  let drawing = false, color = '#1B1A17';
  const GRID = 8;

  document.querySelectorAll('.swatch').forEach(sw => {
    sw.addEventListener('click', () => {
      document.querySelectorAll('.swatch').forEach(s => s.classList.remove('active'));
      sw.classList.add('active');
      color = sw.dataset.color;
    });
  });
  document.getElementById('paintErase').addEventListener('click', () => {
    document.querySelectorAll('.swatch').forEach(s => s.classList.remove('active'));
    color = '#ffffff';
  });
  document.getElementById('paintClear').addEventListener('click', () => {
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  });

  function pos(e){
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const x = (clientX - rect.left) * (canvas.width / rect.width);
    const y = (clientY - rect.top) * (canvas.height / rect.height);
    return { x: Math.floor(x / GRID) * GRID, y: Math.floor(y / GRID) * GRID };
  }
  function paintAt(e){
    const p = pos(e);
    ctx.fillStyle = color;
    ctx.fillRect(p.x, p.y, GRID, GRID);
  }
  canvas.addEventListener('pointerdown', (e) => { drawing = true; paintAt(e); });
  canvas.addEventListener('pointermove', (e) => { if (drawing) paintAt(e); });
  window.addEventListener('pointerup', () => { drawing = false; });
})();

// ============================================================
// ADAPTIVE ARENA FIGHTER — sprite sheet animator
// ============================================================
(function fighter(){
  const canvas = document.getElementById('fighterStage');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  const img = new Image();
  img.src = 'assets/soldier.png';

  const CELL = 100, CROP_X = 28, CROP_Y = 24, CROP_W = 56, CROP_H = 42;
  // Row mapping is a best guess from frame counts, not confirmed metadata — flag if wrong.
  const ACTIONS = {
    idle:   { row: 0, frames: 6 },
    attack: { row: 2, frames: 6 },
    shoot:  { row: 4, frames: 9 }
  };
  const FRAME_MS = 110;

  let current = 'idle', frame = 0, playOnce = false, last = performance.now();

  function setAction(name, once){ current = name; frame = 0; playOnce = !!once; }

  document.querySelectorAll('.fighter-controls button').forEach(btn => {
    btn.addEventListener('click', () => setAction(btn.dataset.action, true));
  });

  function draw(){
    const def = ACTIONS[current] || ACTIONS.idle;
    const sx = frame * CELL + CROP_X, sy = def.row * CELL + CROP_Y;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (img.complete && img.naturalWidth) {
      ctx.drawImage(img, sx, sy, CROP_W, CROP_H, 0, 0, canvas.width, canvas.height);
    }
  }

  function tick(now){
    requestAnimationFrame(tick);
    if (now - last > FRAME_MS){
      last = now;
      frame++;
      const def = ACTIONS[current] || ACTIONS.idle;
      if (frame >= def.frames){
        if (playOnce) setAction('idle', false);
        else frame = 0;
      }
    }
    draw();
  }
  requestAnimationFrame(tick);
})();