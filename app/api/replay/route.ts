import {env} from 'cloudflare:workers';
import {buildContext,ruleReport,now,validateCase} from '../../../lib/replay';
import {fetchMarket,ServiceError} from '../../../lib/adapters';
import {analyze} from '../../../lib/ai';
import {requestSchema} from '../../../lib/request-schema';
import {marketStatus,queryMarket} from '../../../lib/market-service';
import {defaultMarketQuery} from '../../../lib/adapters';
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const config=()=>env as unknown as Record<string,string|undefined>;
const rate=new Map<string,{time:number;count:number}>();
export async function GET(){return json({aiConfigured:!!config().OPENAI_API_KEY,marketConfigured:!!config().FUYAO_API_KEY,marketStatus:await marketStatus(config().FUYAO_API_KEY),model:config().OPENAI_MODEL||'gpt-5-mini',data:'案例仅保存于当前浏览器；分析时发送当前案例的允许证据至服务端及 OpenAI。'});}
export async function POST(request:Request){
  const trace:string[]=[];
  try{
    const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin)throw new ServiceError('origin','仅允许本站请求',403);
    if(!request.headers.get('content-type')?.includes('application/json'))throw new ServiceError('content_type','需要 JSON 输入',415);
    if(Number(request.headers.get('content-length')||0)>300000)throw new ServiceError('size','请求超过大小限制',413);
    const reader=request.body?.getReader();if(!reader)throw new ServiceError('input','请求内容为空',400);let size=0,text='';const decoder=new TextDecoder();while(true){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>300000){await reader.cancel();throw new ServiceError('size','请求超过大小限制',413);}text+=decoder.decode(part.value,{stream:true});}text+=decoder.decode();
    let data:unknown;try{data=JSON.parse(text);}catch{throw new ServiceError('input','输入不是有效 JSON',400);}
    const parsed=requestSchema.safeParse(data);if(!parsed.success)throw new ServiceError('input','案例字段不完整或超出支持范围',400);
    const {case:c,perspective,cutoff,action,question=''}=parsed.data;
    const errors=validateCase(c);if(errors.length)throw new ServiceError('input',errors.join('；'),400);
    trace.push('案例格式与交易组合校验通过');
    const identity=request.headers.get('oai-authenticated-user-id')||request.headers.get('cf-connecting-ip')||'local';const ts=Date.now(),entry=rate.get(identity);if(rate.size>1000)rate.clear();if(entry&&ts-entry.time<60000){if(entry.count>=12)throw new ServiceError('rate_limit','请求较频繁，请一分钟后重试',429);entry.count++;}else rate.set(identity,{time:ts,count:1});
    if(action==='market'){if(c.mode==='synthetic')throw new ServiceError('input','合成案例不能混入真实行情，请新建案例。',422);trace.push('请求扶摇历史日线（不复权）');const result=await queryMarket(defaultMarketQuery(c),config().FUYAO_API_KEY);trace.push(`已取得 ${result.evidence.length} 条行情`);return json({...result,trace});}
    const context=buildContext(c,perspective,cutoff);trace.push(`服务端时点筛选：${context.evidence.length} 条可用证据`);trace.push('取证需求：原始理由、同区间行情、公开事件；仅使用已导入或已获取的证据，不自动补齐缺失项');
    const result=action==='rules'?{report:ruleReport(context),attempts:0,adjustments:[]}:await analyze(context,question,config().OPENAI_API_KEY,config().OPENAI_MODEL||'gpt-5-mini');
    const report=result.report;
    trace.push(action==='rules'?'确定性规则已执行；未调用模型':`真实模型生成 ${result.attempts} 次；结构、数值引用及证据时点校验通过${result.attempts>1?'；首次无效结果未展示':''}`);
    if(action==='analyze')trace.push(`原文片段已逐字核验；服务端重建 ${result.adjustments.length} 条敏感推断或计算说明。该检查不是彻底消除幻觉的证明。`);
    return json({report,revision:c.revision,perspective,cutoff,mode:action==='rules'?'rules':'ai',createdAt:now(),trace,model:action==='analyze'?(config().OPENAI_MODEL||'gpt-5-mini'):undefined,validationVersion:'grounding-v1',adjustments:result.adjustments});
  }catch(e){const err=e instanceof ServiceError?e:new ServiceError('invalid','输入或处理失败，请检查数据后重试',400);return json({error:err.message,code:err.code,trace:[...trace,`失败：${err.code}`]},err.status);}
}
