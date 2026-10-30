import {test} from 'node:test';import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,symlinkSync,rmSync,existsSync} from 'node:fs';
import {execFileSync,spawnSync} from 'node:child_process';import {tmpdir} from 'node:os';import {join,resolve} from 'node:path';
const root=process.cwd();
test('trusted runner proves a genuine failing-before/passing-after synthetic repair without an AI call',()=>{
 const dir=mkdtempSync(join(tmpdir(),'nextreport-agent-test-'));const repo=join(dir,'repo');mkdirSync(join(repo,'src/lib/nre/__tests__'),{recursive:true});
 const git=args=>execFileSync('git',args,{cwd:repo,stdio:'pipe'});
 try{
  git(['init','-q']);git(['config','user.name','Local synthetic test']);git(['config','user.email','synthetic@example.test']);
  writeFileSync(join(repo,'package.json'),'{}');writeFileSync(join(repo,'src/lib/nre/probe.ts'),'export function result(){return 1}\n');git(['add','.']);git(['commit','-qm','Synthetic baseline']);
  writeFileSync(join(repo,'src/lib/nre/probe.ts'),'export function result(){return 2}\n');
  writeFileSync(join(repo,'src/lib/nre/__tests__/probe.test.ts'),"import {it,expect} from 'vitest';import {result} from '../probe';it('preserves the required result',()=>expect(result()).toBe(2));\n");
  symlinkSync(resolve(root,'node_modules'),join(repo,'node_modules'),'dir');mkdirSync(join(repo,'src/generated'),{recursive:true});symlinkSync(resolve(root,'src/generated/prisma'),join(repo,'src/generated/prisma'),'dir');
  writeFileSync(join(repo,'.git/info/exclude'),'node_modules\nsrc/generated/\n');
  const outcome=join(dir,'outcome.json'),manifest=join(dir,'manifest.json');writeFileSync(outcome,JSON.stringify({outcome:'fixed'}));
  const run=spawnSync(process.execPath,[resolve(root,'scripts/agents/verify-repair.mjs'),outcome,manifest],{cwd:repo,encoding:'utf8',timeout:30000,env:{...process.env,NO_COLOR:'1',FORCE_COLOR:'0'}});
  assert.equal(run.status,0,(run.stderr??'')+(run.stdout??''));
  // Keeping the test but undoing the fix must not be accepted as a repair.
  writeFileSync(join(repo,'src/lib/nre/probe.ts'),'export function result(){return 1}\n');
  const bad=spawnSync(process.execPath,[resolve(root,'scripts/agents/verify-repair.mjs'),outcome,manifest],{cwd:repo,encoding:'utf8',timeout:30000,env:{...process.env,NO_COLOR:'1',FORCE_COLOR:'0'}});
  assert.notEqual(bad.status,0);assert.match(bad.stderr,/does not pass/);
 }finally{rmSync(dir,{recursive:true,force:true});}
});

test('fresh publisher rejects traversal before restoring any artifact file',()=>{
 const dir=mkdtempSync(join(tmpdir(),'nextreport-restore-test-'));
 try{
  const manifest=join(dir,'candidate.json'),escape=join(dir,'escape.ts');
  writeFileSync(manifest,JSON.stringify([{path:'../escape.ts',contents:Buffer.from('bad').toString('base64')},{path:'src/lib/nre/__tests__/probe.test.ts',contents:Buffer.from('test').toString('base64')}]));
  const cwd=join(dir,'workspace');mkdirSync(cwd);
  const run=spawnSync(process.execPath,[resolve(root,'scripts/agents/restore-repair.mjs'),manifest],{cwd,encoding:'utf8',timeout:3000});
  assert.notEqual(run.status,0);assert.equal(run.signal,null);assert.equal(existsSync(escape),false);assert.match(run.stderr,/Protected or unsupported path/);
 }finally{rmSync(dir,{recursive:true,force:true})}
});
test('fresh publisher emits the created PR number without running candidate code or contacting GitHub',()=>{
 const dir=mkdtempSync(join(tmpdir(),'nextreport-publish-test-'));const repo=join(dir,'repo'),remote=join(dir,'remote.git'),bin=join(dir,'bin');mkdirSync(repo);mkdirSync(bin);
 const git=args=>execFileSync('git',args,{cwd:repo,stdio:'pipe'});
 try{
  execFileSync('git',['init','--bare','-q',remote],{stdio:'pipe'});git(['init','-q']);git(['config','user.name','Synthetic']);git(['config','user.email','synthetic@example.test']);
  writeFileSync(join(repo,'baseline.txt'),'unchanged');git(['add','.']);git(['commit','-qm','Baseline']);git(['remote','add','origin',remote]);
  mkdirSync(join(repo,'src/lib/nre/__tests__'),{recursive:true});const path='src/lib/nre/__tests__/synthetic.test.ts';writeFileSync(join(repo,path),"throw Error('Candidate must not execute while publishing');");
  const manifest=join(dir,'files.json'),output=join(dir,'output');writeFileSync(manifest,JSON.stringify([{path}]));
  const gh=join(bin,'gh');writeFileSync(gh,'#!/bin/sh\nif [ "$1" = "pr" ]; then echo "https://github.com/synthetic/repository/pull/123"; fi\n',{mode:0o700});
  const run=spawnSync(process.execPath,[resolve(root,'scripts/agents/publish-repair.mjs'),manifest,join(dir,'body.md')],{cwd:repo,encoding:'utf8',timeout:10000,env:{...process.env,PATH:bin+':'+process.env.PATH,GITHUB_REPOSITORY:'synthetic/repository',REPAIR_ISSUE_NUMBER:'12',GITHUB_RUN_ID:'1234',GITHUB_OUTPUT:output,GH_TOKEN:'synthetic-only'}});
  assert.equal(run.status,0,run.stderr);assert.equal(readFileSync(output,'utf8'),'pr_number=123\n');
 }finally{rmSync(dir,{recursive:true,force:true})}
});
