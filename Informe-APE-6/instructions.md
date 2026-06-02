# Guía operativa APE 6

## Objetivo
Esta guía resume la ejecución práctica del deber APE 6 usando el stack real de SafeRidePro:

- PostgreSQL
- API NestJS
- Web Next.js
- Docker Compose
- Oracle Cloud Always Free

## Implantación local

### Preparación
1. Copiar el archivo base:
   ```powershell
   Copy-Item .env.qa.example .env.qa
   ```
2. Ajustar los valores necesarios en `.env.qa`.

### Levantar el sistema
```powershell
corepack pnpm qa:up:build
corepack pnpm qa:ps
```

### Validación
- `http://localhost:3000`
- `http://localhost:3001/api/health`
- `http://localhost:3000/healthz`

### Persistencia tras reinicio
Para que el entorno vuelva a levantarse tras reiniciar el equipo:
- Docker Desktop debe iniciar con Windows.
- Los servicios ya usan `restart: unless-stopped`.

## Implantación en Oracle Cloud Always Free

### Recursos a crear
- 1 VM Ubuntu Always Free
- Reglas de ingreso para:
  - 22
  - 3000
  - 3001

### Instalación base en la VM
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker $USER
```

Luego cerrar y reabrir la sesión SSH.

### Despliegue
1. Subir el proyecto a la VM.
2. Crear `.env.qa` en la raíz del proyecto.
3. Ajustar al menos:
   - `NEXT_PUBLIC_API_BASE_URL=http://IP_PUBLICA:3001/api`
   - `WEB_APP_ORIGINS=http://IP_PUBLICA:3000`
4. Levantar:
   ```bash
   docker compose --env-file .env.qa -f docker-compose.qa.yml up --build -d
   ```
5. Verificar:
   ```bash
   docker ps
   ```

### Validación
- `http://IP_PUBLICA:3000`
- `http://IP_PUBLICA:3001/api/health`

## Capturas obligatorias
Las capturas deben guardarse exactamente con estos nombres en `Informe-APE-6/Imagenes`:

### Local
- `ape6_local_01_env_qa.png`
  - abrir el archivo `.env.qa` en el editor
  - deben verse las variables principales del entorno Docker QA
  - deben ser visibles al menos estas claves:
    - `POSTGRES_DB`
    - `POSTGRES_USER`
    - `POSTGRES_PORT`
    - `API_PORT`
    - `WEB_PORT`
    - `NEXT_PUBLIC_API_BASE_URL`
    - `WEB_APP_ORIGINS`
  - si existen secretos reales, deben quedar tapados o censurados antes de guardar la captura
  - no mostrar otros archivos, solo el editor con `.env.qa`

- `ape6_local_02_levantar_stack.png`
  - abrir una terminal en la raíz del proyecto
  - ejecutar:
    ```powershell
    corepack pnpm qa:up:build
    ```
  - la captura debe mostrar:
    - el comando completo
    - el proceso de build/levantamiento
    - al menos el tramo final donde se vea que los servicios se están creando o iniciando
  - no cortar la parte superior de la terminal; debe verse que estás en la carpeta del proyecto

- `ape6_local_03_servicios_activos.png`
  - en la misma terminal ejecutar:
    ```powershell
    corepack pnpm qa:ps
    ```
    o
    ```powershell
    docker ps
    ```
  - deben verse claramente los contenedores de:
    - `postgres`
    - `api`
    - `web`
  - también debe verse el estado, por ejemplo `Up` o `healthy`
  - si usas `docker ps`, procura que se vean nombres, puertos y estado

- `ape6_local_04_health_api.png`
  - abrir el navegador en:
    - `http://localhost:3001/api/health`
  - debe verse:
    - la URL completa en la barra del navegador
    - la respuesta del healthcheck cargada correctamente
  - si la salida es JSON, dejar visible el cuerpo completo

- `ape6_local_05_login.png`
  - abrir el navegador en:
    - `http://localhost:3000`
  - debe verse la pantalla de login completa
  - deben verse:
    - logo o branding de SafeRidePro
    - campos de correo y contraseña
    - botón de inicio de sesión
    - la URL en la barra del navegador
  - no llenar todavía las credenciales en esta captura

- `ape6_local_06_sistema_funcionando.png`
  - iniciar sesión con una cuenta seed
  - entrar a una vista operativa clara, por ejemplo:
    - inicio
    - viajes
    - conductor
    - billetera
  - la captura debe demostrar que el sistema ya está autenticado y funcionando
  - deben verse:
    - navbar o menú autenticado
    - nombre del usuario o avatar
    - contenido principal de una vista funcional

- `ape6_local_07_reinicio_o_persistencia.png`
  - reiniciar Docker Desktop o reiniciar el equipo
  - luego abrir terminal y ejecutar:
    ```powershell
    corepack pnpm qa:ps
    ```
    o
    ```powershell
    docker ps
    ```
  - la captura debe mostrar que los contenedores volvieron a quedar activos después del reinicio
  - si puedes, incluye también el ícono o ventana de Docker ya abierto para reforzar la evidencia

### Nube
- `ape6_nube_01_instancia_oracle.png`
  - abrir el panel de Oracle Cloud
  - ir a la sección de instancias o compute
  - debe verse:
    - nombre de la VM
    - estado `Running` o equivalente
    - sistema operativo Ubuntu
    - tipo Always Free si Oracle lo muestra en pantalla
    - IP pública o referencia a red si está visible

- `ape6_nube_02_reglas_red.png`
  - abrir la configuración de red o security list / ingress rules
  - deben verse reglas para:
    - puerto `22`
    - puerto `3000`
    - puerto `3001`
  - si Oracle muestra rango de origen, protocolo y puerto, deben verse completos
  - esta captura debe probar que el acceso externo fue configurado y no solo asumido

- `ape6_nube_03_ssh_vm.png`
  - abrir terminal conectada por SSH a la VM
  - la captura debe mostrar:
    - el comando SSH usado o una sesión ya abierta
    - el prompt de Ubuntu dentro de la instancia
    - alguna evidencia del usuario y host remoto, por ejemplo `ubuntu@...`

- `ape6_nube_04_docker_instalado.png`
  - dentro de la VM ejecutar:
    ```bash
    docker --version
    docker compose version
    ```
  - la captura debe mostrar ambas salidas completas
  - debe quedar claro que Docker y Compose están realmente instalados en la VM

- `ape6_nube_05_archivo_env.png`
  - abrir `.env.qa` en la VM con `nano`, `vim`, `cat` o un editor remoto
  - deben verse al menos estas variables:
    - `API_PORT`
    - `WEB_PORT`
    - `NEXT_PUBLIC_API_BASE_URL`
    - `WEB_APP_ORIGINS`
  - debe notarse que las URLs usan la IP pública de la VM
  - ocultar cualquier secreto real antes de guardar la captura

- `ape6_nube_06_levantar_stack.png`
  - en la VM ejecutar:
    ```bash
    docker compose --env-file .env.qa -f docker-compose.qa.yml up --build -d
    ```
  - la captura debe mostrar:
    - el comando exacto
    - el proceso de build/creación
    - la salida final indicando que los servicios fueron creados o iniciados

- `ape6_nube_07_contenedores_activos.png`
  - en la VM ejecutar:
    ```bash
    docker ps
    ```
  - deben verse los tres contenedores principales:
    - base de datos
    - API
    - Web
  - deben apreciarse nombres, puertos y estado

- `ape6_nube_08_health_api.png`
  - abrir desde el navegador local:
    - `http://IP_PUBLICA:3001/api/health`
  - debe verse:
    - la IP pública completa en la barra
    - la respuesta del healthcheck del API
  - si el navegador muestra JSON, dejarlo visible

- `ape6_nube_09_login_publico.png`
  - abrir desde el navegador local:
    - `http://IP_PUBLICA:3000`
  - debe verse la pantalla pública de login del sistema cargada desde la nube
  - deben verse:
    - la IP pública en la barra
    - branding de SafeRidePro
    - formulario de inicio de sesión

- `ape6_nube_10_sistema_funcionando.png`
  - iniciar sesión en la instancia publicada
  - abrir una vista funcional del sistema, igual que en local
  - deben verse:
    - menú autenticado
    - contenido real de una vista
    - evidencia de que no es local sino el sistema publicado por IP pública

### Opcionales
- `ape6_local_08_logs_stack.png`
  - ejecutar:
    ```powershell
    corepack pnpm qa:logs
    ```
    o
    ```powershell
    docker compose --env-file .env.qa -f docker-compose.qa.yml logs
    ```
  - la captura debe mostrar logs de los servicios del stack local

- `ape6_nube_11_logs_stack.png`
  - en la VM ejecutar:
    ```bash
    docker compose --env-file .env.qa -f docker-compose.qa.yml logs
    ```
  - la captura debe mostrar logs del stack desplegado en Oracle Cloud

## Alcance declarado
- Sí se implanta:
  - web
  - api
  - base de datos
- No se implanta:
  - `apps/mobile` como producto operativo

## Observación importante
No se deben mostrar secretos reales en capturas del archivo `.env.qa`. Si hay credenciales visibles, deben ocultarse antes de exportar la imagen.
