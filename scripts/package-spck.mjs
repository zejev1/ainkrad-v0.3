import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, copyFileSync, readdirSync, rmSync, statSync, appendFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';

const root=process.cwd(),temp=process.env.RUNNER_TEMP;
assert(temp,'Package generation requires a CI temporary directory.');
const base='cfbf8f7938efd373fd5b67db6645847f315420e3';
const run=(args,cwd=root)=>execFileSync('git',args,{cwd,encoding:'utf8',maxBuffer:32*1024*1024}).trim();
const head=run(['rev-parse','HEAD']);
assert.equal(run(['rev-parse','refs/remotes/origin/main']),base,'Main advanced: integrate its new commits before packaging.');
const report=JSON.parse(readFileSync(join(temp,'ainkrad-tests.json'),'utf8'));
assert.equal(report.success,true);assert.equal(report.numFailedTests,0);assert(report.numPassedTests>=240);
assert(statSync(join(root,'dist','index.html')).isFile(),'Production build is missing.');

// Verify runtime execution, writing and reading using a disposable probe.
const probe=join(temp,'ainkrad-io-probe.txt');writeFileSync(probe,head);assert.equal(readFileSync(probe,'utf8'),head);rmSync(probe);
const target=join(temp,'ainkrad-spck','Ainkrad');mkdirSync(dirname(target),{recursive:true});
rmSync(target,{recursive:true,force:true});
execFileSync('git',['clone','--no-hardlinks','--no-checkout',root,target],{encoding:'utf8',stdio:'pipe'});
run(['checkout','-B','main',base],target);
run(['remote','set-url','origin','https://github.com/zejev1/ainkrad-v0.3.git'],target);
run(['update-ref','refs/remotes/origin/main',base],target);
run(['config','branch.main.remote','origin'],target);run(['config','branch.main.merge','refs/heads/main'],target);
run(['config','user.email','zejev1@users.noreply.github.com'],target);
run(['config','user.name','zejev1'],target);
// Remove only files in this newly-created export, then overlay the exact tested source.
for(const item of readdirSync(target))if(item!=='.git')rmSync(join(target,item),{recursive:true,force:true});
const paths=execFileSync('git',['ls-tree','-r','--name-only','-z',head],{cwd:root,encoding:'utf8'}).split('\0').filter(Boolean);
for(const path of paths) {
  assert(!path.startsWith('/')&&!path.split('/').includes('..'));
  mkdirSync(dirname(join(target,path)),{recursive:true});copyFileSync(join(root,path),join(target,path));
}
for(const path of ['vercel.json','.github/workflows/ci.yml']) {
  writeFileSync(join(target,path),execFileSync('git',['show',base+':'+path],{cwd:root}));
}
assert.equal(run(['rev-parse','HEAD'],target),base);
assert.equal(run(['branch','--show-current'],target),'main');
assert.equal(run(['remote','get-url','origin'],target),'https://github.com/zejev1/ainkrad-v0.3.git');
const config=readFileSync(join(target,'.git','config'),'utf8');
assert(!/extraheader|authorization|x-access-token|oauth|password/i.test(config),'Export contains authentication configuration.');
const protectedPaths=run(['diff','--name-only',base,head]).split('\n');
assert(!protectedPaths.some(p=>p.startsWith('src/cardinal/')||p.startsWith('src/boundary/')||p.startsWith('src/world/learning/')));
const audit={
  release:'0.3.21-hotfix.2',status:'passed',base_commit:base,tested_commit:head,
  ci_run:process.env.GITHUB_RUN_ID,environment:{node:process.version,execution_and_read_write:'passed'},
  gates:{typecheck:'passed',tests:{passed:report.numPassedTests,failed:report.numFailedTests,total:report.numTotalTests},production_build:'passed'},
  review:'docs/V0_3_21_FIX2_REVIEW.md',
  protected:{main_unchanged:true,draft_pr_not_merged:true,no_deployment:true,cardinal_and_gateway_sources_unchanged:true},
  delivery:{branch:'main',head:base,changes:'uncommitted',git_email:'zejev1@users.noreply.github.com'},
  limitations:['No real Android or Xbox run','No reproduction of the supplied acceleration error without its stack/save',
    'Different origins retain separate worlds','Three same-database backups cannot survive deletion of all browser site data'],
};
writeFileSync(join(target,'docs','V0_3_21_FIX2_AUDIT.json'),JSON.stringify(audit,null,2)+'\n');
const hashes={};
for(const path of paths) {
  if(['vercel.json','.github/workflows/ci.yml'].includes(path))continue;
  const bytes=readFileSync(join(target,path));
  assert.deepEqual(bytes,readFileSync(join(root,path)),'Export differs from tested source: '+path);
  hashes[path]=createHash('sha256').update(bytes).digest('hex');
}
writeFileSync(join(target,'docs','V0_3_21_FIX2_FILES.json'),JSON.stringify({testedCommit:head,sha256:hashes},null,2)+'\n');
const changes=run(['status','--porcelain'],target);assert(changes.length>0);
assert(!readdirSync(target).includes('node_modules'));assert(!readdirSync(target).includes('dist'));
console.log('SPCK_PACKAGE_AUDIT='+JSON.stringify(audit));
console.log('SPCK_CHANGED_FILES='+changes.split('\n').length);
appendFileSync(process.env.GITHUB_OUTPUT,'directory='+target+'\n');
