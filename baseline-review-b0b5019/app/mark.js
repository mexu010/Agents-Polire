export default function PolireMark({ className = "" }) {
  return <svg className={`polire-mark ${className}`} viewBox="0 0 74 90" aria-hidden="true" focusable="false">
    <path d="M12 10h26c16 0 29 11 29 26 0 5-1 9-4 13-6-8-15-13-27-13H12C6 36 3 30 3 23V19c0-5 4-9 9-9Z" fill="#8cb9ff" />
    <path d="M36 36c12 0 21 5 27 13-5 9-15 15-27 15H25V47c0-6 5-11 11-11Z" fill="#356fee" />
    <path d="M25 47v22c0 8-5 14-13 17L7 88V58c0-6 3-11 8-14l10-5v8Z" fill="#194aaa" />
  </svg>;
}
