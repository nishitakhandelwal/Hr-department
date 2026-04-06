# Smart Workforce Calendar System - Implementation Guide

## 📋 Overview

The Smart Workforce Calendar system is a fully-integrated HR calendar solution with:
- **Public Holiday Integration** - Auto-fetched from Nager.Date API
- **Multi-Event Support** - Holidays, Birthdays, Meetings, Reminders
- **Smart Notifications** - Daily scheduled cron jobs with email/in-app notifications
- **Beautiful UI** - Modern glassmorphism design with smooth animations
- **Advanced Filtering** - Toggle event types visibility
- **Upcoming Alerts** - 7-14 day event preview panel

---

## 🏗️ Architecture

### Backend Stack
- **Node.js/Express** - REST API
- **MongoDB** - Data persistence
- **Cron** - Scheduled notification jobs
- **Nager.Date API** - Holiday data source
- **Nodemailer** - Email notifications

### Frontend Stack
- **React 18** - UI framework
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **Framer Motion** - Animations
- **date-fns** - Date utilities
- **React Query/Axios** - API communication

---

## 📦 Installed Dependencies

### Backend (`backend/package.json`)
```json
{
  "cron": "^3.1.7",           // Scheduled jobs
  "date-fns": "^3.6.0",       // Date manipulation
  "axios": "^1.13.5",         // API calls (already installed)
  "nodemailer": "^6.9.15"     // Email (already installed)
}
```

**Install dependencies:**
```bash
cd backend
npm install
```

### Frontend (Already has required dependencies)
- `framer-motion`, `date-fns`, `axios`, `react-query` - All present

---

## 🗄️ Database Models

### 1. Holiday Model (`backend/src/models/Holiday.js`)
```javascript
{
  title: String,              // e.g., "Republic Day"
  date: Date,                // Holiday date
  country: String,           // ISO code (IN, US, UK)
  type: String,              // "public" | "optional" | "bank"
  isCustom: Boolean,         // true if manually added
  source: String,            // "system" | "api" | "manual"
  externalId: String         // API reference ID
}
```

### 2. Event Model (`backend/src/models/Event.js`) - Already Exists
```javascript
{
  title: String,
  date: Date,
  type: "holiday" | "birthday" | "meeting" | "reminder",
  userId: ObjectId,          // For personal reminders
  createdBy: ObjectId,       // Admin who created it
  timeLabel: String,         // e.g., "2:00 PM"
  details: String            // Description
}
```

### 3. Notification Model (`backend/src/models/Notification.js`) - Already Exists
```javascript
{
  userId: ObjectId,
  title: String,
  message: String,
  type: String,              // "holiday" | "event" | ...
  read: Boolean
}
```

---

## 🔌 API Endpoints

### Holiday Endpoints

#### GET `/api/holidays`
Fetch holidays for a specific month/year
```bash
GET /api/holidays?country=IN&year=2024&month=3
Response: { success: true, data: HolidayItem[] }
```

#### GET `/api/holidays/upcoming`
Get holidays for next N days
```bash
GET /api/holidays/upcoming?days=7&country=IN
Response: { success: true, data: HolidayItem[] }
```

#### POST `/api/holidays/sync` (Admin Only)
Fetch and cache holidays from Nager.Date API
```bash
POST /api/holidays/sync
Body: { country: "IN", year: 2024 }
Response: { success: true, data: HolidayItem[] }
```

#### POST `/api/holidays/custom` (Admin Only)
Add custom holiday
```bash
POST /api/holidays/custom
Body: { title: "Diwali", date: "2024-11-02", country: "IN" }
Response: { success: true, data: HolidayItem }
```

#### DELETE `/api/holidays/custom/:id` (Admin Only)
Remove custom holiday
```bash
DELETE /api/holidays/custom/65abc123
Response: { success: true, data: null }
```

### Event Endpoints (Already Exist)

#### GET `/api/events`
Fetch events for month
```bash
GET /api/events?month=3&year=2024
```

#### POST `/api/events`
Create new event
```bash
POST /api/events
Body: { 
  title: "Team Meeting",
  date: "2024-03-15",
  type: "meeting",
  timeLabel: "2:00 PM",
  details: "Quarterly review"
}
```

#### PUT `/api/events/:id`
Update event

#### DELETE `/api/events/:id`
Delete event

### Notification Endpoints (Already Exist)

#### GET `/api/notifications`
List user notifications

#### PATCH `/api/notifications/:id/read`
Mark as read

#### DELETE `/api/notifications/:id`
Delete notification

---

## ⚙️ Backend Setup

### 1. Install Dependencies
```bash
cd backend
npm install cron date-fns
```

### 2. Environment Variables
Ensure `.env` has:
```env
# Existing variables
MONGODB_URI=mongodb://localhost:27017/hr_harmony_hub
JWT_SECRET=your_secret_key
SMTP_HOST=smtp.brevo.com
SMTP_PORT=587
SMTP_USER=your_brevo_email
SMTP_PASS=your_brevo_api_key

# New (optional)
NAGER_DATE_API=https://date.nager.at/api/v3
HOLIDAY_COUNTRY=IN
NOTIFICATION_TIME=08:00  # Daily at 8 AM UTC
```

### 3. Initialize Holiday Cache (On First Run)
The system automatically initializes default holidays when accessed. You can manually trigger:

```bash
# Via API
curl -X POST http://localhost:5000/api/holidays/sync \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"country":"IN"}'
```

---

## 🚀 Frontend Setup

### 1. Calendar Page Route
The calendar is accessible at `/admin/calendar`

### 2. Add Menu Item
Edit `layouts/AppLayout.tsx` or `components/Sidebar.tsx`:

```typescript
{
  label: 'Calendar',
  icon: <Calendar className="h-5 w-5" />,
  href: '/admin/calendar',
  requiredModule: 'dashboard' // or make it always visible
}
```

### 3. Components

#### Main Calendar Page
- **Location:** `frontend/src/pages/admin/AdminCalendar.tsx`
- **Features:** Filters, Calendar, Upcoming Alerts

#### EventCalendarCard Component
- **Location:** `frontend/src/components/calendar/EventCalendarCard.tsx`
- **Features:** Calendar grid, add/edit/delete events, selected day panel

#### CalendarFilters Component
- **Location:** `frontend/src/components/calendar/CalendarFilters.tsx`
- **Features:** Toggle event type visibility

#### UpcomingAlertsPanel Component
- **Location:** `frontend/src/components/calendar/UpcomingAlertsPanel.tsx`
- **Features:** 7-14 day upcoming events list

---

## 🔔 Notification System

### How It Works

1. **Scheduler Start** - Runs on server startup
```javascript
// backend/src/server.js
startNotificationScheduler();
```

2. **Daily Cron Job**
   - Runs at **8:00 AM UTC** every day
   - Checks for events happening tomorrow
   - Creates in-app notifications
   - Sends emails to users

3. **Notification Triggers**
   - **Holidays**: "Tomorrow is Republic Day 🇮🇳"
   - **Birthdays**: "Tomorrow is John's birthday 🎂"
   - **Meetings**: "Team Meeting at 2:00 PM"
   - **Reminders**: "Don't forget your reminder!"

### Example Log Output
```
[Notification Scheduler] Started successfully (runs daily at 8:00 AM UTC)
[Notification Scheduler] Running scheduled task at 2024-03-15T08:00:00Z
[Notification Scheduler] Processing event notifications for tomorrow...
[Notification Scheduler] Event notifications processed successfully
```

### Customize Notification Time
Edit `backend/src/services/notificationScheduler.js`:

```javascript
// Line ~97
scheduledJob = new CronJob(
  "0 8 * * *",  // Change to your preferred time
  // ... rest of code
);
```

Cron format: `minute hour * * day-of-week`
- `0 8 * * *` = 8:00 AM every day
- `0 9 * * 1-5` = 9:00 AM Monday-Friday

---

## 🎨 UI Features

### Event Type Colors & Icons
| Type | Color | Icon | Badge |
|------|-------|------|-------|
| Holiday | Emerald | 🇮🇳 | Green |
| Birthday | Violet | 🎂 | Purple |
| Meeting | Sky | 📅 | Blue |
| Reminder | Amber | ⏰ | Orange |

### Responsive Design
- **Desktop**: 2-column layout (Calendar + Sidebar)
- **Tablet**: Single column, stacked
- **Mobile**: Full-width, optimized touch targets

### Animations
- Smooth page transitions (Framer Motion)
- Hover effects on event cards
- Filter toggle animations
- Toast notifications

---

## 📝 Usage Guide

### For Admins

#### 1. View Calendar
Go to `/admin/calendar` to see all events

#### 2. Add Event
- Click "Add Event" button
- Fill form (Title, Date, Type, Time, Details)
- Click "Create Event"

#### 3. Edit Event
- Click pencil icon on event card
- Modify details
- Click "Save Changes"

#### 4. Delete Event
- Click trash icon on event card
- Confirm deletion

#### 5. Add Holiday
- In "Add Event" dialog, set Type to "Holiday"
- Enter holiday name and date
- Save

#### 6. Filter Events
- Click event type badges at top
- Show/hide specific event types
- Click "Show All" to reset

#### 7. Sync Holidays
```bash
# Via API call (optional manual sync)
POST /api/holidays/sync
{
  "country": "IN",
  "year": 2024
}
```

### For Employees

#### 1. View Calendar
- See all company holidays and events
- Cannot edit/delete events

#### 2. Add Reminders
- Click "Add Reminder" button
- Create personal reminders only
- Can edit/delete own reminders

#### 3. View Notifications
- Check "Upcoming Alerts" panel
- Get email notifications daily at 8 AM

---

## 🇮🇳 Supported Countries

Default holidays are included for:
- **IN** - India (37 major holidays)
- **US** - United States (9 federal holidays)
- **UK** - United Kingdom (8 bank holidays)

To add more countries, edit `backend/src/services/holidayService.js`:

```javascript
const defaultHolidays = {
  IN: [...],
  US: [...],
  UK: [...],
  // Add your country:
  CA: [
    { month: 0, day: 1, title: "New Year's Day" },
    { month: 6, day: 1, title: "Canada Day" },
    // ...
  ]
};
```

---

## 🐛 Troubleshooting

### Holidays Not Showing
1. Check MongoDB connection
2. Wait for initial fetch from API
3. Check server logs for errors
4. Manually trigger sync: `POST /api/holidays/sync`

### Notifications Not Firing
1. Check cron scheduler is running: `[Notification Scheduler] Started`
2. Verify SMTP settings for email
3. Check user email addresses in database
4. Review logs: `[Notification Scheduler] Running scheduled task`

### API Errors
- 403: Not authorized (must be admin)
- 400: Invalid country/year parameters
- 500: Server error (check logs)

### UI Not Updating
1. Clear browser cache
2. Clear React Query cache: `localStorage.clear()`
3. Restart frontend dev server

---

## 🔐 Security

### Role-Based Access
- **Admin**: Full access (create/edit/delete all events and holidays)
- **Employee**: Can only create/edit personal reminders
- **Candidate**: Read-only access to calendar

### Data Validation
- Input is validated on both frontend and backend
- MongoDB indexes prevent duplicate entries
- CSRF protection with Express Validator

### Environment Security
- API keys stored in `.env` (never in code)
- JWT authentication on all endpoints
- Rate limiting on API endpoints

---

## 📊 Performance Optimization

### Database Indexes
Defined in Holiday and Event models:
- `{ date: 1 }` - Fast date queries
- `{ country: 1, date: 1 }` - Holiday lookups
- `{ type: 1, date: 1 }` - Event filtering

### Caching Strategy
- Holidays cached in MongoDB (not re-fetched daily)
- Frontend uses React Query for caching
- API responses cached for 5 minutes

### Recommendations
- For 10k+ users: Enable Redis caching
- Batch notification processing in production
- Archive old events after 1 year

---

## 🚢 Deployment

### Backend

1. **Install dependencies:**
   ```bash
   npm install
   npm install cron date-fns
   ```

2. **Set environment variables:**
   ```bash
   export MONGODB_URI=production_db
   export JWT_SECRET=strong_secret
   export SMTP_HOST=smtp.brevo.com
   # ... other vars
   ```

3. **Build and run:**
   ```bash
   npm run dev      # Development
   npm start        # Production
   ```

### Frontend

1. **Build:**
   ```bash
   npm run build
   ```

2. **Deploy to Vercel/Netlify:**
   ```bash
   # Set VITE_API_URL environment variable
   export VITE_API_URL=https://api.yourdomain.com
   ```

---

## 📚 File Structure

```
backend/
├── src/
│   ├── models/
│   │   ├── Holiday.js          (NEW)
│   │   └── Event.js            (existing)
│   ├── controllers/
│   │   ├── holidayController.js (NEW)
│   │   └── eventController.js  (existing)
│   ├── routes/
│   │   ├── holidayRoutes.js    (NEW)
│   │   └── eventRoutes.js      (existing)
│   ├── services/
│   │   ├── holidayService.js   (NEW)
│   │   └── notificationScheduler.js (NEW)
│   └── app.js                  (UPDATED)

frontend/
├── src/
│   ├── pages/admin/
│   │   └── AdminCalendar.tsx   (NEW)
│   ├── components/calendar/
│   │   ├── EventCalendarCard.tsx    (existing)
│   │   ├── CalendarFilters.tsx      (NEW)
│   │   └── UpcomingAlertsPanel.tsx  (NEW)
│   └── services/
│       └── api.ts              (UPDATED)
```

---

## ✨ Features Checklist

- ✅ Public holiday integration (Nager.Date API)
- ✅ Holiday caching in database
- ✅ Calendar UI with holidays highlighted
- ✅ Tooltip on hover with event details
- ✅ Event type filtering (Holiday, Birthday, Meeting, Reminder)
- ✅ Multiple event types support
- ✅ Add/edit/delete events (admin)
- ✅ Personal reminders (employee)
- ✅ Daily email notifications
- ✅ In-app toast notifications
- ✅ Upcoming alerts panel (7-14 days)
- ✅ Empty state handling
- ✅ Role-based access control
- ✅ Responsive design
- ✅ Smooth animations
- ✅ Modern glassmorphism UI
- ✅ Dark mode support

---

## 🔮 Future Enhancement Ideas

1. **Google Calendar Sync** - Bi-directional sync
2. **Outlook Integration** - Calendar sharing
3. **SMS Notifications** - Text reminders
4. **Multi-language Support** - i18n implementation
5. **Custom Holidays per Department** - Department-specific holidays
6. **Holiday Analytics** - Report on holiday distribution
7. **Mobile App** - React Native version
8. **Calendar Export** - iCal, CSV export
9. **Team Calendars** - View team members' availability
10. **Meeting Room Booking** - Integrated reservations

---

## 📞 Support

For issues or questions:
1. Check logs: `backend/logs/` or console output
2. Review API responses in Network tab
3. Verify database connection: `mongosh hr_harmony_hub`
4. Test API endpoints with curl/Postman

---

## 📄 License

Same as Arihant Dream Infra Project Ltd. project

---

**Last Updated:** March 30, 2026
**Version:** 1.0.0
