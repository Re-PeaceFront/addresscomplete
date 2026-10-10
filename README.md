# AICA Address Autocomplete

![AICA Address Autocomplete try tool — type a Canadian address and pick a suggestion](screenshots/aica-address-complete-api-try-tool-video-gif.gif)

Canadian address autocomplete, validation, and reverse geocoding. After 3 keystrokes, suggest civic addresses; check that an entered address matches a real record or find the closest one; convert latitude/longitude into the nearest nearby street address. Embeddable widget and REST API for forms and checkout. HTTPS. Canada only.

This repository is the public integration pack: widget files, example JSON, screenshots, and the markdown files coding agents look for (`AGENTS.md`, `llms.txt`).

| | |
|---|---|
| Site | https://aicaaddresscomplete.com/ |
| Try the widget | https://aicaaddresscomplete.com/try-free-address-autocomplete-api |
| Documentation | https://aicaaddresscomplete.com/documentation |
| Pricing | https://aicaaddresscomplete.com/pricing |
| Account | https://aica-apis.quebecstore.ca/aica-adresse-auto-complete/ |
| Autocomplete API | https://aica-apis.quebecstore.ca/v1/address/autocomplete |
| French pages | add `?lang=fr` |

Canada only. Do not assume US ZIP formats.

---

## Before you call the API

A live `aica_live_…` key is required. Create an account, then a key, then keep the key on a plan or credits:

1. [Create an account](https://aica-apis.quebecstore.ca/aica-adresse-auto-complete/account/register)
2. [Sign in](https://aica-apis.quebecstore.ca/aica-adresse-auto-complete/account/sign-in)
3. Open [API key management](https://aica-apis.quebecstore.ca/aica-adresse-auto-complete/account/dashboard/api-manage), create a **widget** or **server** key
4. Allowlist your site domain (and server IP if you have one), e.g. `example.com` + `1.2.3.4`
5. Store the key in an environment variable, server config, or secrets store — not in git

The try-now page is enough to see the widget. To use **your** key in production, pick a [subscription or credits](https://aicaaddresscomplete.com/pricing) from the dashboard. Put the key in `.env` or equivalent; never commit it.

---

## Widget

Type a civic address; suggestions include street, city, province, postal code, and (when it is a building) unit counts.

![Canadian address autocomplete widget showing suggestions for 123](screenshots/widget-autocomplete.png)

Production install (CDN — do **not** iframe, `<embed>`, or `<object>`):

```html
<script src="https://aica-apis.quebecstore.ca/v1/address/autocomplete/canada/interactive/aica-loader.js" async></script>

<div id="address-field"
     data-aica-autocomplete
     data-api-key="aica_live_YOUR_WIDGET_KEY"></div>
```

CSP on the host page must allow `https://aica-apis.quebecstore.ca` (`script-src`, `style-src`, `img-src`, `connect-src`). Allowlist the page domain on that widget key.

Copies of the loader, JS, and CSS live in [`widget/`](widget/). A small HTML sample is [`examples/widget.html`](examples/widget.html).

When the visitor picks an address, `onSelect` receives a record like this ([`examples/autocomplete-select.json`](examples/autocomplete-select.json)):

```json
{
  "result": "1001-123 CHARLTON AVE E, HAMILTON, ON, L8N 3W3",
  "other_meta": {
    "addr_id": "0a600870-dc7b-45ac-bf7d-b55beac40929",
    "unit": "1001",
    "building_line": "123 CHARLTON AVE E",
    "city": "HAMILTON",
    "postal_code": "L8N 3W3",
    "provice_abbr": "ON",
    "location": { "lat": 43.248737, "lon": -79.867011 },
    "display_line": "1001-123 CHARLTON AVE E, HAMILTON, ON, L8N 3W3"
  }
}
```

---

## REST API

Autocomplete endpoint: `https://aica-apis.quebecstore.ca/v1/address/autocomplete`  
Auth: header `X-AICA-API-Key: $AICA_API_KEY` (or `?api_key=` on server-side GET only).

### Autocomplete

```bash
curl -sG "https://aica-apis.quebecstore.ca/v1/address/autocomplete/canada" \
  --data-urlencode "search=123 main" \
  -H "X-AICA-API-Key: $AICA_API_KEY"
```

### Validate

```bash
curl -sG "https://aica-apis.quebecstore.ca/v1/address/validate" \
  --data-urlencode "address=1 YONGE ST, TORONTO, ON, M5E 1E5" \
  -H "X-AICA-API-Key: $AICA_API_KEY"
```

A high-rise can return several unit/building choices instead of a single “validated” line ([`examples/validate.json`](examples/validate.json)):

```json
{
  "status": "success",
  "validated": false,
  "confidence": 100,
  "input": "1 YONGE ST, TORONTO, ON, M5E 1E5",
  "reason": "multiple_matches",
  "choices": [
    { "choice": 1, "result": "1 YONGE ST, TORONTO, ON, M5E 1E5" },
    { "choice": 2, "result": "1700-1 YONGE ST, TORONTO, ON, M5E 1E5" }
  ]
}
```

### Reverse geocode

![Reverse geocode try tool with latitude, longitude, and request URL](screenshots/reverse-geocode.png)

```bash
curl -sG "https://aica-apis.quebecstore.ca/v1/address/reverse-geocode" \
  --data-urlencode "lat=43.649618" \
  --data-urlencode "lon=-79.376888" \
  -H "X-AICA-API-Key: $AICA_API_KEY"
```

Nearest buildings, with distance in metres ([`examples/reverse-geocode.json`](examples/reverse-geocode.json)):

```json
{
  "status": "success",
  "type": "reverse-geocode",
  "query": { "lat": 43.649618, "lon": -79.376888 },
  "results": [
    {
      "confidence": 95,
      "distance_meters": 16,
      "address": "21 VICTORIA ST",
      "city": "FORMER TORONTO",
      "province": "ON",
      "coordinates": { "lat": 43.6496464, "lon": -79.376695 }
    }
  ]
}
```

Do not round coordinates before sending them.

---

## Coding agents

Paste or `@`-mention these files (they are the usual names agents look for):

| File | What it is |
|------|------------|
| [`AGENTS.md`](AGENTS.md) | Full integration spec (Cursor, Copilot, Claude Code, Windsurf, Codex) |
| [`llms.txt`](llms.txt) | Short product facts for crawlers and chat tools |
| [`docs/agentic-coding.md`](docs/agentic-coding.md) | Same spec as `AGENTS.md` |
| [`CLAUDE.md`](CLAUDE.md) | Pointer for Claude Code |

If the agent does not already know the stack from the repo or chat, it should **ask** (PHP, Node, .NET, …) before writing files.

Human docs (HTML): https://aicaaddresscomplete.com/documentation

---

## Server-side vs widget

| Path | Key | Notes |
|------|-----|--------|
| Hosted widget | Widget key in `data-api-key` | Domain allowlist required |
| Same-origin proxy | Server key on the backend only | Widget uses `data-api-base="/api/aica-proxy"` |
| Direct REST | Server key in env / config | Best for jobs, cURL, admin tools |

PHP, Node/Express, and ASP.NET samples are on the [documentation](https://aicaaddresscomplete.com/documentation#integrate) page.

---

## Links

- [Dashboard](https://aica-apis.quebecstore.ca/aica-adresse-auto-complete/account/dashboard)
- [API management / allowlist](https://aica-apis.quebecstore.ca/aica-adresse-auto-complete/account/dashboard/api-manage)
- [Billing](https://aica-apis.quebecstore.ca/aica-adresse-auto-complete/account/dashboard/billing)
- [Contact](https://aicaaddresscomplete.com/contact)

Hosted in Canada.

## License

[MIT](LICENSE) for this repo (widget copies, examples, docs). The hosted API and address data are a commercial service — you still need an account and a plan or credits to call it.
