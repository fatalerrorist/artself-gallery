

// initial setup and data
const images = [
  { name: "./img/1.jpeg" },
  { name: "./img/2.jpg" },
  { name: "./img/3.jpeg" },
  { name: "./img/4.jpeg" },
  { name: "./img/5.jpg" },
  { name: "./img/6.jpg" },
  { name: "./img/7.jpg" },
  { name: "./img/8.jpg" },
  { name: "./img/9.jpg" },
  { name: "./img/10.jpg" },
  { name: "./img/11.jpg" },
  { name: "./img/12.jpg" },
];

// configuration parameters
const params = {
  rows: 7,
  columns: 7,
  curvature: 5,
  spacing: 10,
  imageWidth: 7,
  imageHeight: 4.5,
  depth: 7.5,
  elevation: 0,
  lookAtRange: 20,
  verticalCurvature: 0.5,
};

// scene setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  25,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.set(0, 0, 40);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x000000);
document.body.appendChild(renderer.domElement);
renderer.domElement.style.touchAction = "none";

// debug mode setup
const DEBUG_MODE = false;
let gui;
if (DEBUG_MODE) {
  gui = new dat.GUI();
  gui.add(params, "rows", 1, 8).onChange(updateGallery);
  gui.add(params, "columns", 1, 10).onChange(updateGallery);
  gui.add(params, "imageWidth", 1, 10).onChange(updateGallery);
  gui.add(params, "imageHeight", 1, 10).onChange(updateGallery);
  gui.add(params, "spacing", 2, 10).onChange(updateGallery);
  gui.add(params, "curvature", 0, 10).onChange(updateGallery);
  gui.add(params, "verticalCurvature", 0, 2).onChange(updateGallery);
  gui.add(params, "depth", 5, 50).onChange(updateGallery);
  gui.add(params, "elevation", -10, 10).onChange(updateGallery);
  gui.add(params, "lookAtRange", 5, 50).name("Look Range");
}

// header animation setup
const header = document.querySelector(".header");
let headerRotationX = 0;
let headerRotationY = 0;
let headerTranslateZ = 0;

// mouse movement variables
let mouseX = 0;
let mouseY = 0;
let targetX = 0;
let targetY = 0;
const lookAtTarget = new THREE.Vector3(0, 0, 0);
let isPointerDown = false;
let dragStartClientX = 0;
let dragStartClientY = 0;
let dragStartTargetX = 0;
let dragStartTargetY = 0;
function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

// image loader
const textureLoader = new THREE.TextureLoader();

// gallery mathematics functions
function calculateRotations(x, y) {
  const a = 1 / (params.depth * params.curvature);
  const slopeY = -2 * a * x;
  const rotationY = Math.atan(slopeY);

  const verticalFactor = params.verticalCurvature;
  const maxYDistance = (params.rows * params.spacing) / 2;
  const normalizedY = y / maxYDistance;
  const rotationX = normalizedY * verticalFactor;

  return { rotationX, rotationY };
}

function calculatePosition(row, col) {
  let x = (col - params.columns / 2) * params.spacing;
  let y = (row - params.rows / 2) * params.spacing;

  let z = (x * x) / (params.depth * params.curvature);

  const normalizedY = y / ((params.rows * params.spacing) / 2);
  z += Math.abs(normalizedY) * normalizedY * params.verticalCurvature * 5;

  y += params.elevation;

  const { rotationX, rotationY } = calculateRotations(x, y);

  return { x, y, z, rotationX, rotationY };
}

// gallery creation functions
let tiles = [];
let imageAssignment = [];

function assignImages(rows, columns, imageCount) {
  const total = rows * columns;
  if (imageCount <= 0) {
    return Array.from({ length: rows }, () => Array(columns).fill(0));
  }

  const baseCount = Math.floor(total / imageCount);
  const remainder = total % imageCount;
  const remaining = new Array(imageCount).fill(baseCount);
  for (let i = 0; i < remainder; i++) remaining[i]++;

  const grid = Array.from({ length: rows }, () => Array(columns).fill(-1));

  function neighborsOk(r, c, idx) {
    if (r > 0 && grid[r - 1][c] === idx) return false;
    if (c > 0 && grid[r][c - 1] === idx) return false;
    return true;
  }

  function tryPlace(pos) {
    if (pos === rows * columns) return true;
    const r = Math.floor(pos / columns);
    const c = pos % columns;

    const candidates = [];
    for (let i = 0; i < imageCount; i++) {
      if (remaining[i] > 0 && neighborsOk(r, c, i)) candidates.push(i);
    }
    candidates.sort((a, b) => remaining[b] - remaining[a]);

    for (const idx of candidates) {
      grid[r][c] = idx;
      remaining[idx]--;
      if (tryPlace(pos + 1)) return true;
      remaining[idx]++;
      grid[r][c] = -1;
    }
    return false;
  }

  const ok = tryPlace(0);
  if (!ok) {
    // fallback simple fill if constraints can't be satisfied
    let pointer = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < columns; c++) {
        while (remaining[pointer] === 0) pointer = (pointer + 1) % imageCount;
        grid[r][c] = pointer;
        remaining[pointer]--;
      }
    }
  }

  return grid;
}

function createImagePlane(row, col) {
  const imageIndex = imageAssignment[row][col];
  const imageData = images[imageIndex];

  // enforce 1:1 square tiles by using width for both dimensions
  const geometry = new THREE.PlaneGeometry(
    params.imageWidth,
    params.imageWidth
  );

  const texture = textureLoader.load(imageData.name);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;

  const material = new THREE.MeshBasicMaterial({
    map: texture,
    side: THREE.DoubleSide,
  });

  const plane = new THREE.Mesh(geometry, material);
  const { x, y, z, rotationX, rotationY } = calculatePosition(row, col);

  plane.position.set(x, y, z);
  plane.rotation.x = rotationX;
  plane.rotation.y = rotationY;

  plane.userData.basePosition = { x, y, z };
  plane.userData.baseRotation = { x: rotationX, y: rotationY, z: 0 };
  plane.userData.parallaxFactor = Math.random() * 0.5 + 0.5;
  plane.userData.randomOffset = {
    x: Math.random() * 2 - 1,
    y: Math.random() * 2 - 1,
    z: Math.random() * 2 - 1,
  };
  plane.userData.rotationModifier = {
    x: Math.random() * 0.15 - 0.075,
    y: Math.random() * 0.15 - 0.075,
    z: Math.random() * 0.2 - 0.1,
  };
  plane.userData.phaseOffset = Math.random() * Math.PI * 2;

  return plane;
}

function updateGallery() {
  tiles.forEach((plane) => {
    scene.remove(plane);
  });

  tiles = [];
  imageAssignment = assignImages(params.rows, params.columns, images.length);

  for (let row = 0; row < params.rows; row++) {
    for (let col = 0; col < params.columns; col++) {
      const plane = createImagePlane(row, col);
      tiles.push(plane);
      scene.add(plane);
    }
  }
}

// pointer input (mouse + touch)
document.addEventListener("pointerdown", (event) => {
  isPointerDown = true;
  dragStartClientX = event.clientX;
  dragStartClientY = event.clientY;
  dragStartTargetX = targetX;
  dragStartTargetY = targetY;
  if (event.target && event.target.setPointerCapture) {
    try { event.target.setPointerCapture(event.pointerId); } catch (e) {}
  }
});

document.addEventListener("pointermove", (event) => {
  if (window.__gyroEnabled) return;
  if (event.pointerType === "mouse" && !isPointerDown) {
    mouseX = (event.clientX - window.innerWidth / 2) / (window.innerWidth / 2);
    mouseY = (event.clientY - window.innerHeight / 2) / (window.innerHeight / 2);
  } else if (isPointerDown) {
    const deltaX = event.clientX - dragStartClientX;
    const deltaY = event.clientY - dragStartClientY;
    const normalizedDeltaX = deltaX / (window.innerWidth / 2);
    const normalizedDeltaY = deltaY / (window.innerHeight / 2);
    mouseX = clamp(dragStartTargetX + normalizedDeltaX, -1, 1);
    mouseY = clamp(dragStartTargetY + normalizedDeltaY, -1, 1);
  } else {
    return;
  }
  headerRotationX = -mouseY * 30;
  headerRotationY = mouseX * 30;
  headerTranslateZ = Math.abs(mouseX * mouseY) * 50;
});

document.addEventListener("pointerup", () => { isPointerDown = false; });
document.addEventListener("pointercancel", () => { isPointerDown = false; });

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Gyro controls (optional, off by default). Enable by calling enableGyroControls() or pressing 'g'
window.__gyroEnabled = false;
function enableGyroControls() {
  if (window.__gyroEnabled) return true;
  if (typeof DeviceOrientationEvent === "undefined") return false;
  function onOrientation(event) {
    if (!window.__gyroEnabled) return;
    const gamma = event.gamma || 0;
    const beta = event.beta || 0;
    const x = clamp(gamma, -45, 45) / 45;
    const y = clamp(beta, -45, 45) / 45;
    mouseX = x;
    mouseY = y;
    headerRotationX = -mouseY * 30;
    headerRotationY = mouseX * 30;
    headerTranslateZ = Math.abs(mouseX * mouseY) * 50;
  }
  const request = DeviceOrientationEvent.requestPermission;
  const attach = () => {
    window.addEventListener("deviceorientation", onOrientation, true);
    window.__gyroEnabled = true;
  };
  if (typeof request === "function") {
    request().then((state) => { if (state === "granted") attach(); }).catch(() => {});
  } else {
    attach();
  }
  return true;
}
document.addEventListener("keydown", (e) => {
  if (e.key && e.key.toLowerCase() === "g") { enableGyroControls(); }
});

// animation loop
function animate() {
  requestAnimationFrame(animate);

  // update header transform
  const targetTransform = `
     translate(-50%, -50%)
     perspective(1000px)
     rotateX(${headerRotationX}deg)
     rotateY(${headerRotationY}deg)
     translateZ(${headerTranslateZ}px)
   `;

  header.style.transform = targetTransform;
  header.style.transition =
    "transform 0.5s cubic-bezier(0.215, 0.61, 0.355, 1)";

  // update camera target
  targetX += (mouseX - targetX) * 0.05;
  targetY += (mouseY - targetY) * 0.05;

  lookAtTarget.x = targetX * params.lookAtRange;
  lookAtTarget.y = -targetY * params.lookAtRange;
  lookAtTarget.z =
    (lookAtTarget.x * lookAtTarget.x) / (params.depth * params.curvature);

  const time = performance.now() * 0.001;

  // update each plane
  tiles.forEach((plane) => {
    const {
      basePosition,
      baseRotation,
      parallaxFactor,
      randomOffset,
      rotationModifier,
      phaseOffset,
    } = plane.userData;

    const mouseDistance = Math.sqrt(targetX * targetX + targetY * targetY);
    const parallaxX = targetX * parallaxFactor * 3 * randomOffset.x;
    const parallaxY = targetY * parallaxFactor * 3 * randomOffset.y;
    const oscillation = Math.sin(time + phaseOffset) * mouseDistance * 0.1;

    // update position
    plane.position.x =
      basePosition.x + parallaxX + oscillation * randomOffset.x;
    plane.position.y =
      basePosition.y + parallaxY + oscillation * randomOffset.y;
    plane.position.z =
      basePosition.z + oscillation * randomOffset.z * parallaxFactor;

    // update rotation
    plane.rotation.x =
      baseRotation.x +
      targetY * rotationModifier.x * mouseDistance +
      oscillation * rotationModifier.x * 0.2;

    plane.rotation.y =
      baseRotation.y +
      targetX * rotationModifier.y * mouseDistance +
      oscillation * rotationModifier.y * 0.2;

    plane.rotation.z =
      baseRotation.z +
      targetX * targetY * rotationModifier.z * 2 +
      oscillation * rotationModifier.z * 0.3;
  });

  camera.lookAt(lookAtTarget);
  renderer.render(scene, camera);
}

// initialize gallery and start animation
updateGallery();
animate();
