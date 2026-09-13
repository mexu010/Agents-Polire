"use client";
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
export function useChoreography(root, lang, setService) {
 const [intro,setIntro]=useState(false); const previous=useRef(lang);
 useEffect(()=>{
  const reduce=matchMedia('(prefers-reduced-motion: reduce)');
  let seen=true; try { seen=sessionStorage.getItem('polire-refined')==='1'; sessionStorage.setItem('polire-refined','1'); } catch { seen=false; }
  if(seen||reduce.matches||location.hash) return;
  setIntro(true); const stop=()=>setIntro(false); const timer=setTimeout(stop,1600);
  addEventListener('wheel',stop,{passive:true}); addEventListener('keydown',stop); reduce.addEventListener('change',stop);
  return ()=>{clearTimeout(timer);removeEventListener('wheel',stop);removeEventListener('keydown',stop);reduce.removeEventListener('change',stop);};
 },[]);
 useLayoutEffect(()=>{
  if(previous.current===lang)return; previous.current=lang;
  if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  const animations=[...root.current.querySelectorAll('h1,h2,h3,p,.micro-label,.art-notes,.project-art-caption')].map(n=>n.animate([{opacity:.55,translate:'0 3px'},{opacity:1,translate:'0 0'}],{duration:300,easing:'cubic-bezier(.22,.8,.2,1)'}));
  return ()=>animations.forEach(a=>a.cancel());
 },[lang,root]);
 useEffect(()=>{
  const node=root.current, reduce=matchMedia('(prefers-reduced-motion: reduce)'); let frame=0, lastService=-1;
  const story=node.querySelector('.kinetic-story'), footer=node.querySelector('.footer'), headings=[...node.querySelectorAll('.section-heading h2,.services-intro h2,.contact h2')];
  const hero=node.querySelector('.hero'), projects=[...node.querySelectorAll('.project')], steps=[...node.querySelectorAll('.process-list li')];
  const clamp=n=>Math.max(0,Math.min(1,n));
  const update=()=>{
   frame=0; const height=innerHeight;
   // All geometry reads precede writes; no idle animation loop.
   const serviceRows=[...node.querySelectorAll(".service-row")];
   const serviceBoxes=serviceRows.map(n=>n.getBoundingClientRect());
   const storyBox=story.getBoundingClientRect(), footerBox=footer.getBoundingClientRect(), titleBoxes=headings.map(n=>n.getBoundingClientRect());
   const h=hero.getBoundingClientRect(), boxes=projects.map(n=>n.getBoundingClientRect()), rows=steps.map(n=>n.getBoundingClientRect());
   if(innerWidth>860 && !reduce.matches && !node.querySelector('.service-list:hover,.service-list:focus-within')) {
    const candidate=serviceBoxes.findIndex(r=>r.top<=height*.55 && r.bottom>height*.55);
    if(candidate>=0 && candidate!==lastService){lastService=candidate;}
   }
   story.style.setProperty('--story',reduce.matches?1:clamp((height*.5-storyBox.top)/(storyBox.height-height*.5)));
   footer.style.setProperty('--signature',reduce.matches?1:clamp((height-footerBox.top)/(height*.55)));
   headings.forEach((n,i)=>n.style.setProperty('--title-reveal',reduce.matches?1:clamp((height-titleBoxes[i].top)/(height*.3))));
   hero.style.setProperty('--departure',reduce.matches?0:clamp(-h.top/h.height));
   projects.forEach((n,i)=>n.style.setProperty('--reveal',reduce.matches?1:clamp((height-boxes[i].top)/(height*.65))));
   let current=0; rows.forEach((r,i)=>{if(r.top<height*.58)current=i;});
   steps.forEach((n,i)=>n.dataset.current=String(i===current));
   node.querySelector('.process-list').style.setProperty('--process-progress',(current+1)/steps.length);
  };
  const schedule=()=>{if(!frame)frame=requestAnimationFrame(update);};
  const observer=new ResizeObserver(schedule);observer.observe(node);
  addEventListener('scroll',schedule,{passive:true});addEventListener('resize',schedule);reduce.addEventListener('change',schedule);update();
  return ()=>{cancelAnimationFrame(frame);observer.disconnect();removeEventListener('scroll',schedule);removeEventListener('resize',schedule);reduce.removeEventListener('change',schedule);};
 },[root,setService]);
 return {intro,skipIntro:()=>setIntro(false)};
}
