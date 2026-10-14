import {env} from 'cloudflare:workers';
import {marketStatus,queryMarket} from '../../../lib/market-service';
import {ServiceError,validateMarketQuery} from '../../../lib/adapters';
const limits=new Map<string,{at:number;count:number}>();
const key=()=>(env as unknown as Record<string,string|undefined>).FUYAO_API_KEY;
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
export async function GET(){return json(await marketStatus(key()));}
export async function POST(request:Request){
  try{
    if(request.headers.get('origin')&&request.headers.get('origin')!==new URL(request.url).origin)throw new ServiceError('origin','请从本站发起行情请求。',403);
    if(!request.headers.get('content-type')?.includes('application/json'))throw new ServiceError('input','需要有效的查询信息。',415);
    const reader=request.body?.getReader();let bytes=0,text='';if(!reader)throw new ServiceError('input','查询信息为空。',400);const decoder=new TextDecoder();while(true){const p=await reader.read();if(p.done)break;bytes+=p.value.length;if(bytes>2048){await reader.cancel();throw new ServiceError('input','查询内容过长。',413);}text+=decoder.decode(p.value,{stream:true});}text+=decoder.decode();
    let body;try{body=JSON.parse(text);}catch{throw new ServiceError('input','查询格式不正确。',400);}
    if(!['fetch','test'].includes(body.action))throw new ServiceError('input','不支持的操作。',400);
    const query=body.action==='test'?{symbol:'600000.SH',start:'2025-02-05',end:'2025-02-07'}:body.query;
    if(!query||typeof query.symbol!=='string'||typeof query.start!=='string'||typeof query.end!=='string')throw new ServiceError('input','请选择股票和起止日期。',400);
    validateMarketQuery(query);
    const id=request.headers.get('oai-authenticated-user-id')||request.headers.get('cf-connecting-ip')||'local',entry=limits.get(id),at=Date.now();if(entry&&at-entry.at<60000){if(entry.count>=8)throw new ServiceError('rate_limit','操作较频繁，请一分钟后重试。',429);entry.count++;}else limits.set(id,{at,count:1});if(limits.size>2000)limits.clear();
    const result=await queryMarket(query,key(),fetch,body.action==='test');
    if(body.action==='test')return json({status:result.status,query,count:result.evidence.length,requestId:result.requestId,cached:result.cached});
    return json(result);
  }catch(e){const err=e instanceof ServiceError?e:new ServiceError('provider','服务暂时异常，请稍后重试。');return json({error:err.message,code:err.code,requestId:err.requestId,status:await marketStatus(key())},err.status);}
}
