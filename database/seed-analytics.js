/**
 * Script para agregar datos de prueba de analytics
 * Esto permite visualizar datos en el dashboard de analytics
 */
const { query } = require("../core/db");

async function seedAnalytics() {
  console.log("🌱 Sembrando datos de analytics...");

  try {
    // Limpiar datos existentes (opcional - comentar si quieres preservar)
    // await query('DELETE FROM web_analytics');

    // Generar datos de devices para últimos 7 días
    const pages = [
      "/admin/dashboard",
      "/admin/employees",
      "/admin/analytics",
      "/admin/ventas",
      "/admin/proyectos",
      "/employee/dashboard",
      "/admin/finanzas",
    ];

    const devices = ["mobile", "desktop", "tablet"];

    // Generar 200 eventos aleatorios
    for (let i = 0; i < 200; i++) {
      const randomPage = pages[Math.floor(Math.random() * pages.length)];
      const randomDevice = devices[Math.floor(Math.random() * devices.length)];
      const daysAgo = Math.floor(Math.random() * 7);
      const hoursAgo = Math.floor(Math.random() * 24);

      await query(
        `INSERT INTO web_analytics 
                (session_id, user_id, event_type, path, ip, device_type, created_at)
                VALUES ($1, $2, 'pageview', $3, $4, $5, CURRENT_TIMESTAMP - (INTERVAL '1 day' * $6) - (INTERVAL '1 hour' * $7))`,
        [
          `session_${i}`,
          Math.random() > 0.3 ? Math.floor(Math.random() * 20 + 1) : null,
          randomPage,
          `192.168.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}`,
          randomDevice,
          daysAgo,
          hoursAgo,
        ],
      );
    }

    console.log("✓ 200 eventos de analytics creados");
    console.log("  - 50% Desktop, 30% Mobile, 20% Tablet (aproximado)");
    console.log("  - Distribuido en últimos 7 días");
    console.log("  - Ya puedes ver los datos en /admin/analytics\n");
  } catch (err) {
    console.error("❌ Error al sembrar analytics:", err);
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  seedAnalytics().then(() => {
    console.log("✓ Completado");
    process.exit(0);
  });
}

module.exports = seedAnalytics;
