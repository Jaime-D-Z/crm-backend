const rateLimit = require('express-rate-limit');

/**
 * Rate limiter for login endpoint:
 * Max 50 attempts per 15 minutes per IP (relaxed for testing)
 * DB-level tracking provides additional security
 */
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 50, // Relaxed for testing - DB-level tracking does the real blocking
    message: { error: 'Demasiados intentos. Espera 15 minutos antes de intentar de nuevo.' },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res, next, options) => {
        res.status(429).json({ error: options.message.error });
    },
});

/**
 * General API rate limiter
 */
const apiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 200,
    message: { error: 'Demasiadas peticiones. Intenta de nuevo en un momento.' },
    standardHeaders: true,
    legacyHeaders: false,
});

module.exports = { loginLimiter, apiLimiter };
