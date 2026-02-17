# work-calendar

📅 **ICS Calendar Subscription Service** - Subscribe to work calendars on your iPhone, Android, or any calendar application.

## Features

- Generate ICS (iCalendar) format files
- Subscribe to calendars on any device
- Recurring events support (daily, weekly, monthly)
- Web interface to browse available calendars
- Easy iPhone integration

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Start the Server

```bash
npm start
```

The server will start on `http://localhost:3000`

### 3. Subscribe to Calendar on iPhone

1. Open the server in your browser: `http://localhost:3000`
2. Copy the calendar URL (e.g., `http://localhost:3000/calendar/work.ics`)
3. On your iPhone:
   - Open **Settings** app
   - Tap **Calendar** → **Accounts** → **Add Account**
   - Tap **Other** → **Add Subscribed Calendar**
   - Paste the calendar URL
   - Tap **Next** → **Save**

## Customization

Edit `calendar-data.js` to customize your work calendar events:

```javascript
{
  summary: 'Team Meeting',
  description: 'Weekly team sync',
  start: new Date('2026-02-17T10:00:00'),
  end: new Date('2026-02-17T11:00:00'),
  repeating: {
    freq: 'WEEKLY',
    byDay: ['MO']
  }
}
```

## Production Deployment

For production use:

1. Deploy to a cloud service (Heroku, Railway, Vercel, etc.)
2. Use HTTPS for better device compatibility
3. Set environment variables:
   - `PORT` - Server port (default: 3000)
   - `HOST` - Server host (default: 0.0.0.0)

## Supported Platforms

- iPhone/iPad (iOS Calendar app)
- Android (Google Calendar, Samsung Calendar)
- macOS (Calendar app)
- Windows (Outlook)
- Any application supporting ICS/iCal subscriptions
