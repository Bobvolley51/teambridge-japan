# Teambridge Japan - Complete Development Guide

## Project Overview

**Teambridge Japan** is a comprehensive team management platform for volleyball teams built with:
- **Frontend**: Next.js 16, React 19, Tailwind CSS
- **Backend**: Next.js API routes, Supabase
- **Database**: PostgreSQL (Supabase)
- **Features**: Chat, Tasks, Events, Wellness, Performance, Travel, Tactics

---

## 1. Database Setup

### Option A: Run Master Migration (Recommended)

Execute this in Supabase Dashboard → SQL Editor:

```
1. Go to: https://vlzxpbndvvzktuccavfg.supabase.co/
2. Navigate to: SQL Editor → New Query
3. Copy entire contents of: schema_master_migration.sql
4. Click "Run" button
5. All tables, RLS, and indexes created
```

### Option B: Run Individual Schemas

If you prefer incremental setup:
```powershell
# Copy each schema file into Supabase SQL Editor in order:
1. schema.sql                              # Core tables
2. schema_profiles.sql                     # Users & profiles
3. schema_channels.sql                     # Team channels
4. schema_events.sql                       # Events & scheduling
5. schema_events_category.sql              # Event categories
6. schema_events_participants_recurrence.sql # Recurrence rules
7. schema_notifications.sql                # Notifications
8. schema_wellness.sql                     # Wellness tracking
9. schema_session_rpe.sql                  # Performance metrics
10. schema_tactics.sql                     # Team tactics
11. schema_travel_items_type.sql           # Travel tracking
12. schema_account_requests_v2.sql         # Account management
13. schema_privacy.sql                     # Privacy settings
14. schema_avatars_storage.sql             # Avatar storage & RLS
```

---

## 2. Database Schema Overview

### Core Tables

**messages** - Real-time chat
```
- id (UUID)
- channel (TEXT) - 'general', etc
- user_name (TEXT)
- user_initials (TEXT)
- content (TEXT)
- created_at (TIMESTAMPTZ)
```

**profiles** - User accounts
```
- id (UUID) - refs auth.users
- email (TEXT)
- display_name (TEXT)
- avatar_url (TEXT)
- role (TEXT) - Player, Coach, Manager
- created_at (TIMESTAMPTZ)
```

**teams** - Volleyball teams
```
- id (UUID)
- name (TEXT)
- description (TEXT)
- owner_id (UUID) - refs profiles
- created_at (TIMESTAMPTZ)
```

**events** - Matches, practices, meetings
```
- id (UUID)
- team_id (UUID) - refs teams
- title (TEXT)
- description (TEXT)
- start_time (TIMESTAMPTZ)
- end_time (TIMESTAMPTZ)
- location (TEXT)
```

**event_participants** - Attendance tracking
```
- id (UUID)
- event_id (UUID) - refs events
- user_id (UUID) - refs profiles
- status (TEXT) - invited, accepted, declined, maybe
```

**notifications** - User alerts
```
- id (UUID)
- user_id (UUID) - refs profiles
- type (TEXT) - message, event, task, announcement
- title (TEXT)
- content (TEXT)
- read (BOOLEAN)
```

**wellness_check** - Health & fitness data
```
- id (UUID)
- user_id (UUID) - refs profiles
- date (DATE)
- mood (INTEGER) - 1-5
- sleep_hours (DECIMAL)
- injury_notes (TEXT)
```

**session_rpe** - Workout performance data
```
- id (UUID)
- event_id (UUID) - refs events
- user_id (UUID) - refs profiles
- rpe_score (INTEGER) - Rate of Perceived Exertion (1-10)
- notes (TEXT)
```

**tactics** - Team strategies
```
- id (UUID)
- team_id (UUID) - refs teams
- name (TEXT)
- description (TEXT)
- positions (JSONB) - {setter: [...], middle: [...]}
```

---

## 3. API Endpoints

### Current Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/` | GET | API health check |
| `/api/chat/` | GET/POST | Send/receive chat messages |
| `/api/calendar/` | GET/POST | Event scheduling |
| `/api/delete-user/` | POST | Account deletion |
| `/api/invite/` | POST | Send team invites |
| `/api/lookup-username/` | GET | Find users |
| `/api/notify-email/` | POST | Send email notifications |
| `/api/request-account/` | POST | Request team access |
| `/api/translate/` | POST | DeepL translation API |

### Creating New Endpoints

**Template: `/app/api/feature/route.js`**

```javascript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function GET(request) {
  try {
    // Your code here
    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    // Your code here
    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
```

---

## 4. Component Structure

### Main Components

| Component | Purpose |
|-----------|---------|
| `AIAssistant` | Claude AI integration |
| `Announcements` | News feed |
| `Calendar` | Event scheduling |
| `Chat` | Real-time messaging |
| `Dashboard` | Main overview |
| `Login` | Authentication |
| `NotificationBell` | Alert center |
| `PerformanceDashboard` | Stats & metrics |
| `PrivacyNotice` | Privacy policy |
| `RoleManager` | Permission control |
| `SessionRPE` | Workout tracking |
| `Tactics` | Strategy planning |
| `Tasks` | Kanban board |
| `Travel` | Trip planning |
| `UserMenu` | Profile menu |
| `Wellness` | Health tracking |
| `WellnessDashboard` | Health metrics |

### Adding New Components

**Template: `/components/Feature/index.jsx`**

```jsx
import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import styles from './index.module.css';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function Feature() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const { data: result, error } = await supabase
        .from('table_name')
        .select('*');
      
      if (error) console.error(error);
      else setData(result);
      
      setLoading(false);
    };

    fetchData();
  }, []);

  if (loading) return <div>Loading...</div>;

  return (
    <div className={styles.container}>
      {/* Component content */}
    </div>
  );
}
```

---

## 5. Development Features Checklist

### Phase 1: Core Features ✓
- [x] User authentication (Supabase Auth)
- [x] Team management
- [x] Chat/messaging
- [x] Task/Kanban board
- [x] Event calendar

### Phase 2: Wellness Features
- [ ] Wellness check-in (mood, sleep, injuries)
- [ ] Health metrics dashboard
- [ ] Performance tracking (RPE scores)
- [ ] Injury management
- [ ] Sleep analytics

### Phase 3: Tactical Features
- [ ] Tactics/strategy editor
- [ ] Formation builder
- [ ] Video annotation
- [ ] Play library

### Phase 4: Travel & Logistics
- [ ] Travel plans
- [ ] Accommodation finder
- [ ] Cost splitting
- [ ] Document tracker (passports, visas)

### Phase 5: Analytics & Reports
- [ ] Team statistics
- [ ] Individual performance
- [ ] Attendance tracking
- [ ] Export reports

### Phase 6: AI Features
- [ ] AI coaching assistant
- [ ] Smart recommendations
- [ ] Game analysis
- [ ] Translation support

---

## 6. Common Development Tasks

### Read Data from Database

```javascript
// In a component or API route
const { data, error } = await supabase
  .from('table_name')
  .select('*')
  .eq('user_id', userId);
```

### Write Data to Database

```javascript
const { data, error } = await supabase
  .from('table_name')
  .insert([{ column: value, ... }]);
```

### Update Data

```javascript
const { data, error } = await supabase
  .from('table_name')
  .update({ column: newValue })
  .eq('id', recordId);
```

### Subscribe to Real-time Changes

```javascript
const subscription = supabase
  .on('postgres_changes', 
    { event: '*', schema: 'public', table: 'messages' },
    (payload) => {
      console.log('Change received!', payload);
      setMessages(prev => [...prev, payload.new]);
    }
  )
  .subscribe();

// Cleanup
subscription.unsubscribe();
```

### File Upload (Avatars)

```javascript
const { data, error } = await supabase.storage
  .from('avatars')
  .upload(`${userId}.jpg`, file, { upsert: true });

if (error) console.error(error);
else {
  const publicUrl = supabase.storage
    .from('avatars')
    .getPublicUrl(data.path).data.publicUrl;
  
  await supabase
    .from('profiles')
    .update({ avatar_url: publicUrl })
    .eq('id', userId);
}
```

---

## 7. Authentication Flow

### Login/Signup

```javascript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Sign up
const { data, error } = await supabase.auth.signUp({
  email: 'user@example.com',
  password: 'SecurePassword123',
});

// Sign in
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'SecurePassword123',
});

// Sign out
await supabase.auth.signOut();

// Get current user
const { data: { user } } = await supabase.auth.getUser();
```

### Protect API Routes

```javascript
export async function GET(request) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const { data: { user }, error } = await supabase.auth.getUser();
  
  if (error || !user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // User is authenticated, proceed
}
```

---

## 8. Environment Variables

Required in `.env.local`:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://vlzxpbndvvzktuccavfg.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
SUPABASE_ACCESS_TOKEN=sbp_...

# External APIs
ANTHROPIC_API_KEY=sk-ant-...
DEEPL_API_KEY=...

# Email (Nodemailer)
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
```

---

## 9. Testing & Deployment

### Local Development

```powershell
# Start dev server
npm run dev

# Visit http://localhost:3000
```

### Build for Production

```powershell
# Build
npm run build

# Start production server
npm start

# Or use automation:
.\automate.ps1 -Task build
.\automate.ps1 -Task dev
```

### Deploy to Vercel

```bash
vercel deploy --prod
```

---

## 10. Troubleshooting

### Database Connection Issues

```javascript
// Test Supabase connection
const testConnection = async () => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('count(*)', { count: 'exact', head: true });
    
    if (error) throw error;
    console.log('✓ Connected to Supabase');
  } catch (error) {
    console.error('✗ Connection failed:', error);
  }
};
```

### RLS Policy Issues

If you get "row-level security violated":
1. Check that user is authenticated
2. Verify RLS policies allow the operation
3. Ensure user_id matches the policy condition
4. Test with service role key if needed

### Real-time Not Working

```javascript
// Ensure table is published to realtime
// In Supabase SQL Editor:
ALTER PUBLICATION supabase_realtime ADD TABLE messages;

// Or recreate subscription
subscription.unsubscribe();
subscription = supabase.on(...).subscribe();
```

---

## 11. Resources

### Documentation
- [Next.js Docs](https://nextjs.org/docs)
- [Supabase Docs](https://supabase.com/docs)
- [React Docs](https://react.dev)
- [Tailwind CSS](https://tailwindcss.com/docs)

### Useful Commands

```powershell
# Automation
.\automate.ps1 -Task setup       # Setup environment
.\automate.ps1 -Task dev         # Start dev server
.\automate.ps1 -Task build       # Build for production
.\automate.ps1 -Task clean       # Clean artifacts

# Session management
.\session-manager.ps1 -Action checkpoint -SessionName "feature-xyz"
.\session-manager.ps1 -Action list
.\session-manager.ps1 -Action resume -SessionName "checkpoint_name"
```

---

## 12. Next Steps

1. **Run database migration**
   ```
   Copy schema_master_migration.sql into Supabase SQL Editor and run
   ```

2. **Start development server**
   ```powershell
   npm run dev
   ```

3. **Add features**
   - Create new components in `/components/`
   - Create API routes in `/app/api/`
   - Query data from Supabase

4. **Test and iterate**
   - Use browser dev tools
   - Check Supabase logs
   - Monitor real-time subscriptions

5. **Deploy**
   - Test on Vercel preview
   - Deploy to production: `vercel deploy --prod`

---

**Happy Coding! 🚀**
