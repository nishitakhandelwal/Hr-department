# 🚀 Quick Start - Smart Workforce Calendar

## ⚡ Get Running in 5 Minutes

### Step 1: Install Backend Dependencies
```bash
cd backend
npm install cron date-fns
```

### Step 2: Start Backend Server
```bash
npm run dev
# You should see: [Notification Scheduler] Started successfully
```

### Step 3: Start Frontend Dev Server
```bash
cd frontend
npm run dev
# Visit http://localhost:8080
```

### Step 4: Access Calendar
1. Login as admin
2. Go to `/admin/calendar`
3. See the calendar with holidays loaded!

---

## 🎯 Test the Features

### Test 1: View Holidays
- Open `/admin/calendar`
- Calendar should show Indian holidays (Republic Day, Independence Day, etc.)
- Hover over colored dots to see holiday names

### Test 2: Add an Event
- Click "Add Event" button
- Fill in: Title="Team Meeting", Date=tomorrow, Type="Meeting", Time="2:00 PM"
- Click "Create Event"
- See it appear on calendar

### Test 3: Filter Events
- Click event type badges (Holiday, Birthday, Meeting, Reminder)
- Click to toggle show/hide
- Only active types appear on calendar

### Test 4: View Upcoming Alerts
- Scroll down to "Upcoming Alerts" panel
- See next 14 days of events
- Should show holidays and your created event

### Test 5: Notifications
- Scheduler runs at 8:00 AM UTC daily
- To test manually:
  ```bash
  # In backend console, trigger notifications:
  # Open backend/src/services/notificationScheduler.js
  # Uncomment line: processEventNotifications();
  # At the bottom of startNotificationScheduler function
  ```

---

## 🗂️ File Changes Summary

### New Files Created
```
backend/
  ✨ src/models/Holiday.js
  ✨ src/controllers/holidayController.js
  ✨ src/routes/holidayRoutes.js
  ✨ src/services/holidayService.js
  ✨ src/services/notificationScheduler.js

frontend/
  ✨ src/pages/admin/AdminCalendar.tsx
  ✨ src/components/calendar/CalendarFilters.tsx
  ✨ src/components/calendar/UpcomingAlertsPanel.tsx
```

### Modified Files
```
backend/
  📝 package.json (added cron, date-fns)
  📝 src/app.js (added holiday routes)
  📝 src/server.js (added scheduler startup)

frontend/
  📝 src/App.tsx (added calendar route)
  📝 src/services/api.ts (added holiday methods + HolidayItem type)
```

---

## 📡 API Endpoints to Test

### Get Holidays
```bash
curl http://localhost:5000/api/holidays?country=IN&year=2024
```

### Sync Holidays from API
```bash
curl -X POST http://localhost:5000/api/holidays/sync \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"country":"IN"}'
```

### Get Events
```bash
curl http://localhost:5000/api/events?month=3&year=2024 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Get Upcoming Holidays
```bash
curl http://localhost:5000/api/holidays/upcoming?days=7 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 🎨 UI Overview

### Calendar Components

#### 1. Main Calendar Grid
- Shows all holidays and events
- Colored dots indicate event types
- Click date to select
- Hover for tooltip with details

#### 2. Event Filter Badges
- 4 clickable badges (Holiday, Birthday, Meeting, Reminder)
- Each color-coded
- Green = Active, Gray = Inactive
- Click to toggle visibility

#### 3. Selected Day Panel
- Shows all events for clicked date
- Add/Edit/Delete buttons for each event
- Count of events displayed

#### 4. Upcoming Alerts Panel
- 7-14 day preview
- Grouped by date
- "Today" and "Tomorrow" badges
- Event icons with details

---

## 🌍 Default Holidays Loaded

### India (IN)
- Republic Day (Jan 26)
- Independence Day (Aug 15)
- Gandhi Jayanti (Oct 2)
- Diwali, Holi, Eid, and more...

### United States (US)
- New Year's Day
- Independence Day (Jul 4)
- Thanksgiving
- Christmas

### United Kingdom (UK)
- Easter Monday
- Bank Holidays
- Christmas

---

## 🔄 How Notifications Work

### Daily Flow
1. **8:00 AM UTC** - Cron job triggers
2. **Check Tomorrow** - Find events for tomorrow
3. **Create Notifications** - Generate in-app messages
4. **Send Emails** - Email summary to users
5. **Log Success** - Record in server logs

### What Triggers Notifications
- ✅ **Holidays** - "Tomorrow is Republic Day 🇮🇳"
- ✅ **Birthdays** - "Tomorrow is John's birthday 🎂"
- ✅ **Meetings** - "Team Meeting at 2:00 PM"
- ✅ **Reminders** - "Don't forget your reminder!"

### Email Subject
`Tomorrow's Schedule - HR Harmony Hub`

---

## 🎯 Common Tasks

### Add Company-Wide Holiday
```bash
# Admin adds custom holiday
POST /api/holidays/custom
{
  "title": "Company Founder Day",
  "date": "2024-06-15",
  "country": "IN"
}
```

### Employee Creates Reminder
```bash
# Employee creates personal reminder
POST /api/events
{
  "title": "Team Standup",
  "date": "2024-03-20",
  "type": "reminder",
  "timeLabel": "10:00 AM"
}
```

### Admin Views All Events
```bash
# GET /events includes:
# - System holidays
# - Admin-created events
# - All employee reminders
```

---

## 🛠️ Configuration

### Change Notification Time
Edit `backend/src/services/notificationScheduler.js` line ~97:

```javascript
// Current: 8:00 AM UTC
scheduledJob = new CronJob(
  "0 8 * * *",  // Change here
  // ...
);
```

**Cron Format:** `minute hour * * day`
- `0 9 * * *` = 9:00 AM daily
- `0 9 * * 1-5` = 9:00 AM Mon-Fri only
- `30 14 * * *` = 2:30 PM daily

### Change Default Country
Edit `backend/src/services/holidayService.js` line ~10:

```javascript
// Current default: India
async getHolidaysByCountryAndYear(country = "IN", year = null) {
  // Change "IN" to "US" or "UK" or any supported country
}
```

---

## 🐛 Quick Fixes

### "Holidays Not Showing"
1. Check database: `db.holidays.find().count()`
2. Trigger sync: `POST /api/holidays/sync`
3. Check logs for errors

### "Notifications Not Sending"
1. Verify SMTP settings in `.env`
2. Check cron is running (look for scheduler logs)
3. Verify user email addresses in database

### "Events Not Loading"
1. Restart backend: `npm run dev`
2. Check network in DevTools
3. Verify authentication token

---

## 📱 Browser Support

- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+
- ✅ Mobile browsers (iOS Safari, Chrome Android)

---

## 📊 What You Get

✨ A complete calendar system with:
- 🌍 Automatic holiday fetching
- 📅 Multi-type events support
- 🔔 Smart daily notifications
- 🎨 Beautiful modern UI
- 🔒 Role-based access
- 📱 Responsive design
- ⚡ High performance
- 🧪 Production-ready code

---

## 🎓 Learning Path

1. **Basics**: Read CALENDAR_SETUP.md
2. **Frontend**: Explore AdminCalendar.tsx
3. **Backend**: Check holidayService.js
4. **Database**: Run `db.holidays.find()` in MongoDB
5. **Notifications**: Read notificationScheduler.js

---

## 🎉 You're All Set!

Your Smart Workforce Calendar is now live!

### Next Steps:
1. ✅ Test all features
2. 📧 Configure email notifications
3. 🌍 Add your country holidays
4. 👥 Create team events
5. 🎊 Invite your team!

**Questions?** Check CALENDAR_SETUP.md or review component comments.

---

**Version:** 1.0.0  
**Updated:** March 30, 2026
