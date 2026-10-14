import {caseSchema} from './request-schema.ts';
import {uid,validateCase,type ReplayCase} from './replay.ts';
export function importCaseJSON(raw:string):ReplayCase{
  const parsed=JSON.parse(raw),next:ReplayCase=caseSchema.parse(parsed.case||parsed);
  next.originalCaseId=next.originalCaseId||next.id;
  next.id=uid();next.report=undefined;next.revision=1;
  const errors=validateCase(next);if(errors.length)throw Error(errors.join('；'));
  return next;
}
