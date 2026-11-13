import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { createCameraMaterials } from './camera-materials.js';
import { createIcons, ArrowUpRight, Aperture, Scan, RotateCw, Maximize2, Film, ChevronDown, Check } from 'lucide';

createIcons({ icons: { ArrowUpRight, Aperture, Scan, RotateCw, Maximize2, Film, ChevronDown, Check } });
const container = document.querySelector('#canvas-container');
const loading = document.querySelector('#loading');
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.95;
container.appendChild(renderer.domElement);
const scene = new THREE.Scene();
const environment = new RoomEnvironment();
const generator = new THREE.PMREMGenerator(renderer);
scene.environment = generator.fromScene(environment, 0.04).texture;
environment.dispose();
const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
camera.position.set(5.1, 3.7, 6.8);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 1.5, 0);
controls.enablePan = false;
controls.enableZoom = false;
controls.enableDamping = true;
// Allow a vertical overhead view; OrbitControls guards its pole singularity.
controls.minPolarAngle = 0;
controls.maxPolarAngle = 1.55;
controls.update();
scene.add(new THREE.HemisphereLight(0xf4f4ee, 0x303d46, 0.45));
const key = new THREE.DirectionalLight(0xfff5e9, 2.2); key.position.set(-4, 7, 5); scene.add(key);
const rim = new THREE.DirectionalLight(0xd4ebf5, 1.8); rim.position.set(5, 3, -4); scene.add(rim);
const fill = new THREE.DirectionalLight(0xffffff, 0.55); fill.position.set(0, 4, 8); scene.add(fill);
// Nearby strip softboxes create a spatial highlight on flat metal panels.
RectAreaLightUniformsLib.init();
const softbox = new THREE.RectAreaLight(0xfff7ef, 4, 3, 5);
softbox.position.set(-3.5, 4.5, 4); softbox.lookAt(0, 1.6, 0); scene.add(softbox);
const strip = new THREE.RectAreaLight(0xe2f0ff, 3, 0.8, 4);
strip.position.set(4.5, 2.8, 2); strip.lookAt(0, 1.5, 0); scene.add(strip);

// Preload real PBR maps alongside the model before revealing the product.
const cameraMaterialsReady = createCameraMaterials(renderer);
let model; let pivots = {}; let fold = 0; let foldTarget = 0; let crankStart = -1;
const finderScreenMeshes = []; let finderScreenTexture;
const clamp = (v) => THREE.MathUtils.clamp(v, 0, 1);
const productView = { position: new THREE.Vector3(5.1, 3.7, 6.8), target: new THREE.Vector3(0, 1.5, 0) };
const finderView = { position: new THREE.Vector3(0, 7.6, -7), target: new THREE.Vector3(0, 1.75, 0) };
let viewTransition = null;
controls.addEventListener('start', () => { viewTransition = null; });
function transitionView(open) {
  const destination = open ? finderView : productView;
  viewTransition = {
    fromPosition: camera.position.clone(),
    fromTarget: controls.target.clone(),
    toPosition: destination.position,
    toTarget: destination.target,
    started: performance.now(),
    duration: 900,
  };
}
function syncFinderScreen(video) {
  if (!video || !finderScreenMeshes.length) return;
  if (!finderScreenTexture) {
    finderScreenTexture = new THREE.VideoTexture(video);
    finderScreenTexture.colorSpace = THREE.SRGBColorSpace;
    finderScreenTexture.flipY = false;
    finderScreenTexture.minFilter = THREE.LinearFilter;
    finderScreenTexture.magFilter = THREE.LinearFilter;
    finderScreenTexture.generateMipmaps = false;
    finderScreenTexture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 4);
    const screenAspect = finderScreenMeshes[0].userData.screenAspect;
    const videoAspect = video.videoWidth && video.videoHeight ? video.videoWidth / video.videoHeight : 16 / 9;
    if (videoAspect > screenAspect) {
      finderScreenTexture.repeat.set(screenAspect / videoAspect, 1);
      finderScreenTexture.offset.x = (1 - finderScreenTexture.repeat.x) / 2;
    } else {
      finderScreenTexture.repeat.set(1, videoAspect / screenAspect);
      finderScreenTexture.offset.y = (1 - finderScreenTexture.repeat.y) / 2;
    }
  } else {
    finderScreenTexture.image = video;
    finderScreenTexture.needsUpdate = true;
  }
  finderScreenMeshes.forEach((screen) => {
    screen.material.map = finderScreenTexture;
    screen.material.needsUpdate = true;
  });
}
Promise.all([new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}models/camera.glb`), cameraMaterialsReady]).then(([gltf, materials]) => {
  model = gltf.scene;
  model.traverse((o) => {
    if (o.isMesh && o.material) {
      const objectPath = [o.name, o.parent?.name, o.parent?.parent?.name].join(' | ').replaceAll('_', ' ');
      materials.apply(o, objectPath);
      if (/Viewfinder \| focusing screen/i.test(objectPath)) {
        o.geometry.computeBoundingBox();
        const bounds = o.geometry.boundingBox;
        const size = new THREE.Vector3(); bounds.getSize(size);
        const thinAxis = size.y <= size.x && size.y <= size.z ? 'y' : size.x <= size.z ? 'x' : 'z';
        const planeWidth = (thinAxis === 'x' ? size.z : size.x) * 0.86;
        const planeHeight = (thinAxis === 'x' || thinAxis === 'z' ? size.y : size.z) * 0.84;
        const planeGeometry = new THREE.PlaneGeometry(planeWidth, planeHeight);
        const planeMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, toneMapped: false, depthTest: false, depthWrite: false });
        const finderScreenMesh = new THREE.Mesh(planeGeometry, planeMaterial);
        finderScreenMesh.name = 'Live viewfinder image';
        finderScreenMesh.renderOrder = 10;
        finderScreenMesh.visible = false;
        finderScreenMesh.userData.screenAspect = planeWidth / planeHeight;
        finderScreenMeshes.push(finderScreenMesh);
        if (thinAxis === 'y') {
          finderScreenMesh.rotation.x = -Math.PI / 2;
          finderScreenMesh.position.set((bounds.min.x + bounds.max.x) / 2, bounds.max.y + 0.0018, (bounds.min.z + bounds.max.z) / 2);
        } else if (thinAxis === 'x') {
          finderScreenMesh.rotation.y = Math.PI / 2;
          finderScreenMesh.position.set(bounds.max.x + 0.0018, (bounds.min.y + bounds.max.y) / 2, (bounds.min.z + bounds.max.z) / 2);
        } else {
          finderScreenMesh.position.set((bounds.min.x + bounds.max.x) / 2, (bounds.min.y + bounds.max.y) / 2, bounds.max.z + 0.0018);
        }
        o.add(finderScreenMesh);
      }
    }
    if (o.name.startsWith('PIVOT')) pivots[o.name.replaceAll('_', ' ')] = o;
  });
  syncFinderScreen(sceneVideos.find((video) => video.classList.contains('active')));
  scene.add(model); loading.remove();
  // Give the GLB and PBR maps the first network slots on a cold public visit.
  // Then preload every scene for the first mechanical interaction.
  sceneVideos.forEach((video) => { video.preload = 'auto'; video.load(); });
  sceneVideos.find((video) => video.classList.contains('active'))?.play().catch(() => {});
}).catch((error) => { console.error('Camera load failed', error); loading.textContent = 'Camera could not be loaded.'; });
const finder = document.querySelector('#finder');
fold = 1; foldTarget = 1;
finder.title = 'Open viewfinder';
finder.setAttribute('aria-label', 'Open viewfinder');
finder.setAttribute('aria-expanded', 'false');
const cameraStage = document.querySelector('.camera-stage');
const shutter = document.querySelector('#mechanical-shutter');
const sceneVideos = [...document.querySelectorAll('.scene-video')];
const landscape = document.querySelector('#landscape');
const sceneButtons = [...document.querySelectorAll('.photo')];
const sceneNames = sceneButtons.map((button) => button.dataset.image);
let currentScene = sceneNames.indexOf(sceneButtons.find((button) => button.classList.contains('selected'))?.dataset.image);
let changingScene = false;

const AudioContextClass = window.AudioContext || window.webkitAudioContext;
const audioContext = AudioContextClass ? new AudioContextClass() : null;
const audioBuffers = new Map();
const audioReady = audioContext ? Promise.all([
  ['audio/hasselblad-500cm-preview.mp3', 'advance'],
  ['audio/camera-handling-cc0.mp3', 'handling'],
  ['audio/slr-advance-ratchet-cc0.mp3', 'ratchet'],
  ['audio/film-camera-mechanism-cc0.mp3', 'lock'],
].map(async ([url, keyName]) => {
  const response = await fetch(`${import.meta.env.BASE_URL}${url}`);
  if (!response.ok) throw new Error(`Audio preload failed: ${url}`);
  audioBuffers.set(keyName, await audioContext.decodeAudioData(await response.arrayBuffer()));
})).catch(() => {}) : Promise.resolve();

async function playCue(keyName, offset, duration, volume = 0.7) {
  await audioReady;
  if (!audioContext || !audioBuffers.has(keyName)) return;
  if (audioContext.state === 'suspended') await audioContext.resume();
  const source = audioContext.createBufferSource();
  const highpass = audioContext.createBiquadFilter(); highpass.type = 'highpass'; highpass.frequency.value = 90;
  const lowpass = audioContext.createBiquadFilter(); lowpass.type = 'lowpass'; lowpass.frequency.value = 7800;
  const gain = audioContext.createGain(); gain.gain.value = volume;
  source.buffer = audioBuffers.get(keyName);
  source.connect(highpass).connect(lowpass).connect(gain).connect(audioContext.destination);
  const start = Math.min(offset, Math.max(0, source.buffer.duration - 0.05));
  source.start(0, start, Math.min(duration, source.buffer.duration - start));
}

function setScene(index) {
  currentScene = (index + sceneNames.length) % sceneNames.length;
  const sceneName = sceneNames[currentScene];
  const activeVideo = sceneVideos.find((video) => video.dataset.scene === sceneName);
  sceneVideos.forEach((video) => {
    if (video === activeVideo) { video.classList.add('active'); video.play().catch(() => {}); }
    else { video.classList.remove('active'); video.pause(); }
  });
  syncFinderScreen(activeVideo);
  sceneButtons.forEach((button, i) => {
    const selected = i === currentScene;
    button.classList.toggle('selected', selected);
    button.setAttribute('aria-pressed', String(selected));
    button.querySelector('b')?.remove();
    if (selected) {
      const check = document.createElement('b'); check.innerHTML = '<i data-lucide="check"></i>'; button.appendChild(check);
      createIcons({ icons: { Check } });
    }
  });
  const count = String(currentScene + 1).padStart(2, '0');
  const note = document.querySelector('.mobile-note');
  if (note) note.firstChild.textContent = `${count} / ${String(sceneNames.length).padStart(2, '0')} `;
}

function transitionTo(index) {
  const next = (index + sceneNames.length) % sceneNames.length;
  if (changingScene || next === currentScene) return;
  changingScene = true;
  shutter.classList.remove('transitioning');
  void shutter.offsetWidth;
  shutter.classList.add('transitioning');
  crankStart = performance.now();
  playCue('advance', 0.2, 0.78, 0.62);
  playCue('ratchet', 0.2, 0.72, 0.35);
  window.setTimeout(() => setScene(next), 90);
  window.setTimeout(() => {
    shutter.classList.remove('transitioning');
    cameraStage.classList.remove('scene-shake');
    void cameraStage.offsetWidth;
    cameraStage.classList.add('scene-shake');
    playCue('lock', 0.05, 0.18, 0.85);
    changingScene = false;
  }, 180);
}

finder.addEventListener('click', () => {
  foldTarget = foldTarget ? 0 : 1;
  const opening = foldTarget === 0;
  const text = opening ? 'Close viewfinder' : 'Open viewfinder';
  finder.title = text; finder.setAttribute('aria-label', text); finder.setAttribute('aria-expanded', String(opening));
  transitionView(opening);
  playCue('handling', opening ? 0.45 : 1.25, 0.58, 0.62);
});
document.querySelector('#advance').addEventListener('click', () => transitionTo(currentScene + 1));
document.querySelector('#reset').addEventListener('click', () => {
  foldTarget = 1;
  finder.title = 'Open viewfinder'; finder.setAttribute('aria-label', 'Open viewfinder'); finder.setAttribute('aria-expanded', 'false');
  transitionView(false);
});
document.querySelector('#explore').addEventListener('click', () => { document.querySelector('#camera').scrollIntoView({ behavior: 'smooth', block: 'center' }); document.querySelector('#finder').focus({ preventScroll: true }); });

sceneButtons.forEach((button, index) => button.addEventListener('click', () => transitionTo(index)));
document.querySelector('#film-select').addEventListener('change', (event) => { landscape.classList.remove('warm', 'mono'); if (event.target.value !== 'natural') landscape.classList.add(event.target.value); });

function resize() { const w = container.clientWidth; const h = container.clientHeight; if (!w || !h) return; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
new ResizeObserver(resize).observe(container); resize();
let previous = performance.now();
function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min((now - previous) / 1000, .05); previous = now;
  fold += (foldTarget - fold) * (1 - Math.exp(-4 * dt));
  if (viewTransition) {
    const t = clamp((now - viewTransition.started) / viewTransition.duration);
    const eased = t * t * (3 - 2 * t);
    camera.position.lerpVectors(viewTransition.fromPosition, viewTransition.toPosition, eased);
    controls.target.lerpVectors(viewTransition.fromTarget, viewTransition.toTarget, eased);
    if (t >= 1) viewTransition = null;
  }
  if (model) {
    const left = pivots['PIVOT | viewfinder left hinge']; const right = pivots['PIVOT | viewfinder right hinge'];
    const rear = pivots['PIVOT | viewfinder rear hinge']; const front = pivots['PIVOT | viewfinder front hinge'];
    if (left) left.rotation.z = -1.56 * clamp(fold / .32);
    if (right) right.rotation.z = 1.56 * clamp(fold / .32);
    if (rear) rear.rotation.x = 1.56 * clamp((fold - .34) / .30);
    if (front) front.rotation.x = -1.56 * clamp((fold - .68) / .32);
    // Reveal only after the front/rear lids have unfolded. Hide immediately on
    // close/reset so the display layer can never paint over the folded cover.
    finderScreenMeshes.forEach((screen) => { screen.visible = foldTarget === 0 && fold < 0.32; });
    const crank = pivots['PIVOT | winding crank'];
    if (crank && crankStart >= 0) { const t = (now - crankStart) / 700; crank.rotation.x = t < 1 ? 1.12 * Math.sin(Math.PI * clamp(t)) : 0; if (t >= 1) crankStart = -1; }
  }
  controls.update(); renderer.render(scene, camera);
}
requestAnimationFrame(animate);
