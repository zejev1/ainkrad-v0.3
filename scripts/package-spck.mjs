import {execFileSync} from 'node:child_process';
import {mkdirSync,readFileSync,writeFileSync,copyFileSync,readdirSync,rmSync,existsSync} from 'node:fs';
import {join,dirname,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';

// An export, never a commit or push. The caller supplies the verified main
// base and this run's evidence; stale evidence cannot satisfy release gates.
const root=process.cwd(),base=process.env.SPCK_BASE_COMMIT,target=process.env.SPCK_OUTPUT_DIR;
assert(base&&/^[0-9a-f]{40}$/.test(base),'Set SPCK_BASE_COMMIT to the verified main SHA.');
assert(target&&resolve(target)!==resolve(root)&&!existsSync(target),'SPCK_OUTPUT_DIR must be a new directory.');
const run=(args,cwd=root)=>execFileSync('git',args,{cwd,encoding:'utf8',maxBuffer:32*1024*1024}).trim();
assert.equal(run(['rev-parse','refs/remotes/origin/main']),base,'Main advanced: integrate it before packaging.');
assert.equal(run(['rev-parse','HEAD']),base,'Export the tested, uncommitted patch from its actual main base.');
const report=JSON.parse(readFileSync(process.env.SPCK_TEST_REPORT,'utf8'));
const audit=JSON.parse(readFileSync(process.env.SPCK_AUDIT_REPORT,'utf8'));
assert.equal(report.success,true);assert.equal(report.numFailedTests,0);assert.equal(report.numPendingTests,0);
assert(report.numPassedTests>0);assert.equal(audit.status,'passed');assert.equal(audit.base_commit,base);
assert(['full-suite','affected-suites'].includes(audit.test_scope),'Declare the actual verification scope.');
assert.deepEqual([...audit.test_files].sort(),report.testResults.map(r=>r.name.split('/').at(-1)).sort(),'Audit must describe this report exactly.');
assert.equal(audit.release,JSON.parse(readFileSync('package.json')).version);
for(const [path,expected] of Object.entries(audit.source_sha256)){assert.equal(createHash('sha256').update(readFileSync(path)).digest('hex'),expected,'Source changed after verification: '+path);}
assert(existsSync(join(root,'dist','index.html')),'Production build is missing.');
run(['diff','--check']);
for(const path of ['src/browser.ts','src/world/WorldEngine.ts']){
 const old=execFileSync('git',['show',base+':'+path],{cwd:root,encoding:'utf8'}).split('\n').length;
 assert(readFileSync(path,'utf8').split('\n').length<=old+100,'Move new mechanisms out of '+path);
}
mkdirSync(dirname(target),{recursive:true});
execFileSync('git',['init','--initial-branch=main',target],{stdio:'pipe'});
// Fetch objects only. Never inherit local-clone refs, reflogs or remote paths.
run(['fetch','--no-tags',root,base],target);
run(['update-ref','refs/heads/main',base],target);
run(['symbolic-ref','HEAD','refs/heads/main'],target);
run(['read-tree',base],target);
run(['remote','add','origin','https://github.com/zejev1/ainkrad-v0.3.git'],target);
run(['update-ref','refs/remotes/origin/main',base],target);
run(['config','branch.main.remote','origin'],target);run(['config','branch.main.merge','refs/heads/main'],target);
run(['config','user.email','zejev1@users.noreply.github.com'],target);run(['config','user.name','zejev1'],target);
run(['config','core.filemode','false'],target);
writeFileSync(join(target,'.git','packed-refs'),'# pack-refs with: peeled fully-peeled sorted \n'+base+' refs/heads/main\n'+base+' refs/remotes/origin/main\n');
for(const path of ['FETCH_HEAD','logs','hooks'])rmSync(join(target,'.git',path),{recursive:true,force:true});
for(const item of readdirSync(target))if(item!=='.git')rmSync(join(target,item),{recursive:true,force:true});
const paths=execFileSync('git',['ls-files','-z','--cached','--others','--exclude-standard'],{cwd:root,encoding:'utf8'}).split('\0')
 .filter(p=>p&&!p.startsWith('__qa/')&&existsSync(join(root,p)));
const hashes={};
for(const path of paths){
 assert(!path.startsWith('/')&&!path.split('/').includes('..'));
 const bytes=readFileSync(join(root,path));mkdirSync(dirname(join(target,path)),{recursive:true});copyFileSync(join(root,path),join(target,path));
 assert.deepEqual(readFileSync(join(target,path)),bytes);hashes[path]=createHash('sha256').update(bytes).digest('hex');
}
const config=readFileSync(join(target,'.git','config'),'utf8');assert(!/extraheader|authorization|x-access-token|oauth|password/i.test(config));
assert.equal(run(['branch','--show-current'],target),'main');assert.equal(run(['rev-parse','HEAD'],target),base);
assert.equal(readFileSync(join(target,'.git','refs','heads','main'),'utf8').trim(),base);
assert.equal(readFileSync(join(target,'.git','refs','remotes','origin','main'),'utf8').trim(),base);
assert(!existsSync(join(target,'.git','objects','info','alternates')));run(['fsck','--full','--no-reflogs'],target);
assert(run(['status','--porcelain'],target).length>0);
assert(!existsSync(join(target,'node_modules'))&&!existsSync(join(target,'dist'))&&!existsSync(join(target,'__qa')));
writeFileSync(join(target,'docs','SPCK_FILES.json'),JSON.stringify({base,release:audit.release,sha256:hashes},null,2)+'\n');
console.log(JSON.stringify({directory:target,base,files:paths.length,tests:report.numPassedTests,changes:'uncommitted',status:'verified'}));
