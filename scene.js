// scene.js: Three.js scene (point cloud, shaders, camera, animation loop)
// Needs: three.js (global THREE) and data.js (window.CHICK_DATA) loaded first.
window.createChickScene=function(canvas){
const D=window.CHICK_DATA,N=D.n;
const b64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
const pb=b64(D.pos),cb=b64(D.col);
const q=new Int16Array(pb.buffer),pos=new Float32Array(N*3),col=new Float32Array(N*3);
for(let i=0;i<N*3;i++){pos[i]=q[i]/32767;col[i]=cb[i]/255}
const rnd=new Float32Array(N*4);
for(let i=0;i<N;i++){const u=Math.random()*2-1,t=Math.random()*6.2832,r=Math.sqrt(1-u*u);
 // direction mostly outward from the point plus a random vector
 rnd[i*4]=r*Math.cos(t);rnd[i*4+1]=u;rnd[i*4+2]=r*Math.sin(t);rnd[i*4+3]=Math.random();}
const cv=canvas;
const R=new THREE.WebGLRenderer({canvas:cv,antialias:true});
R.setPixelRatio(Math.min(devicePixelRatio,2));
const S=new THREE.Scene(),cam=new THREE.PerspectiveCamera(40,1,.1,50);cam.position.set(0,0,3.6);
const g=new THREE.BufferGeometry();
g.setAttribute('position',new THREE.BufferAttribute(pos,3));
g.setAttribute('color',new THREE.BufferAttribute(col,3));
g.setAttribute('rnd',new THREE.BufferAttribute(rnd,4));
const mat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
uniforms:{p:{value:0},t:{value:0},px:{value:1}},
vertexShader:`
attribute vec3 color;attribute vec4 rnd;uniform float p,t,px;varying vec3 vc;varying float va,sp;
float ease(float x){return x*x*(3.-2.*x);}
float hash(float n){return fract(sin(n)*43758.5453);}
void main(){
 float k=ease(clamp(p*1.5-rnd.w*.5,0.,1.));
 vec3 b=position;
 float r0=length(b.xz),a0=atan(b.z,b.x);
 float h=rnd.w;
 float yt=-.9+h*2.5;
 float rt=.06+.6*pow(h,1.3)+.08*rnd.x*(.3+h);
 float r=mix(r0,rt,k);
 float y=mix(b.y,yt,k);
 float om=3.2/(rt+.22);
 float ang=a0+k*(5.+rnd.y*2.)+t*om*k;
 vec3 w=vec3(r*cos(ang),y,r*sin(ang));
 // snap to a coarse grid that updates in steps -> pixel jitter
 float g=.022;
 float stp=floor(t*10.);
 vec3 j=(vec3(hash(stp+rnd.x*91.),hash(stp+rnd.y*57.),hash(stp+rnd.w*33.))-.5)*g*2.;
 vec3 snapped=floor((w+j*k)/g+.5)*g;
 w=mix(w,snapped,smoothstep(.0,.15,k));
 vec4 mv=modelViewMatrix*vec4(w,1.);
 gl_Position=projectionMatrix*mv;
 // blocky on/off flicker, stepped in time
 float fl=floor(t*6.+rnd.w*40.);
 float on=step(.78,hash(fl*1.7+rnd.x*13.+rnd.y*7.));
 float pick=step(.7,fract(rnd.y*17.3+rnd.x*3.1));
 sp=on*pick*(.5+.5*k);
 float sz=px*(1.7+k*.5)*(3./-mv.z);
 gl_PointSize=floor(sz*(1.+sp*1.6)+.5);
 float lum=clamp(dot(color,vec3(.3,.59,.11))*1.05,0.,1.);
 vc=mix(vec3(.16,.30,.52),vec3(.80,.90,.99),pow(lum,1.1))*(1.+k*.35);va=.9-k*.15;
}`,
fragmentShader:`varying vec3 vc;varying float va,sp;
void main(){
 vec3 col=mix(vc,vec3(.92,.97,1.),clamp(sp,0.,1.));
 col=floor(col*7.+.5)/7.;   // limited palette
 gl_FragColor=vec4(col,va);}`});
const pts=new THREE.Points(g,mat);S.add(pts);
function fit(){const w=innerWidth,h=innerHeight;R.setSize(w,h,false);cam.aspect=w/h;cam.position.z=w<h?5.2:3.6;cam.updateProjectionMatrix();mat.uniforms.px.value=R.getPixelRatio()*1.3}
addEventListener('resize',fit);fit();
let yaw=0,pitch=.1,drag=false,lx=0,ly=0;
cv.addEventListener('pointerdown',e=>{drag=true;lx=e.clientX;ly=e.clientY;cv.setPointerCapture(e.pointerId)});
cv.addEventListener('pointerup',()=>drag=false);
cv.addEventListener('pointermove',e=>{if(!drag)return;yaw+=(e.clientX-lx)*.008;pitch=Math.max(-1.2,Math.min(1.2,pitch+(e.clientY-ly)*.008));lx=e.clientX;ly=e.clientY});
const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
// phases: hold 1.8s, scatter 2.6s, drift 1.2s, gather 2.8s
const ph=[1.8,2.8,2.4,2.8];let T=0,auto=!reduce,manual=-1,lt=performance.now();
function pv(c){let x=c%(ph[0]+ph[1]+ph[2]+ph[3]);
 if(x<ph[0])return 0;x-=ph[0];if(x<ph[1])return x/ph[1];x-=ph[1];if(x<ph[2])return 1;x-=ph[2];return 1-x/ph[3]}
function frame(now){const dt=Math.min((now-lt)/1000,.05);lt=now;mat.uniforms.t.value+=dt;
 if(auto)T+=dt;
 let p=0;if(manual>=0){manual+=dt;const s=ph[1]+ph[2]+ph[3];p=pv(ph[0]+manual);if(manual>=s){manual=-1;p=0}}else p=pv(T);
 mat.uniforms.p.value=p;
 if(!drag)yaw+=dt*.25;
 pts.rotation.set(pitch,yaw,0);R.render(S,cam);requestAnimationFrame(frame)}
requestAnimationFrame(frame);
return{
 replay(){manual=0},
 toggleAuto(){auto=!auto;return auto},
 isAuto(){return auto}
};
};
