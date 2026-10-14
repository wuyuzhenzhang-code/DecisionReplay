import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
// Never print matched content. Includes exact local credential comparison in memory.
const root=process.cwd(),git=(args)=>execFileSync('git',['-c',`safe.directory=${root}`,...args],{encoding:'utf8'});
const files=[...new Set(git(['ls-files','--cached','--others','--exclude-standard']).trim().split(/\r?\n/).filter(Boolean))];
const secrets=[];
for(const name of ['.env.local','.env','.dev.vars'])if(fs.existsSync(name)){
  for(const line of fs.readFileSync(name,'utf8').split(/\r?\n/)){const m=line.match(/^\s*([\w]+)\s*=\s*["']?([^\r\n]+?)["']?\s*$/);if(m&&/KEY|SECRET|TOKEN/.test(m[1])&&m[2].length>=16)secrets.push(m[2]);}
}
const issues=[];
for(const file of files){
  if(!fs.existsSync(file)||!fs.statSync(file).isFile())continue;
  if(/(^|\/)(\.env(?:\..*)?|\.dev.vars(?:\..*)?|.*\.(pem|key))$/.test(file)&&file!=='.env.example')issues.push({file,category:'environment-or-private-key-file'});
  const text=fs.readFileSync(file,'utf8');
  if(/sk-(?:proj-)?[A-Za-z0-9_-]{24,}|gh[pousr]_[A-Za-z0-9]{20,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(text))issues.push({file,category:'credential-pattern'});
  if(secrets.some(secret=>text.includes(secret)))issues.push({file,category:'exact-local-secret'});
  if(/https?:\/\/[^\s/]+:[^\s@]+@/.test(text))issues.push({file,category:'credential-in-url'});
  if(/(?:production|local)-(?:after|before|browser-export)\.json$/.test(file))issues.push({file,category:'market-or-case-export-requires-review'});
}
const result={checkedAt:new Date().toISOString(),scope:'tracked and nonignored source files; patterns and exact local secrets; not a formal privacy audit',fileCount:files.length,issues};
fs.mkdirSync('.test-results',{recursive:true});fs.writeFileSync('.test-results/security-scan.json',JSON.stringify(result,null,2));console.log(JSON.stringify({fileCount:files.length,issues}));if(issues.length)process.exitCode=1;
