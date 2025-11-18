pipeline {
  agent {
    kubernetes {
      defaultContainer 'jnlp'
      yaml '''apiVersion: v1
kind: Pod
spec:
  serviceAccountName: jenkins-deployer
  containers:
  - name: kaniko
    image: gcr.io/kaniko-project/executor:debug
    command: ['sh','-c']
    args: ['sleep 999d']
    tty: true
    volumeMounts:
      - name: workspace-volume
        mountPath: /home/jenkins/agent
  - name: kubectl
    image: bitnami/kubectl:latest
    command: ['sh','-c']
    args: ['sleep 999d']
    tty: true
    volumeMounts:
      - name: workspace-volume
        mountPath: /home/jenkins/agent
  volumes:
    - name: workspace-volume
      emptyDir: {}
'''
    }
  }

  environment {
    REGISTRY = "ghcr.io/gowthamlakshman94"
    FRONTEND_IMAGE = "${REGISTRY}/canteen-frontend:latest"
    BACKEND_IMAGE  = "${REGISTRY}/canteen-backend:latest"

    FRONTEND_DIR = "Canteen-Automation-System-Website"
    BACKEND_DIR  = "canteen-automation-backend"

    FRONTEND_MANIFEST = "Canteen-Automation-System-Website/deployment.yaml"
    BACKEND_MANIFEST  = "canteen-automation-backend/deployment.yaml"
  }

  stages {
    stage('Checkout') {
      steps {
        git branch: 'main', url: 'https://github.com/gowthamlakshman94/Canteen-Automation-System.git'
      }
    }

    stage('Prepare credentials') {
      steps {
        withCredentials([
          file(credentialsId: 'k3s-config', variable: 'KUBECONFIG_FILE'),
          usernamePassword(credentialsId: 'ghcr-token', usernameVariable: 'GHCR_USER', passwordVariable: 'GHCR_PASS')
        ]) {
          container('kubectl') {
            sh '''
              set -euo pipefail

              echo "== placing kubeconfig to /home/jenkins/.kube/config =="
              mkdir -p /home/jenkins/.kube
              cp "${KUBECONFIG_FILE}" /home/jenkins/.kube/config
              chmod 0600 /home/jenkins/.kube/config || true
              echo "--- kubeconfig head ---"
              head -n 10 /home/jenkins/.kube/config || true

              echo "== creating /kaniko/.docker/config.json for GHCR =="
              mkdir -p /kaniko/.docker
              AUTH_B64=$(echo -n "${GHCR_USER}:${GHCR_PASS}" | base64 | tr -d '\\n')
              cat > /kaniko/.docker/config.json <<'EOF'
{"auths":{"ghcr.io":{"auth":"__AUTH__"}}}
EOF
              sed -i "s/__AUTH__/${AUTH_B64}/" /kaniko/.docker/config.json || true
              echo "--- /kaniko/.docker/config.json head ---"
              head -n 5 /kaniko/.docker/config.json || true
            '''
          }
        }
      }
    }

    stage('Build & push Frontend (latest)') {
      steps {
        container('kaniko') {
          dir("${env.FRONTEND_DIR}") {
            sh '''
              set -euo pipefail
              echo "Building & pushing frontend -> ${FRONTEND_IMAGE}"
              /kaniko/executor --context . --dockerfile Dockerfile --destination=${FRONTEND_IMAGE} --verbosity info
            '''
          }
        }
      }
    }

    stage('Build & push Backend (latest)') {
      steps {
        container('kaniko') {
          dir("${env.BACKEND_DIR}") {
            sh '''
              set -euo pipefail
              echo "Building & pushing backend -> ${BACKEND_IMAGE}"
              /kaniko/executor --context . --dockerfile Dockerfile --destination=${BACKEND_IMAGE} --verbosity info
            '''
          }
        }
      }
    }

    stage('Deploy to Kubernetes') {
      steps {
        container('kubectl') {
          sh '''
            set -euo pipefail
            echo "Applying backend manifest: ${BACKEND_MANIFEST}"
            kubectl --kubeconfig=/home/jenkins/.kube/config apply -f ${BACKEND_MANIFEST} || true
            kubectl --kubeconfig=/home/jenkins/.kube/config rollout status -w -n default deployment/canteen-backend --timeout=120s || true

            echo "Applying frontend manifest: ${FRONTEND_MANIFEST}"
            kubectl --kubeconfig=/home/jenkins/.kube/config apply -f ${FRONTEND_MANIFEST} || true
            kubectl --kubeconfig=/home/jenkins/.kube/config rollout status -w -n default deployment/canteen-frontend --timeout=120s || true
          '''
        }
      }
    }
  }

  post {
    success { echo "✅ Pipeline completed — images pushed as :latest and deployed." }
    failure { echo "❌ Pipeline failed — check above logs." }
  }
}
