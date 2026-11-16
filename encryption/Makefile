# SAIA E2EE model node keys: one X25519 pair per model.
#
# This runs on the machine you are on. It needs GNU make and Node 18+, and
# nothing from the repository's Docker images or a dev container, so a plain
# checkout on a node host is enough:
#
#   cd encryption && make keys
#
#   make help

# Directory of this Makefile, resolved from the makefile itself so the targets
# work from any cwd, with -C, and with -f path/to/Makefile alike.
THIS_DIR := $(patsubst %/,%,$(dir $(lastword $(MAKEFILE_LIST))))
SCRIPT := $(THIS_DIR)/generate-model-keys.mjs

# Node binary. Override for an install outside PATH:
#   make NODE=/opt/node/bin/node keys
NODE ?= node

# Where the pairs are written. On a model node, point it at the key mount:
#   make OUT=/secure/saia-e2ee keys
OUT ?= $(THIS_DIR)/keys

# front.json to read modelsPath and apiKey from. Empty means the script's own
# default: $CONFIG_LOCATION, else secrets/front.json next to this checkout; the
# endpoint is still the GWDG list unless MODELS_URL is set.
CONFIG ?=

# The GWDG deployment's model list. This is the default endpoint, because a
# checkout outside the deployment has no local back service to ask.
GWDG_MODELS_URL ?= https://chat-ai.academiccloud.de/v1/models

# Endpoint to query. An explicit CONFIG= wins with that file's modelsPath, so a
# different deployment's list beats the GWDG default.
ifneq ($(strip $(CONFIG)),)
MODELS_URL ?=
else
MODELS_URL ?= $(GWDG_MODELS_URL)
endif

# Bearer token. The script falls back to $SAIA_API_KEY, then apiKey in the
# front config, then apiKey in the back.json next to it.
API_KEY ?=

# Extra script arguments, verbatim. Quote them here instead of on the make
# command line, which would split them:
#   make keys HEADER_FLAGS="--header 'X-Auth-Request-User: me'"
HEADER_FLAGS ?=

GEN_ARGS := --out "$(OUT)"
ifneq ($(strip $(CONFIG)),)
GEN_ARGS += --config "$(CONFIG)"
endif
ifneq ($(strip $(MODELS_URL)),)
GEN_ARGS += --models-url "$(MODELS_URL)"
endif
ifneq ($(strip $(API_KEY)),)
GEN_ARGS += --api-key "$(API_KEY)"
endif

.PHONY: help keys dry-run force list test check-node

help:
	@echo "SAIA E2EE model node keys"
	@echo
	@echo "  make keys        write one <MODELNAME>.key/.pub pair per model plus keys.json, keeping existing pairs"
	@echo "  make dry-run     show the model -> file table, write nothing"
	@echo "  make force       replace existing pairs (provision the node first, then publish)"
	@echo "  make list        show the pairs in $(OUT) and the keys.json manifest"
	@echo "  make test        run the generator's own tests"
	@echo
	@echo "The model list comes from $(MODELS_URL)"
	@echo
	@echo "Variables (make VAR=value):"
	@echo "  NODE=            Node 18+ binary (default: node)"
	@echo "  OUT=             output directory (default: $(THIS_DIR)/keys)"
	@echo "  CONFIG=          front.json to read modelsPath/apiKey from (its list wins)"
	@echo "  MODELS_URL=      /models endpoint, overrides both (default: $(GWDG_MODELS_URL))"
	@echo "  API_KEY=         bearer token (default: SAIA_API_KEY, or apiKey in the configs)"
	@echo "  HEADER_FLAGS=    extra script arguments, e.g. --header 'X-User: me'"
	@echo
	@echo "A .key is a node's private key: never commit or upload it. Publish only"
	@echo "the .pub file, under the e2eeKeyUrl directory from front.json."

keys: check-node
	$(NODE) "$(SCRIPT)" $(GEN_ARGS) $(HEADER_FLAGS)

dry-run: check-node
	$(NODE) "$(SCRIPT)" $(GEN_ARGS) $(HEADER_FLAGS) --dry-run

force: check-node
	$(NODE) "$(SCRIPT)" $(GEN_ARGS) $(HEADER_FLAGS) --force

list: check-node
	@$(NODE) --input-type=module -e 'import fs from "node:fs"; import path from "node:path"; import { createHash } from "node:crypto"; const dir = path.resolve("$(OUT)"); if (!fs.existsSync(dir)) { console.log("No " + dir + " yet. Run: make keys"); process.exit(0); } const pubs = fs.readdirSync(dir).filter((name) => name.endsWith(".pub")).sort(); if (!pubs.length) { console.log("No key pairs in " + dir + " yet. Run: make keys"); process.exit(0); } const listed = new Set(); for (const name of pubs) { const text = fs.readFileSync(path.join(dir, name), "utf8").trim(); const privatePath = path.join(dir, name.slice(0, -4) + ".key"); const state = (text.length === 43 ? "ok" : "NOT A KEY") + "  " + (fs.existsSync(privatePath) ? "private present" : "PRIVATE MISSING"); console.log(name.padEnd(48) + "  " + state); if (text.length === 43) listed.add("key-" + createHash("sha256").update(Buffer.from(text, "base64url")).digest().subarray(0, 12).toString("base64url")); } const manifestPath = path.join(dir, "keys.json"); if (!fs.existsSync(manifestPath)) { console.log("\nkeys.json: MISSING. Run: make keys"); process.exit(0); } let doc; try { doc = JSON.parse(fs.readFileSync(manifestPath, "utf8")); } catch { console.log("\nkeys.json: NOT VALID JSON"); process.exit(0); } const keys = Array.isArray(doc.keys) ? doc.keys : []; const models = doc.models && typeof doc.models === "object" && !Array.isArray(doc.models) ? doc.models : {}; const known = new Set(keys.map((entry) => entry && entry.id).filter(Boolean)); const dangling = Object.entries(models).filter(([, id]) => !known.has(id)).map(([modelId]) => modelId); const unlisted = [...listed].filter((id) => !known.has(id)); console.log("\nkeys.json: " + keys.length + " key(s), " + Object.keys(models).length + " model(s)" + (dangling.length ? "  DANGLING MODEL(S): " + dangling.join(", ") : "") + (unlisted.length ? "  UNLISTED .pub: " + unlisted.length : ""));'

test: check-node
	cd "$(THIS_DIR)" && $(NODE) --test

check-node:
	@command -v "$(NODE)" >/dev/null 2>&1 || { echo "error: $(NODE) not found. Install Node 18+ or pass NODE=/path/to/node" >&2; exit 1; }
	@$(NODE) -e 'const major = Number(process.versions.node.split(".")[0]); if (major < 18) { console.error("error: Node 18 or newer is required, found " + process.versions.node); process.exit(1); }'
