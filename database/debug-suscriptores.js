#!/usr/bin/env node
"use strict";

const { query } = require("../core/db");

async function debugSuscriptores() {
  try {
    console.log("🔍 Diagnóstico de Suscriptores e IPs\n");

    // Ver todos los suscriptores
    const suscriptores = await query(`
      SELECT id, email, nombre, ip, origen, created_at 
      FROM suscriptores 
      WHERE activo = true 
      ORDER BY created_at DESC 
      LIMIT 10
    `);

    console.log("📧 Suscriptores registrados:");
    if (suscriptores.length === 0) {
      console.log("  ❌ No hay suscriptores registrados\n");
    } else {
      suscriptores.forEach((s, i) => {
        console.log(`  ${i + 1}. ${s.email || 'Sin email'}`);
        console.log(`     IP: ${s.ip || 'Sin IP'}`);
        console.log(`     Nombre: ${s.nombre || 'Sin nombre'}`);
        console.log(`     Origen: ${s.origen}`);
        console.log(`     Fecha: ${s.created_at}`);
        console.log('');
      });
    }

    // Ver IPs en eventos_productos
    const ipsEventos = await query(`
      SELECT DISTINCT ip, COUNT(*) as eventos
      FROM eventos_productos
      WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
      GROUP BY ip
      ORDER BY eventos DESC
      LIMIT 10
    `);

    console.log("📊 IPs con actividad reciente (últimos 7 días):");
    if (ipsEventos.length === 0) {
      console.log("  ❌ No hay actividad reciente\n");
    } else {
      ipsEventos.forEach((e, i) => {
        const suscriptor = suscriptores.find(s => s.ip === e.ip);
        const tieneEmail = suscriptor ? `✅ ${suscriptor.email}` : '❌ Sin email';
        console.log(`  ${i + 1}. IP: ${e.ip}`);
        console.log(`     Eventos: ${e.eventos}`);
        console.log(`     Email: ${tieneEmail}`);
        console.log('');
      });
    }

    // Comparar IPs
    console.log("🔗 Coincidencias IP:");
    let coincidencias = 0;
    ipsEventos.forEach(evento => {
      const suscriptor = suscriptores.find(s => {
        // Comparación exacta
        if (s.ip === evento.ip) return true;
        // Comparación sin prefijo IPv6
        const cleanEventoIp = evento.ip.replace('::ffff:', '');
        const cleanSuscriptorIp = (s.ip || '').replace('::ffff:', '');
        return cleanEventoIp === cleanSuscriptorIp;
      });
      
      if (suscriptor) {
        coincidencias++;
        console.log(`  ✅ ${evento.ip} → ${suscriptor.email}`);
      } else {
        console.log(`  ❌ ${evento.ip} → Sin suscriptor`);
      }
    });

    console.log(`\n📈 Resumen:`);
    console.log(`  Total suscriptores: ${suscriptores.length}`);
    console.log(`  IPs con actividad: ${ipsEventos.length}`);
    console.log(`  Coincidencias: ${coincidencias}`);
    console.log(`  Sin email: ${ipsEventos.length - coincidencias}`);

    // Sugerencias
    if (coincidencias === 0 && suscriptores.length > 0 && ipsEventos.length > 0) {
      console.log(`\n⚠️  PROBLEMA DETECTADO:`);
      console.log(`  Hay suscriptores registrados pero las IPs no coinciden.`);
      console.log(`  Posibles causas:`);
      console.log(`  1. Las IPs tienen formato diferente (IPv4 vs IPv6)`);
      console.log(`  2. Los usuarios se suscribieron desde otra red`);
      console.log(`  3. Las IPs cambiaron (IP dinámica)`);
      
      console.log(`\n💡 Solución:`);
      console.log(`  Usar session_id en lugar de IP para vincular suscriptores.`);
    }

    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
}

debugSuscriptores();
