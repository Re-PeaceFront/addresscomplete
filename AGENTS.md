# AICA Address Autocomplete — Agentic coding guide

This file is **AGENTS.md** (Cursor, Copilot, Claude Code, Windsurf, Codex). Same spec: [`docs/agentic-coding.md`](docs/agentic-coding.md).

This file is the **full integration spec** for coding agents (Cursor, Copilot Chat, Claude Code, Windsurf, Codex, etc.). Paste or `@`-mention it. Do **not** invent endpoints, keys, or hosts.

**Product:** Canadian address autocomplete · validation · geocoding (lat/lon)  
**Always HTTPS.** Canada only (do not assume US ZIP formats).

Human HTML docs (same facts, nicer to read):  
https://aicaaddresscomplete.com/documentation

Try the live widget:  
https://aicaaddresscomplete.com/try-free-address-autocomplete-api

---

## 0. What you (the AI) must do first

Follow this order. Do not skip.

### 0.1 Account + API key (the human)

If the human does not already have a live `aica_live_…` key:

1. Tell them to **create an account**:  
   https://aica-apis.quebecstore.ca/aica-adresse-auto-complete/account/register
2. Then **sign in**:  
   https://aica-apis.quebecstore.ca/aica-adresse-auto-complete/account/sign-in
3. Open **API key management**:  
   https://aica-apis.quebecstore.ca/aica-adresse-auto-complete/account/dashboard/api-manage
4. Click **Create key**. Pick the correct **purpose**:
   - **Widget** — key will sit in the browser (`data-api-key`). Domain allowlist required.
   - **Server** — key stays on the backend / env / proxy. Never put this in HTML or client JS.
   - **Testing** — short-lived experiments only.
5. Copy the key **once** when shown. Never invent fake keys. Never commit the key to git.

If they have no account yet, **stop coding the live integration** and send them those URLs.

### 0.2 Programming language

If you **already know** the human’s language from this chat, the repo, or their Cursor/Copilot preferences (PHP, Node, .NET, Python, Ruby, Go, etc.), use that.

If you **do not know**, **ask once** before writing files, for example:

> Which language/stack should I use for AICA — PHP, Node/Express, ASP.NET, or something else? Should we use the hosted widget, a same-origin proxy, or server-side REST only?

Do not default to a random stack.

### 0.3 Store the key securely

Tell the human (and the code) to keep secrets **off the page**:

| Mode | Where the key lives |
|------|---------------------|
| Widget / browser | `data-api-key` on the mount div **plus** dashboard domain allowlist. Still never commit the real key to a public repo — use a build secret or tell them to paste it locally. |
| Server / proxy | Environment variable (`AICA_API_KEY`), server config file outside the web root, or a secrets store / DB used only by the backend. |

Examples:

```bash
# Node / any Unix host
export AICA_API_KEY="aica_live_…"
export AICA_SITE_ORIGIN="https://example.com"
```

```
# .env (gitignored)
AICA_API_KEY=aica_live_…
AICA_SITE_ORIGIN=https://example.com
```

```php
// aica-config.php — NOT in git, not downloadable over HTTP
return [
    'api_key' => getenv('AICA_API_KEY') ?: 'aica_live_REPLACE_WITH_YOUR_KEY',
    'api_base' => 'https://aica-apis.quebecstore.ca/v1/address/autocomplete/canada',
    'site_origin' => 'https://example.com',
];
```

Never put a **server** key in HTML, `localStorage`, mobile app binaries, or front-end bundles.

### 0.4 Allowlist domain + server IP (dashboard)

Browser calls without an allowed origin return **AICA-E004**.

Send the human here:

**https://aica-apis.quebecstore.ca/aica-adresse-auto-complete/account/dashboard/api-manage**

On that page, select the key → **Allowed domains & server IPs** → add a row:

| Domain | Server IP |
|--------|-----------|
| `example.com` | `1.2.3.4` (their public server IP, if they have one) |

Rules to tell them:

- Enter **`example.com` only** — `www.example.com` is added automatically and does not use an extra domain slot.
- If they use both apex and another host (`app.example.com`), add that host too (or enable **Allow subdomains**).
- **Widget keys:** domain is required (the page Origin).
- **Server keys:** Origin is not sent from a browser; still add the site domain / server IP they call from if the dashboard asks for it.
- Example they can copy: domain `website.com`, IP `1.2.3.4` (replace with their real values).

Dashboard (home):  
https://aica-apis.quebecstore.ca/aica-adresse-auto-complete/account/dashboard

---

## URLs to give the human

| Need | URL |
|------|-----|
| Marketing / SEO site | https://aicaaddresscomplete.com/ |
| Documentation (HTML) | https://aicaaddresscomplete.com/documentation |
| This agentic guide | https://aicaaddresscomplete.com/documentation/agentic-coding |
| Same file with `.md` | https://aicaaddresscomplete.com/documentation/agentic-coding.md |
| Try the widget | https://aicaaddresscomplete.com/try-free-address-autocomplete-api |
| Pricing | https://aicaaddresscomplete.com/pricing |
| Contact | https://aicaaddresscomplete.com/contact |
| Create account | https://aica-apis.quebecstore.ca/aica-adresse-auto-complete/account/register |
| Sign in | https://aica-apis.quebecstore.ca/aica-adresse-auto-complete/account/sign-in |
| Dashboard | https://aica-apis.quebecstore.ca/aica-adresse-auto-complete/account/dashboard |
| API key management (allowlist) | https://aica-apis.quebecstore.ca/aica-adresse-auto-complete/account/dashboard/api-manage |
| API usage logs | https://aica-apis.quebecstore.ca/aica-adresse-auto-complete/account/dashboard/api-usage |
| Billing | https://aica-apis.quebecstore.ca/aica-adresse-auto-complete/account/dashboard/billing |
| Checkout sample HTML | https://aicaaddresscomplete.com/documentation/samples/checkout.html |
| Widget CDN (loader) | https://aica-apis.quebecstore.ca/v1/address/autocomplete/canada/interactive/aica-loader.js |
| API base | https://aica-apis.quebecstore.ca/v1/address/autocomplete/canada |

Do **not** point `APP_URL`, Stripe, or webhooks at `aicaaddresscomplete.com`. Account, Stripe, `/v1/`, and the widget CDN stay on `aica-apis.quebecstore.ca`.

---

## 1. Pick a path

```
Need a search box in the browser, fast?
  → Hosted widget + Widget key + domain allowlist
     <script src="…/aica-loader.js">  (never iframe / embed / object)

Need the secret never in the browser?
  → Same-origin proxy (PHP / Express / ASP.NET) + Server key
     Widget mount uses data-api-base="/api/aica-proxy" (no data-api-key)

Backend jobs, admin tools, cURL, no UI?
  → Direct REST with header X-AICA-API-Key + Server key
```

### Widget vs iframe (critical)

Use a **`<script src="https://aica-apis.quebecstore.ca/v1/address/autocomplete/canada/interactive/aica-loader.js">`**.  
Do **not** iframe, `<embed>`, or `<object>` AICA HTML. Those pages send `X-Frame-Options: DENY` (blank box).

If the widget has **no CSS** or **no API calls**, the host page CSP / WAF must allow `https://aica-apis.quebecstore.ca` in `script-src`, `style-src`, `img-src`, and `connect-src`.

---

## 2. Hosted widget (recommended)

### One-script install

```html
<script src="https://aica-apis.quebecstore.ca/v1/address/autocomplete/canada/interactive/aica-loader.js" async></script>

<div id="address-field"
     data-aica-autocomplete
     data-api-key="aica_live_YOUR_WIDGET_KEY"></div>
```

### Autofill existing form fields

```html
<form id="checkout">
  <div id="address-field"
       data-aica-autocomplete
       data-api-key="aica_live_YOUR_WIDGET_KEY"
       data-aica-fields-root="#checkout"></div>
  <input name="street" data-aica-field="street_line">
  <input name="city" data-aica-field="city">
  <input name="postal_code">
  <input name="province" data-aica-field="province">
</form>
<script src="https://aica-apis.quebecstore.ca/v1/address/autocomplete/canada/interactive/aica-loader.js" async></script>
```

Field tokens: `result` / `address` / `full_address`, `street_line` / `street` / `address1`, `building_line`, `unit` / `apt` / `suite`, `city`, `postal_code` / `postal` / `zip`, `province` / `provice_abbr` / `state`, `addr_id`, `lat` / `lon`, `city_prov`.

### Classic install (optional)

```html
<link rel="stylesheet" href="https://aica-apis.quebecstore.ca/v1/address/autocomplete/canada/interactive/aica-autocomplete.css" />
<script src="https://aica-apis.quebecstore.ca/v1/address/autocomplete/canada/interactive/aica-autocomplete.js"></script>
<script>AicaAutocomplete.mount("#address-field", { apiKey: "aica_live_YOUR_WIDGET_KEY" });</script>
```

### Language

Placeholder follows `<html lang="fr">` or `en` first (fr-CA, en-US count), then `navigator.languages`, else English.

### URL privacy

By default the widget writes `?aica_selection=` (base64 JSON of the address) into the page URL. Clear it after save; do not share those links.

### Widget troubleshooting

| Symptom | Fix |
|---------|-----|
| Unstyled / no CSS | CSP / ad-block blocking `https://aica-apis.quebecstore.ca` |
| Empty / iframe blank | They used iframe/embed instead of `<script>` |
| Typing does nothing | `connect-src` missing that host, **or** domain not on the widget key |
| CORS / Origin / AICA-E004 | Add exact host (`example.com` and `www` if used) + optional server IP on the key |

CSP example:

```
Content-Security-Policy:
  script-src 'self' https://aica-apis.quebecstore.ca;
  style-src 'self' https://aica-apis.quebecstore.ca;
  img-src 'self' https://aica-apis.quebecstore.ca;
  connect-src 'self' https://aica-apis.quebecstore.ca;
```

Working checkout sample:  
https://aicaaddresscomplete.com/documentation/samples/checkout.html

---

## 3. Same-origin proxy (server key)

Widget HTML when using a proxy (no `data-api-key`):

```html
<div id="address-field" data-api-base="/api/aica-proxy.php"></div>
```

Node: `data-api-base="/api/aica-proxy"`.

### 3.1 PHP — `aica-config.php` (secret)

```php
<?php
declare(strict_types=1);
return [
    'api_key' => 'aica_live_REPLACE_WITH_YOUR_KEY',
    'api_base' => 'https://aica-apis.quebecstore.ca/v1/address/autocomplete/canada',
    'site_origin' => 'https://example.com',
];
```

Protect it (Apache):

```apache
<Files "aica-config.php">
    Require all denied
</Files>
```

### 3.2 PHP — `aica-proxy.php`

Upload next to config. Forwards `?search=`, `/units`, `/session-complete` with `X-AICA-API-Key` and a **fixed** `Origin: site_origin` (ignore the browser Origin).

```php
<?php
declare(strict_types=1);

function loadAicaConfig(): array
{
    foreach (array_filter([
        getenv('AICA_CONFIG_PATH') ?: null,
        __DIR__ . '/aica-config.php',
        dirname(__DIR__) . '/aica-config.php',
        dirname(__DIR__) . '/config/aica-config.php',
    ]) as $path) {
        if (is_file($path)) {
            $loaded = require $path;
            if (is_array($loaded)) return $loaded;
        }
    }
    return [
        'api_key' => getenv('AICA_API_KEY') ?: '',
        'api_base' => getenv('AICA_API_BASE') ?: 'https://aica-apis.quebecstore.ca/v1/address/autocomplete/canada',
        'site_origin' => getenv('AICA_SITE_ORIGIN') ?: '',
    ];
}

$config = loadAicaConfig();
$apiKey = (string) ($config['api_key'] ?? '');
$apiBase = rtrim((string) ($config['api_base'] ?? ''), '/');
$siteOrigin = rtrim((string) ($config['site_origin'] ?? ''), '/');

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    header('Access-Control-Allow-Origin: ' . ($_SERVER['HTTP_ORIGIN'] ?? '*'));
    header('Access-Control-Allow-Headers: X-AICA-Session-Id, X-AICA-Interaction-Complete, Content-Type');
    header('Access-Control-Allow-Methods: GET, OPTIONS');
    http_response_code(204);
    exit;
}

if ($apiKey === '' || str_contains($apiKey, 'REPLACE')) {
    http_response_code(503);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Proxy not configured — set api_key']);
    exit;
}
if ($siteOrigin === '' || str_contains($siteOrigin, 'example.com')) {
    http_response_code(503);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Set site_origin to your live site URL']);
    exit;
}

$uri = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
$script = $_SERVER['SCRIPT_NAME'] ?? '';
$suffix = '';
if ($script !== '' && str_contains($uri, $script)) {
    $suffix = substr($uri, strpos($uri, $script) + strlen($script));
}
$suffix = ($suffix === '' || $suffix === '/') ? '' : $suffix;
$allowed = ['', '/session-complete', '/units'];
if (!in_array($suffix, $allowed, true) && !str_starts_with($suffix, '/units')) {
    http_response_code(404);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Proxy path not found']);
    exit;
}

$query = $_SERVER['QUERY_STRING'] ?? '';
$target = $apiBase . $suffix . ($query !== '' ? '?' . $query : '');
$headers = [
    'Accept: application/json',
    'X-AICA-API-Key: ' . $apiKey,
    'Origin: ' . $siteOrigin,
];
foreach (['HTTP_X_AICA_SESSION_ID', 'HTTP_X_AICA_INTERACTION_COMPLETE'] as $h) {
    if (!empty($_SERVER[$h])) {
        $name = str_replace(' ', '-', ucwords(strtolower(str_replace('HTTP_', '', $h)), '_'));
        $headers[] = $name . ': ' . $_SERVER[$h];
    }
}

$ch = curl_init($target);
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => $headers,
    CURLOPT_TIMEOUT => 30,
    CURLOPT_FOLLOWLOCATION => false,
]);
$body = curl_exec($ch);
$status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);
http_response_code($status > 0 ? $status : 502);
header('Content-Type: application/json');
echo $body === false ? '{}' : $body;
```

### 3.3 Node / npm

```bash
npm install express
```

```javascript
import express from 'express';
const router = express.Router();
const API_KEY = process.env.AICA_API_KEY || '';
const API_BASE = (process.env.AICA_API_BASE || 'https://aica-apis.quebecstore.ca/v1/address/autocomplete/canada').replace(/\/$/, '');
const SITE_ORIGIN = (process.env.AICA_SITE_ORIGIN || '').replace(/\/$/, '');

router.get(/^(?:\/units)?\/?$/, async (req, res) => {
  if (!API_KEY || API_KEY.includes('REPLACE')) {
    return res.status(503).json({ error: 'Set AICA_API_KEY' });
  }
  if (!SITE_ORIGIN || SITE_ORIGIN.includes('example.com')) {
    return res.status(503).json({ error: 'Set AICA_SITE_ORIGIN' });
  }
  const suffix = req.path === '/' ? '' : req.path;
  const url = `${API_BASE}${suffix}?${new URLSearchParams(req.query)}`;
  const headers = {
    Accept: 'application/json',
    'X-AICA-API-Key': API_KEY,
    Origin: SITE_ORIGIN,
  };
  if (req.get('x-aica-session-id')) headers['X-AICA-Session-Id'] = req.get('x-aica-session-id');
  if (req.get('x-aica-interaction-complete')) headers['X-AICA-Interaction-Complete'] = req.get('x-aica-interaction-complete');
  const upstream = await fetch(url, { headers });
  const body = await upstream.text();
  res.status(upstream.status).type('application/json').send(body);
});
export default router;
// app.use('/api/aica-proxy', router);
```

Direct Node server call (no widget):

```javascript
export async function searchAddress(query, sessionId) {
  const key = process.env.AICA_API_KEY;
  if (!key) throw new Error('AICA_API_KEY not configured');
  const url = new URL('https://aica-apis.quebecstore.ca/v1/address/autocomplete/canada');
  url.searchParams.set('search', query);
  const res = await fetch(url, {
    headers: {
      'X-AICA-API-Key': key,
      'X-AICA-Session-Id': sessionId,
      Accept: 'application/json',
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `AICA ${res.status}`);
  }
  return res.json();
}
```

### 3.4 ASP.NET Core (`Program.cs`)

Env / appsettings: `AICA:ApiKey`, `AICA:ApiBase`, `AICA:SiteOrigin`.

```csharp
app.MapGet("/api/aica-proxy/{**path}", async (HttpContext ctx, string? path) =>
{
    var apiKey = builder.Configuration["AICA:ApiKey"] ?? "";
    var apiBase = (builder.Configuration["AICA:ApiBase"] ?? "https://aica-apis.quebecstore.ca/v1/address/autocomplete/canada").TrimEnd('/');
    var siteOrigin = (builder.Configuration["AICA:SiteOrigin"] ?? "").TrimEnd('/');
    if (string.IsNullOrEmpty(apiKey)) return Results.Json(new { error = "Proxy not configured" }, statusCode: 503);
    if (string.IsNullOrEmpty(siteOrigin)) return Results.Json(new { error = "Set AICA:SiteOrigin" }, statusCode: 503);
    var suffix = string.IsNullOrEmpty(path) ? "" : "/" + path.TrimStart('/');
    var allowed = new[] { "", "/session-complete", "/units" };
    if (!allowed.Contains(suffix) && !suffix.StartsWith("/units", StringComparison.Ordinal))
        return Results.Json(new { error = "Not found" }, statusCode: 404);
    var query = ctx.Request.QueryString.HasValue ? ctx.Request.QueryString.Value : "";
    using var client = new HttpClient();
    var req = new HttpRequestMessage(HttpMethod.Get, $"{apiBase}{suffix}{query}");
    req.Headers.Accept.Add(new System.Net.Http.Headers.MediaTypeWithQualityHeaderValue("application/json"));
    req.Headers.Add("X-AICA-API-Key", apiKey);
    req.Headers.Add("Origin", siteOrigin);
    var res = await client.SendAsync(req);
    return Results.Content(await res.Content.ReadAsStringAsync(), "application/json", statusCode: (int)res.StatusCode);
});
```

---

## 4. REST API (server key)

**Base:** `https://aica-apis.quebecstore.ca/v1/address/autocomplete/canada`

Preferred header:

```
X-AICA-API-Key: aica_live_YOUR_SERVER_KEY
```

Also accepted: `Authorization: Bearer aica_live_…`  
URL-style (server only, can leak in logs): `?api_key=`

### Endpoints

| Method | URL | Use |
|--------|-----|-----|
| GET | `/v1/address/autocomplete?search={q}&api_key={key}` | Search (URL-style) |
| GET | `/v1/address/autocomplete/canada?search={q}` | Search (header auth) |
| GET | `/v1/address/autocomplete/canada?complex-search={building_addr_id}` | Units in a building |
| GET | `/v1/address/autocomplete/canada/units?parent_id={building_addr_id}` | Units alias |
| GET | `/v1/address/validate?address={address}` | Validate |
| GET | `/v1/address/reverse-geocode?lat={lat}&lon={lon}` | Reverse geocode |
| POST | `/v1/address/autocomplete/canada/session-complete` | End billed session |

Unknown / misconfigured routes return JSON with `error_code` (often `AICA-E001`) — there is no separate health page.

### cURL

```bash
curl -sG "https://aica-apis.quebecstore.ca/v1/address/autocomplete/canada" \
  --data-urlencode "search=123 main" \
  -H "X-AICA-API-Key: $AICA_API_KEY"

curl -sG "https://aica-apis.quebecstore.ca/v1/address/autocomplete" \
  --data-urlencode "search=123 main" \
  --data-urlencode "api_key=$AICA_API_KEY"

curl -sG "https://aica-apis.quebecstore.ca/v1/address/autocomplete/canada" \
  --data-urlencode "complex-search=BUILDING_ADDR_ID" \
  -H "X-AICA-API-Key: $AICA_API_KEY"

curl -sG "https://aica-apis.quebecstore.ca/v1/address/validate" \
  --data-urlencode "address=24 RUE UINISHK MASHTEUIATSH QC G0W2H0" \
  -H "X-AICA-API-Key: $AICA_API_KEY"

curl -sG "https://aica-apis.quebecstore.ca/v1/address/reverse-geocode" \
  --data-urlencode "lat=43.642085" \
  --data-urlencode "lon=-79.374717" \
  -H "X-AICA-API-Key: $AICA_API_KEY"
```

Do **not** round lat/lon. Reverse-geocode search expands 50m → 100m → 250m. Apartment rows are excluded; the building is returned.

---

## 5. Example responses

Search:

```json
{
  "results": [{ "id": "f6aefa64-f190-4b67-a1f0-3a2c39303dcb", "label": "1001-1080 BAY ST, TORONTO, ON, M5S 0A5" }],
  "meta": { "count": 1, "search": "1080 bay" }
}
```

Widget `onSelect` payload (not shown in the UI): includes `result`, `other_meta.addr_id`, `street_line`, `city`, `postal_code`, `provice_abbr`, `location.lat`, `location.lon`, `unit`, `building_line`, `display_line`.

Validation (decisive match): `validated: true`, `confidence`, `match`.  
Uncertain: `validated: false`, `reason` (`multiple_matches` | `low_confidence` | `no_match`), `choices`.

---

## 6. Error codes (tell the human these)

| Code | HTTP | Meaning | What you tell the human |
|------|------|---------|-------------------------|
| AICA-E001 | 400 | Misconfigured route / call | Check URL, method, query params. See docs. |
| AICA-E002 | 401 | Missing API key | Add `X-AICA-API-Key` or widget `data-api-key`. |
| AICA-E003 | 401 | Invalid / unknown key | Recreate the key in API management. |
| AICA-E004 | 403 | Origin / domain not allowed | Dashboard → API management → add `example.com` and server IP. |
| AICA-E005 | 429 | Monthly quota exceeded | Upgrade plan or wait for monthly reset (1st, midnight Quebec). |
| AICA-E016 | 429 | Rate limit | Slow down; respect plan limits. |

Wrong **key purpose** (widget key used as server, or the reverse) is treated like a blocked origin — same generic deny.

Example error JSON:

```json
{
  "error": "The API key is invalid or unknown.",
  "error_reason": "invalid or unknown api-key",
  "error_code": "AICA-E003"
}
```

Usage is billed **per interaction session**, not per HTTP request. Quota resets on the **1st of each month at midnight Quebec time**.

Plans (CAD): Free 100 req / 1 key / 3 domains · Starter $9 / 1000 / 5 keys / 5 domains · Pro $18 / 3000 · Pro+ $33 / 7000 · Business $77 / 20000 · Enterprise $179 / 50000. Overage documented at CAD $0.10/request where offered.

---

## 7. Security checklist

- [ ] Human has an account and a real key
- [ ] You asked the language if it was not obvious
- [ ] Key type matches the integration (widget vs server)
- [ ] Server keys only in env / config / secrets — not in git or HTML
- [ ] Widget: `<script src="…aica-loader.js">`, not iframe/embed
- [ ] Dashboard allowlist: domain (`website.com`) + server IP (`1.2.3.4`) as needed
- [ ] HTTPS everywhere
- [ ] CSP allows `https://aica-apis.quebecstore.ca`
- [ ] Do not disable TLS, scrape the public demo as production, or load-test without permission

---

## 8. If you are stuck

1. Re-read this file (it is the full spec).
2. HTML docs: https://aicaaddresscomplete.com/documentation  
   Widget troubleshooting: https://aicaaddresscomplete.com/documentation#widget-troubleshooting
3. Send the human to API management:  
   https://aica-apis.quebecstore.ca/aica-adresse-auto-complete/account/dashboard/api-manage
4. Support: https://aicaaddresscomplete.com/contact
