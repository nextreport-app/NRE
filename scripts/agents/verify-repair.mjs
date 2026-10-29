import { execFileSync, spawnSync } from 'node:child_process';
import { lstatSync, readFileSync, writeFileSync, mkdirSync, mkdtempSync, symlinkSync, rmSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { validateCandidate } from './policy.mjs';
const root = process.cwd();
const outcome = JSON.parse(readFileSync(process.argv[2], 'utf8'));
if (outcome.outcome !== 'fixed') throw new Error('Insufficient reproduction: no candidate approved');
const git = args => execFileSync('git', args, {encoding:'utf8',maxBuffer:2_000_000,stdio:['ignore','pipe','pipe']});
if (git(['diff','--cached','--name-only']).trim()) throw new Error('Agent must not stage changes');
const paths = [...new Set([...git(['diff','--name-only','-z']).split('\0'), ...git(['ls-files','--others','--exclude-standard','-z']).split('\0')].filter(Boolean))];
const changes = paths.map(path => { let existed = true; try { git(['cat-file','-e',`HEAD:${path}`]); } catch { existed = false; } let deleted = false, symlink = false; try { symlink = lstatSync(path).isSymbolicLink(); } catch { deleted = true; } return {path,existed,deleted,symlink}; });
const bytes = Buffer.byteLength(git(['diff'])) + changes.filter(c=>!c.existed&&!c.deleted).reduce((sum,c)=>sum+lstatSync(c.path).size,0);
const tests = validateCandidate(changes, bytes);
const temp = mkdtempSync(join(tmpdir(),'nextreport-reproduction-'));
const baseline = join(temp,'base');
function runTests(cwd) {
  return spawnSync(resolve(root,'node_modules/.bin/vitest'), ['run',...tests], {cwd,encoding:'utf8',timeout:180000,maxBuffer:2_000_000,env:{...process.env,OPENAI_API_KEY:'',GH_TOKEN:'',GITHUB_TOKEN:''}});
}
try {
  git(['worktree','add','--detach',baseline,'HEAD']);
  symlinkSync(resolve(root,'node_modules'),join(baseline,'node_modules'),'dir');
  mkdirSync(join(baseline,'src/generated'),{recursive:true});
  symlinkSync(resolve(root,'src/generated/prisma'),join(baseline,'src/generated/prisma'),'dir');
  for (const file of tests) { mkdirSync(dirname(join(baseline,file)),{recursive:true}); writeFileSync(join(baseline,file),readFileSync(file)); }
  const before = runTests(baseline);
  // A crash/import error alone is not a reproduced failure. Require a reported failing assertion/test.
  if (before.error || before.signal || before.status === 0 || !/Tests\s+.*\d+ failed/.test((before.stdout??'')+(before.stderr??''))) throw new Error('New regression did not demonstrate a failing test on unchanged main');
  const after = runTests(root);
  if (after.error || after.signal || after.status !== 0) throw new Error('New regression does not pass with candidate fix');
  const manifest = { paths,tests,baselineFailed:true,candidatePassed:true };
  writeFileSync(process.argv[3],JSON.stringify(manifest),{mode:0o600});
  console.log('Candidate scope validated; new regression fails on main and passes with the patch.');
} finally { try { git(['worktree','remove','--force',baseline]); } finally { rmSync(temp,{recursive:true,force:true}); } }
