// Generate the exact same browser ESM for Construct editor and native web export.
// The pinned upstream is acquired only at build time. No remote code at gameplay time.
import {execFileSync} from 'node:child_process';
import {mkdirSync,existsSync,readFileSync,writeFileSync,copyFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const upstream=resolve(root,'.cache/soccer-js'),pin='38970e0dade0865078c9e84bc1ecfd72aaa02fde';
const git=(...args)=>execFileSync('git',args,{cwd:upstream,stdio:['ignore','pipe','inherit'],encoding:'utf8'}).trim();
if(!existsSync(resolve(upstream,'.git'))){
 mkdirSync(upstream,{recursive:true});git('init','-q');git('remote','add','origin','https://github.com/haeretici/soccer-js.git');
}
let head='';try{head=git('rev-parse','--verify','HEAD');}catch{}
if(head!==pin){git('fetch','--depth=1','origin',pin);git('checkout','--detach','--force',pin);}
if(git('rev-parse','HEAD')!==pin)throw new Error('Soccer-JS revision mismatch');
// Permit the additional five-a-side preset only; retain the normal eleven-player path.
for(const file of ['kernel/providers/simulator/simulator.js','kernel/core/entities/team.js']){
 const original=git('show','HEAD:'+file);
 if(!original.includes('formation.length !== 11'))throw new Error('Upstream formation guard changed: '+file);
 writeFileSync(resolve(upstream,file),original.replace('formation.length !== 11','(formation.length !== 11 && formation.length !== 5)')+'\n');
}
// Five-a-side has no offside. Preserve the upstream eleven-a-side claim logic.
const playerPath='kernel/core/entities/player.js';
const playerOriginal=git('show','HEAD:'+playerPath);
if(!playerOriginal.includes('if (ball.offsideReceiver) {'))throw Error('Upstream offside claim changed');
let playerText=playerOriginal.replace('if (ball.offsideReceiver) {','if (!Settings.SUNDAY_NO_OFFSIDE && ball.offsideReceiver) {');
playerText=playerText.replace('function getPassReceiverPosition(teammate, carrier, level) {', `function getPassReceiverPosition(teammate, carrier, level) {
    if (Settings.SUNDAY_ATTACK) {
        const target = teammate.getIdleMoveTarget();
        // Aim at the actual run, not the unrelated eleven-a-side support grid.
        return {x: teammate.x * .75 + target.x * .25, y: teammate.y * .75 + target.y * .25};
    }`);
playerText=playerText.replace('const forwardStep = Utils.scaleFieldX(inAttackingHalf ? 12.5 : 7.8125)', `const forwardStep = Utils.scaleFieldX(Settings.SUNDAY_ATTACK ? (inAttackingHalf ? 15 : 13) : (inAttackingHalf ? 12.5 : 7.8125))`);
// Report actual contact outcomes, not AI intentions. The short settling
// window is only for the new profile and only after a clean received pass.
playerText=playerText.replace('const touch = applyFirstTouch(player, ball, { forceClean: ownPass });', `const incomingSpeed = Math.hypot(ball.vx || 0, ball.vy || 0);
    const receivedPass = !ownPass && ball.passFromX != null && ball.lastKicker && ball.lastKicker.team === player.team;
    const touch = applyFirstTouch(player, ball, { forceClean: ownPass });
    if (player.level?._telemetry?.onFirstTouch && !touch.skipped) {
        player.level._telemetry.onFirstTouch({ player, fumbled: touch.fumbled, control: touch.control, incomingSpeed, receivedPass: !!receivedPass });
    }
    if (Settings.SUNDAY_ZONES && receivedPass && !touch.fumbled) player.sundayTouchGrace = .10;`);
playerText=playerText.replace('if (isGkProtected(owner)) return false;', 'if (isGkProtected(owner)) return false;\n    if (Settings.SUNDAY_ZONES && owner.sundayTouchGrace > 0) return false;');
// Let the team-local first-touch settings actually apply on the new profile.
const touchFile='kernel/core/lib/first_touch.js';
let touchText=git('show','HEAD:'+touchFile);
touchText=touchText.replace('function aiNum(key, fallback) {', 'function aiNum(key, fallback, player) {\n    if (Settings.SUNDAY_ZONES && player?.team && typeof Settings.AI?.[player.team]?.[key] === "number") return Settings.AI[player.team][key];');
touchText=touchText.replace('function computeFumbleChance(control, ballSpeed) {','function computeFumbleChance(control, ballSpeed, player) {');
touchText=touchText.replace(/aiNum\(('FIRST_TOUCH_[A-Z_]+'), ([A-Z_]+)\)/g, 'aiNum($1, $2, player)');
touchText=touchText.replace('computeFumbleChance(control, speed);','computeFumbleChance(control, speed, player);');
writeFileSync(resolve(upstream,touchFile),touchText+'\n');
writeFileSync(resolve(upstream,playerPath),playerText+'\n');
// Opt-in compact-pitch decision changes; original profiles retain exact upstream logic.
const teamFile='kernel/core/entities/team.js';
let teamText=readFileSync(resolve(upstream,teamFile),'utf8');
function patch(src,from,to){if(!src.includes(from))throw Error('Missing pinned upstream patch: '+from);return src.replace(from,to);}
teamText=patch(teamText,'if (!isPassReceiverAhead(passer, teammate, passer.level)) continue;', 'if (!Settings.SUNDAY_EXPRESS && !isPassReceiverAhead(passer, teammate, passer.level)) continue;');
teamText=patch(teamText,'if (bestShortScore > shortBar) return bestShort;', 'if (bestShortScore > shortBar) return bestShort;\\n        if (Settings.SUNDAY_EXPRESS && bestShort && bestShortScore > 0) return bestShort;'.replace('\\n','\n'));
teamText=patch(teamText,'if (bestLongScore > longBar) return bestLong;', 'if (Settings.SUNDAY_EXPRESS && bestShortScore > shortBar && bestShortScore >= bestLongScore - 1) return bestShort;\\n        if (bestLongScore > longBar) return bestLong;'.replace('\\n','\n'));
teamText=patch(teamText,'let score = scorePassTarget(passer, teammate, aimDist, open);', `let score = scorePassTarget(passer, teammate, aimDist, open);
            if (Settings.SUNDAY_ATTACK) {
                const field = Utils.getFieldBounds();
                const forward = (oppGoalX > field.centerX ? 1 : -1);
                const gain = (aim.x - passer.x) * forward / field.width;
                const central = 1 - Math.min(1, Math.abs(aim.y - field.centerY) / (field.height * 0.5));
                const nearGoal = 1 - Math.abs(aim.x - oppGoalX) / field.width;
                score += Math.max(0, gain) * 14 + (nearGoal > .55 ? central * 6 : 0);
                if (open && nearGoal > .55) score += 4;
            }`);
teamText=patch(teamText,'const aimDetail = getBestPassToReceiver(from, teammate, passer, opponents, {', 'const aimDetail = getBestPassToReceiver(from, teammate, passer, opponents, { preferFeet: !!Settings.SUNDAY_ATTACK,');
teamText=patch(teamText,'if (score < 5) continue;', 'if (score < (Settings.SUNDAY_ATTACK ? 1 : 5)) continue;');
teamText=patch(teamText,'const passTypeOverride = opts.passType;', `if (Settings.SUNDAY_ATTACK && !opts.passType && passer.role !== 'GK') {
            // Five-a-side: evaluate compact, grounded combinations before the
            // full-pitch aerial-pass model. All lanes must be intercept-safe.
            const field = Utils.getFieldBounds();
            const sign = oppGoalX > field.centerX ? 1 : -1;
            let best = null, bestValue = -Infinity;
            const carrierClearance = Math.min(...opponents.filter(o=>!o.isSentOff&&o.role!=='GK').map(o=>Math.hypot(o.x-from.x,o.y-from.y)));
            const underPressure = carrierClearance < 3.0;
            const carrierDepth = 1-Math.abs(from.x-oppGoalX)/field.width;
            for (const mate of teammates) {
                if (mate === passer.lastPassFrom && passer.passLinkCooldown > 0) continue;
                const target = getPassReceiverPosition(mate, passer, passer.level);
                for (const aim of [{x:mate.x,y:mate.y},target]) {
                    const d = Math.hypot(aim.x-from.x, aim.y-from.y);
                    if (d < 2.0 || d > field.width*.43) continue;
                    const speed = estimatePassGroundSpeed(from, aim, passer, 'short');
                    if (!passSafeFromAllOpponents(from, aim, mate, opponents, speed)) continue;
                    const gain = (aim.x-from.x)*sign;
                    const depth = 1-Math.abs(aim.x-oppGoalX)/field.width;
                    // In the build-up phase, hold and carry rather than repeatedly recycling unpressured possession.
                    if (carrierDepth < .67 && !underPressure && gain < field.width*.055) continue;
                    const central = 1-Math.abs(aim.y-field.centerY)/(field.height*.5);
                    const clearance = Math.min(...opponents.filter(o=>!o.isSentOff).map(o=>Math.hypot(o.x-aim.x,o.y-aim.y)));
                    const entersFinalThird = carrierDepth < .67 && depth >= .67;
                    const value = gain*1.55 + Math.min(6,clearance)*.68 + (depth>.60?central*4:0) + (entersFinalThird?7:0) - d*.12;
                    if (value>bestValue) {bestValue=value;best={teammate:mate,type:'short',aim,progressive:gain,lineBreak:false};}
                }
            }
            if (best && bestValue>0) return best;
            // No safe progressive option: do not fall back to a random aerial
            // or backward ball while the carrier has room to advance.
            if (!underPressure && carrierDepth < .67) return null;
        }
        const passTypeOverride = opts.passType;`);
writeFileSync(resolve(upstream,teamFile),teamText);
const outfieldFile='kernel/core/entities/player_states_outfield.js';
let outfield=git('show','HEAD:'+outfieldFile);
outfield=patch(outfield,'target.passLinkCooldown = 1.4 + Math.random() * 0.6;', 'target.passLinkCooldown = Settings.SUNDAY_EXPRESS ? 0.35 + Math.random() * 0.2 : 1.4 + Math.random() * 0.6;');
writeFileSync(resolve(upstream,outfieldFile),outfield+'\n');
// Shape mode still uses upstream player FSMs and physics. Restrict chasing to
// a single stable assignment per side; retain intentional pass receivers.
const simFile='kernel/providers/simulator/simulator.js';
let simText=readFileSync(resolve(upstream,simFile),'utf8');
simText=patch(simText,'const chasers = this.getActiveChasers();','const chasers = this.getActiveChasers();');
simText=patch(simText,"        for (const p of this.players) {\n            if (p.isSentOff) continue;\n            // Manual avatar: state + movement owned by manual_control / human gates","        if (Settings.SUNDAY_SHAPE && this.shapeChasers) {\n            chasers.clear();\n            for (const p of this.shapeChasers()) chasers.add(p);\n        }\n        for (const p of this.players) {\n            if (p.isSentOff) continue;\n            // Manual avatar: state + movement owned by manual_control / human gates");
writeFileSync(resolve(upstream,simFile),simText);
outfield=patch(outfield,'const target = p.supportTarget || p.getIdleMoveTarget();','const target = Settings.SUNDAY_SHAPE ? p.getIdleMoveTarget() : (p.supportTarget || p.getIdleMoveTarget());');
outfield=patch(outfield,'if (!ball || p.receiveTimer <= 0) {','if (!ball || p.receiveTimer <= 0 || (Settings.SUNDAY_SHAPE && ball.owner && ball.owner !== p)) {');
outfield=patch(outfield,'if (distToGoal < getShootRange(p)) {','if (distToGoal < getShootRange(p) && (!Settings.SUNDAY_ATTACK || Math.abs(p.y - field.centerY) < field.height * .38 || distToGoal < field.width * .12)) {');
writeFileSync(resolve(upstream,outfieldFile),outfield+'\n');
// Prefer a real safe final ball if a teammate has a better shooting position.
// Use the existing pass state: no forced completion or scripted goal.
outfield=patch(outfield,'if (distToGoal < getShootRange(p)', `if (Settings.SUNDAY_ATTACK && distToGoal < field.width * .58 && p.passLinkCooldown <= 0) {
                    const option = p.findBestPassTarget();
                    if (option && option.type === 'short' && option.teammate) {
                        const t = option.teammate;
                        const gain = distToGoal - Math.abs(t.x - targetGoalX);
                        const central = Math.abs(t.y - field.centerY) < field.height * .27;
                        if (central && gain > field.width * .025 && Math.abs(t.x - targetGoalX) < field.width * .33) {
                            p.passTarget = t; p.passType = option.type; p.passAim = option.aim || null;
                            p.fsm.changeState(PlayerStates.Pass); return;
                        }
                    }
                }
                if (distToGoal < getShootRange(p)`);
outfield=patch(outfield,'const tryShoot = willingness >= 1 || Math.random() < willingness;', 'const tryShoot = (Settings.SUNDAY_ATTACK && p.passLinkCooldown > 0 && p.lastPassFrom && distToGoal < field.width * .30) || willingness >= 1 || Math.random() < willingness;');
outfield=patch(outfield,'const passChance = computeDribblePassChance(p, threat);','const passChance = Settings.SUNDAY_ATTACK ? Math.max(computeDribblePassChance(p, threat), threat.threatened ? .68 : .26) : computeDribblePassChance(p, threat);');
// The intent director chooses an action at the normal decision gate. Keep
// upstream physics and pass/shot FSMs; do not force possession or scoring.
outfield=patch(outfield,'const distToGoal = Math.abs(p.x - targetGoalX);', `const distToGoal = Math.abs(p.x - targetGoalX);
                if (Settings.SUNDAY_INTENT && p.level.sundayPossessionDecision) {
                    const team = getTeamEntity(p);
                    const pass = p.findBestPassTarget();
                    const shot = distToGoal < field.width*.31 && team && typeof team.canShoot === 'function' ? team.canShoot({x:p.x,y:p.y},p) : null;
                    const action = p.level.sundayPossessionDecision(p,{pass,shot,threat});
                    if (action==='shoot' && shot?.ok) {
                        p.shotAim=shot.target;
                        p.fsm.changeState(PlayerStates.Shoot);return;
                    }
                    if (action==='pass' && pass?.teammate) {
                        p.passTarget=pass.teammate;p.passType=pass.type;p.passAim=pass.aim||null;
                        p.fsm.changeState(PlayerStates.Pass);return;
                    }
                    return;
                }`);
// Use the native slide FSM, but record every launch (including misses)
// separately from the actual tackle contact roll.
outfield=patch(outfield,'p.isSliding = true;\n                        p.slideTimer = 0.65;', `p.isSliding = true;
                        p.slideTimer = 0.65;
                        p.level?._telemetry?.onSlideStarted?.({player:p});`);
writeFileSync(resolve(upstream,outfieldFile),outfield+'\n');
// The pass predictor and actual kick share this function. Crisp ground
// passes on the compact pitch must use the same speed in both places.
const safetyFile='kernel/core/lib/pass_safety.js';
let safety=git('show','HEAD:'+safetyFile);
safety=patch(safety,'return v0;', "return Settings.SUNDAY_ATTACK && !isLong ? Math.min(22, v0 * 1.22) : v0;");
writeFileSync(resolve(upstream,safetyFile),safety+'\n');
// Keep the native restart countdown, wall contact and kick FSM. Correct the
// selected taker and attacking end, and prefer short restarts outside range.
const resumeFile='kernel/providers/simulator/set_piece_resume.js';
let resume=git('show','HEAD:'+resumeFile);
resume=patch(resume,'function resolveSetPieceTaker(sim, resumeType) {', `function resolveSetPieceTaker(sim, resumeType) {
  if (resumeType === 'freekick' && sim.sundayFreekickTaker && !sim.sundayFreekickTaker.isSentOff) return sim.sundayFreekickTaker;`);
resume=patch(resume,"const { PlayerStates } = require('../../core/entities/player.js');", `const { PlayerStates } = require('../../core/entities/player.js');
const { isPassSafeFromAllOpponents, estimatePassGroundSpeed } = require('../../core/lib/pass_safety.js');`);
const fkStart=resume.indexOf("} else if (resumeType === 'freekick') {");
const fkEnd=resume.indexOf("} else if (resumeType === 'throwin') {",fkStart);
if(fkStart<0||fkEnd<0)throw Error('Pinned free-kick branch missing');
let fk=resume.slice(fkStart,fkEnd);
fk=patch(fk,"const gx = (defendingTeam === 'A') ? 0 : field.width;", `const compact = !!sim.sundayFreekickPlan;
    const gx = compact ? ((sim.isSecondHalf() ? taker.team === 'B' : taker.team === 'A') ? field.width : 0) : (defendingTeam === 'A' ? 0 : field.width);`);
fk=patch(fk,'if (!isIndirect && distToGoal < shootRange) {','if (!isIndirect && distToGoal < shootRange && (!compact || sim.sundayFreekickPlan.direct)) {');
fk=patch(fk,'willShoot = freekickShouldShoot(playbook, !!(shotResult && shotResult.ok), distToGoal, shootRange);','willShoot = compact ? !!shotResult?.ok : freekickShouldShoot(playbook, !!(shotResult && shotResult.ok), distToGoal, shootRange);');
fk=patch(fk,"let passType = kickPrefs.passType === 'long' ? 'long' : 'short';","let passType = !compact && kickPrefs.passType === 'long' ? 'long' : 'short';");
fk=patch(fk,"if (!target && passType === 'short') {","if (!target && passType === 'short' && !compact) {");
fk=patch(fk,'let target = null;', `let target = null;
      let compactAim = null;
      if (compact) {
        const from = {x:taker.x,y:taker.y};
        const opponents = squad?.getOpponentPool?.() || sim.players.filter(p=>p.team!==taker.team&&!p.isSentOff);
        const options = teammatesList.map(p=>{
          const aim={x:p.x,y:p.y};
          const distance=Math.hypot(p.x-from.x,p.y-from.y);
          const speed=estimatePassGroundSpeed(from,aim,taker,'short');
          const safe=isPassSafeFromAllOpponents(from,aim,p,opponents,speed);
          const clearance=Math.min(...opponents.map(o=>Math.hypot(o.x-p.x,o.y-p.y)));
          return {p,aim,safe,score:Math.min(8,clearance)*.4-distance+(safe?100:0)};
        }).sort((a,b)=>b.score-a.score);
        if(options.length){target=options[0].p;compactAim=options[0].aim;}
      }`);
fk=patch(fk,"if (squad && typeof squad.pickBestSafePassTarget === 'function') {","if (!compact && squad && typeof squad.pickBestSafePassTarget === 'function') {");
fk=patch(fk,"taker.passAim = (squad && typeof squad.getBestPassToReceiver === 'function')","taker.passAim = compact ? compactAim : (squad && typeof squad.getBestPassToReceiver === 'function')");
fk=patch(fk,'} else if (isIndirect) {','} else if (isIndirect || compact) {');
fk += `  if (sim.sundayOnFreekickChoice) {
      const shooting = taker.fsm.getNameOfCurrentState().toLowerCase() === 'shoot';
      sim.sundayOnFreekickChoice(shooting ? 'shoot' : 'pass', taker.team, shooting ? taker.shotAim : taker.passAim);
    }
  `;
resume=resume.slice(0,fkStart)+fk+resume.slice(fkEnd);
writeFileSync(resolve(upstream,resumeFile),resume+'\n');
const adapter=resolve(upstream,'sunday-adapter.js');
copyFileSync(resolve(root,'scripts/engine-evaluation/soccer-adapter.js'),adapter);
copyFileSync(resolve(root,'scripts/engine-evaluation/five-tactics.js'),resolve(upstream,'five-tactics.js'));
copyFileSync(resolve(root,'scripts/engine-evaluation/possession-intent.js'),resolve(upstream,'possession-intent.js'));
const license=readFileSync(resolve(upstream,'LICENSE'),'utf8');
const entry="export {createSoccerMatch,SOCCER_STEP,CHIPS,chipOffers,RELOAD_COST} from "+JSON.stringify(adapter)+";\nexport {AUTO_TRAITS} from "+JSON.stringify(resolve(root,'src/engine.js'))+";";
const result=await build({stdin:{contents:entry,resolveDir:root,sourcefile:'sunday-soccer-entry.js'},bundle:true,platform:'browser',format:'esm',target:'es2022',minify:true,write:false,legalComments:'inline',banner:{js:'/* Generated SUNDAY Soccer-JS bundle; upstream '+pin+'\\n'+license.replaceAll('*/','* /')+'\\n*/'}});
const bytes=result.outputFiles[0].contents;
for(const path of ['construct/scripts/engine.js','public/construct/scripts/project/engine.js'])writeFileSync(resolve(root,path),bytes);
mkdirSync(resolve(root,'public/licenses'),{recursive:true});writeFileSync(resolve(root,'public/licenses/soccer-js.txt'),license);
console.log('Bundled pinned Soccer-JS '+pin.slice(0,8)+': '+bytes.length+' bytes');
