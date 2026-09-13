"use client";
import {useEffect,useRef,useState} from 'react';
import PolireMark from './mark';
export default function HeroSculpture({visual,motion}) {
 const [expanded,setExpanded]=useState(false); const [paused,setPaused]=useState(false); const root=useRef(null);
 useEffect(()=>{const observer=new IntersectionObserver(([entry])=>{root.current.dataset.inView=String(entry.isIntersecting);},{threshold:.1});observer.observe(root.current);return()=>observer.disconnect();},[]);
 return <div className="hero-art" data-expanded={expanded} data-paused={paused} ref={root}>
  <span className="art-index">{visual.label}</span>
  <div className="sculpture-space" aria-hidden="true">
   <div className="sculpture-stack">{Array.from({length:7},(_,i)=><div key={i} className="sculpture-plane" style={{'--plane':i}}><PolireMark/><span className="plane-line"/></div>)}</div>
   <span className="sculpture-shadow"/><span className="sculpture-coordinate">P / 01—07</span>
  </div>
  <button className="sculpture-toggle" type="button" aria-pressed={expanded} onClick={()=>setExpanded(!expanded)}><span>{expanded?motion.assemble:motion.explode}</span><span aria-hidden="true">{expanded?'−':'+'}</span></button>
  <button className="sculpture-pause" type="button" aria-label={paused?motion.resume:motion.pause} aria-pressed={paused} onClick={()=>setPaused(!paused)}>{paused?"▶":"Ⅱ"}</button>
  <div className="art-notes" aria-hidden="true">{visual.notes.map((note,i)=><span key={i}><i>0{i+1}</i>{note}</span>)}</div>
 </div>;
}
