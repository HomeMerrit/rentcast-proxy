// Living-world hero — a company that builds itself, in 3D.
// Buildings are made of stacked FLOORS: taller building = bigger team.
// The loop tells a growth story: rooms form, teams fill in, value flows,
// revenue lands, and departments LEVEL UP (a new floor rises into place).
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const CANVAS = document.getElementById('hero3d');
if (CANVAS) boot();

function boot(){
  const wrap = CANVAS.parentElement;
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion:reduce)').matches;

  const COL = {
    grass:0x9BC47F, soil:0xC7A278, soilDark:0xAD8A5F, floor:0xE7D3A6,
    sales:0x5A97D6, ops:0xE08A5B, finance:0xE6AE3C, eng:0x8B79D4, mktg:0xE06A9A, support:0x4FB0AA,
    trunk:0x9C7A50, leaf:0x8FBE79, leaf2:0x7FB06B, gold:0xF2C24B, paper:0xFFFFFF, screen:0xBFD8EE, coral:0xED7150,
  };
  const darker=(hex,f=0.88)=>new THREE.Color(hex).multiplyScalar(f).getHex();
  const lighter=(hex,f=1.1)=>new THREE.Color(hex).multiplyScalar(f).getHex();
  const easeOutBack=t=>{const c1=1.70158,c3=c1+1;return 1+c3*Math.pow(t-1,3)+c1*Math.pow(t-1,2);};
  const clamp01=v=>v<0?0:v>1?1:v;

  const renderer = new THREE.WebGLRenderer({ canvas:CANVAS, antialias:true, alpha:true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1, 2));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.95;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const camera = new THREE.PerspectiveCamera(31, 1, 0.1, 200);
  const camBase = new THREE.Vector3(17.5, 16, 21);
  const camTarget = new THREE.Vector3(0, 3.2, 0.6);
  camera.position.copy(camBase); camera.lookAt(camTarget);

  const key = new THREE.DirectionalLight(0xFFE3BC, 2.9);
  key.position.set(-9, 17, 11); key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048); key.shadow.radius = 5; key.shadow.bias = -0.0004; key.shadow.normalBias = 0.03;
  const sc = key.shadow.camera; sc.left=-26; sc.right=26; sc.top=28; sc.bottom=-20; sc.near=1; sc.far=80; scene.add(key);
  scene.add(new THREE.HemisphereLight(0xFFF1DC, 0x8E7E60, 0.32));
  const rim = new THREE.DirectionalLight(0xFFD3A0, 0.55); rim.position.set(9, 6, -11); scene.add(rim);

  const geoCache={};
  function rbox(w,h,d,r){const k=[w,h,d,r].join(',');return geoCache[k]||(geoCache[k]=new RoundedBoxGeometry(w,h,d,3,r));}
  function mat(color,o={}){return new THREE.MeshStandardMaterial({color,roughness:o.rough??0.78,metalness:o.metal??0,emissive:o.emissive??0x000000,emissiveIntensity:o.ei??1,transparent:!!o.transparent,opacity:o.opacity??1,envMapIntensity:o.env??0.42});}
  function box(w,h,d,r,color,o){const m=new THREE.Mesh(rbox(w,h,d,r),mat(color,o));m.castShadow=true;m.receiveShadow=true;return m;}
  const root=new THREE.Group(); scene.add(root);

  // ---- island ----
  (function(){
    const g=new THREE.Group();
    const grass=box(25,1.4,18,0.6,COL.grass,{rough:0.95}); grass.position.y=-0.7; grass.castShadow=false; g.add(grass);
    const soil=box(23,3.2,16,0.5,COL.soil,{rough:1}); soil.position.y=-3.0; g.add(soil);
    const soil2=box(20,2.6,13.5,0.5,COL.soilDark,{rough:1}); soil2.position.y=-5.4; g.add(soil2);
    root.add(g);
    const cnv=document.createElement('canvas'); cnv.width=cnv.height=256;
    const cx=cnv.getContext('2d'); const gr=cx.createRadialGradient(128,128,10,128,128,128);
    gr.addColorStop(0,'rgba(30,24,16,0.4)'); gr.addColorStop(1,'rgba(30,24,16,0)'); cx.fillStyle=gr; cx.fillRect(0,0,256,256);
    const p=new THREE.Mesh(new THREE.PlaneGeometry(46,38), new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(cnv),transparent:true,depthWrite:false}));
    p.rotation.x=-Math.PI/2; p.position.y=-7.0; root.add(p);
  })();

  function glowSprite(rgb,scale){
    const cnv=document.createElement('canvas'); cnv.width=cnv.height=128;
    const cx=cnv.getContext('2d'); const g=cx.createRadialGradient(64,64,3,64,64,64);
    g.addColorStop(0,'rgba('+rgb+',0.95)'); g.addColorStop(0.5,'rgba('+rgb+',0.35)'); g.addColorStop(1,'rgba('+rgb+',0)');
    cx.fillStyle=g; cx.fillRect(0,0,128,128);
    const s=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(cnv),transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}));
    s.scale.setScalar(scale); return s;
  }
  // a person — standing or seated at a desk; head kept for idle head-turns
  function person(color, seated){
    const g=new THREE.Group();
    const pts=[[0,0],[0.36,0],[0.40,0.07],[0.26,0.13],[0.205,0.42],[0.225,0.60],[0.17,0.74],[0.055,0.80]].map(p=>new THREE.Vector2(p[0],p[1]));
    const body=new THREE.Mesh(new THREE.LatheGeometry(pts,18),mat(color,{rough:0.6})); body.castShadow=true; g.add(body);
    const head=new THREE.Mesh(new THREE.SphereGeometry(0.19,18,14),mat(color,{rough:0.55})); head.castShadow=true; head.position.y=0.83; g.add(head);
    const inner=g; const wrap=new THREE.Group(); wrap.add(inner);
    if(seated){ inner.scale.set(1.0,0.66,1.0); inner.rotation.x=0.16; }   // lower + lean toward the desk
    wrap.userData.head=head; wrap.userData.inner=inner;
    return wrap;
  }
  function desk(accent){
    const g=new THREE.Group();
    const top=box(0.92,0.46,0.6,0.07,0x8A6A46,{rough:0.85}); top.position.y=0.23; g.add(top);
    const scr=box(0.56,0.4,0.06,0.03,COL.screen,{emissive:accent,ei:0.5,rough:0.4}); scr.position.set(0,0.66,-0.1); g.add(scr);
    return g;
  }

  // ---- one FLOOR of a building: a clean, modern cutaway level with a small team ----
  const FH=2.35, FS=5.0;
  function floorLevel(color, teamN){
    const g=new THREE.Group();
    const slab=box(FS,0.3,FS,0.1,0xF4EAD6,{rough:0.85}); slab.position.y=0.15; g.add(slab);
    const band=box(FS+0.06,0.16,FS+0.06,0.04,color,{rough:0.5}); band.position.y=0.3; g.add(band);   // dept floor-line (count the floors)
    // glass curtain walls around this floor — floor-to-ceiling, see-through, dept-tinted
    const wallH=FH-0.1;
    const gmat=new THREE.MeshStandardMaterial({color, transparent:true, opacity:0.16, roughness:0.1, metalness:0.0, envMapIntensity:1.2, depthWrite:false, side:THREE.DoubleSide});
    gmat.userData.baseOpacity=0.16;
    const wallGeo=new THREE.PlaneGeometry(FS,wallH);
    [[0,FS/2,0],[0,-FS/2,Math.PI],[-FS/2,0,-Math.PI/2],[FS/2,0,Math.PI/2]].forEach(w=>{
      const m=new THREE.Mesh(wallGeo,gmat); m.position.set(w[0],0.3+wallH/2,w[1]); m.rotation.y=w[2]; m.renderOrder=20; g.add(m);
    });
    // corner columns (structure)
    const colGeo=rbox(0.14,wallH,0.14,0.05), colMat=mat(darker(color,0.9),{rough:0.55});
    [[-FS/2,-FS/2],[FS/2,-FS/2],[FS/2,FS/2],[-FS/2,FS/2]].forEach(c=>{ const m=new THREE.Mesh(colGeo,colMat); m.castShadow=true; m.receiveShadow=true; m.position.set(c[0],0.3+wallH/2,c[1]); g.add(m); });
    const spots=[[-1.05,0.75,true],[0.95,0.05,false],[-0.05,-0.9,true]].slice(0,teamN);
    const people=[];
    spots.forEach(s=>{
      const seated=s[2];
      const dk=desk(color); dk.position.set(s[0],0.3,s[1]-0.6); dk.rotation.y=0.35; g.add(dk);
      const c=person(color,seated); c.position.set(s[0],0.3,s[1]); g.add(c);
      people.push({o:c, y:0.3, phase:Math.random()*6.28, seated});
    });
    g.userData.people=people;
    return g;
  }
  function setOpacity(group,op){
    group.traverse(o=>{ if(o.isMesh && o.material){
      const base=o.material.userData.baseOpacity ?? 1;
      o.material.opacity=base*op;
      o.material.transparent = base<1 || op<1;
    }});
  }

  // ---- a building: stack of floors that appear/level-up over time ----
  const buildings=[];
  function building(x,z,color,schedule){ // schedule: [{at, team}] bottom-first
    const grp=new THREE.Group(); grp.position.set(x,0,z); root.add(grp);
    const floors=schedule.map((fd,i)=>{
      const lvl=floorLevel(color,fd.team);
      lvl.userData.finalY=0.2+i*FH; lvl.userData.at=fd.at; lvl.visible=false; grp.add(lvl); return lvl;
    });
    // modern FLAT roof: thin slab + parapet cap + a small rooftop detail (skylight)
    const roof=new THREE.Group();
    const rslab=box(FS+0.12,0.26,FS+0.12,0.09,darker(color,0.8),{rough:0.75}); roof.add(rslab);
    const rcap=box(FS-0.5,0.12,FS-0.5,0.05,lighter(color,1.04),{rough:0.6}); rcap.position.y=0.19; roof.add(rcap);
    const sky=box(1.3,0.12,0.9,0.04,COL.screen,{emissive:0xCFE6FF,ei:0.32,rough:0.18,metal:0.2,env:0.7}); sky.position.set(-0.7,0.25,0.5); roof.add(sky);
    const vent=box(0.55,0.42,0.55,0.07,0xCFC7B6,{rough:0.85}); vent.position.set(1.05,0.4,-0.7); roof.add(vent);
    roof.visible=false; grp.add(roof);
    const b={grp,floors,roof,x,z,color}; buildings.push(b); return b;
  }

  // ---- a few clean trees for warmth (kept minimal) ----
  function tree(x,z,s=1){
    const g=new THREE.Group(); g.position.set(x,0.2,z); g.scale.setScalar(s);
    const t=new THREE.Mesh(new THREE.CylinderGeometry(0.16,0.2,1,8),mat(COL.trunk,{rough:1})); t.position.y=0.5; t.castShadow=true; g.add(t);
    const f=new THREE.Mesh(new THREE.IcosahedronGeometry(0.95,1),mat(COL.leaf,{rough:0.9})); f.position.y=1.5; f.castShadow=true; g.add(f);
    const f2=new THREE.Mesh(new THREE.IcosahedronGeometry(0.6,1),mat(COL.leaf2,{rough:0.9})); f2.position.set(0.5,1.1,0.2); f2.castShadow=true; g.add(f2);
    root.add(g);
  }
  tree(-11.5,5.5,1.05); tree(11.5,4.5,1.0); tree(-8,8.5,0.85); tree(8.5,8,0.95);

  // ---- the growth timeline (seconds within the loop) ----
  const LOOP=21.0;
  // Sales grows tallest (biggest dept); Ops & Finance follow.
  const sales  = building(-7.5,0, COL.sales,   [{at:0.6,team:3},{at:7.0,team:3},{at:15.0,team:2}]);
  const ops    = building( 0.0,0.5,COL.ops,    [{at:4.5,team:2},{at:12.0,team:3}]);
  const finance= building( 7.5,0, COL.finance, [{at:9.5,team:2},{at:17.5,team:2}]);

  // revenue coins pop when a floor levels up (value → growth)
  const coinDefs=[{at:6.6,x:-7.5,z:0},{at:11.6,x:0,z:0.5},{at:14.6,x:-7.5,z:0},{at:17.1,x:7.5,z:0}];
  const coins=coinDefs.map(cd=>{
    const g=new THREE.Group(); g.position.set(cd.x,0,cd.z); root.add(g);
    const gl=glowSprite('255,205,80',3.4); g.add(gl);
    const c=new THREE.Mesh(new THREE.CylinderGeometry(0.6,0.6,0.14,28),mat(COL.gold,{metal:0.6,rough:0.26,emissive:0x6a4e12,ei:0.55}));
    c.rotation.x=Math.PI/2; c.castShadow=true; g.add(c); g.visible=false;
    return {g,gl,c,at:cd.at};
  });

  // task token — the coral "work" that flows between the teams once they exist
  const token=new THREE.Group();
  const tGlow=glowSprite('255,150,105',5.0); token.add(tGlow);
  const doc=box(0.86,1.06,0.15,0.08,0xF07A55,{emissive:COL.coral,ei:0.7,rough:0.4}); token.add(doc);
  const lineMat=mat(0xFFF3E0,{rough:0.6,emissive:0xFFF3E0,ei:0.2});
  for(let i=0;i<3;i++){const ln=new THREE.Mesh(rbox(0.45-i*0.06,0.08,0.02,0.02),lineMat); ln.position.set(-0.06,0.22-i*0.24,0.09); doc.add(ln);}
  root.add(token);
  const tokenStart=9.8, tokenDur=6.4;
  const curve=new THREE.CatmullRomCurve3([
    new THREE.Vector3(-11,2.4,4.2),
    new THREE.Vector3(-7.5,1.9,1.3), new THREE.Vector3(-6.4,2.1,-0.3),
    new THREE.Vector3(-1.0,1.95,1.3), new THREE.Vector3(0.8,2.15,-0.3),
    new THREE.Vector3(6.4,1.95,1.3),  new THREE.Vector3(7.8,2.2,-0.3),
    new THREE.Vector3(7.5,3.0,0.3),
  ]);

  // ---- resize / pointer ----
  function resize(){ const w=wrap.clientWidth, h=Math.round(w*0.64); CANVAS.style.height=h+'px'; renderer.setSize(w,h,false); camera.aspect=w/h; camera.updateProjectionMatrix(); }
  window.addEventListener('resize',resize); resize();
  const ptr={x:0,y:0}, ptrT={x:0,y:0};
  window.addEventListener('pointermove',e=>{ const r=CANVAS.getBoundingClientRect(); ptrT.x=((e.clientX-r.left)/r.width-0.5); ptrT.y=((e.clientY-r.top)/r.height-0.5); });

  const easeOutCubic=t=>1-Math.pow(1-t,3);
  const APPEAR=1.15, DROP=3.4, tmp=new THREE.Vector3();
  function updateBuildings(lt){
    buildings.forEach(B=>{
      let top=-1;
      B.floors.forEach(lvl=>{
        const at=lvl.userData.at;
        if(lt>=at){
          lvl.visible=true; top++;
          const p=clamp01((lt-at)/APPEAR), e=easeOutBack(p), ec=easeOutCubic(p);
          lvl.position.y = lvl.userData.finalY + (1-e)*DROP;   // drops in from above and overshoots into place
          lvl.rotation.y = (1-ec)*0.7;                          // a quick settle turn as it lands
          const s=0.9+0.1*e; lvl.scale.set(s,1,s);              // scale-in
          setOpacity(lvl, clamp01((lt-at)/(APPEAR*0.4)));
          lvl.userData.people.forEach((pr,k)=>{ const pp=clamp01((lt-at-0.55-k*0.14)/0.5); pr.o.visible=pp>0; pr.o.scale.setScalar(easeOutBack(pp)); }); // team pops in after the floor lands
        } else lvl.visible=false;
      });
      // roof: a full 360° spin as it slots into place on every level-up
      if(top>=0){
        const ty=B.floors[top].userData.finalY+FH+0.13;
        if(B._top!==top){ B._top=top; B.roof.userData.spinAt=lt; }   // re-trigger the flourish whenever a floor is added
        B.roof.visible=true;
        const st=B.roof.userData.spinAt, sp=(st==null)?1:clamp01((lt-st)/0.95), es=easeOutCubic(sp);
        B.roof.rotation.y = es*Math.PI*2;                            // one clean rotation, settling square
        B.roof.position.y = ty + (1-es)*2.4;                         // descends while it spins
      } else { B.roof.visible=false; B._top=-1; }
    });
  }

  if(reduce){
    updateBuildings(LOOP*0.999); token.visible=false; coins.forEach(c=>c.g.visible=false);
    renderer.render(scene,camera); pmrem.dispose(); return;
  }

  const clock=new THREE.Clock();
  function frame(){
    const el=clock.getElapsedTime();
    const lt=el%LOOP;
    ptr.x+=(ptrT.x-ptr.x)*0.04; ptr.y+=(ptrT.y-ptr.y)*0.04;
    const dz=Math.sin(el*0.16)*0.4, dx=Math.cos(el*0.13)*0.5;
    camera.position.set(camBase.x+dx+ptr.x*2.4, camBase.y+ptr.y*-1.2+Math.sin(el*0.2)*0.25, camBase.z+dz+ptr.x*1.1);
    camera.lookAt(camTarget);

    updateBuildings(lt);

    // the people are alive — seated ones work (fast micro-nod), everyone breathes + glances around
    buildings.forEach(B=>B.floors.forEach(lvl=>{ if(!lvl.visible) return; lvl.userData.people.forEach(pr=>{ if(!pr.o.visible) return; const ph=pr.phase;
      if(pr.seated){ pr.o.position.y=pr.y+Math.abs(Math.sin(el*4.5+ph))*0.02; pr.o.userData.inner.rotation.x=0.16+Math.sin(el*4.5+ph)*0.04; }
      else { pr.o.position.y=pr.y+Math.sin(el*1.8+ph)*0.03; pr.o.rotation.z=Math.sin(el*0.9+ph)*0.05; }
      pr.o.userData.head.rotation.y=Math.sin(el*0.6+ph*1.7)*0.5;
    }); }));

    // task token
    if(lt>=tokenStart && lt<=tokenStart+tokenDur){
      const p=(lt-tokenStart)/tokenDur; curve.getPointAt(clamp01(p),tmp); token.position.copy(tmp);
      token.position.y+=Math.sin(el*3)*0.05; doc.rotation.y=el*1.3;
      const f=Math.min(1,(lt-tokenStart)/0.4)*Math.min(1,(tokenStart+tokenDur-lt)/0.4);
      token.visible=true; tGlow.material.opacity=0.95*f;
    } else token.visible=false;

    // level-up revenue coins
    coins.forEach(cn=>{
      if(lt>=cn.at && lt<=cn.at+2.2){
        const q=(lt-cn.at)/2.2; cn.g.visible=true;
        cn.g.position.y=2.4+q*3.0; cn.c.rotation.z=el*2.6;
        const cf=Math.min(1,q/0.14)*Math.min(1,(1-q)/0.28);
        cn.c.material.opacity=cf; cn.c.material.transparent=true; cn.gl.material.opacity=cf;
      } else cn.g.visible=false;
    });

    renderer.render(scene,camera);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
