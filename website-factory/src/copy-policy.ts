export const EDITORIAL_COPY_TEMPLATES = [
  "Kontakt",
  "Kontakt ansehen",
  "Kontakt kontaktieren",
  "Kontakt aufnehmen",
  "Jetzt Kontakt aufnehmen",
  "Kontaktangaben ansehen.",
  "Leistungen",
  "Über uns",
  "Mehr erfahren",
  "Anfrage starten",
  "Ihr nächster Schritt",
  "So geht es weiter",
  "Eine klare Grundlage für Ihre nächste Website-Anfrage.",
  "Alle wichtigen Informationen auf einen Blick.",
  "Darf ich Ihnen den Vorschlag kurz vorstellen?",
  "Unverbindlichen Vorschlag ansehen.",
] as const;

export const FACTUAL_CONNECTOR_WORDS = [
  "der",
  "die",
  "das",
  "den",
  "dem",
  "des",
  "ein",
  "eine",
  "einer",
  "eines",
  "einem",
  "einen",
  "und",
  "oder",
  "in",
  "im",
  "an",
  "am",
  "auf",
  "aus",
  "bei",
  "für",
  "mit",
  "nach",
  "von",
  "vor",
  "zu",
  "zum",
  "zur",
  "sowie",
] as const;

export const SUBJECT_TEMPLATES = ["Ihre Kontaktseite im Vorschlag"] as const;

export const SUBJECT_FACT_FRAMES = [
  "Gestaltungsvorschlag für {company_name}",
  "Website-Vorschlag für {company_name}",
] as const;

export const normaliseCopy = (text: string): string =>
  text
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

const editorial = new Set(EDITORIAL_COPY_TEMPLATES.map(normaliseCopy));
const factualConnectors = new Set<string>(FACTUAL_CONNECTOR_WORDS);
const subjects = new Set(SUBJECT_TEMPLATES.map(normaliseCopy));

const removeProjection = (text: string, support: string): string =>
  ` ${text} `.replaceAll(` ${support} `, " ").trim();

export function assertCopyPolicy(
  text: string,
  kind: string,
  supportValues: string[],
): void {
  const normalised = normaliseCopy(text);
  if (kind === "editorial") {
    if (!editorial.has(normalised))
      throw new Error(`unsupported editorial claim in copy: ${text}`);
    return;
  }
  const supports = supportValues.map(normaliseCopy).filter(Boolean);
  let remainder = normalised;
  if (
    !supports.length ||
    supports.some((support) => !` ${remainder} `.includes(` ${support} `))
  )
    throw new Error(`unsupported claim in copy: ${text}`);
  for (const support of [...supports].sort((a, b) => b.length - a.length))
    remainder = removeProjection(remainder, support);
  const extra = normaliseCopy(remainder).split(" ").filter(Boolean);
  if (extra.some((word) => !factualConnectors.has(word)))
    throw new Error(`unsupported claim in copy: ${text}`);
}

export function assertSubjectPolicy(
  subject: string,
  companyNames: string[],
): void {
  const normalised = normaliseCopy(subject);
  if (subjects.has(normalised)) return;
  const allowed = companyNames.flatMap((companyName) =>
    SUBJECT_FACT_FRAMES.map((frame) =>
      normaliseCopy(frame.replace("{company_name}", companyName)),
    ),
  );
  if (!allowed.includes(normalised))
    throw new Error(`unsupported claim in Sales subject: ${subject}`);
}

export const COPY_POLICY_PROMPT = `Copy-Policy (Runtime und Prompt verwenden dieselbe Liste):
- Redaktionelle Copy ohne Fakt-IDs darf ausschliesslich eine dieser vollständigen Vorlagen verwenden: ${EDITORIAL_COPY_TEMPLATES.map((template) => JSON.stringify(template)).join(", ")}.
- Factual Copy muss jeden referenzierten Fakt-, Improvement- oder Operatorwert wörtlich wiedergeben. Zusätzlich sind ausschliesslich diese neutralen Bindewörter erlaubt: ${FACTUAL_CONNECTOR_WORDS.join(", ")}.
- Sales-Betreff ohne Firmenwert darf ausschliesslich eine dieser vollständigen Vorlagen verwenden: ${SUBJECT_TEMPLATES.map((template) => JSON.stringify(template)).join(", ")}. Mit einem belegten company_name sind ausschliesslich diese Rahmen erlaubt: ${SUBJECT_FACT_FRAMES.map((template) => JSON.stringify(template)).join(", ")}.
- Vorlagen dürfen nicht erweitert werden. Zahlen, Zertifikate, Garantien, Leistungen, Orte, Personalgrössen und andere konkrete Firmenbehauptungen benötigen die entsprechende factual Projektion.`;
