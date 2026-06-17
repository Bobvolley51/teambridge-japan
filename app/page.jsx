'use client';

// app/page.jsx — Full TeamBridge Japan App

import { useState, useEffect, useRef, useCallback, Component } from 'react';

class AppErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 32, fontFamily: 'sans-serif', maxWidth: 480, margin: '0 auto' }}>
          <h2 style={{ color: '#b91c1c' }}>Something went wrong</h2>
          <pre style={{ background: '#fef2f2', padding: 12, borderRadius: 8, fontSize: 12, whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: '#7f1d1d' }}>
            {this.state.error?.message}
            {'\n\n'}
            {this.state.error?.stack}
          </pre>
          <button onClick={() => window.location.reload()}
            style={{ marginTop: 16, padding: '10px 24px', background: '#7e0027', color: '#fff', border: 'none', borderRadius: 8, fontSize: 15, cursor: 'pointer' }}>
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
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
import { toJstDateStr, toJstDate, dateToYmd } from '@/lib/date';
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
import { syncPushSubscription } from '@/lib/push-register';
import { computeEWMA }          from '@/lib/acwr';
import styles                from './page.module.css';
import {
  IconHome, IconCalendar, IconChat, IconTactics, IconCheck,
  IconMega, IconPlane, IconUsers, IconHeart, IconChart, IconStats, IconSearch, IconPin, IconActivity,
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

const NAV_ADMIN       = { id: 'admin',       Icon: IconUsers,    label: { en: 'Users',     ja: 'ユーザー'   } };
const NAV_PLAYERS     = { id: 'players',     Icon: IconActivity, label: { en: 'Players',   ja: '選手'       } };
const NAV_WELLNESS    = { id: 'wellness',    Icon: IconHeart,    label: { en: 'Wellness',  ja: '健康'       } };
const NAV_NUTRITION   = { id: 'nutrition',   Icon: IconCheck,    label: { en: 'Nutrition', ja: '栄養'       } };
const NAV_PERFORMANCE = { id: 'performance', Icon: IconChart,    label: { en: 'Load',      ja: '負荷'       } };
const NAV_MYSTATS     = { id: 'mystats',     Icon: IconStats,    label: { en: 'Stats',     ja: 'データ'     } };
const NAV_MEDICAL     = { id: 'medical',     Icon: IconPin,      label: { en: 'Medical',   ja: 'メディカル' } };
const PLAYERS_IDS     = new Set(['wellness', 'nutrition', 'performance', 'medical']);

// Roles that can view the wellness dashboard
const WELLNESS_VIEWERS    = ['GM / Director', 'Headcoach', 'Athletic Trainer', 'Therapist', 'Coaching Staff'];
const PERFORMANCE_VIEWERS = ['GM / Director', 'Headcoach', 'Athletic Trainer', 'Therapist', 'Coaching Staff'];
const MEDICAL_VIEWERS     = ['Therapist', 'Headcoach', 'Athletic Trainer', 'GM / Director', 'Coaching Staff'];
const TACTICS_VIEWERS     = ['GM / Director', 'Headcoach', 'Coaching Staff'];

function pad(n) { return String(n).padStart(2, '0'); }

export default function Home() {
  const [session,       setSession]       = useState(undefined);
  const [profile,       setProfile]       = useState(null);
  const [nav,           setNav]           = useState(() => {
    if (typeof window === 'undefined') return 'dashboard';
    const params = new URLSearchParams(window.location.search);
    return params.get('nav') || localStorage.getItem('tb_nav') || 'dashboard';
  });
  const [lang,          setLang]          = useState(() =>
    (typeof window !== 'undefined' && localStorage.getItem('tb_lang')) || 'en'
  );
  const navigate = (id) => { setNav(id); navRef.current = id; localStorage.setItem('tb_nav', id); };

  const [calGroupOpen,     setCalGroupOpen]     = useState(() =>
    ['calendar', 'tasks', 'feed', 'travel'].includes(
      typeof window !== 'undefined' ? localStorage.getItem('tb_nav') || 'dashboard' : 'dashboard'
    )
  );
  const [playersGroupOpen, setPlayersGroupOpen] = useState(() =>
    PLAYERS_IDS.has(
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
  const [nutritionBadge,   setNutritionBadge]   = useState(0);
  const [unreadChat,       setUnreadChat]       = useState(0);
  const [totalUnread,      setTotalUnread]      = useState(0);
  const [sectionUnread,    setSectionUnread]    = useState({});
  const [showSearch,       setShowSearch]       = useState(false);
  const [showIdleWarning,  setShowIdleWarning]  = useState(false);
  const [idleCountdown,    setIdleCountdown]    = useState(120);
  const idleTimer       = useRef(null);
  const warnTimer       = useRef(null);
  const navRef          = useRef(nav);
  const mainRef         = useRef(null);
  const touchStartYRef  = useRef(0);
  const isPullingRef    = useRef(false);
  const pullDeltaRef    = useRef(0);

  const [pullDelta,   setPullDelta]   = useState(0);
  const [refreshing,  setRefreshing]  = useState(false);
  const PULL_THRESHOLD = 72;

  const IDLE_MS      = 60 * 60 * 1000; // 1 hour
  const WARN_BEFORE  = 2  * 60 * 1000; // warn 2 min before

  const resetIdleTimer = useCallback(() => {
    setShowIdleWarning(false);
    setIdleCountdown(120);
    clearTimeout(idleTimer.current);
    clearInterval(warnTimer.current);
    idleTimer.current = setTimeout(() => {
      setShowIdleWarning(true);
      setIdleCountdown(120);
      warnTimer.current = setInterval(() => {
        setIdleCountdown(prev => {
          if (prev <= 1) {
            clearInterval(warnTimer.current);
            supabase.auth.signOut();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }, IDLE_MS - WARN_BEFORE);
  }, []);

  // Start/reset idle timer whenever the user is logged in
  useEffect(() => {
    if (!session) return;
    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'];
    const handler = () => resetIdleTimer();
    events.forEach(e => window.addEventListener(e, handler, { passive: true }));
    resetIdleTimer();
    return () => {
      events.forEach(e => window.removeEventListener(e, handler));
      clearTimeout(idleTimer.current);
      clearInterval(warnTimer.current);
    };
  }, [session, resetIdleTimer]);

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

  // Update browser tab title and home-screen app badge when unread count changes
  useEffect(() => {
    const base = 'TeamBridge';
    document.title = totalUnread > 0 ? `(${totalUnread}) ${base}` : base;
    if ('setAppBadge' in navigator) {
      totalUnread > 0 ? navigator.setAppBadge(totalUnread) : navigator.clearAppBadge();
    }
  }, [totalUnread]);

  // Register Service Worker
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);

  // Auto-sync push subscription on every login.
  // Covers: PWA reinstall (iOS), subscription expiry, browser data clear.
  // If permission is granted but no subscription exists, re-subscribes silently.
  // If subscription exists, upserts it so the DB stays current.
  useEffect(() => {
    if (!session?.user?.id) return;
    syncPushSubscription(session.user.id);
  }, [session?.user?.id]);

  // Clean ?nav= query param from URL after reading it on first load
  useEffect(() => {
    if (window.location.search.includes('nav=')) {
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  // Handle messages from the service worker
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const handler = (e) => {
      // Navigation on notification click
      if (e.data?.type === 'NAVIGATE') {
        try {
          const url = new URL(e.data.url, window.location.origin);
          const navParam = url.searchParams.get('nav');
          if (navParam) { setNav(navParam); localStorage.setItem('tb_nav', navParam); }
        } catch {}
      }
      // Badge count from service worker fallback (when SW can't call setAppBadge directly)
      if (e.data?.type === 'SET_BADGE' && 'setAppBadge' in navigator) {
        navigator.setAppBadge(e.data.count).catch(() => {});
      }
      // iOS APNs token renewal — re-register the new subscription
      if (e.data?.type === 'PUSH_RESUBSCRIBE' && e.data.subscription) {
        const userId = session?.user?.id;
        if (userId) {
          fetch('/api/push-subscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, subscription: e.data.subscription }),
          }).catch(() => {});
        }
      }
    };
    navigator.serviceWorker.addEventListener('message', handler);
    return () => navigator.serviceWorker.removeEventListener('message', handler);
  }, [session?.user?.id]);

  // Pull-to-refresh gesture on the main content area
  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;
    const onTouchStart = (e) => {
      if (el.scrollTop > 0) { isPullingRef.current = false; return; }
      touchStartYRef.current = e.touches[0].clientY;
      isPullingRef.current = true;
    };
    const onTouchMove = (e) => {
      if (!isPullingRef.current) return;
      const delta = e.touches[0].clientY - touchStartYRef.current;
      if (delta > 0) {
        const clamped = Math.min(delta * 0.55, PULL_THRESHOLD);
        pullDeltaRef.current = clamped;
        setPullDelta(clamped);
      } else {
        isPullingRef.current = false;
        pullDeltaRef.current = 0;
        setPullDelta(0);
      }
    };
    const onTouchEnd = () => {
      if (!isPullingRef.current) return;
      isPullingRef.current = false;
      if (pullDeltaRef.current >= PULL_THRESHOLD) {
        setRefreshing(true);
        setTimeout(() => window.location.reload(), 250);
      } else {
        pullDeltaRef.current = 0;
        setPullDelta(0);
      }
    };
    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove',  onTouchMove,  { passive: true });
    el.addEventListener('touchend',   onTouchEnd,   { passive: true });
    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove',  onTouchMove);
      el.removeEventListener('touchend',   onTouchEnd);
    };
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
        // Skip if the user sent it, or if they're currently viewing the chat tab
        if (p.new.sender_id !== userId && navRef.current !== 'chat') {
          setUnreadChat(n => n + 1);
        }
      })
      .subscribe();
    return () => ch.unsubscribe();
  }, [session?.user?.id]);

  const checkPerfAlerts = async () => {
    const since = new Date();
    since.setDate(since.getDate() - 90); // 90 days for stable EWMA
    const { data } = await supabase
      .from('session_rpe')
      .select('user_id, event_date, load_au')
      .gte('event_date', since.toISOString().slice(0, 10))
      .order('event_date', { ascending: true });
    if (!data || data.length === 0) return;

    const map = {};
    for (const r of data) {
      if (!map[r.user_id]) map[r.user_id] = [];
      map[r.user_id].push(r);
    }
    let count = 0;
    for (const sessions of Object.values(map)) {
      const { acwr } = computeEWMA(sessions);
      if (acwr != null && acwr > 1.3) count++;
    }
    setPerfAlertCount(count);
  };

  const checkPendingRPE = async (userId) => {
    // 3-day window: catches next-day logins after evening training
    const cutoff = new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString();

    // Only confirmed attendees (status 'in' or null = default accepted)
    const { data: participation } = await supabase
      .from('event_participants')
      .select('event_id')
      .eq('profile_id', userId)
      .or('status.eq.in,status.is.null');

    if (!participation || participation.length === 0) return;
    const eventIds = participation.map(p => p.event_id);

    // Ball-Practice and Games only
    const { data: events } = await supabase
      .from('events')
      .select('id, title, start_time, end_time, category')
      .in('id', eventIds)
      .in('category', ['Ball-Practice', 'Game'])
      .gte('start_time', cutoff)
      .lte('start_time', new Date().toISOString());

    if (!events || events.length === 0) return;

    // Only DB determines whether RPE was already submitted (no localStorage bypass).
    // Match by event_id + the event's current JST date so that a rescheduled event
    // (same event_id, different date) doesn't suppress the prompt for the new session.
    const { data: logged } = await supabase
      .from('session_rpe')
      .select('event_id, event_date')
      .eq('user_id', userId)
      .in('event_id', events.map(e => e.id));

    const loggedKeys = new Set(
      (logged ?? []).map(l => `${l.event_id}:${l.event_date}`)
    );
    const pending = events.filter(e => {
      const eventDate = toJstDateStr(new Date(e.start_time));
      return !loggedKeys.has(`${e.id}:${eventDate}`);
    });

    if (pending.length > 0) {
      setPendingRPEEvents(pending);
      setShowRPE(true);
    }
  };

  const checkPendingBodyWeight = async (userId) => {
    // Monday of current ISO week in JST — use Intl-safe string arithmetic
    const todayStr  = toJstDateStr(new Date()); // 'YYYY-MM-DD', always correct JST
    const todayUtc  = new Date(todayStr + 'T12:00:00Z'); // noon UTC, safe for day arithmetic
    const dow       = (todayUtc.getUTCDay() + 6) % 7;   // 0=Mon
    const weekStart = new Date(todayUtc.getTime() - dow * 86400000).toISOString().slice(0, 10);
    // Monday 00:00 JST = Monday date T15:00:00Z (UTC-9h)
    const mondayUtc = new Date(weekStart + 'T00:00:00Z').getTime() - 9 * 3600 * 1000;
    const mondayUtcStr = new Date(mondayUtc).toISOString();
    const nowUtc    = new Date().toISOString();

    // DB-only check — works across all devices
    const { data: existing } = await supabase
      .from('player_bodyweight')
      .select('id')
      .eq('user_id', userId)
      .eq('week_start', weekStart)
      .limit(1);
    if (existing?.length) return;

    // Only confirmed attendees of Weightlifting events this week
    const { data: participation } = await supabase
      .from('event_participants')
      .select('event_id')
      .eq('profile_id', userId)
      .or('status.eq.in,status.is.null');
    if (!participation?.length) return;

    const { data: events } = await supabase
      .from('events')
      .select('id')
      .in('id', participation.map(p => p.event_id))
      .eq('category', 'Weightlifting')
      .gte('start_time', mondayUtcStr)
      .lte('start_time', nowUtc);
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

    if (!prof?.first_name || !prof?.last_name || !prof?.date_of_birth || !prof?.display_name) {
      setShowProfileSetup(true);
      return;
    }

    if (checkWellness && prof?.role === 'Player') {
      const today = toJstDateStr(new Date());
      if (prof.last_wellness_date !== today) {
        // Fallback DB check: covers existing users (null last_wellness_date) and failed profile updates
        const { data: existing } = await supabase
          .from('wellness_responses')
          .select('id')
          .eq('user_id', userId)
          .eq('response_date', today)
          .limit(1);
        if (existing?.length) {
          // Already answered today — sync the profile date so future logins skip this query
          supabase.from('profiles').update({ last_wellness_date: today }).eq('id', userId).then();
        } else {
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
    const today = toJstDateStr(new Date());
    if (session?.user) {
      // Write to profile so all devices know wellness is done today
      supabase.from('profiles').update({ last_wellness_date: today }).eq('id', session.user.id).then();
      setProfile(prev => prev ? { ...prev, last_wellness_date: today } : prev);
    }
    setShowWellness(false);
    // After wellness, check for pending session RPE then body weight
    if (session?.user) {
      checkPendingRPE(session.user.id);
      checkPendingBodyWeight(session.user.id);
    }
  };

  const handleBodyWeightDone = () => {
    setShowBodyWeight(false);
  };

  useEffect(() => {
    if (!session?.user) { setProfile(null); return; }
    loadProfile(session.user.id);
  }, [session?.user?.id]);

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
  const isAdminUser    = profile?.is_admin === true;
  const isAdmin        = ['GM / Director', 'Headcoach', 'Organisation Staff'].includes(profile?.role) || isAdminUser;
  const isPlayer       = profile?.role === 'Player';
  const canWellness    = WELLNESS_VIEWERS.includes(profile?.role);
  const canNutrition   = isPlayer || canWellness;
  const canPerformance = PERFORMANCE_VIEWERS.includes(profile?.role);
  const canMedical     = MEDICAL_VIEWERS.includes(profile?.role);
  const canTactics     = TACTICS_VIEWERS.includes(profile?.role);

  const playersSubs = [
    ...(canWellness    ? [NAV_WELLNESS]    : []),
    ...(canNutrition   ? [NAV_NUTRITION]   : []),
    ...(canPerformance ? [NAV_PERFORMANCE] : []),
    ...(canMedical     ? [NAV_MEDICAL]     : []),
  ];

  const nav_items = [
    ...NAV_BASE,
    ...(canTactics           ? [NAV_TACTICS]  : []),
    ...(isPlayer             ? [NAV_MYSTATS]  : []),
    ...(playersSubs.length   ? [NAV_PLAYERS]  : []),
    ...(isAdmin              ? [NAV_ADMIN]    : []),
  ];

  return (
    <AppErrorBoundary>
    <ToastProvider>
    <div className={styles.app}>
      <header className={styles.header}>
        <div className={styles.logo}>
          <img src="/logo-white.png" alt="Tridents" className={styles.logoImg} />
          <div className={styles.logoTextBlock}>
            <span className={styles.logoName}>TeamBridge</span>
            <span className={styles.logoSub}>Shinshu Matsumoto Tridents</span>
          </div>
        </div>
        <div className={styles.headerRight}>
          <button className={styles.searchBtn} onClick={() => setShowSearch(true)} title="Search (Ctrl+K)">
            <IconSearch size={15} />
          </button>
          <button className={`${styles.langBtn} ${lang==='en'?styles.langActive:''}`} onClick={()=>{setLang('en');localStorage.setItem('tb_lang','en');}}>EN</button>
          <button className={`${styles.langBtn} ${lang==='ja'?styles.langActive:''}`} onClick={()=>{setLang('ja');localStorage.setItem('tb_lang','ja');}}>日本語</button>
          <NotificationBell userId={user.id} lang={lang} onNavigate={navigate} chatUnread={unreadChat} onUnreadChange={setTotalUnread} onSectionUnread={setSectionUnread} />
          <UserMenu user={user} profile={profile} lang={lang} onProfileUpdate={() => loadProfile(user.id, false)} />
        </div>
      </header>

      <div className={styles.body}>
        <aside className={styles.sidebar}>
          {nav_items.map(item => {
            const isCalGroup     = item.id === 'calendar';
            const isPlayersGroup = item.id === 'players';
            const calActive      = isCalGroup && (['calendar', ...NAV_CAL_SUBS.map(s => s.id)].includes(nav));
            const playersActive  = isPlayersGroup && PLAYERS_IDS.has(nav);
            const ItemIcon       = item.Icon;
            return (
              <div key={item.id}>
                <button
                  className={`${styles.navItem} ${(nav===item.id || (isCalGroup && calActive) || (isPlayersGroup && playersActive)) ? styles.navActive : ''}`}
                  onClick={() => {
                    if (isPlayersGroup) {
                      setPlayersGroupOpen(o => !o);
                      if (!PLAYERS_IDS.has(nav)) navigate(playersSubs[0]?.id);
                    } else {
                      navigate(item.id);
                      if (item.id === 'chat') setUnreadChat(0);
                      setSectionUnread(prev => ({ ...prev, [item.id]: 0 }));
                      if (isCalGroup) setCalGroupOpen(o => !o);
                    }
                  }}>
                  <span className={styles.navIcon}><ItemIcon size={18} /></span>
                  {item.label[lang]}
                  {isPlayersGroup && (perfAlertCount + nutritionBadge) > 0 && !playersActive && (
                    <span className={styles.navBadge}>{perfAlertCount + nutritionBadge}</span>
                  )}
                  {item.id === 'chat' && unreadChat > 0 && nav !== 'chat' && (
                    <span className={styles.navBadge}>{unreadChat > 99 ? '99+' : unreadChat}</span>
                  )}
                  {item.id !== 'chat' && item.id !== 'performance' && (sectionUnread[item.id] ?? 0) > 0 && nav !== item.id && (
                    <span className={styles.navBadge}>{sectionUnread[item.id] > 99 ? '99+' : sectionUnread[item.id]}</span>
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
                {isPlayersGroup && playersGroupOpen && playersSubs.map(sub => {
                  const SubIcon = sub.Icon;
                  return (
                    <button key={sub.id}
                      className={`${styles.navSubItem} ${nav===sub.id ? styles.navActive : ''}`}
                      onClick={() => navigate(sub.id)}>
                      <span className={styles.navIcon}><SubIcon size={16} /></span>
                      {sub.label[lang]}
                      {sub.id === 'performance' && perfAlertCount > 0 && (
                        <span className={styles.navBadge}>{perfAlertCount}</span>
                      )}
                      {sub.id === 'nutrition' && nutritionBadge > 0 && (
                        <span className={styles.navBadge}>{nutritionBadge}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
          <div className={styles.sidebarBrand}>
            <img src="/logo-white.png" alt="" className={styles.sidebarBrandMark} />
          </div>
        </aside>
        <main className={styles.main} ref={mainRef}>
          {/* Pull-to-refresh indicator */}
          {(pullDelta > 0 || refreshing) && (
            <div className={styles.pullIndicator} style={{ transform: `translateY(${refreshing ? 0 : pullDelta - 48}px)` }}>
              <div className={styles.pullSpinner} style={{ opacity: refreshing ? 1 : pullDelta / PULL_THRESHOLD }} />
            </div>
          )}
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
          {/* Mobile players sub-nav strip */}
          {PLAYERS_IDS.has(nav) && playersSubs.length > 1 && (
            <nav className={styles.calSubNav}>
              {playersSubs.map(sub => {
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
          {nav==='dashboard' && <Dashboard lang={lang} profile={profile} currentUserId={user.id} currentUserName={displayName} currentUserInitials={initials} onNavigate={navigate} onOpenWellness={profile?.role === 'Player' ? () => setShowWellness(true) : undefined} onProfileUpdate={() => loadProfile(user.id, false)} />}
          {nav==='calendar'  && <Calendar          lang={lang} currentUserName={displayName} role={profile?.role} currentUserId={user.id} />}
          {nav==='chat'      && <Chat              uiLang={lang} currentUser={{ name: displayName, initials, id: user.id, avatarUrl: profile?.avatar_url }} profile={profile} />}
          {nav==='tasks'     && <Tasks             lang={lang} profile={profile} />}
          {nav==='tactics'   && canTactics && <Tactics           lang={lang} profile={profile} />}
          {nav==='feed'      && <Announcements     lang={lang} currentUserName={user.email} />}
          {nav==='travel'    && <Travel            lang={lang} profile={profile} currentUserName={displayName} />}
          {nav==='mystats'   && isPlayer         && <PlayerStats lang={lang} profile={profile} onEditWellness={() => setShowWellness(true)} />}
          {nav==='wellness'     && canWellness    && <WellnessDashboard    lang={lang} profile={profile} />}
          {nav==='nutrition'    && canNutrition   && <NutritionDashboard   lang={lang} profile={profile} onBadgeCount={setNutritionBadge} />}
          {nav==='performance'  && canPerformance && <PerformanceDashboard lang={lang} profile={profile} />}
          {nav==='medical'      && canMedical     && <MedicalDashboard     lang={lang} profile={profile} currentUserName={displayName} />}
          {nav==='admin'        && isAdmin        && <RoleManager          lang={lang} currentUserId={user.id} currentUserRole={profile?.role} isSuperAdmin={profile?.is_super_admin === true} isAdminUser={isAdminUser} />}
        </main>
      </div>

      {/* Mobile bottom navigation */}
      <nav className={styles.mobileNav}>
        {nav_items.map(item => {
          const MIcon = item.Icon;
          return (
          <button key={item.id}
            className={`${styles.mobileNavItem} ${nav===item.id || (item.id==='players' && PLAYERS_IDS.has(nav)) ? styles.mobileNavActive : ''}`}
            onClick={() => {
              if (item.id === 'players') {
                if (!PLAYERS_IDS.has(nav)) {
                  navigate(playersSubs[0]?.id);
                } else {
                  const idx = playersSubs.findIndex(s => s.id === nav);
                  navigate(playersSubs[(idx + 1) % playersSubs.length]?.id);
                }
              } else {
                navigate(item.id);
                if (item.id === 'chat') setUnreadChat(0);
                setSectionUnread(prev => ({ ...prev, [item.id]: 0 }));
              }
            }}>
            <span className={styles.mobileNavIconWrap}>
              <MIcon size={26} />
              {item.id === 'performance' && perfAlertCount > 0 && (
                <span className={styles.mobileNavBadge}>{perfAlertCount}</span>
              )}
              {item.id === 'chat' && unreadChat > 0 && nav !== 'chat' && (
                <span className={styles.mobileNavBadge}>{unreadChat > 99 ? '99+' : unreadChat}</span>
              )}
              {item.id !== 'chat' && item.id !== 'performance' && (sectionUnread[item.id] ?? 0) > 0 && nav !== item.id && (
                <span className={styles.mobileNavBadge}>{sectionUnread[item.id] > 99 ? '99+' : sectionUnread[item.id]}</span>
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
      {showIdleWarning && (
        <div className={styles.idleOverlay}>
          <div className={styles.idleBox}>
            <div className={styles.idleIcon}>⏱</div>
            <div className={styles.idleTitle}>
              {lang === 'ja' ? 'まだいますか？' : 'Still there?'}
            </div>
            <div className={styles.idleMsg}>
              {lang === 'ja'
                ? `操作がないため、${idleCountdown}秒後に自動ログアウトします。`
                : `You'll be logged out in ${idleCountdown}s due to inactivity.`}
            </div>
            <button className={styles.idleStayBtn} onClick={resetIdleTimer}>
              {lang === 'ja' ? 'ログイン継続' : 'Stay logged in'}
            </button>
            <button className={styles.idleSignOutBtn} onClick={() => supabase.auth.signOut()}>
              {lang === 'ja' ? '今すぐログアウト' : 'Log out now'}
            </button>
          </div>
        </div>
      )}
    </div>
    </ToastProvider>
    </AppErrorBoundary>
  );
}
