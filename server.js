/**
 * CRM System - Production-Ready Server
 * Node.js + Express + PostgreSQL
 */

const express = require("express");
const cors = require("cors");
const session = require("express-session");
const PgSession = require("connect-pg-simple")(session);
const cookieParser = require("cookie-parser");
const path = require("path");
const multer = require("multer");
const fs = require("fs");

// Configuration and utilities
const config = require("./config");
const logger = require("./utils/logger");
const { pool, verifyConnection, closePool } = require("./core/db");

// Middleware
const {
  requireAuth,
  requireAdmin,
  requireSuperAdmin,
  requireEmployee,
} = require("./middlewares/auth");
const { checkPermission } = require("./middlewares/permissions");
const { loginLimiter, apiLimiter } = require("./middlewares/rateLimiter");
const analyticsMiddleware = require("./middlewares/analytics");
const {
  forceHttps,
  helmetConfig,
  requestLogger,
  apiSecurityHeaders,
} = require("./middlewares/security");
const {
  errorHandler,
  notFoundHandler,
  AppError,
} = require("./middlewares/errorHandler");

// Controllers
const authCtrl = require("./controllers/authController");
const adminCtrl = require("./controllers/adminController");
const analyticsCtrl = require("./controllers/analyticsController");
const employeeCtrl = require("./controllers/employeeController");
const evalCtrl = require("./controllers/evaluationsController");
const objCtrl = require("./controllers/objectivesController");
const permCtrl = require("./controllers/permissionsController");
const finanzasCtrl = require("./controllers/finanzasController");
const notifCtrl = require("./controllers/notificacionesController");
const calCtrl = require("./controllers/calendarioController");
const asistCtrl = require("./controllers/asistenciaController");
const proyCtrl = require("./controllers/proyectosController");
const ventasCtrl = require("./controllers/ventasController");
const ausenciasCtrl = require("./controllers/ausenciasController");
const reportCtrl = require("./controllers/reportController");

const app = express();

// ═══════════════════════════════════════════════════════════
// TRUST PROXY (Required for HTTPS behind reverse proxy)
// ═══════════════════════════════════════════════════════════
if (config.trustProxy) {
  app.set("trust proxy", 1);
  logger.info("Trust proxy enabled (running behind reverse proxy)");
}

// ═══════════════════════════════════════════════════════════
// SECURITY MIDDLEWARE
// ═══════════════════════════════════════════════════════════
//app.use(forceHttps); // Force HTTPS in production
app.use(helmetConfig); // Security headers
app.use(requestLogger); // HTTP request logging
app.use(apiSecurityHeaders); // API-specific security headers

// ═══════════════════════════════════════════════════════════
// CORS CONFIGURATION
// ═══════════════════════════════════════════════════════════
app.use(cors({ origin: true, credentials: true }));
// ═══════════════════════════════════════════════════════════
// BODY PARSERS
// ═══════════════════════════════════════════════════════════
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
app.use(cookieParser());

// ═══════════════════════════════════════════════════════════
// SESSION CONFIGURATION
// ═══════════════════════════════════════════════════════════
const sessionStore = new PgSession({
  pool: pool,
  tableName: "session",
  createTableIfMissing: false, // Create table manually in production
});

app.use(
  session({
    name: config.session.name,
    secret: config.session.secret,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: true, // true in production (HTTPS only)
      sameSite: none,
      maxAge: config.session.maxAge,
      // Add domain in production for cross-subdomain support
      ...(config.isProduction && process.env.COOKIE_DOMAIN && {
        domain: process.env.COOKIE_DOMAIN
      })
    },
  })
);

// ═══════════════════════════════════════════════════════════
// FILE UPLOAD CONFIGURATION
// ═══════════════════════════════════════════════════════════
const UPLOADS_DIR = path.join(__dirname, "uploads", "empleados");
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, UPLOADS_DIR),
  filename: (_, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safe = `emp-${Date.now()}-${Math.floor(Math.random() * 10000)}${ext}`;
    cb(null, safe);
  },
});

const photoUpload = multer({
  storage,
  limits: { fileSize: config.upload.maxSize },
  fileFilter: (_, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (config.upload.allowedTypes.includes(ext)) {
      return cb(null, true);
    }
    cb(new Error("Solo se permiten imágenes JPG, PNG y WEBP."));
  },
});

// ═══════════════════════════════════════════════════════════
// STATIC FILES
// ═══════════════════════════════════════════════════════════
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ═══════════════════════════════════════════════════════════
// ANALYTICS TRACKING
// ═══════════════════════════════════════════════════════════
app.use(analyticsMiddleware);

// ═══════════════════════════════════════════════════════════
// HEALTH CHECK (for load balancers, monitoring)
// ═══════════════════════════════════════════════════════════
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: config.env,
  });
});

// ═══════════════════════════════════════════════════════════
// API RATE LIMITING
// ═══════════════════════════════════════════════════════════
//
app.use("/api", apiLimiter);

// ═══════════════════════════════════════════════════════════
// API ROUTES - AUTHENTICATION
// ═══════════════════════════════════════════════════════════
app.post("/api/auth/login", loginLimiter, authCtrl.login);
app.post("/api/auth/logout", authCtrl.logout);
app.get("/api/auth/me", requireAuth, authCtrl.me);
app.get("/api/users", requireAdmin, authCtrl.listUsers);
app.post(
  "/api/auth/change-password",
  requireAuth,
  ...authCtrl.changePasswordValidators,
  authCtrl.changePassword
);
app.post("/api/auth/forgot-password", authCtrl.requestPasswordReset);
app.post("/api/auth/reset-password", authCtrl.confirmPasswordReset);

// ═══════════════════════════════════════════════════════════
// API ROUTES - ADMIN / EMPLOYEES
// ═══════════════════════════════════════════════════════════
app.get("/api/admin/dashboard", requireAdmin, adminCtrl.dashboard);
app.get(
  "/api/admin/employees",
  requireAdmin,
  checkPermission("RRHH", "ver"),
  adminCtrl.listEmployees
);
app.get(
  "/api/admin/employees/:id",
  requireAdmin,
  checkPermission("RRHH", "ver"),
  adminCtrl.getEmployee
);
app.post(
  "/api/admin/employees",
  requireAdmin,
  checkPermission("RRHH", "crear"),
  ...adminCtrl.createValidators,
  adminCtrl.createEmployee
);
app.put(
  "/api/admin/employees/:id",
  requireAdmin,
  checkPermission("RRHH", "editar"),
  adminCtrl.updateEmployee
);
app.delete(
  "/api/admin/employees/:id",
  requireAdmin,
  checkPermission("RRHH", "eliminar"),
  adminCtrl.deleteEmployee
);
app.post(
  "/api/admin/employees/:id/photo",
  requireAdmin,
  checkPermission("RRHH", "editar"),
  (req, res, next) =>
    photoUpload.single("photo")(req, res, (err) => {
      if (err) return next(err);
      next();
    }),
  adminCtrl.uploadPhoto
);
app.get(
  "/api/admin/reports/employees/csv",
  requireAdmin,
  checkPermission("RRHH", "ver"),
  reportCtrl.exportEmployeesCSV
);

// ═══════════════════════════════════════════════════════════
// API ROUTES - AUDIT
// ═══════════════════════════════════════════════════════════
app.get(
  "/api/admin/audit",
  requireAdmin,
  checkPermission("Auditoria", "ver"),
  adminCtrl.getAuditLogs
);
app.get(
  "/api/admin/audit/duplicates",
  requireAdmin,
  checkPermission("Auditoria", "ver"),
  adminCtrl.getDuplicates
);

// ═══════════════════════════════════════════════════════════
// API ROUTES - CONFIG
// ═══════════════════════════════════════════════════════════
app.get("/api/admin/config", requireAdmin, adminCtrl.getConfig);
app.put("/api/admin/config/:key", requireAdmin, adminCtrl.updateConfig);

// ═══════════════════════════════════════════════════════════
// API ROUTES - PERMISSIONS
// ═══════════════════════════════════════════════════════════
app.get("/api/permissions/matrix", requireSuperAdmin, permCtrl.getMatrix);
app.get("/api/permissions/roles", requireAdmin, permCtrl.getRoles);
app.post("/api/permissions/toggle", requireSuperAdmin, permCtrl.toggle);
app.put(
  "/api/permissions/role/:roleId",
  requireSuperAdmin,
  permCtrl.bulkUpdate
);

// ═══════════════════════════════════════════════════════════
// API ROUTES - ANALYTICS
// ═══════════════════════════════════════════════════════════
app.post("/api/analytics/pageview", requireAuth, analyticsCtrl.trackPageView);
app.get(
  "/api/analytics/stats",
  requireAdmin,
  checkPermission("Analitica", "ver"),
  analyticsCtrl.getStats
);
app.get(
  "/api/analytics/traffic",
  requireAdmin,
  checkPermission("Analitica", "ver"),
  analyticsCtrl.getTraffic
);
app.get(
  "/api/analytics/pages",
  requireAdmin,
  checkPermission("Analitica", "ver"),
  analyticsCtrl.getTopPages
);
app.get(
  "/api/analytics/devices",
  requireAdmin,
  checkPermission("Analitica", "ver"),
  analyticsCtrl.getDevices
);
app.get(
  "/api/analytics/clicks",
  requireAdmin,
  checkPermission("Analitica", "ver"),
  analyticsCtrl.getTopClicks
);
app.post("/api/analytics/click", requireAuth, analyticsCtrl.trackClick);

// ═══════════════════════════════════════════════════════════
// API ROUTES - EVALUATIONS & OBJECTIVES
// ═══════════════════════════════════════════════════════════
app.post(
  "/api/evaluations",
  requireAdmin,
  checkPermission("Desempeno", "crear"),
  ...evalCtrl.validators,
  evalCtrl.create
);
app.get(
  "/api/evaluations/summary",
  requireAdmin,
  checkPermission("Desempeno", "ver"),
  evalCtrl.getSummary
);
app.get(
  "/api/evaluations/:employeeId",
  requireAuth,
  checkPermission("Desempeno", "ver"),
  evalCtrl.getByEmployee
);

app.post(
  "/api/objectives",
  requireAdmin,
  checkPermission("Objetivos", "crear"),
  ...objCtrl.validators,
  objCtrl.create
);
app.get(
  "/api/objectives",
  requireAdmin,
  checkPermission("Objetivos", "ver"),
  objCtrl.getAll
);
app.get(
  "/api/objectives/employee/:employeeId",
  requireAuth,
  checkPermission("Objetivos", "ver"),
  objCtrl.getByEmployee
);
app.patch(
  "/api/objectives/:id/progress",
  requireAdmin,
  checkPermission("Objetivos", "editar"),
  objCtrl.updateProgress
);

// ═══════════════════════════════════════════════════════════
// API ROUTES - EMPLOYEE DASHBOARD
// ═══════════════════════════════════════════════════════════
app.get("/api/employee/dashboard", requireEmployee, employeeCtrl.dashboard);

// ═══════════════════════════════════════════════════════════
// API ROUTES - AUSENCIAS
// ═══════════════════════════════════════════════════════════
app.post("/api/ausencias", requireAuth, ausenciasCtrl.create);
app.get("/api/ausencias", requireAdmin, ausenciasCtrl.getAll);
app.put("/api/ausencias/:id/aprobar", requireAdmin, ausenciasCtrl.aprobar);
app.put("/api/ausencias/:id/rechazar", requireAdmin, ausenciasCtrl.rechazar);

// ═══════════════════════════════════════════════════════════
// API ROUTES - FINANZAS
// ═══════════════════════════════════════════════════════════
app.get(
  "/api/finanzas/stats",
  requireAdmin,
  checkPermission("Finanzas", "ver"),
  finanzasCtrl.getStats
);
app.get(
  "/api/finanzas/evolutivo",
  requireAdmin,
  checkPermission("Finanzas", "ver"),
  finanzasCtrl.getEvolutivo
);
app.get(
  "/api/finanzas/categorias",
  requireAdmin,
  checkPermission("Finanzas", "ver"),
  finanzasCtrl.getCategorias
);
app.get(
  "/api/finanzas/transacciones",
  requireAdmin,
  checkPermission("Finanzas", "ver"),
  finanzasCtrl.list
);
app.post(
  "/api/finanzas/transacciones",
  requireAdmin,
  checkPermission("Finanzas", "crear"),
  finanzasCtrl.create
);
app.put(
  "/api/finanzas/transacciones/:id",
  requireAdmin,
  checkPermission("Finanzas", "editar"),
  finanzasCtrl.update
);
app.patch(
  "/api/finanzas/transacciones/:id/anular",
  requireAdmin,
  checkPermission("Finanzas", "editar"),
  finanzasCtrl.anular
);

// ═══════════════════════════════════════════════════════════
// API ROUTES - NOTIFICACIONES
// ═══════════════════════════════════════════════════════════
app.get("/api/notificaciones/badge", requireAuth, notifCtrl.getBadge);
app.get("/api/notificaciones/mias", requireAuth, notifCtrl.getMias);
app.get("/api/notificaciones", requireAdmin, notifCtrl.getAll);
app.post("/api/notificaciones", requireAdmin, notifCtrl.create);
app.put(
  "/api/notificaciones/leer-todas",
  requireAuth,
  notifCtrl.marcarTodasLeidas
);
app.put("/api/notificaciones/:id/leer", requireAuth, notifCtrl.marcarLeida);
app.delete("/api/notificaciones/:id", requireAdmin, notifCtrl.eliminar);

// ═══════════════════════════════════════════════════════════
// API ROUTES - CALENDARIO
// ═══════════════════════════════════════════════════════════
app.get("/api/calendario/proximos", requireAuth, calCtrl.getProximos);
app.get("/api/calendario", requireAuth, calCtrl.getByMes);
app.post("/api/calendario", requireAdmin, calCtrl.create);
app.put("/api/calendario/:id", requireAdmin, calCtrl.update);
app.delete("/api/calendario/:id", requireAdmin, calCtrl.remove);

// ═══════════════════════════════════════════════════════════
// API ROUTES - ASISTENCIA
// ═══════════════════════════════════════════════════════════
app.get(
  "/api/asistencia/resumen",
  requireAdmin,
  checkPermission("Asistencia", "ver"),
  asistCtrl.getResumen
);
app.get(
  "/api/asistencia/list",
  requireAdmin,
  checkPermission("Asistencia", "ver"),
  asistCtrl.getList
);
app.get("/api/asistencia/historial", requireAuth, asistCtrl.getHistorial);
app.post(
  "/api/asistencia/marcar",
  requireAdmin,
  checkPermission("Asistencia", "editar"),
  asistCtrl.marcar
);
app.post("/api/asistencia/entrada", requireAuth, asistCtrl.marcarEntrada);
app.post("/api/asistencia/salida", requireAuth, asistCtrl.marcarSalida);

// ═══════════════════════════════════════════════════════════
// API ROUTES - PROYECTOS
// ═══════════════════════════════════════════════════════════
app.get("/api/proyectos/mis-tareas", requireAuth, proyCtrl.getMyTasks);
app.get(
  "/api/proyectos/stats",
  requireAdmin,
  checkPermission("Proyectos", "ver"),
  proyCtrl.getStats
);
app.get(
  "/api/proyectos",
  requireAdmin,
  checkPermission("Proyectos", "ver"),
  proyCtrl.list
);
app.post(
  "/api/proyectos",
  requireAdmin,
  checkPermission("Proyectos", "crear"),
  proyCtrl.create
);
app.get(
  "/api/proyectos/:id",
  requireAdmin,
  checkPermission("Proyectos", "ver"),
  proyCtrl.get
);
app.put(
  "/api/proyectos/:id",
  requireAdmin,
  checkPermission("Proyectos", "editar"),
  proyCtrl.update
);
app.delete(
  "/api/proyectos/:id",
  requireAdmin,
  checkPermission("Proyectos", "eliminar"),
  proyCtrl.remove
);
app.post(
  "/api/proyectos/:id/tareas",
  requireAdmin,
  checkPermission("Proyectos", "editar"),
  proyCtrl.createTarea
);
app.patch(
  "/api/proyectos/tareas/:tareaId/estado",
  requireAdmin,
  checkPermission("Proyectos", "editar"),
  proyCtrl.updateTareaEstado
);

// ═══════════════════════════════════════════════════════════
// API ROUTES - VENTAS
// ═══════════════════════════════════════════════════════════
app.get(
  "/api/ventas/stats",
  requireAdmin,
  checkPermission("Ventas", "ver"),
  ventasCtrl.getStats
);
app.get(
  "/api/ventas/evolutivo",
  requireAdmin,
  checkPermission("Ventas", "ver"),
  ventasCtrl.getEvolutivo
);
app.get(
  "/api/ventas",
  requireAdmin,
  checkPermission("Ventas", "ver"),
  ventasCtrl.list
);
app.post(
  "/api/ventas",
  requireAdmin,
  checkPermission("Ventas", "crear"),
  ventasCtrl.create
);
app.put(
  "/api/ventas/:id",
  requireAdmin,
  checkPermission("Ventas", "editar"),
  ventasCtrl.update
);
app.patch(
  "/api/ventas/:id/estado",
  requireAdmin,
  checkPermission("Ventas", "editar"),
  ventasCtrl.updateEstado
);
app.delete(
  "/api/ventas/:id",
  requireAdmin,
  checkPermission("Ventas", "eliminar"),
  ventasCtrl.remove
);

// ═══════════════════════════════════════════════════════════
// ERROR HANDLERS (Must be last)
// ═══════════════════════════════════════════════════════════
app.use(notFoundHandler);
app.use(errorHandler);

// ═══════════════════════════════════════════════════════════
// GRACEFUL SHUTDOWN
// ═══════════════════════════════════════════════════════════
const gracefulShutdown = async (signal) => {
  logger.info(`${signal} received. Starting graceful shutdown...`);
  
  server.close(async () => {
    logger.info("HTTP server closed");
    await closePool();
    logger.info("Graceful shutdown completed");
    process.exit(0);
  });

  // Force shutdown after 30 seconds
  setTimeout(() => {
    logger.error("Forced shutdown after timeout");
    process.exit(1);
  }, 30000);
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// ═══════════════════════════════════════════════════════════
// START SERVER
// ═══════════════════════════════════════════════════════════
const PORT = config.port;
const server = app.listen(PORT, async () => {
  logger.info(`
╔═══════════════════════════════════════════════════════════╗
║  ${config.appName}                                        
║  Environment: ${config.env}
║  Port: ${PORT}
║  URL: ${config.backendUrl}
╚═══════════════════════════════════════════════════════════╝
  `);

  await verifyConnection();
  logger.info(`Uploads directory: ${UPLOADS_DIR}`);
  logger.info("Server ready to accept connections");
});

// Handle server errors
server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    logger.error(`Port ${PORT} is already in use`);
  } else {
    logger.error("Server error", error);
  }
  process.exit(1);
});
