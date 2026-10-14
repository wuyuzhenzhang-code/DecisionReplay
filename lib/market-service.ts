import {fetchMarket,ServiceError,type MarketQuery} from './adapters.ts';
import {blankCase,now} from './replay.ts';
import {type MarketStatus,type MarketResult} from './market.ts';
const cache=new Map<string,{expires:number;result:MarketResult}>(),pending=new Map<string,Promise<MarketResult>>(),states=new Map<string,MarketStatus>();
const TTL=15*60*1000;
async function identity(key:string){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(key)))).map(x=>x.toString(16).padStart(2,'0')).join('');}
export async function marketStatus(key?:string):Promise<MarketStatus>{
  if(!key)return {state:'not_configured',configured:false,message:'站点所有者尚未配置扶摇历史日线凭证。'};
  const status=states.get(await identity(key));
  if(status&&status.verificationExpiresAt&&Date.parse(status.verificationExpiresAt)>Date.now())return status;
  return {state:'unverified',configured:true,message:'凭证已配置，请点击测试连接，以真实查询验证权限。',checkedAt:status?.checkedAt,verifiedAt:status?.verifiedAt};
}
export async function queryMarket(query:MarketQuery,key?:string,fetcher:typeof fetch=fetch,force=false):Promise<MarketResult>{
  if(!key)throw new ServiceError('not_configured','未配置行情凭证，请查看配置说明。',503);
  const credential=await identity(key),cacheKey=credential+'|'+JSON.stringify(query),hit=cache.get(cacheKey);
  if(!force&&hit&&hit.expires>Date.now())return {...hit.result,cached:true};
  const running=pending.get(cacheKey);if(running)return running;
  const operation=(async()=>{
    try{const c=blankCase();c.symbol=query.symbol;const evidence=await fetchMarket(c,key,fetcher,query);
      const checkedAt=now(),status:MarketStatus={state:'verified',configured:true,checkedAt,verifiedAt:checkedAt,verificationExpiresAt:new Date(Date.now()+TTL).toISOString(),message:'已通过真实历史日线查询验证；仅代表当前接口及本次区间可用。'};
      states.set(credential,status);if(states.size>100)states.delete(states.keys().next().value!);
      const result:MarketResult={evidence,status,cached:false,requestId:typeof evidence[0].raw.request_id==='string'?evidence[0].raw.request_id:undefined,fetchedAt:evidence[0].fetchedAt,query};
      if(cache.size>=100)cache.delete(cache.keys().next().value!);cache.set(cacheKey,{expires:Date.now()+TTL,result});return result;
    }catch(e){const err=e instanceof ServiceError?e:new ServiceError('provider','行情处理失败，请稍后重试。');
      if(['invalid_credentials','permission'].includes(err.code)){states.set(credential,{state:err.code as 'permission',configured:true,checkedAt:now(),verificationExpiresAt:new Date(Date.now()+TTL).toISOString(),message:err.message});for(const k of cache.keys())if(k.startsWith(credential+'|'))cache.delete(k);}
      throw err;
    }finally{pending.delete(cacheKey);}
  })();pending.set(cacheKey,operation);return operation;
}
