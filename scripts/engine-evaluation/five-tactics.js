// Original SUNDAY five-a-side tactical board. No SWOS data or source imported.
// Coordinates are normalised in the team's attacking direction, x=depth, y=width.
// Seven depth bands x five lateral lanes. Each cell assigns four distinct roles.
export const ROLES=['CB','LM','RM','CF'];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,t)=>a+(b-a)*t;
// Authored depth anchors for build-up, middle third, and final-third support.
// Rows correspond to the seven ball depth bands; columns CB, LM, RM, CF.
const DEPTH={
 attack:[[.12,.24,.24,.48],[.12,.28,.28,.48],[.13,.36,.36,.58],[.27,.49,.49,.72],[.41,.63,.63,.86],[.55,.72,.72,.91],[.57,.78,.78,.91]],
 defend:[[.12,.22,.22,.40],[.12,.22,.22,.40],[.13,.23,.23,.48],[.26,.37,.37,.62],[.40,.51,.51,.76],[.55,.65,.65,.88],[.57,.78,.78,.88]],
};
const LANES=[.10,.30,.50,.70,.90];
function cell(mode,row,col){
 const y=LANES[col],left=y<.5,right=y>.5,depth=DEPTH[mode][row],att=mode==='attack',ballDepth=(row+.5)/7;
 // Distinct near/far outlets avoid forming a flat line across the pitch.
 // As the ball advances, keep one player behind the carrier and one ahead.
 const wing=(isLeft,i)=>{
  const near=isLeft?left:right,far=isLeft?right:left;
  let x=depth[i],lat=isLeft?.20:.80;
  if(att){
   if(far){x=clamp(ballDepth+.18,.40,.86);lat=isLeft?.30:.70;}
   else if(near){x=clamp(ballDepth-.055,.22,.82);lat+=(y-.5)*.10;}
   else{x=clamp(ballDepth+.065,.22,.78);}
  }else{lat+=(y-.5)*.12;}
  return [clamp(x,.08,.94),lat];
 };
 return {CB:[depth[0],.5+(y-.5)*.30],LM:wing(true,1),RM:wing(false,2),CF:[depth[3],att?.5-(y-.5)*.20:.5+(y-.5)*.20]};
}
export const TACTICAL_MAP=Object.freeze(Object.fromEntries(['attack','defend'].map(mode=>[mode,Object.freeze(Array.from({length:7},(_,row)=>Object.freeze(Array.from({length:5},(_,col)=>Object.freeze(Object.fromEntries(Object.entries(cell(mode,row,col)).map(([role,xy])=>[role,Object.freeze(xy)])))))))])));
export function tacticalTarget(role,mode,depth,lateral){
 if(!ROLES.includes(role))throw Error('Unknown outfield role '+role);
 const map=TACTICAL_MAP[mode];if(!map)throw Error('Unknown tactical phase '+mode);
 const x=clamp(depth*7-.5,0,6),y=clamp(lateral*5-.5,0,4);
 const a=Math.floor(x),b=Math.floor(y),c=Math.min(6,a+1),d=Math.min(4,b+1);
 return [0,1].map(k=>lerp(lerp(map[a][b][role][k],map[c][b][role][k],x-a),lerp(map[a][d][role][k],map[c][d][role][k],x-a),y-b));
}
// Assignments are persistent team intentions, not ball-driven role swaps.
// The pivot threatens depth; ball-side wing offers a diagonal; far wing runs.
// A defender is always available to recycle or protect a turnover.
export function tacticalAssignment(role,mode,depth,lateral){
 const [x,y]=tacticalTarget(role,mode,depth,lateral);
 const near=role==='LM'?lateral<=.5:role==='RM'?lateral>=.5:false;
 const action=mode==='defend'?(role==='CB'?'cover':role==='CF'?'screen':'track'):role==='CB'?'recycle':role==='CF'?'threaten':near?'support':'run';
 return {x,y,action};
}

// Team-specific tactical systems. The original diamond is exactly unchanged.
// Depths/lateral coordinates are relative to the team's attacking direction.
// Roles are slots, not fixed real-world positions; movement uses engine steering.
export const SYSTEMS=Object.freeze({
 diamond:Object.freeze({name:'Diamond possession',formation:'1-2-1',description:'Balanced triangles and forward combinations',press:null,shotDepth:.69,shotCentral:.42,passGain:.035,lineGain:.13}),
 press:Object.freeze({name:'High press',formation:'1-1-2',description:'Advanced pressure and quick attacks; space behind the press',press:.55,shotDepth:.69,shotCentral:.42,passGain:.025,lineGain:.09}),
 counter:Object.freeze({name:'Counter-attack',formation:'2-1-1',description:'Deep cover with a high outlet and quick forward breaks',press:.23,shotDepth:.70,shotCentral:.42,passGain:.07,lineGain:.10}),
 wide:Object.freeze({name:'Wide play',formation:'1-2-1',description:'Stretch the pitch and combine from wide channels',press:.38,shotDepth:.73,shotCentral:.52,passGain:.015,lineGain:.10}),
 direct:Object.freeze({name:'Direct football',formation:'2-2',description:'Two forward outlets, progressive passes and earlier shots',press:.40,shotDepth:.69,shotCentral:.30,passGain:.06,lineGain:.07}),
 rotation:Object.freeze({name:'Rotational football',formation:'Fluid diamond',description:'Ball-side overlaps and a pivot dropping into space',press:.40,shotDepth:.71,shotCentral:.45,passGain:.02,lineGain:.10})
});
export function resolveSystem(id='diamond'){
 if(!Object.hasOwn(SYSTEMS,id))throw Error('Unknown tactical system: '+id);
 return SYSTEMS[id];
}
export function systemAssignment(id,role,mode,depth,lateral){
 resolveSystem(id);
 const base=tacticalAssignment(role,mode,depth,lateral);
 if(id==='diamond')return base;
 const attack=mode==='attack',left=role==='LM',wing=left||role==='RM',near=left?lateral<=.5:lateral>=.5;
 const lane=left?.20:.80;
 let {x,y,action}=base;
 if(id==='press'){
  if(role==='CB'){x+=attack?.05:.09;action='high-cover';}
  if(role==='CF'){x+=.045;y=.70;action=attack?'high-outlet':'press-screen';}
  if(role==='LM'){x+=.12;y=.30;action=attack?'high-outlet':'press-screen';}
  if(role==='RM'){x=depth-.05;y=.52;action=attack?'link':'screen';}
 }else if(id==='counter'){
  if(role==='CB'){x-=.06;y=.30;action='cover';}
  if(role==='LM'){x=depth-(attack?.21:.27);y=.70;action='cover';}
  if(role==='RM'){x=depth+(attack?.07:-.12);y=.52;action=attack?'release':'screen';}
  if(role==='CF'){x=depth+(attack?.28:.13);action='break-outlet';}
 }else if(id==='wide'){
  if(wing){y=left?.09:.91;x=depth+(attack?(near?.08:.16):-.10);action=attack?'wide-outlet':'track';}
  if(role==='CF'){x+=.04;y=.50;action='central-target';}
 }else if(id==='direct'){
  if(role==='CB'||role==='LM'){x=depth-.23;y=role==='CB'?.28:.72;action='cover';}
  else{x=depth+(attack?.22:.10);y=role==='RM'?.30:.70;action=attack?'direct-outlet':'screen';}
 }else if(id==='rotation'&&attack){
  // Ball-side wing overlaps; the pivot drops diagonally to fill the vacated
  // support slot. Far wing provides width and defender retains cover.
  if(wing&&near){x=depth+.19;y=lane;action='overlap';}
  if(wing&&!near){x=depth+.10;y=lane;action='wide-outlet';}
  if(role==='CF'){x=depth+.025;y=lateral<.5?.65:.35;action='drop-link';}
 }
 return {x:clamp(x,.09,.92),y:clamp(y,.08,.92),action};
}
export function systemCanPress(id,{hasOpponentOwner,distance,depth}){
 const config=resolveSystem(id);
 // Always contest loose balls. Containment only changes off-ball pursuit
 // against an owner, never tackles, speed or possession rules.
 if(!hasOpponentOwner||config.press===null)return true;
 return distance<=config.press||depth<.30;
}

// Compact-pitch free kicks. Inputs/outputs use real field units, with x
// increasing towards the opposition goal. A 5m restart exclusion is a SUNDAY
// house rule; goalkeepers stay in their own goal and are not wall members.
export function freeKickLayout({width,height,x,y,attackers,defenders,indirect=false}){
 const margin=.65,clearance=5,depth=x/width,centre=height/2;
 const bound=(a,b)=>({x:clamp(a,margin,width-margin),y:clamp(b,margin,height-margin)});
 const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
 const ball={x,y},goal={x:width,y:centre};
 const goalDist=distance(ball,goal);
 const direct=!indirect&&depth>.65&&Math.abs(y-centre)<height*.33&&goalDist<width*.36;
 const nx=(width-x)/Math.max(.001,goalDist),ny=(centre-y)/Math.max(.001,goalDist);
 const used=[];
 // Prefer distinct outlets: a short inward diagonal, a forward runner and
 // a safety outlet. Never pile them onto the taker or each other.
 const inward=y<centre?1:-1;
 // Put two playable outlets INSIDE the defenders' exclusion radius.
 // The third attacker offers depth. Short restarts should be a two/three
 // metre pass, not a lead ball into a marked player's running lane.
 const targets=[
  [x+1.7,y+inward*2.2,'short-outlet'],
  [x-2.6,y-inward*.5,'safety-outlet'],
  [x+width*.18,centre-inward*height*.20,'forward-outlet']
 ];
 const attack=attackers.map((id,i)=>{
  const [tx,ty,action]=targets[i%targets.length];
  const desired=bound(tx,ty),choices=[desired];
  for(const radius of i<2?[2.7,3.2,3.6]:[6,8,10])for(let j=0;j<24;j++){
   const angle=j*Math.PI/12;choices.push(bound(x+Math.cos(angle)*radius,y+Math.sin(angle)*radius));
  }
  const legal=choices.filter(p=>distance(p,ball)>2.2&&(i>=2||distance(p,ball)<3.8)&&used.every(q=>distance(p,q)>2.1));
  legal.sort((a,b)=>distance(a,desired)-distance(b,desired));
  const p=legal[0]||desired;used.push(p);
  return {id,...p,action};
 });
 const walls=direct&&goalDist>clearance+1?Math.min(2,Math.max(0,defenders.length-2)):0;
 const wall=[];
 for(let i=0;i<walls;i++){
  const offset=(i-(walls-1)/2)*1.05;
  const p=bound(x+nx*(clearance+.15)-ny*offset,y+ny*(clearance+.15)+nx*offset);
  if(distance(p,ball)>=clearance-.01){wall.push({id:defenders[i],...p,action:'wall'});used.push(p);}
 }
 const defend=defenders.filter(id=>!wall.some(p=>p.id===id)).map((id,i)=>{
  const mark=attack[i%Math.max(1,attack.length)]||{x:x+width*.15,y:centre};
  const target=bound(mark.x+width*.07,mark.y);
  const candidates=[target];
  // Search legal nearby positions rather than clamping a radial push back
  // inside the exclusion radius at a board or goal line.
  for(const radius of [clearance+.15,clearance+2,clearance+5])for(let j=0;j<24;j++){
   const a=j*Math.PI/12;candidates.push(bound(x+Math.cos(a)*radius,y+Math.sin(a)*radius));
  }
  const legal=candidates.filter(p=>distance(p,ball)>=clearance-.01&&used.every(q=>distance(p,q)>1.1));
  legal.sort((a,b)=>distance(a,target)-distance(b,target));
  const p=legal[0]||bound(width-margin,i%2?height*.8:height*.2);used.push(p);
  return {id,...p,action:'mark'};
 });
 return {direct,clearance,attack,wall,defend};
}
