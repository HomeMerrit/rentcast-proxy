// Living-world hero — a warm 3D campus diorama.
// A customer's task flows Sales → Ops → Finance and becomes revenue.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const CANVAS = document.getElementById('hero3d');
if (CANVAS) boot();

function boot(){
  const wrap = CANVAS.parentElement;
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion:reduce)').matches;

  const COL = {
    grass:0x9BC47F, soil:0xC7A278, soilDark:0xAD8A5F,
    floor:0xE7D3A6, wall:0xF2EAD8,
    sales:0x5A97D6, ops:0xE08A5B, finance:0xE6AE3C,
    eng:0x8B79D4, mktg:0xE06A9A, support:0x4FB0AA,
    trunk:0x9C7A50, leaf:0x8FBE79, leaf2:0x7FB06B,
    gold:0xF2C24B, paper:0xFFFFFF, screen:0xBFD8EE,
  };

  const renderer = new THREE.WebGLRenderer({ canvas:CANVAS, antialias:true, alpha:true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const camera = new THREE.PerspectiveCamera(31, 1, 0.1, 200);
  const camBase = new THREE.Vector3(19, 16, 23);
  const camTarget = new THREE.Vector3(0, 1.8, -1.0);
  camera.position.copy(camBase);
  camera.lookAt(camTarget);

  // ---- lighting: warm key + soft sky, image-based fill from the environment ----
  const key = new THREE.DirectionalLight(0xFFE3BC, 2.9);
  key.position.set(-9, 15, 10);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.radius = 5;
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.03;
  const sc = key.shadow.camera;
  sc.left=-24; sc.right=24; sc.top=24; sc.bottom=-24; sc.near=1; sc.far=70;
  scene.add(key);
  scene.add(new THREE.HemisphereLight(0xFFF1DC, 0x8E7E60, 0.32));
  const rim = new THREE.DirectionalLight(0xFFD3A0, 0.55); rim.position.set(9, 6, -11); scene.add(rim);

  // ---- material + geometry helpers ----
  const geoCache = {};
  function rbox(w,h,d,r){ const k=[w,h,d,r].join(','); return geoCache[k] || (geoCache[k]=new RoundedBoxGeometry(w,h,d,3,r)); }
  function mat(color, o={}){ return new THREE.MeshStandardMaterial({ color, roughness:o.rough??0.78, metalness:o.metal??0.0, emissive:o.emissive??0x000000, emissiveIntensity:o.ei??1, transparent:!!o.transparent, opacity:o.opacity??1, envMapIntensity:o.env??0.42 }); }
  function box(w,h,d,r,color,o){ const m=new THREE.Mesh(rbox(w,h,d,r), mat(color,o)); m.castShadow=true; m.receiveShadow=true; return m; }

  const root = new THREE.Group(); scene.add(root);

  // ---- floating island ----
  (function island(){
    const g = new THREE.Group();
    const grass = box(26, 1.4, 22, 0.6, COL.grass, {rough:0.95}); grass.position.y=-0.7; grass.receiveShadow=true; grass.castShadow=false; g.add(grass);
    const soil = box(24.4, 3.2, 20.4, 0.5, COL.soil, {rough:1}); soil.position.y=-3.0; g.add(soil);
    const soil2 = box(22, 2.6, 18, 0.5, COL.soilDark, {rough:1}); soil2.position.y=-5.4; g.add(soil2);
    root.add(g);
  })();

  // soft contact shadow blob under the island (fake AO for the float)
  (function underShadow(){
    const cnv=document.createElement('canvas'); cnv.width=cnv.height=256;
    const cx=cnv.getContext('2d'); const gr=cx.createRadialGradient(128,128,10,128,128,128);
    gr.addColorStop(0,'rgba(30,24,16,0.42)'); gr.addColorStop(1,'rgba(30,24,16,0)');
    cx.fillStyle=gr; cx.fillRect(0,0,256,256);
    const tex=new THREE.CanvasTexture(cnv);
    const p=new THREE.Mesh(new THREE.PlaneGeometry(40,34), new THREE.MeshBasicMaterial({map:tex,transparent:true,depthWrite:false}));
    p.rotation.x=-Math.PI/2; p.position.y=-7.0; root.add(p);
  })();

  // ---- a smooth "citizen" (lathe-turned figure) + sphere head ----
  function citizen(color){
    const g=new THREE.Group();
    const pts=[[0,0],[0.36,0],[0.40,0.07],[0.26,0.13],[0.205,0.42],[0.225,0.60],[0.17,0.74],[0.055,0.80]].map(p=>new THREE.Vector2(p[0],p[1]));
    const body=new THREE.Mesh(new THREE.LatheGeometry(pts,20), mat(color,{rough:0.62}));
    body.castShadow=true; body.scale.setScalar(1.15); g.add(body);
    const head=new THREE.Mesh(new THREE.SphereGeometry(0.2,20,16), mat(color,{rough:0.55}));
    head.castShadow=true; head.position.y=0.80*1.15+0.14; g.add(head);
    return g;
  }

  // ---- a desk with a glowing monitor ----
  function desk(accent){
    const g=new THREE.Group();
    const top=box(1.0,0.5,0.66,0.08,0x8A6A46,{rough:0.85}); top.position.y=0.25; g.add(top);
    const scr=box(0.62,0.44,0.06,0.03,COL.screen,{emissive:accent,ei:0.55,rough:0.4}); scr.position.set(0,0.72,-0.12); g.add(scr);
    return g;
  }

  // ---- open-corner office room (dollhouse cutaway) with a team inside ----
  const roomInfo={};
  function room(name, x, color){
    const g=new THREE.Group(); g.position.set(x,0,0);
    const S=5.2;
    const floor=box(S,0.4,S,0.14,COL.floor,{rough:0.9}); floor.position.y=0.2; g.add(floor);
    // two back walls forming an L at the far corner (open toward camera)
    const wallH=3.0;
    const wl=box(0.3,wallH,S,0.1,color,{rough:0.85}); wl.position.set(-S/2+0.15,0.2+wallH/2,0); g.add(wl);
    const wr=box(S,wallH,0.3,0.1,new THREE.Color(color).multiplyScalar(0.9).getHex(),{rough:0.85}); wr.position.set(0,0.2+wallH/2,-S/2+0.15); g.add(wr);
    // window on the -Z wall
    const win=box(1.7,1.2,0.08,0.06,COL.screen,{emissive:0xBFE0FF,ei:0.35,rough:0.3,metal:0.1}); win.position.set(0.4,2.0,-S/2+0.32); g.add(win);
    // team + desks
    const spots=[[-1.1,1.0],[1.0,0.2],[-0.2,-1.0]];
    const desks=[];
    spots.forEach((s,i)=>{
      const dk=desk(color); dk.position.set(s[0],0.4,s[1]-0.5); dk.rotation.y=0.5; g.add(dk);
      const c=citizen(color); c.position.set(s[0],0.4,s[1]); g.add(c);
      c.userData.bob=Math.random()*6.28;
      desks.push(c);
    });
    roomInfo[name]={group:g, team:desks, x};
    root.add(g);
  }

  room('sales', -7.2, COL.sales);
  room('ops',    0.0, COL.ops);
  room('finance',7.2, COL.finance);

  // ---- context skyline (solid, muted) behind the campus ----
  function tower(x,z,w,h,color){
    const g=new THREE.Group(); g.position.set(x,0,z);
    const b=box(w,h,w,0.25,color,{rough:0.9}); b.position.y=0.2+h/2; g.add(b);
    const roof=new THREE.Mesh(new THREE.ConeGeometry(w*0.82,w*0.7,4), mat(new THREE.Color(color).multiplyScalar(1.08).getHex(),{rough:0.85}));
    roof.castShadow=true; roof.rotation.y=Math.PI/4; roof.position.y=0.2+h+w*0.35; g.add(roof);
    root.add(g);
  }
  tower(-8.5,-7.5,3.0,3.4,COL.eng);
  tower(-1.5,-8.5,3.2,2.6,COL.mktg);
  tower( 6.0,-8.0,3.0,3.0,COL.support);

  // ---- trees ----
  function tree(x,z,s=1){
    const g=new THREE.Group(); g.position.set(x,0.2,z); g.scale.setScalar(s);
    const t=new THREE.Mesh(new THREE.CylinderGeometry(0.16,0.2,1.0,8), mat(COL.trunk,{rough:1})); t.position.y=0.5; t.castShadow=true; g.add(t);
    const f=new THREE.Mesh(new THREE.IcosahedronGeometry(0.95,1), mat(COL.leaf,{rough:0.9})); f.position.y=1.5; f.castShadow=true; g.add(f);
    const f2=new THREE.Mesh(new THREE.IcosahedronGeometry(0.6,1), mat(COL.leaf2,{rough:0.9})); f2.position.set(0.5,1.1,0.2); f2.castShadow=true; g.add(f2);
    root.add(g);
  }
  tree(-11,6,1.1); tree(11,5,1.0); tree(0,9,1.2); tree(-6,9,0.9); tree(8,9,1.05); tree(11,-2,0.95);

  // ---- the task token (glowing document) + soft glow sprite ----
  function glowSprite(rgb, scale){
    const cnv=document.createElement('canvas'); cnv.width=cnv.height=128;
    const cx=cnv.getContext('2d'); const g=cx.createRadialGradient(64,64,3,64,64,64);
    g.addColorStop(0,'rgba('+rgb+',0.95)'); g.addColorStop(0.5,'rgba('+rgb+',0.35)'); g.addColorStop(1,'rgba('+rgb+',0)');
    cx.fillStyle=g; cx.fillRect(0,0,128,128);
    const s=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(cnv), transparent:true, depthWrite:false, blending:THREE.AdditiveBlending}));
    s.scale.setScalar(scale); return s;
  }
  const token=new THREE.Group();
  const tGlow=glowSprite('255,150,105', 5.4); token.add(tGlow);
  const doc=box(0.92,1.14,0.16,0.09,0xF07A55,{emissive:0xED7150,ei:0.7,rough:0.4}); token.add(doc);
  // little text lines on the card
  const lineMat=mat(0xFFF3E0,{rough:0.6, emissive:0xFFF3E0, ei:0.2});
  for(let i=0;i<3;i++){ const ln=new THREE.Mesh(rbox(0.48-i*0.07,0.09,0.02,0.02), lineMat); ln.position.set(-0.06,0.24-i*0.26,0.1); doc.add(ln); }
  root.add(token);

  // path — the task rides ABOVE the offices (never hidden), dipping toward each team
  const curve=new THREE.CatmullRomCurve3([
    new THREE.Vector3(-13,3.1,4.2),
    new THREE.Vector3(-8.0,2.75,0.6), new THREE.Vector3(-6.0,3.0,-0.4),
    new THREE.Vector3(-1.0,2.75,0.6), new THREE.Vector3(1.0,3.05,-0.4),
    new THREE.Vector3(6.0,2.75,0.6),  new THREE.Vector3(8.0,3.1,-0.4),
    new THREE.Vector3(7.2,4.0,0.3),
  ]);

  // ---- revenue coin (rises above Finance, glowing) ----
  const coinPivot=new THREE.Group(); root.add(coinPivot); coinPivot.position.set(7.2,0,0.4);
  const cGlow=glowSprite('255,205,80', 4.2); coinPivot.add(cGlow);
  const coin=new THREE.Mesh(new THREE.CylinderGeometry(0.72,0.72,0.16,32), mat(COL.gold,{metal:0.6,rough:0.26,emissive:0x6a4e12,ei:0.55}));
  coin.rotation.x=Math.PI/2; coin.castShadow=true; coinPivot.add(coin);
  coinPivot.visible=false;

  // ---- resize ----
  function resize(){
    const w=wrap.clientWidth, h=Math.round(w*0.62);
    CANVAS.style.height=h+'px';
    renderer.setSize(w,h,false);
    camera.aspect=w/h; camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize); resize();

  // ---- pointer parallax ----
  const ptr={x:0,y:0}, ptrT={x:0,y:0};
  window.addEventListener('pointermove', e=>{
    const r=CANVAS.getBoundingClientRect();
    ptrT.x=((e.clientX-r.left)/r.width-0.5); ptrT.y=((e.clientY-r.top)/r.height-0.5);
  });

  // ---- animation ----
  const LOOP=14.0, tokenStart=2.6, tokenDur=8.6, coinAt=11.0;
  const clock=new THREE.Clock();
  const tmp=new THREE.Vector3();

  function setToken(t){ // t in 0..1 along the curve
    curve.getPointAt(Math.max(0,Math.min(1,t)), tmp); token.position.copy(tmp);
  }

  if(reduce){
    setToken(0.62); token.visible=true; renderer.render(scene,camera); pmrem.dispose(); return;
  }

  function frame(){
    const el=clock.getElapsedTime();
    const lt=el % LOOP;

    // camera: slow drift + eased pointer parallax
    ptr.x+=(ptrT.x-ptr.x)*0.04; ptr.y+=(ptrT.y-ptr.y)*0.04;
    const dz=Math.sin(el*0.18)*0.4, dx=Math.cos(el*0.14)*0.5;
    camera.position.set(camBase.x+dx+ptr.x*2.4, camBase.y+ptr.y*-1.2+Math.sin(el*0.22)*0.25, camBase.z+dz+ptr.x*1.1);
    camera.lookAt(camTarget);

    // token journey
    if(lt>=tokenStart && lt<=tokenStart+tokenDur){
      const p=(lt-tokenStart)/tokenDur;
      setToken(p);
      const f=Math.min(1,(lt-tokenStart)/0.4)*Math.min(1,(tokenStart+tokenDur-lt)/0.4);
      token.visible=true; tGlow.material.opacity=0.95*f;
      doc.rotation.y=el*1.3; token.position.y+=Math.sin(el*3)*0.06;
    } else { token.visible=false; }

    // teams idle-bob; the active room lifts a touch as the token passes
    for(const name in roomInfo){
      const info=roomInfo[name];
      let active=0;
      if(token.visible){ active = Math.max(0, 1 - Math.abs(token.position.x-info.x)/4); }
      info.team.forEach(c=>{
        c.position.y = 0.4 + Math.sin(el*2.2 + c.userData.bob)*0.03 + active*0.06;
      });
    }

    // revenue coin rises + spins at Finance, then fades
    if(lt>=coinAt && lt<=coinAt+2.6){
      const q=(lt-coinAt)/2.6;
      coinPivot.visible=true;
      coinPivot.position.y = 3.0 + q*3.4;
      coin.rotation.z = el*2.6;
      const cf=Math.min(1,q/0.14)*Math.min(1,(1-q)/0.28);
      coin.material.opacity=cf; coin.material.transparent=true; cGlow.material.opacity=cf;
    } else { coinPivot.visible=false; }

    renderer.render(scene,camera);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
