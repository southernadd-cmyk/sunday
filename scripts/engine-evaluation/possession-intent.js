// Original SUNDAY possession policy. Uses normalised pitch geometry only.
// A plan persists through the possession; decisions are made at the existing
// engine kick-decision interval, never at render frame rate.
export const INTENTS=['build','progress','combine','beat','finish','recover'];
export function possessionIntent(previous,ctx){
 const {depth,central,pressure,forwardPass,clearShot,isolated,backwardPass}=ctx;
 // Immediate danger or a genuine shot overrides the current assignment.
 if(clearShot&&depth>=.70&&central>=.45)return 'finish';
 if(pressure&& !forwardPass && !isolated && backwardPass)return 'recover';
 // Hysteresis prevents a player hovering on a boundary changing jobs repeatedly.
 if(previous==='build'&&depth<.36)return 'build';
 if(previous==='combine'&&depth>.53&&depth<.76&&forwardPass)return 'combine';
 if(depth<.30)return 'build';
 if(isolated&&pressure&&!forwardPass&&depth<.76)return 'beat';
 if(depth>=.60&&forwardPass)return 'combine';
 return 'progress';
}
export function possessionAction(intent,ctx){
 if(intent==='finish'&&ctx.clearShot)return 'shoot';
 if(ctx.forwardPass&&(intent==='build'||intent==='combine'||ctx.pressure||ctx.breaksLine))return 'pass';
 if(intent==='recover'&&ctx.backwardPass)return 'pass';
 if(intent==='progress'&&ctx.forwardPass&&ctx.breaksLine)return 'pass';
 if(intent==='beat')return 'carry';
 if(ctx.clearShot&&ctx.depth>=.78)return 'shoot';
 return 'carry';
}
