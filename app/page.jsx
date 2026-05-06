'use client';

// app/page.jsx — Full TeamBridge Japan App

import { useState, useEffect } from 'react';
import { supabase }          from '@/lib/supabase';
import Login                 from '@/components/Login';
import Dashboard             from '@/components/Dashboard';
import Chat                  from '@/components/Chat';
import Tasks                 from '@/components/Tasks';
import Announcements         from '@/components/Announcements';
import RoleManager           from '@/components/RoleManager';
import Calendar              from '@/components/Calendar';
import UserMenu              from '@/components/UserMenu';
import WellnessCheck         from '@/components/WellnessCheck';
import WellnessDashboard     from '@/components/WellnessDashboard';
import SessionRPE            from '@/components/SessionRPE';
import PerformanceDashboard  from '@/components/PerformanceDashboard';
import NotificationBell      from '@/components/NotificationBell';
import PrivacyNotice, { PRIVACY_VERSION } from '@/components/PrivacyNotice';
import { ToastProvider } from '@/lib/toast';
import Tactics               from '@/components/Tactics';
import Travel                from '@/components/Travel';
import PlayerStats           from '@/components/PlayerStats';
import GlobalSearch          from '@/components/GlobalSearch';
import styles                from './page.module.css';

const NAV_BASE = [
  { id: 'dashboard', icon: '🏠', label: { en: 'Dashboard',    ja: 'ダッシュボード' } },
  { id: 'calendar',  icon: '📅', label: { en: 'Calendar',     ja: 'カレンダー'    } },
  { id: 'chat',      icon: '💬', label: { en: 'Chat',         ja: 'チャット'      } },
  { id: 'tasks',     icon: '✅', label: { en: 'Tasks',        ja: 'タスク'        } },
  { id: 'tactics',   icon: '🎯', label: { en: 'Tactics',       ja: '戦術'          } },
  { id: 'travel',    icon: '✈️', label: { en: 'Travel',        ja: '旅程'          } },
  { id: 'feed',      icon: '📢', label: { en: 'Announcements',ja: 'お知らせ'      } },
];

const NAV_ADMIN       = { id: 'admin',       icon: '👥', label: { en: 'Users',       ja: 'ユーザー管理'   } };
const NAV_WELLNESS    = { id: 'wellness',    icon: '💪', label: { en: 'Wellness',    ja: 'ウェルネス'     } };
const NAV_PERFORMANCE = { id: 'performance', icon: '📊', label: { en: 'Performance', ja: 'パフォーマンス' } };
const NAV_MYSTATS     = { id: 'mystats',     icon: '📈', label: { en: 'My Stats',    ja: 'マイデータ'     } };

// Roles that can view the wellness dashboard
const WELLNESS_VIEWERS    = ['GM', 'Headcoach', 'Athletic', 'Therapist'];
const PERFORMANCE_VIEWERS = ['Headcoach', 'Athletic', 'Therapist', 'Staff/Orga'];

export default function Home() {
  const [session,       setSession]       = useState(undefined);
  const [profile,       setProfile]       = useState(null);
  const [nav,           setNav]           = useState('dashboard');
  const [lang,          setLang]          = useState(() =>
    (typeof window !== 'undefined' && localStorage.getItem('tb_lang')) || 'en'
  );
  const [showPrivacy,      setShowPrivacy]      = useState(false);
  const [showWellness,     setShowWellness]     = useState(false);
  const [showRPE,          setShowRPE]          = useState(false);
  const [pendingRPEEvents, setPendingRPEEvents] = useState([]);
  const [perfAlertCount,   setPerfAlertCount]   = useState(0);
  const [unreadChat,       setUnreadChat]       = useState(0);
  const [showSearch,       setShowSearch]       = useState(false);

  // Auth listener
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session ?? null));
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, s) => setSession(s ?? null)
    );
    return () => subscription.unsubscribe();
  }, []);

  // Global search keyboard shortcut
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowSearch(v => !v);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Unread chat badge — count new messages while user is away from Chat tab
  useEffect(() => {
    if (!session?.user) return;
    const userId = session.user.id;
    const ch = supabase.channel('unread-chat')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (p) => {
        if (p.new.sender_id !== userId) {
          setUnreadChat(n => n + 1);
        }
      })
      .subscribe();
    return () => ch.unsubscribe();
  }, [session?.user?.id]);

  const checkPerfAlerts = async () => {
    const since = new Date();
    since.setDate(since.getDate() - 28);
    const { data } = await supabase
      .from('session_rpe')
      .select('user_id, event_date, load_au')
      .gte('event_date', since.toISOString().slice(0, 10));
    if (!data || data.length === 0) return;

    const now   = new Date();
    const day7  = new Date(now); day7.setDate(day7.getDate() - 7);
    const day28 = new Date(now); day28.setDate(day28.getDate() - 28);
    const map = {};
    for (const r of data) {
      if (!map[r.user_id]) map[r.user_id] = [];
      map[r.user_id].push(r);
    }
    let count = 0;
    for (const sessions of Object.values(map)) {
      const acute   = sessions.filter(s => new Date(s.event_date) >= day7).reduce((a, s) => a + s.load_au, 0);
      const chronic = sessions.filter(s => new Date(s.event_date) >= day28).reduce((a, s) => a + s.load_au, 0) / 4;
      if (chronic > 0 && (acute / chronic) > 1.3) count++;
    }
    setPerfAlertCount(count);
  };

  const checkPendingRPE = async (userId) => {
    const cutoff = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const now    = new Date().toISOString();

    // Find events this player participated in that ended in the last 24h
    const { data: participation } = await supabase
      .from('event_participants')
      .select('event_id')
      .eq('profile_id', userId);

    if (!participation || participation.length === 0) return;
    const eventIds = participation.map(p => p.event_id);

    const { data: events } = await supabase
      .from('events')
      .select('id, title, start_time, end_time, category')
      .in('id', eventIds)
      .in('category', ['Training', 'Game'])
      .gte('end_time', cutoff)
      .lte('end_time', now);

    if (!events || events.length === 0) return;

    // Filter out already logged
    const { data: logged } = await supabase
      .from('session_rpe')
      .select('event_id')
      .eq('user_id', userId)
      .in('event_id', events.map(e => e.id));

    const loggedIds = new Set((logged ?? []).map(l => l.event_id));

    const pending = events.filter(e =>
      !loggedIds.has(e.id) &&
      !localStorage.getItem(`rpe_done_${userId}_${e.id}`)
    );

    if (pending.length > 0) {
      setPendingRPEEvents(pending);
      setShowRPE(true);
    }
  };

  // Load profile + show wellness check once per day on first login
  const loadProfile = async (userId, checkWellness = true) => {
    // fire-and-forget — stamp the user's last active time
    supabase.from('profiles').update({ last_seen_at: new Date().toISOString() }).eq('id', userId);

    const { data: prof } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    setProfile(prof);

    // DB column is the sole source of truth. If the stored version doesn't match
    // the current PRIVACY_VERSION the notice is shown, no exceptions.
    if (prof?.privacy_version !== PRIVACY_VERSION) {
      setShowPrivacy(true);
      return;
    }

    if (checkWellness && prof?.role === 'Player') {
      const today = new Date().toISOString().slice(0, 10);
      // localStorage prevents re-showing after skip or submit within the same day
      if (!localStorage.getItem(`wellness_done_${userId}_${today}`)) {
        const { data: existing } = await supabase
          .from('wellness_responses')
          .select('id')
          .eq('user_id', userId)
          .eq('response_date', today)
          .limit(1);
        if (!existing || existing.length === 0) {
          setShowWellness(true);
          return; // show wellness first; RPE will be checked after
        }
      }
      // Wellness already done today — check for pending RPE
      await checkPendingRPE(userId);
    }

    // For performance-viewer roles, pre-fetch alert count
    if (PERFORMANCE_VIEWERS.includes(prof?.role)) {
      checkPerfAlerts();
    }
  };

  const handleWellnessDone = () => {
    const today = new Date().toISOString().slice(0, 10);
    if (session?.user) {
      localStorage.setItem(`wellness_done_${session.user.id}_${today}`, '1');
    }
    setShowWellness(false);
    // After wellness, check for pending session RPE
    if (session?.user) checkPendingRPE(session.user.id);
  };

  useEffect(() => {
    if (!session?.user) { setProfile(null); return; }
    loadProfile(session.user.id);
  }, [session]);

  if (session === undefined) {
    return (
      <div style={{ height:'100vh', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, color:'#9ca3af' }}>
        Loading…
      </div>
    );
  }

  if (!session) return <Login lang={lang} onLangChange={(l) => { setLang(l); localStorage.setItem('tb_lang', l); }} />;

  const user         = session.user;
  const displayName  = profile?.display_name || user.email;
  const initials     = (displayName ?? 'U').slice(0, 2).toUpperCase();
  const isAdmin        = ['GM', 'Headcoach'].includes(profile?.role);
  const canWellness    = WELLNESS_VIEWERS.includes(profile?.role);
  const canPerformance = PERFORMANCE_VIEWERS.includes(profile?.role);

  const isPlayer = profile?.role === 'Player';

  const nav_items = [
    ...NAV_BASE,
    ...(isPlayer       ? [NAV_MYSTATS]     : []),
    ...(canWellness    ? [NAV_WELLNESS]    : []),
    ...(canPerformance ? [NAV_PERFORMANCE] : []),
    ...(isAdmin        ? [NAV_ADMIN]       : []),
  ];

  return (
    <ToastProvider>
    <div className={styles.app}>
      <header className={styles.header}>
        <div className={styles.logo}>
          <div className={styles.logoDot} />
          <span className={styles.logoText}>{lang === 'ja' ? 'チームブリッジ' : 'TeamBridge Japan'}</span>
        </div>
        <div className={styles.headerRight}>
          <button className={styles.searchBtn} onClick={() => setShowSearch(true)} title="Search (Ctrl+K)">
            🔍
          </button>
          <button className={`${styles.langBtn} ${lang==='en'?styles.langActive:''}`} onClick={()=>{setLang('en');localStorage.setItem('tb_lang','en');}}>EN</button>
          <button className={`${styles.langBtn} ${lang==='ja'?styles.langActive:''}`} onClick={()=>{setLang('ja');localStorage.setItem('tb_lang','ja');}}>日本語</button>
          <NotificationBell userId={user.id} lang={lang} onNavigate={setNav} />
          <UserMenu user={user} profile={profile} lang={lang} onProfileUpdate={() => loadProfile(user.id, false)} />
        </div>
      </header>

      <div className={styles.body}>
        <aside className={styles.sidebar}>
          {nav_items.map(item => (
            <button key={item.id}
              className={`${styles.navItem} ${nav===item.id?styles.navActive:''}`}
              onClick={() => { setNav(item.id); if (item.id === 'chat') setUnreadChat(0); }}>
              <span className={styles.navIcon}>{item.icon}</span>
              {item.label[lang]}
              {item.id === 'performance' && perfAlertCount > 0 && (
                <span className={styles.navBadge}>{perfAlertCount}</span>
              )}
              {item.id === 'chat' && unreadChat > 0 && nav !== 'chat' && (
                <span className={styles.navBadge}>{unreadChat > 99 ? '99+' : unreadChat}</span>
              )}
            </button>
          ))}
        </aside>
        <main className={styles.main}>
          {nav==='dashboard' && <Dashboard lang={lang} profile={profile} currentUserId={user.id} currentUserName={displayName} currentUserInitials={initials} onNavigate={setNav} />}
          {nav==='calendar'  && <Calendar          lang={lang} currentUserName={displayName} role={profile?.role} currentUserId={user.id} />}
          {nav==='chat'      && <Chat              uiLang={lang} currentUser={{ name: displayName, initials, id: user.id, avatarUrl: profile?.avatar_url }} profile={profile} />}
          {nav==='tasks'     && <Tasks             lang={lang} profile={profile} />}
          {nav==='tactics'   && <Tactics           lang={lang} profile={profile} />}
          {nav==='feed'      && <Announcements     lang={lang} currentUserName={user.email} />}
          {nav==='travel'    && <Travel            lang={lang} profile={profile} currentUserName={displayName} />}
          {nav==='mystats'   && isPlayer         && <PlayerStats lang={lang} profile={profile} onEditWellness={() => setShowWellness(true)} />}
          {nav==='wellness'     && canWellness    && <WellnessDashboard    lang={lang} />}
          {nav==='performance'  && canPerformance && <PerformanceDashboard lang={lang} />}
          {nav==='admin'        && isAdmin        && <RoleManager          lang={lang} currentUserId={user.id} currentUserRole={profile?.role} />}
        </main>
      </div>

      {/* Mobile bottom navigation */}
      <nav className={styles.mobileNav}>
        {nav_items.map(item => (
          <button key={item.id}
            className={`${styles.mobileNavItem} ${nav===item.id?styles.mobileNavActive:''}`}
            onClick={() => { setNav(item.id); if (item.id === 'chat') setUnreadChat(0); }}>
            <span className={styles.mobileNavIconWrap}>
              {item.icon}
              {item.id === 'performance' && perfAlertCount > 0 && (
                <span className={styles.mobileNavBadge}>{perfAlertCount}</span>
              )}
              {item.id === 'chat' && unreadChat > 0 && nav !== 'chat' && (
                <span className={styles.mobileNavBadge}>{unreadChat > 99 ? '99+' : unreadChat}</span>
              )}
            </span>
            {item.label[lang]}
          </button>
        ))}
      </nav>

      {showSearch && (
        <GlobalSearch lang={lang} onNavigate={setNav} onClose={() => setShowSearch(false)} />
      )}

      {showPrivacy && (
        <PrivacyNotice
          userId={user.id}
          lang={lang}
          onLangChange={(l) => { setLang(l); localStorage.setItem('tb_lang', l); }}
          onAccept={() => { setShowPrivacy(false); loadProfile(user.id); }}
        />
      )}

      {showWellness && (
        <WellnessCheck
          userId={user.id}
          userName={displayName}
          lang={lang}
          onComplete={handleWellnessDone}
        />
      )}

      {showRPE && pendingRPEEvents.length > 0 && (
        <SessionRPE
          pendingEvents={pendingRPEEvents}
          userId={user.id}
          userName={displayName}
          lang={lang}
          onComplete={() => { setShowRPE(false); setPendingRPEEvents([]); }}
        />
      )}
    </div>
    </ToastProvider>
  );
}
