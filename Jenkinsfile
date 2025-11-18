#!/usr/bin/env bash
set -euo pipefail

# -------------------------
# Usage:
#   KUBECONFIG_FILE=/tmp/kubeconfig GHCR_USER=me GHCR_PASS=token ./ci-build-and-deploy.sh
# Or from Jenkins use withCredentials to provide those envs/files.
# -------------------------

# Configurable paths / names (edit if yours differ)
FRONTEND_DIR="${FRONTEND_DIR:-Canteen-Automation-System-Website}"
BACKEND_DIR="${BACKEND_DIR:-canteen-automation-backend}"
REGISTRY="${REGISTRY:-ghcr.io/gowthamlakshman94}"
FRONTEND_IMAGE="${REGISTRY}/canteen-frontend:latest"
BACKEND_IMAGE="${REGISTRY}/canteen-backend:latest"
KUBECONFIG_FILE="${KUBECONFIG_FILE:-}"
KUBECONFIG_DST="${KUBECONFIG_DST:-/home/jenkins/.kube/config}"
KANIKO_EXEC="${KANIKO_EXEC:-/kaniko/executor}"   # path to kaniko executor if present

# Helper: fatal
fail(){ echo "ERROR: $*" >&2; exit 1; }

# Validate GHCR creds in env
: "${GHCR_USER:?need GHCR_USER (username)}"
: "${GHCR_PASS:?need GHCR_PASS (password/token)}"

# Place kubeconfig if provided
if [[ -n "${KUBECONFIG_FILE:-}" && -f "${KUBECONFIG_FILE}" ]]; then
  echo "Placing kubeconfig from ${KUBECONFIG_FILE} -> ${KUBECONFIG_DST}"
  mkdir -p "$(dirname "${KUBECONFIG_DST}")"
  cp "${KUBECONFIG_FILE}" "${KUBECONFIG_DST}"
  chmod 0600 "${KUBECONFIG_DST}" || true
  export KUBECONFIG="${KUBECONFIG_DST}"
else
  echo "No KUBECONFIG_FILE provided; expecting in-cluster config (service account) or KUBECONFIG env set."
fi

# Create Kaniko docker config for GHCR (if using kaniko)
create_kaniko_config() {
  echo "Creating /kaniko/.docker/config.json for GHCR..."
  mkdir -p /kaniko/.docker || true
  AUTH_B64="$(printf "%s:%s" "${GHCR_USER}" "${GHCR_PASS}" | base64 | tr -d '\n')"
  cat > /kaniko/.docker/config.json <<'EOF'
{"auths":{"ghcr.io":{"auth":"__AUTH__"}}}
EOF
  sed -i "s/__AUTH__/${AUTH_B64}/" /kaniko/.docker/config.json || true
  echo "Wrote /kaniko/.docker/config.json (head):"
  head -n 5 /kaniko/.docker/config.json || true
}

# Build & push with Kaniko (preferred inside k8s pod)
kaniko_build_and_push() {
  local srcdir="$1"
  local dockerfile="${2:-Dockerfile}"
  local destination="$3"

  echo "Kaniko: building ${srcdir} -> ${destination}"
  "${KANIKO_EXEC}" --context "${srcdir}" --dockerfile "${dockerfile}" --destination="${destination}" --verbosity info
}

# Fallback: Docker local build & push (if Docker daemon is available)
docker_build_and_push() {
  local srcdir="$1"
  local dockerfile="${2:-Dockerfile}"
  local destination="$3"

  echo "Docker: build ${srcdir} -> ${destination}"
  docker build -t "${destination}" -f "${srcdir}/${dockerfile}" "${srcdir}"
  echo "Docker: login to ghcr"
  echo "${GHCR_PASS}" | docker login ghcr.io -u "${GHCR_USER}" --password-stdin
  docker push "${destination}"
}

# Attempt build+push: prefer Kaniko if available
build_and_push() {
  local dir="$1"
  local image="$2"
  if [[ -x "${KANIKO_EXEC}" ]]; then
    create_kaniko_config
    kaniko_build_and_push "${dir}" "Dockerfile" "${image}"
  elif command -v docker >/dev/null 2>&1; then
    docker_build_and_push "${dir}" "Dockerfile" "${image}"
  else
    fail "Neither Kaniko executor (${KANIKO_EXEC}) nor docker CLI is available in PATH."
  fi
}

# Deploy manifests (kubectl must be available)
deploy_manifest() {
  local manifest="$1"
  if ! command -v kubectl >/dev/null 2>&1; then
    fail "kubectl not found in PATH"
  fi
  echo "Applying manifest ${manifest}"
  kubectl apply -f "${manifest}" || true
}

# -------------
# Main flow
# -------------
echo "Starting CI build-and-deploy script"
echo "Frontend dir: ${FRONTEND_DIR} -> ${FRONTEND_IMAGE}"
echo "Backend dir : ${BACKEND_DIR} -> ${BACKEND_IMAGE}"

# Build & push frontend
build_and_push "${FRONTEND_DIR}" "${FRONTEND_IMAGE}"

# Build & push backend
build_and_push "${BACKEND_DIR}" "${BACKEND_IMAGE}"

# Deploy
if [[ -f "${BACKEND_DIR}/deployment.yaml" ]]; then
  deploy_manifest "${BACKEND_DIR}/deployment.yaml"
else
  echo "WARNING: backend deployment manifest not found at ${BACKEND_DIR}/deployment.yaml"
fi

if [[ -f "${FRONTEND_DIR}/deployment.yaml" ]]; then
  deploy_manifest "${FRONTEND_DIR}/deployment.yaml"
else
  echo "WARNING: frontend deployment manifest not found at ${FRONTEND_DIR}/deployment.yaml"
fi

echo "Done"
