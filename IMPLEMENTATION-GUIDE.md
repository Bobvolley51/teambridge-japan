# Teambridge Japan - Implementation Roadmap

Complete feature implementation guide with SQL queries, API routes, and component code.

---

## Quick Start (5 minutes)

```powershell
# 1. Create checkpoint
.\session-manager.ps1 -Action checkpoint -SessionName "work-session"

# 2. Check database
.\db-automation.ps1 -Action status

# 3. Start dev server
npm run dev

# 4. Open browser
# http://localhost:3000
```

---

## Database Implementation

### Step 1: Run Master Migration

Execute in Supabase Dashboard → SQL Editor:
- Copy entire contents of `schema_master_migration.sql`
- Click "Run"
- All tables created in correct order

### Step 2: Verify Database

```powershell
.\db-automation.ps1 -Action list-tables
```

### Step 3: Test Connection

```powershell
.\db-automation.ps1 -Action test-connection
```

---

## Feature Implementation Guide

### 1. Chat/Messaging

**Database**: `messages` table exists
**Component**: `components/Chat.jsx`
**API**: `app/api/chat/route.js`

#### Real-time Chat Example

```javascript
// components/Chat.jsx
import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function Chat() {
  const [messages, setMessages] = useState([]);
  const [channel, setChannel] = useState('general');

  useEffect(() => {
    // Load initial messages
    const loadMessages = async () => {
      const { data } = await supabase
        .from('messages')
        .select('*')
        .eq('channel', channel)
        .order('created_at', { ascending: true });
      setMessages(data || []);
    };

    loadMessages();

    // Subscribe to real-time updates
    const subscription = supabase
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          if (payload.new.channel === channel) {
            setMessages(prev => [...prev, payload.new]);
          }
        }
      )
      .subscribe();

    return () => subscription.unsubscribe();
  }, [channel]);

  const sendMessage = async (content) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from('profiles')
      .select('display_name')
      .eq('id', user.id)
      .single();

    await supabase
      .from('messages')
      .insert([{
        channel,
        user_name: profile?.display_name || 'Anonymous',
        user_initials: profile?.display_name?.substring(0,2) || 'AN',
        content
      }]);
  };

  return (
    <div>
      <select onChange={(e) => setChannel(e.target.value)} value={channel}>
        <option value="general">General</option>
        <option value="tactics">Tactics</option>
        <option value="wellness">Wellness</option>
      </select>
      
      <div>
        {messages.map(msg => (
          <div key={msg.id}>
            <strong>{msg.user_name}</strong>: {msg.content}
          </div>
        ))}
      </div>

      <input 
        type="text"
        placeholder="Send message..."
        onKeyPress={(e) => {
          if (e.key === 'Enter') {
            sendMessage(e.target.value);
            e.target.value = '';
          }
        }}
      />
    </div>
  );
}
```

### 2. Event Calendar

**Database**: `events`, `event_participants` tables
**Component**: `components/Calendar.jsx`
**API**: `app/api/calendar/route.js`

#### Event Management Example

```javascript
// Create event
const createEvent = async (title, startTime, endTime, teamId) => {
  const { data, error } = await supabase
    .from('events')
    .insert([{
      team_id: teamId,
      title,
      start_time: startTime,
      end_time: endTime
    }]);
  return data;
};

// Get team events
const getTeamEvents = async (teamId) => {
  const { data } = await supabase
    .from('events')
    .select(`
      *,
      event_participants (
        id,
        user_id,
        status
      )
    `)
    .eq('team_id', teamId)
    .order('start_time', { ascending: true });
  return data;
};

// RSVP to event
const rsvpEvent = async (eventId, userId, status) => {
  const { data } = await supabase
    .from('event_participants')
    .upsert({
      event_id: eventId,
      user_id: userId,
      status
    });
  return data;
};
```

### 3. Wellness Tracking

**Database**: `wellness_check`, `session_rpe` tables
**Component**: `components/WellnessDashboard.jsx`

#### Wellness Data Example

```javascript
// Log wellness check-in
const logWellness = async (userId, mood, sleepHours, notes) => {
  const { data } = await supabase
    .from('wellness_check')
    .insert([{
      user_id: userId,
      date: new Date().toISOString().split('T')[0],
      mood,
      sleep_hours: sleepHours,
      injury_notes: notes
    }]);
  return data;
};

// Get wellness dashboard
const getWellnessTrend = async (userId, days = 30) => {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const { data } = await supabase
    .from('wellness_check')
    .select('*')
    .eq('user_id', userId)
    .gte('date', startDate.toISOString().split('T')[0])
    .order('date', { ascending: true });
  
  return {
    avgMood: data.reduce((sum, d) => sum + (d.mood || 0), 0) / data.length,
    avgSleep: data.reduce((sum, d) => sum + (d.sleep_hours || 0), 0) / data.length,
    data
  };
};

// Log session performance
const logSessionRPE = async (eventId, userId, rpeScore, notes) => {
  const { data } = await supabase
    .from('session_rpe')
    .insert([{
      event_id: eventId,
      user_id: userId,
      rpe_score: rpeScore,
      notes
    }]);
  return data;
};
```

### 4. Task Management

**Database**: `tasks` table
**Component**: `components/Tasks.jsx`

#### Kanban Board Example

```javascript
// Get all tasks
const getTasks = async () => {
  const { data } = await supabase
    .from('tasks')
    .select('*')
    .order('created_at', { ascending: false });
  return data;
};

// Create task
const createTask = async (title, assignee, priority) => {
  const { data } = await supabase
    .from('tasks')
    .insert([{
      title,
      assignee,
      priority,
      status: 'todo'
    }]);
  return data;
};

// Update task status
const updateTaskStatus = async (taskId, newStatus) => {
  const { data } = await supabase
    .from('tasks')
    .update({ status: newStatus })
    .eq('id', taskId);
  return data;
};

// Group tasks by status for Kanban
const getGroupedTasks = async () => {
  const tasks = await getTasks();
  return {
    todo: tasks.filter(t => t.status === 'todo'),
    inProgress: tasks.filter(t => t.status === 'in-progress'),
    done: tasks.filter(t => t.status === 'done')
  };
};
```

### 5. Team Management

**Database**: `teams`, `channels`, `profiles` tables

#### Team Operations Example

```javascript
// Create team
const createTeam = async (name, description, ownerId) => {
  const { data, error } = await supabase
    .from('teams')
    .insert([{
      name,
      description,
      owner_id: ownerId
    }]);
  return data;
};

// Add team member
const addTeamMember = async (teamId, userId) => {
  // Could use a junction table for better scalability
  // For now, just add to team_members array in teams table
};

// Get team with members
const getTeamDetails = async (teamId) => {
  const { data } = await supabase
    .from('teams')
    .select(`
      *,
      channels (id, name),
      owner:profiles!teams_owner_id_fkey (display_name, email)
    `)
    .eq('id', teamId)
    .single();
  return data;
};

// Create team channel
const createChannel = async (teamId, name, description) => {
  const { data } = await supabase
    .from('channels')
    .insert([{
      team_id: teamId,
      name,
      description
    }]);
  return data;
};
```

### 6. Tactics & Strategy

**Database**: `tactics` table

#### Tactics Management Example

```javascript
// Create tactic/formation
const createTactic = async (teamId, name, positions) => {
  const { data } = await supabase
    .from('tactics')
    .insert([{
      team_id: teamId,
      name,
      description: `Team formation: ${name}`,
      positions // Store as JSONB
    }]);
  return data;
};

// Example positions structure:
const volleyballFormation = {
  setter: ['Player1', 'Player2'],
  middle: ['Player3', 'Player4'],
  opposite: ['Player5'],
  libero: ['Player6']
};

// Get team tactics
const getTeamTactics = async (teamId) => {
  const { data } = await supabase
    .from('tactics')
    .select('*')
    .eq('team_id', teamId);
  return data;
};
```

### 7. Notifications

**Database**: `notifications` table

#### Notification System Example

```javascript
// Send notification to user
const createNotification = async (userId, type, title, content) => {
  const { data } = await supabase
    .from('notifications')
    .insert([{
      user_id: userId,
      type, // 'message', 'event', 'task', 'announcement'
      title,
      content,
      read: false
    }]);
  return data;
};

// Notify event attendees
const notifyEventAttendees = async (eventId, title, message) => {
  const { data: participants } = await supabase
    .from('event_participants')
    .select('user_id')
    .eq('event_id', eventId);

  if (participants) {
    const notifications = participants.map(p => ({
      user_id: p.user_id,
      type: 'event',
      title,
      content: message,
      read: false
    }));

    await supabase
      .from('notifications')
      .insert(notifications);
  }
};

// Get user notifications
const getUserNotifications = async (userId) => {
  const { data } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  return data;
};

// Mark as read
const markNotificationRead = async (notificationId) => {
  const { data } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('id', notificationId);
  return data;
};
```

### 8. Avatar Management

**Storage**: `storage.avatars` bucket

#### Avatar Upload Example

```javascript
// Upload avatar
const uploadAvatar = async (userId, file) => {
  try {
    // Upload to storage
    const filename = `${userId}.jpg`;
    const { data, error } = await supabase.storage
      .from('avatars')
      .upload(filename, file, { upsert: true });

    if (error) throw error;

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('avatars')
      .getPublicUrl(filename);

    // Update profile
    await supabase
      .from('profiles')
      .update({ avatar_url: publicUrl })
      .eq('id', userId);

    return publicUrl;
  } catch (error) {
    console.error('Avatar upload failed:', error);
    return null;
  }
};

// Display avatar
export const AvatarImage = ({ userId, displayName }) => {
  const [avatar, setAvatar] = useState(null);

  useEffect(() => {
    const getAvatar = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('avatar_url')
        .eq('id', userId)
        .single();

      if (data?.avatar_url) {
        setAvatar(data.avatar_url);
      }
    };

    getAvatar();
  }, [userId]);

  return avatar ? (
    <img src={avatar} alt={displayName} />
  ) : (
    <div className="avatar-placeholder">{displayName.substring(0,2)}</div>
  );
};
```

### 9. Account Management

**Database**: `account_requests` table

#### Account Requests Example

```javascript
// Request account access
const requestAccountAccess = async (email, teamId) => {
  const { data } = await supabase
    .from('account_requests')
    .insert([{
      email,
      team_id: teamId,
      status: 'pending'
    }]);
  return data;
};

// Get pending requests (for admin)
const getPendingRequests = async () => {
  const { data } = await supabase
    .from('account_requests')
    .select(`
      *,
      team:teams(name)
    `)
    .eq('status', 'pending');
  return data;
};

// Approve request
const approveRequest = async (requestId, userId) => {
  const { data: request } = await supabase
    .from('account_requests')
    .select('*')
    .eq('id', requestId)
    .single();

  // Send invitation email
  await fetch('/api/invite/', {
    method: 'POST',
    body: JSON.stringify({
      email: request.email,
      team_id: request.team_id
    })
  });

  // Mark as approved
  await supabase
    .from('account_requests')
    .update({ status: 'approved' })
    .eq('id', requestId);
};
```

### 10. Privacy & Settings

**Database**: `privacy_settings` table

#### Privacy Controls Example

```javascript
// Get user privacy settings
const getPrivacySettings = async (userId) => {
  const { data } = await supabase
    .from('privacy_settings')
    .select('*')
    .eq('user_id', userId)
    .single();
  
  return data || {
    show_stats: true,
    show_email: false
  };
};

// Update privacy settings
const updatePrivacySettings = async (userId, settings) => {
  const { data } = await supabase
    .from('privacy_settings')
    .upsert({
      user_id: userId,
      ...settings
    });
  return data;
};

// Check if data visible to user
const isDataVisible = async (dataOwnerId, viewerId) => {
  if (dataOwnerId === viewerId) return true; // Users see own data

  const { data } = await supabase
    .from('privacy_settings')
    .select('show_stats')
    .eq('user_id', dataOwnerId)
    .single();

  return data?.show_stats || false;
};
```

---

## API Route Templates

### Template: GET Request

```javascript
// app/api/feature/route.js
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function GET(request) {
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data, error } = await supabase
      .from('table_name')
      .select('*')
      .eq('user_id', user.id);

    if (error) throw error;

    return Response.json({ success: true, data });
  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
```

### Template: POST Request

```javascript
export async function POST(request) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    const { data, error } = await supabase
      .from('table_name')
      .insert([{
        user_id: user.id,
        ...body
      }]);

    if (error) throw error;

    return Response.json({ success: true, data });
  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
```

---

## Testing Features

### Test in Browser Console

```javascript
// Test Supabase connection
const { createClient } = window.supabase;
const supabase = createClient(
  'https://vlzxpbndvvzktuccavfg.supabase.co',
  'sb_publishable_yKFS46jOE0qjghWoQ7XBcg_z6mTHt3p'
);

// Get current user
const { data: { user } } = await supabase.auth.getUser();
console.log('Current user:', user);

// Fetch messages
const { data: messages } = await supabase
  .from('messages')
  .select('*')
  .limit(10);
console.log('Recent messages:', messages);

// Subscribe to changes
const subscription = supabase
  .on('postgres_changes',
    { event: '*', schema: 'public', table: 'messages' },
    (payload) => console.log('Change:', payload)
  )
  .subscribe();
```

---

## Deployment Checklist

- [ ] Database migration completed
- [ ] All environment variables set in `.env.local`
- [ ] Components tested locally (`npm run dev`)
- [ ] Build succeeds (`npm run build`)
- [ ] No console errors in browser
- [ ] Supabase RLS policies verified
- [ ] Avatar upload works
- [ ] Real-time subscriptions tested
- [ ] API endpoints tested
- [ ] Deployed to Vercel (`vercel deploy --prod`)

---

## Performance Tips

1. **Use indexes** - Already created in migration
2. **Enable RLS** - Restricts unauthorized access
3. **Lazy load components** - Use dynamic imports
4. **Cache data** - Use React Query or SWR
5. **Optimize images** - Use Next.js Image component
6. **Monitor database** - Check Supabase logs

---

## Security Reminders

✓ Never expose service role key in client code
✓ Always validate inputs on backend
✓ Use RLS policies for data access
✓ Keep `.env.local` in `.gitignore`
✓ Use HTTPS for all connections
✓ Validate user ownership before updates
✓ Rate limit API endpoints
✓ Hash sensitive data

---

## Resources

- [Supabase Real-time](https://supabase.com/docs/guides/realtime)
- [Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)
- [Storage Buckets](https://supabase.com/docs/guides/storage)
- [Next.js API Routes](https://nextjs.org/docs/app/building-your-application/routing/route-handlers)
- [PostgreSQL Docs](https://www.postgresql.org/docs/)

---

**Ready to build! Execute schema_master_migration.sql in Supabase and start implementing features.** 🚀
