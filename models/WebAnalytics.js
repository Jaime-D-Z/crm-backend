const { query } = require('../core/db');

class WebAnalyticsModel {
    // Track a page visit
    async trackVisit({ sessionId, userId, path, ip, userAgent, deviceType, referrer }) {
        await query(
            `INSERT INTO web_analytics (session_id, user_id, event_type, path, ip, user_agent, device_type, referrer, created_at)
       VALUES ($1, $2, 'pageview', $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)`,
            [sessionId, userId || null, path, ip, userAgent || null, deviceType || 'desktop', referrer || null]
        );
    }

    // Track a click event
    async trackClick({ sessionId, userId, element, path, ip, deviceType }) {
        await query(
            `INSERT INTO web_analytics (session_id, user_id, event_type, element, path, ip, device_type, created_at)
       VALUES ($1, $2, 'click', $3, $4, $5, $6, CURRENT_TIMESTAMP)`,
            [sessionId, userId || null, element, path, ip, deviceType || 'desktop']
        );
    }

    // Summary stats for N days
    async getStats(days = 7) {
        return this._statsWithConditional(days);
    }

    async _statsWithConditional(days) {
        const rows = await query(
            `SELECT
          SUM(CASE WHEN event_type = 'pageview' THEN 1 ELSE 0 END) AS total_visits,
          COUNT(DISTINCT session_id) AS unique_sessions,
          COUNT(DISTINCT CASE WHEN user_id IS NOT NULL THEN user_id END) AS registered_users,
          ROUND(SUM(CASE WHEN event_type = 'pageview' THEN 1 ELSE 0 END)::numeric / NULLIF(COUNT(DISTINCT session_id), 0), 1) AS pages_per_session
        FROM web_analytics
        WHERE created_at >= CURRENT_TIMESTAMP - (INTERVAL '1 day' * $1)`,
            [days]
        );
        return rows[0] || { total_visits: 0, unique_sessions: 0, registered_users: 0, pages_per_session: 0 };
    }

    // Daily traffic (visits + sessions per day)
    async getTrafficOverTime(days = 7) {
        return query(
            `SELECT
          DATE(created_at) AS date,
          SUM(CASE WHEN event_type = 'pageview' THEN 1 ELSE 0 END) AS visits,
          COUNT(DISTINCT session_id) AS sessions
        FROM web_analytics
        WHERE created_at >= CURRENT_TIMESTAMP - (INTERVAL '1 day' * $1)
        GROUP BY DATE(created_at)
        ORDER BY date ASC`,
            [days]
        );
    }

    // Top visited pages
    async getTopPages(days = 7, limit = 10) {
        return query(
            `SELECT
          path,
          COUNT(*) AS visits,
          COUNT(DISTINCT session_id) AS unique_sessions
        FROM web_analytics
        WHERE event_type = 'pageview'
          AND created_at >= CURRENT_TIMESTAMP - (INTERVAL '1 day' * $1)
          AND path IS NOT NULL
        GROUP BY path
        ORDER BY visits DESC
        LIMIT $2`,
            [days, limit]
        );
    }

    // Device distribution
    async getDevices(days = 7) {
        return query(
            `SELECT device_type, COUNT(*) AS total
        FROM web_analytics
        WHERE event_type = 'pageview'
          AND created_at >= CURRENT_TIMESTAMP - (INTERVAL '1 day' * $1)
        GROUP BY device_type`,
            [days]
        );
    }

    // Top clicked elements
    async getTopClicks(days = 7, limit = 10) {
        return query(
            `SELECT element, path, COUNT(*) AS clicks
        FROM web_analytics
        WHERE event_type = 'click'
          AND created_at >= CURRENT_TIMESTAMP - (INTERVAL '1 day' * $1)
          AND element IS NOT NULL
        GROUP BY element, path
        ORDER BY clicks DESC
        LIMIT $2`,
            [days, limit]
        );
    }
}

module.exports = new WebAnalyticsModel();
