'use client';
import {useState} from 'react';
import {type ReplayCase,now,shanghai} from '../lib/replay';
import {editLearning,historicalLearning,learningEligibility} from '../lib/learning';

export function LearningPanel({c,cases,before,cutoff,onChange,onReuse}:{c:ReplayCase;cases:ReplayCase[];before:boolean;cutoff:string;onChange:(c:ReplayCase)=>void;onReuse:()=>void}){
  const [prepare,setPrepare]=useState(false),historical=before&&!prepare;
  const items=historical?historicalLearning(c,cutoff):c.checklist;
  return <section className="checklist"><div className="section-title"><h3>{historical?'历史事前可用学习项':'现在准备下一次决策'}</h3><span>{items.length} 项</span></div>
    {before&&<div className="segmented"><button className={!prepare?'selected':''} onClick={()=>setPrepare(false)}>历史时点</button><button className={prepare?'selected':''} onClick={()=>setPrepare(true)}>当前学习管理</button></div>}
    <p className="muted small">{historical?'仅展示在所选决策之前已形成并带入的内容。勾选表示你现在完成检查，不证明历史上已完成。':'这里使用今天已知的学习内容，不代表历史决策时已经知道；不会进入历史事前证据或模型上下文。'}</p>
    {items.map(item=><div className="check-item" key={item.id}><label className="check-box"><input type="checkbox" aria-label="完成检查项" checked={item.checked} onChange={e=>onChange({...c,checklist:c.checklist.map(x=>x.id===item.id?{...x,checked:e.target.checked}:x)})}/></label><div>
      <textarea aria-label="检查项内容" rows={2} value={item.text} readOnly={historical} onChange={e=>onChange({...c,checklist:c.checklist.map(x=>x.id===item.id?editLearning(x,e.target.value,now()):x)})}/>
      <div className="check-source"><span>来源：{cases.find(x=>x.id===item.sourceCase)?.title||'导入案例'} · {item.sourceClaim}<small className="source-excerpt">{item.sourceText||'早期清单未保存来源结论摘录'}</small></span><label><input type="checkbox" checked={item.selected} onChange={e=>onChange({...c,checklist:c.checklist.map(x=>x.id===item.id?{...x,selected:e.target.checked}:x)})}/>复用</label></div>
      <p className="muted small">形成：{item.formedAt?shanghai(item.formedAt):'时间未确认'} · 来源视角：{item.sourcePerspective==='before'?'事前':item.sourcePerspective==='after'?'事后':'未确认'}<br/>带入：{item.carriedAt?shanghai(item.carriedAt):'未记录'}{item.contentUpdatedAt&&<> · 修改：{shanghai(item.contentUpdatedAt)}</>}<br/>{learningEligibility(item,c.id,cutoff,c.originalCaseId).reason}</p>
      {!historical&&<button className="text-button" onClick={()=>onChange({...c,checklist:c.checklist.filter(x=>x.id!==item.id)})}>删除检查项</button>}
    </div></div>)}
    {!items.length&&<p className="empty">{historical?'当前没有符合历史时点条件的学习项。可在当前学习管理区查看保留内容。':'生成复盘后可保存、编辑和复用学习清单。'}</p>}
    {historical&&c.checklist.length>items.length&&<p className="muted small">另有 {c.checklist.length-items.length} 项因形成、带入、修改时间或来源视角不符合而排除。</p>}
    <button className="reuse-button" disabled={!c.checklist.some(x=>x.selected)} onClick={onReuse}>用于下一次决策 →</button><span className="saved-hint">修改即时保存在此浏览器</span>
  </section>;
}
