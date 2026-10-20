/** Decorative range artwork matching Playza's navy, lime and lavender palette. */
export function ArcheryScene({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 560 400" fill="none" aria-hidden="true">
    <circle cx="410" cy="111" r="79" fill="#E5E9FC" />
    <path d="M36 304L308 210L529 313L261 381Z" fill="#E9F1D7" stroke="var(--color-purple-dark)" strokeWidth="2.5" />
    <path d="M72 308L306 229L488 313L261 361Z" stroke="#FFFFFF" strokeWidth="3" />
    <ellipse cx="277" cy="367" rx="207" ry="20" fill="var(--color-purple-dark)" opacity=".08" />
    <path d="M410 245L386 329M442 249L475 330" stroke="var(--color-purple-dark)" strokeWidth="8" strokeLinecap="round" />
    <g transform="translate(428 205) rotate(-9)">
      <ellipse rx="69" ry="86" fill="#F8F4E8" stroke="var(--color-purple-dark)" strokeWidth="4" />
      <ellipse rx="56" ry="71" fill="var(--color-purple-dark)" />
      <ellipse rx="43" ry="55" fill="var(--color-purple-light)" />
      <ellipse rx="29" ry="38" fill="#F4A17E" />
      <ellipse rx="15" ry="20" fill="var(--color-primary)" />
      <circle r="4" fill="var(--color-purple-dark)" />
    </g>
    <path d="M137 282L113 342M160 286L191 340" stroke="var(--color-purple-dark)" strokeWidth="13" strokeLinecap="round" />
    <path d="M131 215L126 280L167 292L178 221Z" fill="var(--color-purple-light)" stroke="var(--color-purple-dark)" strokeWidth="3" />
    <circle cx="153" cy="191" r="19" fill="#AD7458" stroke="var(--color-purple-dark)" strokeWidth="3" />
    <path d="M172 229L230 222M136 232L112 210L166 210" stroke="var(--color-purple-dark)" strokeWidth="11" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M226 160Q282 221 230 282" stroke="var(--color-purple-dark)" strokeWidth="7" strokeLinecap="round" />
    <path d="M226 160L170 219L230 282M169 219H293M281 212L295 219L281 226" stroke="var(--color-purple-dark)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M310 219H348" stroke="var(--color-purple-dark)" strokeWidth="2" strokeDasharray="5 7" />
    <path d="M91 82V111M77 96H106M293 70V89M284 79H303" stroke="var(--color-purple-dark)" strokeWidth="3" strokeLinecap="round" />
    <circle cx="86" cy="148" r="6" fill="var(--color-primary)" />
  </svg>;
}
