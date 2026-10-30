import {readFileSync} from 'node:fs';import {execFileSync} from 'node:child_process';
const files=JSON.parse(readFileSync(process.argv[2],'utf8'));
for(const file of files)if(!readFileSync(file.path).equals(Buffer.from(file.contents,'base64')))throw new Error('Candidate changed during verification; refusing publication');
const git=args=>execFileSync('git',args,{encoding:'utf8'});
const paths=[...new Set([...git(['diff','--name-only','-z']).split('\0'),...git(['ls-files','--others','--exclude-standard','-z']).split('\0')].filter(Boolean))].sort();
if(JSON.stringify(paths)!==JSON.stringify(files.map(file=>file.path).sort()))throw new Error('Verification introduced unstaged source changes');
