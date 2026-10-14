import {type Evidence,dateOnly} from './replay.ts';
export type ChartAxis='sessions'|'calendar';
export function chartSeries(evidence:Evidence[]){
  const groups=new Map<string,Evidence[]>();
  for(const e of evidence){if(e.type!=='price'||e.status==='conflict'||!Number.isFinite(Number(e.raw.close))||Number(e.raw.close)<=0)continue;const key=`${e.mode}|${e.source}|${e.raw.adjust||e.basis}`;groups.set(key,[...(groups.get(key)||[]),e]);}
  return [...groups].map(([key,points])=>({key,label:({historical:'真实历史',synthetic:'合成示例',user:'用户录入'})[points[0].mode]+' · '+points[0].source,points:points.sort((a,b)=>Date.parse(a.occurredAt)-Date.parse(b.occurredAt))}));
}
export function chartGeometry(points:Evidence[],width:number,axis:ChartAxis='sessions'){
  const left=64,right=Math.max(left+80,width-24),top=24,bottom=252;
  const values=points.map(e=>Number(e.raw.close)),lo=Math.min(...values),hi=Math.max(...values),pad=Math.max((hi-lo)*.14,Math.max(hi,.01)*.008),min=lo-pad,max=hi+pad;
  const first=Date.parse(points[0]?.occurredAt||''),last=Date.parse(points.at(-1)?.occurredAt||'');
  const dots=points.map((e,i)=>({e,x:points.length===1?(left+right)/2:left+(axis==='sessions'?i/(points.length-1):(Date.parse(e.occurredAt)-first)/Math.max(last-first,1))*(right-left),y:bottom-(Number(e.raw.close)-min)/(max-min)*(bottom-top)}));
  const budget=Math.max(2,Math.min(7,Math.floor((right-left)/100))),ticks=[...new Set(Array.from({length:Math.min(budget,points.length)},(_,i)=>Math.round(i*(points.length-1)/Math.max(Math.min(budget,points.length)-1,1))))].map(i=>({x:dots[i].x,label:dateOnly(points[i].occurredAt),id:points[i].id}));
  return {left,right,top,bottom,min,max,dots,ticks,path:dots.map((v,i)=>`${i?'L':'M'}${v.x},${v.y}`).join(' ')};
}
