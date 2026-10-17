/*
 * QR Island – main app: live preview, styling, scan check, downloads,
 * saved codes (localStorage), scanner and theme.
 */
(function () {
  'use strict';

  var C = window.QRContent;
  var STORAGE_KEY = 'qr-island-codes';
  var THEME_KEY = 'qr-island-theme';
  var SVG_NS = 'http://www.w3.org/2000/svg';

  // Export layout, in pixels for a 1000px QR code (everything scales with the PNG size).
  var EXPORT_SIZE = 1000;
  var PADDING = { small: 40, medium: 80, large: 140 };
  var CAPTION_SIZES = { small: 54, medium: 72, large: 92 };
  var FRAME_RADIUS = 70;
  var BORDER_WIDTH = 16;
  var PNG_SIZES = { small: 500, medium: 1000, large: 2000 };

  var FONTS = {
    friendly: '"Trebuchet MS", "Segoe UI", Arial, Helvetica, sans-serif',
    clean: 'Helvetica, Arial, sans-serif',
    classic: 'Georgia, "Times New Roman", serif',
    typewriter: '"Courier New", Courier, monospace'
  };

  // Logo sizes above this cover too many dots to scan reliably.
  var MAX_SAFE_LOGO = 0.5;
  // Small previews are drawn at this size and scaled down with CSS.
  // (The QR library fails if the size is smaller than the number of modules.)
  var THUMB_SIZE = 240;
  var MIN_CONTRAST = 3;

  // Presets with fg2 use a gradient from fg to fg2.
  var PRESETS = {
    ocean: { fg: '#0b4f6c', bg: '#e6f5fa' },
    sunset: { fg: '#b4410f', bg: '#fff1e3' },
    palm: { fg: '#1d6a3a', bg: '#edf8ef' },
    coral: { fg: '#a8233d', bg: '#fff0f1' },
    lagoon: { fg: '#0b6e79', fg2: '#1d3f94', bg: '#eaf7f8' },
    tropical: { fg: '#c2410c', fg2: '#a3165a', bg: '#fff5ea' }
  };

  // Dot shape → library dot type, plus the corners used for "Match dots".
  var SHAPES = {
    square: { dots: 'square', corner: 'square', cornerDot: 'square' },
    rounded: { dots: 'rounded', corner: 'extra-rounded', cornerDot: 'dot' },
    dots: { dots: 'dots', corner: 'dot', cornerDot: 'dot' },
    classy: { dots: 'classy', corner: 'extra-rounded', cornerDot: 'square' },
    'classy-rounded': { dots: 'classy-rounded', corner: 'extra-rounded', cornerDot: 'dot' },
    'extra-rounded': { dots: 'extra-rounded', corner: 'extra-rounded', cornerDot: 'dot' }
  };

  var CORNERS = {
    square: { corner: 'square', cornerDot: 'square' },
    rounded: { corner: 'extra-rounded', cornerDot: 'dot' },
    circle: { corner: 'dot', cornerDot: 'dot' }
  };

  var GRADIENTS = {
    diagonal: { type: 'linear', rotation: Math.PI / 4 },
    across: { type: 'linear', rotation: 0 },
    down: { type: 'linear', rotation: Math.PI / 2 },
    radial: { type: 'radial', rotation: 0 }
  };

  function defaultFields() {
    return {
      link: { url: '' },
      text: { body: '' },
      wifi: { ssid: '', password: '', security: 'WPA', hidden: false },
      contact: { name: '', phone: '', email: '' },
      whatsapp: { phone: '', message: '' },
      location: { lat: '', lng: '' }
    };
  }

  function defaultStyle() {
    return {
      fg: '#12343b',
      bg: '#ffffff',
      fill: 'solid',
      fg2: '#0e7c86',
      gradientType: 'diagonal',
      cornerColorOn: false,
      cornerColor: '#c2410c',
      transparent: false,
      shape: 'square',
      cornerShape: 'auto',
      logo: null,
      logoSize: 0.4,
      frame: 'none',
      margin: 'medium',
      caption: '',
      captionPos: 'below',
      captionFont: 'friendly',
      captionSize: 'medium',
      captionColorOn: false,
      captionColor: '#0e7c86',
      pngSize: 'medium'
    };
  }

  var state = {
    type: 'link',
    fields: defaultFields(),
    style: defaultStyle(),
    editingId: null,
    result: { error: C.TYPES.link.empty }
  };

  var $ = function (id) { return document.getElementById(id); };
  var form = $('content-form');
  var els = {
    tabs: Array.prototype.slice.call(document.querySelectorAll('.type-tab')),
    panels: Array.prototype.slice.call(document.querySelectorAll('.type-panel')),
    styleInputs: Array.prototype.slice.call(document.querySelectorAll('[data-style]')),
    colorValues: Array.prototype.slice.call(document.querySelectorAll('[data-color-for]')),
    bg: $('bg-color'),
    fgLabel: $('fg-label'),
    gradientOptions: $('gradient-options'),
    cornerColorField: $('corner-color-field'),
    captionOptions: $('caption-options'),
    captionColorField: $('caption-color-field'),
    pngSizeHint: $('png-size-hint'),
    presets: Array.prototype.slice.call(document.querySelectorAll('.preset')),
    logoInput: $('logo-input'),
    logoThumb: $('logo-thumb'),
    logoRemove: $('logo-remove'),
    logoButtonText: $('logo-button-text'),
    logoSizeField: $('logo-size-field'),
    logoSize: $('logo-size'),
    logoSizeValue: $('logo-size-value'),
    preview: $('preview'),
    frame: $('qr-frame'),
    holder: $('qr-holder'),
    captionOut: $('qr-caption'),
    empty: $('preview-empty'),
    emptyText: $('preview-empty-text'),
    scanCheck: $('scan-check'),
    downloadPng: $('download-png'),
    downloadSvg: $('download-svg'),
    saveName: $('save-name'),
    save: $('save-code'),
    saveText: $('save-code-text'),
    saveAsNew: $('save-as-new'),
    banner: $('editing-banner'),
    bannerName: $('editing-name'),
    list: $('code-list'),
    listEmpty: $('list-empty'),
    mini: $('mini-preview'),
    miniQr: $('mini-qr'),
    toast: $('toast')
  };

  // ---------- Helpers ----------

  function debounce(fn, wait) {
    var t;
    return function () {
      clearTimeout(t);
      t = setTimeout(fn, wait);
    };
  }

  var toastTimer;
  function toast(message) {
    els.toast.textContent = message;
    els.toast.hidden = false;
    // Force reflow so the transition runs every time.
    void els.toast.offsetWidth;
    els.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      els.toast.classList.remove('show');
      setTimeout(function () { els.toast.hidden = true; }, 250);
    }, 2600);
  }

  function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function slugify(text) {
    var slug = String(text || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
    return slug || 'code';
  }

  function truncate(text, max) {
    text = String(text || '');
    return text.length > max ? text.slice(0, max - 1) + '…' : text;
  }

  function newId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  // ---------- QR options ----------

  // The QR library writes one byte per character, so text with accents or
  // emoji must be turned into UTF-8 bytes first (one character per byte).
  function toQrBytes(text) {
    if (!/[^\x00-\x7f]/.test(text)) return text;
    var bytes = new TextEncoder().encode(text);
    var out = '';
    for (var i = 0; i < bytes.length; i++) out += String.fromCharCode(bytes[i]);
    return out;
  }

  function qrOptions(data, style, size) {
    var shape = SHAPES[style.shape] || SHAPES.square;
    var corners = CORNERS[style.cornerShape] || shape;
    var dotsOptions = { color: style.fg, type: shape.dots };
    if (style.fill === 'gradient') {
      var g = GRADIENTS[style.gradientType] || GRADIENTS.diagonal;
      dotsOptions.gradient = {
        type: g.type,
        rotation: g.rotation,
        colorStops: [{ offset: 0, color: style.fg }, { offset: 1, color: style.fg2 }]
      };
    }
    var cornersSquareOptions = { type: corners.corner };
    var cornersDotOptions = { type: corners.cornerDot };
    // Corners without their own color share the dots' color (and gradient).
    if (style.cornerColorOn) {
      cornersSquareOptions.color = cornersDotOptions.color = style.cornerColor;
    } else if (style.fill !== 'gradient') {
      cornersSquareOptions.color = cornersDotOptions.color = style.fg;
    }
    var options = {
      width: size,
      height: size,
      type: 'svg',
      data: toQrBytes(data),
      margin: 0,
      qrOptions: { errorCorrectionLevel: style.logo ? 'H' : 'Q' },
      dotsOptions: dotsOptions,
      cornersSquareOptions: cornersSquareOptions,
      cornersDotOptions: cornersDotOptions,
      backgroundOptions: { color: style.transparent ? 'rgba(0,0,0,0)' : style.bg }
    };
    if (style.logo) {
      options.image = style.logo;
      options.imageOptions = {
        hideBackgroundDots: true,
        imageSize: style.logoSize,
        margin: Math.round(size * 0.012),
        crossOrigin: 'anonymous'
      };
    }
    return options;
  }

  /** Builds a QRCodeStyling instance, or returns an error message if the data does not fit. */
  function makeQr(data, style, size) {
    try {
      return { qr: new window.QRCodeStyling(qrOptions(data, style, size)) };
    } catch (e) {
      return { error: 'This is too much for one QR code. Please make it shorter.' };
    }
  }

  // ---------- Scan check ----------

  function scanProblems(style) {
    var problems = [];
    // A transparent code is meant for light backgrounds, so check it against white.
    var bg = style.transparent ? '#ffffff' : style.bg;
    if (C.contrastRatio(style.fg, bg) < MIN_CONTRAST) {
      problems.push(style.transparent
        ? 'Low contrast: the QR color is too light to read on a light background. Use a darker QR color.'
        : 'Low contrast: the QR color and background are too alike. Use a darker QR color or a lighter background.');
    } else if (C.luminance(style.fg) > C.luminance(bg)) {
      problems.push('The QR color is lighter than the background. Many phones can’t read this. Use a dark QR color on a light background.');
    }
    if (style.fill === 'gradient' && C.contrastRatio(style.fg2, bg) < MIN_CONTRAST) {
      problems.push('Low contrast: the gradient end color is too close to the background. Pick a darker end color.');
    }
    if (style.cornerColorOn && C.contrastRatio(style.cornerColor, bg) < MIN_CONTRAST) {
      problems.push('Low contrast: the corner color is too close to the background. Pick a darker corner color.');
    }
    if (style.logo && style.logoSize > MAX_SAFE_LOGO) {
      problems.push('The logo is too big and hides too much of the code. Make the logo smaller.');
    }
    return problems;
  }

  function renderScanCheck(valid) {
    var el = els.scanCheck;
    if (!valid) {
      el.hidden = true;
      return;
    }
    var problems = scanProblems(state.style);
    el.hidden = false;
    el.textContent = '';
    el.className = 'scan-check ' + (problems.length ? 'is-bad' : 'is-good');
    var icon = document.createElement('span');
    icon.className = 'scan-check-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = problems.length ? '!' : '✓';
    el.appendChild(icon);
    var body = document.createElement('span');
    if (!problems.length) {
      body.textContent = state.style.transparent ? 'Good, this will scan on a light background' : 'Good, this will scan';
    } else {
      problems.forEach(function (p, i) {
        if (i) body.appendChild(document.createElement('br'));
        body.appendChild(document.createTextNode(p));
      });
    }
    el.appendChild(body);
  }

  // ---------- Preview ----------

  function render() {
    var style = state.style;
    var result = C.build(state.type, state.fields[state.type]);
    var built = null;

    els.holder.textContent = '';
    if (result.data) {
      built = makeQr(result.data, style, 320);
      if (built.error) result = { error: built.error };
    }
    state.result = result;
    var valid = !!result.data;

    els.frame.hidden = !valid;
    els.empty.hidden = valid;
    els.emptyText.textContent = result.error || '';
    els.empty.classList.toggle('is-error', !!result.error && result.error !== C.TYPES[state.type].empty);

    if (valid) {
      built.qr.append(els.holder);
      renderFrame(style);
    }

    renderScanCheck(valid);
    els.downloadPng.disabled = !valid;
    els.downloadSvg.disabled = !valid;
    els.save.disabled = !valid;
    renderMini(valid ? result.data : null);
  }

  var scheduleRender = debounce(render, 90);

  // Gives the preview the same proportions as the downloaded image.
  function renderFrame(style) {
    var layout = exportLayout(style);
    var frame = els.frame;
    var w = layout.width;
    frame.style.backgroundColor = style.transparent ? '' : style.bg;
    frame.classList.toggle('checker', style.transparent);
    frame.classList.toggle('has-caption', !!layout.caption);
    frame.classList.toggle('caption-above', layout.above);
    frame.classList.toggle('has-border', !!layout.border);
    frame.style.borderRadius = layout.radius
      ? (layout.radius / w * 100) + '% / ' + (layout.radius / layout.height * 100) + '%'
      : '';
    frame.style.setProperty('--pad', (layout.pad / w * 100) + '%');
    frame.style.setProperty('--border-w', (layout.border / w * 100) + 'cqi');
    frame.style.setProperty('--border-c', style.fg);
    frame.style.setProperty('--cap-h', (layout.captionHeight / w * 100) + 'cqi');
    els.captionOut.hidden = !layout.caption;
    els.captionOut.textContent = layout.caption;
    els.captionOut.style.color = captionColor(style);
    els.captionOut.style.fontFamily = layout.font;
    els.captionOut.style.fontSize = (layout.fontSize / w * 100) + 'cqi';
  }

  function captionColor(style) {
    return style.captionColorOn ? style.captionColor : style.fg;
  }

  // Background for small previews: the QR background, or a checkerboard if transparent.
  function paintBackground(el, style) {
    el.style.backgroundColor = style.transparent ? '' : style.bg;
    el.classList.toggle('checker', !!style.transparent);
  }

  // ---------- Mini preview (phones) ----------

  var previewVisible = true;

  function renderMini(data) {
    els.miniQr.textContent = '';
    if (data) {
      var built = makeQr(data, state.style, THUMB_SIZE);
      if (built.qr) built.qr.append(els.miniQr);
      paintBackground(els.mini, state.style);
    }
    updateMiniVisibility();
  }

  function updateMiniVisibility() {
    var show = !previewVisible && !!state.result.data && window.matchMedia('(max-width: 959px)').matches;
    els.mini.hidden = !show;
  }

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      previewVisible = entries[0].isIntersecting;
      updateMiniVisibility();
    }, { threshold: 0.15 }).observe(els.preview);
  }
  window.addEventListener('resize', debounce(updateMiniVisibility, 150));

  els.mini.addEventListener('click', function () {
    els.preview.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });

  // ---------- Type tabs and fields ----------

  function setType(type, focus) {
    state.type = type;
    els.tabs.forEach(function (tab) {
      var active = tab.dataset.type === type;
      tab.setAttribute('aria-selected', active ? 'true' : 'false');
      tab.tabIndex = active ? 0 : -1;
      if (active && focus) tab.focus();
    });
    els.panels.forEach(function (panel) {
      panel.hidden = panel.dataset.panel !== type;
    });
    render();
  }

  els.tabs.forEach(function (tab, index) {
    tab.addEventListener('click', function () { setType(tab.dataset.type); });
    tab.addEventListener('keydown', function (e) {
      var next = null;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = els.tabs[(index + 1) % els.tabs.length];
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = els.tabs[(index - 1 + els.tabs.length) % els.tabs.length];
      if (e.key === 'Home') next = els.tabs[0];
      if (e.key === 'End') next = els.tabs[els.tabs.length - 1];
      if (next) {
        e.preventDefault();
        setType(next.dataset.type, true);
      }
    });
  });

  // Inputs are named "<type>-<field>", e.g. "wifi-ssid".
  function readField(input) {
    var parts = input.name.split('-');
    var type = parts[0];
    var key = parts.slice(1).join('-');
    if (!state.fields[type]) return;
    state.fields[type][key] = input.type === 'checkbox' ? input.checked : input.value;
  }

  function writeFields() {
    Array.prototype.forEach.call(form.elements, function (input) {
      if (!input.name) return;
      var parts = input.name.split('-');
      var value = state.fields[parts[0]] ? state.fields[parts[0]][parts.slice(1).join('-')] : '';
      if (input.type === 'checkbox') input.checked = !!value;
      else input.value = value == null ? '' : value;
    });
    updateWifiPasswordVisibility();
  }

  function updateWifiPasswordVisibility() {
    $('wifi-password-field').hidden = state.fields.wifi.security === 'nopass';
  }

  form.addEventListener('input', function (e) {
    if (!e.target.name) return;
    readField(e.target);
    scheduleRender();
  });
  form.addEventListener('change', function (e) {
    if (!e.target.name) return;
    readField(e.target);
    if (e.target.name === 'wifi-security') updateWifiPasswordVisibility();
    render();
  });
  form.addEventListener('submit', function (e) { e.preventDefault(); });

  $('use-my-location').addEventListener('click', function () {
    if (!navigator.geolocation) {
      toast('Your browser can’t share your location.');
      return;
    }
    var btn = this;
    btn.disabled = true;
    navigator.geolocation.getCurrentPosition(function (pos) {
      btn.disabled = false;
      state.fields.location.lat = pos.coords.latitude.toFixed(6);
      state.fields.location.lng = pos.coords.longitude.toFixed(6);
      writeFields();
      render();
    }, function () {
      btn.disabled = false;
      toast('Could not get your location. Please type it instead.');
    }, { enableHighAccuracy: true, timeout: 15000 });
  });

  // ---------- Style controls ----------

  // Every style control has data-style="<key in state.style>".
  function readStyleInput(input) {
    var key = input.dataset.style;
    if (input.type === 'radio') {
      if (input.checked) state.style[key] = input.value;
    } else if (input.type === 'checkbox') {
      state.style[key] = input.checked;
    } else if (input.type === 'range') {
      state.style[key] = parseFloat(input.value);
    } else {
      state.style[key] = input.value;
    }
  }

  function writeStyle() {
    var s = state.style;
    els.styleInputs.forEach(function (input) {
      var value = s[input.dataset.style];
      if (input.type === 'radio') input.checked = input.value === value;
      else if (input.type === 'checkbox') input.checked = !!value;
      else input.value = value == null ? '' : value;
    });
    updateLogoUi();
    updateStyleUi();
  }

  // Shows and hides the extra fields, and refreshes labels that follow the style.
  function updateStyleUi() {
    var s = state.style;
    els.colorValues.forEach(function (span) {
      span.textContent = String(s[span.dataset.colorFor]).toUpperCase();
    });
    var gradient = s.fill === 'gradient';
    els.fgLabel.textContent = gradient ? 'Start color' : 'QR color';
    els.gradientOptions.hidden = !gradient;
    els.cornerColorField.hidden = !s.cornerColorOn;
    els.bg.disabled = !!s.transparent;
    els.bg.closest('.color-field').classList.toggle('is-off', !!s.transparent);
    els.captionOptions.hidden = !String(s.caption || '').trim();
    els.captionColorField.hidden = !s.captionColorOn;
    els.logoSizeValue.textContent = logoSizeLabel(s.logoSize);
    var png = exportLayout(s, PNG_SIZES[s.pngSize] || EXPORT_SIZE);
    els.pngSizeHint.textContent = png.width + ' × ' + png.height;
    updatePresetButtons();
  }

  function presetMatches(p, s) {
    var gradient = s.fill === 'gradient';
    return p.fg === s.fg.toLowerCase() && p.bg === s.bg.toLowerCase() &&
      (p.fg2 ? gradient && p.fg2 === s.fg2.toLowerCase() : !gradient);
  }

  function updatePresetButtons() {
    els.presets.forEach(function (btn) {
      var active = presetMatches(PRESETS[btn.dataset.preset], state.style);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }

  function logoSizeLabel(size) {
    if (size > MAX_SAFE_LOGO) return 'Too big';
    if (size <= 0.3) return 'Small';
    if (size <= 0.45) return 'Medium';
    return 'Large';
  }

  function updateLogoUi() {
    var has = !!state.style.logo;
    els.logoThumb.hidden = !has;
    if (has) els.logoThumb.src = state.style.logo;
    else els.logoThumb.removeAttribute('src');
    els.logoRemove.hidden = !has;
    els.logoSizeField.hidden = !has;
    els.logoButtonText.textContent = has ? 'Change logo' : 'Upload logo';
  }

  // Text, color and slider inputs redraw while you type or drag; the rest on change.
  function onStyleEvent(e) {
    var input = e.target;
    if (!input.dataset || !input.dataset.style) return;
    var live = input.type === 'text' || input.type === 'color' || input.type === 'range';
    if (live !== (e.type === 'input')) return;
    readStyleInput(input);
    updateStyleUi();
    if (live) scheduleRender();
    else render();
  }
  document.addEventListener('input', onStyleEvent);
  document.addEventListener('change', onStyleEvent);

  els.presets.forEach(function (btn) {
    btn.addEventListener('click', function () {
      var p = PRESETS[btn.dataset.preset];
      state.style.fg = p.fg;
      state.style.bg = p.bg;
      state.style.fill = p.fg2 ? 'gradient' : 'solid';
      if (p.fg2) state.style.fg2 = p.fg2;
      state.style.cornerColorOn = false;
      state.style.transparent = false;
      writeStyle();
      render();
    });
  });

  // Resets the look, but keeps the logo and the text.
  $('reset-style').addEventListener('click', function () {
    var keep = state.style;
    state.style = defaultStyle();
    state.style.logo = keep.logo;
    state.style.caption = keep.caption;
    writeStyle();
    render();
    toast('Style reset');
  });

  els.logoRemove.addEventListener('click', function () {
    state.style.logo = null;
    updateLogoUi();
    render();
  });

  // Shrinks the uploaded logo so saved codes stay small in localStorage.
  function loadLogo(file) {
    return new Promise(function (resolve, reject) {
      if (!file || !/^image\//.test(file.type)) {
        reject(new Error('Please choose an image file (PNG, JPG, SVG or WebP).'));
        return;
      }
      if (file.size > 8 * 1024 * 1024) {
        reject(new Error('That image is too large. Please choose one under 8 MB.'));
        return;
      }
      var reader = new FileReader();
      reader.onerror = function () { reject(new Error('Could not read that image.')); };
      reader.onload = function () {
        var img = new Image();
        img.onerror = function () { reject(new Error('Could not open that image.')); };
        img.onload = function () {
          var w = img.naturalWidth || 300;
          var h = img.naturalHeight || 300;
          var scale = Math.min(1, 320 / Math.max(w, h));
          var canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(w * scale));
          canvas.height = Math.max(1, Math.round(h * scale));
          canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
          try {
            resolve(canvas.toDataURL('image/png'));
          } catch (e) {
            reject(new Error('Could not use that image.'));
          }
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  els.logoInput.addEventListener('change', function () {
    var file = els.logoInput.files && els.logoInput.files[0];
    els.logoInput.value = '';
    if (!file) return;
    loadLogo(file).then(function (dataUrl) {
      state.style.logo = dataUrl;
      updateLogoUi();
      render();
    }).catch(function (err) {
      toast(err.message);
    });
  });

  // ---------- Export (PNG / SVG) ----------

  function loadImage(src) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () { resolve(img); };
      img.onerror = reject;
      img.src = src;
    });
  }

  // Picks a caption font size that fits inside the given width.
  function captionFontSize(text, maxWidth, size, font) {
    var ctx = document.createElement('canvas').getContext('2d');
    var min = size / 3;
    for (; size > min; size -= 2) {
      ctx.font = '700 ' + size + 'px ' + font;
      if (ctx.measureText(text).width <= maxWidth) break;
    }
    return size;
  }

  // Sizes and positions for the downloaded image (and the preview, in proportion).
  function exportLayout(style, qrSize) {
    qrSize = qrSize || EXPORT_SIZE;
    var unit = qrSize / EXPORT_SIZE;
    var caption = (style.caption || '').trim();
    var font = FONTS[style.captionFont] || FONTS.friendly;
    var border = style.frame === 'border' ? Math.round(BORDER_WIDTH * unit) : 0;
    var pad = Math.round((PADDING[style.margin] || PADDING.medium) * unit) + border;
    var baseFont = (CAPTION_SIZES[style.captionSize] || CAPTION_SIZES.medium) * unit;
    var captionHeight = caption ? Math.round(baseFont * 1.6) : 0;
    var above = !!caption && style.captionPos === 'above';
    return {
      qrSize: qrSize,
      pad: pad,
      border: border,
      radius: style.frame === 'rounded' || style.frame === 'border' ? Math.round(FRAME_RADIUS * unit) : 0,
      caption: caption,
      font: font,
      fontSize: caption ? Math.round(captionFontSize(caption, qrSize, baseFont, font)) : 0,
      captionHeight: captionHeight,
      above: above,
      width: qrSize + pad * 2,
      height: qrSize + pad * 2 + captionHeight,
      qrY: pad + (above ? captionHeight : 0),
      captionY: above ? pad + Math.round(captionHeight * 0.38) : pad + qrSize + Math.round(captionHeight * 0.62)
    };
  }

  function roundedRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function makePng(data, style) {
    var layout = exportLayout(style, PNG_SIZES[style.pngSize] || EXPORT_SIZE);
    var built = makeQr(data, style, layout.qrSize);
    if (built.error) return Promise.reject(new Error(built.error));
    return built.qr.getRawData('png').then(function (blob) {
      var url = URL.createObjectURL(blob);
      return loadImage(url).then(function (img) {
        URL.revokeObjectURL(url);
        var canvas = document.createElement('canvas');
        canvas.width = layout.width;
        canvas.height = layout.height;
        var ctx = canvas.getContext('2d');
        if (!style.transparent) {
          ctx.fillStyle = style.bg;
          roundedRect(ctx, 0, 0, layout.width, layout.height, layout.radius);
          ctx.fill();
        }
        ctx.drawImage(img, layout.pad, layout.qrY, layout.qrSize, layout.qrSize);
        if (layout.caption) {
          ctx.fillStyle = captionColor(style);
          ctx.font = '700 ' + layout.fontSize + 'px ' + layout.font;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(layout.caption, layout.width / 2, layout.captionY);
        }
        if (layout.border) {
          var half = layout.border / 2;
          ctx.strokeStyle = style.fg;
          ctx.lineWidth = layout.border;
          roundedRect(ctx, half, half, layout.width - layout.border, layout.height - layout.border, Math.max(0, layout.radius - half));
          ctx.stroke();
        }
        return new Promise(function (resolve, reject) {
          canvas.toBlob(function (out) {
            if (out) resolve(out);
            else reject(new Error('Could not make the PNG.'));
          }, 'image/png');
        });
      });
    });
  }

  function makeSvg(data, style) {
    var layout = exportLayout(style);
    var built = makeQr(data, style, layout.qrSize);
    if (built.error) return Promise.reject(new Error(built.error));
    return built.qr.getRawData('svg').then(function (blob) {
      return blob.text();
    }).then(function (source) {
      var parsed = new DOMParser().parseFromString(source, 'image/svg+xml');
      var inner = parsed.documentElement;
      if (!inner || inner.nodeName.toLowerCase() !== 'svg') throw new Error('Could not make the SVG.');

      var doc = document.implementation.createDocument(SVG_NS, 'svg', null);
      var root = doc.documentElement;
      root.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
      root.setAttribute('width', layout.width);
      root.setAttribute('height', layout.height);
      root.setAttribute('viewBox', '0 0 ' + layout.width + ' ' + layout.height);

      if (!style.transparent) {
        var bg = doc.createElementNS(SVG_NS, 'rect');
        bg.setAttribute('width', layout.width);
        bg.setAttribute('height', layout.height);
        if (layout.radius) bg.setAttribute('rx', layout.radius);
        bg.setAttribute('fill', style.bg);
        root.appendChild(bg);
      }

      var qr = doc.importNode(inner, true);
      if (!qr.getAttribute('viewBox')) {
        qr.setAttribute('viewBox', '0 0 ' + layout.qrSize + ' ' + layout.qrSize);
      }
      qr.setAttribute('x', layout.pad);
      qr.setAttribute('y', layout.qrY);
      qr.setAttribute('width', layout.qrSize);
      qr.setAttribute('height', layout.qrSize);
      root.appendChild(qr);

      if (layout.caption) {
        var text = doc.createElementNS(SVG_NS, 'text');
        text.setAttribute('x', layout.width / 2);
        text.setAttribute('y', layout.captionY);
        text.setAttribute('fill', captionColor(style));
        text.setAttribute('font-family', layout.font.replace(/"/g, "'"));
        text.setAttribute('font-size', layout.fontSize);
        text.setAttribute('font-weight', '700');
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('dominant-baseline', 'central');
        text.textContent = layout.caption;
        root.appendChild(text);
      }

      if (layout.border) {
        var half = layout.border / 2;
        var border = doc.createElementNS(SVG_NS, 'rect');
        border.setAttribute('x', half);
        border.setAttribute('y', half);
        border.setAttribute('width', layout.width - layout.border);
        border.setAttribute('height', layout.height - layout.border);
        border.setAttribute('rx', Math.max(0, layout.radius - half));
        border.setAttribute('fill', 'none');
        border.setAttribute('stroke', style.fg);
        border.setAttribute('stroke-width', layout.border);
        root.appendChild(border);
      }

      var xml = '<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLSerializer().serializeToString(root);
      return new Blob([xml], { type: 'image/svg+xml' });
    });
  }

  function saveBlob(blob, filename) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }

  function download(kind, record) {
    var type = record ? record.type : state.type;
    var style = record ? recordStyle(record) : state.style;
    var result = record ? C.build(record.type, record.fields) : state.result;
    if (!result.data) {
      toast(result.error || 'Nothing to download yet.');
      return Promise.resolve();
    }
    var name = record ? record.name : (els.saveName.value.trim() || result.summary);
    var filename = 'qr-island-' + type + '-' + slugify(name) + '.' + kind;
    var make = kind === 'svg' ? makeSvg : makePng;
    return make(result.data, style).then(function (blob) {
      saveBlob(blob, filename);
      toast(kind.toUpperCase() + ' downloaded');
    }).catch(function (err) {
      toast(err && err.message ? err.message : 'Download failed. Please try again.');
    });
  }

  function withBusy(button, task) {
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    task().then(function () {
      button.removeAttribute('aria-busy');
      button.disabled = !state.result.data && !button.closest('.code-item');
    });
  }

  els.downloadPng.addEventListener('click', function () {
    withBusy(els.downloadPng, function () { return download('png'); });
  });
  els.downloadSvg.addEventListener('click', function () {
    withBusy(els.downloadSvg, function () { return download('svg'); });
  });

  // ---------- My QR Codes (localStorage) ----------

  function loadCodes() {
    try {
      var list = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(list) ? list.filter(function (r) { return r && r.id && C.TYPES[r.type]; }) : [];
    } catch (e) {
      return [];
    }
  }

  function storeCodes(list) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
      return true;
    } catch (e) {
      toast('Could not save. Your browser storage may be full – delete some saved codes or use a smaller logo.');
      return false;
    }
  }

  // Codes saved before newer style options existed get the defaults for them.
  function recordStyle(record) {
    return Object.assign(defaultStyle(), clone(record.style || {}));
  }

  function currentRecord(id) {
    var result = state.result;
    var name = els.saveName.value.trim() || (C.TYPES[state.type].label + ': ' + truncate(result.summary, 40));
    return {
      id: id,
      name: name,
      type: state.type,
      fields: clone(state.fields[state.type]),
      style: clone(state.style),
      updatedAt: Date.now()
    };
  }

  function save(asNew) {
    if (!state.result.data) return;
    var list = loadCodes();
    var index = -1;
    if (!asNew && state.editingId) {
      index = list.findIndex(function (r) { return r.id === state.editingId; });
    }
    var record;
    if (index >= 0) {
      record = currentRecord(state.editingId);
      record.createdAt = list[index].createdAt || record.updatedAt;
      list[index] = record;
    } else {
      record = currentRecord(newId());
      record.createdAt = record.updatedAt;
      if (asNew && els.saveName.value.trim() && list.some(function (r) { return r.name === record.name; })) {
        record.name += ' (copy)';
      }
      list.unshift(record);
    }
    if (!storeCodes(list)) return;
    setEditing(record);
    renderList();
    toast(index >= 0 ? 'Changes saved' : 'Saved to My QR Codes');
  }

  els.save.addEventListener('click', function () { save(false); });
  els.saveAsNew.addEventListener('click', function () { save(true); });

  function setEditing(record) {
    state.editingId = record ? record.id : null;
    els.banner.hidden = !record;
    els.bannerName.textContent = record ? record.name : '';
    els.saveName.value = record ? record.name : '';
    els.saveText.textContent = record ? 'Save changes' : 'Save to My QR Codes';
    els.saveAsNew.hidden = !record;
  }

  function openRecord(record) {
    state.fields = defaultFields();
    state.fields[record.type] = Object.assign(state.fields[record.type], clone(record.fields));
    state.style = recordStyle(record);
    writeFields();
    writeStyle();
    setEditing(record);
    setType(record.type);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    toast('Opened “' + truncate(record.name, 30) + '”');
  }

  function startNew() {
    state.fields = defaultFields();
    state.style = defaultStyle();
    writeFields();
    writeStyle();
    setEditing(null);
    setType('link');
  }

  $('new-code').addEventListener('click', startNew);

  function deleteRecord(record) {
    if (!window.confirm('Delete “' + record.name + '”? This cannot be undone.')) return;
    var list = loadCodes().filter(function (r) { return r.id !== record.id; });
    if (!storeCodes(list)) return;
    if (state.editingId === record.id) setEditing(null);
    renderList();
    toast('Deleted');
  }

  function makeButton(label, className, onClick) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn btn-small ' + className;
    b.textContent = label;
    b.addEventListener('click', onClick);
    return b;
  }

  function renderList() {
    var list = loadCodes();
    els.list.textContent = '';
    els.listEmpty.hidden = list.length > 0;

    list.forEach(function (record) {
      var result = C.build(record.type, record.fields);
      var li = document.createElement('li');
      li.className = 'code-item';

      var thumb = document.createElement('button');
      thumb.type = 'button';
      thumb.className = 'code-thumb';
      paintBackground(thumb, recordStyle(record));
      thumb.setAttribute('aria-label', 'Open ' + record.name);
      if (result.data) {
        var built = makeQr(result.data, recordStyle(record), THUMB_SIZE);
        if (built.qr) built.qr.append(thumb);
      }
      thumb.addEventListener('click', function () { openRecord(record); });

      var info = document.createElement('div');
      info.className = 'code-info';
      var title = document.createElement('p');
      title.className = 'code-name';
      title.textContent = record.name;
      var meta = document.createElement('p');
      meta.className = 'code-meta';
      var badge = document.createElement('span');
      badge.className = 'badge';
      badge.textContent = C.TYPES[record.type].label;
      meta.appendChild(badge);
      meta.appendChild(document.createTextNode(' ' + truncate(result.summary || '', 48)));
      var date = document.createElement('p');
      date.className = 'code-date';
      date.textContent = 'Saved ' + new Date(record.updatedAt || record.createdAt).toLocaleDateString(undefined, {
        day: 'numeric', month: 'short', year: 'numeric'
      });
      info.appendChild(title);
      info.appendChild(meta);
      info.appendChild(date);

      var actions = document.createElement('div');
      actions.className = 'code-actions';
      actions.appendChild(makeButton('Open', 'btn-primary', function () { openRecord(record); }));
      var png = makeButton('PNG', 'btn-secondary', function () {
        withBusy(png, function () { return download('png', record); });
      });
      png.setAttribute('aria-label', 'Download ' + record.name + ' as PNG');
      var svg = makeButton('SVG', 'btn-secondary', function () {
        withBusy(svg, function () { return download('svg', record); });
      });
      svg.setAttribute('aria-label', 'Download ' + record.name + ' as SVG');
      var del = makeButton('Delete', 'btn-danger', function () { deleteRecord(record); });
      del.setAttribute('aria-label', 'Delete ' + record.name);
      actions.appendChild(png);
      actions.appendChild(svg);
      actions.appendChild(del);

      li.appendChild(thumb);
      li.appendChild(info);
      li.appendChild(actions);
      els.list.appendChild(li);
    });
  }

  // ---------- Theme ----------

  var themeToggle = $('theme-toggle');
  var darkQuery = window.matchMedia('(prefers-color-scheme: dark)');

  function currentTheme() {
    return document.documentElement.dataset.theme || (darkQuery.matches ? 'dark' : 'light');
  }

  function updateThemeButton() {
    var dark = currentTheme() === 'dark';
    themeToggle.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
    themeToggle.title = dark ? 'Switch to light mode' : 'Switch to dark mode';
  }

  themeToggle.addEventListener('click', function () {
    var next = currentTheme() === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem(THEME_KEY, next); } catch (e) { /* private mode */ }
    updateThemeButton();
  });
  if (darkQuery.addEventListener) darkQuery.addEventListener('change', updateThemeButton);

  // ---------- Scanner ----------

  var scanner = {
    dialog: $('scanner'),
    status: $('reader-status'),
    readerWrap: $('reader-wrap'),
    result: $('scan-result'),
    resultText: $('scan-result-text'),
    openLink: $('scan-open-link'),
    instance: null,
    running: false,
    libPromise: null
  };

  function loadScannerLib() {
    if (window.Html5Qrcode) return Promise.resolve();
    if (!scanner.libPromise) {
      scanner.libPromise = new Promise(function (resolve, reject) {
        var s = document.createElement('script');
        s.src = 'vendor/html5-qrcode-2.3.8.min.js';
        s.onload = function () { resolve(); };
        s.onerror = function () {
          scanner.libPromise = null;
          reject(new Error('Could not load the scanner. Check your connection and try again.'));
        };
        document.head.appendChild(s);
      });
    }
    return scanner.libPromise;
  }

  function scannerInstance() {
    if (!scanner.instance) {
      scanner.instance = new window.Html5Qrcode('reader', {
        verbose: false,
        formatsToSupport: [window.Html5QrcodeSupportedFormats.QR_CODE],
        // Use the phone's built-in QR reader when the browser has one (faster, more reliable).
        experimentalFeatures: { useBarCodeDetectorIfSupported: true }
      });
    }
    return scanner.instance;
  }

  function setScanStatus(text, isError) {
    scanner.status.textContent = text;
    scanner.status.hidden = !text;
    scanner.status.classList.toggle('is-error', !!isError);
  }

  function stopCamera() {
    if (scanner.instance && scanner.running) {
      scanner.running = false;
      return scanner.instance.stop().catch(function () {}).then(function () {
        try { scanner.instance.clear(); } catch (e) { /* already cleared */ }
      });
    }
    return Promise.resolve();
  }

  function cameraErrorMessage(err) {
    var text = String(err && (err.name || err.message) || err);
    if (/NotAllowed|Permission/i.test(text)) {
      return 'Camera access is blocked. Allow the camera in your browser settings, or scan from a photo.';
    }
    if (/NotFound|no camera|Requested device not found|OverconstrainedError/i.test(text)) {
      return 'No camera found. You can scan from a photo instead.';
    }
    if (/NotReadable|in use/i.test(text)) {
      return 'The camera is being used by another app. Close it and try again.';
    }
    return 'Could not start the camera. You can scan from a photo instead.';
  }

  function startCamera() {
    scanner.result.hidden = true;
    scanner.readerWrap.hidden = false;
    setScanStatus('Starting the camera…');

    if (!window.isSecureContext || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setScanStatus('The camera only works on a secure (https) page. You can scan from a photo instead.', true);
      return;
    }

    loadScannerLib().then(function () {
      if (!scanner.dialog.open) return;
      var instance = scannerInstance();
      return instance.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: function (w, h) {
            var size = Math.max(150, Math.floor(Math.min(w, h) * 0.7));
            return { width: size, height: size };
          }
        },
        onScanSuccess,
        function () { /* no code in this frame – keep looking */ }
      ).then(function () {
        scanner.running = true;
        if (!scanner.dialog.open) {
          stopCamera();
          return;
        }
        setScanStatus('Point the camera at a QR code.');
      });
    }).catch(function (err) {
      setScanStatus(err && err.message && /scanner/i.test(err.message) ? err.message : cameraErrorMessage(err), true);
    });
  }

  function showScanResult(text) {
    scanner.readerWrap.hidden = true;
    scanner.result.hidden = false;
    scanner.resultText.textContent = text;
    var isLink = /^https?:\/\/\S+$/i.test(text.trim());
    scanner.openLink.hidden = !isLink;
    if (isLink) scanner.openLink.href = text.trim();
    else scanner.openLink.removeAttribute('href');
  }

  function onScanSuccess(text) {
    if (navigator.vibrate) navigator.vibrate(60);
    stopCamera();
    showScanResult(text);
  }

  $('open-scanner').addEventListener('click', function () {
    if (typeof scanner.dialog.showModal === 'function') scanner.dialog.showModal();
    else scanner.dialog.setAttribute('open', '');
    startCamera();
  });

  function closeScanner() {
    stopCamera();
    if (scanner.dialog.open) {
      if (typeof scanner.dialog.close === 'function') scanner.dialog.close();
      else scanner.dialog.removeAttribute('open');
    }
  }

  $('close-scanner').addEventListener('click', closeScanner);
  scanner.dialog.addEventListener('close', function () { stopCamera(); });
  scanner.dialog.addEventListener('click', function (e) {
    if (e.target === scanner.dialog) closeScanner();
  });

  $('scan-again').addEventListener('click', startCamera);

  $('scan-copy').addEventListener('click', function () {
    var text = scanner.resultText.textContent;
    var done = function () { toast('Copied'); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { fallbackCopy(text); done(); });
    } else {
      fallbackCopy(text);
      done();
    }
  });

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    scanner.dialog.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch (e) { /* ignore */ }
    ta.remove();
  }

  // Draws the photo resized and turned by a few degrees. The decoder sometimes
  // misses a code in one exact position but finds it in a slightly changed copy.
  function photoVariant(img, maxSize, degrees) {
    var scale = Math.min(1, maxSize / Math.max(img.naturalWidth, img.naturalHeight));
    var w = Math.round(img.naturalWidth * scale);
    var h = Math.round(img.naturalHeight * scale);
    var side = degrees ? Math.ceil(Math.hypot(w, h)) : 0;
    var canvas = document.createElement('canvas');
    canvas.width = side || w;
    canvas.height = side || h;
    var ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(degrees * Math.PI / 180);
    ctx.drawImage(img, -w / 2, -h / 2, w, h);
    return new Promise(function (resolve) {
      canvas.toBlob(function (blob) {
        resolve(new File([blob], 'photo.png', { type: 'image/png' }));
      }, 'image/png');
    });
  }

  function scanPhoto(file) {
    var instance = scannerInstance();
    var attempts = [[800, 0], [640, 0], [800, 10], [640, -10], [1000, 4], [800, 45]];
    return instance.scanFile(file, false).catch(function () {
      var url = URL.createObjectURL(file);
      return loadImage(url).then(function (img) {
        URL.revokeObjectURL(url);
        var tryNext = function (i) {
          if (i >= attempts.length) return Promise.reject(new Error('No QR code found'));
          return photoVariant(img, attempts[i][0], attempts[i][1]).then(function (variant) {
            return instance.scanFile(variant, false);
          }).catch(function () { return tryNext(i + 1); });
        };
        return tryNext(0);
      }, function (err) {
        URL.revokeObjectURL(url);
        throw err;
      });
    });
  }

  $('scan-file').addEventListener('change', function () {
    var input = this;
    var file = input.files && input.files[0];
    input.value = '';
    if (!file) return;
    setScanStatus('Reading the photo…');
    scanner.readerWrap.hidden = false;
    scanner.result.hidden = true;
    stopCamera().then(loadScannerLib).then(function () {
      return scanPhoto(file);
    }).then(function (text) {
      showScanResult(text);
    }).catch(function () {
      setScanStatus('No QR code found in that photo. Try a clearer, closer picture.', true);
    });
  });

  // ---------- Start ----------

  writeFields();
  writeStyle();
  setEditing(null);
  setType('link');
  renderList();
  updateThemeButton();
})();
