export type Perspective = 'before' | 'after';
export type Origin = 'contemporaneous' | 'recalled';
export type DataMode = 'synthetic' | 'user' | 'historical';
export type Trade = {side:'BUY'|'SELL'; at:string; price:number; quantity:number; fee:number|null};
export type Reason = {id:string; text:string; expected:string; recordedAt:string; origin:Origin; savedAt:string};
export type Evidence = {id:string; type:'trade'|'reason'|'price'|'event'; title:string; symbol:string; source:string; url:string; raw:Record<string,unknown>; availableAt:string; occurredAt:string; fetchedAt:string; precision:'exact'|'date'; unit:string; basis:string; mode:DataMode; status:'ok'|'unverified'|'conflict'; origin?:Origin};
export type Check = {id:string; text:string; checked:boolean; selected:boolean; sourceCase:string; sourceClaim:string; sourceText?:string; formedAt?:string; carriedAt?:string; contentUpdatedAt?:string; sourcePerspective?:Perspective; sourceCutoff?:string};
export type Grounding = {topic:'observation'|'decision_basis'|'consideration'|'psychology'|'causal'|'metric'; relation:'direct'|'conditional'|'gap'|'unknown'; supports:{evidence_id:string;field:string;quote:string}[]; missing_conditions:string[]; alternatives:string[]};
export type Claim = {id:string; kind:'fact'|'inference'|'uncertain'; text:string; evidence_ids:string[]; metric_keys:string[]; grounding?:Grounding};
export type Report = {summary:Claim; facts:Claim[]; hypotheses:Claim[]; biases:Claim[]; uncertainties:Claim[]; checklist:{text:string;claim_id:string}[]};
export type SavedReport = {report:Report; revision:number; perspective:Perspective; cutoff:string; mode:'ai'|'rules'; createdAt:string; trace:string[]; model?:string; validationVersion?:string; adjustments?:{claim_id:string;reason:string}[]};
export type ReplayCase = {id:string; originalCaseId?:string; title:string; symbol:string; mode:DataMode; trades:Trade[]; reasons:Reason[]; evidence:Evidence[]; feeMode:'actual'|'excluded'; corporateAction:'none'|'present'|'unknown'; checklist:Check[]; note:string; revision:number; createdAt:string; report?:SavedReport};
export const uid = () => globalThis.crypto.randomUUID();
export const now = () => new Date().toISOString();
export function dateOnly(v:string) { return new Date(Date.parse(v)+8*3600000).toISOString().slice(0,10); }
export function shanghai(v:string) { return validDate(v) ? new Date(v).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false}) : v; }
export function validDate(v:unknown):v is string {
  if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/.test(v))return false;
  const [y,m,d]=v.slice(0,10).split('-').map(Number); const days=new Date(Date.UTC(y,m,0)).getUTCDate();
  return m>=1&&m<=12&&d>=1&&d<=days&&Number.isFinite(Date.parse(v))&&+v.slice(11,13)<24&&+v.slice(14,16)<60;
}
export function isoInput(v:string) { const s=v.trim();return /^(\d{4}-\d\d-\d\d)T\d\d:\d\d(:\d\d)?$/.test(s)?s+'+08:00':s; }
const finite=(n:unknown):n is number=>typeof n==='number'&&Number.isFinite(n);
export function validateCase(c:ReplayCase):string[] {
  const e:string[]=[];
  if(!c||typeof c!=='object')return ['案例格式错误'];
  if(!c.id||typeof c.id!=='string'||c.id.length>100)e.push('案例 ID 无效');
  if(typeof c.title!=='string'||!c.title.trim()||c.title.length>100)e.push('标题须为 1–100 字');
  if(!/^(6\d{5}\.SH|[03]\d{5}\.SZ|[489]\d{5}\.BJ)$/.test(c.symbol||''))e.push('证券代码须带交易所，如 600519.SH；仅支持 A 股');
  if(!['synthetic','user','historical'].includes(c.mode))e.push('数据模式无效');
  if(!['actual','excluded'].includes(c.feeMode))e.push('费用模式无效');
  if(!['none','present','unknown'].includes(c.corporateAction))e.push('请声明公司行动状态');
  const ts=Array.isArray(c.trades)?c.trades:[];
  if(ts.length<1||ts.length>2||ts[0]?.side!=='BUY'||(ts[1]&&ts[1].side!=='SELL'))e.push('仅支持一次买入及可选的一次全部卖出');
  ts.forEach((t,i)=>{if(!validDate(t.at))e.push(`交易 ${i+1}：日期无效或缺少时区`);if(!finite(t.price)||t.price<=0||t.price>1e7)e.push(`交易 ${i+1}：价格必须为正且不超过一千万元`);if(!Number.isSafeInteger(t.quantity)||t.quantity<=0||t.quantity>1e9)e.push(`交易 ${i+1}：数量须为正整数且不超过十亿股`);if(t.fee!==null&&(!finite(t.fee)||t.fee<0||t.fee>1e12))e.push(`交易 ${i+1}：费用应非负，未知请留空`);});
  if(ts[1]&&(Date.parse(ts[1].at)<=Date.parse(ts[0].at)))e.push('卖出必须晚于买入');
  if(ts[1]&&ts[1].quantity!==ts[0].quantity)e.push('不支持部分卖出或数量变化');
  if(!Array.isArray(c.reasons)||c.reasons.length>100)e.push('理由版本格式错误');
  else c.reasons.forEach(r=>{if(!r.id||!validDate(r.recordedAt)||!validDate(r.savedAt)||!['contemporaneous','recalled'].includes(r.origin)||typeof r.text!=='string'||r.text.length>5000||typeof r.expected!=='string'||r.expected.length>2000)e.push('理由的时间、来源或长度无效');});
  if(!Array.isArray(c.evidence)||c.evidence.length>1000)e.push('最多导入一千条证据');
  else {const ids=new Set<string>();c.evidence.forEach(v=>{if(!v.id||ids.has(v.id)||v.id.startsWith('trade-')||v.id.startsWith('reason-'))e.push('证据 ID 重复或使用了保留前缀');ids.add(v.id);e.push(...validateEvidence(v,c.symbol));});}
  if(!Array.isArray(c.checklist)||c.checklist.length>100||c.checklist.some(x=>typeof x.text!=='string'||x.text.length>2000||typeof x.sourceCase!=='string'||typeof x.sourceClaim!=='string'))e.push('清单格式无效');
  else if(c.checklist.some(x=>[x.formedAt,x.carriedAt,x.contentUpdatedAt,x.sourceCutoff].some(t=>t!==undefined&&!validDate(t))||(x.sourcePerspective!==undefined&&!['before','after'].includes(x.sourcePerspective))))e.push('清单时间或来源视角无效');
  if(typeof c.note!=='string'||c.note.length>10000)e.push('备注格式无效');
  return [...new Set(e)];
}
export function validateEvidence(v:Evidence,symbol:string):string[]{
  const e:string[]=[];if(!v||typeof v!=='object')return ['证据格式错误'];
  if(!['price','event'].includes(v.type)||v.symbol!==symbol)e.push('导入证据仅支持同标的行情或事件');
  if(!validDate(v.availableAt)||!validDate(v.occurredAt)||!validDate(v.fetchedAt))e.push('证据时间无效');
  if(!['date','exact'].includes(v.precision)||!['ok','unverified','conflict'].includes(v.status)||!['synthetic','user','historical'].includes(v.mode))e.push('证据状态无效');
  if(!v.source||!v.title||!v.unit||!v.basis||!v.raw||typeof v.raw!=='object'||Array.isArray(v.raw)||JSON.stringify(v.raw).length>12000)e.push('证据须包含标题、来源、原文、单位及口径');
  if(v.url&&!/^https?:\/\//i.test(v.url))e.push('来源网址须为 http(s)');
  if(v.type==='price'&&(!finite(v.raw?.close)||Number(v.raw.close)<=0))e.push('收盘价字段 close 必须是正数');
  return e;
}
export function allEvidence(c:ReplayCase):Evidence[]{
  return [...c.evidence,...c.trades.map((t,i):Evidence=>({id:`trade-${i}`,type:'trade',title:t.side==='BUY'?'买入记录':'全部卖出记录',symbol:c.symbol,source:c.mode==='synthetic'?'合成交易记录':'用户交易记录，未核验',url:'',raw:{...t},availableAt:t.at,occurredAt:t.at,fetchedAt:c.createdAt,precision:'exact',unit:'人民币元 / 股',basis:'实际成交价；费用按用户填写',mode:c.mode,status:c.mode==='synthetic'?'ok':'unverified'})),...c.reasons.map((r):Evidence=>({id:`reason-${r.id}`,type:'reason',title:r.origin==='recalled'?'事后回忆':'当时理由（用户声明）',symbol:c.symbol,source:c.mode==='synthetic'?'合成理由':'用户提供，未核验',url:'',raw:{text:r.text,expected:r.expected,origin:r.origin,savedAt:r.savedAt},availableAt:r.recordedAt,occurredAt:r.recordedAt,fetchedAt:r.savedAt,precision:'exact',unit:'文本',basis:'保留原始记录时间与版本；时间为用户声明',mode:c.mode,status:c.mode==='synthetic'?'ok':'unverified',origin:r.origin}))].sort((a,b)=>Date.parse(a.availableAt)-Date.parse(b.availableAt));
}
export function exclusion(v:Evidence,cutoff:string):string|null {
  if(v.status==='conflict')return '来源冲突，待核验';
  if(v.origin==='recalled')return '事后回忆，不能证明当时已知';
  if(v.precision==='date'&&dateOnly(v.availableAt)===dateOnly(cutoff))return '同日资料只有日期，公开时点不确定';
  if(!validDate(v.availableAt)||Date.parse(v.availableAt)>Date.parse(cutoff))return '决策之后才可用';
  return null;
}
export function evidenceAt(c:ReplayCase,p:Perspective,cutoff:string){return allEvidence(c).filter(v=>p==='after'?v.status!=='conflict':!exclusion(v,cutoff));}
export type Metrics={status:'realized'|'open'|'blocked';pnl:number|null;returnPct:number|null;cost:number|null;label:string;explanation:string};
export function metrics(c:ReplayCase):Metrics{
  const empty={pnl:null,returnPct:null,cost:null};
  if(validateCase(c).length)return {...empty,status:'blocked',label:'输入待修正',explanation:validateCase(c).join('；')};
  if(!c.trades[1])return {...empty,status:'open',label:'尚未卖出',explanation:'不展示已实现盈亏；未提供可靠估值时点，不计算浮动盈亏'};
  if(c.corporateAction!=='none')return {...empty,status:'blocked',label:'公司行动待核验',explanation:c.corporateAction==='present'?'跨分红、送转或配股不在本版支持范围内':'请确认区间内是否发生影响持股或现金流的公司行动'};
  if(c.feeMode==='actual'&&c.trades.some(t=>t.fee===null))return {...empty,status:'blocked',label:'费用缺失',explanation:'补充实际费用，或明确选择不含费用模式'};
  const [b,s]=c.trades, bf=c.feeMode==='actual'?b.fee!:0,sf=c.feeMode==='actual'?s.fee!:0;
  if([b.price*b.quantity*100,s.price*s.quantity*100,bf*100,sf*100].some(v=>!Number.isFinite(v)||Math.abs(v)>Number.MAX_SAFE_INTEGER/4))return {...empty,status:'blocked',label:'金额超出精度范围',explanation:'交易金额超过本版可可靠计算到分的范围'};
  const pnl=Math.round(((s.price-b.price)*b.quantity-bf-sf)*100)/100,cost=Math.round((b.price*b.quantity+bf)*100)/100;
  return {status:'realized',pnl,returnPct:pnl/cost*100,cost,label:c.feeMode==='actual'?'已实现净盈亏':'已实现价差（不含费用）',explanation:c.feeMode==='actual'?'净盈亏 =（实际卖出成交价 − 实际买入成交价）× 数量 − 双边实际费用；收益率 = 净盈亏 ÷（买入金额 + 买入实际费用）；金额四舍五入到分。历史日线收盘价不参与该公式。':'价差 =（实际卖出成交价 − 实际买入成交价）× 数量；收益率 = 不含费用价差 ÷ 买入金额；不代表净收益。历史日线收盘价不参与该公式。'};
}
export function buildContext(c:ReplayCase,p:Perspective,cutoff:string){
  if(!['before','after'].includes(p)||!validDate(cutoff)||!c.trades.some(t=>t.at===cutoff))throw new Error('请选择有效交易节点');
  const errors=validateCase(c);if(errors.length)throw new Error(errors.join('；'));
  const evidence=evidenceAt(c,p,cutoff);
  // Deliberately omit case title, notes, checklist, future trades and all excluded material.
  const visibleTrades=c.trades.filter(t=>p==='after'||Date.parse(t.at)<=Date.parse(cutoff));
  const m=metrics({...c,trades:visibleTrades});
  return {perspective:p,cutoff,symbol:'当前匿名标的',dataMode:c.mode,evidence:evidence.map(v=>({...v,symbol:'当前匿名标的'})),metrics:m,limitations:['时点取决于来源及用户声明，非完整历史快照','模型可能记得历史，引用约束不能完全消除训练知识影响','引用存在与时间合法不等于语义或因果已证实']};
}
export function csvRows(input:string):string[][]{
  if(input.length>200000)throw new Error('CSV 超过 200KB');
  const rows:string[][]=[];let row:string[]=[],field='',quoted=false;
  const text=input.replace(/^\uFEFF/,'');
  for(let i=0;i<text.length;i++){const ch=text[i];if(ch==='"'){if(quoted&&text[i+1]==='"'){field+='"';i++;}else if(!quoted&&field.length){throw new Error('CSV 引号位置错误');}else quoted=!quoted;}else if(ch===','&&!quoted){row.push(field);field='';}else if((ch==='\n'||ch==='\r')&&!quoted){if(ch==='\r'&&text[i+1]==='\n')i++;row.push(field);if(row.some(x=>x.trim()))rows.push(row);row=[];field='';}else field+=ch;}
  if(quoted)throw new Error('CSV 引号未闭合');row.push(field);if(row.some(x=>x.trim()))rows.push(row);return rows;
}
export const CSV_HEADER='case_title,symbol,side,traded_at,price,quantity,fee,reason,reason_recorded_at,reason_origin';
export const CSV_TEMPLATE=CSV_HEADER+'\n示例导入,600000.SH,BUY,2025-02-10T10:00:00+08:00,10,100,5,等待证据核实,2025-02-10T09:00:00+08:00,contemporaneous\n示例导入,600000.SH,SELL,2025-02-20T14:00:00+08:00,12,100,5,,,\n';
export function blankCase():ReplayCase{return {id:uid(),title:'新的决策案例',symbol:'',mode:'user',trades:[{side:'BUY',at:'',price:0,quantity:100,fee:null}],reasons:[],evidence:[],feeMode:'actual',corporateAction:'unknown',checklist:[],note:'',revision:1,createdAt:now()};}
export function importCSV(input:string):ReplayCase{
  const rows=csvRows(input),headers=rows.shift()?.map(s=>s.trim())||[],required=CSV_HEADER.split(',');
  const missing=required.filter(k=>!headers.includes(k));if(missing.length)throw new Error('缺少列：'+missing.join(', '));
  if(new Set(headers).size!==headers.length)throw new Error('CSV 列名重复');
  if(rows.length<1||rows.length>2)throw new Error('仅支持一行 BUY 及可选的一行 SELL');
  const c=blankCase(); const errors:string[]=[];
  rows.forEach((cells,i)=>{const r=Object.fromEntries(headers.map((k,j)=>[k,(cells[j]||'').trim()]));const row=`第 ${i+2} 行：`;
    if(cells.length!==headers.length)errors.push(row+'列数不匹配');
    if(!r.case_title||!r.symbol||!r.side||!r.traded_at||!r.price||!r.quantity)errors.push(row+'必填字段为空');
    if(i===0){c.title=r.case_title;c.symbol=r.symbol;c.trades=[];}else if(r.symbol!==c.symbol||r.case_title!==c.title)errors.push(row+'必须是同一案例、同一证券');
    if(r.side!==(i===0?'BUY':'SELL'))errors.push(row+'只支持按时间排列的一次 BUY 和一次 SELL');
    const at=isoInput(r.traded_at);if(!validDate(at))errors.push(row+'交易日期无效');
    if(!/^\d+(\.\d+)?$/.test(r.price)||Number(r.price)<=0)errors.push(row+'价格必须为正数');
    if(!/^\d+$/.test(r.quantity)||Number(r.quantity)<=0)errors.push(row+'数量必须为正整数');
    if(r.fee&&!/^\d+(\.\d+)?$/.test(r.fee))errors.push(row+'费用须非负');
    c.trades.push({side:r.side as Trade['side'],at,price:Number(r.price),quantity:Number(r.quantity),fee:r.fee===''?null:Number(r.fee)});
    if(r.reason||r.reason_recorded_at||r.reason_origin){const recordedAt=isoInput(r.reason_recorded_at);if(!r.reason||!validDate(recordedAt)||!['contemporaneous','recalled'].includes(r.reason_origin))errors.push(row+'理由、记录时间、来源须完整且有效');c.reasons.push({id:uid(),text:r.reason,expected:'',recordedAt,origin:r.reason_origin as Origin,savedAt:now()});}
  });
  errors.push(...validateCase(c).map(e=>'交易组合：'+e));if(errors.length)throw new Error(errors.join('\n'));return c;
}
const forbidden=/(保证收益|稳赚|一定上涨|一定下跌|必涨|必跌|建议.{0,8}(买入|卖出|加仓|减仓)|立即(买入|卖出)|仓位.{0,5}\d|buy now|sell now|guaranteed return)/i;
export const unsafeQuestion=(q:string)=>/(买哪|买什么|该不该卖|能不能买|下.{0,3}(买|卖)单|保证收益|帮我.{0,3}(买|卖)|推荐.{0,4}(股票|标的)|should i (buy|sell)|buy order|sell order|guaranteed)/i.test(q);
export function validateReport(r:Report,ctx:ReturnType<typeof buildContext>):string[]{
  const errors:string[]=[];
  if(!r||!r.summary||!['facts','hypotheses','biases','uncertainties','checklist'].every(k=>Array.isArray(r[k as keyof Report])))return ['模型输出结构不完整'];
  const ids=new Set(ctx.evidence.map(e=>e.id)),claims=[r.summary,...r.facts,...r.hypotheses,...r.biases,...r.uncertainties],claimIds=new Set<string>();
  for(const x of claims){
    if(!x||!x.id||claimIds.has(x.id)||!['fact','inference','uncertain'].includes(x.kind)||typeof x.text!=='string'||!Array.isArray(x.evidence_ids)||!Array.isArray(x.metric_keys)){errors.push('结论结构错误或 ID 重复');continue;}claimIds.add(x.id);
    const narratives=[x.text,...(Array.isArray(x.grounding?.missing_conditions)?x.grounding!.missing_conditions:[]),...(Array.isArray(x.grounding?.alternatives)?x.grounding!.alternatives:[])];
    if(narratives.some(t=>typeof t!=='string'||t.length>1800||/\d/.test(t)||forbidden.test(t)||/sk-[A-Za-z0-9]|api.?key|密钥|系统提示/i.test(t)))errors.push('结论包含未授权数字、指令或敏感内容');
    if(x.kind!=='uncertain'&&!x.evidence_ids.length)errors.push('重要结论缺少证据');
    if(x.evidence_ids.some(id=>!ids.has(id)))errors.push('结论引用了不存在或当前时点不可用的证据');
    if(x.metric_keys.some(k=>!['pnl','returnPct','cost'].includes(k)||ctx.metrics[k as 'pnl']===null))errors.push('结论引用无效数值指标');
  }
  if(r.biases.some(x=>x?.kind==='fact'))errors.push('行为偏差只能作为线索或无法判断');
  if(ctx.evidence.some(e=>e.mode==='historical')&&!ctx.evidence.some(e=>e.mode==='synthetic')&&/^(?:本|该|此)?(?:案例|报告|摘要)?[：:，,\s]*(?:是|为|属于)?[\s]*合成示例/.test(r.summary.text))errors.push('摘要将包含真实历史行情的案例整体误标为合成示例；请区分接口行情和用户构造材料');
  if(r.checklist.length<3||r.checklist.length>5)errors.push('检查清单应有三至五项');
  if(r.checklist.some(x=>!x||typeof x.text!=='string'||x.text.length>500||/\d/.test(x.text)||forbidden.test(x.text)||!claimIds.has(x.claim_id)))errors.push('清单文本或来源结论无效');
  return [...new Set(errors)];
}
export function ruleReport(ctx:ReturnType<typeof buildContext>):Report{
  const reason=ctx.evidence.filter(e=>e.type==='reason'),events=ctx.evidence.filter(e=>e.type==='event'),trade=ctx.evidence.find(e=>e.type==='trade');
  const claim=(id:string,text:string,kind:Claim['kind']='uncertain',evidence_ids:string[]=[]):Claim=>({id,text,kind,evidence_ids,metric_keys:[]});
  return {summary:claim('summary','先还原证据，再评价判断。此结果由确定性规则生成，未调用模型。'),facts:trade?[claim('trade','当前视角中存在用户提供的交易记录；其真实性仍需原始凭证核验。','fact',[trade.id])]:[],hypotheses:[reason.length?claim('hypothesis','已找到当前时点可用的理由。请逐条对照原文中的预期条件与支持证据。','inference',reason.map(x=>x.id)):claim('hypothesis','缺少当前时点可用的原始理由，无法还原当时假设。')],biases:[claim('bias','无法仅根据盈亏判断行为偏差。需要补充当时备选方案与反对证据。')],uncertainties:[claim('uncertain',events.length?'事件材料仅提供背景，不能直接证明收益变化的因果贡献。':'事件证据缺失，暂时无法判断假设受哪些外部变化影响。','uncertain',events.map(x=>x.id))],checklist:[{text:'决策前保存原始理由、记录时间和可证伪条件。',claim_id:'hypothesis'},{text:'检查每项证据的公开时间，排除当时不可知的信息。',claim_id:'summary'},{text:'主动记录反对证据和备选解释，避免只用盈亏评价过程。',claim_id:'bias'}]};
}
export function reportMarkdown(c:ReplayCase,p:Perspective,cutoff:string){
  const m=buildContext(c,p,cutoff).metrics,r=c.report;return `# ${c.title}（完整案例存档）\n\n数据模式：${c.mode}；证券：${c.symbol}；时区：Asia/Shanghai；货币：CNY\n\n指标视角：${p}；截止：${cutoff}。下方原始证据包含完整案例的事后信息，不是事前证据包。\n\n${m.label}：${m.pnl??'不可计算'}；收益率：${m.returnPct??'不可计算'}%\n${m.explanation}\n\n`+(r?`## 复盘（${r.mode==='ai'?'真实模型':'规则演示'}；${r.revision===c.revision&&r.perspective===p&&r.cutoff===cutoff?'对应当前版本和视角':'历史报告，与当前版本或视角不一致'}）\n生成：${r.createdAt}；视角：${r.perspective}；截止：${r.cutoff}\n\n`+[r.report.summary,...r.report.facts,...r.report.hypotheses,...r.report.biases,...r.report.uncertainties].map(x=>`- [${x.kind}] ${x.text}（依据：${x.evidence_ids.join(', ')||'无'}）`).join('\n'):'尚未生成复盘')+`\n\n## 学习清单\n${c.checklist.map(x=>`- [${x.checked?'x':' '}] ${x.text}（来源案例 ${x.sourceCase} / 结论 ${x.sourceClaim}；结论摘录：${x.sourceText||'早期清单未保存摘录'}；形成：${x.formedAt||'时间未确认'}；带入：${x.carriedAt||'未记录'}；修改：${x.contentUpdatedAt||'未修改'}；来源视角：${x.sourcePerspective||'未确认'}）`).join('\n')}\n\n## 原始证据\n${allEvidence(c).map(e=>`### ${e.id} ${e.title}\n来源：${e.source} ${e.url}\n公开/可用：${e.availableAt}；发生：${e.occurredAt}；抓取：${e.fetchedAt}\n模式：${e.mode}；状态：${e.status}；精度：${e.precision}；单位：${e.unit}；口径：${e.basis}\n原始字段：${JSON.stringify(e.raw)}\n`).join('\n')}\n\n## 边界\n仅用于历史决策学习；不提供交易建议。用户来源未核验，模型历史知识影响不能完全排除，引用校验不能证明因果。案例仅保存在当前浏览器，不是云同步。\n`;
}
