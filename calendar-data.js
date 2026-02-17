// Sample work calendar data
module.exports = {
  calendars: [
    {
      id: 'work',
      name: 'Work Calendar',
      description: 'My work schedule and events',
      events: [
        {
          summary: 'Team Standup',
          description: 'Daily team standup meeting',
          start: new Date('2026-02-17T09:00:00'),
          end: new Date('2026-02-17T09:30:00'),
          repeating: {
            freq: 'DAILY',
            byDay: ['MO', 'TU', 'WE', 'TH', 'FR']
          }
        },
        {
          summary: 'Sprint Planning',
          description: 'Planning for the upcoming sprint',
          start: new Date('2026-02-24T10:00:00'),
          end: new Date('2026-02-24T12:00:00'),
          repeating: {
            freq: 'WEEKLY',
            interval: 2,
            byDay: ['MO']
          }
        },
        {
          summary: 'One-on-One with Manager',
          description: 'Weekly sync with manager',
          start: new Date('2026-02-19T14:00:00'),
          end: new Date('2026-02-19T14:30:00'),
          repeating: {
            freq: 'WEEKLY',
            byDay: ['WE']
          }
        },
        {
          summary: 'All Hands Meeting',
          description: 'Company-wide all hands meeting',
          start: new Date('2026-02-28T15:00:00'),
          end: new Date('2026-02-28T16:00:00'),
          repeating: {
            freq: 'MONTHLY',
            byMonthDay: [28]
          }
        }
      ]
    }
  ]
};
