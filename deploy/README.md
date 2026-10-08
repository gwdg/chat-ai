# Deploying behind AcademicCloud SSO

How to run Chat AI on a VM so that only logged-in (and optionally only
selected) users can reach it.

```
Browser ──▶ Apache + SSO (443) ──▶ /          → front (127.0.0.1:8080)
                               └─▶ /backend/  → back  (127.0.0.1:8081) ──API key──▶ Chat AI
```

Apache forces the AcademicCloud login, then passes the user's identity to the
back end as `OIDC_CLAIM_*` headers. The back end trusts these headers, so it
must only be reachable through Apache.

## 1. VM and network

- Open only ports 22, 80 and 443 in the OpenStack security group. **Ports 8080
  and 8081 must not be reachable from outside**: anyone reaching 8081 directly
  could send their own identity headers and use the API key.
- A DNS name for the VM and a TLS certificate for it.

## 2. SSO client

Request an OIDC client for the VM from GWDG (support ticket), with:

- redirect URI `https://<your.domain>/oidc-redirect`
- claims `uid`, `email`, `o` and `ou`

You get back the issuer/metadata URL, a client ID, a client secret and the
scopes to request.

## 3. Apache

```bash
sudo apt install apache2 libapache2-mod-auth-openidc
sudo a2enmod ssl proxy proxy_http auth_openidc
sudo cp deploy/apache/chat-ai.conf.sample /etc/apache2/sites-available/chat-ai.conf
# fill in every <...> in that file
sudo a2ensite chat-ai
sudo apachectl configtest && sudo systemctl reload apache2
```

## 4. Chat AI config

`secrets/front.json`: production mode and paths relative to the domain.

```json
"mode": "prod",
"backendPath": "/backend",
"modelsPath": "/backend/models",
"userDataPath": "/backend/user",
```

`secrets/back.json`: the API key, and access rules if wanted (see below).

```bash
docker compose build front back
docker compose up front back -d
```

## 5. Check

1. Open `https://<your.domain>`: you are sent to the AcademicCloud login, then
   to Chat AI.
2. Open `https://<your.domain>/backend/user`: it shows your own `org` (`o`) and
   `organization` (`ou`) values. Use them to write the access rules.

## Restricting access to organisations or users

In `secrets/back.json`; restart `back` after changes.

```json
"adminUsers": ["jonathan.decker@uni-goettingen.de"],
"userFilter": {
    "org":          { "whitelist": ["<o value>"], "blacklist": [] },
    "organization": { "whitelist": [], "blacklist": [] },
    "user":         { "whitelist": [], "blacklist": [] }
}
```

- `org` matches the `o` claim, `organization` the `ou` claim, `user` the user ID
  or email. Matching ignores upper/lower case.
- A rule fails if a value is on its blacklist, or if it has a whitelist and the
  value isn't on it. **Every rule must pass.**
- `adminUsers` (user ID or email) skip all rules, e.g. to let in a few people
  from other organisations.
- Empty lists mean no restriction.

Examples:

- Only one organisation: `org.whitelist: ["<o value>"]`
- Only named people: `user.whitelist: ["a@x.de", "b@y.de"]`
- One organisation plus two outside people: `org.whitelist` plus `adminUsers`

Rejected users get HTTP 403 from every back-end route and see a "No access"
page in the browser.
