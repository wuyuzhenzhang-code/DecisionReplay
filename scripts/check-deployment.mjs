import {writeFile,mkdir} from 'node:fs/promises';
import {examples} from '../lib/examples.ts';
import {buildContext,validateReport} from '../lib/replay.ts';
const base=process.argv[2],label=process.argv[3]||'environment';
if(!base||!/^https?:\/\//.test(base))throw Error('Provide the deployed or local URL.');
const records={checkedAt:new Date().toISOString(),base,authentication:'No cookies, key, or service token supplied',checks:[]};
async function call(path,body){const response=await fetch(base+path,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined,redirect:'manual',signal:AbortSignal.timeout(140000)});const data=await response.json();return {status:response.status,data};}
const config=await call('/api/replay'),market=await call('/api/market');records.checks.push({name:'runtime-config',...config},{name:'market-status',...market});
const connection=await call('/api/market',{action:'test'});records.checks.push({name:'minimal-real-market-connection-attempt',...connection});
const c=examples()[0];for(const perspective of ['before','after']){const result=await call('/api/replay',{action:'rules',case:c,perspective,cutoff:c.trades[0].at});const context=buildContext(c,perspective,c.trades[0].at);const validation=result.data.report?validateReport(result.data.report,context):['no report'];records.checks.push({name:'rule-'+perspective,status:result.status,validation,evidenceCount:context.evidence.length,metrics:context.metrics});if(result.status!==200||validation.length)throw Error('Replay regression failed');}
if(process.argv.includes('--ai')){const result=await call('/api/replay',{action:'analyze',case:c,perspective:'before',cutoff:c.trades[0].at});const validation=result.data.report?validateReport(result.data.report,buildContext(c,'before',c.trades[0].at)):['no report'];records.checks.push({name:'live-ai-before',status:result.status,mode:result.data.mode,model:result.data.model,trace:result.data.trace,validation,error:result.data.error});}
await mkdir('.test-results',{recursive:true});await writeFile(`.test-results/${label}.json`,JSON.stringify(records,null,2));
console.log(JSON.stringify(records,null,2));
