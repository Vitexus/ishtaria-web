// Živý Uruk za webem: modely ze hry (datadisk Gilgameš, 0 A.D.), den a noc v cyklu 60 s.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const CYCLE = 60;
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const col = h => new THREE.Color(h);

let seed = 1234;
const rnd = (a = 1, b) => { seed = (seed * 16807) % 2147483647; const r = seed / 2147483647; return b === undefined ? r * a : a + r * (b - a); };

// Paleta podle výšky slunce ve stupních
const KEYS = [
  { a: -32, top: '#030718', mid: '#081234', hor: '#16275c', sun: '#000000', si: 0, sky: '#3a5aa8', gnd: '#141a33', ai: 0.42, cl: '#0a1330', cd: '#050919' },
  { a: -12, top: '#0a1540', mid: '#28285f', hor: '#5a3f70', sun: '#000000', si: 0, sky: '#4c5ea8', gnd: '#1f1f3a', ai: 0.5, cl: '#3a2f62', cd: '#111638' },
  { a: -2, top: '#14275f', mid: '#6d4a78', hor: '#ee8350', sun: '#ff7f3f', si: 0.5, sky: '#7d6f9c', gnd: '#3a2a34', ai: 0.62, cl: '#ee9060', cd: '#4b3160' },
  { a: 7, top: '#1f4a93', mid: '#a7787f', hor: '#ffc27a', sun: '#ffb46b', si: 2.6, sky: '#9fa6c4', gnd: '#6b4e3a', ai: 0.85, cl: '#ffd9ae', cd: '#a26a70' },
  { a: 24, top: '#1c5aa6', mid: '#5e9dd0', hor: '#f4dfb4', sun: '#ffe2bb', si: 3.3, sky: '#bcd2ea', gnd: '#8a7050', ai: 1.0, cl: '#fff3df', cd: '#b4bdd0' },
  { a: 70, top: '#1656a6', mid: '#4b94d2', hor: '#cfe2e6', sun: '#fff4e0', si: 3.6, sky: '#cfe0f2', gnd: '#9a8058', ai: 1.1, cl: '#ffffff', cd: '#c3cedd' }
].map(k => ({ a: k.a, si: k.si, ai: k.ai, top: col(k.top), mid: col(k.mid), hor: col(k.hor), sun: col(k.sun), sky: col(k.sky), gnd: col(k.gnd), cl: col(k.cl), cd: col(k.cd) }));
function palette(alt, out) {
  let i = 0; while (i < KEYS.length - 2 && alt > KEYS[i + 1].a) i++;
  const A = KEYS[i], B = KEYS[i + 1], f = clamp((alt - A.a) / (B.a - A.a));
  for (const k of ['top', 'mid', 'hor', 'sun', 'sky', 'gnd', 'cl', 'cd']) out[k].copy(A[k]).lerp(B[k], f);
  out.si = A.si + (B.si - A.si) * f; out.ai = A.ai + (B.ai - A.ai) * f;
  return out;
}

const SKY_VS = `varying vec3 vDir; void main(){ vDir = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.); gl_Position = p.xyww; }`;
const SKY_FS = `
varying vec3 vDir;
uniform vec3 uTop,uMid,uHor,uSunCol,uSunDir,uCl,uCd; uniform float uStar,uTime,uSunGlow;
float h21(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
float n2(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y); }
float fbm(vec2 p){ float a=.5,s=0.; for(int i=0;i<5;i++){ s+=a*n2(p); p=p*2.03+vec2(1.7,9.2); a*=.5; } return s; }
void main(){
  vec3 d = normalize(vDir);
  float h = clamp(d.y,0.,1.);
  vec3 c = mix(uHor,uMid,smoothstep(0.,.13,h)); c = mix(c,uTop,smoothstep(.1,.55,h));
  float sd = max(dot(d,uSunDir),0.);
  c += uSunCol*(pow(sd,5.)*.26+pow(sd,48.)*.55)*uSunGlow;
  c += uSunCol*smoothstep(.99935,.99975,sd)*7.*uSunGlow;
  if(uStar>0.01){
    vec2 q = vec2(atan(d.x,-d.z)*90., d.y*160.);
    vec2 g = floor(q), fr = fract(q)-.5;
    float r = h21(g), big = step(.975,r);
    float tw = .68+.32*sin(uTime*(1.3+r*3.)+r*40.);
    float s = big*smoothstep(.11,.0,length(fr-vec2(h21(g+1.)-.5,h21(g+2.)-.5)*.6))*tw*(.5+r*.9);
    float band = exp(-pow((d.y-.34+d.x*.72)*3.2,2.));
    float q2 = fbm(vec2(d.x*7.,d.y*9.)+3.);
    c += vec3(.62,.68,1.)*band*q2*q2*.42*uStar;
    vec2 q3 = vec2(atan(d.x,-d.z)*240., d.y*420.), g3 = floor(q3), f3 = fract(q3)-.5;
    float m = step(.972-band*.05,h21(g3))*smoothstep(.2,.03,length(f3))*(.3+.7*h21(g3+3.));
    c += (vec3(1.,.97,.9)*s*2.2 + vec3(.84,.88,1.)*m*(.55+band))*uStar*smoothstep(0.,.1,h);
  }
  if(d.y>.005){
    vec2 cp = d.xz/(d.y+.13)*1.05 + vec2(uTime*.012,uTime*.004);
    float n = fbm(cp*1.5), den = smoothstep(.48,.84,n);
    float shade = smoothstep(.45,.95,fbm(cp*1.5+vec2(.09,.13)));
    vec3 cloud = mix(uCl,uCd,shade*.72);
    c = mix(c,cloud,den*.82*smoothstep(.015,.14,d.y));
  }
  gl_FragColor = vec4(c,1.);
}`;

const WATER = {
  uniforms: {
    color: { value: null }, tDiffuse: { value: null }, textureMatrix: { value: null },
    uTime: { value: 0 }, uSunDir: { value: new THREE.Vector3() }, uSunCol: { value: new THREE.Color() },
    uDeep: { value: new THREE.Color() }, uHor: { value: new THREE.Color() }, uFogFar: { value: 1500 }
  },
  vertexShader: `uniform mat4 textureMatrix; varying vec4 vUv; varying vec3 vW;
    void main(){ vUv = textureMatrix*vec4(position,1.); vec4 w = modelMatrix*vec4(position,1.); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`,
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uTime,uFogFar; uniform vec3 uSunDir,uSunCol,uDeep,uHor;
    varying vec4 vUv; varying vec3 vW;
    float h21(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
    float n2(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y); }
    float rip(vec2 p){ return n2(p*.34+vec2(uTime*.32,uTime*.09))*.5+n2(p*.9-vec2(uTime*.42,-uTime*.15))*.3+n2(p*2.4+vec2(-uTime*.8,uTime*.5))*.2; }
    void main(){
      vec2 p = vW.xz; float e=.35;
      float a=rip(p), bx=rip(p+vec2(e,0.)), bz=rip(p+vec2(0.,e));
      float dd = length(cameraPosition-vW); float amp = mix(1.05,.28,smoothstep(40.,420.,dd));
      vec3 n = normalize(vec3((a-bx)*amp,1.,(a-bz)*amp));
      vec3 v = normalize(cameraPosition-vW);
      float dist = length(cameraPosition-vW);
      vec4 uv = vUv; uv.xy += n.xz*uv.w*.05;
      vec3 refl = texture2DProj(tDiffuse,uv).rgb;
      float F = .22+.78*pow(1.-max(dot(v,n),0.),3.);
      vec3 c = mix(uDeep,refl,clamp(F+.2,0.,.82));
      vec3 r = reflect(-uSunDir,n);
      c += uSunCol*pow(max(dot(r,v),0.),90.)*.9;
      c = mix(c,uHor,smoothstep(300.,uFogFar,dist));
      gl_FragColor = vec4(c,1.);
    }`
};

function radialTexture(stops, size = 128) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d'), r = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  stops.forEach(s => r.addColorStop(s[0], s[1]));
  g.fillStyle = r; g.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function noiseTexture(base, spread, rep, size = 256) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d'); g.fillStyle = base; g.fillRect(0, 0, size, size);
  for (let i = 0; i < 2600; i++) {
    const v = rnd() < 0.5 ? 0 : 255;
    g.fillStyle = `rgba(${v},${v},${v},${rnd(0.01, spread)})`;
    g.fillRect(rnd(size), rnd(size), rnd(1, 7), rnd(1, 5));
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}

export async function startScene(canvas, opts = {}) {
  const q = new URLSearchParams(location.search);
  const freeze = q.get('freeze') === '1';
  let phi = parseFloat(q.get('phi') || opts.phi || 0.43);
  const low = q.get('q') === 'low' || opts.low;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: !!opts.capture });
  let pixelRatio = Math.min(devicePixelRatio || 1, low ? 1 : 1.5);
  renderer.setPixelRatio(pixelRatio);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.96;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x8899aa, 240, 1500);
  const camera = new THREE.PerspectiveCamera(25, 16 / 9, 2, 7000);
  scene.add(camera);

  const pal = { top: col('#000'), mid: col('#000'), hor: col('#000'), sun: col('#000'), sky: col('#000'), gnd: col('#000'), cl: col('#000'), cd: col('#000'), si: 0, ai: 0 };

  // Obloha
  const skyU = { uTop: { value: pal.top }, uMid: { value: pal.mid }, uHor: { value: pal.hor }, uSunCol: { value: new THREE.Color() }, uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uStar: { value: 0 }, uTime: { value: 0 }, uSunGlow: { value: 1 }, uCl: { value: pal.cl }, uCd: { value: pal.cd } };
  const sky = new THREE.Mesh(new THREE.SphereGeometry(4000, 32, 24), new THREE.ShaderMaterial({ vertexShader: SKY_VS, fragmentShader: SKY_FS, uniforms: skyU, side: THREE.BackSide, depthWrite: false, depthTest: true, fog: false }));
  sky.frustumCulled = false; sky.renderOrder = -10; scene.add(sky);

  // Měsíc
  const moonTex = (() => {
    const s = 256, c = document.createElement('canvas'); c.width = c.height = s; const g = c.getContext('2d');
    const gl = g.createRadialGradient(s / 2, s / 2, s * 0.16, s / 2, s / 2, s / 2); gl.addColorStop(0, 'rgba(190,205,255,.34)'); gl.addColorStop(1, 'rgba(190,205,255,0)');
    g.fillStyle = gl; g.fillRect(0, 0, s, s);
    g.save(); g.translate(s / 2, s / 2); g.rotate(-0.5); g.fillStyle = '#fff6df'; g.beginPath(); g.arc(0, 0, s * 0.17, Math.PI / 2, -Math.PI / 2); g.ellipse(0, 0, s * 0.11, s * 0.17, 0, -Math.PI / 2, Math.PI / 2, true); g.fill(); g.restore();
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  const moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: moonTex, transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending }));
  moon.scale.setScalar(250); moon.renderOrder = -9; scene.add(moon);

  // Světla
  const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffffff, 3);
  sun.castShadow = true; sun.shadow.mapSize.set(low ? 1024 : 2048, low ? 1024 : 2048);
  Object.assign(sun.shadow.camera, { left: -560, right: 560, top: 420, bottom: -420, near: 10, far: 2200 });
  sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.9;
  sun.target.position.set(0, 0, -60); scene.add(sun, sun.target);
  const moonLight = new THREE.DirectionalLight(0x8fa8ff, 0.4); moonLight.position.set(-300, 500, 700); scene.add(moonLight);
  const gateLights = [new THREE.PointLight(0xffa04d, 0, 170, 1.7), new THREE.PointLight(0xffa04d, 0, 170, 1.7), new THREE.PointLight(0xff9440, 0, 210, 1.7)];
  gateLights[0].position.set(-30, 21, 40); gateLights[1].position.set(30, 21, 40); gateLights[2].position.set(100, 96, -90);
  gateLights.forEach(l => scene.add(l));

  // Země
  const earthTex = noiseTexture('#b69a70', 0.09, [26, 18]);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(9000, 4400), new THREE.MeshStandardMaterial({ map: earthTex, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; ground.position.set(0, 0.4, 36 - 2200); ground.receiveShadow = true; scene.add(ground);
  const quay = new THREE.Mesh(new THREE.BoxGeometry(9000, 3, 10), new THREE.MeshStandardMaterial({ map: noiseTexture('#a08a68', 0.12, [240, 1]), roughness: 0.95 }));
  quay.position.set(0, -0.6, 41); quay.receiveShadow = true; scene.add(quay);

  // Přední břeh
  function bankHeight(x, z) {
    const n = Math.sin(x * 0.021) * 1.1 + Math.sin(x * 0.067 + 1.3) * 0.55 + Math.sin(z * 0.11 + x * 0.013) * 0.45;
    return -1.5 + smooth(206, 244, z + Math.sin(x * 0.033) * 5.5) * (3.1 + n * 0.55) + smooth(244, 340, z) * 2.2;
  }
  {
    const g = new THREE.PlaneGeometry(4000, 360, 300, 90); g.rotateX(-Math.PI / 2); g.translate(0, 0, 370);
    const p = g.attributes.position, c = new Float32Array(p.count * 3), wet = col('#2e2518'), sand = col('#a58a5c'), green = col('#49592f'), tmp = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i), y = bankHeight(x, z); p.setY(i, y);
      tmp.copy(wet).lerp(sand, smooth(-0.6, 1.0, y)).lerp(green, smooth(1.6, 3.2, y + Math.sin(x * 0.09) * 0.8 + Math.sin(z * 0.2) * 0.4) * 0.72);
      const v = 0.9 + Math.random() * 0.2; c[i * 3] = tmp.r * v; c[i * 3 + 1] = tmp.g * v; c[i * 3 + 2] = tmp.b * v;
    }
    g.setAttribute('color', new THREE.BufferAttribute(c, 3)); g.computeVertexNormals();
    const bank = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, map: noiseTexture('#ffffff', 0.22, [70, 8]) }));
    bank.receiveShadow = true; scene.add(bank);
  }

  // Řeka
  const water = new Reflector(new THREE.PlaneGeometry(9000, 360), { textureWidth: low ? 640 : 1280, textureHeight: low ? 360 : 720, clipBias: 0.002, shader: WATER });
  water.rotation.x = -Math.PI / 2; water.position.set(0, -0.2, 200 - 180 + 20); water.material.fog = false; scene.add(water);
  const wu = water.material.uniforms;

  // Načtení modelů
  const loader = new GLTFLoader();
  const base = opts.base || 'models/';
  const load = n => new Promise((res, rej) => loader.load(base + n + '.glb', res, undefined, rej));
  // Domy ve hře kopírují terén. Tady stojí na rovném návrší, takže se terén z modelu odečte (výšky domů zůstanou).
  const flattened = new Set();
  function flatten(gltf, cell = 36) {
    if (flattened.has(gltf)) return; flattened.add(gltf);
    const meshes = []; gltf.scene.traverse(m => { if (m.isMesh) meshes.push(m); });
    const key = (x, z) => Math.floor(x / cell) + ':' + Math.floor(z / cell), low = new Map();
    meshes.forEach(m => { const p = m.geometry.attributes.position; for (let i = 0; i < p.count; i++) { const k = key(p.getX(i), p.getZ(i)), y = p.getY(i); if (!low.has(k) || y < low.get(k)) low.set(k, y); } });
    const at = (i, j) => { const v = low.get(i + ':' + j); return v === undefined ? null : v; };
    const near = (i, j) => { for (let r = 0; r < 12; r++) { let sum = 0, n = 0; for (let a = -r; a <= r; a++) for (let b = -r; b <= r; b++) { const v = at(i + a, j + b); if (v !== null) { sum += v; n++; } } if (n) return sum / n; } return 0; };
    const height = (x, z) => { const u = x / cell - 0.5, v = z / cell - 0.5, i = Math.floor(u), j = Math.floor(v), fu = u - i, fv = v - j; return (near(i, j) * (1 - fu) + near(i + 1, j) * fu) * (1 - fv) + (near(i, j + 1) * (1 - fu) + near(i + 1, j + 1) * fu) * fv; };
    const done = new Set();
    meshes.forEach(m => { const g = m.geometry; if (done.has(g)) return; done.add(g); const p = g.attributes.position; for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i) - height(p.getX(i), p.getZ(i))); p.needsUpdate = true; g.computeBoundingBox(); g.computeBoundingSphere(); });
  }
  const used = new Set();
  function place(gltf, x, z, s = 1, ry = 0, y = null, shadow = true, maxZ = null) {
    const o = used.has(gltf) ? gltf.scene.clone(true) : gltf.scene; used.add(gltf); o.position.set(0, 0, 0); o.rotation.y = ry; o.scale.setScalar(s); o.updateMatrixWorld(true);
    const b = new THREE.Box3().setFromObject(o), c = b.getCenter(new THREE.Vector3());
    o.position.x += x - c.x; o.position.z += z - c.z; o.position.y += (y === null ? 0.3 : y) - b.min.y;
    if (maxZ !== null && b.max.z + (z - c.z) > maxZ) o.position.z -= b.max.z + (z - c.z) - maxZ;
    o.traverse(m => { if (m.isMesh) { m.castShadow = shadow; m.receiveShadow = true; if (m.material) { m.material.roughness = Math.max(m.material.roughness ?? 1, 0.72); m.material.metalness = Math.min(m.material.metalness ?? 0, 0.3); } } });
    scene.add(o); return o;
  }

  let done = 0; const list = ['ishtar_gate', 'uruk_ishtar_ziggurat', 'uruk_eanna', 'uruk_palace', 'uruk_quarter_10', 'uruk_quarter_16', 'palm_date_a', 'palm_date_c', 'reed_beach_a', 'pers_fishship', 'hunter'];
  const models = {};
  await Promise.all(list.map(n => load(n).then(g => { models[n] = g; opts.onProgress?.(++done / list.length); })));

  const uWind = { value: 0 };
  function windy(mat, amp, top) {
    mat.onBeforeCompile = s => {
      s.uniforms.uWind = uWind;
      s.vertexShader = 'uniform float uWind;\n' + s.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        { float ph = instanceMatrix[3][0]*.13 + instanceMatrix[3][2]*.09; float f = pow(clamp(position.y/${top.toFixed(1)},0.,1.),2.);
          transformed.x += (sin(uWind*.9+ph)+.5*sin(uWind*2.1+ph*2.))*f*${amp.toFixed(2)}; transformed.z += cos(uWind*.7+ph)*f*${(amp * 0.5).toFixed(2)}; }`);
    };
    return mat;
  }
  function instancer(gltf, placements, amp, top, shadow = true) {
    let mesh = null; gltf.scene.traverse(m => { if (m.isMesh && !mesh) mesh = m; });
    const mat = mesh.material.clone(); mat.alphaTest = 0.45; mat.transparent = false; mat.side = THREE.DoubleSide; mat.roughness = 0.9; mat.metalness = 0;
    if (amp) windy(mat, amp, top);
    const inst = new THREE.InstancedMesh(mesh.geometry, mat, placements.length), d = new THREE.Object3D();
    placements.forEach((p, i) => { d.position.set(p[0], p[1], p[2]); d.rotation.set(0, p[4] ?? rnd(6.28), 0); d.scale.setScalar(p[3]); d.updateMatrix(); inst.setMatrixAt(i, d.matrix); });
    inst.castShadow = shadow; inst.receiveShadow = true; inst.frustumCulled = false; scene.add(inst); return inst;
  }

  // Město podle stejných modelů jako ve hře. Rozestavěné blíž k sobě, aby se vešlo do záběru.
  const TELL = 21;
  const tell = new THREE.Mesh(new THREE.PlaneGeometry(9000, 2600), new THREE.MeshStandardMaterial({ map: noiseTexture('#a98e66', 0.09, [40, 12]), roughness: 1 }));
  tell.rotation.x = -Math.PI / 2; tell.position.set(0, TELL, -1320); tell.receiveShadow = true; scene.add(tell);
  {
    // Svah spojuje rovinu u hradby s hranou návrší (ta je na z = -20). Oba konce o kus přesahují, aby nevznikla škvíra.
    const low = { y: 0.2, z: -6 }, high = { y: TELL + 0.05, z: -21.5 };
    const rise = high.y - low.y, run = low.z - high.z, tilt = Math.atan2(rise, run);
    const slopeMat = tell.material.clone(); slopeMat.color.set(0xd8cdb6);
    const slope = new THREE.Mesh(new THREE.PlaneGeometry(9000, Math.hypot(rise, run)), slopeMat);
    slope.position.set(0, (low.y + high.y) / 2, (low.z + high.z) / 2); slope.rotation.x = -Math.PI / 2 + tilt; slope.receiveShadow = true; scene.add(slope);
  }
  [models.uruk_quarter_16, models.uruk_quarter_10, models.uruk_palace, models.uruk_eanna].forEach(g => flatten(g));
  const EDGE = -28;
  place(models.uruk_quarter_16, -200, -255, 1, 0.45, TELL + 0.1, true, EDGE);
  place(models.uruk_quarter_10, 62, -270, 1, -0.3, TELL + 0.1, true, EDGE);
  place(models.uruk_quarter_16, 360, -300, 1, 2.4, TELL + 0.1, true, EDGE);
  place(models.uruk_palace, -128, -112, 1, 0.25, TELL + 0.2, true, EDGE);
  place(models.uruk_eanna, 12, -110, 0.8, 0.1, TELL + 0.2, true, EDGE);
  const zig = place(models.uruk_ishtar_ziggurat, 76, -128, 2.05, 2.75, TELL + 0.2);
  const gate = place(models.ishtar_gate, 0, 12, 1, 0);
  const gb = new THREE.Box3().setFromObject(gate);

  // Hradba navazuje na bránu, používá její glazuru
  let glaze = null, baked = null;
  gate.traverse(m => { if (m.isMesh) (Array.isArray(m.material) ? m.material : [m.material]).forEach(x => { if (x.name === 'blueglaze') glaze = x; if (x.name === 'bakedbrick') baked = x; }); });
  glaze.color.setRGB(1.05, 1.22, 1.72); glaze.roughness = 0.6;
  const wallMat = glaze.clone(); wallMat.side = THREE.FrontSide; wallMat.vertexColors = false;
  if (wallMat.map) { wallMat.map = wallMat.map.clone(); wallMat.map.wrapS = wallMat.map.wrapT = THREE.RepeatWrapping; wallMat.map.needsUpdate = true; }
  const WALL_H = 18, WALL_Z = gb.max.z - 21, geoList = [];
  const addBox = (w, h, d, x, y, z) => { const g = new THREE.BoxGeometry(w, h, d); const uv = g.attributes.uv, nrm = g.attributes.normal; for (let i = 0; i < uv.count; i++) { const sx = Math.abs(nrm.getX(i)) > 0.5 ? d : w, sy = Math.abs(nrm.getY(i)) > 0.5 ? d : h; uv.setXY(i, uv.getX(i) * sx / 9, uv.getY(i) * sy / 9); } g.translate(x, y, z); geoList.push(g); };
  [[gb.min.x, -1], [gb.max.x, 1]].forEach(([start, dir]) => {
    const LEN = 1700;
    addBox(LEN, WALL_H, 11, start + dir * LEN / 2, WALL_H / 2, WALL_Z);
    for (let d = 3; d < LEN; d += 4.6) addBox(2.6, 2.1, 11.2, start + dir * d, WALL_H + 1.05, WALL_Z);
    for (let t = 62; t < LEN; t += 118) {
      const tx = start + dir * t;
      addBox(21, WALL_H + 9, 19, tx, (WALL_H + 9) / 2, WALL_Z + 2);
      for (let a = -9; a <= 9; a += 4.5) addBox(2.6, 2.1, 19.6, tx + a, WALL_H + 10.05, WALL_Z + 2);
    }
  });
  const wall = new THREE.Mesh(mergeGeometries(geoList), wallMat);
  wall.castShadow = true; wall.receiveShadow = true; scene.add(wall);

  // Palmy a rákosí
  const palms = [
    [-58, bankHeight(-58, 238) - 0.5, 238, 1.0], [-49, bankHeight(-49, 268) - 0.5, 268, 1.02], [-72, bankHeight(-72, 214) - 0.4, 214, 0.86],
    [5, bankHeight(5, 234) - 0.5, 234, 0.92], [17, bankHeight(17, 218) - 0.5, 218, 1.02], [46, bankHeight(46, 240) - 0.5, 240, 1.15]
  ];
  for (let i = 0; i < 60; i++) { const x = rnd(-900, 900); if (Math.abs(x) < 70) continue; palms.push([x, 0.3, rnd(24, 35), rnd(0.72, 1.1)]); }
  const palmsA = palms.filter((_, i) => i % 2 === 0), palmsB = palms.filter((_, i) => i % 2 === 1);
  instancer(models.palm_date_a, palmsA, 0.55, 18);
  instancer(models.palm_date_c, palmsB, 0.55, 18);
  const inner = []; for (let i = 0; i < 40; i++) inner.push([rnd(-520, 520), TELL, rnd(-140, -34), rnd(0.72, 1.1)]);
  instancer(models.palm_date_a, inner, 0.5, 18);
  const reeds = [];
  for (let i = 0; i < 3200; i++) {
    const x = rnd(-240, 200), z = rnd(205, 300), y = bankHeight(x, z);
    if (y < -1.05 || (y > 1.2 && rnd() < 0.55)) continue;
    reeds.push([x, y - 0.2, z, rnd(0.3, 0.72) * (z > 270 ? 0.8 : 1)]);
  }
  const reedMesh = instancer(models.reed_beach_a, reeds, 0.42, 4, false);
  { const tints = ['#7d8f4c', '#93a35a', '#a79a58', '#5f7a44', '#b4a468'].map(col); reeds.forEach((_, i) => reedMesh.setColorAt(i, tints[i % 5])); reedMesh.instanceColor.needsUpdate = true; }

  // Lodě
  const shipMesh = []; models.pers_fishship.scene.traverse(m => { if (m.isMesh) shipMesh.push(m); });
  const wakeTex = (() => {
    const w = 256, h = 128, c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
    g.translate(w / 2, h / 2); g.scale(1, 0.46);
    const r = g.createRadialGradient(0, 0, 40, 0, 0, 124);
    r.addColorStop(0, 'rgba(255,255,255,.75)'); r.addColorStop(0.38, 'rgba(255,255,255,.38)'); r.addColorStop(0.62, 'rgba(255,255,255,.13)'); r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r; g.beginPath(); g.arc(0, 0, 124, 0, 6.3); g.fill();
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  const wakeMat = new THREE.MeshBasicMaterial({ map: wakeTex, transparent: true, depthWrite: false, opacity: 0.5, fog: false });
  const boats = [[-260, 170, 2.6, 1.15], [120, 96, -3.4, 1.35], [-70, 136, 1.9, 1.05], [340, 72, -2.2, 1.2]].map(b => {
    const g = new THREE.Group(); shipMesh.forEach(m => { const c = new THREE.Mesh(m.geometry, m.material); c.castShadow = true; g.add(c); });
    g.scale.setScalar(b[3]); g.rotation.y = b[2] > 0 ? Math.PI / 2 : -Math.PI / 2; scene.add(g);
    const wake = new THREE.Mesh(new THREE.PlaneGeometry(13 * b[3] * 1.5, 4.6 * b[3] * 1.9), wakeMat); wake.rotation.x = -Math.PI / 2; wake.renderOrder = 2; scene.add(wake);
    return { g, wake, x: b[0], z: b[1], v: b[2], s: b[3], ph: rnd(6.28) };
  });

  // Lovec na břehu
  const hunter = models.hunter.scene; hunter.traverse(m => { if (m.isMesh) { m.castShadow = true; m.frustumCulled = false; } }); scene.add(hunter);
  const mixer = new THREE.AnimationMixer(hunter);
  const clips = Object.fromEntries(models.hunter.animations.map(a => [a.name, mixer.clipAction(a)]));
  const hb = new THREE.Box3().setFromObject(hunter), hs = 1.9 / Math.max(hb.max.y - hb.min.y, 0.01); hunter.scale.setScalar(hs * 1.08);
  clips.Walk?.play(); clips.Idle?.play(); if (clips.Idle) clips.Idle.setEffectiveWeight(0);
  const H = { x: -8, z: 246, dir: 1, speed: 1.15, state: 'walk', timer: 9 };

  // Lidé na nábřeží a stráže na hradbě
  const bodyGeo = (() => { const a = new THREE.CapsuleGeometry(0.33, 1.05, 3, 6); a.translate(0, 0.86, 0); const h = new THREE.SphereGeometry(0.21, 6, 5); h.translate(0, 1.72, 0); return mergeGeometries([a, h]); })();
  const CROWD = 64, GUARDS = 12;
  const people = new THREE.InstancedMesh(bodyGeo, new THREE.MeshStandardMaterial({ roughness: 1 }), CROWD + GUARDS);
  const clothes = ['#d9c7a2', '#a8462c', '#c9a062', '#35508f', '#ece0c6', '#7d5a36', '#b87a3a', '#eadcc0'].map(col);
  const walkers = [];
  for (let i = 0; i < CROWD + GUARDS; i++) {
    const guard = i >= CROWD;
    const w = guard ? { x: rnd(-520, 520), z: WALL_Z + rnd(-3.5, 3.5), y: WALL_H, v: rnd(0.8, 1.2) * (rnd() < 0.5 ? -1 : 1), min: -640, max: 640, torch: i % 2 === 0 } : { x: rnd(-560, 560), z: rnd(29, 45), y: 0.4, v: rnd(0.8, 1.7) * (rnd() < 0.5 ? -1 : 1), min: -600, max: 600, torch: i % 7 === 0 };
    if (!guard && rnd() < 0.2) { w.x = rnd(-14, 14); w.z = rnd(30, 46); w.vz = rnd(0.7, 1.3); w.v *= 0.1; }
    w.ph = rnd(6.28); walkers.push(w); people.setColorAt(i, guard ? col('#a8462c') : clothes[i % clothes.length]);
  }
  people.castShadow = false; people.frustumCulled = false; scene.add(people);

  // Ptáci
  const wing = new THREE.BufferGeometry();
  wing.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0.42, 0, 0, -0.42, 1.25, 0.06, -0.08], 3)); wing.computeVertexNormals();
  const birdMat = new THREE.MeshBasicMaterial({ color: 0x1a1612, side: THREE.DoubleSide });
  const BIRDS = 34, wingL = new THREE.InstancedMesh(wing, birdMat, BIRDS), wingR = new THREE.InstancedMesh(wing, birdMat, BIRDS);
  wingL.frustumCulled = wingR.frustumCulled = false; scene.add(wingL, wingR);
  const birdOff = []; for (let i = 0; i < BIRDS; i++) { const row = Math.ceil(i / 2), s = i % 2 ? 1 : -1; birdOff.push([s * row * rnd(2.6, 3.8) + rnd(-1, 1), rnd(-2.4, 2.4) + row * 0.4, row * rnd(2.4, 3.4), rnd(6.28), rnd(1.0, 1.35)]); }

  // Kouř
  const smokeTex = radialTexture([[0, 'rgba(255,255,255,.58)'], [0.45, 'rgba(255,255,255,.2)'], [1, 'rgba(255,255,255,0)']]);
  const smoke = []; const chimneys = [[-150, 34, -150], [-60, 31, -170], [40, 33, -230], [205, 34, -240], [-280, 33, -250], [-210, 32, -180]];
  chimneys.forEach(c => { for (let i = 0; i < 11; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex, transparent: true, depthWrite: false, fog: true, opacity: 0 })); s.userData = { c, t: i / 11, seed: rnd(6.28) }; scene.add(s); smoke.push(s); } });

  // Světla: lampy, okna, pochodně, světlušky
  const glowTex = radialTexture([[0, 'rgba(255,255,255,1)'], [0.18, 'rgba(255,214,150,.9)'], [0.5, 'rgba(255,150,70,.22)'], [1, 'rgba(255,120,50,0)']], 64);
  const lamps = [];
  const addLamp = (x, y, z, s, flick = 1) => lamps.push({ x, y, z, s, flick, ph: rnd(6.28) });
  for (let t = 62; t < 900; t += 118) { [-1, 1].forEach(d => { addLamp(d * (44 + t), WALL_H + 11.4, WALL_Z + 12.5, 6); }); }
  [-38, -22, 22, 38].forEach(x => addLamp(x, 19, gb.max.z + 1.5, 8)); addLamp(-9, 12, gb.max.z + 1, 7); addLamp(9, 12, gb.max.z + 1, 7);
  const zb = new THREE.Box3().setFromObject(zig), topC = new THREE.Vector3(); let topN = 0;
  zig.updateMatrixWorld(true); zig.traverse(m => { if (!m.isMesh) return; const p = m.geometry.attributes.position, v = new THREE.Vector3(); for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).applyMatrix4(m.matrixWorld); if (v.y > zb.max.y - 7) { topC.add(v); topN++; } } });
  topC.divideScalar(topN || 1);
  addLamp(topC.x - 11, zb.max.y + 0.6, topC.z + 14, 11); addLamp(topC.x + 11, zb.max.y + 0.6, topC.z + 14, 11);
  addLamp(76, 42, -92, 5); addLamp(58, 30, -88, 4.5); addLamp(94, 30, -88, 4.5);
  for (let i = 0; i < 260; i++) addLamp(rnd(-560, 560), TELL + rnd(4, 12), rnd(-470, -70), rnd(1.5, 3.8), 0.3);
  const torchStart = lamps.length; walkers.forEach(w => { if (w.torch) addLamp(0, 0, 0, 3.8); }); boats.forEach(() => addLamp(0, 0, 0, 6));
  const lampGeo = new THREE.BufferGeometry(), lp = new Float32Array(lamps.length * 3), ls = new Float32Array(lamps.length), lf = new Float32Array(lamps.length * 2);
  lamps.forEach((l, i) => { lp.set([l.x, l.y, l.z], i * 3); ls[i] = l.s; lf[i * 2] = l.ph; lf[i * 2 + 1] = l.flick; });
  lampGeo.setAttribute('position', new THREE.BufferAttribute(lp, 3)); lampGeo.setAttribute('size', new THREE.BufferAttribute(ls, 1)); lampGeo.setAttribute('fl', new THREE.BufferAttribute(lf, 2));
  const lampMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uA: { value: 0 }, uT: { value: 0 }, uTex: { value: glowTex }, uPx: { value: 1 } },
    vertexShader: `attribute float size; attribute vec2 fl; uniform float uT,uPx; varying float vF; void main(){ vF = 1.-fl.y*.28*(.5+.5*sin(uT*7.+fl.x)*sin(uT*2.3+fl.x*1.7)); vec4 mv = modelViewMatrix*vec4(position,1.); gl_PointSize = size*uPx/-mv.z; gl_Position = projectionMatrix*mv; }`,
    fragmentShader: `uniform sampler2D uTex; uniform float uA; varying float vF; void main(){ vec4 t = texture2D(uTex,gl_PointCoord); gl_FragColor = vec4(t.rgb*vec3(1.6,1.15,.7)*t.a*uA*vF*2.2,1.); }`
  });
  const lampPts = new THREE.Points(lampGeo, lampMat); lampPts.frustumCulled = false; scene.add(lampPts);

  const MOTES = 170, mp = new Float32Array(MOTES * 3), md = [];
  for (let i = 0; i < MOTES; i++) { const a = [rnd(-48, 48), rnd(0.6, 20), rnd(205, 288)]; mp.set(a, i * 3); md.push({ b: a, ph: rnd(6.28), s: rnd(0.3, 1) }); }
  const moteGeo = new THREE.BufferGeometry(); moteGeo.setAttribute('position', new THREE.BufferAttribute(mp, 3));
  const moteMat = new THREE.PointsMaterial({ map: glowTex, size: 0.55, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xffd9a0, opacity: 0.5 });
  const motes = new THREE.Points(moteGeo, moteMat); motes.frustumCulled = false; scene.add(motes);

  // Létající disk bohů: stejně jako ve hře jen občas, jen jako podívaná
  let disc = null, discGlow = null, discTimer = -1, discN = 0;
  load('sky_disc').then(g => {
    disc = g.scene; disc.scale.setScalar(5.5); disc.visible = false; scene.add(disc);
    discGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, color: 0xffe3ad }));
    discGlow.scale.setScalar(90); discGlow.visible = false; scene.add(discGlow);
  }).catch(() => {});

  // Výstup
  const rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: low ? 0 : 4 });
  const composer = new EffectComposer(renderer, rt);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.38, 0.62, 0.86);
  if (!low) composer.addPass(bloom);
  composer.addPass(new OutputPass());

  let W = 0, HH = 0, scrollP = 0, scrollS = 0;
  const mouse = { x: 0, y: 0, sx: 0, sy: 0 };
  function resize() {
    W = canvas.clientWidth || innerWidth; HH = canvas.clientHeight || innerHeight;
    renderer.setSize(W, HH, false); composer.setPixelRatio(pixelRatio); composer.setSize(W, HH);
    camera.aspect = W / HH;
    camera.fov = W / HH < 1.3 ? 25 * (1.3 / (W / HH)) * 0.72 : 25;
    camera.updateProjectionMatrix();
    lampMat.uniforms.uPx.value = HH * pixelRatio * 0.62;
  }
  addEventListener('resize', resize); resize();
  addEventListener('pointermove', e => { mouse.x = e.clientX / innerWidth - 0.5; mouse.y = e.clientY / innerHeight - 0.5; }, { passive: true });

  const camA = new THREE.Vector3(-22, 7.2, 322), lookA = new THREE.Vector3(-30, 34, 0);
  const camB = new THREE.Vector3(38, 58, 150), lookB = new THREE.Vector3(70, 8, -220);
  const lookNow = new THREE.Vector3(), sunDir = new THREE.Vector3(), d = new THREE.Object3D();
  const tmpColor = new THREE.Color();

  function setPhase(p) {
    const th = p * Math.PI * 2, s = Math.sin(th);
    const zs = -0.92 + 2.5 * smooth(0.02, 0.5, s) ;
    sunDir.set(-Math.cos(th) * 0.2, s * 0.82, zs).normalize();
    const alt = Math.asin(sunDir.y) * 57.3;
    palette(alt, pal);
    const nightA = smooth(4, -7, alt);
    hemi.color.copy(pal.sky); hemi.groundColor.copy(pal.gnd); hemi.intensity = pal.ai;
    sun.color.copy(pal.sun); sun.intensity = pal.si;
    sun.position.copy(sunDir).multiplyScalar(1100).add(sun.target.position); sun.castShadow = alt > -3;
    moonLight.intensity = 0.55 * nightA;
    scene.fog.color.copy(pal.hor).lerp(pal.mid, 0.25);
    skyU.uSunCol.value.copy(pal.sun); skyU.uSunDir.value.copy(sunDir); skyU.uStar.value = smooth(-4, -15, alt); skyU.uSunGlow.value = smooth(-9, 1, alt);
    wu.uSunDir.value.copy(sunDir); wu.uSunCol.value.copy(pal.sun).multiplyScalar(smooth(-1, 5, alt)); wu.uHor.value.copy(scene.fog.color);
    wu.uDeep.value.copy(pal.mid).lerp(col('#0b1a2b'), 0.62);
    const mth = (p - 0.5) * Math.PI * 2, ms = Math.sin(mth);
    moon.position.set(-Math.cos(mth) * 1200, 240 + ms * 400, -2500); moon.material.opacity = smooth(-1, -9, alt);
    moon.visible = moon.material.opacity > 0.01;
    lampMat.uniforms.uA.value = smooth(6, -5, alt);
    gateLights.forEach((l, i) => { l.intensity = (i === 2 ? 3400 : 1900) * smooth(3, -7, alt); });
    moteMat.color.set(nightA > 0.5 ? 0xb8e86c : 0xffd9a0); moteMat.opacity = nightA > 0.5 ? 0.85 : smooth(55, 8, alt) * 0.55;
    moteMat.size = nightA > 0.5 ? 0.42 : 0.3;
    return { alt, nightA };
  }

  let last = performance.now(), T = 0, running = true, shadowClock = 0, slow = 0, frames = 0, level = low ? 2 : 0;
  function tick(now) {
    if (!running) return;
    requestAnimationFrame(tick);
    const dt = Math.min((now - last) / 1000, 0.1); last = now; T += dt;
    if (!freeze && !opts.reduced) phi = (phi + dt / CYCLE) % 1;
    const st = setPhase(phi);
    uWind.value = T; skyU.uTime.value = T; wu.uTime.value = T; lampMat.uniforms.uT.value = T;

    // Kamera: mírný pohyb, reaguje na myš a posun stránky
    mouse.sx += (mouse.x - mouse.sx) * 0.035; mouse.sy += (mouse.y - mouse.sy) * 0.035; scrollS += (scrollP - scrollS) * 0.05;
    const e = scrollS * scrollS * (3 - 2 * scrollS);
    camera.position.lerpVectors(camA, camB, e); lookNow.lerpVectors(lookA, lookB, e);
    camera.position.x += mouse.sx * 13 + Math.sin(T * 0.11) * 1.6; camera.position.y += -mouse.sy * 3.2 + Math.sin(T * 0.17) * 0.5;
    lookNow.x += mouse.sx * 4; camera.lookAt(lookNow);

    // Lovec
    mixer.update(dt);
    H.timer -= dt;
    if (H.state === 'walk') {
      H.x += H.dir * H.speed * dt;
      if (H.timer < 0 || Math.abs(H.x) > 26) { H.state = 'idle'; H.timer = 3 + rnd(3); clips.Walk?.fadeOut(0.5); clips.Idle?.reset().setEffectiveWeight(1).fadeIn(0.5).play(); if (Math.abs(H.x) > 22) H.dir = -Math.sign(H.x); else if (rnd() < 0.4) H.dir *= -1; }
    } else if (H.timer < 0) { H.state = 'walk'; H.timer = 8 + rnd(7); clips.Idle?.fadeOut(0.5); clips.Walk?.reset().setEffectiveWeight(1).fadeIn(0.5).play(); }
    H.z = 244 + Math.sin(H.x * 0.09) * 3;
    hunter.position.set(H.x, bankHeight(H.x, H.z) - 0.05, H.z);
    const wantRy = H.state === 'idle' ? Math.PI : (H.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
    hunter.rotation.y += (Math.atan2(Math.sin(wantRy - hunter.rotation.y), Math.cos(wantRy - hunter.rotation.y))) * 0.05;

    // Lidé
    let tIdx = torchStart;
    walkers.forEach((w, i) => {
      w.x += w.v * dt; if (w.vz) { w.z += w.vz * dt; if (w.z > 46) { w.z = 22; w.x = rnd(-14, 14); } }
      if (w.x > w.max) w.x = w.min; if (w.x < w.min) w.x = w.max;
      const bob = Math.abs(Math.sin(T * 5.2 + w.ph)) * 0.09;
      d.position.set(w.x, w.y + bob, w.z); d.rotation.set(0, 0, 0); d.scale.setScalar(1.15); d.updateMatrix(); people.setMatrixAt(i, d.matrix);
      if (w.torch) { lp[tIdx * 3] = w.x + 0.4; lp[tIdx * 3 + 1] = w.y + 2.5; lp[tIdx * 3 + 2] = w.z; tIdx++; }
    });
    people.instanceMatrix.needsUpdate = true;

    // Lodě
    boats.forEach(b => {
      b.x += b.v * dt; if (b.x > 620) b.x = -620; if (b.x < -620) b.x = 620;
      b.g.position.set(b.x, -0.2 - 1.05 * b.s + Math.sin(T * 0.8 + b.ph) * 0.1, b.z); b.g.rotation.z = Math.sin(T * 0.6 + b.ph) * 0.022;
      b.wake.position.set(b.x - Math.sign(b.v) * 1.2 * b.s, -0.12, b.z); b.wake.scale.set(1 + Math.sin(T * 0.7 + b.ph) * 0.05, 1 + Math.cos(T * 0.9 + b.ph) * 0.07, 1);
      lp[tIdx * 3] = b.x; lp[tIdx * 3 + 1] = 2.5; lp[tIdx * 3 + 2] = b.z; tIdx++;
    });
    lampGeo.attributes.position.needsUpdate = true;

    // Ptáci: hejno přelétává nad řekou, v noci spí
    const flock = (T * 0.021) % 1, fx = 520 - flock * 1040, fy = 56 + Math.sin(T * 0.21) * 9, fz = 70 + Math.sin(T * 0.13) * 40, show = smooth(-3, 3, st.alt);
    for (let i = 0; i < BIRDS; i++) {
      const o = birdOff[i], fl = Math.sin(T * 7.4 + o[3]) * 0.62;
      const px = fx + o[2], py = fy + o[1], pz = fz + o[0];
      d.position.set(px, py, pz); d.scale.setScalar(o[4] * show); d.rotation.set(0, Math.PI, fl); d.updateMatrix(); wingL.setMatrixAt(i, d.matrix);
      d.rotation.set(0, 0, fl); d.updateMatrix(); wingR.setMatrixAt(i, d.matrix);
    }
    wingL.instanceMatrix.needsUpdate = wingR.instanceMatrix.needsUpdate = true;
    birdMat.color.copy(pal.cd).multiplyScalar(0.18);
    wakeMat.color.copy(pal.hor).lerp(pal.cl, 0.45); wakeMat.opacity = 0.2 + 0.42 * smooth(-8, 8, st.alt);

    // Kouř
    tmpColor.copy(pal.sky).lerp(pal.cl, 0.4);
    smoke.forEach(s => {
      const u = s.userData; u.t += dt * 0.055; if (u.t > 1) u.t -= 1;
      const k = u.t;
      s.position.set(u.c[0] + k * 24 + Math.sin(k * 5 + u.seed) * 2.5, u.c[1] + k * 46, u.c[2] + Math.cos(k * 4 + u.seed) * 2);
      s.scale.setScalar(4 + k * 21); s.material.opacity = Math.sin(Math.min(k * 5, 1) * 1.57) * (1 - k) * 0.5;
      s.material.color.copy(tmpColor);
    });

    // Prach ve slunci, v noci světlušky
    for (let i = 0; i < MOTES; i++) { const m = md[i]; mp[i * 3] = m.b[0] + Math.sin(T * 0.23 * m.s + m.ph) * 3.2; mp[i * 3 + 1] = m.b[1] + Math.sin(T * 0.31 * m.s + m.ph * 2) * 1.5; mp[i * 3 + 2] = m.b[2] + Math.cos(T * 0.19 * m.s + m.ph) * 2.2; }
    moteGeo.attributes.position.needsUpdate = true;

    // Disk: objeví se za soumraku, zhruba každý druhý den
    if (disc && discTimer < 0 && phi > 0.47 && phi < 0.475) { discN++; if (discN % 2 === 1) discTimer = 0; }
    if (disc && discTimer >= 0) {
      discTimer += dt / 6.5; const k = discTimer;
      if (k > 1) { discTimer = -1; disc.visible = discGlow.visible = false; }
      else { disc.visible = discGlow.visible = true; const a = (k - 0.5); disc.position.set(-760 + k * 1500, 112 + Math.sin(k * 3.14) * 26 - a * a * 40, -360 + k * 120); disc.rotation.set(0.1, T * 1.1, 0.06); discGlow.position.copy(disc.position); discGlow.material.opacity = 0.9; }
    }

    // Stíny se přepočítávají jen občas, slunce se pohybuje pomalu
    shadowClock -= dt; if (shadowClock <= 0 && st.alt > -3) { renderer.shadowMap.needsUpdate = true; shadowClock = level ? 0.45 : 0.18; }

    composer.render(dt);

    // Pomalé PC: uber kvalitu, ať web neškube
    frames++; if (dt > 0.034) slow++;
    if (frames === 120) { if (slow > 60 && !opts.capture) { level++; if (level === 1) { pixelRatio = Math.min(pixelRatio, 1); bloom.enabled = false; resize(); } if (level === 2) { pixelRatio = 0.75; resize(); document.documentElement.classList.add('low-fx'); } opts.onLevel?.(level); } frames = slow = 0; }
    window.__sceneReady = (window.__sceneReady || 0) + 1;
  }
  renderer.shadowMap.needsUpdate = true;
  opts.onReady?.();
  requestAnimationFrame(tick);
  document.addEventListener('visibilitychange', () => { if (document.hidden) running = false; else if (!running) { running = true; last = performance.now(); requestAnimationFrame(tick); } });
  return { setScroll(p) { scrollP = clamp(p); }, jump(p) { scrollP = scrollS = clamp(p); }, setPhase(p) { phi = p; }, get phase() { return phi; }, get discOn() { return !!disc && disc.visible; }, get time() { return T; } };
}
