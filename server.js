const http = require('http');
const ical = require('ical-generator').default;
const calendarData = require('./calendar-data');

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

function generateICS(calendarConfig) {
  const calendar = ical({
    name: calendarConfig.name,
    description: calendarConfig.description,
    timezone: 'America/New_York'
  });

  calendarConfig.events.forEach(event => {
    const eventOptions = {
      start: event.start,
      end: event.end,
      summary: event.summary,
      description: event.description
    };

    if (event.repeating) {
      eventOptions.repeating = event.repeating;
    }

    calendar.createEvent(eventOptions);
  });

  return calendar.toString();
}

const server = http.createServer((req, res) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);

  // Handle root path
  if (req.url === '/' || req.url === '') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    const calendars = calendarData.calendars.map(cal => 
      `<li><a href="/calendar/${cal.id}.ics">${cal.name}</a> - <code>http://${req.headers.host}/calendar/${cal.id}.ics</code></li>`
    ).join('\n');
    
    res.end(`
<!DOCTYPE html>
<html>
<head>
  <title>Work Calendar - ICS Subscription</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      max-width: 800px;
      margin: 50px auto;
      padding: 20px;
      line-height: 1.6;
    }
    h1 { color: #333; }
    code {
      background: #f4f4f4;
      padding: 2px 6px;
      border-radius: 3px;
      font-family: 'Courier New', monospace;
    }
    .instructions {
      background: #e8f4f8;
      padding: 15px;
      border-radius: 5px;
      margin: 20px 0;
    }
    ul { padding-left: 20px; }
    a { color: #0066cc; }
  </style>
</head>
<body>
  <h1>📅 Work Calendar - ICS Subscription</h1>
  <p>Subscribe to your work calendars on iPhone, Android, or any calendar app that supports ICS.</p>
  
  <h2>Available Calendars</h2>
  <ul>
    ${calendars}
  </ul>
  
  <div class="instructions">
    <h3>How to Subscribe on iPhone:</h3>
    <ol>
      <li>Copy the calendar URL above (e.g., <code>http://${req.headers.host}/calendar/work.ics</code>)</li>
      <li>Open <strong>Settings</strong> app on your iPhone</li>
      <li>Tap <strong>Calendar</strong> → <strong>Accounts</strong> → <strong>Add Account</strong></li>
      <li>Tap <strong>Other</strong> → <strong>Add Subscribed Calendar</strong></li>
      <li>Paste the calendar URL and tap <strong>Next</strong></li>
      <li>Tap <strong>Save</strong></li>
    </ol>
  </div>
  
  <p><em>Note: For production use, host this on a server with HTTPS for better compatibility.</em></p>
</body>
</html>
    `);
    return;
  }

  // Handle calendar requests
  if (req.url.startsWith('/calendar/') && req.url.endsWith('.ics')) {
    const calendarId = req.url.replace('/calendar/', '').replace('.ics', '');
    const calendarConfig = calendarData.calendars.find(cal => cal.id === calendarId);
    
    if (calendarConfig) {
      const icsContent = generateICS(calendarConfig);
      res.writeHead(200, {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': `attachment; filename="${calendarId}.ics"`
      });
      res.end(icsContent);
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Calendar not found');
    }
    return;
  }

  // Handle 404
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not found');
});

server.listen(PORT, HOST, () => {
  console.log(`Work Calendar server running at http://${HOST}:${PORT}/`);
  console.log('Available calendars:');
  calendarData.calendars.forEach(cal => {
    console.log(`  - ${cal.name}: http://${HOST}:${PORT}/calendar/${cal.id}.ics`);
  });
});
