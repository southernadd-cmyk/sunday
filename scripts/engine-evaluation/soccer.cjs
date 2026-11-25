require('./tests/mock_env.js');
const {Settings}=require('./kernel/settings.js');
const {runHeadlessMatch,mergeConfig}=require('./kernel/providers/simulator/headless_runner.js');
Settings.app={camX:0,camY:0,canvas:{width:720,height:528}};
(async()=>{
 const rows=[];
 for(const seed of [1,2,3,4,5,6]){
  const start=performance.now();
  const {telemetry:t}=await runHeadlessMatch(mergeConfig({headless:true,matchDurationSeconds:75,maxFramesPerMatch:5000}),seed);
  rows.push({seed,wallMs:Math.round(performance.now()-start),frames:t.frames,state:t.matchState,score:[t.scoreA,t.scoreB],passes:t.tactical.passAttempts,shots:t.tactical.shootAttempts,tackles:t.tactical.tackleSuccesses,blocks:t.tactical.blocks});
 }
 console.log('ENGINE_BENCHMARK '+JSON.stringify({engine:'soccer-js',duration:75,rows}));
})().catch(e=>{console.error(e);process.exitCode=1});
