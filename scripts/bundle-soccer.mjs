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
const adapter=resolve(upstream,'sunday-adapter.js');
copyFileSync(resolve(root,'scripts/engine-evaluation/soccer-adapter.js'),adapter);
const license=readFileSync(resolve(upstream,'LICENSE'),'utf8');
const entry="export {createSoccerMatch,SOCCER_STEP,CHIPS,chipOffers,RELOAD_COST} from "+JSON.stringify(adapter)+";\nexport {AUTO_TRAITS} from "+JSON.stringify(resolve(root,'src/engine.js'))+";";
const result=await build({stdin:{contents:entry,resolveDir:root,sourcefile:'sunday-soccer-entry.js'},bundle:true,platform:'browser',format:'esm',target:'es2022',minify:true,write:false,legalComments:'inline',banner:{js:'/* Generated SUNDAY Soccer-JS bundle; upstream '+pin+'\\n'+license.replaceAll('*/','* /')+'\\n*/'}});
const bytes=result.outputFiles[0].contents;
for(const path of ['construct/scripts/engine.js','public/construct/scripts/project/engine.js'])writeFileSync(resolve(root,path),bytes);
mkdirSync(resolve(root,'public/licenses'),{recursive:true});writeFileSync(resolve(root,'public/licenses/soccer-js.txt'),license);
console.log('Bundled pinned Soccer-JS '+pin.slice(0,8)+': '+bytes.length+' bytes');
