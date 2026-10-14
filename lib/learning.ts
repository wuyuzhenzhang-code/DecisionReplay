import type {Check, ReplayCase, SavedReport} from './replay.ts';

const stamp=(v?:string)=>v&&/^\d{4}-\d\d-\d\dT.*(?:Z|[+-]\d\d:\d\d)$/.test(v)?Date.parse(v):NaN;
export function learningEligibility(item:Check,caseId:string,cutoff:string,originalCaseId?:string):{eligible:boolean;reason:string}{
  const sameCase=item.sourceCase===caseId||item.sourceCase===originalCaseId;
  if(!Number.isFinite(stamp(item.formedAt)))return {eligible:false,reason:'形成时间未确认，仅供当前学习管理使用'};
  if(!Number.isFinite(stamp(cutoff)))return {eligible:false,reason:'请先确定决策时间'};
  if(sameCase&&item.sourcePerspective==='after')return {eligible:false,reason:'本案例事后复盘形成，不进入本案例历史事前视角'};
  if(!sameCase&&!Number.isFinite(stamp(item.carriedAt)))return {eligible:false,reason:'带入时间未确认'};
  const times=[item.formedAt,item.carriedAt,item.contentUpdatedAt].filter((v):v is string=>v!==undefined);
  if(times.some(v=>!Number.isFinite(stamp(v))))return {eligible:false,reason:'时间未确认'};
  if(times.some(v=>stamp(v)>stamp(cutoff)))return {eligible:false,reason:'形成、带入或内容修改晚于决策时点'};
  return {eligible:true,reason:'按记录时间，在该决策之前已可用；导入时间声明未经独立核验'};
}
export const historicalLearning=(c:ReplayCase,cutoff:string)=>c.checklist.filter(x=>learningEligibility(x,c.id,cutoff,c.originalCaseId).eligible);
export function reuseLearning(items:Check[],at:string):Check[]{
  return items.filter(x=>x.selected).map(x=>({...x,id:crypto.randomUUID(),checked:false,carriedAt:at}));
}
export function editLearning(item:Check,text:string,at:string):Check{
  return text===item.text?item:{...item,text,contentUpdatedAt:at};
}
export function checksFromReport(caseId:string,saved:SavedReport):Check[]{
  const r=saved.report,claims=[r.summary,...r.facts,...r.hypotheses,...r.biases,...r.uncertainties];
  return r.checklist.map(x=>({id:crypto.randomUUID(),text:x.text,checked:false,selected:true,sourceCase:caseId,sourceClaim:x.claim_id,sourceText:claims.find(v=>v.id===x.claim_id)?.text,formedAt:saved.createdAt,sourcePerspective:saved.perspective,sourceCutoff:saved.cutoff}));
}
