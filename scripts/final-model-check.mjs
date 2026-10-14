import fs from 'node:fs';
import {examples} from '../lib/examples.ts';
import {buildContext,validateReport} from '../lib/replay.ts';
import {validateGrounding} from '../lib/grounding.ts';
// Explicit opt-in: at most two product requests; each may internally retry once.
if(!process.argv.includes('--live'))throw Error('Use --live only in the authorized runtime. This makes real API calls.');
const base=process.env.TEST_URL||'http://127.0.0.1:5191',c=examples()[0];
c.title='原失败语义复验｜合成测试';c.reasons=[{...c.reasons[0],text:'关注价格变化，但需要经营证据验证，价格本身不能证明原因。',expected:''}];c.evidence=c.evidence.filter(e=>e.type==='price');
const results=[];fs.mkdirSync('.test-results',{recursive:true});
for(const perspective of ['before','after']){
 const response=await fetch(base+'/api/replay',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'analyze',case:c,perspective,cutoff:c.trades[0].at}),signal:AbortSignal.timeout(135000)}),data=await response.json(),ctx=buildContext(c,perspective,c.trades[0].at);
 const errors=data.report?[...validateReport(data.report,ctx),...validateGrounding(data.report,ctx)]:['没有返回报告'];
 results.push({perspective,status:response.status,code:data.code,error:data.error,trace:data.trace,validationVersion:data.validationVersion,errors,report:data.report,adjustments:data.adjustments,checkedAt:new Date().toISOString()});
 if(response.status!==200){process.exitCode=1;continue;}
 if(errors.length||data.validationVersion!=='grounding-v1')process.exitCode=1;
}
fs.writeFileSync('.test-results/final-live-model.json',JSON.stringify({base,results,semanticReview:'结构检查不能替代人工语义抽查；请逐段确认没有补写依据权重或动机。'},null,2));
console.log(JSON.stringify(results.map(({report,...summary})=>summary),null,2));
