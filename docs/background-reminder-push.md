# Background task & class push notifications

Group calls push while the app is closed because the server sends Web Push
at the moment the call starts.

Tasks and timetable lessons need a timer that checks due times every few
minutes and uses the **same** Web Push path.

## Required: external cron (Vercel Hobby only runs once per day)

1. Vercel → Project → Environment Variables  
   - `CRON_SECRET` = your secret (redeploy after saving)

2. cron-job.org (or similar) every **5 minutes**:

### Easiest URL form (secret in query)

```
https://studystation.vercel.app/api/notifications/reminders/cron?secret=YOUR_CRON_SECRET
```

Method: **GET**  
No custom headers required if you use `?secret=`.

### Or header form

- URL: `https://studystation.vercel.app/api/notifications/reminders/cron`
- Header: `Authorization: Bearer YOUR_CRON_SECRET`

3. On the phone: allow notifications; enable **Study reminders** and **Classes and timetable**.

4. Test: create a task due in ~12 minutes, close the app, wait for the push.
