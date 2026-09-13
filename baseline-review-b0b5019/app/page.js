"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ACTIVE_HERO, content, heroVariants, site } from "./content";
import {usePointerResponse} from "./motion/use-pointer-response";
import HeroSculpture from "./hero-sculpture";
import KineticStory from "./kinetic-story";
import ProjectShowcase from "./project-showcase";
import Transformation from "./transformation";
import { useChoreography } from "./motion/use-choreography";
import PolireMark from "./mark";
import Navigation, { useSectionNavigation } from "./navigation";

function Arrow() { return <span className="arrow" aria-hidden="true">↗</span>; }
export default function Home() {
  const [lang, setLang] = useState("de");
  const [service, setService] = useState("01");
  const root = useRef(null);
  const { intro, skipIntro } = useChoreography(root, lang, setService);
  const { active, rememberPosition } = useSectionNavigation(lang);
  const t = content[lang], hero = heroVariants[ACTIVE_HERO][lang];
  useEffect(() => {
    const syncLanguage = () => setLang(new URLSearchParams(window.location.search).get("lang") === "en" ? "en" : "de");
    syncLanguage(); window.addEventListener("popstate", syncLanguage); return () => window.removeEventListener("popstate", syncLanguage);
  }, []);
  usePointerResponse(root);
  const changeLanguage = () => { rememberPosition(); const next = lang === "de" ? "en" : "de"; const url = new URL(window.location.href); if (next === "en") url.searchParams.set("lang", next); else url.searchParams.delete("lang"); window.history.replaceState(null, "", url); setLang(next); };
  return <div className={`site-shell${intro ? " is-intro" : ""}`} ref={root}>
    <a className="skip-link" href="#home">{t.ui.skip}</a><Navigation t={t} lang={lang} changeLanguage={changeLanguage} active={active} />
    <main>{intro && <button className="intro-skip" onClick={skipIntro}>{t.motion.skipIntro} ↗</button>}
      <section id="home" data-nav-section tabIndex={-1} className="hero wrap" aria-labelledby="hero-title"><HeroSculpture visual={t.heroVisual} motion={t.motion}/><div className="hero-copy"><p className="eyebrow">{t.eyebrow}</p><h1 id="hero-title" className="hero-title">{hero.title.map((line,index)=><span key={index} className={index===1?"hero-accent":undefined}><span aria-label={line}>{line.split(" ").map((word,i)=><span className="hero-word" key={i} aria-hidden="true" style={{"--word":i}}>{word}{" "}</span>)}</span></span>)}</h1><p className="hero-text">{hero.text}</p><div className="hero-actions"><a className="button button-dark magnetic" href="#contact">{hero.primary}<Arrow /></a><a className="text-link" href="#work">{hero.secondary}<span aria-hidden="true">↓</span></a></div></div><div className="hero-foot"><span>{t.ui.studioNote}</span><span>{t.ui.scroll} <span aria-hidden="true">↓</span></span></div></section>
      <section id="work" data-nav-section tabIndex={-1} className="work section wrap" aria-labelledby="work-title"><div className="section-heading"><p className="section-label">01 / {t.workKicker}</p><h2 id="work-title">{t.workTitle}</h2><p>{t.workIntro}</p></div><KineticStory motion={t.motion}/><Transformation lang={lang}/><div className="projects">{t.projects.slice(1).map(project=><ProjectShowcase key={project.number} project={project} labels={t.motion}/>)}</div></section>
      <section id="services" data-nav-section tabIndex={-1} className="services section" style={{"--service-tone":Number(service||1)}} aria-labelledby="services-title"><div className="wrap services-layout"><div className="services-intro"><p className="section-label">02 / {t.servicesKicker}</p><h2 id="services-title">{t.servicesTitle}</h2><p>{t.servicesIntro}</p><div className="service-number" aria-hidden="true">{service||"—"}<span> / 05</span></div></div><div className="service-list"><div className="service-sculpture" aria-hidden="true">{Array.from({length:5},(_,i)=><i key={i} style={{"--blade":i}}/>)}</div>{t.services.map(([id,title,text])=><div className="service-item" key={id}><h3><button className="service-row" type="button" aria-expanded={service===id} aria-controls={`service-${id}`} onPointerEnter={e=>{if(e.pointerType==="mouse"&&window.innerWidth>860)setService(id)}} onFocus={()=>{if(window.innerWidth>860)setService(id)}} onClick={()=>setService(window.innerWidth>860?id:service===id?null:id)}><span className="service-index">{id}</span><span>{title}</span><span className="service-plus" aria-hidden="true">{service===id?"−":"+"}</span></button></h3><div id={`service-${id}`} className="service-detail" hidden={service!==id}><p>{text}</p></div></div>)}</div></div></section>
      <section id="process" data-nav-section tabIndex={-1} className="process section wrap" aria-labelledby="process-title"><div className="section-heading"><p className="section-label">03 / {t.processKicker}</p><h2 id="process-title">{t.processTitle}</h2><p>{t.processIntro}</p></div><ol className="process-list">{t.process.map(([id,title,text])=><li key={id}><span className="process-index">{id}</span><h3>{title}</h3><p>{text}</p></li>)}</ol><div className="studio-note"><span className="section-label">{t.introKicker}</span><h3>{t.introTitle}</h3><p>{t.introText}</p></div></section>
      <section id="contact" data-nav-section tabIndex={-1} className="contact section" aria-labelledby="contact-title"><div className="wrap contact-inner"><p className="section-label">{t.ctaKicker}</p><h2 id="contact-title">{t.ctaTitle}<span aria-hidden="true">↗</span></h2><div className="contact-bottom"><p>{t.ctaText}</p><div><a className="button button-light magnetic" href={`mailto:${site.email}?subject=${encodeURIComponent(t.ui.emailSubject)}`}>{t.ctaButton}<Arrow /></a><small>{t.contactNote}</small></div></div></div></section>
    </main><footer className="footer"><div className="wrap footer-inner"><div><a className="brand" href="#home"><PolireMark/><span>POLIRE</span></a><p>{t.footerLine}</p></div><div className="footer-links"><span>{t.ui.country}</span><a href={`mailto:${site.email}`}>{site.email}</a><Link href={`/impressum${lang==="en"?"?lang=en":""}`}>{t.legal}</Link><Link href={`/datenschutz${lang==="en"?"?lang=en":""}`}>{t.privacy}</Link></div></div></footer>
  </div>;
}
