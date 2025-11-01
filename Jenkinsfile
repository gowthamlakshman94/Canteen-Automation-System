pipeline {
    agent any

    environment {
        REGISTRY = "ghcr.io/gowthamlakshman94"
        FRONTEND_IMAGE = "${REGISTRY}/canteen-frontend"
        BACKEND_IMAGE = "${REGISTRY}/canteen-backend"
        KUBECONFIG_PATH = "/etc/rancher/k3s/k3s.yaml"
    }

    stages {

        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Build Frontend Image') {
            steps {
                dir('Canteen-Automation-System-Website') {
                    sh 'docker build -t $FRONTEND_IMAGE:latest .'
                }
            }
        }

        stage('Build Backend Image') {
            steps {
                dir('canteen-automation-backend') {
                    sh 'docker build -t $BACKEND_IMAGE:latest .'
                }
            }
        }

        stage('Push Images') {
            steps {
                withCredentials([string(credentialsId: 'ghcr-token', variable: 'TOKEN')]) {
                    sh '''
                      echo $TOKEN | docker login ghcr.io -u gowthamlakshman94 --password-stdin
                      docker push $FRONTEND_IMAGE:latest
                      docker push $BACKEND_IMAGE:latest
                    '''
                }
            }
        }

        stage('Deploy to Kubernetes') {
            steps {
                withKubeConfig([credentialsId: 'k3s-config']) {
                    sh '''
                    kubectl set image deployment/frontend-deployment frontend=$FRONTEND_IMAGE:latest -n canteen-automation --record || true
                    kubectl set image deployment/backend-deployment backend=$BACKEND_IMAGE:latest -n canteen-automation --record || true
                    kubectl rollout restart deployment/frontend-deployment -n canteen-automation || true
                    kubectl rollout restart deployment/backend-deployment -n canteen-automation || true
                    '''
                }
            }
        }
    }
}
