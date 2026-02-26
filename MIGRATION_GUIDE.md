# Guía de Migración: MySQL a PostgreSQL 🐘

Este backend ha sido migrado completamente de MySQL a PostgreSQL. A continuación se detallan los cambios realizados y los pasos necesarios para desplegar el sistema.

## 🛠 Cambios Realizados

1.  **Driver de Base de Datos**: Se reemplazó `mysql2` por `pg`.
2.  **Gestión de Sesiones**: Se reemplazó `express-mysql-session` por `connect-pg-simple`.
3.  **Sintaxis SQL**:
    *   Placeholders actualizados de `?` a `$1`, `$2`, etc.
    *   Tipos de datos: `AUTO_INCREMENT` → `SERIAL`/`BIGSERIAL`, `TINYINT(1)` → `BOOLEAN`, `DATETIME` → `TIMESTAMP`.
    *   Funciones: `NOW()` → `CURRENT_TIMESTAMP`, `CURDATE()` → `CURRENT_DATE`.
    *   Triggers: Se agregaron triggers para mantener la funcionalidad `ON UPDATE CURRENT_TIMESTAMP`.
4.  **Capa de Compatibilidad**: Se incluyó un mapeador automático en `core/db.js` que traduce `?` a `$` en caso de que alguna consulta heredada lo necesite.

## 🚀 Pasos para el Despliegue

### 1. Instalar Dependencias
Ejecuta el siguiente comando en la carpeta `backend/`:
```bash
npm install
```

### 2. Configurar el Entorno
Actualiza tu archivo `.env` con las credenciales de PostgreSQL (revisa el archivo [.env.example](file:///c:/Users/jaime/Desktop/node-mvc/backend/.env.example)):
```env
DB_HOST=localhost
DB_PORT=5432
DB_USER=tu_usuario
DB_PASS=tu_password
DB_NAME=crm_system
```

### 3. Ejecutar el Script de Base de Datos
Crea la base de datos y ejecuta el script [schema_pg.sql](file:///c:/Users/jaime/Desktop/node-mvc/backend/database/schema_pg.sql). Puedes usar `psql` o cualquier cliente como DBeaver o pgAdmin.

```bash
psql -U tu_usuario -d crm_system -f database/schema_pg.sql
```

## 📂 Archivos Clave
- Connection Logic: [db.js](file:///c:/Users/jaime/Desktop/node-mvc/backend/core/db.js)
- SQL Script: [schema_pg.sql](file:///c:/Users/jaime/Desktop/node-mvc/backend/database/schema_pg.sql)
- Session Config: [server.js](file:///c:/Users/jaime/Desktop/node-mvc/backend/server.js)

---
*Migración realizada con éxito por Antigravity.*
