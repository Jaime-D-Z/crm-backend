/**
 * Fix collation on proyectos + tareas_proyecto (blocked by FK).
 * Drops FK, converts both tables, re-adds FK.
 * Run: node database/fix-collation-proyectos.js
 */
require('dotenv').config();
const { query, verifyConnection } = require('../core/db');

async function run() {
    await verifyConnection();
    console.log('\n🔧 Fixing proyectos / tareas_proyecto collation...\n');

    // 1. Drop the foreign key on tareas_proyecto → proyectos
    try {
        await query('ALTER TABLE `tareas_proyecto` DROP FOREIGN KEY `tareas_proyecto_ibfk_1`');
        console.log('  ✔ Dropped FK tareas_proyecto_ibfk_1');
    } catch (e) {
        // Try alternate FK name
        try {
            const fks = await query(`
        SELECT CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS
        WHERE TABLE_NAME='tareas_proyecto' AND CONSTRAINT_TYPE='FOREIGN KEY'
      `);
            for (const fk of fks) {
                await query(`ALTER TABLE \`tareas_proyecto\` DROP FOREIGN KEY \`${fk.CONSTRAINT_NAME}\``);
                console.log('  ✔ Dropped FK', fk.CONSTRAINT_NAME);
            }
        } catch (e2) {
            console.log('  ⚠ Could not drop FK:', e2.message.slice(0, 80));
        }
    }

    // 2. Convert both tables
    for (const t of ['proyectos', 'tareas_proyecto']) {
        try {
            await query(`ALTER TABLE \`${t}\` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci`);
            console.log('  ✔ Converted:', t);
        } catch (e) {
            console.log('  ✘ Failed:', t, '-', e.message.slice(0, 80));
        }
    }

    // 3. Re-add FK
    try {
        await query(`
      ALTER TABLE \`tareas_proyecto\`
        ADD CONSTRAINT \`fk_tarea_proyecto\`
        FOREIGN KEY (\`proyecto_id\`) REFERENCES \`proyectos\`(\`id\`) ON DELETE CASCADE
    `);
        console.log('  ✔ Re-added FK tareas_proyecto → proyectos');
    } catch (e) {
        console.log('  ⚠ Could not re-add FK:', e.message.slice(0, 80));
    }

    console.log('\n✅ Done!\n');
    process.exit(0);
}

run().catch(err => { console.error(err); process.exit(1); });
