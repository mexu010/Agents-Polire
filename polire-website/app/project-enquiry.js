"use client";

import { useEffect, useRef, useState } from 'react';
import { enquiryCopy } from './enquiry-copy';

export default function ProjectEnquiry({ lang, label }) {
  const t = enquiryCopy[lang];
  const dialog = useRef(null);
  const form = useRef(null);
  const successTitle = useRef(null);
  const busy = useRef(false);
  const [service, setService] = useState('');
  const [budget, setBudget] = useState('');
  const [timingMode, setTimingMode] = useState('');
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const [examples, setExamples] = useState([0]);
  const nextExample = useRef(1);

  useEffect(() => {
    if (!open) return;
    const before = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = before; };
  }, [open]);

  function show() {
    if (status === 'success') {
      form.current?.reset();
      setExamples([0]); setService(''); setBudget(''); setTimingMode('');
      setStatus('idle');
    }
    dialog.current.showModal();
    setOpen(true);
  }

  function keepFocus(event) {
    if (event.key !== 'Tab') return;
    const controls = [...dialog.current.querySelectorAll('button, input, select, textarea, a[href]')]
      .filter(element => !element.disabled && element.tabIndex >= 0 && element.getClientRects().length && !element.closest('[hidden]'));
    const first = controls[0], last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }

  async function submit(event) {
    event.preventDefault();
    if (busy.current) return;
    busy.current = true;
    const data = new FormData(event.currentTarget);
    const payload = Object.fromEntries(data);
    payload.examples = data.getAll('examples').filter(value => value.trim());
    payload.lang = lang;
    setError('');
    setStatus('sending');
    try {
      const response = await fetch('/api/enquiry', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload), signal: AbortSignal.timeout(20000),
      });
      let result = await response.json();
      if (response.ok && result.browserDelivery) {
        const delivery = result.browserDelivery;
        if (!/^https:\/\/formsubmit\.co\/ajax\/[a-zA-Z0-9-]{8,100}$/.test(delivery.url)) throw new Error('Invalid delivery endpoint');
        const provider = await fetch(delivery.url, {
            method: 'POST', credentials: 'omit', referrerPolicy: 'origin',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(delivery.payload), signal: AbortSignal.timeout(12000),
        });
        const receipt = await provider.json();
        if (![true, 'true'].includes(receipt.success)) console.warn('enquiry_browser_rejected', /web server|HTML files/i.test(receipt.message ?? '') ? 'missing_referrer' : /activat/i.test(receipt.message ?? '') ? 'activation_required' : 'other');
        result = { ok: provider.ok && [true, 'true'].includes(receipt.success) };
      }
      if (!response.ok || result.ok !== true) {
        setError(response.status === 429 ? 'limited' : response.status === 400 ? 'invalid' : response.status === 503 ? 'unavailable' : 'error');
        setStatus('idle');
        return;
      }
      setStatus('success');
      requestAnimationFrame(() => successTitle.current?.focus());
    } catch {
      setError('error');
      setStatus('idle');
    } finally {
      busy.current = false;
    }
  }

  const optional = <span className="enquiry-optional" aria-hidden="true">{t.optional}</span>;
  const urlInput = { type: 'url', inputMode: 'url', placeholder: 'https://…', maxLength: 1000, pattern: 'https?://.+' };
  function completeUrl(event) {
    const value = event.target.value.trim();
    if (value && !/^[a-z][a-z\d+.-]*:/i.test(value)) event.target.value = `https://${value}`;
  }

  return <>
    <button type="button" className="button button-light magnetic" onClick={show} aria-haspopup="dialog" aria-controls="project-enquiry">{label}</button>
    <dialog id="project-enquiry" className="enquiry-dialog" ref={dialog} aria-labelledby={status === 'success' ? 'enquiry-success' : 'enquiry-title'} onKeyDown={keepFocus} onClose={() => setOpen(false)}>
      <div className="enquiry-top"><span>POLIRE / {lang === 'de' ? 'PROJEKTANFRAGE' : 'PROJECT ENQUIRY'}</span><button type="button" className="enquiry-close" aria-label={t.close} onClick={() => dialog.current.close()}>×</button></div>
      <div className="enquiry-content">
        <div hidden={status !== 'success'} className="enquiry-success">

          <h2 id="enquiry-success" ref={successTitle} tabIndex={-1}>{t.success}</h2><p>{t.successText}</p>
          <button className="button button-dark" type="button" onClick={() => dialog.current.close()}>{t.done}</button>
        </div>
        <div hidden={status === 'success'}>
          <header className="enquiry-heading"><h2 id="enquiry-title">{t.title}</h2><p>{t.intro}</p><p className="enquiry-required">{t.required}</p></header>
          <form ref={form} onSubmit={submit}>
            <fieldset disabled={status === 'sending'} className="enquiry-fields">
              <legend>{t.details}</legend>
              <fieldset className="enquiry-choices"><legend>{t.service}</legend><div className="enquiry-choice-grid">{t.services.map(([value,text]) => <label className="enquiry-choice" key={value}><input type="radio" name="service" value={value} onChange={() => setService(value)} required/><span>{text}</span></label>)}</div></fieldset>
              {service === 'other' && <label className="enquiry-field" htmlFor="enquiry-other">{t.otherDetails}<textarea id="enquiry-other" name="otherDetails" maxLength={1000} rows={2} placeholder={t.otherPlaceholder}/></label>}<div className="enquiry-field"><label htmlFor="enquiry-website">{t.website}{optional}</label><input {...urlInput} id="enquiry-website" name="website" onBlur={completeUrl} aria-describedby="enquiry-website-hint"/><p className="enquiry-hint" id="enquiry-website-hint">{t.websiteHint}</p></div>
              <div className="enquiry-field"><label htmlFor="enquiry-brief">{t.brief}</label><p className="enquiry-hint" id="enquiry-brief-hint">{t.briefHint}</p><textarea id="enquiry-brief" name="brief" required maxLength={5000} rows={4} placeholder={t.briefPlaceholder} aria-describedby="enquiry-brief-hint"/></div>
              <div className="enquiry-examples"><h3>{t.examplesTitle}{optional}</h3><p className="enquiry-hint">{t.examplesHint}</p>{examples.map((id, index) => <div className="enquiry-example" key={id}><label className="enquiry-field" htmlFor={`enquiry-example-${id}`}><span>{t.example} {index + 1}</span><input {...urlInput} id={`enquiry-example-${id}`} name="examples" onBlur={completeUrl}/></label>{examples.length > 1 && <button className="enquiry-remove" type="button" aria-label={`${t.removeExample} ${index+1}`} onClick={() => setExamples(current => current.filter(item => item !== id))}>×</button>}</div>)}{examples.length < 5 && <button className="enquiry-add" type="button" onClick={() => { const id = nextExample.current++; setExamples(current => [...current, id]); requestAnimationFrame(() => document.getElementById(`enquiry-example-${id}`)?.focus()); }}><span aria-hidden="true">＋ </span>{t.addExample}</button>}<label className="enquiry-field enquiry-inspiration" htmlFor="enquiry-inspiration">{t.inspiration}{optional}<textarea id="enquiry-inspiration" name="inspiration" rows={2} maxLength={2000} placeholder={t.inspirationPlaceholder}/></label></div>
              <div className="enquiry-grid"><div><fieldset className="enquiry-choices enquiry-budget"><legend>{t.budget}{optional}</legend><div className="enquiry-choice-grid">{[['',t.open],...t.budgets,['custom',t.customBudget]].map(([value,text]) => <label className="enquiry-choice" key={value}><input type="radio" name="budget" value={value} checked={budget === value} onChange={() => setBudget(value)}/><span>{text}</span></label>)}</div></fieldset>{budget === 'custom' && <label className="enquiry-field" htmlFor="enquiry-custom-budget">{t.budgetDetails}<input id="enquiry-custom-budget" name="budgetDetails" maxLength={200} required placeholder={t.budgetPlaceholder}/></label>}</div><div><fieldset className="enquiry-choices"><legend>{t.timing}{optional}</legend><div className="enquiry-choice-grid">{[['asap',t.asap],['date',t.chooseDate]].map(([value,text]) => <label className="enquiry-choice" key={value}><input type="radio" name="timingMode" value={value} checked={timingMode === value} onChange={() => setTimingMode(value)}/><span>{text}</span></label>)}</div></fieldset>{timingMode === 'date' && <label className="enquiry-field" htmlFor="enquiry-timing">{t.startDate}<input id="enquiry-timing" name="timing" type="date" required/></label>}</div></div>
            </fieldset>
            <fieldset disabled={status === 'sending'} className="enquiry-fields">
              <legend>{t.contact}</legend>
              <div className="enquiry-grid"><label className="enquiry-field" htmlFor="enquiry-name">{t.name}<input id="enquiry-name" name="name" autoComplete="name" required maxLength={100}/></label><label className="enquiry-field" htmlFor="enquiry-company">{t.company}{optional}<input id="enquiry-company" name="company" autoComplete="organization" maxLength={150}/></label></div>
              <label className="enquiry-field" htmlFor="enquiry-email">{t.email}<input id="enquiry-email" type="email" name="email" autoComplete="email" required maxLength={254}/></label>
              <div className="enquiry-honey" aria-hidden="true"><label htmlFor="enquiry-fax">Fax<input id="enquiry-fax" name="fax" autoComplete="off" tabIndex={-1}/></label></div>
            </fieldset>
            <div className="enquiry-submit"><p>{t.privacyBefore} <a href={`/datenschutz${lang === 'en' ? '?lang=en' : ''}`} target="_blank" rel="noopener noreferrer">{t.privacy}</a></p>{error && <p className="enquiry-error" role="alert">{t[error]}</p>}<button type="submit" className="button button-dark" disabled={status === 'sending'} aria-busy={status === 'sending'}>{status === 'sending' ? t.sending : t.submit}</button></div>
          </form>
        </div>
      </div>
    </dialog>
  </>;
}
