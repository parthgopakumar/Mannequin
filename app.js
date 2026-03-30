/**
 * app.js
 * Main entry point for OutfitForge 3D.
 * Sets up the Three.js scene, OrbitControls, lighting,
 * and wires up all UI interactions.
 */

import { Mannequin }   from './mannequin.js';
import { parseOutfit } from './outfit-mapper.js';

// ── DOM refs ──────────────────────────────────────────────────
const canvas        = document.getElementById('three-canvas');
const btnGenerate   = document.getElementById('btn-generate');
const btnResetCam   = document.getElementById('btn-reset-cam');
const btnWireframe  = document.getElementById('btn-wireframe');
const loadingOverlay= document.getElementById('loading-overlay');
const outfitSummary = document.getElementById('outfit-summary');
const summaryItems  = document.getElementById('summary-items');
const errorMsg      = document.getElementById('error-msg');
const viewerHint    = document.getElementById('viewer-hint');
const descInput     = document.getElementById('outfit-description');
const imageUpload   = document.getElementById('image-upload');
const uploadZone    = document.getElementById('upload-zone');
const previewImg    = document.getElementById('preview-img');
const tabs          = document.querySelectorAll('.tab');
const tabContents   = document.querySelectorAll('.tab-content');

// ── State ─────────────────────────────────────────────────────
let imageBase64    = null;
let imageMimeType  = null;
let activeTab      = 'describe';
let wireframeOn    = false;
let mannequin      = null;

// ── Three.js Scene ────────────────────────────────────────────
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0a0c);
scene.fog = new THREE.Fog(0x0a0a0c, 6, 18);

const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 50);
const DEFAULT_CAM = new THREE.Vector3(0, 1.1, 3.6);
camera.position.copy(DEFAULT_CAM);
camera.lookAt(0, 1.0, 0);

// ── OrbitControls ─────────────────────────────────────────────
const controls = new THREE.OrbitControls(camera, canvas);
controls.target.set(0, 1.0, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.07;
controls.minDistance = 1.5;
controls.maxDistance = 7;
controls.maxPolarAngle = Math.PI * 0.88;
controls.update();

// ── Lighting ──────────────────────────────────────────────────
// Ambient
scene.add(new THREE.AmbientLight(0x404060, 0.8));

// Key light (warm, from upper-right)
const keyLight = new THREE.DirectionalLight(0xfff5e0, 2.0);
keyLight.position.set(2.5, 4, 3);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(1024, 1024);
keyLight.shadow.camera.near = 0.5;
keyLight.shadow.camera.far = 20;
keyLight.shadow.camera.left = keyLight.shadow.camera.bottom = -3;
keyLight.shadow.camera.right = keyLight.shadow.camera.top = 3;
scene.add(keyLight);

// Fill light (cool, from left)
const fillLight = new THREE.DirectionalLight(0xb0d0ff, 0.7);
fillLight.position.set(-3, 2, 1);
scene.add(fillLight);

// Rim light (back, accent)
const rimLight = new THREE.DirectionalLight(0xc8ff00, 0.35);
rimLight.position.set(0, 2, -4);
scene.add(rimLight);

// ── Ground shadow catcher ─────────────────────────────────────
const ground = new THREE.Mesh(
  new THREE.CircleGeometry(1.4, 48),
  new THREE.MeshStandardMaterial({
    color: 0x111116,
    roughness: 1,
    metalness: 0,
  })
);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.01;
ground.receiveShadow = true;
scene.add(ground);

// Soft shadow disc
const shadowDisc = new THREE.Mesh(
  new THREE.CircleGeometry(0.55, 32),
  new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35 })
);
shadowDisc.rotation.x = -Math.PI / 2;
shadowDisc.position.y = 0.001;
scene.add(shadowDisc);

// ── Mannequin ─────────────────────────────────────────────────
mannequin = new Mannequin(scene);

// ── Resize handler ────────────────────────────────────────────
function resizeRenderer() {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (canvas.width !== w || canvas.height !== h) {
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
}

// ── Render loop ───────────────────────────────────────────────
function animate() {
  requestAnimationFrame(animate);
  resizeRenderer();
  controls.update();
  renderer.render(scene, camera);
}
animate();

// ── Tab switching ─────────────────────────────────────────────
tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    activeTab = tab.dataset.tab;
    tabs.forEach(t => t.classList.toggle('active', t === tab));
    tabContents.forEach(tc =>
      tc.classList.toggle('active', tc.id === `tab-${activeTab}`)
    );
  });
});

// ── Image upload handling ─────────────────────────────────────
uploadZone.addEventListener('click', () => imageUpload.click());

uploadZone.addEventListener('dragover', e => {
  e.preventDefault();
  uploadZone.style.borderColor = 'var(--accent)';
});
uploadZone.addEventListener('dragleave', () => {
  uploadZone.style.borderColor = '';
});
uploadZone.addEventListener('drop', e => {
  e.preventDefault();
  uploadZone.style.borderColor = '';
  const file = e.dataTransfer.files[0];
  if (file) handleImageFile(file);
});

imageUpload.addEventListener('change', e => {
  const file = e.target.files[0];
  if (file) handleImageFile(file);
});

function handleImageFile(file) {
  if (!file.type.startsWith('image/')) return;
  imageMimeType = file.type;
  const reader = new FileReader();
  reader.onload = ev => {
    const dataUrl = ev.target.result;
    imageBase64 = dataUrl.split(',')[1];
    previewImg.src = dataUrl;
    previewImg.hidden = false;
    uploadZone.classList.add('has-image');
    // Hide icon/text
    uploadZone.querySelector('.upload-icon').style.display = 'none';
    uploadZone.querySelector('.upload-text').style.display = 'none';
    uploadZone.querySelector('.upload-sub').style.display = 'none';
  };
  reader.readAsDataURL(file);
}

// ── Generate button ───────────────────────────────────────────
btnGenerate.addEventListener('click', async () => {
  const description = descInput.value.trim();

  if (activeTab === 'describe' && !description) {
    showError('Please enter an outfit description.');
    return;
  }
  if (activeTab === 'upload' && !imageBase64) {
    showError('Please upload an image first.');
    return;
  }

  hideError();
  setLoading(true);

  try {
    const outfitData = await parseOutfit({
      description: activeTab === 'describe' ? description : '',
      imageBase64: activeTab === 'upload' ? imageBase64 : null,
      imageMimeType,
    });

    if (!outfitData.pieces || outfitData.pieces.length === 0) {
      showError('No outfit pieces were detected. Try a more detailed description.');
      setLoading(false);
      return;
    }

    mannequin.applyOutfit(outfitData);
    renderSummary(outfitData);

    // Hide hint
    viewerHint.style.opacity = '0';
    setTimeout(() => { viewerHint.style.display = 'none'; }, 500);

  } catch (err) {
    showError(`Error: ${err.message}`);
    console.error(err);
  } finally {
    setLoading(false);
  }
});

// ── Camera reset ──────────────────────────────────────────────
btnResetCam.addEventListener('click', () => {
  camera.position.copy(DEFAULT_CAM);
  controls.target.set(0, 1.0, 0);
  controls.update();
});

// ── Wireframe toggle ──────────────────────────────────────────
btnWireframe.addEventListener('click', () => {
  wireframeOn = !wireframeOn;
  mannequin.setWireframe(wireframeOn);
  btnWireframe.classList.toggle('active', wireframeOn);
});

// ── Helpers ───────────────────────────────────────────────────
function setLoading(on) {
  loadingOverlay.hidden = !on;
  btnGenerate.disabled = on;
}

function showError(msg) {
  errorMsg.textContent = msg;
  errorMsg.hidden = false;
}

function hideError() {
  errorMsg.hidden = true;
}

function renderSummary(outfitData) {
  summaryItems.innerHTML = '';
  outfitData.pieces.forEach(piece => {
    const div = document.createElement('div');
    div.className = 'summary-item';
    div.innerHTML = `
      <div class="summary-swatch" style="background:${piece.color_hex}"></div>
      <span class="summary-piece">${piece.type}</span>
      <span class="summary-dot">·</span>
      <span>${piece.color || '—'}</span>
      ${piece.material ? `<span class="summary-dot">·</span><span>${piece.material}</span>` : ''}
    `;
    summaryItems.appendChild(div);
  });
  outfitSummary.hidden = false;
}
