# Branding

A branding is a folder with a `branding.yaml` plus the files it references
(logo, disclaimer HTML, help file, system prompt). It sets the browser tab
title and icon, the header, the disclaimers, the footer help link and the
default system prompt.

Each folder in `front/branding/` is one branding, e.g. `mpg-ohb/`.

## Activating a branding

Set `overrides.branding` in the front config (`secrets/front.ts`):

```ts
"overrides": {
    // Folder name under front/branding/
    "branding": "mpg-ohb",
},
```

Leave it unset for the default Chat AI look. When a branding is set, the
Chat AI logo and the AI services menu are hidden.

The branding is read when the frontend is built (also on `npm run prod`), so
restart or rebuild after changing it. In dev mode (`npm run dev`) changes are
picked up automatically.

## Using a branding outside the repository

`branding` can also be an absolute path, e.g. when the branding lives next to
the deployment secrets instead of in the git repository:

```
/srv/
├── secrets/
│   └── front.ts
└── branding/
    └── mpg-ohb/
        ├── branding.yaml
        ├── disclaimer.de.html
        ├── disclaimer.en.html
        ├── chat-disclaimer.de.html
        ├── chat-disclaimer.en.html
        ├── system-prompt.md
        └── public/
            ├── logo.svg
            └── OHB-Chatbot__DE___EN__v1.0.pdf
```

```ts
// /srv/secrets/front.ts
"overrides": {
    "branding": "/srv/branding/mpg-ohb",
},
```

The folder only needs to exist on the build host at build time; the files in
`public/` are copied into the build output (`dist/branding/`).

Relative paths are resolved from `front/branding/`, so use an absolute path
for anything outside the repository.

## Folder contents

```
mpg-ohb/
├── branding.yaml            # configuration, see below
├── disclaimer.de.html       # disclaimer on new conversations, German
├── disclaimer.en.html       # disclaimer on new conversations, English
├── chat-disclaimer.de.html  # disclaimer in active conversations, German
├── chat-disclaimer.en.html  # disclaimer in active conversations, English
├── system-prompt.md         # default system prompt
└── public/                  # served as /branding/<file>
    ├── logo.svg                        # header logo and favicon
    └── OHB-Chatbot__DE___EN__v1.0.pdf  # help file linked in the footer
```

Only the `public/` subfolder is served, e.g. `public/logo.svg` as
`/branding/logo.svg`. Files that the browser loads directly (logo, favicon,
help file) must be in there. Everything else in the folder is not served as a
file. Note however that the disclaimers and the system prompt are built into
the JavaScript bundle and can therefore still be read by anyone using the app.

## branding.yaml

All sections and values are optional; empty values (e.g. `subtitle:`) count
as not set. All paths are relative to the branding folder. Files referenced
here must exist, otherwise the build fails with an error (except
`systemPrompt`, see below).

```yaml
# Browser tab. Omit for the default "Chat AI" title and icon.
browserTab:
  title: KI-Assistent zum Organisationshandbuch   # replaces "Chat AI"
  favicon: public/logo.svg                        # .svg, .png or .ico in public/

# Header bar shown above the chat. Omit the whole section for no header.
header:
  logo: public/logo.svg          # image in public/
  logoAlt: Max-Planck-Gesellschaft
  title: KI-Assistent zum Organisationshandbuch
  subtitle: Anweisungen und Arbeitshilfen
  textColor: "#006c66"           # title and subtitle, any CSS color
  backgroundColor: "#ffffff"     # header bar, any CSS color

# Footer (only visible if overrides.ui.hideFooter is not set)
footer:
  help: public/OHB-Chatbot__DE___EN__v1.0.pdf   # file in public/ or https:// URL

# HTML shown below the prompt on every new conversation
disclaimer:
  de: disclaimer.de.html
  en: disclaimer.en.html

# HTML shown at the top of a conversation once the first message was sent,
# replacing the default hallucination warning
chatDisclaimer:
  de: chat-disclaimer.de.html
  en: chat-disclaimer.en.html

# Default system prompt for new conversations
systemPrompt: system-prompt.md
```

### Languages

`browserTab.title`, `header.title`, `header.subtitle`, `disclaimer`,
`chatDisclaimer` and `footer.help` take either one value or one value per
language. The UI language is used, falling back to English and then to the
first entry:

```yaml
title: KI-Assistent zum Organisationshandbuch   # same for all languages

title:                                          # per language
  de: KI-Assistent zum Organisationshandbuch
  en: AI Assistant for the Organisational Handbook
```

The tab title shown while the page is still loading can only have one value;
it uses the English one (or the first entry).

### Help link

`footer.help` is either a file in `public/` (served under `/branding/<file>`)
or an external URL starting with `http://` or `https://`.
Without it, the footer shows no help link.

```yaml
footer:
  help:
    de: https://example.org/hilfe
    en: https://example.org/help
```

### Disclaimer HTML

The same rules apply to `disclaimer` and `chatDisclaimer`.

Write plain HTML without classes. `h2`, `p`, `strong`, `a` and lists are
styled automatically. Scripts and event handlers are removed. Links may use
`target="_blank"`.

```html
<h2>Wichtiger Hinweis</h2>
<p><strong>1. Zweck</strong> Dieser KI-Assistent ...</p>
<p>Mehr in der <a href="https://example.org" target="_blank">Datenschutzerklärung</a>.</p>
```

### System prompt

If `systemPrompt` is not set, or the file is missing, empty or unreadable,
the system prompt from `default.messages` in the front config is used
(a warning is printed during the build).

Note that the system prompt is part of the frontend bundle and therefore
visible to users.
