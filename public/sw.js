const CACHE_NAME = "studystation-public-v2";
const STATIC_ASSETS = [
  "/offline.html",
  "/logo.png",
  "/icons/apple-touch-icon.png",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

function isSameOrigin(request) {
  return new URL(request.url).origin === self.location.origin;
}

function isPublicStaticAsset(request) {
  if (!isSameOrigin(request)) return false;

  const url = new URL(request.url);
  return (
    url.pathname.startsWith("/_next/static/") ||
    STATIC_ASSETS.includes(url.pathname)
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data ? event.data.text() : "" };
  }

  const title = typeof payload.title === "string" && payload.title.trim()
    ? payload.title
    : "StudyStation";
  const body = typeof payload.body === "string" ? payload.body : "";
  const data = payload.data && typeof payload.data === "object" ? payload.data : {};
  const actions = Array.isArray(payload.actions)
    ? payload.actions.filter((action) => action && typeof action.action === "string" && typeof action.title === "string").slice(0, 3)
    : [];

  event.waitUntil(self.registration.showNotification(title, {
    body,
    tag: typeof payload.tag === "string" ? payload.tag : undefined,
    renotify: Boolean(payload.renotify),
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    requireInteraction: Boolean(payload.requireInteraction),
    actions,
    data,
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const action = event.action || "open";

  // If user clicked "Dismiss", simply close without opening the app
  if (action === "dismiss") {
    return;
  }

  const data = event.notification.data && typeof event.notification.data === "object"
    ? event.notification.data
    : {};

  let target = typeof data[action] === "string"
    ? data[action]
    : typeof data.url === "string"
      ? data.url
      : "/app";

  if (action === "record") {
    target = "/app?action=record";
  }

  const url = new URL(target, self.location.origin);
  if (url.origin !== self.location.origin) return;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((client) => "focus" in client);
      if (existing && "navigate" in existing) {
        return existing.navigate(url.href).then((client) => client?.focus());
      }
      return self.clients.openWindow(url.href);
    })
  );
});

/* ------------------- Windows 11 Desktop Widgets (PWA-driven) ------------------- */

const widgetRoutes = {
  "studystation-schedule": {
    template: "/widgets/schedule.json",
    dataEndpoint: "/api/widgets/data?type=schedule",
  },
  "studystation-reminders": {
    template: "/widgets/reminders.json",
    dataEndpoint: "/api/widgets/data?type=reminders",
  },
  "studystation-progress": {
    template: "/widgets/progress.json",
    dataEndpoint: "/api/widgets/data?type=progress",
  },
  "studystation-quick-actions": {
    template: "/widgets/quick-actions.json",
    dataEndpoint: "/api/widgets/data?type=actions",
  },
};

async function updateWidgetByTag(widgetInstance) {
  if (!self.widgets || typeof self.widgets.updateByInstanceId !== "function") return;
  const tag = widgetInstance.definition?.tag;
  const config = widgetRoutes[tag];
  if (!config) return;

  try {
    const [templateRes, dataRes] = await Promise.all([
      fetch(config.template),
      fetch(config.dataEndpoint),
    ]);

    if (templateRes.ok && dataRes.ok) {
      const template = await templateRes.text();
      const data = await dataRes.text();
      await self.widgets.updateByInstanceId(widgetInstance.instanceId, {
        template,
        data,
      });
    }
  } catch (err) {
    console.warn("[SW] Widget update failed for", tag, err);
  }
}

self.addEventListener("widgetinstall", (event) => {
  event.waitUntil(updateWidgetByTag(event.widget));
});

self.addEventListener("widgetresume", (event) => {
  event.waitUntil(updateWidgetByTag(event.widget));
});

self.addEventListener("widgetclick", (event) => {
  const verb = event.action;
  let target = "/app";
  if (verb === "record") target = "/app?action=record";
  else if (verb === "planner") target = "/app?view=planner";
  else if (verb === "assistant") target = "/app?view=assistant";
  else if (verb === "progress") target = "/app?view=reports";

  const url = new URL(target, self.location.origin);
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((client) => "focus" in client);
      if (existing && "navigate" in existing) {
        return existing.navigate(url.href).then((client) => client?.focus());
      }
      return self.clients.openWindow(url.href);
    })
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET" || !isSameOrigin(event.request)) return;

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .catch(() => caches.match("/offline.html"))
    );
    return;
  }

  if (!isPublicStaticAsset(event.request)) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const network = fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
