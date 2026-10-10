/**
 * AICA Address Autocomplete — embed widget
 * Host: /v1/address/autocomplete/canada/interactive/aica-autocomplete.js
 *
 * WEBSITE OWNERS — capturing the visitor's selected address
 * -------------------------------------------------------
 * The widget does NOT show JSON to end users. When a visitor selects an address,
 * your site receives a payload: { result: "street, city, QC, postal", other_meta: { ... } }
 *
 * WAY 1 (recommended): pass onSelect when calling mount()
 *   AicaAutocomplete.mount('#aica-address', {
 *     onSelect: function (payload) {
 *       // save payload.other_meta.addr_id, payload.result, etc.
 *     },
 *   });
 *   // Or: document.querySelector('#aica-address').addEventListener('aica-select', function (e) { e.detail });
 *
 * WAY 2: read from page URL after selection (?aica_selection=base64-json)
 *   var payload = AicaAutocomplete.readUrlSelection('aica_selection');
 *
 * WAY 3 (optional autofill): map selection into existing form fields — no JSON required
 *   <input name="city" data-aica-field="city" />
 *   <input name="postal_code" />
 *   Or: AicaAutocomplete.mount('#aica-address', { fields: { city: '#city' } });
 *
 * WIDGET (no proxy): set data-api-key on the mount element and allowlist your
 * site domain in the AICA dashboard (Canada Post AddressComplete-style).
 * ADVANCED: data-api-base can point at your own proxy that injects the key instead.
 */
(function (global) {
  'use strict';

  var DEFAULT_API = 'https://aica-apis.quebecstore.ca/v1/address/autocomplete/canada';
  var DEFAULT_LOGO = 'https://aica-apis.quebecstore.ca/v1/address/autocomplete/canada/interactive/aica-logo-extra-extra-extra-small-default-versio-full-sysmbol-and-txt-aica-permission-granted-partners.png';
  var FALLBACK_LOGO = 'https://quebecstore.ca/media-api/AICA-logo-Tiguidou_Web-All-purpose-use-permission-granted-partners.png';
  var FALLBACK_CSS = 'https://quebecstore.ca/global-apis/aica-autocomplete.css';
  var FALLBACK_JS = 'https://quebecstore.ca/global-apis/aica-autocomplete.js';
  var MIN_CHARS = 3;
  var DEBOUNCE_MS = 300;
  var LOADER_DELAY_MS = 5000;
  var REQUEST_TIMEOUT_MS = 25000;

  /** Canonical fill tokens → aliases matched against name/id/autocomplete/data-aica-field */
  var FIELD_ALIASES = {
    result: ['result', 'address', 'full_address', 'fulladdress', 'formatted_address', 'shipping_address', 'billing_address'],
    street_line: ['street_line', 'streetline', 'street', 'address1', 'address_1', 'addr1', 'line1', 'address_line1', 'street_address'],
    building_line: ['building_line', 'buildingline', 'building', 'street_name'],
    unit: ['unit', 'apt', 'apartment', 'suite', 'unit_number', 'appart'],
    city: ['city', 'locality', 'town', 'municipality'],
    postal_code: ['postal_code', 'postalcode', 'postal', 'zip', 'zipcode', 'zip_code', 'postcode'],
    province: ['province', 'provice_abbr', 'province_abbr', 'state', 'region', 'prov'],
    addr_id: ['addr_id', 'addrid', 'address_id', 'aica_addr_id'],
    lat: ['lat', 'latitude'],
    lon: ['lon', 'lng', 'longitude'],
    city_prov: ['city_prov', 'city_province'],
  };

  var ALIAS_TO_TOKEN = (function () {
    var map = {};
    Object.keys(FIELD_ALIASES).forEach(function (token) {
      FIELD_ALIASES[token].forEach(function (alias) {
        map[normalizeFieldKey(alias)] = token;
      });
    });
    return map;
  })();

  function normalizeFieldKey(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '');
  }

  function tokenFromAttr(value) {
    var key = normalizeFieldKey(value);
    return ALIAS_TO_TOKEN[key] || null;
  }

  function valuesFromPayload(payload) {
    var meta = (payload && payload.other_meta) || {};
    var loc = meta.location || {};
    var city = meta.city || '';
    var prov = meta.provice_abbr || meta.province_abbr || '';
    return {
      result: (payload && payload.result) || '',
      street_line: meta.street_line || '',
      building_line: meta.building_line || '',
      unit: meta.unit || '',
      city: city,
      postal_code: meta.postal_code || '',
      province: prov,
      addr_id: meta.addr_id || '',
      lat: loc.lat != null ? String(loc.lat) : '',
      lon: loc.lon != null ? String(loc.lon) : '',
      city_prov: [city, prov].filter(Boolean).join(', '),
    };
  }

  function resolveFieldsRoot(el, options) {
    var selector = el.dataset.aicaFieldsRoot || options.fieldsRoot || '';
    if (selector) {
      var scoped = typeof selector === 'string' ? document.querySelector(selector) : selector;
      if (scoped) return scoped;
    }
    var form = el.closest && el.closest('form');
    return form || document;
  }

  function setControlValue(node, value) {
    if (!node) return;
    var tag = (node.tagName || '').toLowerCase();
    if (tag === 'select') {
      node.value = value;
      if (node.value !== value) {
        var opts = node.options;
        for (var i = 0; i < opts.length; i++) {
          if (normalizeFieldKey(opts[i].value) === normalizeFieldKey(value) ||
              normalizeFieldKey(opts[i].text) === normalizeFieldKey(value)) {
            node.selectedIndex = i;
            break;
          }
        }
      }
    } else if (tag === 'textarea' || tag === 'input') {
      var type = (node.type || 'text').toLowerCase();
      if (type === 'checkbox' || type === 'radio' || type === 'button' || type === 'submit' || type === 'file') {
        return;
      }
      node.value = value;
    } else if (node.isContentEditable) {
      node.textContent = value;
    } else {
      return;
    }
    try {
      node.dispatchEvent(new Event('input', { bubbles: true }));
      node.dispatchEvent(new Event('change', { bubbles: true }));
    } catch (e) { /* older browsers */ }
  }

  function getControlValue(node) {
    if (!node) return '';
    var tag = (node.tagName || '').toLowerCase();
    if (tag === 'select' || tag === 'textarea' || tag === 'input') return node.value || '';
    if (node.isContentEditable) return node.textContent || '';
    return '';
  }

  function collectExplicitTargets(el, options, root) {
    var targets = {}; // token -> element
    var fieldsOpt = options.fields || {};
    Object.keys(fieldsOpt).forEach(function (rawToken) {
      var token = tokenFromAttr(rawToken) || normalizeFieldKey(rawToken);
      if (!FIELD_ALIASES[token]) return;
      var sel = fieldsOpt[rawToken];
      var node = typeof sel === 'string' ? root.querySelector(sel) || document.querySelector(sel) : sel;
      if (node) targets[token] = node;
    });

    Array.prototype.forEach.call(el.attributes || [], function (attr) {
      if (!attr || !attr.name) return;
      var m = attr.name.match(/^data-aica-fill-(.+)$/i);
      if (!m) return;
      var token = tokenFromAttr(m[1]);
      if (!token) return;
      var node = root.querySelector(attr.value) || document.querySelector(attr.value);
      if (node) targets[token] = node;
    });

    return targets;
  }

  function findHeuristicTargets(root, claimed) {
    var targets = {};
    var nodes = root.querySelectorAll('input, select, textarea, [data-aica-field]');
    Array.prototype.forEach.call(nodes, function (node) {
      if (node.closest && node.closest('.aica-ac')) return;
      var type = (node.type || '').toLowerCase();
      if (type === 'hidden' && !node.getAttribute('data-aica-field') && !node.name && !node.id) return;
      if (type === 'password' || type === 'submit' || type === 'button' || type === 'file' || type === 'checkbox' || type === 'radio') return;

      var token = null;
      var attrField = node.getAttribute('data-aica-field');
      if (attrField) token = tokenFromAttr(attrField);
      if (!token) token = tokenFromAttr(node.getAttribute('autocomplete'));
      if (!token) token = tokenFromAttr(node.name);
      if (!token) token = tokenFromAttr(node.id);
      if (!token || claimed[token] || targets[token]) return;
      targets[token] = node;
    });
    return targets;
  }

  function applyFieldBindings(el, options, payload, writtenRef) {
    var root = resolveFieldsRoot(el, options);
    var values = valuesFromPayload(payload);
    var explicit = collectExplicitTargets(el, options, root);
    var heuristic = findHeuristicTargets(root, explicit);
    var merged = {};
    Object.keys(heuristic).forEach(function (k) { merged[k] = heuristic[k]; });
    Object.keys(explicit).forEach(function (k) { merged[k] = explicit[k]; });

    var written = [];
    Object.keys(merged).forEach(function (token) {
      if (!Object.prototype.hasOwnProperty.call(values, token)) return;
      var node = merged[token];
      var value = values[token];
      if (value == null) value = '';
      setControlValue(node, String(value));
      written.push({ node: node, value: String(value) });
    });
    writtenRef.list = written;
  }

  function clearFieldBindings(writtenRef) {
    var list = (writtenRef && writtenRef.list) || [];
    list.forEach(function (entry) {
      if (!entry || !entry.node) return;
      if (getControlValue(entry.node) === entry.value) {
        setControlValue(entry.node, '');
      }
    });
    if (writtenRef) writtenRef.list = [];
  }

  var ERROR_MESSAGES = {
    'AICA-E002': "We're sorry, unable to process your request. Please try again later.",
    'AICA-E003': "We're sorry, unable to process your request. Please try again later.",
    'AICA-E004': "We're sorry, unable to process your request. Please try again later.",
    'AICA-E005': "We're sorry, unable to process your request. Please try again later.",
    'AICA-E006': "We're sorry, unable to process your request. Please try again later.",
    'AICA-E007': 'The address service is temporarily offline. Please try again later.',
    'AICA-E008': "We're sorry, unable to process your request. Please try again later.",
    'AICA-E009': "We're sorry, the service is busy. Please try again in a moment.",
    'AICA-E010': "We're sorry, unable to process your request. Please try again later.",
    'AICA-E011': 'Invalid search query.',
    'AICA-E012': 'Address search is temporarily unavailable. Please try again later.',
    'AICA-E013': "We're sorry, unable to process your request. Please try again later.",
    'AICA-E014': "We're sorry, unable to process your request. Please try again later.",
    'AICA-E015': "We're sorry, unable to process your request. Please try again later.",
    'AICA-E016': "We're sorry, unable to process your request. Please try again later.",
  };

  function messageForError(err) {
    if (!err) return ERROR_MESSAGES['AICA-E010'];
    // Prefer opaque UI copy — never surface auth/purpose/origin reason text in the widget.
    if (err.code && ERROR_MESSAGES[err.code]) return ERROR_MESSAGES[err.code];
    return ERROR_MESSAGES['AICA-E010'];
  }

  function formatCityDisplay(city) {
    if (!city || !String(city).trim()) return '';
    return String(city).trim().toLocaleUpperCase('fr-CA');
  }

  function formatDisplayLine(item) {
    if (!item) return '';
    if (item.display_line) return item.display_line;
    if (item.result) return item.result;
    var street = item.street_line || item.full_addr || '';
    var city = formatCityDisplay(item.city);
    var prov = (item.provice_abbr || '').trim().toUpperCase();
    var postal = (item.postal_code || '').trim().toUpperCase();
    return [street, city, prov, postal].filter(Boolean).join(', ');
  }

  function normalizeUnit(item) {
    if (item && item.result && item.other_meta) return item;
    return {
      result: formatDisplayLine(item),
      other_meta: item,
    };
  }

  function buildPayload(item) {
    var normalized = item.other_meta ? item : normalizeUnit(item);
    return {
      result: normalized.result,
      other_meta: normalized.other_meta,
    };
  }

  function isBuilding(item) {
    return Boolean(item && item.is_address_building && item.unit_count > 0 && item.addr_id);
  }

  function encodePayload(payload) {
    try {
      return btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
    } catch (e) {
      return '';
    }
  }

  function decodePayload(encoded) {
    if (!encoded) return null;
    try {
      return JSON.parse(decodeURIComponent(escape(atob(encoded))));
    } catch (e) {
      return null;
    }
  }

  function newSessionId() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    return 'sess-' + Date.now() + '-' + Math.random().toString(16).slice(2);
  }

  function detectUiLang() {
    var candidates = [];
    try {
      var htmlLang = document.documentElement && document.documentElement.getAttribute('lang');
      if (htmlLang) candidates.push(htmlLang);
    } catch (e) {}
    try {
      if (typeof navigator !== 'undefined') {
        if (navigator.languages && navigator.languages.length) {
          for (var i = 0; i < navigator.languages.length; i++) candidates.push(navigator.languages[i]);
        }
        if (navigator.language) candidates.push(navigator.language);
      }
    } catch (e2) {}
    for (var n = 0; n < candidates.length; n++) {
      var tag = String(candidates[n] || '').toLowerCase().replace('_', '-');
      if (tag === 'fr' || tag.indexOf('fr-') === 0) return 'fr';
      if (tag === 'en' || tag.indexOf('en-') === 0) return 'en';
    }
    return 'en';
  }

  var UI_STRINGS = {
    en: {
      placeholder: 'Search Canadian addresses…',
      searchAria: 'Address search',
      units: 'addresses'
    },
    fr: {
      placeholder: 'Saisir une adresse canadienne…',
      searchAria: 'Recherche d’adresse',
      units: 'adresses'
    }
  };

  function mount(root, options) {
    options = options || {};
    var el = typeof root === 'string' ? document.querySelector(root) : root;
    if (!el) return null;

    var apiBase = el.dataset.apiBase || options.apiBase || DEFAULT_API;
    var apiKey = el.dataset.apiKey || options.apiKey || '';
    var logoUrl = el.dataset.logoUrl || options.logoUrl || DEFAULT_LOGO;
    var urlParam = el.dataset.urlParam || options.urlParam || 'aica_selection';
    var minChars = Number(el.dataset.minChars || options.minChars || MIN_CHARS);
    var ui = UI_STRINGS[detectUiLang()] || UI_STRINGS.en;

    el.classList.add('aica-ac');
    el.innerHTML =
      '<div class="aica-ac-search-wrap">' +
        '<input class="aica-ac-input" type="text" autocomplete="off" placeholder="' + ui.placeholder + '" aria-label="' + ui.searchAria + '" aria-expanded="false" />' +
        '<button class="aica-ac-search-btn" type="button" aria-label="Search">' +
          '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>' +
        '</button>' +
        '<div class="aica-ac-panel" role="listbox">' +
          '<div class="aica-ac-results"></div>' +
          '<div class="aica-ac-footer">' +
            '<img src="' + logoUrl + '" alt="AICA" data-aica-fallback-logo="' + FALLBACK_LOGO + '" onerror="if(!this.dataset.fallbackTried){this.dataset.fallbackTried=\'1\';this.src=this.dataset.aicaFallbackLogo;}" />' +
            '<span class="aica-ac-footer-label">Address Autocomplete</span>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="aica-ac-selected">' +
        '<p class="aica-ac-selected-title">Selected address</p>' +
        '<div class="aica-ac-selected-row">' +
          '<p class="aica-ac-selected-line"></p>' +
          '<button type="button" class="aica-ac-copy-btn" aria-label="Copy address" title="Copy address">' +
            '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>' +
            '<span class="aica-ac-copy-label">Copy</span>' +
          '</button>' +
        '</div>' +
      '</div>' +
      '<div class="aica-ac-status" aria-live="polite" hidden>' +
        '<div class="aica-ac-status-card">' +
          '<div class="aica-ac-spinner" aria-hidden="true"></div>' +
          '<p class="aica-ac-status-text"></p>' +
        '</div>' +
      '</div>';

    var state = {
      mode: 'search',
      items: [],
      activeIndex: -1,
      selection: null,
      abortController: null,
      debounceTimer: null,
      sessionId: newSessionId(),
    };
    var writtenFields = { list: [] };

    function rotateSession() {
      state.sessionId = newSessionId();
    }

    var input = el.querySelector('.aica-ac-input');
    var panel = el.querySelector('.aica-ac-panel');
    var resultsEl = el.querySelector('.aica-ac-results');
    var selectedBox = el.querySelector('.aica-ac-selected');
    var selectedLine = el.querySelector('.aica-ac-selected-line');
    var copyBtn = el.querySelector('.aica-ac-copy-btn');
    var searchBtn = el.querySelector('.aica-ac-search-btn');
    var statusBox = el.querySelector('.aica-ac-status');
    var statusText = el.querySelector('.aica-ac-status-text');

    function showPanelLoader(text) {
      resultsEl.innerHTML =
        '<div class="aica-ac-busy">' +
          '<div class="aica-ac-spinner" aria-hidden="true"></div>' +
          '<p>' + text + '</p>' +
        '</div>';
      openPanel();
    }

    function hidePanelLoader() {
      var busy = resultsEl.querySelector('.aica-ac-busy');
      if (busy) busy.remove();
    }

    function showPanelError(err) {
      resultsEl.innerHTML = '<div class="aica-ac-error">' + messageForError(err) + '</div>';
      openPanel();
    }

    function showStatusError(err) {
      if (!statusBox || !statusText) return;
      statusBox.hidden = false;
      statusBox.classList.remove('is-loading');
      statusBox.classList.add('is-error');
      statusText.textContent = messageForError(err);
    }

    function hideStatus() {
      if (!statusBox) return;
      statusBox.hidden = true;
      statusBox.classList.remove('is-loading', 'is-error');
      if (statusText) statusText.textContent = '';
    }

    function openPanel() {
      panel.classList.add('is-open');
      input.setAttribute('aria-expanded', 'true');
    }

    function closePanel() {
      panel.classList.remove('is-open');
      input.setAttribute('aria-expanded', 'false');
      state.activeIndex = -1;
    }

    function copyToClipboard(text) {
      if (!text) return Promise.reject();
      if (navigator.clipboard && navigator.clipboard.writeText) {
        return navigator.clipboard.writeText(text);
      }
      return new Promise(function (resolve, reject) {
        try {
          var ta = document.createElement('textarea');
          ta.value = text;
          ta.setAttribute('readonly', '');
          ta.style.position = 'fixed';
          ta.style.left = '-9999px';
          document.body.appendChild(ta);
          ta.select();
          var ok = document.execCommand('copy');
          document.body.removeChild(ta);
          ok ? resolve() : reject();
        } catch (e) {
          reject(e);
        }
      });
    }

    function showCopyFeedback() {
      if (!copyBtn) return;
      var label = copyBtn.querySelector('.aica-ac-copy-label');
      copyBtn.classList.add('is-copied');
      copyBtn.setAttribute('aria-label', 'Copied');
      copyBtn.setAttribute('title', 'Copied');
      if (label) label.textContent = 'Copied';
      setTimeout(function () {
        copyBtn.classList.remove('is-copied');
        copyBtn.setAttribute('aria-label', 'Copy address');
        copyBtn.setAttribute('title', 'Copy address');
        if (label) label.textContent = 'Copy';
      }, 1600);
    }

    if (copyBtn) {
      copyBtn.addEventListener('click', function () {
        var text = selectedLine.textContent || '';
        if (!text) return;
        copyToClipboard(text).then(showCopyFeedback).catch(function () {});
      });
    }

    function clearSelection(notify) {
      state.selection = null;
      selectedBox.classList.remove('is-visible');
      selectedLine.textContent = '';
      el.removeAttribute('data-aica-selection');
      clearFieldBindings(writtenFields);

      if (urlParam && typeof window !== 'undefined' && window.history && window.location) {
        var url = new URL(window.location.href);
        if (url.searchParams.has(urlParam)) {
          url.searchParams.delete(urlParam);
          window.history.replaceState(null, '', url.toString());
        }
      }

      if (notify) {
        dispatch(null);
      }
    }

    function dispatch(payload) {
      // WAY 1 for integrators: onSelect + 'aica-select' event (detail = payload)
      if (typeof options.onSelect === 'function') {
        options.onSelect(payload);
      }
      el.dispatchEvent(
        new CustomEvent('aica-select', { detail: payload, bubbles: true }),
      );
    }

    function publishSelection(payload) {
      state.selection = payload;
      input.value = '';
      selectedLine.textContent = payload.result;
      selectedBox.classList.add('is-visible');
      closePanel();
      el.setAttribute('data-aica-selection', encodePayload(payload));
      applyFieldBindings(el, options, payload, writtenFields);

      if (urlParam && typeof window !== 'undefined' && window.history && window.location) {
        var url = new URL(window.location.href);
        // WAY 2 for integrators: ?aica_selection=<base64 JSON> — use readUrlSelection()
        url.searchParams.set(urlParam, encodePayload(payload));
        window.history.replaceState(null, '', url.toString());
      }

      dispatch(payload);
    }

    function renderItems(items) {
      state.items = items;
      resultsEl.innerHTML = '';

      if (!items.length) {
        resultsEl.innerHTML = '<div class="aica-ac-empty">No addresses found.</div>';
        return;
      }

      items.forEach(function (item, index) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'aica-ac-result';
        btn.setAttribute('role', 'option');

        var line = document.createElement('span');
        line.className = 'aica-ac-result-line';
        line.textContent = formatDisplayLine(item);

        btn.appendChild(line);

        if (state.mode === 'search' && isBuilding(item)) {
          var hint = document.createElement('span');
          hint.className = 'aica-ac-result-hint';
          hint.textContent = '— ' + item.unit_count + ' ' + ui.units;
          btn.appendChild(hint);
        }

        btn.addEventListener('mouseenter', function () {
          state.activeIndex = index;
          highlight();
        });
        btn.addEventListener('mousedown', function (e) {
          e.preventDefault();
        });
        btn.addEventListener('click', function () {
          handleSelect(item);
        });

        resultsEl.appendChild(btn);
      });

      highlight();
    }

    function highlight() {
      resultsEl.querySelectorAll('.aica-ac-result').forEach(function (node, i) {
        node.classList.toggle('is-active', i === state.activeIndex);
      });
    }

    function apiGet(url, requestOptions) {
      requestOptions = requestOptions || {};
      if (state.abortController) state.abortController.abort();
      state.abortController = new AbortController();
      var loaderTimer = null;
      var timeoutTimer = null;
      var loaderShown = false;

      var headers = { Accept: 'application/json' };
      if (apiKey) headers['X-AICA-API-Key'] = apiKey;
      headers['X-AICA-Session-Id'] = state.sessionId;
      if (requestOptions.interactionComplete) headers['X-AICA-Interaction-Complete'] = 'true';
      if (requestOptions.selectionPreview) {
        headers['X-AICA-Selection-Preview'] = String(requestOptions.selectionPreview).slice(0, 120);
      }
      if (typeof window !== 'undefined' && window.AICA_DEMO_FINGERPRINT) {
        headers['X-AICA-Demo-Fingerprint'] = window.AICA_DEMO_FINGERPRINT;
      }

      return new Promise(function (resolve, reject) {
        loaderTimer = setTimeout(function () {
          loaderShown = true;
          showPanelLoader("We're working on your request.");
        }, LOADER_DELAY_MS);

        timeoutTimer = setTimeout(function () {
          state.abortController.abort();
        }, REQUEST_TIMEOUT_MS);

        fetch(url, { signal: state.abortController.signal, headers: headers, credentials: 'omit' })
          .then(function (response) {
            if (!response.ok) {
              return response.json().catch(function () {
                return {};
              }).then(function (body) {
                var err = {
                  code: body.error_code || 'AICA-E010',
                  message: body.error || ERROR_MESSAGES['AICA-E010'],
                  status: response.status,
                };
                throw err;
              });
            }
            return response.json();
          })
          .then(resolve)
          .catch(function (err) {
            if (err && err.name === 'AbortError') {
              reject({
                code: 'AICA-E008',
                message: ERROR_MESSAGES['AICA-E008'],
                timeout: true,
              });
              return;
            }
            if (err && err.code) {
              reject(err);
              return;
            }
            reject({
              code: 'AICA-E007',
              message: ERROR_MESSAGES['AICA-E007'],
              offline: true,
            });
          })
          .finally(function () {
            clearTimeout(loaderTimer);
            clearTimeout(timeoutTimer);
            if (loaderShown) hidePanelLoader();
          });
      });
    }

    function runSearch(query) {
      var trimmed = query.trim();
      if (trimmed.length < minChars) {
        closePanel();
        return;
      }

      state.mode = 'search';
      apiGet(apiBase + '?search=' + encodeURIComponent(trimmed))
        .then(function (data) {
          var prepared = data
            .filter(function (item) {
              return !item.relation_complex || item.is_address_building;
            })
            .sort(function (a, b) {
              return (b.is_address_building ? 1 : 0) - (a.is_address_building ? 1 : 0);
            });
          renderItems(prepared);
          openPanel();
        })
        .catch(function (err) {
          if (err && err.name === 'AbortError') return;
          hideStatus();
          showPanelError(err);
        });
    }

    function loadUnits(building) {
      if (!building || !building.addr_id) return;

      state.mode = 'units';
      resultsEl.innerHTML = '<div class="aica-ac-loading">Loading units…</div>';
      openPanel();

      apiGet(apiBase + '/units?parent_id=' + encodeURIComponent(building.addr_id))
        .then(function (data) {
          renderItems((data || []).map(normalizeUnit));
        })
        .catch(function (err) {
          if (err && err.name === 'AbortError') return;
          showPanelError(err);
        });
    }

    function handleSelect(item) {
      if (state.mode === 'search' && isBuilding(item)) {
        loadUnits(item);
        return;
      }
      publishSelection(buildPayload(item));
      apiGet(apiBase + '/session-complete', {
        interactionComplete: true,
        selectionPreview: buildPayload(item).result,
      })
        .catch(function () { /* analytics ping */ })
        .finally(rotateSession);
    }

    function scheduleSearch() {
      clearTimeout(state.debounceTimer);
      state.debounceTimer = setTimeout(function () {
        runSearch(input.value);
      }, DEBOUNCE_MS);
    }

    input.addEventListener('input', function () {
      if (state.selection) {
        clearSelection(false);
      }
      state.mode = 'search';
      rotateSession();
      scheduleSearch();
    });

    input.addEventListener('focus', function () {
      if (state.selection) return;
      if (state.items.length) openPanel();
    });

    searchBtn.addEventListener('click', function () {
      clearTimeout(state.debounceTimer);
      if (state.selection) clearSelection(false);
      runSearch(input.value);
    });

    input.addEventListener('keydown', function (event) {
      if (state.selection) {
        if (event.key === 'Escape') {
          input.blur();
        }
        return;
      }

      if (!panel.classList.contains('is-open') || !state.items.length) {
        if (event.key === 'Escape') closePanel();
        return;
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        state.activeIndex = (state.activeIndex + 1) % state.items.length;
        highlight();
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        state.activeIndex = state.activeIndex <= 0 ? state.items.length - 1 : state.activeIndex - 1;
        highlight();
      } else if (event.key === 'Enter') {
        event.preventDefault();
        if (state.activeIndex >= 0 && state.items[state.activeIndex]) {
          handleSelect(state.items[state.activeIndex]);
        }
      } else if (event.key === 'Escape') {
        closePanel();
      }
    });

    document.addEventListener('mousedown', function (event) {
      if (!el.contains(event.target)) closePanel();
    });

    if (urlParam && typeof window !== 'undefined' && window.location) {
      var existing = decodePayload(new URL(window.location.href).searchParams.get(urlParam));
      if (existing && existing.result) {
        publishSelection(existing);
      }
    }

    el._aicaAutocomplete = {
      getSelection: function () {
        return state.selection;
      },
      clearSelection: function () {
        clearSelection(true);
        input.value = '';
      },
      readUrlSelection: function () {
        if (!urlParam || typeof window === 'undefined') return null;
        return decodePayload(new URL(window.location.href).searchParams.get(urlParam));
      },
    };

    return el._aicaAutocomplete;
  }

  function getSelection(root) {
    var el = typeof root === 'string' ? document.querySelector(root) : root;
    return el && el._aicaAutocomplete ? el._aicaAutocomplete.getSelection() : null;
  }

  function readUrlSelection(paramName) {
    if (typeof window === 'undefined') return null;
    return decodePayload(new URL(window.location.href).searchParams.get(paramName || 'aica_selection'));
  }

  global.AicaAutocomplete = {
    mount: mount,
    getSelection: getSelection,
    readUrlSelection: readUrlSelection,
    decodePayload: decodePayload,
    FILL_TOKENS: Object.keys(FIELD_ALIASES),
    FIELD_ALIASES: FIELD_ALIASES,
    valuesFromPayload: valuesFromPayload,
    ERROR_MESSAGES: ERROR_MESSAGES,
    FALLBACK_CSS: FALLBACK_CSS,
    FALLBACK_JS: FALLBACK_JS,
    FALLBACK_LOGO: FALLBACK_LOGO,
  };
})(typeof window !== 'undefined' ? window : this);
