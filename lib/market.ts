import {type Evidence,type ReplayCase,dateOnly} from './replay.ts';
export type MarketState='not_configured'|'unverified'|'verified'|'invalid_credentials'|'permission'|'rate_limit'|'empty'|'timeout'|'network'|'provider'|'schema'|'range'|'not_ready'|'symbol';
export type MarketStatus={state:MarketState;configured:boolean;verifiedAt?:string;checkedAt?:string;message:string;requestId?:string;verificationExpiresAt?:string};
export type MarketQuery={symbol:string;start:string;end:string};
export type MarketResult={evidence:Evidence[];status:MarketStatus;cached:boolean;requestId?:string;fetchedAt:string;query:MarketQuery};
export const marketLabels:Record<MarketState,string>={not_configured:'未配置凭证',unverified:'已配置，尚未验证',verified:'验证成功，可获取行情',invalid_credentials:'凭证无效或授权失效',permission:'缺少历史日线权限',rate_limit:'限流或额度不足',empty:'查询成功，该区间无数据',timeout:'请求超时',network:'无法连接服务',provider:'行情服务异常',schema:'数据格式待核验',range:'查询区间待修正',not_ready:'数据尚未就绪',symbol:'证券代码待核对'};
export function mergeMarketEvidence(c:ReplayCase,incoming:Evidence[]){
  if(c.mode==='synthetic'||c.evidence.some(e=>e.type==='price'&&e.mode==='synthetic'))throw Error('合成价格不能混入真实行情，请新建案例。');
  const keys=new Set(incoming.map(e=>`${e.symbol}|${dateOnly(e.occurredAt)}|none`));
  const retained=c.evidence.filter(e=>!(e.type==='price'&&e.mode==='historical'&&e.source==='扶摇金融数据 API'&&keys.has(`${e.symbol}|${dateOnly(e.occurredAt)}|${e.raw.adjust||'none'}`)));
  const merged=[...retained,...incoming];if(merged.length>1000)throw Error('合并后证据超过一千条，请缩小区间或新建案例。');return merged;
}
