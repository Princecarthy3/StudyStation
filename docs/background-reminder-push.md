# Background task & class push notifications

Group calls already push while the app is closed because the server
sends a Web Push at the moment the call starts.

Tasks and timetable lessons need a **scheduled** job that checks due
times every few minutes and uses the same Web Push path.

## Option A — Free external cron (recommended on Vercel Hobby)

1. In Vercel → Project → Settings → Environment Variables, set:
   - `CRON_SECRET` = a long random string
2. Create a job at https://cron-job.org (or similar) every **5 minutes**:
   - URL: `https://studystation.vercel.app/api/notifications/reminders/cron`
   - Method: GET
   - Header: `Authorization: Bearer <your CRON_SECRET>`
3. Keep notification permission enabled on the phone and "Study reminders" / "Classes" toggled on in Settings.

## Option B — GitHub Actions

Add a workflow that GETs the same URL with the Bearer secret every 5 minutes.
The token used to push the workflow file needs the `workflow` scope.

## Verify

1. Enable notifications on the device and allow the browser permission.
2. Create a task due in ~15 minutes.
3. Force-close StudyStation / turn the screen off.
4. Within a few minutes of the due window, you should get a system push
   (same style as "Group call started").
