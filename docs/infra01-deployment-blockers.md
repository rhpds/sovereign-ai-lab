# Infra01 Deployment Blockers

Status: **NOT READY** — blockers must be resolved before test deployment

## Deployment Pipeline

```
Oberon (DEV) ──→ Infra01 (TEST) ──→ Integration (STAGING) ──→ Demo (PROD)
   ✓ GREEN          BLOCKED              NOT STARTED            NOT STARTED
```

## Current State on Oberon (DEV)

- 11 pods, 33/33 verification checks pass
- Deployed via `infrastructure/oberon/deploy.sh` (raw `oc apply`)
- Dedicated OVMS instance with Granite 3.2 2B (INT4, converted in-cluster)
- TDX available (real attestation)
- Model on local NFS PVC (200Gi `sovereign-model-cache`)
- All images public on `quay.io/redhat-gpte/sovereign-*`

---

## Blockers for Infra01

### BLOCKER 1: No Helm Chart (HIGH)

**Problem:** The AgnosticV config expects `quickstart_deploy_via_make` targeting `infrastructure/helm/`, but no Helm chart exists. We deployed to Oberon with raw `oc apply` via a bash script.

**What's needed:** A Helm chart (or Makefile target) that:
- Creates ConfigMaps (OPA policies, postgres init, praxis config, jurisdiction profiles, workspace artifacts)
- Deploys all 11 services in dependency order (postgres → ledger → gateway → OPA → OVMS → router → praxis → contextforge → MCP → demo-api → frontend)
- Handles per-tenant namespacing (`user-{{ guid }}-sovereign-ai-lab`)
- Accepts values overrides for model endpoint, resource quotas, TDX mode

**Effort:** ~1 day. Wrap existing k8s manifests into Helm templates with `{{ .Values }}` substitution.

**Reference:** Triforce uses `infrastructure/helm/` with `values-oberon.yaml` overrides per cluster.

---

### BLOCKER 2: Model Serving (HIGH)

**Problem:** On Oberon we deploy a dedicated OVMS instance with a pre-converted Granite 3.2 2B model on a local NFS PVC. Infra01 options:

| Option | Feasibility | Issues |
|--------|------------|--------|
| Deploy dedicated OVMS on infra01 | Possible | Needs PVC, model conversion job, ~8GB RAM, HuggingFace access |
| Use racmaas LiteLLM | Blocked | Jonathan says model changes on racmaas are blocked |
| Add `granite-3.2-sovereign` alias to existing racmaas LiteLLM | Unknown | Depends on who controls racmaas config |
| Point at Oberon's OVMS across clusters | Bad idea | Cross-cluster latency, network dependency |

**Questions to resolve:**
- [ ] Can we deploy our own OVMS pod on infra01?
- [ ] Is there a shared model cache PVC on infra01?
- [ ] Can someone add a LiteLLM alias on racmaas for `granite-3.2-sovereign`?
- [ ] What Granite models are already available on racmaas?

**If we can deploy OVMS:** Same pattern as Oberon — conversion job + OVMS deployment. Need NFS storage class.

**If we must use racmaas:** Semantic router and demo API need to point to `maas-rhdp.apps.maas.redhatworkshops.io` instead of local OVMS. Need a Helm values override.

---

### BLOCKER 3: Model Conversion Job (MEDIUM)

**Problem:** The `convert-sovereign-model.yaml` job:
- Downloads Granite 3.2 2B from HuggingFace (ungated, no auth needed)
- Installs `optimum-intel` + `openvino-tokenizers` via pip
- Converts model to OpenVINO INT4 format
- Writes graph.pbtxt and tokenizer files
- Requires ~16GB RAM, takes ~5 minutes

**On infra01:**
- [ ] Does the cluster have outbound internet access to HuggingFace?
- [ ] Is there NFS storage class for the model PVC?
- [ ] Can a job pod get 16GB RAM?

**Alternative:** Bake the converted model into a container image and push to quay.io. Eliminates the conversion job entirely.

---

### BLOCKER 4: TDX Availability (MEDIUM — not a hard blocker)

**Problem:** Infra01 likely does not have TDX-enabled Intel Xeon hardware. The attestation demo runs in simulation mode without TDX.

**Impact:** Demo still works — attestation is recorded in ledger with `tcb_status: UpToDate-simulated`. The live demo panel shows "Re-attest (simulated)". Chain verification still works.

**Not a blocker** for test deployment. Just means the hardware trust layer is simulated rather than real.

---

### BLOCKER 5: PostgreSQL Init Scripts (LOW)

**Problem:** Our postgres deployment uses a ConfigMap with 6 init SQL files mounted to `/docker-entrypoint-initdb.d/`. These must be created before the postgres pod starts.

**In Helm:** This is straightforward — ConfigMap is a template that renders before the Deployment. Already handled if we build the Helm chart.

**Not a real blocker** — just part of the Helm chart work.

---

### BLOCKER 6: Namespace Quotas (LOW)

**Problem:** Our actual resource usage on Oberon:

| Service | CPU Request | Memory Request |
|---------|------------|----------------|
| postgres | 1 | 512Mi |
| ledger | 500m | 512Mi |
| ledger-gateway | 250m | 256Mi |
| OPA | 250m | 256Mi |
| OVMS | 4 | 4Gi |
| semantic-router | 250m | 128Mi |
| praxis | 1 | 256Mi |
| contextforge | 1 | 2Gi |
| MCP server | 250m | 128Mi |
| demo-api | 500m | 256Mi |
| frontend | 100m | 128Mi |
| **Total** | **~9 CPU** | **~8.5 Gi** |

The AgnosticV config requests 8 CPU / 12 GB. This should fit within infra01's tenant quotas (Triforce gets 20 CPU / 32 Gi for partner tier).

**Not a blocker** if the tenant tier is set correctly.

---

## Not Blockers (Already Portable)

- ✓ Container images — all on quay.io/redhat-gpte/ (public)
- ✓ OPA policies — 7 rego files + data.json, portable as ConfigMap
- ✓ Antora showroom content — in the repo, built by showroom workload
- ✓ Frontend — static build served by nginx, proxies `/api/` to demo-api
- ✓ Jurisdiction profiles — JSON files, mounted as ConfigMap
- ✓ Ledger — Rust gRPC server + Python REST gateway, no platform dependencies

---

## Action Items

| # | Item | Owner | Priority | Status |
|---|------|-------|----------|--------|
| 1 | Create Helm chart wrapping k8s manifests | Dev | HIGH | TODO |
| 2 | Determine model serving strategy for infra01 | Jonathan | HIGH | OPEN |
| 3 | Check infra01 storage classes (NFS for model PVC) | Jonathan | MEDIUM | OPEN |
| 4 | Check infra01 outbound internet (HuggingFace access) | Jonathan | MEDIUM | OPEN |
| 5 | Consider baking converted model into container image | Dev | MEDIUM | TODO |
| 6 | Test Helm deploy against Oberon first | Dev | HIGH | TODO |
| 7 | Deploy to infra01 and run verify matrix | Both | HIGH | BLOCKED on 1-4 |

## Decision Needed

**Model serving approach for non-Oberon clusters:**

Option A: Deploy dedicated OVMS per tenant (sovereign, but heavy — 4 CPU, 4GB per seat)

Option B: Shared OVMS on cluster infra (lighter, but need cluster-level deploy)

Option C: Route through racmaas LiteLLM (lightest, but blocked on model changes + breaks sovereignty story)

**Recommendation:** Option A for test/staging (proves the full sovereign stack), Option B for prod (if scale is a concern).
