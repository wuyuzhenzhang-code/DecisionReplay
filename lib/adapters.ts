import {type ReplayCase,type Evidence,dateOnly,now} from './replay.ts';
export class ServiceError extends Error{code:string;status:number;requestId?:string;constructor(code:string,message:string,status=502,requestId?:string){super(message);this.code=code;this.status=status;this.requestId=requestId;}}
export function providerError(status:number,code?:number|string):ServiceError|null{
  if(status===401||status===403||code===2001||code===2003)return new ServiceError('permission','服务权限不足或凭据缺失，请检查服务端配置后重试',403);
  if(status===429||code===429)return new ServiceError('rate_limit','服务限流，请稍后重试',429);
  if(status>=400||code!==undefined&&code!==0)return new ServiceError('provider','服务暂不可用，请重试；原证据仍然保留',502);
  return null;
}
export async function getJSON(url:string,init:RequestInit={},fetcher:typeof fetch=fetch,timeout=20000):Promise<unknown>{
  for(let attempt=0;attempt<2;attempt++){
    try{const response=await fetcher(url,{...init,signal:AbortSignal.timeout(timeout)});if(response.status>=500&&attempt===0)continue;const err=providerError(response.status);if(err)throw err;try{return await response.json();}catch{throw new ServiceError('schema','服务返回了无法识别的数据格式');}}
    catch(e){if(e instanceof ServiceError)throw e;if(e instanceof Error&&['TimeoutError','AbortError'].includes(e.name))throw new ServiceError('timeout','请求超时，请稍后重试',504);if(attempt===1)throw new ServiceError('network','无法连接外部服务，请检查网络或重试',503);}
  }throw new ServiceError('network','服务连接失败');
}
export type MarketQuery={symbol:string;start:string;end:string};
export function validateMarketQuery(q:MarketQuery){
  if(!/^(6\d{5}\.SH|[03]\d{5}\.SZ|[489]\d{5}\.BJ)$/.test(q.symbol))throw new ServiceError('input','请输入带交易所的 A 股代码，例如 600000.SH。',400);
  const valid=(s:string)=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s;
  if(!valid(q.start)||!valid(q.end)||q.end<q.start)throw new ServiceError('range','请填写有效日期，结束日期不能早于开始日期。',400);
  if(Date.parse(q.end)-Date.parse(q.start)>3*366*86400000)throw new ServiceError('range','每次最多获取三年的日线，请缩小日期范围。',400);
  if(q.end>dateOnly(now()))throw new ServiceError('range','结束日期不能晚于今天。',400);
}
export function defaultMarketQuery(c:ReplayCase):MarketQuery{return {symbol:c.symbol,start:dateOnly(new Date(Date.parse(c.trades[0].at)-7*86400000).toISOString()),end:dateOnly(c.trades[1]?.at||c.trades[0].at)};}
export function fuyaoError(http:number,code?:number,requestId?:string){
  const id=requestId&&/^[\w.-]{1,100}$/.test(requestId)?requestId:undefined;
  if(http===429||code===4001||code===429)return new ServiceError('rate_limit','请求较多或额度不足，请稍后重试，并在官方账户中核对额度。',429,id);
  if(http===401||code===2001)return new ServiceError('invalid_credentials','凭证无效或授权已失效，请站点所有者在官方平台核对密钥并重新配置。',401,id);
  if(http===403||code===2003)return new ServiceError('permission','当前凭证没有历史日线权限，请在扶摇平台确认并申请该接口权限。',403,id);
  if(code===3001||code===3004)return new ServiceError('symbol','没有找到支持的 A 股标的，请核对代码及交易所。',422,id);
  if(code===3002)return new ServiceError('not_ready','该标的数据尚未就绪，请稍后或更换日期区间。',503,id);
  if(code===5002)return new ServiceError('timeout','行情服务响应超时，请稍后重试；已有证据保持不变。',504,id);
  if(http>=400||(code!==undefined&&code!==0))return new ServiceError('provider','行情服务暂时异常，请稍后重试；已有证据保持不变。',502,id);
  return null;
}
export function parseFuyao(payload:unknown,c:Pick<ReplayCase,'symbol'>,query?:MarketQuery):Evidence[]{
  const p=payload as {code:number;data?:{item?:Record<string,unknown>[]};request_id?:string};
  if(!p||typeof p.code!=='number')throw new ServiceError('schema','扶摇响应字段变化：缺少 code');
  const err=fuyaoError(200,p.code,p.request_id);if(err)throw err;
  const items=p.data?.item;if(!Array.isArray(items))throw new ServiceError('schema','扶摇响应字段变化：缺少 data.item');
  if(!items.length)throw new ServiceError('empty','查询成功，但目标区间没有返回行情；请核对非交易日、停牌或日期覆盖，不填补假数据。',422,p.request_id&&/^[\w.-]{1,100}$/.test(p.request_id)?p.request_id:undefined);
  if(items.length>1000)throw new ServiceError('range','区间过长，请缩短至三年以内',422);
  const fetchedAt=now(),requestId=typeof p.request_id==='string'&&/^[\w.-]{1,100}$/.test(p.request_id)?p.request_id:undefined;
  const evidence=items.map((r):Evidence=>{
    if(typeof r.date_ms!=='number'||!Number.isFinite(r.date_ms)||typeof r.close_price!=='number'||!Number.isFinite(r.close_price)||r.close_price<=0)throw new ServiceError('schema','行情存在缺失或变化字段：date_ms / close_price');
    if(Math.abs(r.date_ms)>8.64e15)throw new ServiceError('schema','行情日期超出可识别范围。');
    const d=dateOnly(new Date(r.date_ms).toISOString());
    if(query&&(d<query.start||d>query.end))throw new ServiceError('range','返回行情超出了请求区间，已阻止导入，请核对数据源。',502,requestId);
    const raw:Record<string,unknown>={date_ms:r.date_ms,close:r.close_price,close_price:r.close_price,request_id:requestId??null,adjust:'none',interval:'1d',market_date:d,availability_rule:'行情日次日 00:00（项目保守规则，非原始发布时间）'};
    for(const k of ['open_price','high_price','low_price','volume','turnover'])if(r[k]!==undefined){if(typeof r[k]!=='number'||!Number.isFinite(r[k])||Number(r[k])<0||k.endsWith('_price')&&Number(r[k])===0)throw new ServiceError('schema','行情存在非法价格或成交字段，已阻止导入。');raw[k]=r[k];}
    if(typeof r.high_price==='number'&&typeof r.low_price==='number'&&(r.high_price<r.low_price||r.close_price>r.high_price||r.close_price<r.low_price))throw new ServiceError('schema','行情高低价与收盘价不一致，已阻止导入。');
    const next=new Date(Date.parse(d+'T00:00:00+08:00')+86400000).toISOString();
    return {id:`fuyao-${c.symbol}-none-${d}`,type:'price',title:`历史日线 · ${d}`,symbol:c.symbol,source:'扶摇金融数据 API',url:'https://fuyao.aicubes.cn/docs/api-reference/prices/',raw,availableAt:next,occurredAt:d+'T15:00:00+08:00',fetchedAt,precision:'exact',unit:'CNY 元 / 股',basis:'历史日线；不复权。采用行情日次日 00:00 可用的保守规则；不代表原始公开时间或严格历史时点快照。',mode:'historical',status:'ok'};
  });
  const dates=new Set<string>();for(const e of evidence){const d=dateOnly(e.availableAt);if(dates.has(d))throw new ServiceError('conflict','同一交易日返回多条价格，需核验冲突');dates.add(d);}
  return evidence.sort((a,b)=>Date.parse(a.occurredAt)-Date.parse(b.occurredAt));
}
export async function fetchMarket(c:ReplayCase,key?:string,fetcher:typeof fetch=fetch,query=defaultMarketQuery(c),timeout=12000){
  if(!key)throw new ServiceError('not_configured','扶摇凭据未配置。可导入行情或事件，已有证据不会被替换。',503);
  validateMarketQuery(query);
  if(query.symbol!==c.symbol)throw new ServiceError('symbol','行情代码必须与当前案例一致。',400);
  const start=Date.parse(query.start+'T00:00:00+08:00'),end=Date.parse(query.end+'T23:59:59.999+08:00');
  const q=new URLSearchParams({thscode:c.symbol,interval:'1d',start:String(start),end:String(end),adjust:'none'});
  for(let attempt=0;attempt<2;attempt++){
    try{
      const response=await fetcher('https://fuyao.aicubes.cn/api/a-share/prices/historical?'+q,{headers:{'X-api-key':key},signal:AbortSignal.timeout(timeout),redirect:'manual'});
      // Workerd supports manual/follow only. Never forward the key to a redirect destination.
      if(response.status>=300&&response.status<400)throw new ServiceError('redirect','行情服务地址发生跳转，已停止请求；请联系站点维护者核对官方地址。',502);
      let payload:unknown;try{payload=await response.json();}catch{const error=fuyaoError(response.status);throw error||new ServiceError('schema','行情响应格式无法识别，请稍后重试。');}
      const envelope=payload as {code?:number;request_id?:string};const httpError=fuyaoError(response.status,typeof envelope?.code==='number'?envelope.code:undefined,envelope?.request_id);if(httpError)throw httpError;
      return parseFuyao(payload,c,query);
    }catch(e){const err=e instanceof ServiceError?e:e instanceof Error&&['TimeoutError','AbortError'].includes(e.name)?new ServiceError('timeout','行情请求超时，请稍后重试。',504):new ServiceError('network','暂时无法连接行情服务，请检查网络后重试。',503);if(attempt===0&&['timeout','network','provider'].includes(err.code)){await new Promise(r=>setTimeout(r,350));continue;}throw err;}
  }throw new ServiceError('network','行情服务暂不可用。',503);
}
