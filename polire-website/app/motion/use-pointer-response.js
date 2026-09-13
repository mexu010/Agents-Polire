"use client";
import {useEffect} from 'react';
export function usePointerResponse(root) {
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: no-preference) and (pointer: fine)");
    let frame = 0, target, bounds;
    const move = event => {
      if (!media.matches) return;
      const element = event.target.closest(".magnetic, .hero-art");
      if (target && target !== element) target.style.removeProperty("transform");
      if (target !== element) bounds = element?.getBoundingClientRect();
      target = element;
      cancelAnimationFrame(frame);
      if (!element) return;
      const { clientX, clientY } = event;
      frame = requestAnimationFrame(() => {
        const rect = bounds;
        const x = (clientX - rect.left - rect.width / 2) / rect.width;
        const y = (clientY - rect.top - rect.height / 2) / rect.height;
        if(element.classList.contains('hero-art')) {element.style.setProperty('--pointer-x',x);element.style.setProperty('--pointer-y',y);} else element.style.transform=`translate(${x*9}px, ${y*7}px)`;
      });
    };
    const reset = () => { cancelAnimationFrame(frame); target?.style.removeProperty("transform"); target?.style.removeProperty("--pointer-x"); target?.style.removeProperty("--pointer-y"); target=null; bounds=null; };
    const node = root.current;
    node.addEventListener("pointermove", move, { passive: true }); node.addEventListener("pointerleave", reset); media.addEventListener("change", reset); window.addEventListener("scroll", reset, {passive:true});
    return () => { reset(); node.removeEventListener("pointermove", move); node.removeEventListener("pointerleave", reset); media.removeEventListener("change", reset); window.removeEventListener("scroll", reset); };
  }, []);

}
