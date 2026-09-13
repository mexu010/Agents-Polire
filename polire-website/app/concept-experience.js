"use client";
import { useEffect, useRef, useState } from 'react';

const worlds = {
  raum: { eyebrow: 'DIE MATERIALBIBLIOTHEK', title: 'Nicht nur sehen. Spüren.', caption: 'Drei Materialien. Drei Arten, einen Raum zu erleben.', items: [
    ['Eiche', '01', 'Wärme, die bleibt.', 'Lebendige Maserung. Sanfte Töne. Holz gibt klaren Räumen einen menschlichen Massstab.', 'photo-1600210492486-724fe5c67fb0', '#a88860'],
    ['Stein', '02', 'Ruhe in ihrer reinsten Form.', 'Monolithische Flächen und natürliche Texturen. Eine leise Bühne für Licht und Leben.', 'photo-1600566753086-00f18fb6b3ea', '#b7b3a7'],
    ['Licht', '03', 'Das unsichtbare Material.', 'Morgens weich. Abends golden. Licht verändert den Raum, ohne etwas hinzuzufügen.', 'photo-1600607687920-4e2a09cf159d', '#e1d5b4'],
  ] },
  glanz: { eyebrow: 'THE FINISH LAB', title: 'Dein Anspruch. Dein Finish.', caption: 'Entdecke die drei Ebenen der Aufbereitung.', items: [
    ['Reset', '01', 'Zurück auf Anfang.', 'Die Basis für alles Weitere: ein durchdachtes Reinigungskonzept für Innenraum und Oberflächen.', 'photo-1507136566006-cfc505b114fc', '#e3e5df'],
    ['Correct', '02', 'Reflexion ohne Ablenkung.', 'Licht zeigt jedes Detail. Diese Designstudie inszeniert die Präzision hinter einer Lackkorrektur.', 'photo-1503376780353-7e6692767b70', '#c9ff44'],
    ['Protect', '03', 'Der letzte Schliff.', 'Ein Konzept für den Abschluss: klare Reflexionen, sorgfältige Kontrolle und ein souveräner Auftritt.', 'photo-1503736334956-4c8f8e92946d', '#83adab'],
  ] },
  tavola: { eyebrow: 'UN ABEND BEI TAVOLA', title: 'Es darf später werden.', caption: 'Wähle deinen Moment. Wir liefern die Vorfreude.', items: [
    ['Aperitivo', '18:00', 'Der erste Schluck Urlaub.', 'Ein kühles Glas. Etwas Kleines für die Mitte. Und das gute Gefühl, heute nichts mehr vorhaben zu müssen.', 'photo-1517248135467-4c7edcad34c4', '#ba683f'],
    ['A tavola', '19:30', 'Noch einen Teller teilen.', 'Pasta in der Mitte, Gespräche überall. Die besten Abende brauchen kein grosses Programm.', 'photo-1473093295043-cdd812d0e601', '#687446'],
    ['Dolce', '21:00', 'Für immer noch Platz.', 'Ein Löffel Tiramisù. Ein letzter Espresso. Manche Abende verdienen einen süssen Schlusspunkt.', 'photo-1571877227200-a0d98ea607e9', '#8f5940'],
  ] },
};

export function ConceptMotion() {
  useEffect(() => {
    const root = document.querySelector('.concept');
    if (!root || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => { if (entry.isIntersecting) { entry.target.classList.add('is-visible'); observer.unobserve(entry.target); } });
    }, { threshold: .08 });
    const targets = root.querySelectorAll('.concept-discover header, .concept-cards article, .experience, .concept-story, .concept-request');
    targets.forEach(target => { target.classList.add('concept-reveal'); observer.observe(target); });
    return () => { observer.disconnect(); targets.forEach(target => target.classList.remove('concept-reveal')); };
  }, []);
  return null;
}

export default function ConceptExperience({ kind }) {
  const world = worlds[kind];
  const [active, setActive] = useState(0);
  const buttons = useRef([]);
  const [name, number, title, description, photo, color] = world.items[active];
  function move(event, index) {
    let next;
    if (event.key === 'ArrowRight') next = (index + 1) % 3;
    if (event.key === 'ArrowLeft') next = (index + 2) % 3;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = 2;
    if (next === undefined) return;
    event.preventDefault(); setActive(next); buttons.current[next]?.focus();
  }
  return <section className="experience" aria-labelledby="experience-title">
    <div className="experience-heading"><p>{world.eyebrow}</p><h2 id="experience-title">{world.title}</h2><p>{world.caption}</p></div>
    <div className="experience-layout">
      <div className="experience-visual"><img key={photo} loading="lazy" decoding="async" width="1200" height="1000" sizes="(max-width: 760px) 88vw, 55vw" srcSet={[480,800,1200].map(w => `https://images.unsplash.com/${photo}?auto=format&fit=crop&w=${w}&q=80 ${w}w`).join(', ')} src={`https://images.unsplash.com/${photo}?auto=format&fit=crop&w=1200&q=80`} alt={`${name} – ${title}`}/><span className="experience-counter" aria-hidden="true">{number}</span><span className="experience-image-label">{world.eyebrow} / {name}</span></div>
      <div className="experience-controls"><div role="tablist" aria-label={world.eyebrow}>{world.items.map(([label,,, , , swatch], i) => <button key={label} ref={el => buttons.current[i] = el} role="tab" id={`experience-tab-${i}`} aria-selected={active === i} aria-controls="experience-panel" tabIndex={active === i ? 0 : -1} onKeyDown={e => move(e, i)} onClick={() => setActive(i)}><span style={{background:swatch}}/>{label}<small>0{i+1}</small></button>)}</div><div id="experience-panel" role="tabpanel" aria-labelledby={`experience-tab-${active}`} tabIndex={0}><div className="experience-copy" key={name}><span className="experience-rule" style={{background:color}}/><h3>{title}</h3><p>{description}</p><a href="#request">{kind === 'tavola' ? 'Deinen Abend planen' : kind === 'raum' ? 'Über Räume sprechen' : 'Finish anfragen'}</a></div></div></div>
    </div>
  </section>;
}
