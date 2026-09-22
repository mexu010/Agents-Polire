import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
export const root = dirname(fileURLToPath(import.meta.url));
export function loadConfig() {
  const envPath = resolve(root, '.env');
  if (existsSync(envPath)) process.loadEnvFile(envPath);
  const env = process.env, port = Number(env.PORT || 4330);
  return {
    port, host: env.HOST || '127.0.0.1', dataDir: resolve(root, env.DATA_DIR || 'data'),
    origin: env.PUBLIC_ORIGIN || `http://127.0.0.1:${port}`, stage: env.APP_STAGE || 'review',
    passwordHash: env.ADMIN_PASSWORD_HASH || '', sessionSecret: env.SESSION_SECRET || '',
    ownerApproved: env.OWNER_APPROVED === 'true', legalApproved: env.LEGAL_APPROVED === 'true',
    mailTested: env.MAIL_DELIVERY_TESTED === 'true', searchConsoleReady: env.SEARCH_CONSOLE_READY === 'true',
    monitoringReady: env.EXTERNAL_MONITOR_READY === 'true', backupCopyReady: env.OFFSITE_BACKUP_READY === 'true',
    mailKey: env.RESEND_API_KEY || '', mailFrom: env.MAIL_FROM || '', mailTo: env.MAIL_TO || '',
    trustProxy: env.TRUST_PROXY === 'true', minFormAge: 2000, scheduledTasks: true,
  };
}
export function launchChecks(config) {
  return [
    { label: 'Inhalte, Bilder und Angebot durch den Salon freigegeben', ready: Boolean(config.ownerApproved) },
    { label: 'Impressum und Datenschutz mit tatsächlichem Hosting geprüft', ready: Boolean(config.legalApproved) },
    { label: 'Eigene Domain mit HTTPS verbunden', ready: /^https:\/\//.test(config.origin) },
    { label: 'E-Mail-Zustellung eingerichtet und getestet', ready: Boolean(config.mailKey && config.mailFrom && config.mailTo && config.mailTested) },
    { label: 'Externe Überwachung mit POLIRE-Benachrichtigung eingerichtet', ready: Boolean(config.monitoringReady) },
    { label: 'Backup-Kopie ausserhalb des Webservers eingerichtet', ready: Boolean(config.backupCopyReady) },
    { label: 'Search Console im Kundenkonto eingerichtet', ready: Boolean(config.searchConsoleReady) },
  ];
}
export function assertConfig(config) {
  if (!['review', 'production'].includes(config.stage)) throw new Error('APP_STAGE muss review oder production sein.');
  if (!/^scrypt:[a-f0-9]{32}:[a-f0-9]{128}$/.test(config.passwordHash) || config.sessionSecret.length < 40) throw new Error('Lokalen Zugang zuerst mit node cli.mjs setup einrichten.');
  const origin = new URL(config.origin);
  if (!['http:', 'https:'].includes(origin.protocol) || origin.origin !== config.origin) throw new Error('PUBLIC_ORIGIN muss ein Ursprung ohne Pfad oder abschliessenden Schrägstrich sein.');
  if (config.stage === 'production' && launchChecks(config).some(c => !c.ready)) throw new Error('Produktivstart benötigt die Freigabe aller Startprüfungen (Verwaltung → Betrieb).');
}
