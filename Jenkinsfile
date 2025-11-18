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
  - name: jnlp
    image: jenkins/inbound-agent:3345.v03dee9b_f88fc-1
    args: ['$(JENKINS_SECRET)']
  volumes:
    - name: workspace-volume
      emptyDir: {}
"""
    }
  }

  environment {
    REGISTRY = "ghcr.io/gowthamlakshman94"
    FRONTEND_IMAGE = "${REGISTRY}/canteen-frontend:latest"
    BACKEND_IMAGE  = "${REGISTRY}/canteen-backend:latest"

    # set your namespaces (or keep 'default' if both apps run in default)
    FRONTEND_NS = "default"
    BACKEND_NS  = "default"
  }

  stages {
    stage('Checkout') {
      steps {
        git branch: 'main', url: 'https://github.com/gowthamlakshman94/Canteen-Automation-System.git'
      }
    }

    stage('Prepare Credentials (kubeconfig + GHCR)') {
      steps {
        // copy the kubeconfig secret file from Jenkins credentials into agent
        // and create a Kaniko docker config from the ghcr username/password credential
        withCredentials([
          file(credentialsId: 'k3s-config', variable: 'KUBECONFIG_FILE'),
          usernamePassword(credentialsId: 'ghcr-token', usernameVariable: 'GHCR_USER', passwordVariable: 'GHCR_PASS')
        ]) {
          // run in the kubectl container (it has sh and kubectl)
          container('kubectl') {
            sh '''
              set -euo pipefail

              echo "-> Ensuring ~/.kube and placing kubeconfig"
              mkdir -p /home/jenkins/.kube
              # copy the Jenkins-provided secret file (KUBECONFIG_FILE) to the standard path
              cp "${KUBECONFIG_FILE}" /home/jenkins/.kube/config
              chmod 0600 /home/jenkins/.kube/config || true

              echo "-> Verifying kubeconfig (first lines):"
              head -n 5 /home/jenkins/.kube/config || true

              # create Kaniko docker config so Kaniko can push to GHCR
              echo "-> Creating /kaniko/.docker/config.json for GHCR auth (will be used by kaniko container)"
              mkdir -p /kaniko/.docker
              AUTH_B64=$(echo -n "${GHCR_USER}:${GHCR_PASS}" | base64 | tr -d '\\n')
              cat > /kaniko/.docker/config.json <<'EOF'
{"auths":{"ghcr.io":{"auth":"__AUTH__"}}}
EOF
              sed -i "s/__AUTH__/${AUTH_B64}/" /kaniko/.docker/config.json || true
              echo "-> Created /kaniko/.docker/config.json (head):"
              head -n 5 /kaniko/.docker/config.json || true
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
              set -euo pipefail
              echo "Building frontend image: ${FRONTEND_IMAGE}"
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
              set -euo pipefail
              echo "Building backend image: ${BACKEND_IMAGE}"
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
        container('kubectl') {
          sh '''
            set -euo pipefail
            echo "Deploying backend to namespace ${BACKEND_NS}"
            kubectl --kubeconfig=/home/jenkins/.kube/config apply -n ${BACKEND_NS} -f canteen-automation-backend/deployment.yaml
            kubectl --kubeconfig=/home/jenkins/.kube/config rollout status deployment/canteen-backend -n ${BACKEND_NS} --timeout=120s || true

            echo "Deploying frontend to namespace ${FRONTEND_NS}"
            kubectl --kubeconfig=/home/jenkins/.kube/config apply -n ${FRONTEND_NS} -f Canteen-Automation-System-Website/deployment.yaml
            kubectl --kubeconfig=/home/jenkins/.kube/config rollout status deployment/canteen-frontend -n ${FRONTEND_NS} --timeout=120s || true
          '''
        }
      }
    }
  }

  post {
    success {
      echo "✅ Build & deploy completed."
    }
    failure {
      echo "❌ Build or deploy failed — check logs above."
    }
  }
}
