pipeline {
    agent {
        kubernetes {
            defaultContainer 'jnlp'
            yaml """
apiVersion: v1
kind: Pod
spec:
  containers:
    - name: kaniko
      image: gcr.io/kaniko-project/executor:latest
      command:
        - cat
      tty: true
      volumeMounts:
        - name: docker-config
          mountPath: /kaniko/.docker
    - name: kubectl
      image: bitnami/kubectl:latest
      command:
        - cat
      tty: true
  volumes:
    - name: docker-config
      emptyDir: {}
"""
        }
    }

    environment {
        REGISTRY = "ghcr.io/gowthamlakshman94"
        FRONTEND_IMAGE = "${REGISTRY}/canteen-frontend:latest"
        BACKEND_IMAGE = "${REGISTRY}/canteen-backend:latest"
    }

    stages {
        stage('Checkout') {
            steps {
                git branch: 'main', url: 'https://github.com/gowthamlakshman94/Canteen-Automation-System.git'
            }
        }

        stage('Setup Docker Auth') {
            steps {
                withCredentials([usernamePassword(credentialsId: 'ghcr-token', usernameVariable: 'GHCR_USER', passwordVariable: 'GHCR_PASS')]) {
                    container('kaniko') {
                        sh '''
                        mkdir -p /kaniko/.docker
                        echo "{\"auths\":{\"ghcr.io\":{\"username\":\"${GHCR_USER}\",\"password\":\"${GHCR_PASS}\"}}}" > /kaniko/.docker/config.json
                        '''
                    }
                }
            }
        }

        stage('Build Frontend Image') {
            steps {
                container('kaniko') {
                    dir('Canteen-Automation-System-Website') {
                        sh '''
                        echo "🚀 Building and pushing Frontend image..."
                        /kaniko/executor --context . \
                          --dockerfile Dockerfile \
                          --destination=${FRONTEND_IMAGE} \
                          --verbosity info
                        '''
                    }
                }
            }
        }

        stage('Build Backend Image') {
            steps {
                container('kaniko') {
                    dir('canteen-automation-backend') {
                        sh '''
                        echo "🚀 Building and pushing Backend image..."
                        /kaniko/executor --context . \
                          --dockerfile Dockerfile \
                          --destination=${BACKEND_IMAGE} \
                          --verbosity info
                        '''
                    }
                }
            }
        }

        stage('Deploy to Kubernetes') {
            steps {
                container('kubectl') {
                    sh '''
                    echo "🚀 Deploying to Kubernetes..."
                    kubectl apply -f canteen-automation-backend/deployment.yaml || true
                    kubectl apply -f Canteen-Automation-System-Website/deployment.yaml || true
                    '''
                }
            }
        }
    }

    post {
        success {
            echo "✅ Build and deployment completed successfully!"
        }
        failure {
            echo "❌ Build or deployment failed!"
        }
    }
}
