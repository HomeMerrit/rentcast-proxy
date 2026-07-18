// Whole-page 3D congruence — one renderer, many small views (scissor-rendered).
// Each section scene is unique: different departments, heights, layouts, angles.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const COL = {
  grass:0x9BC47F, floor:0xF4EAD6, screen:0xCFE6FF, trunk:0x9C7A50, leaf:0x8FBE79, leaf2:0x7FB06B,
  sales:0x5A97D6, ops:0xE08A5B, finance:0xE6AE3C, eng:0x8B79D4, mktg:0xE06A9A, support:0x4FB0AA, coral:0xED7150, gold:0xF2C24B,
};
const darker=(h,f=0.88)=>new THREE.Color(h).multiplyScalar(f).getHex();
const lighter=(h,f=1.06)=>new THREE.Color(h).multiplyScalar(f).getHex();
const FH=2.35, FS=5.0;

// ---- the six departments, each a different size (floors = team size) ----
const TEAM=[
  {key:'sales',   name:'Sales',       job:'closes deals',       color:COL.sales,   floors:3},
  {key:'support', name:'Support',     job:'answers customers',  color:COL.support, floors:2},
  {key:'finance', name:'Finance',     job:'tracks the money',   color:COL.finance, floors:4},
  {key:'ops',     name:'Operations',  job:'keeps it running',   color:COL.ops,     floors:2},
  {key:'eng',     name:'Engineering', job:'builds the product', color:COL.eng,     floors:5},
  {key:'mktg',    name:'Marketing',   job:'brings people in',   color:COL.mktg,    floors:3},
];
const GROWTH=[
  {stage:1, name:'One worker'},
  {stage:2, name:'A small team'},
  {stage:3, name:'A company'},
  {stage:4, name:'A city at work'},
];

// build the card grids as placeholders (labels live outside the 3D rects)
(function layout(){
  const team=document.getElementById('team');
  if(team) team.innerHTML=TEAM.map(t=>
    `<div class="tw"><div class="v3d" data-scene3d="team:${t.key}"></div><div class="n">${t.name}</div><div class="j">${t.job}</div></div>`).join('');
  const growth=document.getElementById('growth');
  if(growth) growth.innerHTML=GROWTH.map(g=>
    `<div class="grow"><div class="v3d" data-scene3d="growth:${g.stage}"></div><div class="n">${g.name}</div></div>`).join('');
})();

const mounts=[...document.querySelectorAll('[data-scene3d]')];
if(mounts.length && window.WebGLRenderingContext) init();

function init(){
  const canvas=document.createElement('canvas');
  canvas.style.cssText='position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:1';
  document.body.appendChild(canvas);

  const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));
  renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=0.98;
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.autoClear=false;
  const pmrem=new THREE.PMREMGenerator(renderer);
  const ENV=pmrem.fromScene(new RoomEnvironment(),0.04).texture;

  // ---- shared factories ----
  const geo={};
  const rbox=(w,h,d,r)=>{const k=w+','+h+','+d+','+r; return geo[k]||(geo[k]=new RoundedBoxGeometry(w,h,d,3,r));};
  const mat=(color,o={})=>new THREE.MeshStandardMaterial({color,roughness:o.rough??0.72,metalness:o.metal??0,emissive:o.emissive??0,emissiveIntensity:o.ei??1,envMapIntensity:o.env??0.5});
  const box=(w,h,d,r,color,o)=>new THREE.Mesh(rbox(w,h,d,r),mat(color,o));

  let shadowTex=null;
  function contactShadow(w,d){
    if(!shadowTex){const c=document.createElement('canvas');c.width=c.height=128;const x=c.getContext('2d');
      const g=x.createRadialGradient(64,64,6,64,64,64);g.addColorStop(0,'rgba(30,24,16,0.34)');g.addColorStop(1,'rgba(30,24,16,0)');
      x.fillStyle=g;x.fillRect(0,0,128,128);shadowTex=new THREE.CanvasTexture(c);}
    const m=new THREE.Mesh(new THREE.PlaneGeometry(w,d),new THREE.MeshBasicMaterial({map:shadowTex,transparent:true,depthWrite:false}));
    m.rotation.x=-Math.PI/2; m.position.y=0.02; return m;
  }
  // a person — standing or seated at a desk; head kept for idle head-turns
  function person(color, seated){
    const g=new THREE.Group();
    const pts=[[0,0],[0.30,0],[0.315,0.06],[0.235,0.17],[0.205,0.40],[0.245,0.585],[0.235,0.64],[0.115,0.70],[0.075,0.745]].map(p=>new THREE.Vector2(p[0],p[1]));
    const b=new THREE.Mesh(new THREE.LatheGeometry(pts,18),mat(color,{rough:0.6})); g.add(b);
    const h=new THREE.Mesh(new THREE.SphereGeometry(0.195,18,14),mat(color,{rough:0.55})); h.position.y=0.80; g.add(h);
    const inner=g; const wrap=new THREE.Group(); wrap.add(inner);
    if(seated){ inner.scale.set(1.0,0.66,1.0); inner.rotation.x=0.16; }   // lower + lean toward desk
    wrap.userData.head=h; wrap.userData.inner=inner;
    return wrap;
  }
  function deskUnit(accent){
    const g=new THREE.Group();
    const top=box(0.86,0.42,0.56,0.07,0xEDE3CF,{rough:0.7}); top.position.y=0.21; g.add(g.chair=top);
    const legs=box(0.5,0.2,0.2,0.05,darker(accent,0.9),{rough:0.6}); legs.position.set(0,0.1,0.24); g.add(legs);
    const s=box(0.5,0.36,0.05,0.03,COL.screen,{emissive:accent,ei:0.6,rough:0.35,metal:0.15}); s.position.set(0,0.6,-0.08); g.add(s);
    return g;
  }
  function floorLevel(color,teamN,peopleArr){
    const g=new THREE.Group();
    const slab=box(FS,0.2,FS,0.07,0xF2E8D2,{rough:0.75}); slab.position.y=0.1; g.add(slab);
    const band=box(FS+0.05,0.14,FS+0.05,0.04,color,{rough:0.5}); band.position.y=0.2; g.add(band);  // dept floor-line
    const spots=[[-1.05,0.75,true],[0.95,0.05,false],[-0.05,-0.9,true]].slice(0,teamN);
    spots.forEach(s=>{
      const seated=s[2];
      const d=deskUnit(color); d.position.set(s[0],0.2,s[1]-0.6); d.rotation.y=0.35; g.add(d);
      const c=person(color,seated); c.position.set(s[0],0.2,s[1]); g.add(c);
      peopleArr.push({o:c, y:0.2, phase:Math.random()*6.28, seated});
    });
    return g;
  }
  function buildingAt(parent,x,z,color,floors,teamPer,peopleArr){
    const grp=new THREE.Group(); grp.position.set(x,0,z);
    for(let i=0;i<floors;i++){ const lv=floorLevel(color, typeof teamPer==='function'?teamPer(i):teamPer, peopleArr); lv.position.y=0.2+i*FH; grp.add(lv); }
    const H=floors*FH;
    // glass curtain walls (floor-to-ceiling, see-through, dept-tinted)
    const gmat=new THREE.MeshStandardMaterial({color, transparent:true, opacity:0.15, roughness:0.1, metalness:0.0, envMapIntensity:1.2, depthWrite:false, side:THREE.DoubleSide});
    const wallGeo=new THREE.PlaneGeometry(FS,H);
    [[0,FS/2,0],[0,-FS/2,Math.PI],[-FS/2,0,-Math.PI/2],[FS/2,0,Math.PI/2]].forEach(w=>{
      const m=new THREE.Mesh(wallGeo,gmat); m.position.set(w[0],0.2+H/2,w[1]); m.rotation.y=w[2]; m.renderOrder=20; grp.add(m);
    });
    // corner columns (structure)
    const colGeo=rbox(0.15,H,0.15,0.05), colMat=mat(darker(color,0.9),{rough:0.55});
    [[-FS/2,-FS/2],[FS/2,-FS/2],[FS/2,FS/2],[-FS/2,FS/2]].forEach(c=>{ const m=new THREE.Mesh(colGeo,colMat); m.position.set(c[0],0.2+H/2,c[1]); grp.add(m); });
    // flat roof
    const roof=new THREE.Group();
    roof.add(box(FS+0.16,0.24,FS+0.16,0.08,darker(color,0.82),{rough:0.7}));
    const cap=box(FS-0.5,0.12,FS-0.5,0.05,lighter(color,1.05),{rough:0.6}); cap.position.y=0.18; roof.add(cap);
    const vent=box(0.5,0.4,0.5,0.06,0xCFC7B6,{rough:0.85}); vent.position.set(1.0,0.36,-0.6); roof.add(vent);
    roof.position.y=0.2+H+0.12; grp.add(roof);
    parent.add(grp); return grp;
  }
  // an OPEN workspace — the people, no building shell. A standing "hero" worker
  // up front (unobstructed) with two teammates at desks behind. Everyone reads.
  function workerVignette(parent,color,peopleArr){
    const g=new THREE.Group();
    const plate=box(4.0,0.3,3.2,0.5,lighter(color,1.16),{rough:0.72}); plate.position.y=0.15; g.add(plate);
    const band=box(4.1,0.16,3.3,0.05,color,{rough:0.5}); band.position.y=0.28; g.add(band);
    const spots=[
      {x:0.0,  z:0.8,  seated:false, ry:0.0,   s:1.4},
      {x:-1.32,z:-0.5, seated:true,  ry:0.35,  s:1.16},
      {x:1.32, z:-0.5, seated:true,  ry:-0.35, s:1.16},
    ];
    spots.forEach(sp=>{
      if(sp.seated){ const d=deskUnit(color); d.position.set(sp.x,0.3,sp.z-0.58); d.rotation.y=sp.ry; g.add(d); }
      const c=person(color,sp.seated); c.position.set(sp.x,0.3,sp.z); c.rotation.y=sp.ry; c.scale.setScalar(sp.s); g.add(c);
      peopleArr.push({o:c, y:0.3, phase:Math.random()*6.28, seated:sp.seated});
    });
    parent.add(g); return g;
  }
  function tree(parent,x,z,s=1){
    const g=new THREE.Group(); g.position.set(x,0,z); g.scale.setScalar(s);
    const t=new THREE.Mesh(new THREE.CylinderGeometry(0.16,0.2,1,8),mat(COL.trunk,{rough:1})); t.position.y=0.5; g.add(t);
    const f=new THREE.Mesh(new THREE.IcosahedronGeometry(0.9,1),mat(COL.leaf,{rough:0.9})); f.position.y=1.45; g.add(f);
    parent.add(g);
  }

  // ---- scene specs (each unique) ----
  const GROWTH_SPECS={
    1:[['sales',0,0,1,1]],
    2:[['sales',-1.9,0,2,2],['ops',2.4,0.6,1,2]],
    3:[['finance',-4.4,0,2,2],['sales',0,0.6,3,3],['ops',4.4,-0.2,2,2]],
    4:[['eng',-6.6,0,3,2],['finance',-2.6,0.8,2,2],['sales',1.4,-0.4,4,3],['ops',5.2,0.6,2,2],['mktg',8.8,-0.2,3,2]],
  };

  function makeScene(spec){
    const scene=new THREE.Scene(); scene.environment=ENV;
    scene.add(new THREE.HemisphereLight(0xFFF1DC,0x8E7E60,0.5));
    const key=new THREE.DirectionalLight(0xFFE3BC,2.4); key.position.set(-6,10,7); scene.add(key);
    const rim=new THREE.DirectionalLight(0xFFD3A0,0.5); rim.position.set(7,5,-8); scene.add(rim);
    const content=new THREE.Group(); scene.add(content);
    let extra=null; const people=[];

    const parts=spec.split(':'), closeup=(parts[0]==='team');
    if(parts[0]==='team'){
      const t=TEAM.find(x=>x.key===parts[1]);
      workerVignette(content,t.color,people);   // just the PEOPLE — this section is about the workers, not a building
    } else if(parts[0]==='growth'){
      GROWTH_SPECS[+parts[1]].forEach(b=>buildingAt(content,b[1],b[2],COL[b[0]],b[3],b[4],people));
    } else if(parts[0]==='econ'){
      buildingAt(content,-4.6,0,COL.sales,2,2,people); buildingAt(content,0,0.6,COL.ops,3,3,people); buildingAt(content,4.6,-0.2,COL.finance,2,2,people);
      tree(content,-8,3,1); tree(content,8,2.6,0.9);
      extra=econFlow(scene, content);
    } else if(parts[0]==='glance'){
      const L=[['eng',-8,0,3],['sales',-3.6,0.7,4],['finance',0.6,-0.3,2],['ops',4.6,0.6,3],['mktg',8.4,-0.1,2]];
      L.forEach(b=>buildingAt(content,b[1],b[2],COL[b[0]],b[3],2,people));
      tree(content,-11,3,1); tree(content,11,2.2,0.95);
    }

    // ground tile + contact shadow, sized to content
    const bb=new THREE.Box3().setFromObject(content); const size=bb.getSize(new THREE.Vector3()); const ctr=bb.getCenter(new THREE.Vector3());
    const tileW=size.x+6, tileD=size.z+6;
    const tile=box(tileW,1.2,tileD,0.5,COL.grass,{rough:0.95}); tile.position.set(ctr.x,-0.6,0); scene.add(tile);
    const sh=contactShadow(tileW,tileD); sh.position.x=ctr.x; scene.add(sh);

    // frame camera to the content
    const cam=new THREE.PerspectiveCamera(closeup?28:30,1,0.1,120);
    const radius=Math.max(size.x,size.z)*0.5, h=size.y;
    if(closeup){ // team: head-on + low so every worker is fully in frame, filling it
      cam.position.set(ctr.x+0.12, 1.9, 6.0);
      cam.lookAt(ctr.x, 1.0, -0.1);
    } else {
      const dist=Math.max(radius*2.0, h*1.7)+5.5;
      cam.position.set(ctr.x+dist*0.62, h*0.5+dist*0.55, dist*0.82);
      cam.lookAt(ctr.x, h*0.42, 0);
    }
    return {scene,cam,content,extra,people,phase:Math.random()*6.28,closeup};
  }

  // econ: a coral task flows between the three buildings, then a coin
  function econFlow(scene,content){
    const tok=new THREE.Group();
    const gl=makeGlow('255,150,105',3.2); tok.add(gl);
    const card=box(0.7,0.9,0.13,0.07,0xF07A55,{emissive:COL.coral,ei:0.7,rough:0.4}); tok.add(card);
    content.add(tok);
    const coinG=new THREE.Group(); const cgl=makeGlow('255,205,80',3.0); coinG.add(cgl);
    const coin=new THREE.Mesh(new THREE.CylinderGeometry(0.5,0.5,0.13,24),mat(COL.gold,{metal:0.6,rough:0.26,emissive:0x6a4e12,ei:0.55})); coin.rotation.x=Math.PI/2; coinG.add(coin);
    coinG.position.set(4.6,0,-0.2); content.add(coinG);
    const curve=new THREE.CatmullRomCurve3([
      new THREE.Vector3(-7,2.2,3),new THREE.Vector3(-4.6,2.4,0.6),new THREE.Vector3(0,2.6,0.8),new THREE.Vector3(4.6,2.4,0.2),new THREE.Vector3(4.6,3.4,-0.2)]);
    return {tok,gl,card,coinG,cgl,coin,curve};
  }
  function makeGlow(rgb,scale){
    const c=document.createElement('canvas');c.width=c.height=128;const x=c.getContext('2d');
    const g=x.createRadialGradient(64,64,3,64,64,64);g.addColorStop(0,'rgba('+rgb+',0.9)');g.addColorStop(0.5,'rgba('+rgb+',0.3)');g.addColorStop(1,'rgba('+rgb+',0)');
    x.fillStyle=g;x.fillRect(0,0,128,128);
    const s=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(c),transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}));
    s.scale.setScalar(scale); return s;
  }

  const views=mounts.map(el=>({el, ...makeScene(el.dataset.scene3d)}));

  function resize(){ renderer.setSize(window.innerWidth, window.innerHeight, false); }
  window.addEventListener('resize',resize,{passive:true}); resize();

  const tmp=new THREE.Vector3(), clock=new THREE.Clock();
  function frame(){
    const t=clock.getElapsedTime(), H=renderer.domElement.clientHeight;
    renderer.setScissorTest(false); renderer.clear(true,true,true);
    renderer.setScissorTest(true);
    for(const v of views){
      const r=v.el.getBoundingClientRect();
      if(r.bottom<-40||r.top>H+40||r.width<2) continue;   // only render what's on screen
      const left=Math.floor(r.left), bottom=Math.floor(H-r.bottom), width=Math.ceil(r.width), height=Math.ceil(r.height);
      v.content.rotation.y = v.closeup ? Math.sin(t*0.16+v.phase)*0.08 : (Math.sin(t*0.16+v.phase)*0.26 + 0.35);   // team stays head-on; buildings keep a 3/4 turn
      // the people are alive: seated ones work (fast micro-nod), everyone breathes + glances around
      for(let i=0;i<v.people.length;i++){ const pr=v.people[i], ph=pr.phase;
        if(pr.seated){ pr.o.position.y = pr.y + Math.abs(Math.sin(t*4.5+ph))*0.02; pr.o.userData.inner.rotation.x = 0.16 + Math.sin(t*4.5+ph)*0.04; }
        else { pr.o.position.y = pr.y + Math.sin(t*1.8+ph)*0.03; pr.o.rotation.z = Math.sin(t*0.9+ph)*0.05; }
        pr.o.userData.head.rotation.y = Math.sin(t*0.6+ph*1.7)*0.5;
      }
      if(v.extra){ const e=v.extra, p=(t*0.12+v.phase)%1;
        e.curve.getPointAt(Math.min(1,p),tmp); e.tok.position.copy(tmp); e.tok.position.y+=Math.sin(t*3)*0.05; e.card.rotation.y=t*1.2;
        const show=p>0.82; e.coinG.visible=show; if(show){ e.coinG.position.y=2.6+(p-0.82)/0.18*2.2; e.coin.rotation.z=t*2; }
      }
      renderer.setViewport(left, bottom, width, height);
      renderer.setScissor(left, bottom, width, height);
      v.cam.aspect=width/height; v.cam.updateProjectionMatrix();
      renderer.render(v.scene, v.cam);
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
