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
        sh '''
          test -f "$QA_ENV_FILE"
          test -f "$QA_COMPOSE_FILE"
        '''
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
          docker compose --env-file "$QA_ENV_FILE" -f "$QA_COMPOSE_FILE" exec -T api wget -qO- http://127.0.0.1:3001/api/health
        '''
      }
    }

    stage('Validar frontend') {
      steps {
        sh '''
          docker compose --env-file "$QA_ENV_FILE" -f "$QA_COMPOSE_FILE" exec -T web wget -qO- http://127.0.0.1:3000/healthz
        '''
      }
    }
  }

  post {
    always {
      sh '''
        docker compose --env-file "$QA_ENV_FILE" -f "$QA_COMPOSE_FILE" ps > jenkins-compose-ps.txt || true
        docker compose --env-file "$QA_ENV_FILE" -f "$QA_COMPOSE_FILE" logs --no-color > jenkins-compose-logs.txt || true
      '''
      archiveArtifacts artifacts: 'jenkins-compose-ps.txt, jenkins-compose-logs.txt', allowEmptyArchive: true
    }
  }
}
