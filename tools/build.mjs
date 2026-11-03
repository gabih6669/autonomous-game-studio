import { cp, copyFile, mkdir, rm, stat, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const root=resolve(import.meta.dirname,'..');
const out=resolve(root,'dist');
await rm(out,{recursive:true,force:true});
await mkdir(out,{recursive:true});
await copyFile(resolve(root,'index.html'),resolve(out,'index.html'));
await copyFile(resolve(root,'style.css'),resolve(out,'style.css'));
await cp(resolve(root,'src'),resolve(out,'src'),{recursive:true});
await cp(resolve(root,'assets'),resolve(out,'assets'),{recursive:true});
const [html,css,sim,main,crest]=await Promise.all([
  readFile(resolve(root,'index.html'),'utf8'),readFile(resolve(root,'style.css'),'utf8'),
  readFile(resolve(root,'src/sim.js'),'utf8'),readFile(resolve(root,'src/main.js'),'utf8'),
  readFile(resolve(root,'assets/crest.svg'),'utf8')
]);
const bundle=sim.replace(/\bexport /g,'')+'\n'+main.replace(/^import[^\n]*\n/,'');
if(/\bimport\s*\{/.test(bundle)||/\bexport\s/.test(bundle))throw new Error('Offline bundle still contains module syntax');
let standalone=html.replace('<link rel="stylesheet" href="style.css" />',`<style>${css}</style>`)
  .replace('<link rel="icon" href="assets/crest.svg" type="image/svg+xml" />',`<link rel="icon" href="data:image/svg+xml,${encodeURIComponent(crest)}" type="image/svg+xml" />`)
  .replace('<script type="module" src="src/main.js"></script>',`<script>\n${bundle}\n</script>`);
if(standalone.includes('src/main.js'))throw new Error('Offline bundle script not replaced');
await writeFile(resolve(out,'offline.html'),standalone,'utf8');
for(const path of ['index.html','offline.html','style.css','src/main.js','src/sim.js','assets/crest.svg'])await stat(resolve(out,path));
console.log('Build verified: dist/ has hosted files and a standalone offline.html game.');
