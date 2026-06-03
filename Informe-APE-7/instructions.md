# Guía operativa APE 7

## Alcance de la práctica
La práctica de APE 7 se resolverá con:

- **Jenkins** para automatizar el despliegue
- **Docker** para construir y ejecutar la aplicación
- **Docker Compose** para levantar el entorno controlado
- **Kubernetes** solo en la parte de investigación teórica

En esta práctica **no se va a desplegar Kubernetes**, porque en la guía aparece como opcional.

## Qué ya quedó preparado en el proyecto
Se añadieron estos archivos para que la práctica sea ejecutable:

- `deploy/jenkins.Dockerfile`
- `deploy/jenkins.plugins.txt`
- `docker-compose.jenkins.yml`
- `Jenkinsfile`

Con eso, Jenkins se ejecutará en Docker y podrá controlar Docker Compose del proyecto.

## Requisitos previos
Antes de empezar, verifica lo siguiente:

1. Docker Desktop está instalado y encendido.
2. Está activo el modo de contenedores Linux.
3. No hay nada usando estos puertos:
   - `8080` para Jenkins
   - `3000` para el frontend
   - `3001` para el backend
   - `5433` para PostgreSQL QA
4. El archivo `.env.qa` ya existe y funciona con el despliegue del proyecto.
5. El repositorio está actualizado localmente.

## Parte A. Levantar Jenkins en Docker

### Paso 1. Construir y levantar Jenkins
Desde la raíz del proyecto ejecuta:

```powershell
docker compose -f docker-compose.jenkins.yml up --build -d
```

Esto hará lo siguiente:
- construirá una imagen personalizada de Jenkins;
- instalará `docker-ce-cli` y `docker compose plugin` dentro del contenedor;
- instalará plugins básicos de pipeline y Git;
- levantará Jenkins en el puerto `8080`.

### Paso 2. Verificar que Jenkins quedó arriba
Ejecuta:

```powershell
docker ps
```

Debes ver un contenedor llamado:

```txt
saferidepro-jenkins
```

### Paso 3. Obtener la contraseña inicial
Ejecuta:

```powershell
docker exec saferidepro-jenkins cat /var/jenkins_home/secrets/initialAdminPassword
```

Copia la contraseña que aparezca.

### Paso 4. Entrar a Jenkins
Abre en el navegador:

```txt
http://localhost:8080
```

### Paso 5. Desbloquear Jenkins
- pega la contraseña inicial
- continúa

### Paso 6. Instalar plugins sugeridos
Cuando Jenkins pregunte:
- selecciona **Install suggested plugins**

Aunque ya hay plugins preinstalados en la imagen, esta opción deja el entorno más estable para la demostración.

### Paso 7. Crear usuario administrador
Cuando Jenkins lo solicite:
- crea un usuario administrador
- guarda usuario y contraseña

### Paso 8. Confirmar URL de Jenkins
Deja:

```txt
http://localhost:8080/
```

## Parte B. Crear el pipeline

### Paso 9. Crear un nuevo item
En Jenkins:

1. clic en **New Item**
2. nombre sugerido:

```txt
SafeRidePro-CI-CD
```

3. elige **Pipeline**
4. clic en **OK**

### Paso 10. Configurar el pipeline
En la pantalla de configuración:

- en **Definition** selecciona:

```txt
Pipeline script from SCM
```

- en **SCM** selecciona:

```txt
Git
```

- en **Repository URL** coloca la URL de tu repositorio GitHub

Ejemplo:

```txt
https://github.com/USUARIO/REPO.git
```

- si tu repo es privado, agrega credenciales de GitHub en Jenkins
- en **Branch Specifier** deja:

```txt
*/main
```

- en **Script Path** deja:

```txt
Jenkinsfile
```

### Paso 11. Guardar
Haz clic en **Save**.

## Parte C. Ejecutar el pipeline

### Paso 12. Lanzar el pipeline
Dentro del job:
- clic en **Build Now**

### Paso 13. Ver la ejecución
Entra al build más reciente y revisa:
- **Console Output**
- **Stage View**

El pipeline ejecuta estas etapas:

1. `Checkout`
2. `Verificar herramientas`
3. `Preparar entorno`
4. `Limpiar despliegue anterior`
5. `Construir imagenes`
6. `Levantar aplicacion`
7. `Validar backend`
8. `Validar frontend`

## Parte D. Validar que la aplicación quedó desplegada

### Paso 14. Verificar contenedores del sistema
Cuando el pipeline termine, ejecuta:

```powershell
docker ps
```

Debes ver activos:
- postgres QA
- api
- web
- jenkins

### Paso 15. Verificar healthchecks
Abre:

```txt
http://localhost:3001/api/health
```

y también:

```txt
http://localhost:3000/healthz
```

### Paso 16. Abrir la aplicación
Abre:

```txt
http://localhost:3000/login
```

### Paso 17. Iniciar sesión
Ingresa con una cuenta seed y entra a una vista operativa del sistema.

## Parte E. Evidencia que debes capturar
Guarda las capturas dentro de:

```txt
Informe-APE-7/Imagenes
```

Usa estos nombres exactos.

### 1. Preparación de Jenkins

`ape7_01_jenkins_compose_up.png`
- terminal ejecutando:
```powershell
docker compose -f docker-compose.jenkins.yml up --build -d
```

`ape7_02_jenkins_container_running.png`
- salida de `docker ps` mostrando `saferidepro-jenkins`

`ape7_03_jenkins_password.png`
- terminal mostrando el comando y la contraseña inicial

`ape7_04_jenkins_unlock.png`
- pantalla de desbloqueo de Jenkins en navegador

`ape7_05_jenkins_plugins.png`
- pantalla de instalación de plugins sugeridos

`ape7_06_jenkins_admin_user.png`
- pantalla de creación del usuario administrador

### 2. Creación del pipeline

`ape7_07_new_item_pipeline.png`
- pantalla de creación del nuevo pipeline

`ape7_08_pipeline_scm_config.png`
- configuración del pipeline desde SCM

`ape7_09_pipeline_jenkinsfile_path.png`
- misma configuración mostrando claramente `Script Path = Jenkinsfile`

### 3. Ejecución del pipeline

`ape7_10_pipeline_running.png`
- pipeline ejecutándose

`ape7_11_pipeline_stage_view_success.png`
- stage view o vista de etapas completadas correctamente

`ape7_12_pipeline_console_output.png`
- consola mostrando parte de la ejecución exitosa

### 4. Resultado del despliegue

`ape7_13_app_containers_running.png`
- salida de `docker ps` con jenkins + app containers

`ape7_14_api_health.png`
- navegador mostrando `http://localhost:3001/api/health`

`ape7_15_web_health.png`
- navegador mostrando `http://localhost:3000/healthz`

`ape7_16_login_publico.png`
- pantalla de login de SafeRidePro

`ape7_17_app_funcionando.png`
- vista autenticada del sistema ya desplegado por el pipeline

### 5. Evidencia opcional útil

`ape7_18_jenkinsfile_codigo.png`
- editor mostrando el archivo `Jenkinsfile`

`ape7_19_jenkins_logs_artifacts.png`
- artefactos del job o logs archivados en Jenkins

## Qué debes hacer si falla algo

### Si Jenkins no abre en `localhost:8080`
Ejecuta:

```powershell
docker logs saferidepro-jenkins
```

### Si el pipeline falla al construir
Revisa:
- `.env.qa`
- puertos ocupados
- que Docker Desktop esté encendido
- que el repositorio configurado en Jenkins sea correcto

### Si falla el acceso al repo privado
Debes agregar credenciales GitHub en Jenkins.

## Qué me debes entregar después
Cuando ya tengas las capturas:

1. colócalas en `Informe-APE-7/Imagenes`
2. dime que ya están listas

Después de eso yo hago:
- el informe completo en `APE7-Paredes_Steven.tex`
- la integración de todas las capturas
- la compilación final del PDF
