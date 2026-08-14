# ZonaFit — Rollback Procedure
# Use only if a deployment fails and the system needs to be reverted.
# ============================================================

## WHEN TO ROLLBACK

Execute this procedure if:
- Backend fails to start after deploy
- Alembic migration caused data corruption
- Critical bug detected in production affecting real users
- Frontend is broken and cannot be served

---

## PASO 1 — DETENER SERVICIO NUEVO

```bash
sudo systemctl stop zonafit-backend
```

---

## PASO 2 — RESTAURAR BACKUP DE BASE DE DATOS (si hay corrupción de datos)

**SOLO si hubo una migración que alteró datos de forma irreversible.**
En caso de simple rollback de código sin cambios de schema, omitir este paso.

```bash
# Identificar backup más reciente
ls -lt /var/backups/zonafit/*.sql.gz | head -5

# Restaurar sobre una BD temporal primero para verificar integridad
createdb -U postgres zonafit_restore_test
zcat /var/backups/zonafit/zonafit_BACKUP_A_USAR.sql.gz | psql -U zonafit_app zonafit_restore_test

# Verificar integridad
psql -U zonafit_app zonafit_restore_test -c "SELECT COUNT(*) FROM clients;"
psql -U zonafit_app zonafit_restore_test -c "SELECT COUNT(*) FROM gyms;"

# Si OK, restaurar en la BD real
# ADVERTENCIA: Esto borra y reemplaza todos los datos actuales
dropdb -U postgres zonafit_db
createdb -U postgres zonafit_db ENCODING 'UTF8'
GRANT ALL PRIVILEGES ON DATABASE zonafit_db TO zonafit_app;
zcat /var/backups/zonafit/zonafit_BACKUP_A_USAR.sql.gz | psql -U zonafit_app zonafit_db
```

---

## PASO 3 — REVERTIR CÓDIGO

```bash
cd /srv/zonafit

# Ver historial de deploys (si usas git tags o releases)
git log --oneline -10

# Volver a la versión anterior
git checkout COMMIT_O_TAG_ANTERIOR

# o con git stash si hay cambios locales
git stash
git checkout COMMIT_O_TAG_ANTERIOR
```

---

## PASO 4 — REINSTALAR DEPENDENCIAS (si cambiaron)

```bash
cd /srv/zonafit/backend
source venv/bin/activate
pip install -r requirements.txt
```

---

## PASO 5 — VERIFICAR ALEMBIC

```bash
cd /srv/zonafit/backend
source venv/bin/activate
alembic current
# Debe coincidir con el estado anterior al deploy fallido
```

Si hay migración fallida, ejecutar downgrade solo si es seguro:
```bash
# SOLO si la migración es reversible y NO borra datos
alembic downgrade -1
```

---

## PASO 6 — REINICIAR SERVICIO

```bash
sudo systemctl start zonafit-backend
sudo systemctl status zonafit-backend

# Verificar health
curl http://127.0.0.1:8000/health
curl http://127.0.0.1:8000/readiness
```

---

## PASO 7 — RECOMPILAR FRONTEND (versión anterior)

```bash
cd /srv/zonafit/frontend
npm install
npm run build
sudo systemctl reload nginx
```

---

## PASO 8 — VERIFICAR

```bash
curl https://api.zonafit.tu-dominio.com/health
curl -I https://app.zonafit.tu-dominio.com
```

---

## COMUNICACIÓN

- Notificar al equipo inmediatamente
- Documentar en el log de incidentes: fecha, hora, causa, acción tomada, restauración
- Si se restauró un backup: listar qué datos pueden haberse perdido (ventana de tiempo)
