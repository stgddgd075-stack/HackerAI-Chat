import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

const IS_MOBILE = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || innerWidth < 768;
const MAXP = { low: 3500, medium: 8000, high: 15000, ultra: 24000 };

const S = {
  cam: false, hands: 0, gesture: 'none', formation: 0, quality: 'auto', colorMode: 'neon',
  sens: 1, skeleton: false, attractOn: true, count: IS_MOBILE ? 6000 : 11000, fps: 0, lang: 'fa',
  morph: 1, energy: 0.5, expand: 1, rotY: 0, rotX: 0, vert: 0, attract: 0, shock: 0,
  hue: 0.35, zoom: 1, centerX: 0, centerY: 0, centerZ: 0,
  lastCx: null, lastCy: null, lastT: 0, prevTwoDist: 0, prevPinch: null,
  modelOk: false, mode: 'FREE', pointX: 0, pointY: 0, grabActive: false
};

const $ = id => document.getElementById(id);
const canvas = $('three-canvas'), video = $('webcam'), lCanvas = $('landmark-canvas');
const lCtx = lCanvas.getContext('2d');
const camPrev = $('camera-preview'), overlay = $('overlay');
const gDisp = $('gesture-display'), modeBadge = $('mode-badge');

const i18n = {
fa:{start:'شروع دوربین',stop:'توقف',reset:'بازنشانی',fullscreen:'تمام‌صفحه',lang:'English',camera:'دوربین',hands:'دست',
loading:'آماده‌سازی موتور و مدل AI...',ready:'روی دکمه بزنید تا اجازه دوربین گرفته شود.',
camDenied:'اجازه دوربین رد شد. از تنظیمات مرورگر فعال کنید.',camError:'خطای دوربین.',
unsupported:'مرورگر پشتیبانی نمی‌کند.',modelError:'مدل لود نشد.',tracking:'ردیابی',noHand:'بدون دست',
perm:'اجازه دسترسی به دوربین',dismiss:'بدون دوربین',req:'در حال درخواست...',
g:{none:'—',open:'کف دست باز',fist:'مشت',pinch:'نیشگون / زوم',twoFinger:'دو انگشت',point:'اشاره',
thumbsUp:'شست بالا',thumbsDown:'شست پایین',three:'سه انگشت',moveL:'چپ',moveR:'راست',moveU:'بالا',moveD:'پایین',
shock:'شوک‌ویو',expand:'گسترش دو دست',compress:'فشرده دو دست',grab:'گرفتن',wave:'موج'}},
en:{start:'Start Camera',stop:'Stop',reset:'Reset',fullscreen:'Fullscreen',lang:'فارسی',camera:'Camera',hands:'Hands',
loading:'Loading engine & AI model...',ready:'Tap button for camera permission.',
camDenied:'Camera denied. Enable in browser settings.',camError:'Camera error.',
unsupported:'Browser not supported.',modelError:'Model load failed.',tracking:'Tracking',noHand:'No hand',
perm:'Allow Camera',dismiss:'Skip camera',req:'Requesting...',
g:{none:'—',open:'OPEN PALM',fist:'FIST',pinch:'PINCH ZOOM',twoFinger:'TWO FINGER',point:'POINT',
thumbsUp:'THUMBS UP',thumbsDown:'THUMBS DOWN',three:'THREE FINGER',moveL:'LEFT',moveR:'RIGHT',moveU:'UP',moveD:'DOWN',
shock:'SHOCKWAVE',expand:'EXPAND',compress:'COMPRESS',grab:'GRAB',wave:'WAVE'}}
};
const t = k => i18n[S.lang][k] || i18n.fa[k] || k;
const tg = k => (i18n[S.lang].g || i18n.fa.g)[k] || k;

function updUI() {
  $('btn-start').textContent=t('start');$('btn-stop').textContent=t('stop');$('btn-reset').textContent=t('reset');
  $('btn-fullscreen').textContent=t('fullscreen');$('btn-lang').textContent=t('lang');
  $('cam-label').textContent=t('camera');$('hand-label').textContent=t('hands');
  $('btn-overlay-start').textContent=t('perm');$('btn-overlay-dismiss').textContent=t('dismiss');
  document.body.classList.toggle('ltr',S.lang==='en');
  document.documentElement.dir=S.lang==='en'?'ltr':'rtl';
}

let renderer, scene, camera, composer, bloom;
let pSys, pos, col, tgt, geo, mat;
let clock = new THREE.Clock(), frames=0, lastFps=performance.now(), autoT=0;

function init3() {
  renderer = new THREE.WebGLRenderer({canvas,antialias:!IS_MOBILE,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio, IS_MOBILE?1.5:2));
  renderer.setSize(innerWidth,innerHeight); renderer.setClearColor(0); renderer.outputColorSpace=THREE.SRGBColorSpace;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(60,innerWidth/innerHeight,0.1,200);
  camera.position.set(0,0,28);
  const sg=new THREE.BufferGeometry(), sc=IS_MOBILE?300:700, sp=new Float32Array(sc*3);
  for(let i=0;i<sc;i++){sp[i*3]=(Math.random()-.5)*180;sp[i*3+1]=(Math.random()-.5)*180;sp[i*3+2]=(Math.random()-.5)*180-40}
  sg.setAttribute('position',new THREE.BufferAttribute(sp,3));
  scene.add(new THREE.Points(sg,new THREE.PointsMaterial({color:0x88aacc,size:0.07,transparent:true,opacity:0.45,depthWrite:false})));
  mkParticles(S.count);
  const rp=new RenderPass(scene,camera);
  bloom=new UnrealBloomPass(new THREE.Vector2(innerWidth,innerHeight),0.9,0.4,0.18);
  composer=new EffectComposer(renderer); composer.addPass(rp); composer.addPass(bloom);
  addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);composer.setSize(innerWidth,innerHeight);bloom.resolution.set(innerWidth,innerHeight)});
}

function mkParticles(n){
  if(pSys){scene.remove(pSys);geo.dispose();mat.dispose()}
  S.count=n; pos=new Float32Array(n*3); col=new Float32Array(n*3); tgt=new Float32Array(n*3);
  for(let i=0;i<n;i++){
    const i3=i*3,r=8+Math.random()*6,th=Math.random()*Math.PI*2,ph=Math.acos(2*Math.random()-1);
    pos[i3]=r*Math.sin(ph)*Math.cos(th);pos[i3+1]=r*Math.sin(ph)*Math.sin(th);pos[i3+2]=r*Math.cos(ph);
    tgt[i3]=pos[i3];tgt[i3+1]=pos[i3+1];tgt[i3+2]=pos[i3+2]; setCol(i,0.3+Math.random()*0.4);
  }
  geo=new THREE.BufferGeometry(); geo.setAttribute('position',new THREE.BufferAttribute(pos,3)); geo.setAttribute('color',new THREE.BufferAttribute(col,3));
  mat=new THREE.PointsMaterial({size:IS_MOBILE?0.14:0.1,vertexColors:true,transparent:true,opacity:0.92,blending:THREE.AdditiveBlending,depthWrite:false,sizeAttenuation:true});
  pSys=new THREE.Points(geo,mat); scene.add(pSys); genForm(S.formation); $('part-val').textContent=n.toLocaleString();
}

function setCol(i,tv){
  const i3=i*3; let h,s=0.92,l=0.55;
  switch(S.colorMode){
    case'cyan':h=0.48+tv*.08;break; case'magenta':h=0.85+tv*.08;break; case'gold':h=0.12+tv*.06;break;
    case'rainbow':h=(tv+S.hue)%1;break; case'fire':h=0.02+tv*.08;s=1;l=0.5;break; default:h=0.32+tv*.18;
  }
  const c=new THREE.Color().setHSL(h,s,l); col[i3]=c.r;col[i3+1]=c.g;col[i3+2]=c.b;
}

function genForm(id){
  const n=S.count;
  for(let i=0;i<n;i++){
    const i3=i*3,tt=i/n; let x=0,y=0,z=0;
    switch(id){
      case 0:{const r=6+Math.random()*5,th=Math.random()*Math.PI*2,ph=Math.acos(2*Math.random()-1);x=r*Math.sin(ph)*Math.cos(th);y=r*Math.sin(ph)*Math.sin(th)*.85;z=r*Math.cos(ph);break}
      case 1:{const a=tt*Math.PI*12,r=2+tt*9;x=Math.cos(a)*r;y=(tt-.5)*16;z=Math.sin(a)*r;break}
      case 2:{const r=3+Math.pow(Math.random(),.55)*12,th=Math.random()*Math.PI*2,ph=Math.acos(2*Math.random()-1);x=r*Math.sin(ph)*Math.cos(th);y=r*Math.sin(ph)*Math.sin(th);z=r*Math.cos(ph);break}
      case 3:{const arm=i%3,a=tt*Math.PI*8+arm*(Math.PI*2/3),r=1.5+tt*11;x=Math.cos(a)*r;y=(Math.random()-.5)*1.8;z=Math.sin(a)*r;break}
      case 4:{const cols=Math.ceil(Math.sqrt(n)),row=Math.floor(i/cols),col=i%cols;x=(col/cols-.5)*22;z=(row/cols-.5)*22;y=Math.sin(x*.4+z*.3)*3.5;break}
      case 5:{const st=i%2,a=tt*Math.PI*10;x=Math.cos(a+st*Math.PI)*3.2;y=(tt-.5)*18;z=Math.sin(a+st*Math.PI)*3.2;if(i%7===0){x*=.3;z*=.3}break}
      case 6:{const a=tt*Math.PI*2,r=8+Math.sin(tt*Math.PI*6)*1.5;x=Math.cos(a)*r;y=Math.sin(tt*Math.PI*4)*1.5;z=Math.sin(a)*r;break}
      case 7:{const cl=Math.floor(Math.random()*8),cx=Math.cos(cl/8*Math.PI*2)*8,cy=Math.sin(cl/8*Math.PI*2)*5,cz=(cl%3-1)*4;
        if(Math.random()<.7){x=cx+(Math.random()-.5)*3.5;y=cy+(Math.random()-.5)*3.5;z=cz+(Math.random()-.5)*3.5}
        else{const c2=(cl+1)%8,tl=Math.random();x=cx+(Math.cos(c2/8*Math.PI*2)*8-cx)*tl;y=cy+(Math.sin(c2/8*Math.PI*2)*5-cy)*tl;z=cz+((c2%3-1)*4-cz)*tl}break}
      case 8:{const r=9+Math.random()*2.2,th=Math.random()*Math.PI*2,ph=Math.acos(2*Math.random()-1);x=r*Math.sin(ph)*Math.cos(th);y=r*Math.sin(ph)*Math.sin(th);z=r*Math.cos(ph);break}
      case 10:{const a=tt*Math.PI*16,r=1+tt*10;x=Math.cos(a)*r;y=(tt-.5)*20;z=Math.sin(a)*r;break}
      case 11:{const pet=i%6,a=tt*Math.PI*2+pet*(Math.PI/3),r=2+Math.sin(tt*Math.PI*4)*6;x=Math.cos(a)*r;y=Math.sin(tt*Math.PI)*2;z=Math.sin(a)*r;break}
      default:x=(Math.random()-.5)*18;y=(Math.random()-.5)*14;z=(Math.random()-.5)*18;
    }
    tgt[i3]=x;tgt[i3+1]=y;tgt[i3+2]=z;
  }
  S.morph=0;
}

function updateP(dt){
  const n=S.count,ex=S.expand*S.zoom,en=S.energy,at=S.attract,sh=S.shock;
  const cY=Math.cos(S.rotY),sY=Math.sin(S.rotY),cX=Math.cos(S.rotX),sX=Math.sin(S.rotX);
  if(S.morph<1)S.morph=Math.min(1,S.morph+dt*.55);
  const m=S.morph,tm=clock.elapsedTime;
  for(let i=0;i<n;i++){
    const i3=i*3;
    let tx=tgt[i3]*ex+S.centerX, ty=tgt[i3+1]*ex+S.vert+S.centerY, tz=tgt[i3+2]*ex+S.centerZ;
    let rx=tx*cY-tz*sY, rz=tx*sY+tz*cY, ry=ty*cX-rz*sX; rz=ty*sX+rz*cX; tx=rx;ty=ry;tz=rz;
    if(at>0.01 && S.attractOn){
      const px=S.pointX*12, py=-S.pointY*10;
      tx+=(px-tx)*at*.15; ty+=(py-ty)*at*.15; tz+=(0-tz)*at*.08;
    }
    if(sh>0.01){const len=Math.sqrt(tx*tx+ty*ty+tz*tz)+.001,push=sh*5/(1+len*.08);tx+=(tx/len)*push;ty+=(ty/len)*push;tz+=(tz/len)*push}
    tx+=Math.sin(i*.17+tm*1.3)*en*.14; ty+=Math.cos(i*.13+tm*1.1)*en*.1; tz+=Math.sin(i*.21+tm*.9)*en*.12;
    const lp=.06+m*.12; pos[i3]+=(tx-pos[i3])*lp; pos[i3+1]+=(ty-pos[i3+1])*lp; pos[i3+2]+=(tz-pos[i3+2])*lp;
    if(i%17===0||S.colorMode==='rainbow'||S.colorMode==='fire')setCol(i,.3+.4*Math.sin(tm*2+i*.01));
  }
  geo.attributes.position.needsUpdate=true; geo.attributes.color.needsUpdate=true;
  S.shock*=.91; S.attract*=.94;
  if(S.energy>.5)S.energy+=(.5-S.energy)*.02;
  if(Math.abs(S.expand-1)>.01)S.expand+=(1-S.expand)*.015;
}

let handLM=null, lastVT=-1;

async function initMP(){
  try{
    const v=await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/+esm');
    const {HandLandmarker,FilesetResolver}=v;
    const fs=await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm');
    handLM=await HandLandmarker.createFromOptions(fs,{
      baseOptions:{modelAssetPath:'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',delegate:'GPU'},
      runningMode:'VIDEO',numHands:2,minHandDetectionConfidence:.5,minHandPresenceConfidence:.5,minTrackingConfidence:.5
    });
    S.modelOk=true; return true;
  }catch(e){console.error(e);S.modelOk=false;return false}
}

async function reqCam(){
  if(!navigator.mediaDevices?.getUserMedia){showErr(t('unsupported'));return false}
  try{
    if(video.srcObject){video.srcObject.getTracks().forEach(t=>t.stop());video.srcObject=null}
    const stream=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:'user'},width:{ideal:640,max:1280},height:{ideal:480,max:720}}});
    video.srcObject=stream; video.setAttribute('playsinline','true'); video.muted=true;
    await new Promise((res,rej)=>{const to=setTimeout(()=>rej(new Error('to')),8000);video.onloadedmetadata=()=>{clearTimeout(to);video.play().then(res).catch(rej)};video.onerror=()=>{clearTimeout(to);rej(new Error('ve'))}});
    lCanvas.width=video.videoWidth||640; lCanvas.height=video.videoHeight||480;
    S.cam=true; camPrev.classList.add('active'); $('cam-dot').className='dot on';
    $('btn-start').disabled=true; $('btn-stop').disabled=false; overlay.classList.add('hidden');
    if(S.modelOk&&handLM)detectLoop(); return true;
  }catch(err){
    let msg=t('camError');
    if(err.name==='NotAllowedError'||err.name==='PermissionDeniedError')msg=t('camDenied');
    showErr(msg,true); $('cam-dot').className='dot off'; S.cam=false; return false;
  }
}

function stopCam(){
  if(video.srcObject){video.srcObject.getTracks().forEach(t=>t.stop());video.srcObject=null}
  S.cam=false;S.hands=0;camPrev.classList.remove('active');$('cam-dot').className='dot';$('hand-dot').className='dot';
  $('btn-start').disabled=false;$('btn-stop').disabled=true;lCtx.clearRect(0,0,lCanvas.width,lCanvas.height);gDisp.classList.remove('visible');
}

function detectLoop(){
  if(!S.cam||!handLM)return;
  const now=performance.now();
  if(video.readyState>=2&&video.currentTime!==lastVT){
    lastVT=video.currentTime;
    try{processHands(handLM.detectForVideo(video,now))}catch(e){}
  }
  requestAnimationFrame(detectLoop);
}

function dist(a,b){const dx=a.x-b.x,dy=a.y-b.y,dz=(a.z||0)-(b.z||0);return Math.sqrt(dx*dx+dy*dy+dz*dz)}
function fingerUp(lm,tip,pip){return lm[tip].y < lm[pip].y - 0.02}

function processHands(res){
  const hands=res.landmarks||[];
  S.hands=hands.length; $('hands-val').textContent=S.hands;
  if(!hands.length){
    $('hand-dot').className='dot';$('hand-label').textContent=t('noHand');
    if(S.gesture!=='none'){S.gesture='none';updG()}
    lCtx.clearRect(0,0,lCanvas.width,lCanvas.height); return;
  }
  $('hand-dot').className='dot on';$('hand-label').textContent=t('tracking');
  if(S.skeleton)drawLM(hands); else lCtx.clearRect(0,0,lCanvas.width,lCanvas.height);

  const sens=S.sens, lm=hands[0];
  const wrist=lm[0], thumb=lm[4], index=lm[8], middle=lm[12], ring=lm[16], pinky=lm[20];
  const indexPip=lm[6], middlePip=lm[10], ringPip=lm[14], pinkyPip=lm[18], thumbIp=lm[3];

  const pinchD=dist(thumb,index);
  const openSc=(dist(index,wrist)+dist(middle,wrist)+dist(pinky,wrist))/3;
  const cx=(wrist.x+index.x+pinky.x)/3, cy=(wrist.y+index.y+pinky.y)/3;

  const idxUp=fingerUp(lm,8,6), midUp=fingerUp(lm,12,10), rngUp=fingerUp(lm,16,14), pnkUp=fingerUp(lm,20,18);
  const thmUp=thumb.y < thumbIp.y - 0.03;
  const fingersUp=[idxUp,midUp,rngUp,pnkUp].filter(Boolean).length;

  const now=performance.now(); let vel=0;
  if(S.lastCx!==null){const dx=cx-S.lastCx,dy=cy-S.lastCy,dt=Math.max(.016,(now-S.lastT)/1000);vel=Math.sqrt(dx*dx+dy*dy)/dt}
  S.lastCx=cx;S.lastCy=cy;S.lastT=now;

  S.pointX = (0.5 - cx) * 2;
  S.pointY = (cy - 0.5) * 2;

  let twoG=null, twoDist=0;
  if(hands.length>=2){
    const h2=hands[1];
    const c2x=(h2[0].x+h2[8].x+h2[20].x)/3, c2y=(h2[0].y+h2[8].y+h2[20].y)/3;
    twoDist=Math.sqrt((cx-c2x)**2+(cy-c2y)**2);
    if(S.prevTwoDist>0){
      const dlt=twoDist-S.prevTwoDist;
      if(dlt>0.035*sens)twoG='expand';
      else if(dlt<-0.035*sens)twoG='compress';
      S.zoom = Math.max(0.3, Math.min(3.5, S.zoom + dlt * 2.5 * sens));
      $('zoom-val').textContent=S.zoom.toFixed(2);
    }
    S.prevTwoDist=twoDist;
  } else S.prevTwoDist=0;

  if(pinchD < 0.12){
    if(S.prevPinch!==null){
      const pd=S.prevPinch-pinchD;
      S.zoom=Math.max(0.25,Math.min(4,S.zoom+pd*8*sens));
      $('zoom-val').textContent=S.zoom.toFixed(2);
      S.attract=Math.min(1, 0.2+(0.08-pinchD)*10);
    }
    S.prevPinch=pinchD;
  } else S.prevPinch=null;

  let g='none';
  if(twoG) g=twoG;
  else if(vel>2.0*sens) g='shock';
  else if(pinchD<0.05*(2-sens*.3)) g='pinch';
  else if(fingersUp===1 && idxUp && !midUp) g='point';
  else if(fingersUp===2 && idxUp && midUp && !rngUp) g='twoFinger';
  else if(fingersUp===3 && idxUp && midUp && rngUp) g='three';
  else if(thmUp && !idxUp && !midUp && fingersUp===0) g='thumbsUp';
  else if(!thmUp && thumb.y > wrist.y && fingersUp===0 && openSc<0.2) g='thumbsDown';
  else if(openSc>0.26*sens && fingersUp>=4) g='open';
  else if(openSc<0.16/sens && fingersUp<=1) g='fist';
  else if(Math.abs(cx-0.5)>0.16*sens) g=cx<0.5?'moveL':'moveR';
  else if(Math.abs(cy-0.5)>0.14*sens) g=cy<0.45?'moveU':'moveD';

  if(g==='fist' && vel>0.3){g='grab'; S.grabActive=true}
  else if(g!=='fist') S.grabActive=false;

  if(g!==S.gesture){S.gesture=g; applyG(g); updG()}
  else contG(g,{cx,cy,pinchD,vel,twoDist});

  let mode='FREE';
  if(g==='pinch'||g==='expand'||g==='compress')mode='ZOOM';
  else if(g==='point')mode='ATTRACT';
  else if(g==='grab'||g==='fist')mode='GRAB';
  else if(g==='twoFinger')mode='ROTATE';
  S.mode=mode; modeBadge.textContent='MODE: '+mode;
}

function applyG(g){
  switch(g){
    case'open':S.expand=Math.min(2.4,S.expand+.4);S.energy=Math.min(1.5,S.energy+.35);break;
    case'fist':S.expand=Math.max(.2,S.expand-.4);S.energy=Math.max(.15,S.energy-.12);break;
    case'pinch':S.attract=Math.min(1,S.attract+.5);break;
    case'shock':case'three':S.shock=1;S.energy=1.4;break;
    case'expand':S.zoom=Math.min(3.5,S.zoom+.4);S.expand=Math.min(2.5,S.expand+.3);break;
    case'compress':S.zoom=Math.max(.3,S.zoom-.4);S.expand=Math.max(.2,S.expand-.3);break;
    case'moveL':S.rotY-=.3;break; case'moveR':S.rotY+=.3;break;
    case'moveU':S.vert=Math.min(7,S.vert+1.4);break; case'moveD':S.vert=Math.max(-7,S.vert-1.4);break;
    case'twoFinger':S.rotY+=.1;break;
    case'thumbsUp':S.formation=(S.formation+1)%12;$('sel-formation').value=S.formation;genForm(S.formation);break;
    case'thumbsDown':S.formation=(S.formation+11)%12;$('sel-formation').value=S.formation;genForm(S.formation);break;
    case'point':S.attract=Math.min(1,S.attract+.4);break;
    case'grab':break;
  }
  $('zoom-val').textContent=S.zoom.toFixed(2);
}

function contG(g,d){
  if(g==='pinch'){S.attract=Math.min(1,.25+(0.08-d.pinchD)*10)}
  if(g==='twoFinger'){S.rotY+=(d.cx-.5)*.05;S.rotX+=(d.cy-.5)*.035}
  if(g==='moveL'||g==='moveR')S.rotY+=(d.cx-.5)*.08;
  if(g==='moveU'||g==='moveD'){S.vert+=(0.5-d.cy)*.18;S.vert=Math.max(-8,Math.min(8,S.vert))}
  if(g==='point'){S.attract=Math.min(1,.5);S.energy=Math.min(1.2,S.energy+.01)}
  if(g==='grab'){S.centerX+=(0.5-d.cx)*0.4;S.centerY+=(0.5-d.cy)*0.35;S.centerX=Math.max(-8,Math.min(8,S.centerX));S.centerY=Math.max(-6,Math.min(6,S.centerY))}
  if(g==='open'){S.energy=Math.min(1.3,S.energy+.005)}
}

function updG(){gDisp.textContent=tg(S.gesture);gDisp.classList.toggle('visible',S.gesture!=='none')}

function drawLM(hands){
  const w=lCanvas.width,h=lCanvas.height;lCtx.clearRect(0,0,w,h);lCtx.save();lCtx.scale(-1,1);lCtx.translate(-w,0);
  const conn=[[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[0,9],[9,10],[10,11],[11,12],[0,13],[13,14],[14,15],[15,16],[0,17],[17,18],[18,19],[19,20],[5,9],[9,13],[13,17]];
  for(const hand of hands){
    lCtx.strokeStyle='rgba(0,255,157,.75)';lCtx.lineWidth=2.2;
    for(const[a,b] of conn){lCtx.beginPath();lCtx.moveTo(hand[a].x*w,hand[a].y*h);lCtx.lineTo(hand[b].x*w,hand[b].y*h);lCtx.stroke()}
    lCtx.fillStyle='rgba(0,240,255,.95)';
    for(const p of hand){lCtx.beginPath();lCtx.arc(p.x*w,p.y*h,3.2,0,Math.PI*2);lCtx.fill()}
  }
  lCtx.restore();
}

function setQ(q){
  S.quality=q;
  let n,bs=.7,pr=Math.min(devicePixelRatio,2);
  if(q==='auto'){n=IS_MOBILE?6500:11000;bs=.8}else if(q==='low'){n=MAXP.low;bs=.3;pr=1}else if(q==='medium'){n=MAXP.medium;bs=.55;pr=Math.min(devicePixelRatio,1.5)}else if(q==='high'){n=MAXP.high;bs=.85}else{n=MAXP.ultra;bs=1.05}
  renderer.setPixelRatio(pr);bloom.strength=bs;if(Math.abs(n-S.count)>400)mkParticles(n);
}

function autoQ(fps){
  if(S.quality!=='auto')return;autoT++;if(autoT<40)return;autoT=0;
  if(fps<26&&S.count>3800){mkParticles(Math.max(3500,Math.floor(S.count*.78)));bloom.strength=Math.max(.28,bloom.strength-.08)}
  else if(fps>50&&S.count<(IS_MOBILE?10000:18000)){mkParticles(Math.min(IS_MOBILE?11000:20000,Math.floor(S.count*1.14)));bloom.strength=Math.min(.95,bloom.strength+.05)}
}

function animate(){
  requestAnimationFrame(animate);
  const dt=Math.min(.05,clock.getDelta());
  updateP(dt);
  if(S.hands===0)S.rotY+=dt*.06;
  if(S.colorMode==='rainbow'||S.colorMode==='fire')S.hue=(S.hue+dt*.04)%1;
  camera.position.z=28/Math.max(0.5,Math.min(2,S.zoom*0.5+0.75));
  composer.render();
  frames++;const now=performance.now();
  if(now-lastFps>=1000){S.fps=Math.round(frames*1000/(now-lastFps));$('fps-val').textContent=S.fps;frames=0;lastFps=now;autoQ(S.fps)}
}

function showErr(msg,d=false){
  $('load-spinner').style.display='none';$('permission-hint').style.display='none';
  $('overlay-title').textContent='NEURO PARTICLES AI+';$('overlay-msg').textContent=msg;
  overlay.classList.remove('hidden');$('btn-overlay-start').style.display='inline-block';
  $('btn-overlay-dismiss').style.display=d?'inline-block':'none';$('btn-overlay-start').disabled=false;$('btn-overlay-start').textContent=t('perm');
}
function showReady(){
  $('load-spinner').style.display='none';$('overlay-title').textContent='NEURO PARTICLES AI+';
  $('overlay-msg').textContent=t('ready');$('permission-hint').style.display='block';
  overlay.classList.remove('hidden');$('btn-overlay-start').style.display='inline-block';
  $('btn-overlay-dismiss').style.display='inline-block';$('btn-overlay-start').disabled=false;$('btn-overlay-start').textContent=t('perm');
}

$('btn-start').onclick=()=>reqCam();
$('btn-stop').onclick=stopCam;
$('btn-reset').onclick=()=>{S.expand=1;S.energy=.5;S.attract=0;S.shock=0;S.rotY=0;S.rotX=0;S.vert=0;S.zoom=1;S.centerX=0;S.centerY=0;S.centerZ=0;$('zoom-val').textContent='1.00';genForm(S.formation)};
$('btn-fullscreen').onclick=()=>{if(!document.fullscreenElement)document.documentElement.requestFullscreen?.();else document.exitFullscreen?.()};
$('btn-lang').onclick=()=>{S.lang=S.lang==='fa'?'en':'fa';updUI();updG();if(!overlay.classList.contains('hidden')){$('overlay-msg').textContent=S.modelOk?t('ready'):t('loading');$('btn-overlay-start').textContent=t('perm')}};
$('sel-formation').onchange=e=>{S.formation=+e.target.value;genForm(S.formation)};
$('sel-quality').onchange=e=>setQ(e.target.value);
$('sel-color').onchange=e=>{S.colorMode=e.target.value;for(let i=0;i<S.count;i++)setCol(i,Math.random());geo.attributes.color.needsUpdate=true};
$('rng-sens').oninput=e=>{S.sens=+e.target.value};
$('btn-skeleton').onclick=()=>{S.skeleton=!S.skeleton;$('btn-skeleton').textContent=S.skeleton?(S.lang==='fa'?'روشن':'On'):(S.lang==='fa'?'خاموش':'Off');$('btn-skeleton').classList.toggle('active',S.skeleton)};
$('btn-attract').onclick=()=>{S.attractOn=!S.attractOn;$('btn-attract').textContent=S.attractOn?(S.lang==='fa'?'روشن':'On'):(S.lang==='fa'?'خاموش':'Off');$('btn-attract').classList.toggle('active',S.attractOn)};
$('btn-help').onclick=()=>$('help-panel').classList.add('show');
$('btn-close-help').onclick=()=>$('help-panel').classList.remove('show');
$('btn-overlay-start').onclick=async()=>{$('btn-overlay-start').disabled=true;$('btn-overlay-start').textContent=t('req');const ok=await reqCam();if(!ok){$('btn-overlay-start').disabled=false;$('btn-overlay-start').textContent=t('perm')}};
$('btn-overlay-dismiss').onclick=()=>overlay.classList.add('hidden');

async function boot(){
  updUI();
  if(!window.WebGLRenderingContext){showErr(t('unsupported'));return}
  try{init3()}catch(e){showErr(t('unsupported'));return}
  $('overlay-msg').textContent=t('loading');$('load-spinner').style.display='block';
  const ok=await initMP();
  if(!ok)showErr(t('modelError'),true);else showReady();
  setQ('auto');animate();
}
boot();
