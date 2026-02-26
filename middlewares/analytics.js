const WebAnalytics = require('../models/WebAnalytics');

/**
 * Detect device type from User-Agent string
 */
function detectDevice(ua = '') {
    const mobile = /mobile|android|iphone|ipad|phone/i.test(ua);
    const tablet = /ipad|tablet/i.test(ua);
    if (tablet) return 'tablet';
    if (mobile) return 'mobile';
    return 'desktop';
}

/**
 * Analytics middleware — auto-tracks every GET page request
 */
function analyticsMiddleware(req, res, next) {
    // Only track GET requests to actual pages (not API or static assets)
    if (req.method !== 'GET') return next();
    if (req.path.startsWith('/api')) return next();
    if (req.path.startsWith('/css') || req.path.startsWith('/js') || req.path.startsWith('/img')) return next();

    const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket?.remoteAddress || '0.0.0.0';
    const ua = req.headers['user-agent'] || '';
    const sessionId = req.session?.id || req.sessionID || 'anonymous';
    const userId = req.session?.userId || null;
    const deviceType = detectDevice(ua);
    const referrer = req.headers.referer || null;

    // Non-blocking: track visit without delaying the response
    WebAnalytics.trackVisit({
        sessionId,
        userId,
        path: req.path,
        ip,
        userAgent: ua,
        deviceType,
        referrer,
    }).catch(err => console.error('Analytics track error:', err.message));

    next();
}

module.exports = analyticsMiddleware;
