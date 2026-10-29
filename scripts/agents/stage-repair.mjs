import {execFileSync} from 'node:child_process';
import {lstatSync,readFileSync,writeFileSync} from 'node:fs';
import {validateCandidate} from './policy.mjs';
const git=args=>execFileSync('git',args,{encoding:'utf8',maxBuffer:2_000_000,stdio:['ignore','pipe','pipe']});
if(git(['diff','--cached','--name-only']).trim())throw new Error('Agent staged changes');
const paths=[...new Set([...git(['diff','--name-only','-z']).split('\0'),...git(['ls-files','--others','--exclude-standard','-z']).split('\0')].filter(Boolean))];
const changes=paths.map(path=>{let existed=true;try{git(['cat-file','-e',`HEAD:${path}`]);}catch{existed=false;}let deleted=false,symlink=false;try{symlink=lstatSync(path).isSymbolicLink();}catch{deleted=true;}return{path,existed,deleted,symlink}});
validateCandidate(changes,Buffer.byteLength(git(['diff']))+changes.filter(c=>!c.existed&&!c.deleted).reduce((sum,c)=>sum+lstatSync(c.path).size,0));
const files=paths.map(path=>({path,contents:readFileSync(path).toString('base64')}));
const credential=process.env.REPAIR_API_KEY;
for(const file of files){
 const text=file.path+'\n'+Buffer.from(file.contents,'base64').toString('utf8');
 if((credential&&[credential,Buffer.from(credential).toString('base64'),Buffer.from(credential).toString('hex')].some(value=>text.includes(value)))||/sk-(?:proj-)?[A-Za-z0-9_-]{24,}|gh[pousr]_[A-Za-z0-9]{20,}/.test(text))throw new Error('Potential credential in candidate; refusing publication');
}
writeFileSync(process.argv[2],JSON.stringify(files),{mode:0o600});
