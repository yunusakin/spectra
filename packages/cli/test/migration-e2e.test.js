import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { parse } from "yaml";
import { cliPath, cliRoot, createGitProject, initProject } from "./helpers/project.js";

// Failure modes recorded before implementation: skipped adjacent schema steps,
// premature CURRENT, read-only planning writes, lost value/unknown fields/Git
// mode, symlink traversal, layout collision, exclusion failure, torn schema
// commit, missing scaffold validation, launcher failure, interrupted execution,
// policy failure reported as completion, unsafe resume, JSON polluted by logs.
const runRoot = fs.mkdtempSync(path.join(process.env.SPECTRA_LIFECYCLE_ARTIFACT_DIR ?? os.tmpdir(), "spectra-migration-e2e-"));
const sha = bytes => crypto.createHash("sha256").update(bytes).digest("hex");
function inventory(root) {
  const files = {};
  function visit(dir, prefix = "") {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const relative = `${prefix}${entry.name}`; const file = path.join(dir, entry.name);
      if (relative === ".git") { const exclude = path.join(file, "info/exclude"); if (fs.existsSync(exclude)) files[".git/info/exclude"] = sha(fs.readFileSync(exclude)); continue; }
      if (entry.isSymbolicLink()) files[relative] = `link:${fs.readlinkSync(file)}`;
      else if (entry.isDirectory()) visit(file, `${relative}/`);
      else files[relative] = sha(fs.readFileSync(file));
    }
  }
  visit(root); return files;
}
const hook = path.join(runRoot, "fault-hook.mjs");
fs.writeFileSync(hook, `import fs from 'node:fs'; import path from 'node:path';
const fault = process.env.SPECTRA_E2E_FAULT; const root = process.env.SPECTRA_E2E_PROJECT;
const markerPath = path.join(root, '.spectra/migration.json');
const read = fs.readFileSync.bind(fs); const rename = fs.renameSync.bind(fs); const write = fs.writeFileSync.bind(fs); const chmod = fs.chmodSync.bind(fs); const exists = fs.existsSync.bind(fs);
const marker = () => { try { return JSON.parse(read(markerPath, 'utf8')); } catch { return {}; } };
const fail = () => { throw new Error('injected ' + fault); };
fs.writeFileSync = (...args) => { if (fault === 'exclusions' && String(args[0]).endsWith('/info/exclude')) fail(); return write(...args); };
fs.chmodSync = (...args) => { if (fault === 'launcher' && String(args[0]).endsWith('/.spectra/bin/spectra')) fail(); return chmod(...args); };
fs.existsSync = file => { if (fault === 'step-validation' && marker().phase === 'step-validation' && String(file).endsWith('/business/INDEX.md')) return false; return exists(file); };
fs.renameSync = (...args) => {
 if (fault === 'schema-commit' && marker().phase === 'schema-commit' && String(args[1]).endsWith('/config.yaml')) fail();
 const result = rename(...args);
 if (String(args[1]) === markerPath && fault === 'interrupt' && marker().phase === 'refresh') process.exit(87);
 return result;
};
`);
function scenario(name, action) {
  test(`migration E2E: ${name}`, t => {
    const report = { name, fixtures: [], commands: [], passed: false };
    const artifact = path.join(runRoot, `${name.replaceAll(/[^a-z0-9-]/gi, '-')}.json`);
    t.diagnostic(`Migration artifact: ${artifact}`);
    const save = () => fs.writeFileSync(artifact, JSON.stringify(report, null, 2));
    const execute = (root, args, fault) => {
      const before = inventory(root);
      const result = spawnSync(process.execPath, [...(fault ? ['--import', hook] : []), cliPath, ...args], { cwd: root, encoding: 'utf8', env: { ...process.env,
        SPECTRA_ASSETS_DIR: path.join(cliRoot, 'assets'), SPECTRA_LATEST_VERSION: '3.1.2', SPECTRA_E2E_FAULT: fault ?? '', SPECTRA_E2E_PROJECT: root } });
      report.commands.push({ root, args, fault, exitStatus: result.status, stdout: result.stdout, stderr: result.stderr, before, after: inventory(root) }); save(); return result;
    };
    const fixture = (schema = 2, layout = 'canonical', gitMode = 'local') => {
      const root = initProject(createGitProject(), ['--git-mode', gitMode]);
      const metadata = path.join(root, '.spectra/install.json'); const previous = JSON.parse(fs.readFileSync(metadata));
      fs.writeFileSync(metadata, JSON.stringify({ ...previous, schemaVersion: schema, profile: 'lite', installedAt: '2000-01-01T00:00:00Z', vendor: { preserve: true } }));
      fs.writeFileSync(path.join(root, '.spectra/config.yaml'), `gitMode: ${gitMode}\nschemaVersion: ${schema}\nprofile: lite\ncustom: retained\n`);
      for (const [file, text] of [['sdd/features/custom-value.md', 'spec value'], ['sdd/governance/custom-value.md', 'governance value'], ['sdd/memory-bank/custom-value.md', 'memory value'], ['docs/plugin/plan.md', 'plugin value'], ['unknown.dat', 'unknown value']]) {
        fs.mkdirSync(path.dirname(path.join(root, '.spectra', file)), { recursive: true }); fs.writeFileSync(path.join(root, '.spectra', file), text);
      }
      if (layout === 'spectra-dir') fs.renameSync(path.join(root, '.spectra'), path.join(root, 'spectra'));
      if (layout === 'root-sdd') fs.renameSync(path.join(root, '.spectra/sdd'), path.join(root, 'sdd'));
      if (schema === null) {
        const prefix = layout === 'spectra-dir' ? 'spectra' : '.spectra'; const file = path.join(root, prefix, 'install.json'); const m = JSON.parse(fs.readFileSync(file)); delete m.schemaVersion; fs.writeFileSync(file, JSON.stringify(m));
        fs.writeFileSync(path.join(root, prefix, 'config.yaml'), `gitMode: ${gitMode}\n`);
        const manifest = path.join(root, layout === 'root-sdd' ? 'sdd' : `${prefix}/sdd`, 'system/manifest.env'); fs.writeFileSync(manifest, `spectra_version=${layout === 'root-sdd' ? '2.0.3' : '3.0.8'}\nrepo_mode=consumer\n`);
      }
      report.fixtures.push({ root, schema, layout, gitMode, source: 'synthetic current bootstrap; actual tagged release generation belongs to Task 8', before: inventory(root) }); save(); return root;
    };
    try { action({ fixture, execute, report }); report.passed = true; } catch (e) { report.failure = e.message; throw e; } finally { save(); }
  });
}
const success = result => assert.equal(result.status, 0, result.stderr || result.stdout);
const json = result => JSON.parse(result.stdout);
const unchanged = report => { const c = report.commands.at(-1); assert.deepEqual(c.after, c.before); };
const values = ['sdd/features/custom-value.md', 'sdd/governance/custom-value.md', 'sdd/memory-bank/custom-value.md', 'docs/plugin/plan.md', 'unknown.dat'];
function preserved(report, root) {
 const before = report.fixtures.find(f => f.root === root); const after = inventory(root);
 for (const file of values) { const original = before.layout === 'root-sdd' && file.startsWith('sdd/') ? file : `${before.layout === 'spectra-dir' ? 'spectra' : '.spectra'}/${file}`; assert.equal(after[`.spectra/${file}`], before.before[original], file); }
}
for (const [schema, layout, gitMode, expected] of [[1,'canonical','local',['1-to-2','2-to-3']], [2,'canonical','shared',['2-to-3']], [null,'root-sdd','local',['layout','unversioned-to-1','1-to-2','2-to-3']], [null,'spectra-dir','shared',['layout','unversioned-to-1','1-to-2','2-to-3']]]) scenario(`transition ${schema} ${layout} ${gitMode}`, ({fixture, execute, report}) => {
 const root = fixture(schema, layout, gitMode); const check = execute(root, ['migrate','--check','--json']); unchanged(report); assert.equal(check.status, 1); assert.equal(json(check).outcome, 'migration-required'); assert.deepEqual(json(check).steps.map(s=>s.id), expected);
 const result = execute(root, ['migrate','--yes','--json']); success(result); assert.equal(json(result).validationStatus, 'passed'); preserved(report, root);
 const m = JSON.parse(fs.readFileSync(path.join(root,'.spectra/install.json'))); assert.equal(m.schemaVersion,3); assert.equal(m.gitMode,gitMode); assert.equal(m.installedAt,'2000-01-01T00:00:00Z'); assert.deepEqual(m.vendor,{preserve:true}); assert.equal(Object.hasOwn(m,'profile'),false);
 assert.match(fs.readFileSync(path.join(root,'.spectra/config.yaml'),'utf8'),/custom: retained|gitMode:/);
 assert.equal(fs.existsSync(path.join(root,'.spectra/migration.json')),false); assert.ok(fs.existsSync(path.join(root,json(result).recoveryPath,'manifest.json')));
 const repeat = execute(root,['migrate','--yes','--json']); success(repeat); unchanged(report); assert.equal(json(repeat).outcome,'current');
});
scenario('invalid and non-TTY options are no-write', ({fixture, execute, report}) => {
 const root=fixture(); for(const args of [['migrate','--json','--dry-run'],['migrate','--json','extra'],['migrate','--json','--cwd'],['migrate','--json','--yes=maybe']]) { const r=execute(root,args); unchanged(report); assert.equal(r.status,1); assert.equal(json(r).outcome,'invalid-usage'); }
 const r=execute(root,['migrate','--json']); unchanged(report); assert.equal(r.status,1); assert.match(json(r).reason,/--yes/);
});
scenario('conflicts malformed and escaping symlinks refuse before snapshot', ({fixture, execute, report}) => {
 for(const damage of ['collision','metadata','symlink']) { const root=fixture(2,'root-sdd'); if(damage==='collision') { fs.mkdirSync(path.join(root,'.spectra/sdd')); fs.writeFileSync(path.join(root,'.spectra/sdd/value'),'target'); }
 if(damage==='metadata') fs.writeFileSync(path.join(root,'.spectra/install.json'),'{broken');
 if(damage==='symlink') fs.symlinkSync(path.join(runRoot,'missing-outside'),path.join(root,'sdd/memory-bank/escaping'));
 const r=execute(root,['migrate','--yes','--json']); unchanged(report); assert.equal(r.status,1); assert.equal(json(r).outcome,'incompatible'); assert.equal(fs.existsSync(path.join(root,'.spectra/migration.json')),false); }
});
for(const fault of ['exclusions','schema-commit','step-validation','launcher','interrupt']) scenario(`failure ${fault} retains recovery and honest state`, ({fixture,execute,report})=>{
 const root=fixture(1,fault==='exclusions'?'root-sdd':'canonical'); const failed=execute(root,['migrate','--yes','--json'],fault); assert.notEqual(failed.status,0);
 const marker=JSON.parse(fs.readFileSync(path.join(root,'.spectra/migration.json'))); assert.ok(marker.phase); assert.ok(marker.recoveryPath); assert.ok(fs.existsSync(path.join(root,marker.recoveryPath,'manifest.json')));
 const status=execute(root,['status']); assert.equal(status.status,1); assert.match(status.stdout+status.stderr,/BROKEN|Incomplete/);
 const retry=execute(root,['migrate','--yes','--json']); success(retry); preserved(report,root); assert.equal(json(retry).validationStatus,'passed');
});
scenario('policy failure remains blocked then resumes validation', ({fixture,execute,report})=>{
 const root=fixture(); fs.writeFileSync(path.join(root,'company-source.js'),'export const change = true;'); const r=execute(root,['migrate','--yes','--json']); assert.equal(r.status,1); assert.equal(json(r).validationStatus,'failed'); assert.match(json(r).reason,/post-migrate validation failed/);
 assert.equal(JSON.parse(fs.readFileSync(path.join(root,'.spectra/migration.json'))).phase,'validation'); preserved(report,root);
 fs.unlinkSync(path.join(root,'company-source.js')); success(execute(root,['migrate','--yes','--json']));
});
scenario('resume refuses edited valuable content and marker path injection',({fixture,execute,report})=>{
 for(const damage of ['value','path']) { const root=fixture(); execute(root,['migrate','--yes','--json'],'interrupt');
 if(damage==='value') fs.writeFileSync(path.join(root,'.spectra/docs/plugin/plan.md'),'edited during interruption');
 else {const p=path.join(root,'.spectra/migration.json'); const m=JSON.parse(fs.readFileSync(p));m.recoveryPath='../outside';fs.writeFileSync(p,JSON.stringify(m));}
 const r=execute(root,['migrate','--yes','--json']); assert.equal(r.status,1); unchanged(report); assert.match(json(r).reason,/manual|recovery|changed|invalid/i);
 }
});

scenario('resume lock belongs to another executor', ({fixture,execute,report}) => {
 const root=fixture(); execute(root,['migrate','--yes','--json'],'interrupt'); const lock=path.join(root,'.spectra/migration.json.resume');fs.writeFileSync(lock,'other-owner');
 const r=execute(root,['migrate','--yes','--json']);assert.equal(r.status,1); unchanged(report);assert.equal(fs.readFileSync(lock,'utf8'),'other-owner');
});
scenario('legacy docs and Git exclude ancestors cannot escape',({fixture,execute,report})=>{
 for(const kind of ['docs','git']) {const root=fixture(1,'root-sdd');const outside=fs.mkdtempSync(path.join(runRoot,'outside-'));fs.writeFileSync(path.join(outside,kind==='docs'?'workflow.md':'exclude'),'valuable outside file');
 if(kind==='docs')fs.symlinkSync(outside,path.join(root,'docs'));else {fs.renameSync(path.join(root,'.git/info'),path.join(root,'.git/info-original'));fs.symlinkSync(outside,path.join(root,'.git/info'));}
 const before=inventory(outside);const r=execute(root,['migrate','--yes','--json']);assert.equal(r.status,1);unchanged(report);assert.deepEqual(inventory(outside),before);
 }
});
scenario('unknown system files and original exclusion bytes survive in recovery',({fixture,execute,report})=>{
 const root=fixture();const file=path.join(root,'.spectra/sdd/system/custom-user-note.md');fs.writeFileSync(file,'# user system note');const before=inventory(root);const r=execute(root,['migrate','--yes','--json']);success(r);assert.equal(inventory(root)['.spectra/sdd/system/custom-user-note.md'],before['.spectra/sdd/system/custom-user-note.md']);
 const recovery=path.join(root,json(r).recoveryPath);const manifest=JSON.parse(fs.readFileSync(path.join(recovery,'manifest.json')));for(const item of manifest.files)assert.equal(sha(fs.readFileSync(path.join(recovery,item.backup))),item.sha256);const exclude=manifest.files.find(f=>f.kind==='git-exclude');assert.equal(exclude.sha256,before['.git/info/exclude']);
});

scenario('known unversioned history without metadata preserves config Git mode',({fixture,execute,report})=>{
 const root=fixture(null,'root-sdd','local');fs.unlinkSync(path.join(root,'.spectra/install.json'));const r=execute(root,['migrate','--yes','--json']);success(r);assert.equal(JSON.parse(fs.readFileSync(path.join(root,'.spectra/install.json'))).gitMode,'local');
});
scenario('Git exclude ancestor alone is rejected before snapshot',({fixture,execute,report})=>{
 const root=fixture(1,'root-sdd');const outside=fs.mkdtempSync(path.join(runRoot,'git-outside-'));fs.writeFileSync(path.join(outside,'exclude'),'outside-owned exclusion');fs.renameSync(path.join(root,'.git/info'),path.join(root,'.git/info-original'));fs.symlinkSync(outside,path.join(root,'.git/info'));const before=inventory(outside);const r=execute(root,['migrate','--yes','--json']);assert.equal(r.status,1);unchanged(report);assert.deepEqual(inventory(outside),before);assert.equal(fs.existsSync(path.join(root,'.spectra/migration.json')),false);
});

// Build real v3.0.8 consumer state using its tagged source and own asset sync.
// Installed yaml is reused, so this repeatable check needs no network/install.
function taggedProject(report) {
 const checkout=fs.mkdtempSync(path.join(runRoot,'tag-v3.0.8-'));const tag='v3.0.8';const gitRoot=path.resolve(cliRoot,'../..');
 const archive=spawnSync('git',['archive',tag],{cwd:gitRoot,maxBuffer:32*1024*1024});assert.equal(archive.status,0,archive.stderr?.toString());const extract=spawnSync('tar',['-x','-C',checkout],{input:archive.stdout});assert.equal(extract.status,0,extract.stderr?.toString());
 const sourceSha=spawnSync('git',['rev-parse',`${tag}^{commit}`],{cwd:gitRoot,encoding:'utf8'}).stdout.trim();fs.symlinkSync(path.join(gitRoot,'node_modules'),path.join(checkout,'node_modules'));
 const oldCli=path.join(checkout,'packages/cli');const sync=spawnSync(process.execPath,[path.join(oldCli,'scripts/sync-assets.mjs')],{cwd:checkout,encoding:'utf8'});success(sync);
 const root=createGitProject();const init=spawnSync(process.execPath,[path.join(oldCli,'bin/spectra.js'),'init','.','--profile','lite','--git-mode','local'],{cwd:root,encoding:'utf8',env:{...process.env,SPECTRA_ASSETS_DIR:path.join(oldCli,'assets')}});success(init);
 const metadata=JSON.parse(fs.readFileSync(path.join(root,'spectra/install.json')));assert.equal(metadata.schemaVersion,2);const manifest=fs.readFileSync(path.join(root,'spectra/sdd/system/manifest.env'),'utf8');assert.match(manifest,/spectra_version=3.0.8/);
 report.fixtures.push({root,schema:2,layout:'spectra-dir',gitMode:metadata.gitMode,sourceVersion:'3.0.8',sourceSha,tag,checkout,before:inventory(root),generation:{archive:'git archive v3.0.8',syncAssetsStatus:sync.status,initStatus:init.status,stdout:init.stdout,stderr:init.stderr}});return root;
}
scenario('tagged v3.0.8 launcher fault resumes exact derived refresh',({execute,report})=>{
 const root=taggedProject(report);const failed=execute(root,['migrate','--yes','--json'],'launcher');assert.equal(failed.status,1);assert.equal(JSON.parse(fs.readFileSync(path.join(root,'.spectra/migration.json'))).phase,'refresh');const afterFault=inventory(root);const retried=execute(root,['migrate','--yes','--json']);success(retried);assert.equal(json(retried).validationStatus,'passed');
 for(const [oldPath,digest] of Object.entries(report.fixtures[0].before).filter(([name])=>name.startsWith('spectra/sdd/memory-bank/')))assert.equal(inventory(root)[oldPath.replace(/^spectra\//,'.spectra/')],digest);
 report.derivedRefresh=Object.keys(afterFault).filter(name=>name.includes('/system/manifest.env'));
});
scenario('tagged refresh refuses a user-edited authority',({execute,report})=>{
 const root=taggedProject(report);execute(root,['migrate','--yes','--json'],'launcher');const file=path.join(root,'.spectra/sdd/system/manifest.env');fs.appendFileSync(file,'user_edit=preserve\n');const r=execute(root,['migrate','--yes','--json']);assert.equal(r.status,1);unchanged(report);assert.match(json(r).reason,/authority changed|manual recovery/);
});

// Review P1: filtering text lines destroys empty paragraphs in YAML block
// scalars. Check actual parsed unknown values through both migration and repair.
for(const route of ['migration','resume','repair']) scenario(`multiline config survives ${route}`,({fixture,execute,report})=>{
 const root=fixture(route==='repair'?3:2);const config=path.join(root,'.spectra/config.yaml');
 fs.writeFileSync(config,`gitMode: local\nschemaVersion: ${route==='repair'?3:2}\ncustom: |\n  first paragraph\n\n  second paragraph\nnested:\n  custom: |\n    gitMode: this is user text\n\n    schemaVersion: also user text\n`);
 const original=parse(fs.readFileSync(config,'utf8'));
 const compare=()=>{const current=parse(fs.readFileSync(config,'utf8'));assert.equal(current.custom,original.custom);assert.deepEqual(current.nested,original.nested);assert.equal(current.schemaVersion,3);assert.equal(current.gitMode,'local');};
 if(route==='resume'){const failed=execute(root,['migrate','--yes','--json'],'launcher');assert.equal(failed.status,1);compare();success(execute(root,['migrate','--yes','--json']));compare();}
 else{success(execute(root,route==='repair'?['doctor','--fix']:['migrate','--yes','--json']));compare();}
});

scenario('nested user config is valuable and blocks edited resume',({fixture,execute,report})=>{
 const root=fixture();const file=path.join(root,'.spectra/docs/plugin/config.yaml');fs.writeFileSync(file,'custom: original user value\n');const failed=execute(root,['migrate','--yes','--json'],'interrupt');assert.equal(failed.status,87);
 fs.writeFileSync(file,'custom: edited during interruption\n');const result=execute(root,['migrate','--yes','--json']);assert.equal(result.status,1);unchanged(report);assert.match(json(result).reason,/Valuable content changed: .*docs\/plugin\/config.yaml/);assert.equal(fs.readFileSync(file,'utf8'),'custom: edited during interruption\n');
});

for(const route of ['migration','resume','repair']) scenario(`config documentation survives ${route}`,({fixture,execute,report})=>{
 const root=fixture(route==='repair'?3:2);const config=path.join(root,'.spectra/config.yaml');
 fs.writeFileSync(config,`# Operator notes must survive upgrades\ngitMode: local # Keep project artifacts local\nschemaVersion: ${route==='repair'?3:2} # Storage schema explanation\n# Customer documentation for custom fields\ncustom: | # Blank paragraphs are meaningful\n  first paragraph\n\n  second paragraph\nnested:\n  # Nested user documentation\n  value: retained # Nested inline note\n`);
 const original=parse(fs.readFileSync(config,'utf8'));const comments=['Operator notes must survive upgrades','Keep project artifacts local','Storage schema explanation','Customer documentation for custom fields','Blank paragraphs are meaningful','Nested user documentation','Nested inline note'];
 const compare=()=>{const text=fs.readFileSync(config,'utf8');const current=parse(text);for(const comment of comments)assert.ok(text.includes(comment),comment);assert.equal(current.custom,original.custom);assert.deepEqual(current.nested,original.nested);};
 if(route==='resume'){assert.equal(execute(root,['migrate','--yes','--json'],'launcher').status,1);compare();success(execute(root,['migrate','--yes','--json']));compare();}
 else{success(execute(root,route==='repair'?['doctor','--fix']:['migrate','--yes','--json']));compare();}
});
for(const content of ['', '# Configuration intentionally contains only operator comments\n']) scenario(`empty config ${content ? 'comments' : 'blank'} is rejected read-only`,({fixture,execute,report})=>{
 const root=fixture();fs.writeFileSync(path.join(root,'.spectra/config.yaml'),content);for(const args of [['migrate','--check','--json'],['migrate','--yes','--json']]){const r=execute(root,args);assert.equal(r.status,1);unchanged(report);assert.equal(json(r).outcome,'incompatible');assert.match(json(r).reason,/Malformed .*config.yaml.*expected an object/);assert.equal(fs.existsSync(path.join(root,'.spectra/migration.json')),false);assert.equal(fs.existsSync(path.join(root,'.spectra/recovery')),false);}
});
