import fs from 'node:fs';
import {examples} from '../lib/examples.ts';
import {buildContext,validateReport} from '../lib/replay.ts';
const base=process.env.TEST_URL||'http://127.0.0.1:5173';
const c=examples()[0],results=[];
fs.mkdirSync('.test-results',{recursive:true});
for(const perspective of ['before','after']){
 const r=await fetch(base+'/api/replay',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'analyze',case:c,perspective,cutoff:c.trades[0].at}),signal:AbortSignal.timeout(90000)});
 const data=await r.json();const errors=data.report?validateReport(data.report,buildContext(c,perspective,c.trades[0].at)):[];
 results.push({perspective,status:r.status,code:data.code,validationErrors:errors,trace:data.trace,summary:data.report?.summary?.text});
 fs.writeFileSync(`.test-results/live-${perspective}.json`,JSON.stringify(data,null,2));
 console.log(JSON.stringify(results.at(-1)));
}
fs.writeFileSync('.test-results/live-summary.json',JSON.stringify(results,null,2));
if(results.some(r=>r.status!==200||r.validationErrors.length))process.exitCode=1;
