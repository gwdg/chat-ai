# Model key generator

`generate-model-keys.mjs` creates one **SAIA E2EE node key pair per available
model** and writes it to `keys/`:

```
keys/<MODELNAME>.key   base64url X25519 private key, mode 0600, node only
keys/<MODELNAME>.pub   base64url X25519 public key, publish this one
keys/keys.json         all public keys + model bindings, no private material
```

`keys.json` is the key directory the app imports in one click (Encryption
settings → Directory). It has the format `parseKeyDirectory()` reads:

```json
{
  "keys": [
    { "id": "key-<fingerprint>", "name": "Qwen A",
      "publicKey": "<43-char base64url>", "models": ["qwen-a"] }
  ],
  "models": { "qwen-a": "key-<fingerprint>" }
}
```

Every key is still verified against its model before it is stored, and the file
contains only `.pub` material, so it can sit next to the published `.pub` files.

`<MODELNAME>` is the model **id** with every run of characters outside
`[A-Za-z0-9._-]` replaced by `-`, so `bridge/deepseek-v4.1-flash-1017` becomes
`bridge-deepseek-v4.1-flash-1017.pub`. Both this script and the app import the
same function from `front/src/e2ee/publishedKeys.js`, so the file names always
match the URL the app requests.

## Why X25519 and not a "4096 bit" key

The protocol (`saia/saia-e2ee`, ported to `front/src/e2ee/protocol.js`) is
`X25519 + HKDF-SHA256 + AES-256-GCM`. The node accepts exactly one 32-byte
X25519 public key; RSA or any other key type is rejected before a request is
decrypted. A 256-bit X25519 key has roughly the security level of an RSA-3072
key, and the per-request session keys come from it.

## Makefile

On a machine without this checkout's tooling — a laptop, a jump host, or the
model node itself — `make` wraps the script. It needs GNU make and Node 18+
only (no `npm install`), uses no Docker image and no absolute path from a dev
environment, and works from any directory:

```bash
cd encryption && make            # same as make help
make -C encryption keys          # write the pairs into encryption/keys/
make -C encryption dry-run       # what would be written
make -C encryption list          # check the pairs (missing .key, bad key)
make -C encryption test          # the generator's own tests
```

The script imports the file-name mapping from
`front/src/e2ee/publishedKeys.js` (which has no dependencies), so keep
`encryption/` inside the checkout rather than copying the folder on its own.

| Variable | Meaning |
| --- | --- |
| `NODE=` | Node 18+ binary (default `node`); checked before anything runs |
| `OUT=` | output directory (default `encryption/keys`) |
| `CONFIG=` | `front.json` to read `modelsPath`/`apiKey` from; its model list wins |
| `MODELS_URL=` | `/models` endpoint (default: the GWDG model list) |
| `API_KEY=` | bearer token (default: `$SAIA_API_KEY`, or `apiKey` in the configs) |
| `HEADER_FLAGS=` | extra script arguments, quoted: `HEADER_FLAGS="--header 'X-User: me'"` |

Examples:

```bash
# out of the box: the GWDG model list, key from secrets/back.json
make -C encryption keys

# on a node, write straight into the key mount
make -C encryption OUT=/secure/saia-e2ee keys

# another deployment: its own model list and key
make -C encryption CONFIG=/secure/front.json keys

# a local engine that wants its own bearer token
make -C encryption MODELS_URL=http://localhost:10000/public/v1/models API_KEY=... keys
```

`make keys` keeps an existing pair (a lost private key is never silently
replaced); `make force` rewrites it, which is the two-sided rotation: provision
the node with the new `.key`, then publish the new `.pub`.

Every `make keys` run also writes `keys.json` in `OUT` from the pairs that are
there, so the manifest can be regenerated after existing pairs were kept.
`make list` reports it: a missing manifest, a model bound to a key id that is
not in the file, or a `.pub` the manifest does not list.

## Usage

The models come from the deployment's `/models` endpoint — the same response
the app's model picker uses. The endpoint is chosen in this order:

1. `--models-url`
2. `modelsPath` in the config (`--config`, `$CONFIG_LOCATION`, then
   `secrets/front.json`)
3. the GWDG model list,
   `https://chat-ai.academiccloud.de/v1/models`

So a checkout with no config still works against GWDG:

```bash
node encryption/generate-model-keys.mjs
```

The GWDG endpoint needs an API key. The script takes the first of
`--api-key`, `$SAIA_API_KEY`, `apiKey` in the front config, `apiKey` in the
`back.json` next to it (where the README puts the real key). Exporting it keeps
it out of `ps`:

```bash
export SAIA_API_KEY=...
node encryption/generate-model-keys.mjs
```

Point it somewhere else without touching the config:

```bash
node encryption/generate-model-keys.mjs \
  --models-url http://localhost:10000/public/v1/models \
  --api-key "$SAIA_KEY"
```

Useful flags:

| Flag | Meaning |
| --- | --- |
| `--dry-run` | print the model → file table, write nothing |
| `--force` | replace existing pairs instead of leaving them alone |
| `--out <dir>` | write somewhere other than `encryption/keys` |
| `--header "name: value"` | extra request header, repeatable (OIDC proxies) |

Re-running is safe: an existing `.key`/`.pub` pair is reported as `exists` and
left untouched, which also means a lost private key is never silently replaced.
Replacing a pair is a two-sided operation: provision the new private key on the
node, then publish the new public key.

## What to do with the files

1. Put `<MODELNAME>.key` on the model node:

   ```bash
   SAIA_E2EE_PRIVATE_KEY_FILE=/secure/saia-e2ee/<MODELNAME>.key
   ```

2. Publish `<MODELNAME>.pub` under the key directory the app reads. The
   default is
   `https://docs.ai.gwdg.de/technical/saia-platform/keys/`, configurable as
   `e2eeKeyUrl` in `secrets/front.json`:

   ```json
   "e2eeKeyUrl": "https://docs.ai.gwdg.de/technical/saia-platform/keys/"
   ```

3. In the app, open **User settings → Encryption → Published keys** and load
   the keys for all models. Each downloaded key is tested with one sealed
   request against its own model before it is stored, so a wrong or stale key
   never reaches a chat.

## Security notes

- A `.key` file is the node's private key. `keys/.gitignore` excludes `*.key`
  so it cannot be committed by accident; keep it out of the web root, too.
- The key URL is a trust anchor. Serve it over HTTPS and only configure a host
  you trust; the app refuses a key that does not verify against the node, but a
  host that controls the node can still publish its own key.
- Public keys are safe to commit and to serve.

## Tests

```bash
node --test encryption/*.test.mjs
```

covers the key format (private → public derivation), the model payload parser
and the file-name mapping shared with the front end.
