// Original 16-bit-inspired pixel renderer. Independent of the simulation.
export const VIEW={w:384,h:288},WORLD={w:448,h:664},FIELD={x:32,y:52,w:384,h:560};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const project=(x,z)=>({x:FIELD.x+(x/68+.5)*FIELD.w,y:FIELD.y+(z/94+.5)*FIELD.h});
export function cameraTarget(ball){let p=project(ball.x,ball.z);return {x:clamp(p.x-VIEW.w/2,0,WORLD.w-VIEW.w),y:clamp(p.y-VIEW.h/2,0,WORLD.h-VIEW.h)}}
export function advanceCamera(cam,target,dt){const k=1-Math.exp(-Math.max(0,dt)*10);return {x:cam.x+(target.x-cam.x)*k,y:cam.y+(target.y-cam.y)*k}}
export function makeRenderer(canvas){
 canvas.width=VIEW.w;canvas.height=VIEW.h;let g=canvas.getContext('2d');g.imageSmoothingEnabled=false;
 const terrain=document.createElement('canvas');terrain.width=WORLD.w;terrain.height=WORLD.h;let a=terrain.getContext('2d');
 let state=1989;const rand=()=>((state=Math.imul(state,1664525)+1013904223>>>0)/4294967296);
 const rect=(ctx,x,y,w,h,color)=>{ctx.fillStyle=color;ctx.fillRect(Math.round(x),Math.round(y),w,h)};
 const F=FIELD,mid=F.x+F.w/2,cy=F.y+F.h/2;
 rect(a,0,0,WORLD.w,WORLD.h,'#716d45');rect(a,12,16,WORLD.w-24,WORLD.h-32,'#798442');
 for(let i=0;i<14;i++)rect(a,F.x,F.y+i*40,F.w,40,i%2?'#72963b':'#7da141');
 for(let i=0;i<88000;i++){let x=F.x+Math.floor(rand()*F.w),y=F.y+Math.floor(rand()*F.h);rect(a,x,y,1,1,['#829c41','#6d9035','#779a3b','#8ba745'][Math.floor(rand()*4)])}
 for(let y of [F.y,F.y+F.h])for(let i=0;i<450;i++){let x=mid+(rand()-.5)*70,yy=y+(rand()-.5)*29;rect(a,x,yy,1,1,['#968d4a','#909148','#858b40'][Math.floor(rand()*3)])}
 a.strokeStyle='#eee9c9';a.lineWidth=1;a.strokeRect(F.x+.5,F.y+.5,F.w-1,F.h-1);a.beginPath();a.moveTo(F.x,cy+.5);a.lineTo(F.x+F.w,cy+.5);a.stroke();a.beginPath();a.arc(mid,cy,49,0,Math.PI*2);a.stroke();rect(a,mid-1,cy-1,3,3,'#f2eed0');
 // Scaled penalty areas match the adapter's full pitch projection.
 for(let side of [0,1]){let y=side?F.y+F.h:F.y,sign=side?-1:1;let boxY=side?y-87:y,smallY=side?y-29:y; a.strokeRect(mid-111+.5,boxY+.5,222,87);a.strokeRect(mid-52+.5,smallY+.5,104,29);rect(a,mid-1,y+sign*58-1,3,3,'#f2eed0');a.beginPath();a.arc(mid,y+sign*58,49,side?Math.PI*1.2:Math.PI*.2,side?Math.PI*1.8:Math.PI*.8);a.stroke();
 const gw=77,depth=17,gy=side?y:y-depth;rect(a,mid-gw/2+5,gy+6,gw+11,depth+7,'#40592c');rect(a,mid-gw/2,gy,gw,depth,'#506735');for(let k=0;k<=gw;k+=3)rect(a,mid-gw/2+k,gy,1,depth,'#b2bd86');for(let k=0;k<=depth;k+=3)rect(a,mid-gw/2,gy+k,gw,1,'#c3c99a');rect(a,mid-gw/2,gy,gw,2,'#f2eed7');rect(a,mid-gw/2,gy,2,depth,'#e6e1be');rect(a,mid+gw/2-2,gy,2,depth,'#e6e1be');}
 // Narrow touchline surrounds, no modern gradients.
 for(let x of [F.x-10,F.x+F.w+8]){rect(a,x,F.y-8,2,F.h+16,'#d1c5a0');for(let y=F.y;y<F.y+F.h;y+=24)rect(a,x-1,y,4,3,'#b2a687')}
 let camera=null,prior=new Map();
 function boards(){for(let x of [F.x-3,F.x+F.w]){rect(g,x-camera.x,F.y-camera.y,3,F.h,'#d3c9a4');}for(let y of [F.y-3,F.y+F.h]){rect(g,F.x-camera.x,y-camera.y,(F.w-77)/2,3,'#d3c9a4');rect(g,mid+38.5-camera.x,y-camera.y,(F.w-77)/2,3,'#d3c9a4');}}
 function sprite(p,x,y,angle,walking,frame){const kit=p.team===2?['#e4bc43','#9e762d','#f3dc7c']:p.side===0?['#c8422f','#883023','#f07846']:['#f0e4c4','#aaa790','#fff4d9'];const skin=['#c68a53','#e1af76','#9b623c'][p.id%3],hair=['#302a20','#644729','#382c20'][p.id%3];const dx=Math.sign(Math.cos(angle)),dy=Math.sign(Math.sin(angle)),side=Math.abs(Math.cos(angle))>.55,back=Math.sin(angle)<-.6,stride=walking?(frame%2?1:-1):0;
 if(p.sliding){
  // Native slide state, rendered as a low horizontal figure along travel.
  g.save();g.translate(x,y);g.rotate(angle);
  const P=(xx,yy,w,h,c)=>rect(g,xx,yy,w,h,c);
  P(-8,3,17,3,'#394f27');P(-8,-2,6,5,kit[0]);P(-7,-2,5,1,kit[2]);P(-3,-2,5,5,p.side===0?'#e1dcc2':'#244b8f');P(2,-2,6,2,skin);P(2,1,5,2,skin);P(7,-2,3,2,'#242b25');P(6,1,3,2,'#242b25');P(-11,-2,4,4,skin);P(-12,-3,3,5,hair);g.restore();return;
 }
 const R=(xx,yy,w,h,c)=>rect(g,x+xx,y+yy,w,h,c);
 R(-3,3,10,3,'#394f27');R(1,6,6,1,'#394f27');
 // Feet and legs change stride, with body orientation expressed by shoulder width and face placement.
 R(-3+dx*stride,2+dy*stride,2,4,skin);R(1-dx*stride,2-dy*stride,2,4,skin);R(-4+dx*stride,5+dy*stride,3,2,'#242b25');R(1-dx*stride,5-dy*stride,3,2,'#242b25');
 R(-3,-1,6,4,p.side===0?'#e1dcc2':'#244b8f');R(-3,2,6,1,'#32362b');
 R(side?-3:-4,-6,side?6:8,6,kit[0]);R(side?-3:-4,-5,2,4,kit[1]);R(0,-6,3,1,kit[2]);
 R(-5,-4+stride,2,3,skin);R(3,-4-stride,2,3,skin);
 R(-2,-10,5,5,hair);if(!back)R(side&&dx<0?-3:0,-8,3,3,skin);else R(-2,-6,4,1,skin);
 }
 function render(match,dt=.016){let target=cameraTarget(match.ball);camera=camera?advanceCamera(camera,target,dt):target;g.drawImage(terrain,Math.round(camera.x),Math.round(camera.y),VIEW.w,VIEW.h,0,0,VIEW.w,VIEW.h);
 if(match.profile!=='original')boards();
 const actors=match.actors.filter(p=>p.visible!==false).map(p=>({...p,...project(p.x,p.z)})).sort((p,q)=>p.y-q.y);
 for(let p of actors){let last=prior.get(p.id),dx=last?p.x-last.x:0,dy=last?p.y-last.y:0,moving=Math.hypot(dx,dy)>.12,angle=moving?Math.atan2(dy,dx):last?.angle??(p.side===0?-Math.PI/2:Math.PI/2);prior.set(p.id,{x:p.x,y:p.y,angle});sprite(p,Math.round(p.x-camera.x),Math.round(p.y-camera.y),angle,moving,p.frame)}
 let b=project(match.ball.x,match.ball.z),bx=Math.round(b.x-camera.x),by=Math.round(b.y-camera.y),height=Math.round(Math.max(0,match.ball.y-.4)*2);rect(g,bx+1,by+2,4,2,'#3d5428');rect(g,bx-1,by-height-1,3,3,'#fff9de');rect(g,bx+1,by-height+1,1,1,'#343a2b');
 }
 return {render,reset(){camera=null;prior.clear()}};
}
