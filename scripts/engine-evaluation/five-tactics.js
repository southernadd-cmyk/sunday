// Original SUNDAY five-a-side tactical board. No SWOS data or source imported.
// Coordinates are normalised in the team's attacking direction, x=depth, y=width.
// Seven depth bands x five lateral lanes. Each cell assigns four distinct roles.
export const ROLES=['CB','LM','RM','CF'];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,t)=>a+(b-a)*t;
// Authored depth anchors for build-up, middle third, and final-third support.
// Rows correspond to the seven ball depth bands; columns CB, LM, RM, CF.
const DEPTH={
 attack:[[.12,.29,.33,.46],[.18,.38,.42,.55],[.25,.48,.52,.65],[.34,.58,.62,.75],[.42,.68,.72,.84],[.49,.75,.80,.90],[.55,.77,.86,.93]],
 defend:[[.10,.18,.18,.34],[.12,.22,.22,.37],[.17,.30,.30,.44],[.23,.38,.38,.52],[.31,.46,.46,.60],[.39,.54,.54,.68],[.47,.62,.62,.76]],
};
const LANES=[.10,.30,.50,.70,.90];
function cell(mode,row,col){
 const y=LANES[col],left=y<.5,right=y>.5,depth=DEPTH[mode][row],att=mode==='attack';
 // Ball-side outlet + far-side runner, central pivot, and deepest rest defender.
 const wing=(isLeft,i)=>{
  const near=isLeft?left:right, far=isLeft?right:left;
  const x=depth[i]+(att?(far?.035:near?-.025:0):(near?-.025:0));
  const lat=isLeft?(near?.21:.25):(near?.79:.75);
  return [clamp(x,.08,.94),lat];
 };
 return {CB:[depth[0],.5+(y-.5)*.22],LM:wing(true,1),RM:wing(false,2),CF:[depth[3],.5+(y-.5)*(att?-.24:.18)]};
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
