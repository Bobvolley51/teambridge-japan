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
import ProfileSetup          from '@/components/ProfileSetup';
import WellnessDashboard     from '@/components/WellnessDashboard';
import SessionRPE            from '@/components/SessionRPE';
import BodyWeightCheck       from '@/components/BodyWeightCheck';
import PerformanceDashboard  from '@/components/PerformanceDashboard';
import MedicalDashboard      from '@/components/MedicalDashboard';
import NotificationBell      from '@/components/NotificationBell';
import PrivacyNotice, { PRIVACY_VERSION } from '@/components/PrivacyNotice';
import { ToastProvider } from '@/lib/toast';
import Tactics               from '@/components/Tactics';
import Travel                from '@/components/Travel';
import PlayerStats           from '@/components/PlayerStats';
import GlobalSearch          from '@/components/GlobalSearch';
import NutritionDashboard   from '@/components/NutritionDashboard';
import styles                from './page.module.css';
import {
  IconHome, IconCalendar, IconChat, IconTactics, IconCheck,
  IconMega, IconPlane, IconUsers, IconHeart, IconChart, IconStats, IconSearch, IconPin,
} from '@/components/icons';

const NAV_BASE = [
  { id: 'dashboard', Icon: IconHome,     label: { en: 'Dashboard', ja: 'ダッシュ' } },
  { id: 'calendar',  Icon: IconCalendar, label: { en: 'Calendar',  ja: 'カレン'   } },
  { id: 'chat',      Icon: IconChat,     label: { en: 'Chat',      ja: 'チャット'  } },
];
const NAV_TACTICS = { id: 'tactics', Icon: IconTactics, label: { en: 'Tactics', ja: '戦術' } };

const NAV_CAL_SUBS = [
  { id: 'tasks',  Icon: IconCheck, label: { en: 'Tasks',  ja: 'タスク'   } },
  { id: 'feed',   Icon: IconMega,  label: { en: 'News',   ja: 'お知らせ' } },
  { id: 'travel', Icon: IconPlane, label: { en: 'Travel', ja: '旅程'     } },
];

const NAV_ADMIN       = { id: 'admin',       Icon: IconUsers,  label: { en: 'Users',   ja: 'ユーザー'   } };
const NAV_WELLNESS    = { id: 'wellness',    Icon: IconHeart,  label: { en: 'Wellness',   ja: '健康'  } };
const NAV_NUTRITION   = { id: 'nutrition',  Icon: IconCheck,  label: { en: 'Nutrition',  ja: '栄養'  } };
const NAV_PERFORMANCE = { id: 'performance', Icon: IconChart,  label: { en: 'Load',    ja: '負荷'       } };
const NAV_MYSTATS     = { id: 'mystats',     Icon: IconStats,  label: { en: 'Stats',   ja: 'データ'     } };
const NAV_MEDICAL     = { id: 'medical',     Icon: IconPin,    label: { en: 'Medical', ja: 'メディカル' } };

// Roles that can view the wellness dashboard
const WELLNESS_VIEWERS    = ['GM', 'Headcoach', 'Athletic Trainer', 'Therapist', 'Coaching Staff'];
const PERFORMANCE_VIEWERS = ['GM', 'Headcoach', 'Athletic Trainer', 'Therapist', 'Coaching Staff'];
const MEDICAL_VIEWERS     = ['Therapist', 'Headcoach', 'Athletic Trainer', 'GM', 'Coaching Staff'];
const TACTICS_VIEWERS     = ['GM', 'Headcoach', 'Coaching Staff', 'Player'];

export default function Home() {
  const [session,       setSession]       = useState(undefined);
  const [profile,       setProfile]       = useState(null);
  const [nav,           setNav]           = useState('dashboard');
  const [lang,          setLang]          = useState(() =>
    (typeof window !== 'undefined' && localStorage.getItem('tb_lang')) || 'en'
  );
  const navigate = (id) => { setNav(id); localStorage.setItem('tb_nav', id); };

  const [calGroupOpen,     setCalGroupOpen]     = useState(() =>
    ['calendar', 'tasks', 'feed', 'travel'].includes(
      typeof window !== 'undefined' ? localStorage.getItem('tb_nav') || 'dashboard' : 'dashboard'
    )
  );
  const [showPrivacy,      setShowPrivacy]      = useState(false);
  const [showProfileSetup, setShowProfileSetup] = useState(false);
  const [showWellness,     setShowWellness]     = useState(false);
  const [showRPE,          setShowRPE]          = useState(false);
  const [pendingRPEEvents, setPendingRPEEvents] = useState([]);
  const [showBodyWeight,   setShowBodyWeight]   = useState(false);
  const [bwWeekStart,      setBwWeekStart]      = useState('');
  const [perfAlertCount,   setPerfAlertCount]   = useState(0);
  const [unreadChat,       setUnreadChat]       = useState(0);
  const [showSearch,       setShowSearch]       = useState(false);

  // Auth listener
  useEffect(() => {
    supabase.auth.getSession().then(({ data, error }) => {
      if (error || !data.session) {
        setSession(null);
      } else {
        setSession(data.session);
      }
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, s) => {
        if (event === 'SIGNED_OUT' || (event === 'TOKEN_REFRESHED' && !s)) {
          setSession(null);
          return;
        }
        setSession(s ?? null);
      }
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
        if (p.new.sender_id !== userId && !p.new.channel?.startsWith('dm:')) {
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
    const cutoff = new Date(Date.now() - 12 * 3600 * 1000).toISOString();
    const now    = new Date().toISOString();

    // Trigger from start_time so players can log RPE as soon as practice begins
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
      .in('category', ['Ball-Practice', 'Game'])
      .gte('start_time', cutoff)
      .lte('start_time', now);

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

  const checkPendingBodyWeight = async (userId) => {
    // Monday of current ISO week
    const now = new Date();
    const dow = (now.getDay() + 6) % 7;
    const monday = new Date(now);
    monday.setDate(now.getDate() - dow);
    monday.setHours(0, 0, 0, 0);
    const weekStart = monday.toISOString().slice(0, 10);

    if (localStorage.getItem(`bw_done_${userId}_${weekStart}`)) return;

    // Check already submitted to DB
    const { data: existing } = await supabase
      .from('player_bodyweight')
      .select('id')
      .eq('user_id', userId)
      .eq('week_start', weekStart)
      .limit(1);
    if (existing?.length) return;

    // Check for any Weightlifting event this week the player was part of
    const { data: participation } = await supabase
      .from('event_participants')
      .select('event_id')
      .eq('profile_id', userId);
    if (!participation?.length) return;

    const { data: events } = await supabase
      .from('events')
      .select('id')
      .in('id', participation.map(p => p.event_id))
      .eq('category', 'Weightlifting')
      .gte('start_time', monday.toISOString())
      .lte('start_time', now.toISOString());
    if (!events?.length) return;

    setBwWeekStart(weekStart);
    setShowBodyWeight(true);
  };

  // Load profile + show wellness check once per day on first login
  const loadProfile = async (userId, checkWellness = true) => {
    // fire-and-forget — stamp the user's last active time
    supabase.from('profiles').update({ last_seen_at: new Date().toISOString() }).eq('id', userId).then();

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

    if (!prof?.first_name || !prof?.last_name || !prof?.date_of_birth) {
      setShowProfileSetup(true);
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
      // Wellness already done today — check for pending RPE then body weight
      await checkPendingRPE(userId);
      await checkPendingBodyWeight(userId);
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
    // After wellness, check for pending session RPE then body weight
    if (session?.user) {
      checkPendingRPE(session.user.id);
      checkPendingBodyWeight(session.user.id);
    }
  };

  const handleBodyWeightDone = () => {
    localStorage.setItem(`bw_done_${session?.user?.id}_${bwWeekStart}`, '1');
    setShowBodyWeight(false);
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
  const displayName  = profile?.display_name
    || (profile?.first_name && profile?.last_name ? `${profile.first_name} ${profile.last_name}` : null)
    || user.email;
  const initials     = (displayName ?? 'U').slice(0, 2).toUpperCase();
  const isAdmin        = ['GM', 'Headcoach', 'Organisation Staff'].includes(profile?.role);
  const isPlayer       = profile?.role === 'Player';
  const canWellness    = WELLNESS_VIEWERS.includes(profile?.role);
  const canNutrition   = isPlayer || canWellness;
  const canPerformance = PERFORMANCE_VIEWERS.includes(profile?.role);
  const canMedical     = MEDICAL_VIEWERS.includes(profile?.role);
  const canTactics     = TACTICS_VIEWERS.includes(profile?.role);

  const nav_items = [
    ...NAV_BASE,
    ...(canTactics     ? [NAV_TACTICS]     : []),
    ...(isPlayer       ? [NAV_MYSTATS]     : []),
    ...(canWellness    ? [NAV_WELLNESS]    : []),
    ...(canNutrition   ? [NAV_NUTRITION]   : []),
    ...(canPerformance ? [NAV_PERFORMANCE] : []),
    ...(canMedical     ? [NAV_MEDICAL]     : []),
    ...(isAdmin        ? [NAV_ADMIN]       : []),
  ];

  return (
    <ToastProvider>
    <div className={styles.app}>
      <header className={styles.header}>
        <div className={styles.logo}>
          <img src="/logo-white.png" alt="Tridents" className={styles.logoImg} />
        </div>
        <div className={styles.headerRight}>
          <button className={styles.searchBtn} onClick={() => setShowSearch(true)} title="Search (Ctrl+K)">
            <IconSearch size={15} />
          </button>
          <button className={`${styles.langBtn} ${lang==='en'?styles.langActive:''}`} onClick={()=>{setLang('en');localStorage.setItem('tb_lang','en');}}>EN</button>
          <button className={`${styles.langBtn} ${lang==='ja'?styles.langActive:''}`} onClick={()=>{setLang('ja');localStorage.setItem('tb_lang','ja');}}>日本語</button>
          <NotificationBell userId={user.id} lang={lang} onNavigate={navigate} chatUnread={unreadChat} />
          <UserMenu user={user} profile={profile} lang={lang} onProfileUpdate={() => loadProfile(user.id, false)} />
        </div>
      </header>

      <div className={styles.body}>
        <aside className={styles.sidebar}>
          {nav_items.map(item => {
            const isCalGroup = item.id === 'calendar';
            const calActive  = isCalGroup && (['calendar', ...NAV_CAL_SUBS.map(s => s.id)].includes(nav));
            const ItemIcon   = item.Icon;
            return (
              <div key={item.id}>
                <button
                  className={`${styles.navItem} ${(nav===item.id || (isCalGroup && calActive)) ? styles.navActive : ''}`}
                  onClick={() => {
                    navigate(item.id);
                    if (item.id === 'chat') setUnreadChat(0);
                    if (isCalGroup) setCalGroupOpen(o => !o);
                  }}>
                  <span className={styles.navIcon}><ItemIcon size={18} /></span>
                  {item.label[lang]}
                  {item.id === 'performance' && perfAlertCount > 0 && (
                    <span className={styles.navBadge}>{perfAlertCount}</span>
                  )}
                  {item.id === 'chat' && unreadChat > 0 && nav !== 'chat' && (
                    <span className={styles.navBadge}>{unreadChat > 99 ? '99+' : unreadChat}</span>
                  )}
                </button>
                {isCalGroup && calGroupOpen && NAV_CAL_SUBS.map(sub => {
                  const SubIcon = sub.Icon;
                  return (
                    <button key={sub.id}
                      className={`${styles.navSubItem} ${nav===sub.id ? styles.navActive : ''}`}
                      onClick={() => navigate(sub.id)}>
                      <span className={styles.navIcon}><SubIcon size={16} /></span>
                      {sub.label[lang]}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </aside>
        <main className={styles.main}>
          {/* Mobile calendar sub-nav strip */}
          {['calendar','tasks','feed','travel'].includes(nav) && (
            <nav className={styles.calSubNav}>
              {[{ id: 'calendar', Icon: IconCalendar, label: { en: 'Calendar', ja: 'カレンダー' } }, ...NAV_CAL_SUBS].map(sub => {
                const SubIcon = sub.Icon;
                return (
                  <button key={sub.id}
                    className={`${styles.calSubBtn} ${nav === sub.id ? styles.calSubBtnActive : ''}`}
                    onClick={() => navigate(sub.id)}>
                    <SubIcon size={15} />
                    {sub.label[lang]}
                  </button>
                );
              })}
            </nav>
          )}
          {nav==='dashboard' && <Dashboard lang={lang} profile={profile} currentUserId={user.id} currentUserName={displayName} currentUserInitials={initials} onNavigate={navigate} onOpenWellness={profile?.role === 'Player' ? () => setShowWellness(true) : undefined} />}
          {nav==='calendar'  && <Calendar          lang={lang} currentUserName={displayName} role={profile?.role} currentUserId={user.id} />}
          {nav==='chat'      && <Chat              uiLang={lang} currentUser={{ name: displayName, initials, id: user.id, avatarUrl: profile?.avatar_url }} profile={profile} />}
          {nav==='tasks'     && <Tasks             lang={lang} profile={profile} />}
          {nav==='tactics'   && canTactics && <Tactics           lang={lang} profile={profile} />}
          {nav==='feed'      && <Announcements     lang={lang} currentUserName={user.email} />}
          {nav==='travel'    && <Travel            lang={lang} profile={profile} currentUserName={displayName} />}
          {nav==='mystats'   && isPlayer         && <PlayerStats lang={lang} profile={profile} onEditWellness={() => setShowWellness(true)} />}
          {nav==='wellness'     && canWellness    && <WellnessDashboard    lang={lang} profile={profile} />}
          {nav==='nutrition'    && canNutrition   && <NutritionDashboard   lang={lang} profile={profile} />}
          {nav==='performance'  && canPerformance && <PerformanceDashboard lang={lang} profile={profile} />}
          {nav==='medical'      && canMedical     && <MedicalDashboard     lang={lang} profile={profile} currentUserName={displayName} />}
          {nav==='admin'        && isAdmin        && <RoleManager          lang={lang} currentUserId={user.id} currentUserRole={profile?.role} isSuperAdmin={profile?.is_super_admin === true} />}
        </main>
      </div>

      {/* Mobile bottom navigation */}
      <nav className={styles.mobileNav}>
        {nav_items.map(item => {
          const MIcon = item.Icon;
          return (
          <button key={item.id}
            className={`${styles.mobileNavItem} ${nav===item.id?styles.mobileNavActive:''}`}
            onClick={() => { navigate(item.id); if (item.id === 'chat') setUnreadChat(0); }}>
            <span className={styles.mobileNavIconWrap}>
              <MIcon size={20} />
              {item.id === 'performance' && perfAlertCount > 0 && (
                <span className={styles.mobileNavBadge}>{perfAlertCount}</span>
              )}
              {item.id === 'chat' && unreadChat > 0 && nav !== 'chat' && (
                <span className={styles.mobileNavBadge}>{unreadChat > 99 ? '99+' : unreadChat}</span>
              )}
            </span>
            {item.label[lang]}
          </button>
          );
        })}
      </nav>

      {showSearch && (
        <GlobalSearch lang={lang} onNavigate={navigate} onClose={() => setShowSearch(false)} />
      )}

      {showPrivacy && (
        <PrivacyNotice
          userId={user.id}
          lang={lang}
          onLangChange={(l) => { setLang(l); localStorage.setItem('tb_lang', l); }}
          onAccept={() => { setShowPrivacy(false); loadProfile(user.id); }}
        />
      )}

      {showProfileSetup && (
        <ProfileSetup
          userId={user.id}
          currentRole={profile?.role}
          lang={lang}
          onComplete={(updates) => {
            setProfile(prev => ({ ...prev, ...updates }));
            setShowProfileSetup(false);
            loadProfile(user.id);
          }}
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

      {showBodyWeight && (
        <BodyWeightCheck
          userId={user.id}
          userName={displayName}
          weekStart={bwWeekStart}
          lang={lang}
          onComplete={handleBodyWeightDone}
        />
      )}
    </div>
    </ToastProvider>
  );
}
