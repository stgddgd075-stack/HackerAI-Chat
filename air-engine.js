import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

const $ = id => document.getElementById(id);
const canvas=$('gl'), video=$('vid'), lmC=$('lm'), lmX=lmC.getContext('2d');
const camBox=$('cam'), ov=$('ov'), hint=$('hint'), cross=$('cross'), listEl=$('list');

let tool='cube', objects=[], placeCooldown=0, lastPlace=0;
let handLM=null, camOn=false, pointing=false, px=0.5, py=0.5, holdMs=0, lastT=0;
let renderer, scene, camera, composer, clock=new THREE.Clock();
let ghost=null, grid=null;

const COLORS={cube:0x00ff9d,sphere:0x00e5ff,pyramid:0xffd60a,ring:0xff2d95,star:0xffaa00,crystal:0xaa66ff,tower:0x44ffaa,platform:0x66aaff};
const NAMES={cube:'مکعب',sphere:'کره',pyramid:'هرم',ring:'حلقه',star:'ستاره',crystal:'کریستال',tower:'برج',platform:'سکو'};

function init3(){
  renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));
  renderer.setSize(innerWidth,innerHeight);renderer.setClearColor(0x03050a);
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  scene=new THREE.Scene();
  camera=new THREE.PerspectiveCamera(55,innerWidth/innerHeight,0.1,100);
  camera.position.set(0,2,10);
  camera.lookAt(0,1,0);
  scene.add(new THREE.AmbientLight(0x334455,0.6));
  const d=new THREE.DirectionalLight(0xffffff,0.9);d.position.set(5,10,7);scene.add(d);
  const p=new THREE.PointLight(0x00ff9d,0.5,30);p.position.set(-4,4,4);scene.add(p);
  const g=new THREE.GridHelper(20,20,0x00ff9d,0x113322);g.position.y=0;g.material.opacity=0.35;g.material.transparent=true;scene.add(g);grid=g;
  const sg=new THREE.BufferGeometry(),sc=400,sp=new Float32Array(sc*3);
  for(let i=0;i<sc;i++){sp[i*3]=(Math.random()-.5)*60;sp[i*3+1]=Math.random()*30;sp[i*3+2]=(Math.random()-.5)*60-10}
  sg.setAttribute('position',new THREE.BufferAttribute(sp,3));
  scene.add(new THREE.Points(sg,new THREE.PointsMaterial({color:0x88aacc,size:0.06,transparent:true,opacity:0.5})));
  const rp=new RenderPass(scene,camera);
  const bloom=new UnrealBloomPass(new THREE.Vector2(innerWidth,innerHeight),0.7,0.35,0.25);
  composer=new EffectComposer(renderer);composer.addPass(rp);composer.addPass(bloom);
  makeGhost();
  addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);composer.setSize(innerWidth,innerHeight)});
}

function geoFor(t){
  switch(t){
    case'cube':return new THREE.BoxGeometry(1,1,1);
    case'sphere':return new THREE.SphereGeometry(0.55,24,16);
    case'pyramid':return new THREE.ConeGeometry(0.6,1.1,4);
    case'ring':return new THREE.TorusGeometry(0.55,0.18,12,32);
    case'star':return new THREE.OctahedronGeometry(0.65,0);
    case'crystal':return new THREE.OctahedronGeometry(0.7,0);
    case'tower':return new THREE.CylinderGeometry(0.25,0.4,1.6,8);
    case'platform':return new THREE.BoxGeometry(1.6,0.15,1.6);
    default:return new THREE.BoxGeometry(1,1,1);
  }
}

function makeGhost(){
  if(ghost){scene.remove(ghost);ghost.geometry.dispose();ghost.material.dispose()}
  const mat=new THREE.MeshStandardMaterial({color:COLORS[tool],transparent:true,opacity:0.35,emissive:COLORS[tool],emissiveIntensity:0.4,roughness:0.3,metalness:0.6});
  ghost=new THREE.Mesh(geoFor(tool),mat);
  ghost.visible=false;
  scene.add(ghost);
}

function screenToWorld(nx,ny){
  const v=new THREE.Vector3((nx*2-1), -(ny*2-1), 0.5);
  v.unproject(camera);
  const dir=v.sub(camera.position).normalize();
  const depth=8;
  const pos=camera.position.clone().add(dir.multiplyScalar(depth));
  if(pos.y<0.4) pos.y=0.4;
  if(pos.y>6) pos.y=6;
  pos.x=Math.max(-8,Math.min(8,pos.x));
  pos.z=Math.max(-6,Math.min(6,pos.z));
  return pos;
}

function placeObject(){
  const now=performance.now();
  if(now-lastPlace<450) return;
  lastPlace=now;
  const pos=screenToWorld(px,py);
  const mat=new THREE.MeshStandardMaterial({
    color:COLORS[tool],emissive:COLORS[tool],emissiveIntensity:0.55,
    roughness:0.25,metalness:0.7,transparent:true,opacity:0.95
  });
  const mesh=new THREE.Mesh(geoFor(tool),mat);
  mesh.position.copy(pos);
  mesh.userData={type:tool,id:Date.now()};
  mesh.scale.set(0.1,0.1,0.1);
  scene.add(mesh);
  objects.push(mesh);
  updateList();
  flashHint('ساخته شد: '+NAMES[tool]);
}

function updateList(){
  listEl.innerHTML='';
  objects.slice().reverse().forEach((o,i)=>{
    const d=document.createElement('div');d.className='item';
    d.innerHTML=`<span><b>${NAMES[o.userData.type]||o.userData.type}</b></span><button data-i="${objects.length-1-i}">×</button>`;
    listEl.appendChild(d);
  });
  $('cnt').textContent=objects.length+' شیء';
  listEl.querySelectorAll('button').forEach(b=>{
    b.onclick=()=>{
      const i=+b.dataset.i;
      const o=objects[i];
      if(!o)return;
      scene.remove(o);o.geometry.dispose();o.material.dispose();
      objects.splice(i,1);updateList();
    };
  });
}

function clearAll(){
  objects.forEach(o=>{scene.remove(o);o.geometry.dispose();o.material.dispose()});
  objects=[];updateList();flashHint('همه پاک شد');
}

function flashHint(t){hint.textContent=t;hint.classList.add('show');clearTimeout(flashHint._t);flashHint._t=setTimeout(()=>hint.classList.remove('show'),1600)}

async function initMP(){
  try{
    const v=await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/+esm');
    const {HandLandmarker,FilesetResolver}=v;
    const fs=await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm');
    handLM=await HandLandmarker.createFromOptions(fs,{
      baseOptions:{modelAssetPath:'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',delegate:'GPU'},
      runningMode:'VIDEO',numHands:1,minHandDetectionConfidence:0.55,minHandPresenceConfidence:0.5,minTrackingConfidence:0.5
    });
    return true;
  }catch(e){console.error(e);return false}
}

async function startCam(){
  try{
    if(video.srcObject){video.srcObject.getTracks().forEach(t=>t.stop())}
    const stream=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:'user',width:{ideal:640},height:{ideal:480}}});
    video.srcObject=stream;video.muted=true;video.setAttribute('playsinline','true');
    await new Promise((res,rej)=>{const to=setTimeout(()=>rej(new Error('t')),7000);video.onloadedmetadata=()=>{clearTimeout(to);video.play().then(res).catch(rej)}});
    lmC.width=video.videoWidth||640;lmC.height=video.videoHeight||480;
    camOn=true;camBox.classList.add('on');$('dcam').className='dot on';
    $('bstart').disabled=true;$('bstop').disabled=false;ov.classList.add('hid');
    loop();
  }catch(e){
    $('omsg').textContent='اجازه دوربین لازم است. از تنظیمات مرورگر فعال کنید.';
    $('bperm').style.display='inline-block';$('bperm').disabled=false;
  }
}

function stopCam(){
  if(video.srcObject){video.srcObject.getTracks().forEach(t=>t.stop());video.srcObject=null}
  camOn=false;camBox.classList.remove('on');$('dcam').className='dot';$('dhand').className='dot';
  $('bstart').disabled=false;$('bstop').disabled=true;pointing=false;cross.classList.remove('on');ghost.visible=false;
}

let lastVT=-1;
function loop(){
  if(!camOn||!handLM)return;
  const now=performance.now();
  if(video.readyState>=2&&video.currentTime!==lastVT){
    lastVT=video.currentTime;
    try{const r=handLM.detectForVideo(video,now);process(r)}catch(e){}
  }
  requestAnimationFrame(loop);
}

function fingerUp(lm,tip,pip){return lm[tip].y < lm[pip].y-0.025}

function process(res){
  const hands=res.landmarks||[];
  lmX.clearRect(0,0,lmC.width,lmC.height);
  if(!hands.length){
    $('dhand').className='dot';pointing=false;cross.classList.remove('on');ghost.visible=false;holdMs=0;return;
  }
  const lm=hands[0];
  const idx=fingerUp(lm,8,6);
  const mid=fingerUp(lm,12,10);
  const rng=fingerUp(lm,16,14);
  const pnk=fingerUp(lm,20,18);
  const isPoint=idx && !mid && !rng && !pnk;
  const tip=lm[8];
  const nx=1-tip.x;
  const ny=tip.y;
  px=nx;py=ny;
  lmX.save();lmX.scale(-1,1);lmX.translate(-lmC.width,0);
  lmX.fillStyle='rgba(0,255,157,0.95)';
  lmX.beginPath();lmX.arc(tip.x*lmC.width,tip.y*lmC.height,5,0,Math.PI*2);lmX.fill();
  lmX.strokeStyle='rgba(0,229,255,0.7)';lmX.lineWidth=2;
  lmX.beginPath();lmX.moveTo(lm[5].x*lmC.width,lm[5].y*lmC.height);lmX.lineTo(tip.x*lmC.width,tip.y*lmC.height);lmX.stroke();
  lmX.restore();
  if(isPoint){
    $('dhand').className='dot on';
    pointing=true;
    cross.classList.add('on');
    cross.style.left=(nx*100)+'%';
    cross.style.top=(ny*100)+'%';
    const wpos=screenToWorld(nx,ny);
    ghost.position.copy(wpos);
    ghost.visible=true;
    const now=performance.now();
    if(!lastT) lastT=now;
    holdMs += (now-lastT);
    lastT=now;
    if(holdMs>550){
      placeObject();
      holdMs=0;
    }
    const p=Math.min(1,holdMs/550);
    cross.style.transform=`scale(${1+p*0.4})`;
    cross.style.borderColor=p>0.85? '#ffd60a' : '#00ff9d';
  } else {
    pointing=false;holdMs=0;lastT=0;
    cross.classList.remove('on');ghost.visible=false;
    cross.style.transform='scale(1)';
    $('dhand').className='dot';
  }
}

function animate(){
  requestAnimationFrame(animate);
  const t=clock.getElapsedTime();
  objects.forEach((o,i)=>{
    if(o.scale.x<1){const s=Math.min(1,o.scale.x+0.08);o.scale.set(s,s,s)}
    o.rotation.y=t*0.4+i*0.2;
    if(o.userData.type==='ring') o.rotation.x=t*0.6;
    if(o.userData.type==='star'||o.userData.type==='crystal') o.rotation.z=t*0.5;
    o.position.y += Math.sin(t*2+i)*0.002;
  });
  if(ghost&&ghost.visible){
    ghost.rotation.y=t*1.2;
    ghost.material.opacity=0.25+Math.sin(t*4)*0.1;
  }
  if(!pointing){
    camera.position.x=Math.sin(t*0.15)*1.5;
    camera.position.z=10+Math.cos(t*0.15)*0.5;
    camera.lookAt(0,1.2,0);
  }
  composer.render();
}

document.querySelectorAll('.tool').forEach(el=>{
  el.onclick=()=>{
    document.querySelectorAll('.tool').forEach(x=>x.classList.remove('on'));
    el.classList.add('on');
    tool=el.dataset.t;
    makeGhost();
    flashHint('ابزار: '+NAMES[tool]+' — اشاره کن و نگه دار');
  };
});
$('bstart').onclick=startCam;
$('bstop').onclick=stopCam;
$('bclear').onclick=clearAll;
$('bfull').onclick=()=>{if(!document.fullscreenElement)document.documentElement.requestFullscreen?.();else document.exitFullscreen?.()};
$('bperm').onclick=()=>{$('bperm').disabled=true;startCam()};
$('bskip').onclick=()=>ov.classList.add('hid');

async function boot(){
  try{init3()}catch(e){$('omsg').textContent='WebGL پشتیبانی نمی‌شود.';return}
  $('omsg').textContent='بارگذاری مدل ردیابی انگشت...';
  const ok=await initMP();
  $('sp').style.display='none';
  if(!ok){$('omsg').textContent='مدل لود نشد. اینترنت را چک کنید.';$('bskip').style.display='inline-block';return}
  $('omsg').textContent='فقط انگشت اشاره را بالا بیاور و روی نقطه نگه دار تا شیء ساخته شود.';
  $('bperm').style.display='inline-block';
  $('bskip').style.display='inline-block';
  animate();
}
boot();
