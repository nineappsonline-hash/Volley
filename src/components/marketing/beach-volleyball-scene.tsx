import styles from "./volleyball-landing.module.css";

/** Decorative vector scene: no image downloads or animation dependencies. */
export function BeachVolleyballScene() {
  return <svg viewBox="0 0 640 480" className={styles.beachScene} fill="none" aria-hidden="true" focusable="false">
    <circle cx="485" cy="90" r="45" fill="#C7F23D" />
    <g className={styles.beachSun} stroke="#14213D" strokeWidth="3" strokeLinecap="round">
      <path d="M485 24V13M485 167V156M419 90H408M562 90H551M438 43L430 35M540 145L532 137M438 137L430 145M540 35L532 43" />
    </g>
    <path d="M25 184Q115 153 205 182T385 180T615 178V282H25Z" fill="#DCEBEA" />
    <g className={styles.beachWaves} stroke="#14213D" strokeOpacity=".2" strokeWidth="2" strokeLinecap="round">
      <path d="M55 207Q95 198 135 207M210 215Q260 205 310 215M395 205Q455 193 515 205M90 237Q145 227 200 237M340 242Q410 230 480 242" />
    </g>
    <ellipse cx="330" cy="418" rx="265" ry="38" fill="#14213D" fillOpacity=".08" />
    <path d="M38 310L340 172L607 309L303 448Z" fill="#E2D3AF" />
    <path d="M38 298L340 160L607 297L303 436Z" fill="#F3E8D0" stroke="#14213D" strokeWidth="3" />
    <path d="M79 297L340 179L566 297L303 417Z" stroke="#FFFFFF" strokeWidth="4" />
    <path d="M207 237L438 359" stroke="#FFFFFF" strokeWidth="3" />
    <path d="M207 238V133L437 255V361" stroke="#14213D" strokeWidth="7" strokeLinecap="round" />
    <path d="M210 141L434 260V314L210 195Z" fill="#FFFFFF" fillOpacity=".4" stroke="#14213D" strokeWidth="2" />
    {Array.from({ length: 12 }, (_, i) => <path key={i} d={`M${217 + i * 19} ${145 + i * 10}v49`} stroke="#14213D" strokeWidth="1.3" />)}
    <path d="M210 158L434 277M210 176L434 295" stroke="#14213D" strokeWidth="1.3" />
    <g className={styles.beachPlayer} stroke="#14213D" strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="166" cy="346" rx="32" ry="8" fill="#14213D" fillOpacity=".1" stroke="none" />
      <path d="M165 296L149 338M180 298L198 338" strokeWidth="10" />
      <path d="M155 251L152 290L186 299L191 258Z" fill="#C7F23D" strokeWidth="3" />
      <circle cx="177" cy="234" r="14" fill="#C58C6D" strokeWidth="3" />
      <path d="M158 261L139 238L149 212M185 264L210 239L212 213" strokeWidth="8" />
    </g>
    <g className={styles.beachReceiver} stroke="#14213D" strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="468" cy="299" rx="30" ry="8" fill="#14213D" fillOpacity=".1" stroke="none" />
      <path d="M459 257L445 289M475 259L493 290" strokeWidth="10" />
      <path d="M451 214L449 253L482 261L486 220Z" fill="#14213D" strokeWidth="3" />
      <circle cx="471" cy="197" r="14" fill="#E2B79C" strokeWidth="3" />
      <path d="M455 225L429 205L409 211M480 225L496 205" strokeWidth="8" />
    </g>
    <path d="M205 166Q305 7 426 155" stroke="#14213D" strokeOpacity=".25" strokeWidth="2" strokeDasharray="5 8" />
    <g className={styles.beachBall}>
      <circle cx="220" cy="151" r="22" fill="#C7F23D" stroke="#14213D" strokeWidth="2.5" />
      <path d="M200 144Q219 159 237 136M219 153Q214 166 208 171M219 153Q235 150 242 156" stroke="#14213D" strokeWidth="2" />
    </g>
    <g fill="#14213D" fillOpacity=".2"><circle cx="102" cy="312" r="2" /><circle cx="280" cy="383" r="2" /><circle cx="327" cy="398" r="2" /><circle cx="503" cy="321" r="2" /><circle cx="363" cy="276" r="2" /></g>
  </svg>;
}
