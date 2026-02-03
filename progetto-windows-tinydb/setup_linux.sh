echo Setup iniziale Linux x64

echo Installazione NVM
wget -qO- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
exec bash
nvm install node

echo Eliminazione, se presente, del Virtual Enviorment
if [ -d "venv" ]; then
  rm -r venv
fi

echo Creazione del Virtual Enviorment
python3 -m venv venv
source venv/bin/activate

echo Installazione Librerie
pip install fastapi uvicorn

read -p "Finito. Premi INVIO per uscire!"