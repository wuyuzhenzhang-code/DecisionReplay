'use client';
import {useEffect,useId,useRef,useState} from 'react';
import {Maximize2,Table2,Layers3} from 'lucide-react';
import {type Evidence,dateOnly,shanghai} from '../lib/replay';
import {chartSeries,chartGeometry,type ChartAxis} from '../lib/chart';
export function PriceChart({evidence,onSelect}:{evidence:Evidence[];onSelect:(e:Evidence)=>void}){
  const host=useRef<HTMLDivElement>(null),[width,setWidth]=useState(640),[axis,setAxis]=useState<ChartAxis>('sessions'),[selected,setSelected]=useState(''),[hover,setHover]=useState(''),[table,setTable]=useState(false),[large,setLarge]=useState(false),gradient=useId().replace(/:/g,'');
  useEffect(()=>{if(!host.current)return;const observer=new ResizeObserver(([e])=>setWidth(Math.max(260,e.contentRect.width)));observer.observe(host.current);return()=>observer.disconnect();},[]);
  const groups=chartSeries(evidence),group=groups.find(x=>x.key===selected)||groups[0],points=group?.points||[],g=points.length?chartGeometry(points,width,axis):null,focused=points.find(e=>e.id===hover)||points.at(-1);
  return <div className={'chart-engine '+(large?'chart-expanded':'')} ref={host}>
    <div className="chart-tools"><div className="series-label"><span className="purple-dot"/>{group?.label||'暂无价格数据'}</div><div className="chart-tool-actions"><select aria-label="时间轴排列" value={axis} onChange={e=>setAxis(e.target.value as ChartAxis)}><option value="sessions">交易日等距</option><option value="calendar">自然日间距</option></select><button className="icon" aria-label={large?'收起图表':'放大图表'} onClick={()=>setLarge(!large)}><Maximize2 size={16}/></button><button className="icon" aria-label="查看行情数据表" aria-pressed={table} onClick={()=>setTable(!table)}><Table2 size={17}/></button></div></div>
    {groups.length>1&&<label className="series-choice">价格来源分别展示<select aria-label="价格来源" value={group.key} onChange={e=>{setSelected(e.target.value);setHover('');}}>{groups.map(s=><option key={s.key} value={s.key}>{s.label}</option>)}</select></label>}
    {focused?<div className="price-readout" aria-live="polite"><strong>{Number(focused.raw.close).toFixed(2)}<small>元 / 股</small></strong><span>{dateOnly(focused.occurredAt)} · 收盘价 · {focused.mode==='historical'?'不复权':focused.mode==='synthetic'?'合成数据':'用户声明口径'}</span><button onClick={()=>onSelect(focused)}>查看原始证据 ↗</button></div>:<div className="chart-empty"><Layers3 size={28}/><p>这个时点还没有可用的价格</p><small>可在“行情数据”中获取，或导入带来源的价格证据。</small></div>}
    {g&&<svg className="price-chart" viewBox={`0 0 ${width} 302`} width={width} height={large?420:302} role="img" aria-label={`当前视角收盘价：${points.length} 条，${axis==='sessions'?'交易日等距':'自然日间距'}`}>
      <defs><linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#7952ed" stopOpacity=".19"/><stop offset="100%" stopColor="#7952ed" stopOpacity="0"/></linearGradient></defs>
      {[0,.25,.5,.75,1].map(t=><g key={t}><line x1={g.left} x2={g.right} y1={g.top+t*(g.bottom-g.top)} y2={g.top+t*(g.bottom-g.top)} stroke="#e9e7f1" strokeDasharray="3 5"/><text x={g.left-12} y={g.top+t*(g.bottom-g.top)+4} textAnchor="end">{(g.max-t*(g.max-g.min)).toFixed(2)}</text></g>)}
      <path d={`${g.path} L${g.dots.at(-1)!.x},${g.bottom} L${g.dots[0].x},${g.bottom} Z`} fill={`url(#${gradient})`}/><path d={g.path} stroke="#7851e8" strokeWidth="2.8" fill="none" strokeLinejoin="round"/>
      {g.dots.map(({e,x,y})=><g key={e.id} role="button" tabIndex={0} aria-label={`${dateOnly(e.occurredAt)} 收盘 ${Number(e.raw.close).toFixed(2)} 元，查看证据`} onMouseEnter={()=>setHover(e.id)} onFocus={()=>setHover(e.id)} onClick={()=>onSelect(e)} onKeyDown={k=>{if(k.key==='Enter'||k.key===' '){k.preventDefault();onSelect(e);}}}><circle cx={x} cy={y} r={points.length>70?7:12} fill="transparent"/>{(points.length<70||hover===e.id)&&<circle cx={x} cy={y} r={hover===e.id?5:3.5} fill="white" stroke="#7851e8" strokeWidth="2"/>}<title>{dateOnly(e.occurredAt)} 收盘 {e.raw.close as number} 元</title></g>)}
      {g.ticks.map(t=><text key={t.id} x={t.x} y="286" textAnchor="middle">{t.label.slice(5)}</text>)}
    </svg>}
    {points.length>0&&<div className="axis-note"><span>{dateOnly(points[0].occurredAt)} — {dateOnly(points.at(-1)!.occurredAt)} · {points.length} 条已知行情</span><span>{axis==='sessions'?'仅排列有数据的交易日，不补零':'空缺日期不补零；连线不代表期间有成交'}</span></div>}
    {table&&<div className="price-table"><table><caption>当前视角允许的行情；点击行可查看来源与请求编号</caption><thead><tr><th>行情日期</th><th>收盘（元 / 股）</th><th>本次获取时间</th></tr></thead><tbody>{points.map(e=><tr key={e.id}><td><button onClick={()=>onSelect(e)}>{dateOnly(e.occurredAt)}</button></td><td>{Number(e.raw.close).toFixed(2)}</td><td>{shanghai(e.fetchedAt)}</td></tr>)}</tbody></table></div>}
  </div>;
}
