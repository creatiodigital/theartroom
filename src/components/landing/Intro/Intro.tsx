import styles from './Intro.module.scss'

/** The three points under the introduction (designs/home-desktop.dc.html). */
const POINTS = [
  ['Curated exhibitions', 'Selected bodies of work, presented with the care of a physical show.'],
  ['Walk the rooms', 'Every exhibition can also be visited as a room you walk through.'],
  ['Signed prints', 'Take a work home, approved and signed by the artist.'],
] as const

/** The homepage's introduction (docs/public-redesign/home.md §2): heading, lead, three points. */
export const Intro = () => (
  <section className={styles.intro}>
    <div className={styles.text}>
      <h2 className={styles.heading}>Step inside the work.</h2>
      <p className={styles.lead}>
        The Art Room is an online gallery for contemporary art. Each exhibition is carefully
        curated, and can also be visited as a room you walk through, at your own pace.
      </p>
    </div>
    {/* Not on phones, as drawn (home-phone): the lead says it already. */}
    <ul className={styles.points}>
      {POINTS.map(([title, line]) => (
        <li key={title} className={styles.point}>
          <span className={styles.pointTitle}>{title}</span>
          <span className={styles.pointLine}>{line}</span>
        </li>
      ))}
    </ul>
  </section>
)
