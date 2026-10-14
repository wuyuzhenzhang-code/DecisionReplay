import type {Claim, Grounding, Report, buildContext} from './replay.ts';
import mapping from './simplified-map.json' with {type:'json'};

type Context=ReturnType<typeof buildContext>;
// Windows NLS simplified-Chinese character map, generated locally; unmappable
// characters are excluded. This map is applied ONLY to generated narrative fields.
const simplified=(s:string)=>Array.from(s,x=>(mapping as Record<string,string>)[x]||x).join('');
export function simplifyReport(input:Report):Report{
  const r=structuredClone(input);
  for(const x of [r.summary,...r.facts,...r.hypotheses,...r.biases,...r.uncertainties]){
    x.text=simplified(x.text);
    if(x.grounding){x.grounding.missing_conditions=x.grounding.missing_conditions.map(simplified);x.grounding.alternatives=x.grounding.alternatives.map(simplified);}
  }
  r.checklist=r.checklist.map(x=>({...x,text:simplified(x.text)}));return r;
}
const topics=['observation','decision_basis','consideration','psychology','causal','metric'];
export function validateGrounding(r:Report,ctx:Context):string[]{
  const errors:string[]=[];
  for(const x of [r.summary,...r.facts,...r.hypotheses,...r.biases,...r.uncertainties]){
    const g=x.grounding;
    if(!g||!topics.includes(g.topic)||!['direct','conditional','gap','unknown'].includes(g.relation)||!Array.isArray(g.supports)||!Array.isArray(g.missing_conditions)||!Array.isArray(g.alternatives)){errors.push('结论缺少支持关系、原文片段或缺失条件');continue;}
    if(g.supports.length>8||g.missing_conditions.length>4||g.alternatives.length>4||[...g.missing_conditions,...g.alternatives].some(t=>typeof t!=='string'||t.length>500))errors.push('支持说明超出长度范围');
    if(x.kind!=='uncertain'&&x.metric_keys.length===0&&!g.supports.length)errors.push('重要结论没有原文支持片段');
    if(g.relation==='conditional'&&(!g.missing_conditions.length||!g.alternatives.length))errors.push('条件推断缺少条件或替代解释');
    for(const s of g.supports){
      const e=ctx.evidence.find(e=>e.id===s.evidence_id);
      const raw=e&&Object.hasOwn(e.raw,s.field)?e.raw[s.field]:undefined;
      // Exact field substring, not title/source/URL/model explanation; scalar only.
      if(!e||!x.evidence_ids.includes(s.evidence_id)||typeof s.quote!=='string'||!s.quote.trim()||s.quote.length>2000||!['string','number','boolean'].includes(typeof raw)||!String(raw).includes(s.quote))errors.push('原文片段不属于允许证据的指定原始字段');
    }
  }
  return [...new Set(errors)];
}

// Independent routing examines text as well as model labels. Model self-labels
// never authorize sensitive inferences. Sensitive narrative is server-rendered.
const sensitive=/(依据|驱动|动机|考虑|权重|忽略|基本面|经营|心理|偏差|情绪|追涨|杀跌|锚定|过度自信|从众|损失厌恶|确认偏误|导致|造成|归因|因果|原因|因为|由于|促使|出于|冲动|恐慌|贪婪|理性|倾向|主要|证明|影响|注意力|关注|依赖|看重|优先|重视|着眼|建立在|建立于|推动)/;
const metricText=/(净盈亏|净收益|收益率|盈亏.{0,8}(公式|计算)|收盘.{0,8}(计算|盈亏))/;
function explicitBasis(ctx:Context){
  const eligible=ctx.evidence.filter(e=>e.type==='reason'&&e.origin==='contemporaneous');
  const clauses=eligible.flatMap(e=>String(e.raw.text||'').split(/[。！？；\n]/).map(quote=>({e,quote:quote.trim()})));
  // Deliberately narrow positive grammar. No substring-only matches inside
  // negation, hypotheticals, quotation or third-person descriptions.
  const supported=clauses.filter(({quote})=>/^(?:我(?:当时)?|当时)?(?:仅依据价格|只依据价格|仅凭价格|只看价格)(?:[，,、](?:我)?(?:未查看|没有查看|没看)(?:经营资料|经营信息|基本面资料|基本面信息))?[，,。]?$/.test(simplified(quote)));
  const contradictory=eligible.some(e=>/(并非|不是|不只|不仅|没有仅|综合|结合|同时依据|主要依据经营|已经查看|已查看)/.test(simplified(String(e.raw.text||''))));
  return {supported,contradictory};
}
const gap='本次材料没有说明各项依据的实际权重。关注价格不等于以价格为主要依据；未提交经营证据也不等于当时没有或未考虑经营依据。请补充当时实际查看的资料、备选解释及决策记录，再判断依据权重。';
export function enforceSemantics(input:Report,ctx:Context):{report:Report;adjustments:{claim_id:string;reason:string}[]}{
  const report=structuredClone(input),adjustments:{claim_id:string;reason:string}[]=[],basis=explicitBasis(ctx);
  const claims=[report.summary,...report.facts,...report.hypotheses,...report.biases,...report.uncertainties];
  for(const x of claims){
    const g=x.grounding!;
    if(x.metric_keys.length||g.topic==='metric'||metricText.test(x.text)){
      x.text=ctx.metrics.pnl===null?'当前视角不具备完整的可计算成交记录，不能展示已实现净盈亏。':'盈亏仅按实际买卖成交价、成交数量和所选费用口径计算。历史日线收盘价不参与该公式；盈亏本身不能证明决策依据或因果。';
      x.kind=ctx.metrics.pnl===null?'uncertain':'fact';x.evidence_ids=ctx.evidence.filter(e=>e.type==='trade').map(e=>e.id);x.metric_keys=ctx.metrics.pnl===null?[]:[...new Set([...x.metric_keys,'pnl'])];
      x.grounding={topic:'metric',relation:'direct',supports:[],missing_conditions:[],alternatives:[]};
      adjustments.push({claim_id:x.id,reason:'数值解释由确定性计算口径替换'});continue;
    }
    const scope=g.topic!=='observation'||sensitive.test(x.text)||sensitive.test([...g.missing_conditions,...g.alternatives].join(' '));
    if(!scope)continue;
    const isPsych=g.topic==='psychology'||/(心理|偏差|情绪|追涨|锚定|过度自信|从众|损失厌恶|确认偏误|恐慌|贪婪)/.test(x.text);
    const isCausal=g.topic==='causal'||/(导致|造成|归因|因果|促使)/.test(x.text);
    let text=gap,kind:Claim['kind']='uncertain',supports:Grounding['supports']=[];
    if(basis.supported.length&&!basis.contradictory&&!isCausal){
      supports=basis.supported.map(({e,quote})=>({evidence_id:e.id,field:'text',quote}));
      text=isPsych?'原始理由明确记载仅依据价格。这为检查当时的信息选择提供了线索；它本身不足以诊断心理偏差。还需核对备选方案及反对材料，也可能只是记录简略。':'原始理由明确记载仅依据价格，可据此讨论该次记录的信息选择。此判断仅适用于该段自述，不证明实际执行情况或其他决策习惯；需要核对完整记录，也可能存在未记下的其他依据。';
      kind='inference';
    }else if(basis.contradictory&&basis.supported.length){text='理由记录对决策依据存在不同表述，尚不能确定实际依据及权重。请核对各版本适用的决策时点，并说明哪项记录反映实际判断。';}
    else if(isPsych){text='现有材料不足以判断心理状态或特定行为偏差。请补充当时的备选方案、反对证据及实际判断记录；价格变化、盈亏或资料缺失均不能单独证明心理偏差。';}
    else if(isCausal){text='当前材料不能确定交易动机或市场变化的因果关系。时间先后和价格相关变化只提供检验线索；还需独立的机制证据，并比较其他可能影响因素。';}
    x.text=text;x.kind=kind;x.metric_keys=[];
    x.evidence_ids=supports.length?[...new Set(supports.map(s=>s.evidence_id))]:ctx.evidence.filter(e=>e.type==='reason').map(e=>e.id);
    x.grounding={topic:isPsych?'psychology':isCausal?'causal':'decision_basis',relation:supports.length?'conditional':'unknown',supports,missing_conditions:['完整的当时决策记录及依据权重'],alternatives:['存在本次未提交或当时未记录的其他依据']};
    adjustments.push({claim_id:x.id,reason:'依据原文权限重建敏感推断，原断言未展示'});
  }
  // Learning advice must not preserve a rejected assertion through a different field.
  report.checklist=report.checklist.map(x=>sensitive.test(x.text)?{...x,text:'决策前保存实际查阅的资料、依据权重与备选解释，并核对信息当时是否可用。'}:x);
  return {report,adjustments};
}
