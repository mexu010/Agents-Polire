"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import PolireMark from "./mark";
import { content, legalContent, legalIdentity, site } from "./content";
export default function LegalPage({ kind }) {
  const [lang,setLang]=useState('de');
  useEffect(()=>{
    const syncLanguage=()=>setLang(new URLSearchParams(window.location.search).get('lang')==='en'?'en':'de');
    syncLanguage(); window.addEventListener('popstate',syncLanguage);
    return ()=>window.removeEventListener('popstate',syncLanguage);
  },[]);
  useEffect(()=>{document.documentElement.lang=lang;},[lang]);
  const t=legalContent[lang], page=t[kind], suffix=lang==='en'?'?lang=en':'';
  const change=()=>{
    const next=lang==='de'?'en':'de',url=new URL(window.location.href);
    if(next==='en') url.searchParams.set('lang','en'); else url.searchParams.delete('lang');
    window.history.replaceState(null,'',url); setLang(next);
  };
  return <main className="legal-page"><div className="legal-wrap">
    <header className="legal-top"><Link className="brand" href={`/${suffix}`}><PolireMark /><span>POLIRE</span></Link><div className="legal-actions"><Link href={`/${suffix}`}>← {t.back}</Link><button className="lang" onClick={change} aria-label={t.language}>{t.toggle}</button></div></header>
    <article className="legal-card"><h1>{page.title}</h1>
      {(!legalIdentity.name||!legalIdentity.address)&&<div className="legal-warning">{t.warning}</div>}
      <h2>{t.ownerTitle}</h2><div className="legal-data"><strong>POLIRE</strong><span>{t.nameLabel}: {legalIdentity.name||t.missingName}</span><span>{t.addressLabel}: {legalIdentity.address||t.missingAddress}</span><a href={`mailto:${site.email}`}>{site.email}</a></div>
      {page.sections.map(([title,text],i)=><section key={i}><h2>{title}</h2><p>{text}</p></section>)}
      <p><Link href={`/impressum${suffix}`}>{content[lang].legal}</Link> · <Link href={`/datenschutz${suffix}`}>{content[lang].privacy}</Link></p><p><small>{t.date}</small></p>
    </article>
  </div></main>;
}
