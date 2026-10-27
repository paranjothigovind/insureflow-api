pipeline {
    agent any

    tools {
        nodejs 'Node24'
    }

    options {
        timestamps()
        disableConcurrentBuilds()
    }

    environment {
        DATABASE_URL = 'postgresql://insureflow_app:ci_password@localhost:5432/insureflow?schema=public'
    }

    stages {
        stage('Environment Check') {
            steps {
                sh 'node --version'
                sh 'npm --version'
                sh 'git --version'
            }
        }

        stage('Install Dependencies') {
            steps {
                sh 'npm ci'
            }
        }

        stage('Generate Prisma Client') {
            steps {
                sh 'npx prisma generate'
            }
        }

        stage('Lint') {
            steps {
                sh 'npm run lint'
            }
        }

        stage('Test') {
            steps {
                sh 'npm test'
            }
        }

        stage('Build') {
            steps {
                sh 'npm run build'
            }
        }
    }

    post {
        success {
            echo 'InsureFlow CI passed! All pipeline stages succeeded.'
        }

        failure {
            echo 'InsureFlow CI failed. Check the stage logs above.'
        }

        always {
            echo 'InsureFlow CI pipeline finished.'
        }
    }
}