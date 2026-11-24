import * as THREE from 'three';
import { CanvasPitchRenderer } from './canvas-renderer.js';

// A small, fixed-resolution Three.js scene: instanced pixel sprites, one atlas,
// unlit geometry, no shadows, no post-processing, and no per-frame allocations.
const WIDTH = 80, LENGTH = 102;
const clamp = THREE.MathUtils.clamp;
const RED = '#e84138', BLUE = '#3866cf';

function canvasTexture(width, height, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  draw(canvas.getContext('2d'));
  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makeAtlas() {
  return canvasTexture(128, 64, ctx => {
    const kits = [RED, BLUE, '#ead83d', '#292e42'];
    for (let team = 0; team < 4; team++) {
      for (let frame = 0; frame < 4; frame++) {
        const x = frame * 16, y = team * 16;
        const rect = (xx, yy, w, h, color) => { ctx.fillStyle = color; ctx.fillRect(x + xx, y + yy, w, h); };
        const step = frame % 2;
        rect(4, 13, 8, 2, '#12372c');
        rect(5, 1, 5, 2, team === 1 ? '#bc7a32' : '#382720');
        rect(4, 3, 7, 3, '#f5c38b');
        rect(6, 5, 4, 2, '#d99b6a');
        rect(4, 7, 7, 4, kits[team]);
        rect(3, 7 + step, 1, 3, '#f5c38b');
        rect(11, 8 - step, 1, 3, '#f5c38b');
        rect(5, 7, 1, 3, team === 0 ? '#f5f3d7' : kits[team]);
        rect(5, 11, 6, 2, team === 0 ? '#faf6dd' : '#e9e9dc');
        rect(5, 13, 2, step ? 1 : 2, kits[team]);
        rect(9, 13, 2, step ? 2 : 1, kits[team]);
        rect(4, step ? 14 : 15, 3, 1, '#1d2933');
        rect(9, step ? 15 : 14, 3, 1, '#1d2933');
      }
    }
    // Small originals for the touchline crowd, occupying the right of the atlas.
    const coats = ['#d0b67c', '#6867a9', '#dddcd0', '#434453', '#e35841', '#467ca4'];
    for (let i = 0; i < 16; i++) {
      const x = 64 + (i % 4) * 16, y = Math.floor(i / 4) * 16;
      ctx.fillStyle = '#3d3029'; ctx.fillRect(x + 6, y + 3, 4, 2);
      ctx.fillStyle = '#e7b488'; ctx.fillRect(x + 6, y + 5, 4, 3);
      ctx.fillStyle = coats[i % coats.length]; ctx.fillRect(x + 4, y + 8, 8, 5);
      ctx.fillStyle = '#293741'; ctx.fillRect(x + 5, y + 13, 2, 3); ctx.fillRect(x + 9, y + 13, 2, 3);
    }
  });
}

function spriteMaterial(atlas) {
  return new THREE.ShaderMaterial({
    uniforms: { atlas: { value: atlas } },
    transparent: true,
    depthWrite: false,
    vertexShader: `attribute vec2 tile; varying vec2 vUv;
      void main() { vUv = vec2((uv.x + tile.x) / 8.0, (uv.y + tile.y) / 4.0);
      gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform sampler2D atlas; varying vec2 vUv;
      void main() { vec4 c = texture2D(atlas, vUv); if (c.a < 0.5) discard; gl_FragColor = c;
      #include <tonemapping_fragment>
      #include <colorspace_fragment> }`,
  });
}

export class Pitch {
  constructor(host, { low = false, reducedMotion = false } = {}) {
    this.host = host;
    this.low = low;
    this.reducedMotion = reducedMotion;
    this.active = true;
    this.mode = 'menu';
    this.time = 0;
    this.nextFrame = 0;
    this.dirty = true;
    this.lastEvent = null;
    this.anim = null;
    this.dummy = new THREE.Object3D();
    this.playerX = 0; this.playerZ = 3;
    this.targetX = 0; this.targetZ = 3;
    this.ballPos = new THREE.Vector3(0, 0.8, 1);
    try {
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('webgl2', { antialias: false, alpha: false, powerPreference: 'low-power', depth: true, stencil: false });
      if (!context) throw new Error('WebGL2 unavailable');
      this.renderer = new THREE.WebGLRenderer({ canvas, context, antialias: false, alpha: false, powerPreference: 'low-power', depth: true, stencil: false });
      this.backend = 'webgl';
    } catch {
      this.renderer = new CanvasPitchRenderer();
      this.backend = 'canvas';
    }
    this.renderer.setPixelRatio(1);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setClearColor('#1c5933');
    this.renderer.domElement.setAttribute('aria-hidden', 'true');
    this.renderer.domElement.className = 'pitch-canvas';
    host.append(this.renderer.domElement);
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-60, 60, 45, -45, 1, 200);
    this.camera.position.set(0, 108, 42);
    this.camera.lookAt(0, 0, -10);
    this.buildGround();
    this.buildPlayers();
    this.buildDetails();
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(host);
    this.onVisibility = () => { this.active = !document.hidden; if (this.active) { this.lastTime = performance.now(); this.schedule(); } };
    document.addEventListener('visibilitychange', this.onVisibility);
    this.resize();
    this.tick = this.tick.bind(this);
    this.schedule();
  }
  buildGround() {
    const texture = canvasTexture(512, 640, ctx => {
      ctx.fillStyle = '#3c9b36'; ctx.fillRect(0, 0, 512, 640);
      for (let y = 0; y < 640; y += 64) {
        ctx.fillStyle = y % 128 ? '#409f38' : '#369432'; ctx.fillRect(0, y, 512, 64);
      }
      let seed = 5173;
      const rand = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
      for (let i = 0; i < 5200; i++) {
        ctx.fillStyle = rand() > 0.5 ? '#4ba53d' : '#318b30';
        ctx.fillRect(Math.floor(rand() * 512), Math.floor(rand() * 640), 1, 1);
      }
      // Worn goalmouths and one particularly council-owned patch.
      for (let i = 0; i < 650; i++) {
        ctx.fillStyle = i % 3 ? '#7b8c3e' : '#a08c50';
        const end = i % 2 ? 26 : 614;
        ctx.fillRect(232 + Math.floor(rand() * 48), end + Math.floor(rand() * 20 - 10), 2, 1);
      }
      const sx = 512 / WIDTH, sy = 640 / LENGTH;
      const rect = (x, y, w, h) => ctx.strokeRect(x * sx, y * sy, w * sx, h * sy);
      ctx.strokeStyle = '#e7f1c9'; ctx.lineWidth = 2;
      rect(4, 4, 72, 94);
      ctx.beginPath(); ctx.moveTo(4 * sx, 51 * sy); ctx.lineTo(76 * sx, 51 * sy); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(40 * sx, 51 * sy, 9 * sx, 9 * sy, 0, 0, Math.PI * 2); ctx.stroke();
      rect(18, 4, 44, 17); rect(30, 4, 20, 6);
      rect(18, 81, 44, 17); rect(30, 92, 20, 6);
      ctx.beginPath(); ctx.ellipse(40 * sx, 16 * sy, 8 * sx, 8 * sy, 0.5, 0, Math.PI); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(40 * sx, 86 * sy, 8 * sx, 8 * sy, 0.5, Math.PI, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#e7f1c9';
      for (const y of [16, 51, 86]) ctx.fillRect(40 * sx - 1, y * sy - 1, 3, 3);
    });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(WIDTH, LENGTH), new THREE.MeshBasicMaterial({ map: texture }));
    ground.rotation.x = -Math.PI / 2;
    this.scene.add(ground);
    const verge = new THREE.Mesh(new THREE.PlaneGeometry(220, 220), new THREE.MeshBasicMaterial({ color: '#2c7436' }));
    verge.rotation.x = -Math.PI / 2; verge.position.y = -0.04; this.scene.add(verge);

    const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
    const structures = new THREE.InstancedMesh(boxGeometry, new THREE.MeshBasicMaterial({ color: '#dfe6d1' }), 12);
    const parts = [
      [-7, 1.8, -47, 0.55, 3.6, 0.55], [7, 1.8, -47, 0.55, 3.6, 0.55], [0, 3.6, -47, 14.5, 0.55, 0.55],
      [-7, 0.3, -50, 0.4, 0.4, 6], [7, 0.3, -50, 0.4, 0.4, 6], [0, 0.3, -53, 14, 0.4, 0.4],
      [-7, 1.8, 47, 0.55, 3.6, 0.55], [7, 1.8, 47, 0.55, 3.6, 0.55], [0, 3.6, 47, 14.5, 0.55, 0.55],
      [-7, 0.3, 50, 0.4, 0.4, 6], [7, 0.3, 50, 0.4, 0.4, 6], [0, 0.3, 53, 14, 0.4, 0.4],
    ];
    parts.forEach((p, i) => { this.dummy.position.set(p[0], p[1], p[2]); this.dummy.scale.set(p[3], p[4], p[5]); this.dummy.rotation.set(0, 0, 0); this.dummy.updateMatrix(); structures.setMatrixAt(i, this.dummy.matrix); });
    this.scene.add(structures);
    const netTexture = canvasTexture(32, 32, ctx => {
      ctx.strokeStyle = '#c8dcc0'; ctx.lineWidth = 1;
      for (let i = 0; i < 32; i += 4) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 32); ctx.moveTo(0, i); ctx.lineTo(32, i); ctx.stroke(); }
    });
    netTexture.wrapS = netTexture.wrapT = THREE.RepeatWrapping;
    netTexture.repeat.set(4, 1);
    const netMat = new THREE.MeshBasicMaterial({ map: netTexture, transparent: true, side: THREE.DoubleSide, depthWrite: false });
    for (const z of [-50, 50]) {
      const net = new THREE.Mesh(new THREE.PlaneGeometry(14, 6), netMat);
      net.rotation.x = -Math.PI / 2; net.position.set(0, 0.5, z); this.scene.add(net);
    }
    const ballTexture = canvasTexture(8, 8, ctx => {
      ctx.fillStyle = '#fffce8'; ctx.fillRect(1, 1, 6, 6);
      ctx.fillStyle = '#273344'; ctx.fillRect(3, 3, 2, 2); ctx.fillRect(1, 1, 2, 1); ctx.fillRect(5, 5, 2, 2);
    });
    this.ball = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.4), new THREE.MeshBasicMaterial({ map: ballTexture, transparent: true, depthWrite: false }));
    this.ball.quaternion.copy(this.camera.quaternion); this.scene.add(this.ball);
    this.ring = new THREE.Mesh(new THREE.RingGeometry(2.1, 2.4, 12), new THREE.MeshBasicMaterial({ color: '#fff16a', side: THREE.DoubleSide }));
    this.ring.rotation.x = -Math.PI / 2; this.ring.position.y = 0.1; this.scene.add(this.ring);
    this.aim = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0.12, 0), new THREE.Vector3(0, 0.12, -46)]), new THREE.LineDashedMaterial({ color: '#f5f49b', dashSize: 1.2, gapSize: 1.2, transparent: true, opacity: 0.6 }));
    this.aim.computeLineDistances(); this.scene.add(this.aim);
  }
  buildPlayers() {
    const geo = new THREE.PlaneGeometry(4.2, 4.2);
    this.tiles = new Float32Array(40);
    geo.setAttribute('tile', new THREE.InstancedBufferAttribute(this.tiles, 2));
    this.actors = new THREE.InstancedMesh(geo, spriteMaterial(makeAtlas()), 20);
    this.actors.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.scene.add(this.actors);
    this.positions = [
      [0, 3, 0], [-20, -8, 0], [23, -17, 0], [-11, 17, 0], [20, 29, 0], [-25, 34, 0], [3, 37, 0],
      [-9, -22, 1], [11, -26, 1], [1, -12, 1], [-24, -32, 1], [24, -34, 1], [16, 7, 1], [-23, 8, 1],
      [0, -43, 2], [0, 43, 2], [-31, -2, 3], [44, 20, 3], [44, 25, 0], [-45, -17, 3],
    ];
    const crowdGeo = new THREE.PlaneGeometry(3.6, 3.6);
    const crowdTiles = new Float32Array(88);
    crowdGeo.setAttribute('tile', new THREE.InstancedBufferAttribute(crowdTiles, 2));
    const crowd = new THREE.InstancedMesh(crowdGeo, this.actors.material, 44);
    for (let i = 0; i < 44; i++) {
      const right = i >= 22;
      this.dummy.position.set((right ? 46 : -46) + (i % 3) * (right ? 1.6 : -1.6), 1.5, -44 + (i % 22) * 4);
      this.dummy.quaternion.copy(this.camera.quaternion); this.dummy.scale.set(1, 1, 1); this.dummy.updateMatrix();
      crowd.setMatrixAt(i, this.dummy.matrix);
      crowdTiles[i * 2] = 4 + i % 4; crowdTiles[i * 2 + 1] = i % 4;
    }
    this.scene.add(crowd);
  }
  buildDetails() {
    const texture = canvasTexture(256, 32, ctx => {
      ctx.fillStyle = '#1e3858'; ctx.fillRect(0, 0, 256, 32);
      ctx.fillStyle = '#efe8b8'; ctx.font = 'bold 17px monospace'; ctx.fillText('ANCHOR & CROWN', 10, 22);
      ctx.fillStyle = '#c7dd73'; ctx.fillRect(0, 0, 256, 2); ctx.fillRect(0, 30, 256, 2);
    });
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(30, 3.7), new THREE.MeshBasicMaterial({ map: texture }));
    sign.rotation.x = -Math.PI / 2; sign.position.set(0, 0.1, -57); this.scene.add(sign);
    const decorations = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial(), 24);
    for (let i = 0; i < 24; i++) {
      const isFence = i < 16;
      this.dummy.position.set(isFence ? (i % 2 ? 52 : -52) : (i % 2 ? 45 : -45), isFence ? 1 : 0.6, -48 + (isFence ? Math.floor(i / 2) * 14 : (i - 16) * 12));
      this.dummy.rotation.set(0, 0, 0); this.dummy.scale.set(isFence ? 0.4 : 1.4, isFence ? 2 : 0.3, isFence ? 13 : 3.4); this.dummy.updateMatrix(); decorations.setMatrixAt(i, this.dummy.matrix);
      decorations.setColorAt(i, new THREE.Color(isFence ? '#b9bd9c' : '#bb5a32'));
    }
    this.scene.add(decorations);
  }
  resize() {
    const w = this.host.clientWidth, h = this.host.clientHeight;
    if (!w || !h) return;
    const aspect = w / h;
    const height = aspect < 1 ? 93 : 107;
    this.camera.left = -height * aspect / 2;
    this.camera.right = height * aspect / 2;
    this.camera.top = height / 2; this.camera.bottom = -height / 2;
    this.camera.updateProjectionMatrix();
    // Never allocate a device-pixel-ratio-sized framebuffer.
    const baseWidth = this.low ? 384 : 640;
    const rw = Math.min(baseWidth, Math.round(w));
    this.renderer.setSize(rw, Math.max(1, Math.round(rw / aspect)), false);
    this.renderer.domElement.style.width = '100%'; this.renderer.domElement.style.height = '100%';
    this.dirty = true;
  }
  setLow(value) { this.low = value; this.resize(); }
  setMode(mode) { this.mode = mode; this.dirty = true; }
  update(run) {
    if (!run || !run.attack) return;
    if (!['Composure', 'Graft', 'Baggage'].includes(run.lastType)) this.targetX = clamp(Math.sin(run.actions * 2.1 + run.attack) * 13, -20, 20);
    this.targetZ = clamp(6 - (run.quality - 18) * 0.5, -32, 8);
    this.pressure = run.pressure / 100;
    if (run.attack !== this.lastAttack || run.fixtureIndex !== this.lastFixture) {
      this.playerX = this.targetX; this.playerZ = this.targetZ;
      this.lastAttack = run.attack; this.lastFixture = run.fixtureIndex;
      this.anim = null;
    }
    this.dirty = true;
  }
  animate(result) {
    if (!result) return;
    if (result.type === 'setup') {
      this.lastEvent = result.card;
      if (['pass', 'wall', 'overlap'].includes(result.card)) this.passAnim = { elapsed: 0, duration: this.reducedMotion ? 0.1 : 0.65 };
      this.dirty = true; return;
    }
    this.passAnim = null;
    this.anim = { type: result.type, elapsed: 0, duration: this.reducedMotion ? 0.15 : 0.9, fromX: this.playerX, fromZ: this.playerZ, toX: result.type === 'goal' ? -4.2 : 10.5 };
    this.dirty = true;
  }
  schedule() { if (!this.frame && this.active) this.frame = requestAnimationFrame(this.tick); }
  tick(now) {
    this.frame = null;
    if (!this.active) return;
    const elapsed = Math.min(0.1, (now - (this.lastTime || now)) / 1000);
    this.lastTime = now;
    this.time += elapsed;
    // 30 fps is ample for tiny turn-based sprites, 20 on low detail.
    if (now >= this.nextFrame) {
      this.nextFrame = now + (this.low ? 50 : 1000 / 30);
      const renderDelta = Math.min(0.15, (now - (this.lastRenderTime || now)) / 1000);
      this.lastRenderTime = now;
      this.render(renderDelta);
    }
    this.schedule();
  }
  render(dt) {
    const motion = !this.reducedMotion;
    this.playerX += (this.targetX - this.playerX) * Math.min(1, dt * 10);
    this.playerZ += (this.targetZ - this.playerZ) * Math.min(1, dt * 10);
    const walking = Math.abs(this.targetX - this.playerX) > 0.3 || Math.abs(this.targetZ - this.playerZ) > 0.3;
    const t = this.time;
    for (let i = 0; i < 20; i++) {
      const p = this.positions[i];
      let x = p[0], z = p[1];
      if (i === 0) { x = this.playerX; z = this.playerZ; }
      else if (i === 9 && this.mode === 'playing') {
        const closing = (this.pressure || 0) * 0.75;
        x += (this.playerX - x) * closing; z += (this.playerZ - z) * closing;
      } else if (motion && i < 14) { x += Math.sin(t * 0.7 + i * 3.1) * 0.7; z += Math.cos(t * 0.5 + i * 1.7) * 0.6; }
      if (i === 14 && this.anim && ['goal', 'miss'].includes(this.anim.type)) x = this.anim.toX * Math.min(1, this.anim.elapsed * 1.8) * (this.anim.type === 'goal' ? 0.5 : 0.9);
      this.dummy.position.set(x, 1.8, z);
      this.dummy.quaternion.copy(this.camera.quaternion); this.dummy.scale.set(1, 1, 1);
      this.dummy.updateMatrix(); this.actors.setMatrixAt(i, this.dummy.matrix);
      this.tiles[i * 2] = motion && (i !== 0 || walking) ? Math.floor(t * 4 + i) % 2 : 0;
      this.tiles[i * 2 + 1] = 3 - p[2];
    }
    this.actors.instanceMatrix.needsUpdate = true;
    this.actors.geometry.attributes.tile.needsUpdate = true;
    this.ring.position.set(this.playerX, 0.12, this.playerZ);
    if (this.anim) {
      this.anim.elapsed += dt;
      const f = Math.min(1, this.anim.elapsed / this.anim.duration);
      const shoot = ['goal', 'miss'].includes(this.anim.type);
      this.ballPos.set(shoot ? THREE.MathUtils.lerp(this.anim.fromX, this.anim.toX, f) : this.playerX + f * 4, shoot ? 0.8 + Math.sin(f * Math.PI) * 5 : 0.8, shoot ? THREE.MathUtils.lerp(this.anim.fromZ - 1.8, -50, f) : this.playerZ - 2);
    } else if (this.passAnim) {
      this.passAnim.elapsed += dt;
      const f = Math.min(1, this.passAnim.elapsed / this.passAnim.duration);
      const outAndBack = 1 - Math.abs(f * 2 - 1);
      this.ballPos.set(THREE.MathUtils.lerp(this.playerX, -20, outAndBack), 0.8, THREE.MathUtils.lerp(this.playerZ - 1.8, -8, outAndBack));
      if (f === 1) this.passAnim = null;
    } else this.ballPos.set(this.playerX + 0.6, 0.8, this.playerZ - 1.8);
    this.ball.position.copy(this.ballPos);
    const attr = this.aim.geometry.attributes.position;
    attr.setXYZ(0, this.playerX, 0.13, this.playerZ - 2); attr.needsUpdate = true;
    this.aim.computeLineDistances();
    this.aim.visible = this.mode === 'playing' && !this.anim;
    this.renderer.render(this.scene, this.camera);
    this.dirty = false;
  }
  metrics() { return { backend: this.backend, calls: this.renderer.info.render.calls, triangles: this.renderer.info.render.triangles, width: this.renderer.domElement.width, height: this.renderer.domElement.height, textures: this.renderer.info.memory.textures, geometries: this.renderer.info.memory.geometries }; }
  dispose() {
    this.active = false;
    cancelAnimationFrame(this.frame);
    this.observer.disconnect();
    document.removeEventListener('visibilitychange', this.onVisibility);
    const geometries = new Set(), materials = new Set(), textures = new Set();
    this.scene.traverse(obj => { if (obj.geometry) geometries.add(obj.geometry); if (obj.material) materials.add(obj.material); });
    materials.forEach(mat => { if (mat.map) textures.add(mat.map); if (mat.uniforms?.atlas) textures.add(mat.uniforms.atlas.value); mat.dispose(); });
    geometries.forEach(g => g.dispose()); textures.forEach(t => t.dispose()); this.renderer.dispose();
  }
}
