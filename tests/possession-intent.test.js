import test from 'node:test';
import assert from 'node:assert/strict';
import {possessionIntent,possessionAction,INTENTS} from '../scripts/engine-evaluation/possession-intent.js';
const ctx=(changes={})=>({depth:.5,central:.8,pressure:false,forwardPass:false,clearShot:false,isolated:false,backwardPass:false,breaksLine:false,...changes});
const cases=[
 ['build','pass',ctx({depth:.2,forwardPass:true})],
 ['progress','carry',ctx()],
 ['combine','pass',ctx({depth:.62,forwardPass:true})],
 ['beat','carry',ctx({pressure:true,isolated:true})],
 ['finish','shoot',ctx({depth:.8,clearShot:true})],
 ['recover','pass',ctx({pressure:true,backwardPass:true})],
];
for(const [expected,action,c] of cases)test('possession intent '+expected,()=>{
 const intent=possessionIntent(null,c);assert.equal(intent,expected);assert.equal(possessionAction(intent,c),action);
});
test('retains build and combination intent across zone boundaries',()=>{
 assert.equal(possessionIntent('build',ctx({depth:.34})),'build');
 assert.equal(possessionIntent('combine',ctx({depth:.56,forwardPass:true})),'combine');
});
test('never selects a pass without an option or a shot without a clear chance',()=>{
 for(const intent of INTENTS)assert.equal(possessionAction(intent,ctx()),'carry');
});
