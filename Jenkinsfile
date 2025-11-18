pipeline {
    agent {
        kubernetes {
            defaultContainer 'jnlp'
            yaml """
apiVersion: v1
kind: Pod
spec:
  serviceAccountName: jenkins-deployer
  containers:
    - name: kaniko
      image: gcr.io/kaniko-project/executor:debug
      command:
        - sh
        - -c
      args:
        - sleep 999d
      tty: true
      volumeMounts:
        - name: docker-config
          mountPath: /kaniko/.docker
    - name: kubectl
      image: bitnami/kubectl:latest
      command:
        - sh
        - -c
      args:
        - sleep 999d
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
                        echo "📝 Creating Docker config.json for GHCR auth..."

                        mkdir -p /kaniko/.docker

cat > /kaniko/.docker/config.json <<'EOF'
{
  "auths": {
    "ghcr.io": {
      "auth": "__AUTH_PLACEHOLDER__"
    }
  }
}
EOF

                        AUTH_B64=$(echo -n "${GHCR_USER}:${GHCR_PASS}" | base64 | tr -d '\\n')
                        sed -i "s/__AUTH_PLACEHOLDER__/${AUTH_B64}/" /kaniko/.docker/config.json

                        echo "✔ Docker config.json created."
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
                        /kaniko/executor \
                          --context . \
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
                        /kaniko/executor \
                          --context . \
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
                // Use the Jenkins "Secret file" credential (id: k3s-config)
                withCredentials([file(credentialsId: 'k3s-config', variable: 'K3S_KUBECONFIG')]) {
                    container('kubectl') {
                        sh '''
                        echo "🔐 Using Jenkins-provided kubeconfig from credential 'k3s-config'"

                        # ensure kube dir exists and copy kubeconfig
                        mkdir -p /root/.kube
                        chmod 700 /root/.kube
                        cp "${K3S_KUBECONFIG}" /root/.kube/config
                        chmod 600 /root/.kube/config
                        export KUBECONFIG=/root/.kube/config

                        echo "== kubectl version =="
                        kubectl version --client || true

                        echo "🚀 Deploying to Kubernetes (using provided kubeconfig)..."
                        kubectl apply -f canteen-automation-backend/deployment.yaml || true
                        kubectl apply -f Canteen-Automation-System-Website/deployment.yaml || true
                        '''
                    }
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
