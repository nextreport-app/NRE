import {readFileSync,writeFileSync,mkdirSync,lstatSync,existsSync} from 'node:fs';
import {dirname} from 'node:path';
import {execFileSync} from 'node:child_process';
import {validateCandidate} from './policy.mjs';
const raw=readFileSync(process.argv[2]);if(raw.length>4_000_000)throw new Error('Candidate artifact too large');
const files=JSON.parse(raw.toString('utf8'));
if(!Array.isArray(files)||files.length>12||new Set(files.map(f=>f.path)).size!==files.length)throw new Error('Invalid candidate manifest');
// Reject invalid paths before git lookup or walking parents.
validateCandidate(files.map(file=>({path:typeof file.path==='string'?file.path:'',existed:false})),0);
const changes=files.map(file=>{
 if(typeof file.path!=='string'||typeof file.contents!=='string'||!/^[A-Za-z0-9+/]*={0,2}$/.test(file.contents)||file.contents.length>2_000_000)throw new Error('Invalid candidate record');
 let existed=true;try{execFileSync('git',['cat-file','-e',`HEAD:${file.path}`],{stdio:'pipe'})}catch{existed=false}
 let parent=dirname(file.path);
 while(parent!=='.'){if(existsSync(parent)&&lstatSync(parent).isSymbolicLink())throw new Error('Symlink parent in candidate');parent=dirname(parent);}
 return{path:file.path,existed,symlink:existsSync(file.path)&&lstatSync(file.path).isSymbolicLink()};
});
// Check paths BEFORE restoring; the artifact is untrusted input from another job.
// The exact diff-byte cap is rechecked by the staging guard after restore.
validateCandidate(changes,0);
for(const file of files){mkdirSync(dirname(file.path),{recursive:true});writeFileSync(file.path,Buffer.from(file.contents,'base64'));}
