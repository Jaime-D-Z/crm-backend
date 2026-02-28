#!/bin/bash

echo "🔧 Arreglando problemas en producción..."
echo ""

# Colores
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Verificar directorio
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Error: No estás en el directorio del backend${NC}"
    echo "Ejecuta: cd /home/ubuntu/crm-backend"
    exit 1
fi

echo -e "${YELLOW}📥 Paso 1: Actualizando código...${NC}"
git pull origin main

echo ""
echo -e "${YELLOW}📦 Paso 2: Descargando modelos Face-API (7 archivos)...${NC}"
node scripts/download-face-models-fixed.js

echo ""
echo -e "${YELLOW}🗄️  Paso 3: Ejecutando migraciones...${NC}"
echo "  → Agregando face_descriptor a employees..."
node database/run-face-descriptor-employees.js

echo ""
echo -e "${YELLOW}📁 Paso 4: Verificando archivos...${NC}"
echo "Modelos descargados:"
ls -lh public/models/*.shard* | awk '{print "  " $9 " (" $5 ")"}'

echo ""
echo -e "${YELLOW}🔄 Paso 5: Reiniciando backend...${NC}"
pm2 restart crm-backend

echo ""
echo -e "${YELLOW}⏳ Esperando 3 segundos...${NC}"
sleep 3

echo ""
echo -e "${YELLOW}📋 Paso 6: Verificando logs...${NC}"
pm2 logs crm-backend --lines 15 --nostream | grep -E "Face API|error|Error" || echo "Sin errores visibles"

echo ""
echo -e "${GREEN}✅ Proceso completado!${NC}"
echo ""
echo "Verifica que veas en los logs:"
echo "  ✅ Face API Models loaded in Node.js"
echo ""
echo "Si no lo ves, ejecuta: pm2 logs crm-backend"
echo ""
echo "Ahora puedes:"
echo "  1. Crear empleados con foto"
echo "  2. Marcar asistencia con reconocimiento facial"
echo "  3. Emails similares (jaimet vs jaime) ya NO se bloquean"
