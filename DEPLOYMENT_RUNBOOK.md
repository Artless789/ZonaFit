# ZonaFit — Production Deployment Runbook
# Release Candidate Procedure — Bloque 38.12
# ============================================================
# DO NOT EXECUTE ON PRODUCTION UNTIL ALL RC CHECKS ARE GREEN.
# This document describes the exact steps to go from zero to
# a live ZonaFit production instance.
# ============================================================

## PREREQUISITOS

- VPS o instancia cloud (Ubuntu 22.04+ recomendado)
- Dominio apuntado (DNS A record → IP del servidor)
- Acceso SSH al servidor
- PostgreSQL 14+ instalado o acceso a instancia administrada (RDS, Supabase, etc.)
- Python 3.11+
- Node.js 20+
- Nginx (reverse proxy)
- Certbot (HTTPS con Let's Encrypt)

---

## PASO 1 — POSTGRESQL

```bash
# Crear base de datos y usuario dedicado
sudo -u postgres psql
CREATE DATABASE zonafit_db ENCODING 'UTF8' LC_COLLATE 'en_US.UTF-8' LC_CTYPE 'en_US.UTF-8';
CREATE USER zonafit_app WITH PASSWORD 'CONTRASEÑA_FUERTE_AQUI';
GRANT ALL PRIVILEGES ON DATABASE zonafit_db TO zonafit_app;
\q

# Verificar timezone
psql -U zonafit_app -d zonafit_db -c "SHOW timezone;"
# Debe ser UTC. Si no:
ALTER DATABASE zonafit_db SET timezone TO 'UTC';
```

---

## PASO 2 — CLONAR / SUBIR CÓDIGO

```bash
# En el servidor
git clone https://github.com/TU_ORG/zonafit.git /srv/zonafit
# o subir vía rsync / scp desde el equipo local
```

---

## PASO 3 — BACKEND — VARIABLES DE ENTORNO

```bash
cp /srv/zonafit/backend/.env.example /srv/zonafit/backend/.env
nano /srv/zonafit/backend/.env
```

Rellenar con valores REALES de producción:
- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`
- `SECRET_KEY` — generar con: `python3 -c "import secrets; print(secrets.token_hex(64))"`
- `ALGORITHM=HS256`
- `ACCESS_TOKEN_EXPIRE_MINUTES=60`
- `TOKEN_EXPIRATION_MINUTES=60`
- `ENVIRONMENT=production`
- `FRONTEND_URL=https://app.zonafit.tu-dominio.com`
- `FRONTEND_URLS=https://app.zonafit.tu-dominio.com`
- `WOMPI_ENVIRONMENT=SANDBOX` (mantener SANDBOX hasta aprobación comercial)
- `WOMPI_PUBLIC_KEY`, `WOMPI_PRIVATE_KEY`, `WOMPI_EVENTS_SECRET`, `WOMPI_INTEGRITY_SECRET`
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM_EMAIL`
- `SQL_ECHO=false`

---

## PASO 4 — BACKEND — ENTORNO VIRTUAL E INSTALACIÓN

```bash
cd /srv/zonafit/backend
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
```

---

## PASO 5 — ALEMBIC — MIGRACIONES

```bash
cd /srv/zonafit/backend
source venv/bin/activate

# Verificar que hay una sola cabeza
alembic heads
# Debe mostrar exactamente UNA revisión (head)

# Verificar estado actual vs DB
alembic current

# Aplicar migraciones
alembic upgrade head

# Verificar éxito
alembic current
# Debe coincidir con alembic heads
```

**IMPORTANTE**: Si la BD está vacía, alembic creará todas las tablas y aplicará RLS desde la primera migración.

---

## PASO 6 — CREAR SUPERADMIN INICIAL

```bash
cd /srv/zonafit/backend
source venv/bin/activate
python create_sa.py
# Seguir las instrucciones. Solo ejecutar UNA vez.
```

---

## PASO 7 — VERIFICAR RLS

```bash
cd /srv/zonafit/backend
source venv/bin/activate
python scratch/rls_test.py
# Todos los checks deben ser PASS REAL
```

---

## PASO 8 — BACKEND — SERVICIO SYSTEMD

```bash
# /etc/systemd/system/zonafit-backend.service
sudo nano /etc/systemd/system/zonafit-backend.service
```

Contenido del servicio:
```ini
[Unit]
Description=ZonaFit Backend API
After=network.target postgresql.service

[Service]
User=www-data
WorkingDirectory=/srv/zonafit/backend
EnvironmentFile=/srv/zonafit/backend/.env
ExecStart=/srv/zonafit/backend/venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000 --workers 2
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable zonafit-backend
sudo systemctl start zonafit-backend
sudo systemctl status zonafit-backend

# Verificar health
curl http://127.0.0.1:8000/health
curl http://127.0.0.1:8000/readiness
```

**NOTA**: `--reload` NO se usa en producción. Workers se fija según CPUs disponibles (2 × CPUs + 1).

---

## PASO 9 — FRONTEND — BUILD

```bash
cd /srv/zonafit/frontend
cp .env.example .env
# Editar .env:
# VITE_API_URL=https://api.zonafit.tu-dominio.com

npm install
npm run build
# El output queda en frontend/dist/
```

Verificar que ningún archivo en `dist/` contenga `localhost`:
```bash
grep -r "localhost" dist/ --include="*.js" | head -5
# No debe aparecer nada
```

---

## PASO 10 — NGINX

```bash
sudo nano /etc/nginx/sites-available/zonafit
```

Contenido:
```nginx
server {
    listen 80;
    server_name app.zonafit.tu-dominio.com api.zonafit.tu-dominio.com;
    return 301 https://$host$request_uri;
}

# Frontend
server {
    listen 443 ssl http2;
    server_name app.zonafit.tu-dominio.com;

    ssl_certificate /etc/letsencrypt/live/app.zonafit.tu-dominio.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/app.zonafit.tu-dominio.com/privkey.pem;

    root /srv/zonafit/frontend/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location ~* \.(js|css|woff2?|png|jpg|svg|ico)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}

# Backend API
server {
    listen 443 ssl http2;
    server_name api.zonafit.tu-dominio.com;

    ssl_certificate /etc/letsencrypt/live/api.zonafit.tu-dominio.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.zonafit.tu-dominio.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/zonafit /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## PASO 11 — HTTPS CON CERTBOT

```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d app.zonafit.tu-dominio.com -d api.zonafit.tu-dominio.com
# Seguir el asistente. Seleccionar renovación automática.

# Verificar renovación automática:
sudo systemctl status certbot.timer
```

---

## PASO 12 — SMTP

Verificar enviando un correo de prueba desde consola Python:
```bash
python3 -c "
import smtplib
from email.message import EmailMessage
msg = EmailMessage()
msg['Subject'] = 'ZonaFit SMTP Test'
msg['From'] = 'noreply@zonafit.com'
msg['To'] = 'TU_EMAIL@gmail.com'
msg.set_content('SMTP funcionando correctamente.')
with smtplib.SMTP('smtp.mailgun.org', 587) as s:
    s.starttls()
    s.login('postmaster@TU_DOMINIO', 'TU_PASSWORD')
    s.send_message(msg)
print('Email enviado correctamente.')
"
```

---

## PASO 13 — WOMPI SANDBOX

1. Ir a https://comercios.wompi.co/ → Entorno Sandbox
2. Obtener: `pub_test_*`, `prv_test_*`, `events_test_*`, `integrity_test_*`
3. Colocar en `.env` de backend
4. Configurar webhook URL: `https://api.zonafit.tu-dominio.com/subscriptions/webhook/wompi`
5. Probar con tarjeta de prueba: `4242 4242 4242 4242`, exp cualquier futura, cvv `123`

---

## PASO 14 — BACKUPS POSTGRESQL

```bash
# Crear script de backup
cat > /srv/zonafit/scripts/backup.sh << 'EOF'
#!/bin/bash
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR=/var/backups/zonafit
mkdir -p $BACKUP_DIR
pg_dump -U zonafit_app -h localhost zonafit_db | gzip > $BACKUP_DIR/zonafit_$TIMESTAMP.sql.gz
# Retener solo los últimos 30 días
find $BACKUP_DIR -name "*.sql.gz" -mtime +30 -delete
echo "Backup completado: zonafit_$TIMESTAMP.sql.gz"
EOF

chmod +x /srv/zonafit/scripts/backup.sh

# Configurar cron diario (3 AM)
echo "0 3 * * * www-data /srv/zonafit/scripts/backup.sh >> /var/log/zonafit_backup.log 2>&1" | sudo tee -a /etc/cron.d/zonafit-backup
```

---

## PASO 15 — SMOKE TESTS POST-DEPLOY

```bash
# Health
curl https://api.zonafit.tu-dominio.com/health
# → {"status":"ok","service":"zonafit-api"}

# Readiness
curl https://api.zonafit.tu-dominio.com/readiness
# → {"status":"ready","db":"ok"}

# OpenAPI docs (verificar que respondan)
curl https://api.zonafit.tu-dominio.com/docs

# Frontend
curl -I https://app.zonafit.tu-dominio.com
# → HTTP/2 200

# Login test
curl -X POST https://api.zonafit.tu-dominio.com/auth/login \
  -F "username=SUPERADMIN_EMAIL" -F "password=SUPERADMIN_PASS"
```
