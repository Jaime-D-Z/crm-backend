#!/bin/bash

echo "🔧 Commiteando cambio de link..."

git add controllers/marketingController.js
git commit -m "fix: cambiar link de email de /ventas a /tienda para cupones"
git push origin main

echo "✅ Cambio pusheado!"
