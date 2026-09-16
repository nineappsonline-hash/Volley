"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUpLeft, Crown, Target, Trophy, Users, Volleyball } from "lucide-react";
import { ProfileAvatar } from "@/components/shared/profile-avatar";
import { useI18n } from "@/lib/i18n";
import styles from "./landing.module.css";

export interface HomepageLeader {
  member_id: string;
  name: string;
  username: string | null;
  avatar_url: string | null;
  games_played: number;
  sessions_attended: number;
  points: number;
}

export interface HomepageCommunityStats {
  games: number;
  players: number;
  sessions: number;
  members: number;
}

type Category = "top" | "games" | "sessions";

const PODIUM_BAR_H = [84, 64, 52];
const PODIUM_RING = ["#f6b21a", "#c9d2de", "#d9835b"];
const APEX_ORDER = [1, 0, 2];

function useInView<T extends HTMLElement>(threshold = 0.25) {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setInView(true);
            observer.disconnect();
          }
        }
      },
      { threshold }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);
  return { ref, inView };
}

function CountUp({ to, start, lang }: { to: number; start: boolean; lang: string }) {
  const [value, setValue] = useState(0);
  const raf = useRef<number>(0);
  useEffect(() => {
    if (!start) return;
    const t0 = performance.now();
    const duration = 1300;
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(Math.round(to * eased));
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [start, to]);
  return <>{new Intl.NumberFormat(lang).format(value)}</>;
}

export function LeaderboardSection({
  leaders,
  stats,
}: {
  leaders: HomepageLeader[];
  stats: HomepageCommunityStats;
}) {
  const { t, lang } = useI18n();
  const [cat, setCat] = useState<Category>("top");
  const hasData = leaders.length > 0;
  const statsView = useInView<HTMLDivElement>(0.3);

  useEffect(() => {
    if (!hasData) return;
    const order: Category[] = ["top", "games", "sessions"];
    const id = window.setInterval(
      () => setCat((c) => order[(order.indexOf(c) + 1) % order.length]),
      5200
    );
    return () => window.clearInterval(id);
  }, [hasData]);

  const list = useMemo(() => {
    const copy = [...leaders];
    if (cat === "games") {
      return copy.sort(
        (a, b) => b.games_played - a.games_played || b.points - a.points || a.name.localeCompare(b.name)
      );
    }
    if (cat === "sessions") {
      return copy.sort(
        (a, b) => b.sessions_attended - a.sessions_attended || b.points - a.points || a.name.localeCompare(b.name)
      );
    }
    return copy.sort(
      (a, b) => b.points - a.points || b.games_played - a.games_played || a.name.localeCompare(b.name)
    );
  }, [cat, leaders]);

  const podium = list.slice(0, 3);
  const rows = list.slice(3, 9);
  const maxPoints = Math.max(1, ...list.map((r) => r.points));
  const maxGames = Math.max(1, ...list.map((r) => r.games_played));
  const maxSessions = Math.max(1, ...list.map((r) => r.sessions_attended));

  const pctFor = (r: HomepageLeader) => {
    if (cat === "games") return Math.max(6, Math.round((r.games_played / maxGames) * 100));
    if (cat === "sessions") return Math.max(6, Math.round((r.sessions_attended / maxSessions) * 100));
    return Math.max(6, Math.round((r.points / maxPoints) * 100));
  };

  const valueFor = (r: HomepageLeader) =>
    cat === "games" ? r.games_played : cat === "sessions" ? r.sessions_attended : r.points;

  const unit = cat === "games" ? t("landing_lb_games") : cat === "sessions" ? t("landing_lb_sessions") : t("landing_lb_points");

  const tabs: { id: Category; label: string }[] = [
    { id: "top", label: t("landing_lb_tab_top") },
    { id: "games", label: t("landing_lb_tab_games") },
    { id: "sessions", label: t("landing_lb_tab_sessions") },
  ];

  const statCards: { icon: typeof Trophy; label: string; value: number }[] = [
    { icon: Volleyball, label: t("landing_lb_stat_games"), value: stats.games },
    { icon: Users, label: t("landing_lb_stat_players"), value: stats.players },
    { icon: Target, label: t("landing_lb_stat_sessions"), value: stats.sessions },
    { icon: Trophy, label: t("landing_lb_stat_members"), value: stats.members },
  ];

  return (
    <section id="leaders" className={styles.leaderboardSection} aria-label={t("landing_lb_kicker")}>
      <div className={styles.leaderboardBalls} aria-hidden>
        <i><Volleyball size={22} /></i>
        <i><Volleyball size={30} /></i>
        <i><Volleyball size={18} /></i>
      </div>

      <div className={`${styles.section} ${styles.leaderboardWrap}`}>
        <div className={styles.sectionHeading}>
          <span className={styles.kicker}>{t("landing_lb_kicker")}</span>
          <h2>
            {t("landing_lb_title_a")}
            <br />
            <em>{t("landing_lb_title_b")}</em>
          </h2>
          <p>{t("landing_lb_desc")}</p>
        </div>

        <div className={styles.leaderboardStats} ref={statsView.ref} data-visible={statsView.inView}>
          {statCards.map((card) => (
            <div className={styles.statCard} key={card.label}>
              <span className={styles.statIcon}>
                <card.icon size={21} />
              </span>
              <span>
                <span className={styles.statValue}>
                  <CountUp to={card.value} start={statsView.inView} lang={lang} />
                </span>
                <span className={styles.statLabel}>{card.label}</span>
              </span>
            </div>
          ))}
        </div>

        <div className={styles.leaderboardCard}>
          <div className={styles.leaderboardTabs} role="group" aria-label={t("landing_lb_kicker")}>
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                aria-pressed={cat === tab.id}
                className={styles.tabBtn}
                onClick={() => setCat(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {!hasData ? (
            <div className={styles.lbEmpty}>
              <Trophy size={34} />
              <p>{t("landing_lb_empty")}</p>
            </div>
          ) : (
            <>
              <div className={styles.podium}>
                {APEX_ORDER.map((rankIndex, k) => {
                  const leader = podium[rankIndex];
                  if (!leader) return <span key={`empty-${rankIndex}`} className={styles.podiumEmpty} aria-hidden />;
                  return (
                    <div
                      key={leader.member_id}
                      className={`${styles.podiumSlot} ${rankIndex === 0 ? styles.podiumFirst : ""}`}
                    >
                      <span className={styles.podiumCrown} style={{ color: PODIUM_RING[rankIndex] }}>
                        <Crown size={rankIndex === 0 ? 28 : 22} fill={rankIndex === 0 ? "currentColor" : "none"} />
                      </span>
                      <div
                        className={`${styles.podiumAvatar} ${rankIndex === 0 ? styles.podiumAvatarTop : ""}`}
                        style={{ borderColor: PODIUM_RING[rankIndex], animationDelay: `${k * 130}ms` }}
                      >
                        <ProfileAvatar name={leader.name} url={leader.avatar_url} className="h-full w-full" />
                      </div>
                      <div className={styles.podiumTrack}>
                        <div className={styles.podiumBar} style={{ height: PODIUM_BAR_H[rankIndex] }}>
                          <div
                            className={`${styles.podiumBarFill} ${rankIndex === 0 ? styles.podiumBarFillTop : ""}`}
                            style={{ animationDelay: `${350 + k * 130}ms` }}
                          />
                        </div>
                      </div>
                      <div className={styles.podiumMeta}>
                        <strong>{leader.name}</strong>
                        <span>
                          {valueFor(leader)} {unit}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {rows.length > 0 && (
                <div className={styles.lbRows}>
                  {rows.map((leader, i) => (
                    <div className={styles.lbRow} key={leader.member_id}>
                      <span className={styles.lbRank}>{i + 4}</span>
                      <div className={styles.lbAvatar}>
                        <ProfileAvatar name={leader.name} url={leader.avatar_url} className="h-full w-full" />
                      </div>
                      <div className={styles.lbBody}>
                        <div className={styles.lbName}>
                          <strong>{leader.name}</strong>
                          {leader.username && <small>@{leader.username}</small>}
                        </div>
                        <div className={styles.lbLines}>
                          <div className={styles.lbTrack}>
                            <div
                              className={styles.lbFill}
                              style={{ width: `${pctFor(leader)}%`, animationDelay: `${i * 90}ms` }}
                            />
                          </div>
                          <span className={styles.lbValue}>
                            {valueFor(leader)} {unit}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          <Link className={styles.leaderboardCta} href="/signup">
            {t("landing_lb_cta")} <ArrowUpLeft size={18} />
          </Link>
        </div>
      </div>
    </section>
  );
}