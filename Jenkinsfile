pipeline {
  agent any

  options {
    timestamps()
    disableConcurrentBuilds()
  }

  environment {
    QA_ENV_FILE = '.env.qa'
    QA_COMPOSE_FILE = 'docker-compose.qa.yml'
  }

  stages {
    stage('Checkout') {
      steps {
        checkout scm
      }
    }

    stage('Verificar herramientas') {
      steps {
        sh 'docker version'
        sh 'docker compose version'
      }
    }

    stage('Preparar entorno') {
      steps {
        withCredentials([file(credentialsId: 'env-qa', variable: 'ENV_QA_FILE')]) {
          sh '''
            cp "$ENV_QA_FILE" "$QA_ENV_FILE"

            test -f "$QA_ENV_FILE"
            test -f "$QA_COMPOSE_FILE"

            echo "Archivo de entorno QA cargado correctamente"
          '''
        }
      }
    }

    stage('Limpiar despliegue anterior') {
      steps {
        sh '''
          docker compose --env-file "$QA_ENV_FILE" -f "$QA_COMPOSE_FILE" down -v || true
        '''
      }
    }

    stage('Construir imagenes') {
      steps {
        sh '''
          docker compose --env-file "$QA_ENV_FILE" -f "$QA_COMPOSE_FILE" build
        '''
      }
    }

    stage('Levantar aplicacion') {
      steps {
        sh '''
          docker compose --env-file "$QA_ENV_FILE" -f "$QA_COMPOSE_FILE" up -d
        '''
      }
    }

    stage('Validar backend') {
      steps {
        sh '''
          for i in $(seq 1 30); do
            if docker compose --env-file "$QA_ENV_FILE" -f "$QA_COMPOSE_FILE" exec -T api wget -qO- http://127.0.0.1:3001/api/health; then
              echo "Backend OK"
              exit 0
            fi

            echo "Esperando backend... intento $i/30"
            sleep 2
          done

          echo "Backend no respondió a tiempo"
          docker compose --env-file "$QA_ENV_FILE" -f "$QA_COMPOSE_FILE" logs --no-color api
          exit 1
        '''
      }
    }

    stage('Validar frontend') {
      steps {
        sh '''
          for i in $(seq 1 30); do
            if docker compose --env-file "$QA_ENV_FILE" -f "$QA_COMPOSE_FILE" exec -T web wget -qO- http://127.0.0.1:3000/healthz; then
              echo "Frontend OK"
              exit 0
            fi

            echo "Esperando frontend... intento $i/30"
            sleep 2
          done

          echo "Frontend no respondió a tiempo"
          docker compose --env-file "$QA_ENV_FILE" -f "$QA_COMPOSE_FILE" logs --no-color web
          exit 1
        '''
      }
    }
  }

  post {
    always {
      sh '''
        if [ -f "$QA_COMPOSE_FILE" ]; then
          docker compose --env-file "$QA_ENV_FILE" -f "$QA_COMPOSE_FILE" ps > jenkins-compose-ps.txt || true
          docker compose --env-file "$QA_ENV_FILE" -f "$QA_COMPOSE_FILE" logs --no-color > jenkins-compose-logs.txt || true
        else
          echo "No existe $QA_COMPOSE_FILE" > jenkins-compose-ps.txt
          echo "No existe $QA_COMPOSE_FILE" > jenkins-compose-logs.txt
        fi
      '''

      archiveArtifacts artifacts: 'jenkins-compose-ps.txt, jenkins-compose-logs.txt', allowEmptyArchive: true
    }
  }
}