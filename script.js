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
window.__expandedWidgetId = null;

// A widget's own controls should work when: nothing is open, OR that widget itself
// is the one currently expanded in the modal. They should NOT work when some other
// widget is expanded, or the photo lightbox is open.
window.isBlockedByOverlay = function(widgetId){
  if (document.body.classList.contains('lightbox-open')) return true;
  if (document.body.classList.contains('modal-open') && window.__expandedWidgetId !== widgetId) return true;
  return false;
};

function openWidgetModal(title, stageWrapEl){
  modalReturn = { node: stageWrapEl, parent: stageWrapEl.parentNode, next: stageWrapEl.nextSibling };
  window.__expandedWidgetId = stageWrapEl.id;
  modalBody.innerHTML = '';
  const h = document.createElement('h3');
  h.textContent = title;
  modalBody.appendChild(h);
  modalBody.appendChild(stageWrapEl);
  modalOverlay.hidden = false;
  document.body.classList.add('modal-open');
  requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
}

function closeModal(){
  modalOverlay.hidden = true;
  document.body.classList.remove('modal-open');
  window.__expandedWidgetId = null;
  if (modalReturn){
    modalReturn.parent.insertBefore(modalReturn.node, modalReturn.next);
    modalReturn = null;
    requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
  }
}
modalCloseBtn.addEventListener('click', closeModal);
modalOverlay.addEventListener('click', (e) => { if (e.target === modalOverlay) closeModal(); });
window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !modalOverlay.hidden) closeModal(); });

// wire all 5 interactive widgets — same "move the actual widget into the modal" pattern for each
document.getElementById('dialExpand')?.addEventListener('click', () =>
  openWidgetModal('Flexible Radio Transceiver', document.getElementById('dialStageWrap')));
document.getElementById('droneExpand')?.addEventListener('click', () =>
  openWidgetModal('Gesture-Controlled Quadcopter Sim', document.getElementById('droneStageWrap')));
document.getElementById('paintExpand')?.addEventListener('click', () =>
  openWidgetModal('Mini Paint', document.getElementById('paintStageWrap')));
document.getElementById('fighterExpand')?.addEventListener('click', () =>
  openWidgetModal('Adaptive Arena Fighter', document.getElementById('fighterStageWrap')));
document.getElementById('rovExpand')?.addEventListener('click', () =>
  openWidgetModal('UTUX — ROV', document.getElementById('rovStageWrap')));


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
// EXPERIENCE — wireframe ROV (single centered propeller per corner thruster)
// ============================================================
(function rov(){
  const canvas = document.getElementById('rovStage');
  if (!canvas) return;
  const stage = makeStage(canvas);
  stage.camera.position.set(3.8, 3.2, 5.6);
  stage.camera.lookAt(0, 0, 0);
  const g = stage.group;
  const lineColor = 0x1B1A17, accent = 0xC1440E;

  function smoothEdges(geometry, color, thresholdAngle = 25){
    const edges = new THREE.EdgesGeometry(geometry, thresholdAngle);
    return new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color }));
  }

  const propellers = [];

  function makePropeller({ radius, hubLen, bladeLen, bladeChord, bladeThick }){
    const spinGroup = new THREE.Group();

    const hub = edgeMesh(new THREE.ConeGeometry(radius * 0.28, hubLen, 6), accent);
    hub.rotation.x = Math.PI / 2;
    spinGroup.add(hub);

    for (let b = 0; b < 3; b++){
      const blade = edgeMesh(new THREE.BoxGeometry(bladeChord, bladeLen, bladeThick), lineColor);
      blade.position.y = radius * 0.35 + bladeLen / 2;
      const bladeWrap = new THREE.Group();
      bladeWrap.add(blade);
      bladeWrap.rotation.z = (b / 3) * Math.PI * 2;
      spinGroup.add(bladeWrap);
    }

    propellers.push(spinGroup);
    return spinGroup;
  }

  // ---- chassis dimensions ----
  const W = 3.0, D = 3.0, H = 0.7, r = 0.42;

  const waistX = edgeMesh(new THREE.BoxGeometry(W - 2*r, H, D), lineColor);
  g.add(waistX);
  const waistZ = edgeMesh(new THREE.BoxGeometry(W, H, D - 2*r), lineColor);
  g.add(waistZ);

  const cornerSigns = [[1,1],[1,-1],[-1,1],[-1,-1]];
  const cornerX = W/2 - r, cornerZ = D/2 - r;
  const CORNER_SEGS = 32;
  cornerSigns.forEach(([sx, sz]) => {
    const colGeo = new THREE.CylinderGeometry(r, r, H, CORNER_SEGS);
    const col = smoothEdges(colGeo, lineColor, 25);
    col.position.set(sx * cornerX, 0, sz * cornerZ);
    g.add(col);
  });

  // ---- central electronics tube ----
  const tubeR = H * 0.45, tubeLen = W;
  const tube = edgeMesh(new THREE.CylinderGeometry(tubeR, tubeR, tubeLen, 20, 1, true), lineColor);
  tube.rotation.z = Math.PI / 2;
  g.add(tube);
  const dome = edgeMesh(new THREE.SphereGeometry(tubeR * 0.9, 14, 10, 0, Math.PI*2, 0, Math.PI/2), accent);
  dome.rotation.z = Math.PI / 2;
  dome.position.x = tubeLen / 2;
  g.add(dome);
  const rearRim = edgeMesh(new THREE.TorusGeometry(tubeR, 0.015, 6, 18), lineColor);
  rearRim.rotation.y = Math.PI / 2;
  rearRim.position.x = -tubeLen / 2;
  g.add(rearRim);

  // ---- 4 flush top/bottom ducted thrusters ----
  const ductR = 0.3;
  const ductPositions = [
    [ W*0.20,  D*0.30],
    [ W*0.20, -D*0.30],
    [-W*0.20,  D*0.30],
    [-W*0.20, -D*0.30],
  ];
  ductPositions.forEach(([x, z]) => {
    const tunnel = edgeMesh(new THREE.CylinderGeometry(ductR, ductR, H + 0.02, 18), lineColor);
    tunnel.position.set(x, 0, z);
    g.add(tunnel);
    [H/2, -H/2].forEach(y => {
      const rim = edgeMesh(new THREE.TorusGeometry(ductR, 0.02, 6, 18), lineColor);
      rim.rotation.x = Math.PI / 2;
      rim.position.set(x, y, z);
      g.add(rim);
    });

    const orient = new THREE.Group();
    orient.rotation.x = -Math.PI / 2;
    orient.position.set(x, 0, z);
    const prop = makePropeller({
      radius: ductR, hubLen: H * 0.5,
      bladeLen: ductR * 0.9, bladeChord: 0.05, bladeThick: 0.012
    });
    orient.add(prop);
    g.add(orient);
  });

  // ---- 4 corner thrusters, flush against rounded corners — single centered propeller ----
  cornerSigns.forEach(([sx, sz]) => {
    const radialAngle = Math.atan2(sz, sx);

    const strutPivot = new THREE.Object3D();
    strutPivot.position.set(sx * cornerX, -H * 0.15, sz * cornerZ);
    strutPivot.rotation.y = -radialAngle;
    g.add(strutPivot);

    const thrusterPivot = new THREE.Object3D();
    thrusterPivot.position.x = r;
    thrusterPivot.rotation.y = Math.PI / 2;
    strutPivot.add(thrusterPivot);

    const canister = edgeMesh(new THREE.CylinderGeometry(0.2, 0.2, 0.62, 14), lineColor);
    canister.rotation.z = Math.PI / 2;
    thrusterPivot.add(canister);

    // single propeller, centered inside the canister — same pattern as the middle/duct motors
    const orient = new THREE.Group();
    orient.rotation.y = Math.PI / 2;
    orient.position.x = 0;
    const prop = makePropeller({
      radius: 0.2, hubLen: 0.1,
      bladeLen: 0.2 * 0.9, bladeChord: 0.045, bladeThick: 0.012
    });
    orient.add(prop);
    thrusterPivot.add(orient);
  });

  g.rotation.x = 0.24; g.rotation.y = 0.62;
  const idleStep = enableDragOrbit(canvas, g, 0.003);
  stage.resize();

  const PROP_SPEED = 6;
  (function animate(){
    requestAnimationFrame(animate);
    if (!REDUCE_MOTION){
      idleStep();
      const dt = 1 / 60;
      propellers.forEach(p => { p.rotation.z += PROP_SPEED * dt; });
    }
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

  const droneWrap = document.getElementById('droneStageWrap');
  let hovering = false;
  droneWrap?.addEventListener('pointerenter', () => { hovering = true; });
  droneWrap?.addEventListener('pointerleave', () => { hovering = false; for (const k in keys) keys[k] = false; });

  const keys = {};
  window.addEventListener('keydown', (e) => {
    if (!hovering || window.isBlockedByOverlay('droneStageWrap')) return;
    keys[e.key.toLowerCase()] = true;
  });
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
      s.src = src; s.onload = resolve; s.onerror = () => reject(new Error('failed to load ' + src));
      document.head.appendChild(s);
    });
  }

  function stopStream(){
    if (stream){ stream.getTracks().forEach(t => t.stop()); stream = null; }
    video.classList.remove('live');
    video.srcObject = null;
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

    // Step 1: camera
    try{
      stream = await navigator.mediaDevices.getUserMedia({ video: { width: 240, height: 180 } });
      video.srcObject = stream;
      video.classList.add('live');
      await video.play();
    } catch (err){
      statusEl.textContent = 'camera permission denied or unavailable: ' + err.message;
      btn.textContent = '🖐 Enable hand control';
      btn.disabled = false;
      stopStream();
      return;
    }

    // Step 2: load MediaPipe Hands from CDN (only once)
    try{
      if (!window.Hands){
        statusEl.textContent = 'loading hand-tracking model…';
        await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js');
      }
    } catch (err){
      statusEl.textContent = 'could not load hand-tracking library — likely blocked by an ad blocker/extension or network policy (' + err.message + ')';
      btn.textContent = '🖐 Enable hand control';
      btn.disabled = false;
      stopStream();
      return;
    }

    // Step 3: init the model
    try{
      hands = new window.Hands({ locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}` });
      hands.setOptions({ maxNumHands: 1, modelComplexity: 0, minDetectionConfidence: 0.6, minTrackingConfidence: 0.5 });
      hands.onResults(onResults);
    } catch (err){
      statusEl.textContent = 'hand-tracking init failed: ' + err.message;
      btn.textContent = '🖐 Enable hand control';
      btn.disabled = false;
      stopStream();
      return;
    }

    active = true;
    btn.textContent = 'Disable hand control';
    btn.disabled = false;
    statusEl.textContent = 'starting…';

    // Watchdog: if nothing reports back within 6s, something's silently stuck — surface it and free the camera
    const watchdog = setTimeout(() => {
      if (active && statusEl.textContent === 'starting…'){
        statusEl.textContent = 'no response from hand-tracking model — try a different browser or disable ad blockers for this site';
        disable(true);
      }
    }, 6000);

    (async function loop(){
      if (!active) return;
      try {
        await hands.send({ image: video });
        clearTimeout(watchdog);
      } catch (err) {
        statusEl.textContent = 'tracking error: ' + err.message;
        disable(true);
        return;
      }
      requestAnimationFrame(loop);
    })();
  }

  function disable(keepStatus){
    active = false;
    window.__handTarget = null;
    stopStream();
    btn.textContent = '🖐 Enable hand control';
    btn.disabled = false;
    if (!keepStatus) statusEl.textContent = '';
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
  const DRAW_W = 128, DRAW_H = 96; // on-canvas sprite size (bigger — was 72x54)
  // Row mapping is a best guess from frame counts, not confirmed metadata — flag if wrong.
  const ACTIONS = {
    idle:   { row: 0, frames: 6 },
    walk:   { row: 1, frames: 8 },
    attack: { row: 2, frames: 6 },
    shoot:  { row: 4, frames: 9 }
  };
  const FRAME_MS = 110;
  const WALK_SPEED = 180; // px/sec (canvas is wider now, sped up to match)
  // These margins are based on the character's actual body size, not the full
  // drawn box (which is sized generously to fit the attack/shoot weapon reach).
  // That's deliberate: walking should be able to get close to the edges; if an
  // attack/shoot swing extends past the edge while near a wall, it just clips
  // against the canvas boundary naturally (browsers do this for free) — same
  // approach used in the original game.
  const MARGIN_X = 34;
  const MARGIN_Y = 26;

  let current = 'idle', frame = 0, playOnce = false, last = performance.now();
  let xPos = canvas.width / 2, yPos = canvas.height / 2, facing = 1; // facing: 1 = right, -1 = left
  let holdDirX = 0, holdDirY = 0; // -1, 0, 1 while a move button is held
  let keyDirX = 0, keyDirY = 0;   // same, from keyboard

  function clampPos(){
    xPos = Math.max(MARGIN_X, Math.min(canvas.width - MARGIN_X, xPos));
    yPos = Math.max(MARGIN_Y, Math.min(canvas.height - MARGIN_Y, yPos));
  }

  function setAction(name, once){
    if (playOnce && !once) return; // don't let idle/walk interrupt a mid-flight attack/shoot
    current = name; frame = 0; playOnce = !!once;
  }

  document.querySelectorAll('.fighter-controls-group button').forEach(btn => {
    if (btn.dataset.action){
      btn.addEventListener('click', () => setAction(btn.dataset.action, true));
    }
    if (btn.dataset.hold){
      const holdMap = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] };
      const [dx, dy] = holdMap[btn.dataset.hold];
      const start = (e) => { e.preventDefault(); holdDirX = dx; holdDirY = dy; if (dx !== 0) facing = dx; };
      const stop = () => { holdDirX = 0; holdDirY = 0; };
      btn.addEventListener('pointerdown', start);
      btn.addEventListener('pointerup', stop);
      btn.addEventListener('pointerleave', stop);
      btn.addEventListener('pointercancel', stop);
    }
  });

  // Optional keyboard controls — only active while the mouse is over this widget,
  // since WASD/arrows are already claimed by the drone elsewhere on the page.
  const stageWrap = document.getElementById('fighterStageWrap');
  let hovering = false;
  stageWrap?.addEventListener('pointerenter', () => { hovering = true; });
  stageWrap?.addEventListener('pointerleave', () => { hovering = false; keyDirX = 0; keyDirY = 0; });

  window.addEventListener('keydown', (e) => {
    if (!hovering || window.isBlockedByOverlay('fighterStageWrap')) return;
    const k = e.key.toLowerCase();
    if (k === 'a' || k === 'arrowleft'){ keyDirX = -1; facing = -1; }
    else if (k === 'd' || k === 'arrowright'){ keyDirX = 1; facing = 1; }
    else if (k === 'w' || k === 'arrowup'){ keyDirY = -1; }
    else if (k === 's' || k === 'arrowdown'){ keyDirY = 1; }
    else if (k === 'j'){ setAction('attack', true); }
    else if (k === 'k'){ setAction('shoot', true); }
  });
  window.addEventListener('keyup', (e) => {
    const k = e.key.toLowerCase();
    if ((k === 'a' || k === 'arrowleft') && keyDirX === -1) keyDirX = 0;
    if ((k === 'd' || k === 'arrowright') && keyDirX === 1) keyDirX = 0;
    if ((k === 'w' || k === 'arrowup') && keyDirY === -1) keyDirY = 0;
    if ((k === 's' || k === 'arrowdown') && keyDirY === 1) keyDirY = 0;
  });

  function draw(){
    const def = ACTIONS[current] || ACTIONS.idle;
    const safeFrame = frame % def.frames; // defensive: never index past this row's frame count
    const sx = safeFrame * CELL + CROP_X, sy = def.row * CELL + CROP_Y;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (img.complete && img.naturalWidth) {
      ctx.save();
      ctx.translate(xPos, yPos);
      ctx.scale(facing, 1);
      ctx.drawImage(img, sx, sy, CROP_W, CROP_H, -DRAW_W / 2, -DRAW_H / 2, DRAW_W, DRAW_H);
      ctx.restore();
    }
  }

  let lastFrameTime = performance.now();
  function tick(now){
    requestAnimationFrame(tick);
    const dt = (now - lastFrameTime) / 1000;
    lastFrameTime = now;

    const moveX = holdDirX !== 0 ? holdDirX : keyDirX;
    const moveY = holdDirY !== 0 ? holdDirY : keyDirY;
    const moving = (moveX !== 0 || moveY !== 0);

    if (moving && !playOnce){
      xPos += moveX * WALK_SPEED * dt;
      yPos += moveY * WALK_SPEED * dt;
      if (current !== 'walk') setAction('walk', false);
    } else if (!playOnce && current === 'walk'){
      setAction('idle', false);
    }
    clampPos(); // always clamp, every frame, regardless of state — belt and suspenders against edge clipping

    if (now - last > FRAME_MS){
      last = now;
      frame++;
      const def = ACTIONS[current] || ACTIONS.idle;
      if (frame >= def.frames){
        if (playOnce){
          playOnce = false; // clear first — setAction's guard would otherwise block this exact call forever
          setAction(moving ? 'walk' : 'idle', false);
        } else {
          frame = 0;
        }
      }
    }
    draw();
  }
  requestAnimationFrame(tick);
})();

// ============================================================
// PHOTO LIGHTBOX — click any project image to view full-size, with next/prev
// ============================================================
(function lightbox(){
  const overlay = document.getElementById('lightboxOverlay');
  if (!overlay) return;
  const imgEl = document.getElementById('lightboxImg');
  const counterEl = document.getElementById('lightboxCounter');
  const closeBtn = document.getElementById('lightboxClose');
  const prevBtn = document.getElementById('lightboxPrev');
  const nextBtn = document.getElementById('lightboxNext');

  let images = [], index = 0;

  function show(){
    imgEl.src = images[index].src;
    imgEl.alt = images[index].alt || '';
    counterEl.textContent = (index + 1) + ' / ' + images.length;
    const multi = images.length > 1;
    prevBtn.style.display = multi ? '' : 'none';
    nextBtn.style.display = multi ? '' : 'none';
  }
  function open(imgs, i){
    images = imgs; index = i;
    show();
    overlay.hidden = false;
    document.body.classList.add('lightbox-open');
  }
  function close(){
    overlay.hidden = true;
    document.body.classList.remove('lightbox-open');
  }
  function prev(){ index = (index - 1 + images.length) % images.length; show(); }
  function next(){ index = (index + 1) % images.length; show(); }

  closeBtn.addEventListener('click', close);
  prevBtn.addEventListener('click', prev);
  nextBtn.addEventListener('click', next);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  window.addEventListener('keydown', (e) => {
    if (overlay.hidden) return;
    if (e.key === 'Escape') close();
    if (e.key === 'ArrowLeft') prev();
    if (e.key === 'ArrowRight') next();
  });

  // Event delegation: works for gallery images in the normal card layout
  // AND for images inside a cloned gallery when a feature card is expanded.
  document.addEventListener('click', (e) => {
    const clicked = e.target.closest('.proj-gallery img');
    if (!clicked) return;
    const gallery = clicked.closest('.proj-gallery');
    const imgs = Array.from(gallery.querySelectorAll('img'));
    open(imgs, imgs.indexOf(clicked));
  });
})();