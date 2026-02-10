#!/bin/bash
# Setup script for Lupus in Tabula

set -e
DIR="$(cd "$(dirname "$0")" && pwd)"

echo "=== Lupus in Tabula – Setup ==="

# Backend
echo ""
echo "→ Setting up backend..."
cd "$DIR/backend"
if [ ! -d "venv" ]; then
  python3 -m venv venv
fi
source venv/bin/activate
pip install -q -r requirements.txt
echo "  ✅ Backend ready"

# Frontend
echo ""
echo "→ Setting up frontend..."
cd "$DIR/frontend"
npm install --silent
echo "  ✅ Frontend ready"

echo ""
echo "=== Setup completo! ==="
echo ""
echo "Per avviare:"
echo "  Terminal 1 (Backend):   cd backend && source venv/bin/activate && python main.py"
echo "  Terminal 2 (Frontend):  cd frontend && npm run dev"
echo ""
echo "Poi apri http://localhost:5173"
