const { query } = require('../core/db');
const { v4: uuidv4 } = require('uuid');

class EvaluationModel {
  /** Create a performance evaluation */
  async create({ employeeId, evaluadorId, puntaje, comentario, fecha }) {
    const id = uuidv4();
    await query(
      `INSERT INTO evaluaciones_desempeno (id, employee_id, evaluador_id, puntaje, comentario, fecha, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,CURRENT_TIMESTAMP)`,
      [id, employeeId, evaluadorId, puntaje, comentario || null, fecha]
    );
    return this.findById(id);
  }

  async findById(id) {
    const rows = await query(
      `SELECT e.*, u.name AS evaluador_name
       FROM evaluaciones_desempeno e
       LEFT JOIN users u ON u.id = e.evaluador_id
       WHERE e.id = $1`,
      [id]
    );
    return rows[0] || null;
  }

  /** Get all evaluations for a specific employee, most recent first */
  async getByEmployee(employeeId) {
    return query(
      `SELECT e.*, u.name AS evaluador_name
       FROM evaluaciones_desempeno e
       LEFT JOIN users u ON u.id = e.evaluador_id
       WHERE e.employee_id = $1
       ORDER BY e.fecha DESC, e.created_at DESC`,
      [employeeId]
    );
  }

  /** Summary stats: average, best, worst, monthly trend */
  async getSummaryStats() {
    const [overall] = await query(`
      SELECT
        ROUND(AVG(puntaje),2) AS promedio_general,
        COUNT(*) AS total_evaluaciones
      FROM evaluaciones_desempeno
    `);

    const best = await query(`
      /* v2-fix-best */
      SELECT emp.name, ROUND(AVG(ev.puntaje),2) AS promedio
      FROM evaluaciones_desempeno ev
      JOIN employees emp ON emp.id = ev.employee_id
      GROUP BY ev.employee_id, emp.name
      ORDER BY promedio DESC
      LIMIT 1
    `);

    const worst = await query(`
      /* v2-fix-worst */
      SELECT emp.name, ROUND(AVG(ev.puntaje),2) AS promedio
      FROM evaluaciones_desempeno ev
      JOIN employees emp ON emp.id = ev.employee_id
      GROUP BY ev.employee_id, emp.name
      ORDER BY promedio ASC
      LIMIT 1
    `);

    const monthly = await query(`
      SELECT to_char(fecha,'YYYY-MM') AS mes, ROUND(AVG(puntaje),2) AS promedio
      FROM evaluaciones_desempeno
      WHERE fecha >= CURRENT_TIMESTAMP - (INTERVAL '1 month' * 6)
      GROUP BY mes
      ORDER BY mes ASC
    `);

    const byEmployee = await query(`
      /* v2-fix-byemployee */
      SELECT emp.id, emp.name, emp.employee_type, ROUND(AVG(ev.puntaje),2) AS promedio, COUNT(*) AS total
      FROM evaluaciones_desempeno ev
      JOIN employees emp ON emp.id = ev.employee_id
      GROUP BY ev.employee_id, emp.id, emp.name, emp.employee_type
      ORDER BY promedio DESC
    `);

    return {
      overall: overall || { promedio_general: 0, total_evaluaciones: 0 },
      mejor: best[0] || null,
      peor: worst[0] || null,
      monthly,
      byEmployee,
    };
  }
}

module.exports = new EvaluationModel();
