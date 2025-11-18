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
        - name: docker-config
          mountPath: /kaniko/.docker
    - name: kubectl
      image: bitnami/kubectl:latest
      command: ['sh','-c']
      args: ['sleep 999d']
      tty: true
      env:
        - name: KUBECONFIG
          value: /home/jenkins/.kube/config
      volumeMounts:
        - name: kubeconfig-jenkins
          mountPath: /home/jenkins/.kube
          readOnly: true
        - name: kubeconfig-root
          mountPath: /root/.kube
          readOnly: true
  volumes:
    - name: docker-config
      secret:
        secretName: ghcr-secret
        items:
          - key: .dockerconfigjson
            path: config.json
    - name: kubeconfig-jenkins
      secret:
        secretName: k3s-config
        items:
          - key: config
            path: config
    - name: kubeconfig-root
      secret:
        secretName: k3s-config
        items:
          - key: config
            path: config
"""
    }
  }

  environment {
    REGISTRY = "ghcr.io/gowthamlakshman94"
    FRONTEND_IMAGE = "${REGISTRY}/canteen-frontend:latest"
    BACKEND_IMAGE  = "${REGISTRY}/canteen-backend:latest"

    FRONTEND_NS = "default"
    BACKEND_NS  = "default"
  }

  options {
    timestamps()
    ansiColor('xterm')
  }

  stages {

    stage('Checkout') {
      steps {
        git branch: 'main', url: 'https://github.com/gowthamlakshman94/Canteen-Automation-System.git'
      }
    }

    stage('Agent Debug & Sanity') {
      steps {
        container('kubectl') {
          sh '''
            set -euo pipefail || true

            echo "=== ENV & KUBECONFIG ==="
            echo "KUBECONFIG=${KUBECONFIG:-<not-set>}"
            ls -la /home/jenkins/.kube || true
            ls -la /root/.kube || true

            echo "=== kubeconfig first 200 bytes (if present) ==="
            if [ -f /home/jenkins/.kube/config ]; then
              head -c 200 /home/jenkins/.kube/config || true
              echo
            fi
            if [ -f /root/.kube/config ]; then
              head -c 200 /root/.kube/config || true
              echo
            fi

            echo "=== kubectl version & cluster reachability ==="
            kubectl version --client || true

            echo "---- kubeconfig-based kubectl get ns ----"
            kubectl --kubeconfig=/home/jenkins/.kube/config get ns || kubectl --kubeconfig=/root/.kube/config get ns || true

            echo "=== in-cluster serviceaccount files (if any) ==="
            ls -l /var/run/secrets/kubernetes.io/serviceaccount || true
            head -c 160 /var/run/secrets/kubernetes.io/serviceaccount/token || true || true

            echo "=== test API with kubeconfig ==="
            kubectl --kubeconfig=/home/jenkins/.kube/config get pods -A --no-headers -o wide | head -n 10 || true

            echo "=== auth can-i for jenkins-deployer (using kubeconfig) ==="
            kubectl --kubeconfig=/home/jenkins/.kube/config auth can-i create deployments -n ${BACKEND_NS} || true

            echo "=== end of agent debug stage ==="
          '''
        }
      }
    }

    stage('Setup Docker Auth (use ghcr-secret)') {
      steps {
        echo "Using ghcr-secret mounted at /kaniko/.docker/config.json for Kaniko auth"
      }
    }

    stage('Build Frontend Image') {
      steps {
        container('kaniko') {
          dir('Canteen-Automation-System-Website') {
            sh '''
              set -euo pipefail
              echo "Building frontend -> ${FRONTEND_IMAGE}"
              /kaniko/executor --context . --dockerfile Dockerfile --destination=${FRONTEND_IMAGE} --verbosity info
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
              echo "Building backend -> ${BACKEND_IMAGE}"
              /kaniko/executor --context . --dockerfile Dockerfile --destination=${BACKEND_IMAGE} --verbosity info
            '''
          }
        }
      }
    }

    stage('Deploy Backend') {
      steps {
        container('kubectl') {
          sh '''
            set -euo pipefail
            echo "Applying backend manifests to namespace ${BACKEND_NS}..."
            kubectl --kubeconfig=/home/jenkins/.kube/config apply -n ${BACKEND_NS} -f backend-deployment.yaml
            kubectl --kubeconfig=/home/jenkins/.kube/config rollout status deployment/canteen-backend -n ${BACKEND_NS} --timeout=120s || (kubectl --kubeconfig=/home/jenkins/.kube/config describe deployment/canteen-backend -n ${BACKEND_NS} && kubectl --kubeconfig=/home/jenkins/.kube/config get pods -n ${BACKEND_NS} -o wide && exit 1)
          '''
        }
      }
    }

    stage('Deploy Frontend') {
      steps {
        container('kubectl') {
          sh '''
            set -euo pipefail
            echo "Applying frontend manifests to namespace ${FRONTEND_NS}..."
            kubectl --kubeconfig=/home/jenkins/.kube/config apply -n ${FRONTEND_NS} -f frontend-deployment.yaml
            kubectl --kubeconfig=/home/jenkins/.kube/config rollout status deployment/canteen-frontend -n ${FRONTEND_NS} --timeout=120s || (kubectl --kubeconfig=/home/jenkins/.kube/config describe deployment/canteen-frontend -n ${FRONTEND_NS} && kubectl --kubeconfig=/home/jenkins/.kube/config get pods -n ${FRONTEND_NS} -o wide && exit 1)
          '''
        }
      }
    }

  } // stages

  post {
    success {
      echo "✅ Build & Deploy pipeline completed successfully."
    }
    failure {
      echo "❌ Pipeline failed — see logs above for debugging."
    }
  }
}
