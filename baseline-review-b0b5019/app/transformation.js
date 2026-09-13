"use client";
import {useEffect,useRef,useState} from "react";

export default function Transformation({lang="de"}) {
  const ref=useRef(null); const [p,setP]=useState(0);
  useEffect(()=>{
    let raf=0;
    const update=()=>{raf=0;const el=ref.current;if(!el)return;const r=el.getBoundingClientRect();const range=Math.max(1,r.height-window.innerHeight);setP(Math.max(0,Math.min(1,-r.top/range)));};
    const onScroll=()=>{if(!raf)raf=requestAnimationFrame(update)};update();addEventListener("scroll",onScroll,{passive:true});addEventListener("resize",onScroll);return()=>{removeEventListener("scroll",onScroll);removeEventListener("resize",onScroll);cancelAnimationFrame(raf)};
  },[]);
  const steps=["Structure","Type","Motion","Detail","Presence"]; const active=Math.min(4,Math.floor(p*5));
  const de=lang==="de";
  return <section className="transform-story" ref={ref} style={{"--transform-p":p,"--transform-step":active}} aria-label={de?"POLIRE Transformation":"POLIRE transformation"}>
    <div className="transform-sticky">
      <div className="transform-top"><span>POLIRE / REFINEMENT STUDY</span><span>{String(active+1).padStart(2,"0")} — 05</span></div>
      <div className="transform-stage">
        <div className="transform-copy"><span className="transform-kicker">{de?"Vom Gewöhnlichen":"From ordinary"}</span><strong><span>Generic.</span><span>Distinct.</span></strong><p>{de?"Nicht mehr hinzufügen. Das Richtige schärfen.":"Not adding more. Refining what matters."}</p></div>
        <div className="transform-canvas" aria-hidden="true">
          <div className="transform-frame"><div className="tf-nav"><i/><i/><i/></div><div className="tf-type"><b>POLIRE</b><span>Digital presence</span></div><div className="tf-rule"/><div className="tf-block tf-a"/><div className="tf-block tf-b"/><div className="tf-block tf-c"/><div className="tf-mark">P</div></div>
        </div>
      </div>
      <div className="transform-steps">{steps.map((s,i)=><span key={s} className={i===active?"is-active":""}><i>{String(i+1).padStart(2,"0")}</i>{s}</span>)}</div>
      <div className="transform-end"><span>{de?"Das Ergebnis":"The result"}</span><strong>We refine digital presence.</strong></div>
    </div>
  </section>;
}
