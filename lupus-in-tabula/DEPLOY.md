# Deploy Lupus in Tabula su Ubuntu (Produzione)

Questa guida spiega come fare il deploy su `itisgrassi.vps.webdock.cloud/lupus`.

## Prerequisiti

- Ubuntu 22.04+ con accesso root/sudo
- Nginx installato
- Python 3.11+
- Node.js 18+

```bash
sudo apt update && sudo apt install -y nginx python3 python3-pip python3-venv nodejs npm
```

## 1. Clona il repository

```bash
cd /var/www
sudo git clone <repo-url> lupus-in-tabula
sudo chown -R $USER:$USER lupus-in-tabula
cd lupus-in-tabula
```

## 2. Setup Backend

```bash
cd /var/www/lupus-in-tabula/backend

# Crea virtual environment
python3 -m venv venv
source venv/bin/activate

# Installa dipendenze
pip install -r requirements.txt
```

### Crea il servizio systemd

```bash
sudo nano /etc/systemd/system/lupus-backend.service
```

Contenuto:

```ini
[Unit]
Description=Lupus in Tabula Backend
After=network.target

[Service]
User=www-data
Group=www-data
WorkingDirectory=/var/www/lupus-in-tabula/backend
Environment="ENV=production"
ExecStart=/var/www/lupus-in-tabula/backend/venv/bin/uvicorn main:app --host 127.0.0.1 --port 8000
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

Attiva e avvia:

```bash
sudo chown -R www-data:www-data /var/www/lupus-in-tabula/backend
sudo systemctl daemon-reload
sudo systemctl enable lupus-backend
sudo systemctl start lupus-backend
sudo systemctl status lupus-backend
```

## 3. Build Frontend

```bash
cd /var/www/lupus-in-tabula/frontend

# Installa dipendenze
npm install

# Build per produzione (usa .env.production automaticamente)
npm run build
```

I file statici saranno in `dist/`.

## 4. Configura Nginx

```bash
sudo nano /etc/nginx/sites-available/lupus
```

Contenuto:

```nginx
# Aggiungi questo al tuo server block esistente (itisgrassi.vps.webdock.cloud)
# oppure crea un nuovo file se necessario

location /lupus/ {
    alias /var/www/lupus-in-tabula/frontend/dist/;
    try_files $uri $uri/ /lupus/index.html;
}

location /lupus/api/ {
    proxy_pass http://127.0.0.1:8000/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Cookie $http_cookie;
    proxy_pass_header Set-Cookie;
}
```

Se hai già un file di configurazione per il dominio, aggiungi questi due blocchi `location` dentro il blocco `server {}` esistente.

Abilita e testa:

```bash
# Se hai creato un nuovo file:
sudo ln -s /etc/nginx/sites-available/lupus /etc/nginx/sites-enabled/

# Testa la configurazione
sudo nginx -t

# Ricarica nginx
sudo systemctl reload nginx
```

## 5. Fix Permessi

```bash
sudo chown -R www-data:www-data /var/www/lupus-in-tabula
sudo chmod -R 755 /var/www/lupus-in-tabula
```

## 6. Verifica

- Frontend: https://itisgrassi.vps.webdock.cloud/lupus/
- API Health: https://itisgrassi.vps.webdock.cloud/lupus/api/docs

## Comandi Utili

```bash
# Logs del backend
sudo journalctl -u lupus-backend -f

# Restart backend
sudo systemctl restart lupus-backend

# Rebuild frontend dopo modifiche
cd /var/www/lupus-in-tabula/frontend && npm run build

# Status servizi
sudo systemctl status lupus-backend
sudo systemctl status nginx
```

## Troubleshooting

### Errore CORS
Verifica che `ENV=production` sia impostato nel servizio systemd.

### 502 Bad Gateway
Il backend non è in esecuzione:
```bash
sudo systemctl status lupus-backend
sudo journalctl -u lupus-backend -n 50
```

### 404 sulle route React
Verifica che `try_files` in Nginx punti a `/lupus/index.html`.

### Cookie non funzionano
Assicurati che il sito usi HTTPS e che i proxy header siano configurati correttamente.

---

## Sviluppo Locale

Per lo sviluppo locale, usa semplicemente:

```bash
# Terminal 1 - Backend
cd backend
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload

# Terminal 2 - Frontend
cd frontend
npm install
npm run dev
```

Il frontend sarà su `http://localhost:5173` e userà il proxy verso `localhost:8000`.
