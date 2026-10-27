
pipeline {
    agent any

    tools {
        nodejs 'Node24'
    }

    options {
        timestamps()
        disableConcurrentBuilds()
    }

    stages {
        stage('Install Dependencies') {
            steps {
                bat 'npm ci'
            }
        }

        stage('Generate Prisma Client') {
            steps {
                bat 'npx prisma generate'
            }
        }

        stage('Lint') {
            steps {
                bat 'npm run lint'
            }
        }

        stage('Test') {
            steps {
                bat 'npm test'
            }
        }

        stage('Build') {
            steps {
                bat 'npm run build'
            }
        }
    }

    post {
        success {
            echo 'InsureFlow CI pipeline passed!'
        }
        failure {
            echo 'InsureFlow CI pipeline failed. Check the stage logs.'
        }
    }
}
