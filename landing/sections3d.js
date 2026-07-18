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
  function citizen(color){
    const g=new THREE.Group();
    const pts=[[0,0],[0.36,0],[0.40,0.07],[0.26,0.13],[0.205,0.42],[0.225,0.6],[0.17,0.74],[0.055,0.8]].map(p=>new THREE.Vector2(p[0],p[1]));
    const b=new THREE.Mesh(new THREE.LatheGeometry(pts,16),mat(color,{rough:0.6})); b.scale.setScalar(1.02); g.add(b);
    const h=new THREE.Mesh(new THREE.SphereGeometry(0.19,16,12),mat(color,{rough:0.55})); h.position.y=0.83; g.add(h);
    return g;
  }
  function deskUnit(accent){
    const g=new THREE.Group();
    const top=box(0.9,0.44,0.58,0.07,0x8A6A46,{rough:0.85}); top.position.y=0.22; g.add(top);
    const s=box(0.54,0.38,0.06,0.03,COL.screen,{emissive:accent,ei:0.5,rough:0.4}); s.position.set(0,0.64,-0.1); g.add(s);
    return g;
  }
  function floorLevel(color,teamN){
    const g=new THREE.Group();
    const slab=box(FS,0.3,FS,0.1,COL.floor,{rough:0.85}); slab.position.y=0.15; g.add(slab);
    const fa=box(FS,0.16,0.09,0.03,color,{rough:0.55}); fa.position.set(0,0.3,FS/2-0.045); g.add(fa);
    const fb=box(0.09,0.16,FS,0.03,color,{rough:0.55}); fb.position.set(FS/2-0.045,0.3,0); g.add(fb);
    const wallH=FH-0.3;
    const wl=box(0.22,wallH,FS,0.07,color,{rough:0.68}); wl.position.set(-FS/2+0.11,0.3+wallH/2,0); g.add(wl);
    const wr=box(FS,wallH,0.22,0.07,darker(color,0.92),{rough:0.68}); wr.position.set(0,0.3+wallH/2,-FS/2+0.11); g.add(wr);
    const gw=FS-1.1, gy=0.3+wallH*0.54, gz=-FS/2+0.2;
    const glass=box(gw,0.78,0.05,0.02,COL.screen,{emissive:0xCFE6FF,ei:0.34,rough:0.18,metal:0.2,env:0.7}); glass.position.set(0.15,gy,gz); g.add(glass);
    const spots=[[-1.0,0.85],[0.85,0.15],[-0.1,-0.85]].slice(0,teamN);
    spots.forEach(s=>{ const d=deskUnit(color); d.position.set(s[0],0.3,s[1]-0.5); d.rotation.y=0.5; g.add(d);
      const c=citizen(color); c.position.set(s[0],0.3,s[1]); g.add(c); });
    return g;
  }
  function buildingAt(parent,x,z,color,floors,teamPer){
    const grp=new THREE.Group(); grp.position.set(x,0,z);
    for(let i=0;i<floors;i++){ const lv=floorLevel(color, typeof teamPer==='function'?teamPer(i):teamPer); lv.position.y=0.2+i*FH; grp.add(lv); }
    const roof=new THREE.Group();
    roof.add(box(FS+0.12,0.26,FS+0.12,0.09,darker(color,0.8),{rough:0.75}));
    const cap=box(FS-0.5,0.12,FS-0.5,0.05,lighter(color,1.04),{rough:0.6}); cap.position.y=0.19; roof.add(cap);
    const sky=box(1.3,0.12,0.9,0.04,COL.screen,{emissive:0xCFE6FF,ei:0.32,rough:0.18,metal:0.2,env:0.7}); sky.position.set(-0.7,0.25,0.5); roof.add(sky);
    const vent=box(0.55,0.42,0.55,0.07,0xCFC7B6,{rough:0.85}); vent.position.set(1.05,0.4,-0.7); roof.add(vent);
    roof.position.y=0.2+floors*FH+0.13; grp.add(roof);
    parent.add(grp); return grp;
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
    let extra=null;

    const parts=spec.split(':');
    if(parts[0]==='team'){
      const t=TEAM.find(x=>x.key===parts[1]);
      buildingAt(content,0,0,t.color,t.floors,i=>(i===0?3:2));
    } else if(parts[0]==='growth'){
      GROWTH_SPECS[+parts[1]].forEach(b=>buildingAt(content,b[1],b[2],COL[b[0]],b[3],b[4]));
    } else if(parts[0]==='econ'){
      buildingAt(content,-4.6,0,COL.sales,2,2); buildingAt(content,0,0.6,COL.ops,3,3); buildingAt(content,4.6,-0.2,COL.finance,2,2);
      tree(content,-8,3,1); tree(content,8,2.6,0.9);
      extra=econFlow(scene, content);
    } else if(parts[0]==='glance'){
      const L=[['eng',-8,0,3],['sales',-3.6,0.7,4],['finance',0.6,-0.3,2],['ops',4.6,0.6,3],['mktg',8.4,-0.1,2]];
      L.forEach(b=>buildingAt(content,b[1],b[2],COL[b[0]],b[3],2));
      tree(content,-11,3,1); tree(content,11,2.2,0.95);
    }

    // ground tile + contact shadow, sized to content
    const bb=new THREE.Box3().setFromObject(content); const size=bb.getSize(new THREE.Vector3()); const ctr=bb.getCenter(new THREE.Vector3());
    const tileW=size.x+6, tileD=size.z+6;
    const tile=box(tileW,1.2,tileD,0.5,COL.grass,{rough:0.95}); tile.position.set(ctr.x,-0.6,0); scene.add(tile);
    const sh=contactShadow(tileW,tileD); sh.position.x=ctr.x; scene.add(sh);

    // frame camera to the content
    const cam=new THREE.PerspectiveCamera(30,1,0.1,120);
    const radius=Math.max(size.x,size.z)*0.5, h=size.y;
    const dist=Math.max(radius*2.0, h*1.7)+5.5;
    cam.position.set(ctr.x+dist*0.62, h*0.5+dist*0.6, dist*0.82);
    cam.lookAt(ctr.x, h*0.42, 0);
    return {scene,cam,content,extra,phase:Math.random()*6.28};
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
      v.content.rotation.y = Math.sin(t*0.18+v.phase)*0.28 + 0.35;   // gentle unique idle sway
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
