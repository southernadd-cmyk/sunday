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
 Object.assign(r.state.actors[4],{x:.5,z:19});r.intents=r.makeIntents();const o={kind:'hold',actor:4};
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
