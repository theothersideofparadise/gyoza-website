/* Local Three.js scene; the original 2D street remains the WebGL fallback. */
(() => {
  const host = document.querySelector('#street3d');
  if (!host || !window.THREE) return;
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); }
  catch (_) { return; }
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, .1, 100);
  camera.position.set(10, 8, 15); camera.lookAt(0, 1, 0);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  host.appendChild(renderer.domElement);
  scene.add(new THREE.HemisphereLight(0xffedcc, 0x42352c, 2.5));
  const sun = new THREE.DirectionalLight(0xffd7a3, 3);
  sun.position.set(-4, 9, 7); sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024); scene.add(sun);
  const material = color => new THREE.MeshStandardMaterial({ color, roughness: .8 });
  const wood = material(0x6b4529), cream = material(0xffefcf), orange = material(0xe07a22);
  function box(w, h, d, mat, x, y, z, parent = scene) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true;
    parent.add(mesh); return mesh;
  }
  box(24, .2, 10, material(0x8c8272), 0, -.15, 1);
  box(24, .15, 3.4, material(0xcbbca1), 0, 0, .6);
  box(7, 3.4, 2.6, wood, 0, 1.7, -2);
  const windowMat = new THREE.MeshStandardMaterial({color: 0xffc664, emissive: 0xffa129, emissiveIntensity: .6});
  box(1.5, 2.5, .08, material(0x20170f), 0, 1.25, -.65);
  for (const x of [-2.1, 2.1]) {
    box(1.9, 1.8, .1, cream, x, 1.8, -.64);
    box(1.65, 1.55, .13, windowMat, x, 1.8, -.56);
    box(.06, 1.6, .16, wood, x, 1.8, -.48);
  }
  for (let i = 0; i < 12; i++) {
    const awning = box(.63, .15, 1.25, i % 2 ? cream : orange, -3.47 + i * .63, 3.05, -.35);
    awning.rotation.x = .16;
  }
  const signCanvas = document.createElement('canvas'); signCanvas.width = 512; signCanvas.height = 128;
  const ctx = signCanvas.getContext('2d'); ctx.fillStyle = '#fffaf2'; ctx.fillRect(0, 0, 512, 128);
  ctx.fillStyle = '#4a2e1a'; ctx.font = 'bold 76px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('煎福鍋貼', 256, 92);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(3.5, .88), new THREE.MeshBasicMaterial({map: new THREE.CanvasTexture(signCanvas)}));
  sign.position.set(0, 3.85, -.64); scene.add(sign);
  for (const x of [-4.5, 4.5]) {
    box(.8, .6, .8, orange, x, .3, -.7);
    const tree = new THREE.Mesh(new THREE.SphereGeometry(.65, 12, 8), material(0x607a46));
    tree.position.set(x, 1, -.7); scene.add(tree);
  }
  const people = [];
  const shirts = [0xe07a22, 0x6b9080, 0xd9534f, 0x3d5a80, 0xf2c14e, 0xffefcf];
  for (let i = 0; i < (innerWidth < 640 ? 9 : 15); i++) {
    const group = new THREE.Group(); scene.add(group);
    const shirt = material(shirts[i % shirts.length]);
    box(.42, .6, .28, shirt, 0, .9, 0, group);
    const head = new THREE.Mesh(new THREE.SphereGeometry(.21, 12, 8), material(i % 2 ? 0xe7b48f : 0xc98f66));
    head.position.y = 1.43; group.add(head);
    const limbs = [];
    for (const side of [-1, 1]) {
      const leg = new THREE.Group(); leg.position.set(side * .12, .62, 0); group.add(leg);
      box(.14, .55, .16, material(0x2b2930), 0, -.27, 0, leg); limbs.push(leg);
      const arm = new THREE.Group(); arm.position.set(side * .29, 1.17, 0); group.add(arm);
      box(.12, .5, .13, shirt, 0, -.22, 0, arm); limbs.push(arm);
    }
    const scale = .85 + (i % 3) * .08; group.scale.setScalar(scale);
    people.push({ group, limbs, phase: i / 15, duration: 16 + i % 5, entering: i % 3 === 0, direction: i % 2 ? -1 : 1 });
  }
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  // Follow the system preference until the visitor explicitly chooses to play or pause.
  let userPaused = null;
  const isPaused = () => userPaused ?? reduced.matches;
  const controls = document.querySelector('#streetMotionControls');
  const toggle = document.querySelector('#streetMotionToggle');
  const status = document.querySelector('#streetMotionStatus');
  function updateControls() {
    if (toggle) toggle.textContent = isPaused() ? '播放動畫' : '暫停動畫';
    if (status) status.textContent = isPaused()
      ? (userPaused === null && reduced.matches ? '已依系統設定減少動態效果' : '動畫已暫停')
      : '動畫播放中';
  }
  let visible = false, elapsed = 0, last = 0, frame = 0, failed = false;
  function resize() {
    const w = host.clientWidth, h = host.clientHeight;
    renderer.setSize(w, h); camera.aspect = w / h;
    camera.position.set(w < 640 ? 11 : 10, w < 640 ? 10 : 8, w < 640 ? 23 : 15);
    camera.updateProjectionMatrix(); render();
  }
  function render() {
    if (failed) return;
    for (const p of people) {
      const t = (elapsed / p.duration + p.phase) % 1;
      let x, z = 1 + (p.phase % .2) * 8;
      if (p.entering) {
        x = t < .65 ? -11 + 11 * t / .65 : 0;
        z = t < .65 ? 1.3 : 1.3 - (t - .65) / .35 * 3;
        p.group.visible = t < .94;
        p.group.rotation.y = t < .65 ? Math.PI / 2 : Math.PI;
      } else { x = (-12 + t * 24) * p.direction; p.group.rotation.y = p.direction * Math.PI / 2; }
      p.group.position.set(x, Math.abs(Math.sin(t * 100)) * .025, z);
      p.limbs.forEach((limb, i) => limb.rotation.x = isPaused() ? 0 : Math.sin(t * 100) * .45 * (i < 2 ? 1 : -1) * (i % 2 ? -1 : 1));
    }
    renderer.render(scene, camera);
  }
  function tick(now) {
    frame = 0;
    if (!visible || document.hidden || isPaused() || failed) { last = 0; return; }
    if (last) elapsed += Math.min((now - last) / 1000, .05);
    last = now; render(); frame = requestAnimationFrame(tick);
  }
  function resume() {
    if (frame) cancelAnimationFrame(frame); frame = 0; last = 0;
    updateControls(); render(); if (visible && !document.hidden && !isPaused() && !failed) frame = requestAnimationFrame(tick);
  }
  renderer.domElement.addEventListener('webglcontextlost', e => {
    e.preventDefault(); failed = true; if (controls) controls.hidden = true; cancelAnimationFrame(frame); host.hidden = true;
    document.querySelector('#street').hidden = false;
  });
  new ResizeObserver(resize).observe(host);
  new IntersectionObserver(entries => { visible = entries[0].isIntersecting; resume(); }).observe(host);
  if (toggle) toggle.addEventListener('click', () => { userPaused = !isPaused(); resume(); });
  reduced.addEventListener('change', () => { userPaused = null; resume(); }); document.addEventListener('visibilitychange', resume);
  host.hidden = false; document.querySelector('#street').hidden = true;
  if (controls) controls.hidden = false;
  updateControls(); host.dataset.engine = 'webgl'; resize();
})();
