import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/app",
    lang: "en",
    dir: "ltr",
    name: "StudyStation — AI study companion",
    short_name: "StudyStation",
    description:
      "Capture lectures, create detailed notes, revise with AI and plan your studies.",
    start_url: "/app?source=pwa",
    scope: "/",
    display: "standalone",
    launch_handler: {
      client_mode: "navigate-existing",
    },
    background_color: "#fbfaff",
    theme_color: "#7259e8",
    orientation: "any",
    categories: ["education", "productivity"],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "Record a lecture",
        short_name: "Record",
        description: "Start capturing a lecture",
        url: "/app?action=record",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
      {
        name: "Open study planner",
        short_name: "Planner",
        description: "View timetable and study tasks",
        url: "/app?view=planner",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
      {
        name: "Study Assistant Lab",
        short_name: "AI Tutor",
        description: "Ask questions grounded in your course materials",
        url: "/app?view=assistant",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
    ],
    // Windows 11 Widgets Board integration
    widgets: [
      {
        name: "Today's Schedule",
        short_name: "Schedule",
        description: "Upcoming lectures and next class countdown",
        tag: "studystation-schedule",
        template: "/widgets/schedule.json",
        ms_ac_template: "/widgets/schedule.json",
        data: "/api/widgets/data?type=schedule",
        type: "application/json",
        screenshots: [
          { src: "/icons/icon-512.png", sizes: "512x512", label: "StudyStation Today's Schedule" },
        ],
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
        auth: true,
        update: 900,
      },
      {
        name: "Study Reminders",
        short_name: "Reminders",
        description: "Upcoming assignments, exams, and personal study tasks",
        tag: "studystation-reminders",
        template: "/widgets/reminders.json",
        ms_ac_template: "/widgets/reminders.json",
        data: "/api/widgets/data?type=reminders",
        type: "application/json",
        screenshots: [
          { src: "/icons/icon-512.png", sizes: "512x512", label: "StudyStation Study Reminders" },
        ],
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
        auth: true,
        update: 1800,
      },
      {
        name: "Study Progress",
        short_name: "Progress",
        description: "Study hours, completed tasks, and revision progress",
        tag: "studystation-progress",
        template: "/widgets/progress.json",
        ms_ac_template: "/widgets/progress.json",
        data: "/api/widgets/data?type=progress",
        type: "application/json",
        screenshots: [
          { src: "/icons/icon-512.png", sizes: "512x512", label: "StudyStation Study Progress" },
        ],
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
        auth: true,
        update: 3600,
      },
      {
        name: "Quick Actions",
        short_name: "Actions",
        description: "Start recording, open timetable, or create a reminder",
        tag: "studystation-quick-actions",
        template: "/widgets/quick-actions.json",
        ms_ac_template: "/widgets/quick-actions.json",
        data: "/api/widgets/data?type=actions",
        type: "application/json",
        screenshots: [
          { src: "/icons/icon-512.png", sizes: "512x512", label: "StudyStation Quick Actions" },
        ],
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
        auth: false,
        update: 86400,
      },
    ],
    // Windows deep linking protocol handlers
    protocol_handlers: [
      {
        protocol: "web+studystation",
        url: "/app?view=%s",
      },
    ],
  } as MetadataRoute.Manifest;
}
