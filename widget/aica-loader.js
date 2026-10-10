/**
 * AICA Address Autocomplete — thin loader
 * Host: /v1/address/autocomplete/canada/interactive/aica-loader.js
 *
 * Loads CSS (once) + aica-autocomplete.js, then auto-mounts
 * elements marked with data-aica-autocomplete.
 *
 * Classic install (explicit <link> + aica-autocomplete.js + mount) still works.
 * Widget path (no customer proxy): put data-api-key on the mount div and
 * allowlist your domain in the AICA dashboard. Optional data-api-base overrides
 * the default AICA API URL (advanced / self-hosted proxy).
 */
(function (global) {
  'use strict';

  var CSS_FILE = 'aica-autocomplete.css';
  var JS_FILE = 'aica-autocomplete.js';
  var LOADER_ATTR = 'data-aica-loader';
  var MOUNT_ATTR = 'data-aica-autocomplete';

  function scriptEl() {
    if (document.currentScript) return document.currentScript;
    var scripts = document.getElementsByTagName('script');
    for (var i = scripts.length - 1; i >= 0; i--) {
      var src = scripts[i].src || '';
      if (src.indexOf('aica-loader.js') !== -1) return scripts[i];
    }
    return null;
  }

  function assetBase() {
    var el = scriptEl();
    if (!el || !el.src) {
      return 'https://aica-apis.quebecstore.ca/v1/address/autocomplete/canada/interactive/';
    }
    return el.src.replace(/[^/]+$/, '');
  }

  function cssAlreadyPresent(href) {
    var links = document.querySelectorAll('link[rel="stylesheet"]');
    for (var i = 0; i < links.length; i++) {
      var linkHref = links[i].href || '';
      if (linkHref === href || linkHref.indexOf('/' + CSS_FILE) !== -1 || linkHref.indexOf(CSS_FILE) !== -1) {
        return true;
      }
    }
    return false;
  }

  function injectCss(base) {
    var href = base + CSS_FILE;
    if (cssAlreadyPresent(href)) return;
    if (document.querySelector('link[' + LOADER_ATTR + '="css"]')) return;
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.setAttribute(LOADER_ATTR, 'css');
    (document.head || document.documentElement).appendChild(link);
  }

  function loadScript(src, done) {
    var existing = document.querySelector('script[' + LOADER_ATTR + '="js"]');
    if (global.AicaAutocomplete && typeof global.AicaAutocomplete.mount === 'function') {
      done(null);
      return;
    }
    if (existing) {
      existing.addEventListener('load', function () { done(null); });
      existing.addEventListener('error', function () { done(new Error('AICA widget script failed to load')); });
      return;
    }
    var script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.setAttribute(LOADER_ATTR, 'js');
    script.onload = function () { done(null); };
    script.onerror = function () { done(new Error('AICA widget script failed to load')); };
    (document.head || document.documentElement).appendChild(script);
  }

  function parseOptions(el) {
    var opts = {};
    if (el.dataset.apiBase) opts.apiBase = el.dataset.apiBase;
    if (el.dataset.apiKey) opts.apiKey = el.dataset.apiKey;
    if (el.dataset.logoUrl) opts.logoUrl = el.dataset.logoUrl;
    if (el.dataset.urlParam) opts.urlParam = el.dataset.urlParam;
    if (el.dataset.minChars) opts.minChars = Number(el.dataset.minChars);
    if (el.dataset.aicaFieldsRoot) opts.fieldsRoot = el.dataset.aicaFieldsRoot;
    return opts;
  }

  function autoMount() {
    if (!global.AicaAutocomplete || typeof global.AicaAutocomplete.mount !== 'function') return;
    var nodes = document.querySelectorAll('[' + MOUNT_ATTR + ']');
    Array.prototype.forEach.call(nodes, function (el) {
      if (el._aicaAutocomplete) return;
      if (el.classList && el.classList.contains('aica-ac') && el.querySelector('.aica-ac-input')) return;
      global.AicaAutocomplete.mount(el, parseOptions(el));
    });
  }

  function boot() {
    var base = assetBase();
    injectCss(base);
    loadScript(base + JS_FILE, function (err) {
      if (err) {
        if (typeof console !== 'undefined' && console.error) console.error(err);
        return;
      }
      autoMount();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  global.AicaLoader = {
    boot: boot,
    autoMount: autoMount,
  };
})(typeof window !== 'undefined' ? window : this);
