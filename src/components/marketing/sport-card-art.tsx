import styles from "./volleyball-landing.module.css";

type CourtSport = "padel" | "tennis" | "volleyball" | "basketball" | "beach-volleyball";

/** Decorative vector artwork: no image downloads or player photographs. */
export function SportCardArt({ sport }: { sport: CourtSport }) {
  const racket = sport === "padel" || sport === "tennis";
  const beach = sport === "beach-volleyball";
  return <svg viewBox="0 0 320 200" fill="none" aria-hidden="true" focusable="false">
    <circle cx="165" cy="94" r="78" fill="white" fillOpacity=".05" />
    <circle cx="165" cy="94" r="92" stroke="white" strokeOpacity=".16" strokeDasharray="3 9" />
    {beach && <g className={styles.tileSun}><circle cx="266" cy="38" r="17" fill="#E0FF8A" /><path d="M266 10V4M266 72V66M238 38H232M300 38H294M246 18L242 14M286 58L290 62M246 58L242 62M286 18L290 14" stroke="#E0FF8A" strokeWidth="3" strokeLinecap="round" /></g>}
    <g className={styles.tileCourt}>
      <path d="M22 139L174 69L301 136L149 191Z" fill="#28114F" />
      <path d="M22 132L174 62L301 129L149 184Z" fill={beach ? "#F2DCA3" : "#C8FF00"} stroke="#FFFFFF" strokeWidth="2" />
      <path d="M48 132L174 76L274 128L149 171ZM109 105L210 153M100 151L224 102" stroke={beach ? "#714F81" : "#4D238B"} strokeWidth="2" />
      {!racket && sport !== "basketball" && <><path d="M104 102V52L230 118V157" stroke="#FFFFFF" strokeWidth="4" strokeLinecap="round" /><path d="M106 57L228 120V145L106 82Z" fill="#FFFFFF" fillOpacity=".15" stroke="#FFFFFF" /><path d="M122 65V91M140 74V100M158 84V109M176 93V119M194 102V128M212 111V137M106 69L228 132" stroke="#FFFFFF" strokeOpacity=".75" /></>}
      {racket && <path d="M103 106L225 164M103 106V92M225 164V149" stroke="#FFFFFF" strokeWidth="3" />}
      {sport === "basketball" && <><path d="M249 119V31" stroke="#FFFFFF" strokeWidth="5" /><path d="M221 18H274V56H221Z" fill="#B89AE6" stroke="#FFFFFF" strokeWidth="3" /><path d="M237 35H258V51H237Z" stroke="#FFFFFF" strokeWidth="2" /><ellipse cx="238" cy="57" rx="19" ry="6" stroke="#C8FF00" strokeWidth="4" /><path d="M220 59L226 85H249L255 59M231 62L234 85M245 62L242 85M224 72H251" stroke="#FFFFFF" strokeWidth="2" /></>}
    </g>
    {racket ? <><g className={styles.tileRacket}>
      <path d="M119 94L95 146" stroke="#241140" strokeWidth="13" strokeLinecap="round" /><path d="M119 91L102 128" stroke="#FFFFFF" strokeWidth="9" strokeLinecap="round" />
      <ellipse cx="138" cy="56" rx="33" ry="45" transform="rotate(25 138 56)" fill={sport === "padel" ? "#C8FF00" : "#5D2CA0"} stroke="#FFFFFF" strokeWidth="5" />
      {sport === "padel" ? <g fill="#54268D">{[[-12,-20],[5,-21],[18,-9],[-20,-5],[-4,-5],[10,8],[-15,13],[-2,25]].map(([x,y],i)=><circle key={i} cx={138+x} cy={56+y} r="3.5" />)}</g> : <path d="M123 24L105 67M139 17L116 83M154 24L132 94M166 39L148 91M118 32L168 53M109 47L164 70M107 64L153 85" stroke="#E5D6FF" strokeWidth="1.5" />}
    </g><g className={styles.tileBall}><circle cx="224" cy="91" r="18" fill="#C8FF00" stroke="#FFFFFF" strokeWidth="2" /><path d="M211 78Q233 89 214 107M237 79Q215 90 234 106" stroke="#FFFFFF" strokeWidth="2" /></g></> : <g className={styles.tileBall}>
      <circle cx={sport === "basketball" ? 158 : 169} cy="47" r="29" fill={sport === "basketball" ? "#FFC078" : "#FFFFFF"} stroke="#321557" strokeWidth="2" />
      {sport === "basketball" ? <path d="M129 47H187M158 18V76M139 25Q176 45 139 69M177 25Q140 45 177 69" stroke="#663180" strokeWidth="2" /> : <><path d="M169 18Q146 37 169 48Q191 55 187 70M169 48Q147 61 146 65M143 32Q152 48 169 48M179 21Q167 34 180 51M140 45Q150 58 158 57" stroke="#6331A5" strokeWidth="2.5" /><path d="M150 25Q168 33 169 48L187 70Q207 47 190 27Z" fill="#C8FF00" fillOpacity=".75" /></>}
    </g>}
    <path d="M49 41V57M41 49H57M281 93V105M275 99H287" stroke="#C8FF00" strokeWidth="3" strokeLinecap="round" />
  </svg>;
}
