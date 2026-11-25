import {test} from 'node:test';
import assert from 'node:assert/strict';
import {MatchRun,HOME_IDS,isHome,clone,distance} from '../src/engine.js';
const make=()=>{const r=new MatchRun(71);r.start();return r;};
function setBall(r,id,x,z){Object.assign(r.state.actors[id],{x,z});r.state.ballOwner=id;r.state.ball={x:x+.5,z:z-1,y:.6};r.intents=r.makeIntents();}
test('losing the ball is a playable turnover, not a life loss',()=>{
 const r=make(),s=r.state;Object.assign(s.actors[7],{x:s.ball.x,z:s.ball.z});r.intents=r.makeIntents();
 const o={kind:'hold',actor:0};assert.equal(r.preview(o).type,'turnover');const result=r.commit(o);
 assert.equal(result.type,'turnover');assert.ok(r.defending);assert.equal(r.phase,'planning');assert.equal(r.lives,3);assert.ok(r.threat);
});
test('a tackle wins possession where it happens and opens counter turns',()=>{
 const r=make();r.kickoff(false);setBall(r,7,0,20);
 for(const id of HOME_IDS)Object.assign(r.state.actors[id],{x:25,z:-20});
 Object.assign(r.state.actors[4],{x:.5,z:19});r.intents=r.makeIntents();
 r.threat={kind:'dribble',from:{...r.state.ball},target:{...r.state.ball},owner:7};r.intents[7]={...r.state.actors[7]};
 assert.notEqual(r.preview({kind:'hold',actor:4}).type,'regain');
 const o={kind:'tackle',actor:4,tackle:'stand',tackleAt:.5,path:[]};
 const before=clone(r.state),p=r.preview(o);assert.equal(p.type,'regain');assert.deepEqual(r.state,before);
 const out=r.commit(o);assert.equal(out.type,'regain');assert.ok(isHome(r.state.ballOwner));assert.equal(r.state.counter,2);assert.equal(r.regains,1);assert.equal(r.lives,3);
 assert.ok(r.rewind());assert.deepEqual(r.state,before);assert.equal(r.regains,0);assert.ok(r.defending);
});
test('a goal starts a real opponent possession and does not instantly win',()=>{
 const r=make();for(const id of [7,8,9,10,11,12,13,14])Object.assign(r.state.actors[id],{x:-30,z:-20});
 setBall(r,1,4,-37);const o={kind:'shot',actor:1,target:{x:5.7}};
 assert.equal(r.preview(o).type,'goal');r.commit(o);assert.equal(r.state.scoreFor,1);assert.equal(r.phase,'planning');assert.ok(r.defending);assert.equal(r.bank,0);
});
test('full-time win, clean sheet rewards and defensive upgrade draft',()=>{
 const r=make();r.state.scoreFor=1;r.state.beats=1;r.state.defended=true;
 const result=r.commit({kind:'hold',actor:0});assert.notEqual(result.type,'invalid');
 assert.equal(r.phase,'goal');assert.equal(r.goals,1);assert.equal(r.bank,25);assert.ok(r.continue());assert.equal(r.phase,'pickup');
 assert.equal(new Set(r.offers).size,3);assert.ok(r.offers.some(x=>['press','counter','gloves'].includes(x)));
 const id=r.offers.find(x=>['press','counter','gloves'].includes(x));assert.ok(r.collect(id));assert.ok(r.defending);assert.equal(r.fixtureIndex,1);assert.ok(r.buffs[id]>0);
});
test('conceding changes the score and continues until full time',()=>{
 const r=make();r.kickoff(false);for(const id of HOME_IDS)Object.assign(r.state.actors[id],{x:25,z:15});setBall(r,7,-4,34);
 const o={kind:'hold',actor:0};assert.equal(r.threat.kind,'shot');assert.equal(r.preview(o).type,'conceded');r.commit(o);
 assert.equal(r.state.scoreAgainst,1);assert.equal(r.lives,3);assert.equal(r.phase,'planning');assert.ok(!r.defending);
 r.state.beats=1;r.commit({kind:'hold',actor:r.selection()});assert.equal(r.phase,'setback');assert.equal(r.lives,2);
 assert.ok(r.rewind());assert.equal(r.lives,3);assert.equal(r.phase,'planning');
});
test('level at full time grants one extra-time period, not an endless match',()=>{
 const r=make();r.state.beats=1;r.commit({kind:'hold',actor:0});assert.equal(r.state.beats,6);assert.equal(r.state.extra,true);
 r.state.beats=1;r.commit({kind:'hold',actor:r.selection()});assert.equal(r.phase,'setback');
});

test('timed passes reach different points on a moving receiver route at the exact frame',()=>{
 const r=make();for(const id of [7,8,9,10,11,12,13,14])Object.assign(r.state.actors[id],{x:32,z:-42});
 setBall(r,0,0,0);Object.assign(r.state.actors[1],{x:8,z:0});r.intents=r.makeIntents();
 const order=time=>({kind:'pass',actor:0,ally:1,path:[],support:{1:[{x:8,z:-11}]},receiveAt:time});
 const early=r.preview(order(.5)),late=r.preview(order(1.5));assert.ok(early.valid&&late.valid);assert.ok(late.delivery.target.z<early.delivery.target.z);
 assert.equal(early.delivery.receiveStep,15);assert.equal(late.delivery.receiveStep,45);
 assert.ok(early.delivery.speed<=38&&late.delivery.speed<=38);
 const before=clone(r.state),result=r.commit(order(1.5)),o=45*43;
 assert.equal(result.type,'move');assert.equal(result.end.ballOwner,1);
 assert.ok(Math.abs(result.frames[o+40]-(result.frames[o+2]+.5))<1e-5);
 assert.ok(Math.abs(result.frames[o+41]-(result.frames[o+3]-1))<1e-5);
 assert.ok(r.rewind());assert.deepEqual(r.state,before);
});
test('impossible early delivery is rejected rather than teleporting the ball',()=>{
 const r=make();setBall(r,0,0,0);Object.assign(r.state.actors[1],{x:30,z:0});r.intents=r.makeIntents();
 assert.equal(r.preview({kind:'pass',actor:0,ally:1,path:[],receiveAt:.5}).valid,false);
});
function dribbleFixture(x,z){
 const r=make();r.kickoff(false);for(const id of HOME_IDS)Object.assign(r.state.actors[id],{x:28,z:-24});
 setBall(r,7,0,15);Object.assign(r.state.actors[4],{x,z});r.intents=r.makeIntents();
 r.intents[7]={...r.state.actors[7]};r.threat={kind:'dribble',from:{...r.state.ball},target:{...r.state.ball},owner:7};
 return r;
}
test('slide from behind fouls; free kick and recovery are deterministic and rewindable',()=>{
 const r=dribbleFixture(0,12.8),before=clone(r.state),order={kind:'tackle',actor:4,tackle:'slide',tackleAt:1,path:[]};
 assert.equal(r.preview(order).type,'foul');const out=r.commit(order);assert.equal(out.type,'foul');assert.ok(r.defending);assert.equal(r.state.freeKick,true);assert.equal(r.state.fouls,1);assert.equal(r.state.tackleRecovery[4],1);
 assert.equal(r.preview(order).valid,false);assert.notEqual(r.threat.kind,'dribble');
 assert.ok(r.rewind());assert.deepEqual(r.state,before);
});
test('a missed challenge leaves possession with the opponent and triggers recovery',()=>{
 const r=dribbleFixture(12,12),o={kind:'tackle',actor:4,tackle:'stand',tackleAt:.5,path:[]};
 const p=r.preview(o);assert.ok(p.valid);assert.equal(p.tackleOutcome,'miss');const out=r.commit(o);
 assert.equal(out.type,'move');assert.equal(r.state.ballOwner,7);assert.equal(r.state.tackleRecovery[4],1);
 assert.equal(r.preview(o).valid,false);
});
test('a side-on slide reaches farther than a standing tackle',()=>{
 const r=dribbleFixture(3.8,14),o={kind:'tackle',actor:4,tackleAt:1,path:[]};
 assert.equal(r.preview({...o,tackle:'stand'}).tackleOutcome,'miss');
 assert.equal(r.preview({...o,tackle:'slide'}).type,'regain');
});
