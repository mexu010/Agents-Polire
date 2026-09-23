// Editorial source for the review site. The three prompts remain unpublished until the owner writes and approves them.
export const initialContent = {
  business: {
    name: 'Coiffeur Lanz', person: 'Vreni Lanz', street: 'Eichi 20',
    postalCode: '3368', city: 'Bleienbach', phone: '062 922 31 82',
    mobile: '079 713 62 32', email: 'info@coiffeurlanz.ch',
  },
  home: {
    eyebrow: 'Coiffeur Lanz · Bleienbach',
    headline: 'Coiffeur Lanz.\nIn Bleienbach.',
    intro: 'Willkommen bei Vreni Lanz. Für einen Termin erreichen Sie den Salon telefonisch oder mit einer Nachricht.',
  },
  salon: {
    headline: 'Ein Salon. Ein persönlicher Kontakt.',
    intro: 'Vreni Lanz ist Ihre Ansprechperson bei Coiffeur Lanz in Bleienbach. Besprechen Sie Ihren Termin und Ihre Wünsche direkt mit ihr.',
  },
  visit: {
    intro: 'Sie finden Coiffeur Lanz an der Eichi 20 in 3368 Bleienbach. Beachten Sie für Ihren Besuch die aktuellen Öffnungszeiten.',
  },
  contact: {
    intro: 'Haben Sie eine Frage oder möchten Sie einen Termin anfragen? Rufen Sie an oder schreiben Sie eine Nachricht. Eine Anfrage ist noch keine Terminbestätigung.',
  },
  hours: [
    { day: 'Montag', hours: 'Geschlossen' },
    { day: 'Dienstag', hours: '13:30–18:30' },
    { day: 'Mittwoch', hours: 'Geschlossen' },
    { day: 'Donnerstag', hours: '13:30–18:30' },
    { day: 'Freitag', hours: '13:30–18:30' },
    { day: 'Samstag', hours: '08:15–12:00' },
  ],
  notice: '',
  legal: { hostingProvider: '', hostingCountry: '', privacyContact: '', additionalPrivacy: '' },
  heroImage: '/assets/salon-stilllife.webp',
  heroAlt: 'Dekoratives Stillleben mit Coiffeur-Utensilien, keine Aufnahme des Salons',
  articles: [
    { id: 'draft-1', slug: 'pflege-zu-hause', title: 'Ideen zur Haarpflege zu Hause', excerpt: 'Redaktioneller Entwurf: Tipps und verwendete Produkte mit Vreni Lanz abstimmen.', body: 'Welche einfachen Pflegeschritte empfehlen Sie Ihren Kundinnen und Kunden zu Hause? Bitte konkrete Ratschläge und Produkte vor Veröffentlichung ergänzen und prüfen.', status: 'draft', date: '' },
    { id: 'draft-2', slug: 'vor-dem-termin', title: 'Vor dem nächsten Termin', excerpt: 'Redaktioneller Entwurf: Häufige Fragen vor einem Besuch sammeln.', body: 'Welche Informationen helfen Kundinnen und Kunden bei der Vorbereitung? Bitte Fragen, Antworten und allfällige Besonderheiten des Salons direkt abstimmen.', status: 'draft', date: '' },
    { id: 'draft-3', slug: 'aus-dem-salon', title: 'Neues aus dem Salon', excerpt: 'Redaktioneller Entwurf: Raum für bestätigte Mitteilungen.', body: 'Hier können später bestätigte Neuigkeiten, Öffnungszeitenänderungen oder Hinweise von Vreni Lanz erscheinen. Keine unbestätigten Angaben veröffentlichen.', status: 'draft', date: '' },
  ],
};
