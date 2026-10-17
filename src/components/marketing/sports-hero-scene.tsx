/** Shared vector style: a volleyball court, tennis equipment and an archery range. */
export function SportsHeroScene({ className, label }: { className?: string; label: string }) {
  return <svg className={className} viewBox="0 0 640 560" fill="none" role="img" aria-label={label}>
    <ellipse cx="325" cy="505" rx="270" ry="35" fill="#14213D" opacity=".09" />
    {/* Tennis: the racket strings and curved ball seam distinguish it from padel. */}
    <g data-sport="tennis">
      <circle cx="461" cy="144" r="113" fill="#E5E9FC" stroke="#14213D" strokeWidth="2" />
      <g transform="rotate(28 460 145)">
        <ellipse cx="450" cy="115" rx="49" ry="66" fill="#F6F8FA" stroke="#14213D" strokeWidth="8" />
        <path d="M420 64V166M435 52V178M450 49V181M465 52V178M480 64V166M405 84H495M401 105H499M402 126H498M409 147H491M423 168H477" stroke="#14213D" strokeWidth="1.7" />
        <path d="M430 180L444 213H456L470 180M450 211V258" stroke="#14213D" strokeWidth="9" strokeLinecap="round" />
        <path d="M450 222V258" stroke="#728DFA" strokeWidth="13" strokeLinecap="round" />
      </g>
      <circle cx="537" cy="185" r="24" fill="#C7F23D" stroke="#14213D" strokeWidth="2.5" />
      <path d="M521 167Q543 179 546 206" stroke="#FFFFFF" strokeWidth="3" />
    </g>
    {/* Volleyball: a full net, two players and a ball in flight. */}
    <g data-sport="volleyball">
      <path d="M32 340L253 226L424 330L200 459Z" fill="#14213D" />
      <path d="M32 329L253 215L424 319L200 448Z" fill="#C7F23D" stroke="#14213D" strokeWidth="3" />
      <path d="M60 329L253 232L395 319L200 430ZM155 280L300 374" stroke="#FFFFFF" strokeWidth="3" />
      <path d="M145 280V173L320 280V388" stroke="#14213D" strokeWidth="6" strokeLinecap="round" />
      <path d="M147 182L317 286V343L147 239Z" fill="#FFFFFF" fillOpacity=".65" stroke="#14213D" strokeWidth="2" />
      {Array.from({ length: 10 }, (_, i) => <path key={i} d={`M${154+i*17} ${186+i*10.4}v57`} stroke="#14213D" strokeWidth="1" />)}
      <path d="M147 200L317 304M147 218L317 322" stroke="#14213D" strokeWidth="1" />
      <g className="sports-hero-player">
        <path d="M110 333L99 374M125 337L144 373" stroke="#14213D" strokeWidth="10" strokeLinecap="round" />
        <path d="M110 294L104 334L130 341L138 299Z" fill="#728DFA" stroke="#14213D" strokeWidth="2" />
        <circle cx="125" cy="278" r="12" fill="#F1B99B" stroke="#14213D" strokeWidth="2" />
        <path d="M112 302L94 283L101 263M134 306L150 280L149 255" stroke="#14213D" strokeWidth="7" strokeLinecap="round" />
      </g>
      <g>
        <path d="M279 267L266 300M290 269L306 302" stroke="#14213D" strokeWidth="9" strokeLinecap="round" />
        <path d="M274 234L271 265L294 272L301 240Z" fill="#F4A17E" stroke="#14213D" strokeWidth="2" />
        <circle cx="288" cy="219" r="11" fill="#AD7458" stroke="#14213D" strokeWidth="2" />
        <path d="M276 241L256 253L244 248M299 243L318 224" stroke="#14213D" strokeWidth="7" strokeLinecap="round" />
      </g>
      <path d="M159 159Q226 92 296 171" stroke="#14213D" strokeWidth="2" strokeDasharray="6 7" />
      <g className="sports-hero-volleyball"><circle cx="207" cy="119" r="23" fill="#F8F4E8" stroke="#14213D" strokeWidth="2.5" /><path d="M190 104Q205 124 226 113M207 120Q206 136 195 139M207 120Q220 125 226 132" stroke="#14213D" strokeWidth="2" /></g>
    </g>
    {/* Archery: an archer aiming along a clear lane at a five-ring target. */}
    <g data-sport="archery">
      <path d="M328 443L478 368L615 440L465 520Z" fill="#E9F1D7" stroke="#14213D" strokeWidth="2.5" />
      <path d="M518 395L502 464M538 398L561 465" stroke="#14213D" strokeWidth="6" strokeLinecap="round" />
      <g transform="translate(532 365) rotate(-10)">
        <ellipse rx="52" ry="66" fill="#F8F4E8" stroke="#14213D" strokeWidth="3" />
        <ellipse rx="42" ry="54" fill="#14213D" />
        <ellipse rx="32" ry="42" fill="#728DFA" />
        <ellipse rx="22" ry="30" fill="#F4A17E" />
        <ellipse rx="11" ry="16" fill="#C7F23D" />
        <circle r="3" fill="#14213D" />
      </g>
      <path d="M367 424L352 474M382 424L400 474" stroke="#14213D" strokeWidth="10" strokeLinecap="round" />
      <path d="M363 382L359 423L388 430L392 384Z" fill="#728DFA" stroke="#14213D" strokeWidth="2.5" />
      <circle cx="376" cy="366" r="13" fill="#AD7458" stroke="#14213D" strokeWidth="2.5" />
      <path d="M388 389L423 384M365 391L352 378L383 378" stroke="#14213D" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M420 345Q454 382 422 423" stroke="#14213D" strokeWidth="5" strokeLinecap="round" />
      <path d="M420 345L386 382L422 423M385 382H456M448 377L458 382L448 387" stroke="#14213D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M465 382H501" stroke="#14213D" strokeWidth="1.5" strokeDasharray="4 5" opacity=".5" />
    </g>
  </svg>;
}
