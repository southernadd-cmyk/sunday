import * as THREE from 'three';

// Compatibility renderer for disabled WebGL (including some remote browsers).
// The scene, sprite atlas, camera and animations remain the same Three.js objects.
// Static scenery is cached; only the footballers and ball redraw each frame.
export class CanvasPitchRenderer {
  constructor() {
    this.domElement = document.createElement('canvas');
    this.ctx = this.domElement.getContext('2d', { alpha: false });
    this.background = document.createElement('canvas');
    this.info = { render: { calls: 0, triangles: 0 }, memory: { textures: 0, geometries: 0 } };
    this.colour = new THREE.Color();
    this.matrix = new THREE.Matrix4();
    this.world = new THREE.Matrix4();
    this.v = new THREE.Vector3();
    this.corners = Array.from({ length: 4 }, () => new THREE.Vector3());
    this.clear = '#2c7436';
    this.cached = false;
  }
  setPixelRatio() {}
  setClearColor(colour) { this.clear = colour; }
  setSize(width, height) {
    this.domElement.width = this.background.width = width;
    this.domElement.height = this.background.height = height;
    this.ctx.imageSmoothingEnabled = false;
    this.cached = false;
  }
  project(x, y, z, matrix, camera, target) {
    target.set(x, y, z).applyMatrix4(matrix).project(camera);
    target.x = (target.x + 1) * this.domElement.width / 2;
    target.y = (1 - target.y) * this.domElement.height / 2;
    return target;
  }
  plane(ctx, obj, matrix, camera, tile) {
    const g = obj.geometry.parameters;
    if (!g.width || !g.height) return;
    const a = this.project(-g.width / 2, g.height / 2, 0, matrix, camera, this.corners[0]);
    const b = this.project(g.width / 2, g.height / 2, 0, matrix, camera, this.corners[1]);
    const d = this.project(-g.width / 2, -g.height / 2, 0, matrix, camera, this.corners[2]);
    const image = obj.material.map?.image || obj.material.uniforms?.atlas?.value.image;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.globalAlpha = obj.material.opacity ?? 1;
    if (image) {
      const sw = tile ? 16 : image.width, sh = tile ? 16 : image.height;
      ctx.setTransform((b.x - a.x) / sw, (b.y - a.y) / sw, (d.x - a.x) / sh, (d.y - a.y) / sh, Math.round(a.x), Math.round(a.y));
      if (tile) ctx.drawImage(image, tile[0] * 16, (3 - tile[1]) * 16, 16, 16, 0, 0, 16, 16);
      else ctx.drawImage(image, 0, 0);
    } else {
      ctx.fillStyle = '#' + obj.material.color.getHexString();
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(b.x + d.x - a.x, b.y + d.y - a.y); ctx.lineTo(d.x, d.y); ctx.fill();
    }
    ctx.restore();
    this.info.render.calls++;
  }
  boxes(ctx, obj, camera) {
    const faces = [[[-.5,.5,-.5],[.5,.5,-.5],[.5,.5,.5],[-.5,.5,.5]], [[-.5,-.5,.5],[.5,-.5,.5],[.5,.5,.5],[-.5,.5,.5]], [[.5,-.5,-.5],[.5,-.5,.5],[.5,.5,.5],[.5,.5,-.5]]];
    for (let i = 0; i < obj.count; i++) {
      obj.getMatrixAt(i, this.matrix); this.world.multiplyMatrices(obj.matrixWorld, this.matrix);
      this.colour.copy(obj.material.color);
      if (obj.instanceColor) obj.getColorAt(i, this.colour);
      ctx.fillStyle = '#' + this.colour.getHexString();
      for (const face of faces) {
        ctx.beginPath();
        face.forEach((p, j) => { this.project(p[0], p[1], p[2], this.world, camera, this.v); if (j) ctx.lineTo(this.v.x,this.v.y); else ctx.moveTo(this.v.x,this.v.y); });
        ctx.closePath(); ctx.fill();
      }
      this.info.render.calls++;
    }
  }
  sprites(ctx, obj, camera) {
    const tiles = obj.geometry.attributes.tile;
    for (let i = 0; i < obj.count; i++) {
      obj.getMatrixAt(i, this.matrix); this.world.multiplyMatrices(obj.matrixWorld, this.matrix);
      this.plane(ctx, obj, this.world, camera, [tiles.getX(i), tiles.getY(i)]);
    }
  }
  render(scene, camera) {
    scene.updateMatrixWorld(); camera.updateMatrixWorld();
    this.info.render.calls = 0;
    const children = scene.children;
    const actors = children.find(o => o.isInstancedMesh && o.count === 20);
    if (!this.cached) {
      const bg = this.background.getContext('2d', { alpha: false });
      bg.imageSmoothingEnabled = false; bg.fillStyle = this.clear; bg.fillRect(0, 0, this.background.width, this.background.height);
      // Ground first, then netting, signs, goalposts and spectators.
      for (const o of [...children].filter(o => o.geometry?.type === 'PlaneGeometry' && !o.isInstancedMesh && !o.material.transparent).sort((a,b) => a.position.y - b.position.y)) this.plane(bg,o,o.matrixWorld,camera);
      for (const o of children) if (o.geometry?.type === 'PlaneGeometry' && !o.isInstancedMesh && o.material.transparent && o.geometry.parameters.width > 5) this.plane(bg,o,o.matrixWorld,camera);
      for (const o of children) if (o.isInstancedMesh && o.geometry.type === 'BoxGeometry') this.boxes(bg,o,camera);
      for (const o of children) if (o.isInstancedMesh && o.count === 44) this.sprites(bg,o,camera);
      this.cached = true;
    }
    this.ctx.drawImage(this.background,0,0);
    const ring = children.find(o => o.geometry?.type === 'RingGeometry');
    if (ring) {
      this.project(0,0,0,ring.matrixWorld,camera,this.v);
      this.ctx.strokeStyle = '#fff16a'; this.ctx.lineWidth = 1;
      this.ctx.beginPath(); this.ctx.ellipse(this.v.x,this.v.y,2.3*this.domElement.height/(camera.top-camera.bottom),2.1*this.domElement.height/(camera.top-camera.bottom),0,0,Math.PI*2); this.ctx.stroke();
    }
    if (actors) this.sprites(this.ctx,actors,camera);
    for(const group of children) if(group.isGroup && group.visible) for(const child of group.children) if(child.visible) this.plane(this.ctx,child,child.matrixWorld,camera);
    for (const o of children) if (o.geometry?.type === 'PlaneGeometry' && !o.isInstancedMesh && o.material.transparent && o.geometry.parameters.width < 5) this.plane(this.ctx,o,o.matrixWorld,camera);
  }
  dispose() {}
}
