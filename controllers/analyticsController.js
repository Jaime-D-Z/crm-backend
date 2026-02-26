const WebAnalytics = require("../models/WebAnalytics");

// POST /api/analytics/pageview { path, referrer }
async function trackPageView(req, res) {
  try {
    const { path, referrer } = req.body;
    if (!path) return res.status(400).json({ error: "path required" });
    const sessionId = req.session?.id || req.sessionID || "anonymous";
    const ip =
      req.headers["x-forwarded-for"]?.split(",")[0] ||
      req.socket?.remoteAddress ||
      "0.0.0.0";
    const ua = req.headers["user-agent"] || "";
    const deviceType = /mobile|android|iphone/i.test(ua)
      ? "mobile"
      : /ipad|tablet/i.test(ua)
        ? "tablet"
        : "desktop";
    await WebAnalytics.trackVisit({
      sessionId,
      userId: req.session?.userId || null,
      path,
      ip,
      userAgent: ua,
      deviceType,
      referrer: referrer || null,
    });
    res.json({ ok: true });
  } catch (err) {
    console.error("Analytics trackPageView error:", err);
    res.status(500).json({ error: "Error del servidor" });
  }
}

// GET /api/analytics/stats?days=7
async function getStats(req, res) {
  try {
    const days = parseInt(req.query.days) || 7;
    const stats = await WebAnalytics.getStats(days);
    res.json({ ok: true, stats });
  } catch (err) {
    console.error("Analytics stats error:", err);
    res.status(500).json({ error: "Error del servidor" });
  }
}

// GET /api/analytics/traffic?days=7
async function getTraffic(req, res) {
  try {
    const days = parseInt(req.query.days) || 7;
    const data = await WebAnalytics.getTrafficOverTime(days);
    res.json({ ok: true, data });
  } catch (err) {
    console.error("Analytics error:", err);
    res.status(500).json({ error: "Error del servidor" });
  }
}

// GET /api/analytics/pages?days=7
async function getTopPages(req, res) {
  try {
    const days = parseInt(req.query.days) || 7;
    const pages = await WebAnalytics.getTopPages(days, 10);
    res.json({ ok: true, pages });
  } catch (err) {
    console.error("Analytics error:", err);
    res.status(500).json({ error: "Error del servidor" });
  }
}

// GET /api/analytics/devices?days=7
async function getDevices(req, res) {
  try {
    const days = parseInt(req.query.days) || 7;
    const devices = await WebAnalytics.getDevices(days);
    res.json({ ok: true, devices });
  } catch (err) {
    console.error("Analytics error:", err);
    res.status(500).json({ error: "Error del servidor" });
  }
}

// GET /api/analytics/clicks?days=7
async function getTopClicks(req, res) {
  try {
    const days = parseInt(req.query.days) || 7;
    const clicks = await WebAnalytics.getTopClicks(days, 10);
    res.json({ ok: true, clicks });
  } catch (err) {
    console.error("Analytics error:", err);
    res.status(500).json({ error: "Error del servidor" });
  }
}

// POST /api/analytics/click  { element, path }
async function trackClick(req, res) {
  try {
    const { element, path } = req.body;
    if (!element) return res.status(400).json({ error: "element required" });
    const sessionId = req.session?.id || req.sessionID || "anonymous";
    const ip =
      req.headers["x-forwarded-for"]?.split(",")[0] ||
      req.socket?.remoteAddress ||
      "0.0.0.0";
    const ua = req.headers["user-agent"] || "";
    const deviceType = /mobile|android|iphone/i.test(ua)
      ? "mobile"
      : /ipad|tablet/i.test(ua)
        ? "tablet"
        : "desktop";
    await WebAnalytics.trackClick({
      sessionId,
      userId: req.session?.userId || null,
      element,
      path: path || req.headers.referer || "/",
      ip,
      deviceType,
    });
    res.json({ ok: true });
  } catch (err) {
    console.error("Analytics error:", err);
    res.status(500).json({ error: "Error del servidor" });
  }
}

module.exports = {
  trackPageView,
  getStats,
  getTraffic,
  getTopPages,
  getDevices,
  getTopClicks,
  trackClick,
};
