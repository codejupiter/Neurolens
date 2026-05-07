import * as THREE from '../node_modules/three/build/three.module.js';
import { OrbitControls } from './OrbitControls.js';
import { buildNeuron, SEG_N, SEG_LEN, NODE_LEN, AXON_BASE_Y } from './neuron.js';
import { APGraph } from './ap-graph.js';

// ── WebGL renderer ─────────────────────────────────────
const canvas = document.getElementById('three-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;

const scene  = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 100);
camera.position.set(1.4, 0.6, 4.8);

// ── Resize ─────────────────────────────────────────────
function resize() {
  const { clientWidth: w, clientHeight: h } = canvas.parentElement;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
resize();
window.addEventListener('resize', resize);

// ── Orbit controls ─────────────────────────────────────
const controls = new OrbitControls(camera, canvas);
controls.enableDamping   = true;
controls.dampingFactor   = 0.06;
controls.autoRotate      = true;
controls.autoRotateSpeed = 0.7;
controls.enablePan       = false;
controls.minDistance     = 2.0;
controls.maxDistance     = 9.0;
controls.target.set(0, -0.6, 0);

canvas.addEventListener('pointerdown', () => { controls.autoRotate = false; });

// ── Lighting ───────────────────────────────────────────
scene.add(new THREE.AmbientLight(0x4a7fc1, 0.55));

const keyLight = new THREE.DirectionalLight(0x7eb8ff, 2.8);
keyLight.position.set(4, 7, 5);
keyLight.castShadow = true;
scene.add(keyLight);

const rimLight = new THREE.DirectionalLight(0x56cfb2, 1.3);
rimLight.position.set(-5, -2, -4);
scene.add(rimLight);

const fillLight = new THREE.PointLight(0x5e9bfc, 2.2, 16);
fillLight.position.set(0, 1, 3.5);
scene.add(fillLight);

// Travelling light — follows the AP wave front
const apLight = new THREE.PointLight(0xaaddff, 0, 3.5);
scene.add(apLight);

// ── Neuron model ───────────────────────────────────────
const { group: neuronGroup, axonSegments, somaMat } = buildNeuron();
neuronGroup.rotation.x = 0.12;
scene.add(neuronGroup);

// ── Background particle field ──────────────────────────
{
  const n   = 320;
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n * 3; i++) pos[i] = (Math.random() - 0.5) * 12;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  scene.add(new THREE.Points(geo, new THREE.PointsMaterial({
    color: 0x3a5f9e, size: 0.022, transparent: true, opacity: 0.35, sizeAttenuation: true,
  })));
}

// ── AP animation state ─────────────────────────────────
const AP_DURATION = 3500; // ms for wave to traverse full axon

let apFiring   = false;
let apWavePos  = 0;      // 0 (soma) → 1 (terminals)
let apStart    = 0;

const RESTING_NODE_EMISSIVE  = new THREE.Color(0x00091e);
const RESTING_MYEL_EMISSIVE  = new THREE.Color(0x000000);
const WAVE_EMISSIVE          = new THREE.Color(0xffffff);
const WAKE_EMISSIVE          = new THREE.Color(0x2244aa);

function resetAxon() {
  for (const { nMat, mMat } of axonSegments) {
    nMat.emissive.copy(RESTING_NODE_EMISSIVE);
    nMat.emissiveIntensity = 1.0;
    mMat.emissive.copy(RESTING_MYEL_EMISSIVE);
    mMat.emissiveIntensity = 0;
  }
  somaMat.emissive.set(0x1a3a6e);
  somaMat.emissiveIntensity = 0.35;
  apLight.intensity = 0;
}

function triggerAP(now) {
  if (apFiring) return;
  apFiring  = true;
  apWavePos = 0;
  apStart   = now;
}

function tickAP(now) {
  if (!apFiring) return;
  apWavePos = (now - apStart) / AP_DURATION;

  if (apWavePos > 1.08) {
    apFiring = false;
    resetAxon();
    setStatus('Action potential complete — axon repolarised.');
    return;
  }

  // Soma flash at initiation
  const somaFlash = Math.max(0, 1 - apWavePos * 6);
  somaMat.emissive.lerpColors(new THREE.Color(0x1a3a6e), new THREE.Color(0x7eb8ff), somaFlash);
  somaMat.emissiveIntensity = 0.35 + somaFlash * 2.5;

  // Per-segment colouring
  for (const seg of axonSegments) {
    const dist      = apWavePos - seg.t;
    const frontGlow = Math.max(0, 1 - Math.abs(dist) * 9);   // sharp wave front
    const wakeGlow  = dist > 0.03 ? Math.max(0, 0.5 - dist * 3.5) : 0; // brief rebound

    seg.nMat.emissive.lerpColors(RESTING_NODE_EMISSIVE, WAVE_EMISSIVE, frontGlow);
    seg.nMat.emissiveIntensity = 1 + frontGlow * 4 + wakeGlow * 0.9;

    seg.mMat.emissive.lerpColors(RESTING_MYEL_EMISSIVE, new THREE.Color(0xaaccff), frontGlow);
    seg.mMat.emissiveIntensity = frontGlow * 1.8;

    // Move travelling point light to the brightest segment
    if (frontGlow > 0.5) {
      apLight.position.set(0.25, seg.worldY, 0.4);
      apLight.intensity = frontGlow * 4;
    }
  }
}

// ── AP graph (2-D canvas) ─────────────────────────────
const apCanvas = document.getElementById('ap-graph');
const apGraph  = new APGraph(apCanvas);
window.addEventListener('resize', () => { apGraph.resize(); });
apGraph.draw(); // initial flat-resting render

// ── UI wiring ──────────────────────────────────────────
const statusEl = document.getElementById('status-msg');
const fpsEl    = document.getElementById('fps');

function setStatus(msg) { statusEl.textContent = msg; }

// Fire AP button
document.getElementById('fire-ap-btn').addEventListener('click', () => {
  const now = performance.now();
  triggerAP(now);
  apGraph.play(AP_DURATION);
  setStatus('Action potential firing — depolarisation wave travelling…');
});

// Voice quiz
const questions = [
  'Which ion channels open first to initiate an action potential?',
  'What is the resting membrane potential of a typical neuron?',
  'What is saltatory conduction and why does it increase speed?',
  'Which phase of the action potential is caused by potassium efflux?',
  'What is the absolute refractory period, and why does it exist?',
  'How does the Na⁺/K⁺ ATPase pump restore the resting potential?',
];

document.getElementById('speak-btn').addEventListener('click', () => {
  const q = questions[Math.floor(Math.random() * questions.length)];
  document.getElementById('quiz-question').textContent = q;
  document.getElementById('quiz-box').classList.remove('hidden');
  setStatus('Question asked — interact with the model or answer aloud.');
  if ('speechSynthesis' in window) {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(q);
    u.rate = 0.90; u.pitch = 1.0;
    speechSynthesis.speak(u);
  }
});

// Nav pills
document.querySelectorAll('.pill').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    const mode = btn.dataset.mode;
    document.querySelector('.ap-graph-wrap').classList.toggle('ap-featured', mode === 'concepts');
    controls.autoRotate = (mode === 'explore');
    setStatus(`Mode: ${mode}`);
  });
});

// Topics
document.querySelectorAll('.topic-item').forEach(item => {
  item.addEventListener('click', () => {
    document.querySelectorAll('.topic-item').forEach(t => t.classList.remove('active'));
    item.classList.add('active');
    setStatus(`Topic selected: ${item.textContent.trim()}`);
  });
});

// ── Animation loop ─────────────────────────────────────
let frames = 0, lastFps = performance.now();

function animate(now) {
  requestAnimationFrame(animate);
  controls.update();
  tickAP(now);

  // Gentle particle drift
  scene.children
    .filter(c => c.isPoints)
    .forEach(p => { p.rotation.y += 0.00025; });

  // Soma breathe (only when idle)
  if (!apFiring) {
    const s = 1 + Math.sin(now * 0.00075) * 0.016;
    neuronGroup.scale.setScalar(s);
  } else {
    neuronGroup.scale.setScalar(1);
  }

  frames++;
  if (now - lastFps >= 1000) {
    fpsEl.textContent = `${frames} fps`;
    frames = 0;
    lastFps = now;
  }

  renderer.render(scene, camera);
}
animate(performance.now());
