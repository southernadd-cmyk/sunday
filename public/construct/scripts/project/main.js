import {Sunday} from './controller.js';

let game;
runOnStartup(runtime=>{
 runtime.addEventListener('beforeprojectstart',()=>{game=new Sunday(runtime);});
});
export const getGame=()=>game;
