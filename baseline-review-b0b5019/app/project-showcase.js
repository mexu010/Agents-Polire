"use client";
import {useRef,useState} from 'react';
export default function ProjectShowcase({project,labels}) {
 const [split,setSplit]=useState(34); const drag=useRef(null);
 return <article className={`project project-${project.tone}`}>
  <div className="project-meta"><span className="case-mark"><i aria-hidden="true"/>SELECTED STUDY</span><span>{project.discipline}</span></div>
  <div className={project.tone==='blue'?'comparison':'showcase-frame'} style={{'--split':`${split}%`}}>
   <div className="project-visual">
    <div className="project-art" aria-hidden="true">{project.tone==='blue'?<div className="engineering-sculpture"><i/><i/><i/><i/><i/></div>:<div className="editorial-monogram">&amp;</div>}</div>
    <div className="project-visual-copy"><span className="micro-label">{project.artLabel}</span><strong>{project.artTitle.map((line,i)=><span key={i}>{line}</span>)}</strong><span className="project-art-caption">{project.artCaption}</span></div>
   </div>
   {project.tone==='blue'&&<><div className="comparison-before" aria-hidden="true"><div className="draft-nav">{labels.draftBrand}<span>01 / 02 / 03</span></div><div className="draft-content"><small>{labels.before}</small><strong>{labels.draftTitle}</strong><p>{labels.draftText}</p><div className="draft-blocks"><i/><i/><i/></div></div></div><div className="comparison-line" aria-hidden="true"><span onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);drag.current=e.currentTarget.closest('.comparison').getBoundingClientRect();}} onPointerMove={e=>{if(drag.current)setSplit(Math.max(0,Math.min(100,Math.round((e.clientX-drag.current.left)/drag.current.width*100))));}} onPointerUp={()=>drag.current=null} onPointerCancel={()=>drag.current=null}>↔</span></div><div className="comparison-labels" aria-hidden="true"><span>{labels.before}</span><span>{labels.after}</span></div><label className="comparison-control"><span>{labels.compare}</span><input type="range" min="0" max="100" value={split} onChange={e=>setSplit(Number(e.target.value))} aria-label={labels.compare}/><span aria-hidden="true">↔</span></label></>}
  </div>
  <div className="project-copy"><h3>{project.title}</h3><p>{project.statement}</p><ul>{project.tags.map((tag,i)=><li key={i}>{tag}</li>)}</ul></div>
 </article>;
}
