import * as THREE from "three";
import {GLTFLoader} from "three/addons/loaders/GLTFLoader.js";

const canvas=document.querySelector("#game");
const scene=new THREE.Scene(); scene.background=new THREE.Color(0x07140d); scene.fog=new THREE.Fog(0x07140d,18,78);
const camera=new THREE.PerspectiveCamera(62,innerWidth/innerHeight,.05,150);camera.position.set(0,4.4,8);camera.lookAt(0,1.5,-20);
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:"high-performance"});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setSize(innerWidth,innerHeight);renderer.shadowMap.enabled=true;
scene.add(new THREE.HemisphereLight(0xbfeac9,0x182215,2));
const sun=new THREE.DirectionalLight(0xffedc3,3.2);sun.position.set(-10,15,8);sun.castShadow=true;scene.add(sun);

const lanes=[-1.25,0,1.25], clock=new THREE.Clock();
let dino=null,running=false,score=0,distance=0,lives=2,lane=1,target=1,spawn=0,action="run",actionT=0;
let power={magnet:0,boost:0,shield:0};const obstacles=[],coins=[],powers=[];

function mat(c,r=.8){return new THREE.MeshStandardMaterial({color:c,roughness:r})}
const mud=mat(0x4a2d18,1), leaf=mat(0x1e7130,1), trunk=mat(0x4d321f,1);

for(let z=-80;z<25;z+=5){let road=new THREE.Mesh(new THREE.BoxGeometry(4.2,.2,5.2),mud);road.position.set(0,-.12,z);road.receiveShadow=true;scene.add(road)}
function tree(x,z,s=1){let g=new THREE.Group();let t=new THREE.Mesh(new THREE.CylinderGeometry(.14*s,.23*s,2.4*s,8),trunk);t.position.y=1.2*s;g.add(t);for(let i=0;i<5;i++){let l=new THREE.Mesh(new THREE.ConeGeometry(.7*s,.9*s,8),mat(i%2?0x17602b:0x2a873c,1));l.position.set((Math.random()-.5)*.6*s,2.2*s+i*.12,(Math.random()-.5)*.5*s);g.add(l)}g.position.set(x,z>0?-z:z,z);g.position.z=z;g.traverse(o=>o.castShadow=true);scene.add(g)}
for(let i=0;i<80;i++)tree((Math.random()<.5?-1:1)*(3+Math.random()*9),-Math.random()*90,0.7+Math.random()*1.3);

new GLTFLoader().load("diano_racer_trex.glb",g=>{dino=g.scene;dino.scale.setScalar(.58);dino.position.set(0,0,1.2);dino.rotation.y=0;dino.traverse(o=>{if(o.isMesh)o.castShadow=true});scene.add(dino)},undefined,e=>console.warn("GLB load failed",e));

function boxObstacle(type,lane){let g=new THREE.Group();let m;
 if(type==="rock"){m=new THREE.Mesh(new THREE.DodecahedronGeometry(.7,1),mat(0x655b4d,1));m.position.y=.65;g.add(m)}
 else if(type==="spike"){for(let i=-1;i<=1;i++){m=new THREE.Mesh(new THREE.ConeGeometry(.18,.9,6),mat(0x8a8175,.5));m.position.set(i*.38,.45,0);g.add(m)}}
 else if(type==="gate"){for(let x of[-.5,.5]){m=new THREE.Mesh(new THREE.CylinderGeometry(.08,.1,1.8,8),trunk);m.position.set(x,.9,0);g.add(m)}m=new THREE.Mesh(new THREE.BoxGeometry(1.2,.25,.5),trunk);m.position.y=1.55;g.add(m)}
 else {m=new THREE.Mesh(new THREE.CylinderGeometry(.32,.38,2.4,10),trunk);m.rotation.z=Math.PI/2;m.position.y=.45;g.add(m)}
 g.position.set(lanes[lane],0,-48);g.traverse(o=>o.castShadow=true);scene.add(g);obstacles.push({g,lane,type,hit:false})
}
function coin(lane){let g=new THREE.Mesh(new THREE.TorusGeometry(.22,.07,10,20),new THREE.MeshStandardMaterial({color:0xffb71b,emissive:0x6b3200,emissiveIntensity:1.4,metalness:.5,roughness:.25}));g.rotation.y=Math.PI/2;g.position.set(lanes[lane],1.3,-48);scene.add(g);coins.push(g)}
function powerup(lane){let type=["magnet","boost","shield","life"][Math.floor(Math.random()*4)],c={magnet:0xe33b3b,boost:0x269eff,shield:0x36e94d,life:0xff3451}[type];let g=new THREE.Mesh(new THREE.IcosahedronGeometry(.38,1),new THREE.MeshStandardMaterial({color:c,emissive:c,emissiveIntensity:1.6}));g.position.set(lanes[lane],1.2,-48);scene.add(g);powers.push({g,lane,type})}

function start(){for(const a of [...obstacles,...coins,...powers])scene.remove(a.g||a);obstacles.length=coins.length=powers.length=0;score=0;distance=0;lives=2;lane=target=1;spawn=0;power={magnet:0,boost:0,shield:0};action="run";actionT=0;if(dino)dino.position.set(0,0,1.2);running=true}
function end(){running=false;let b=Math.max(score,+localStorage.dianoBest||0);localStorage.dianoBest=b;document.querySelector("#final").textContent=score.toLocaleString();document.querySelector("#best").textContent=b.toLocaleString();document.querySelector("#hud").classList.add("hide");document.querySelector("#over").classList.remove("hide")}
function hit(i){let o=obstacles[i];if(o.hit)return;o.hit=true;if(power.shield){power.shield=0;scene.remove(o.g);obstacles.splice(i,1);return}lives--;action="hit";actionT=0;if(lives<=0)end()}
function update(dt){
 if(!running||!dino)return;
 let base=13+distance/850, speed=base*(power.boost>0?1.55:1);distance+=speed*dt;score+=Math.floor(speed*dt*2);
 power.magnet=Math.max(0,power.magnet-dt);power.boost=Math.max(0,power.boost-dt);power.shield=Math.max(0,power.shield-dt);
 spawn-=dt;if(spawn<=0){spawn=.68+Math.random()*.42;let l=Math.floor(Math.random()*3),t=["log","rock","spike","gate"][Math.floor(Math.random()*4)];boxObstacle(t,l);if(Math.random()<.8)coin(Math.floor(Math.random()*3));if(Math.random()<.13)powerup(Math.floor(Math.random()*3))}
 dino.position.x+=(lanes[target]-dino.position.x)*Math.min(1,dt*10);actionT+=dt;
 if(action==="jump"){dino.position.y=Math.sin(Math.min(1,actionT/.8)*Math.PI)*1.55;if(actionT>.8){action="run";dino.position.y=0}}
 else if(action==="slide"){dino.scale.y=.34;if(actionT>.7){action="run";dino.scale.y=.58}}
 else if(action==="hit"){dino.rotation.z=Math.sin(actionT*30)*.15;if(actionT>.35){action="run";dino.rotation.z=0}}
 for(let i=obstacles.length-1;i>=0;i--){let o=obstacles[i];o.g.position.z+=speed*dt;if(o.g.position.z>8){scene.remove(o.g);obstacles.splice(i);continue}if(Math.abs(o.g.position.z-dino.position.z)<.85&&Math.abs(o.g.position.x-dino.position.x)<.58&&!o.hit){let jump=action==="jump"&&dino.position.y>.5&&o.type!=="gate",slide=action==="slide"&&o.type==="gate";if(!jump&&!slide)hit(i)}}
 for(let i=coins.length-1;i>=0;i--){let c=coins[i];c.position.z+=speed*dt;c.rotation.y+=dt*6;if(power.magnet)c.position.x+=(dino.position.x-c.position.x)*dt*7;if(c.position.z>8){scene.remove(c);coins.splice(i);continue}if(Math.abs(c.position.z-dino.position.z)<.8&&Math.abs(c.position.x-dino.position.x)<.65){score+=100;scene.remove(c);coins.splice(i)}}
 for(let i=powers.length-1;i>=0;i--){let p=powers[i];p.g.position.z+=speed*dt;p.g.rotation.y+=dt*2;if(p.g.position.z>8){scene.remove(p.g);powers.splice(i);continue}if(Math.abs(p.g.position.z-dino.position.z)<.8&&Math.abs(p.g.position.x-dino.position.x)<.65){if(p.type==="life")lives++;else power[p.type]=10;scene.remove(p.g);powers.splice(i)}}
 camera.position.x+=(dino.position.x*.15-camera.position.x)*dt*3;camera.lookAt(dino.position.x*.2,1.4,-20);
 score=Math.floor(score);document.querySelector("#score").textContent=score.toLocaleString();document.querySelector("#dist").textContent=Math.floor(distance);document.querySelector("#life").textContent=lives;document.querySelector("#mag").textContent=Math.ceil(power.magnet);document.querySelector("#boost").textContent=Math.ceil(power.boost);document.querySelector("#shield").textContent=Math.ceil(power.shield)
}
function frame(){requestAnimationFrame(frame);let dt=Math.min(.04,clock.getDelta());update(dt);renderer.render(scene,camera)}frame();

let sx=0,sy=0;addEventListener("pointerdown",e=>{sx=e.clientX;sy=e.clientY});addEventListener("pointerup",e=>{if(!running)return;let dx=e.clientX-sx,dy=e.clientY-sy;if(Math.max(Math.abs(dx),Math.abs(dy))<25)return;if(Math.abs(dx)>Math.abs(dy))target=Math.max(0,Math.min(2,target+(dx>0?1:-1)));else if(dy<0&&action==="run"){action="jump";actionT=0}else if(dy>0&&action==="run"){action="slide";actionT=0}});
addEventListener("keydown",e=>{if(e.key==="ArrowLeft")target=Math.max(0,target-1);if(e.key==="ArrowRight")target=Math.min(2,target+1);if((e.key==="ArrowUp"||e.key===" ")&&action==="run"){action="jump";actionT=0}if(e.key==="ArrowDown"&&action==="run"){action="slide";actionT=0}});
addEventListener("resize",()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,1.5))});

const menu=document.querySelector("#menu"),how=document.querySelector("#howScreen"),over=document.querySelector("#over"),hud=document.querySelector("#hud");
document.querySelector("#play").onclick=()=>{menu.classList.add("hide");hud.classList.remove("hide");start()};
document.querySelector("#retry").onclick=()=>{over.classList.add("hide");hud.classList.remove("hide");start()};
document.querySelector("#home").onclick=()=>{over.classList.add("hide");menu.classList.remove("hide")};
document.querySelector("#how").onclick=()=>{menu.classList.add("hide");how.classList.remove("hide")};
document.querySelector("#back").onclick=()=>{how.classList.add("hide");menu.classList.remove("hide")};
