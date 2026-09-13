"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import PolireMark from "./mark";
import { sectionIds } from "./content";

// Native anchors and scroll spy share the CSS clearance, independent of nav animation.
export function useSectionNavigation(lang) {
  const [active, setActive] = useState("home");
  const anchor = useRef(null);
  const rememberPosition = () => {
    const sections = [...document.querySelectorAll("main > section[id]")];
    const clearance = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--nav-clearance"));
    const section = sections.findLast(node => node.getBoundingClientRect().top <= clearance + 2) || sections[0];
    if (section) anchor.current = { id: section.id, top: section.getBoundingClientRect().top };
  };
  useLayoutEffect(() => {
    if (anchor.current) {
      const node = document.getElementById(anchor.current.id);
      if (node) window.scrollBy({ top: node.getBoundingClientRect().top - anchor.current.top, behavior: "instant" });
      anchor.current = null;
    }
    document.documentElement.lang = lang;
  }, [lang]);
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const clearance = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--nav-clearance"));
      let current = "home";
      for (const node of document.querySelectorAll("main > section[data-nav-section]")) {
        if (node.getBoundingClientRect().top <= clearance + 4) current = node.id;
      }
      setActive(current);
      document.documentElement.classList.toggle("is-scrolled", window.scrollY > 30);
      const progress = window.scrollY / Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      document.documentElement.style.setProperty("--scroll-progress", Math.min(1, progress));
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    const resize = new ResizeObserver(schedule);
    resize.observe(document.querySelector("main"));
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    update();
    return () => {
      cancelAnimationFrame(frame); resize.disconnect();
      window.removeEventListener("scroll", schedule); window.removeEventListener("resize", schedule);
      document.documentElement.classList.remove("is-scrolled");
    };
  }, []);
  return { active, rememberPosition };
}

export default function Navigation({ t, lang, changeLanguage, active }) {
  const [open, setOpen] = useState(false);
  const [closing,setClosing]=useState(false); const wasOpen=useRef(false);
  useEffect(()=>{if(open){wasOpen.current=true;setClosing(false);return;} if(!wasOpen.current)return; wasOpen.current=false;setClosing(true);const timer=setTimeout(()=>setClosing(false),350);return()=>clearTimeout(timer);},[open]);
  const links = useRef(null), header = useRef(null), toggle = useRef(null);
  useLayoutEffect(() => {
    const container = links.current;
    const update = () => {
      const item = container.querySelector(`[href="#${active}"]`);
      container.style.setProperty("--lens-opacity", item ? "1" : "0");
      if (item) {
        const lens=container.querySelector('.nav-lens');
        if(!matchMedia('(prefers-reduced-motion: reduce)').matches) lens.animate([{scale:'1 1'},{scale:'1.12 .96',offset:.35},{scale:'1 1'}],{duration:380,easing:'cubic-bezier(.22,.8,.2,1)'});
        container.style.setProperty("--lens-x", `${item.offsetLeft}px`);
        container.style.setProperty("--lens-w", `${item.offsetWidth}px`);
      }
    };
    const observer = new ResizeObserver(update);
    observer.observe(container);
    for (const item of container.querySelectorAll("a")) observer.observe(item);
    update();
    return () => observer.disconnect();
  }, [active, lang]);
  useEffect(() => {
    if (!open) return;
    const background = [...document.querySelectorAll('main,footer,.skip-link')];
    background.forEach(node => node.inert = true);
    const onKey = event => {
      if (event.key === "Escape") { setOpen(false); toggle.current?.focus(); }
      if (event.key === 'Tab') {
        const items=[...header.current.querySelectorAll('a,button')].filter(n=>n.getClientRects().length);
        const first=items[0],last=items.at(-1);
        if(event.shiftKey && document.activeElement===first){event.preventDefault();last.focus();}
        else if(!event.shiftKey && document.activeElement===last){event.preventDefault();first.focus();}
      }
    };
    const onPointer = event => { if (!header.current?.contains(event.target)) setOpen(false); };
    const onResize = () => { if (window.innerWidth > 860) setOpen(false); };
    document.addEventListener("keydown", onKey); document.addEventListener("pointerdown", onPointer); window.addEventListener("resize", onResize);
    return () => { background.forEach(node => node.inert = false); document.removeEventListener("keydown", onKey); document.removeEventListener("pointerdown", onPointer); window.removeEventListener("resize", onResize); };
  }, [open]);
  const closeMenu = id => {
    setOpen(false);
    const target=document.getElementById(id); if(target) { target.inert=false; target.closest('main')?.removeAttribute('inert'); target.focus({preventScroll:true}); }
  };
  const navLink = id => <a key={id} href={`#${id}`} aria-current={active === id ? "location" : undefined} onClick={() => closeMenu(id)}>{t.nav[id]}</a>;
  return <header className="nav-shell" ref={header}>
    <nav className="nav wrap" aria-label={t.ui.navigation}>
      <a className="brand" href="#home" aria-label={`POLIRE · ${t.nav.home}`} onClick={() => closeMenu("home")}><PolireMark /><span>POLIRE</span></a>
      <div className="nav-links" ref={links}><span className="nav-lens" aria-hidden="true" />{sectionIds.map(navLink)}</div>
      <div className="nav-actions">
        <button className="lang" type="button" onClick={changeLanguage} aria-label={t.ui.language}>{t.lang}</button>
        <a className="nav-cta magnetic" href="#contact">{t.nav.contact}<span aria-hidden="true">↗</span></a>
        <button ref={toggle} className="menu-toggle" type="button" aria-label={open ? t.ui.closeMenu : t.ui.openMenu} aria-expanded={open} aria-controls="mobile-navigation" onClick={() => setOpen(!open)}><span /><span /></button>
      </div>
    </nav>
    <nav id="mobile-navigation" className={`mobile-nav wrap${closing ? " is-closing" : ""}`} aria-label={t.ui.mobileNavigation} hidden={!open && !closing} inert={!open} aria-hidden={!open}>
      {sectionIds.map(navLink)}<a className="mobile-cta" href="#contact" onClick={() => closeMenu("contact")}>{t.nav.contact}<span aria-hidden="true">↗</span></a><p className="mobile-menu-note">{t.ui.studioNote} · {t.ui.country}</p>
    </nav>
  </header>;
}
