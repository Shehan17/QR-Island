/*
 * QR Island – turns form values into the text stored inside a QR code,
 * plus small color helpers for the scan check.
 */
(function () {
  'use strict';

  var TYPES = {
    link: { label: 'Link', empty: 'Type a link to see your QR code.' },
    text: { label: 'Text', empty: 'Type some text to see your QR code.' },
    wifi: { label: 'WiFi', empty: 'Type the WiFi name to see your QR code.' },
    contact: { label: 'Contact', empty: 'Add a name, phone or email to see your QR code.' },
    whatsapp: { label: 'WhatsApp', empty: 'Type a phone number to see your QR code.' },
    location: { label: 'Location', empty: 'Type the latitude and longitude to see your QR code.' }
  };

  function trim(value) {
    return (value == null ? '' : String(value)).trim();
  }

  // WiFi QR format: backslash, ; , : and " must be escaped.
  function escapeWifi(value) {
    return value.replace(/([\\;,:"])/g, '\\$1');
  }

  // vCard: backslash, ; and , must be escaped, new lines become \n.
  function escapeVcard(value) {
    return value.replace(/\\/g, '\\\\').replace(/([;,])/g, '\\$1').replace(/\r?\n/g, '\\n');
  }

  function buildLink(f) {
    var url = trim(f.url);
    if (!url) return { error: TYPES.link.empty };
    if (/\s/.test(url)) return { error: 'A link cannot contain spaces.' };
    if (!/^[a-z][a-z0-9+.-]*:/i.test(url)) url = 'https://' + url;
    return { data: url, summary: url.replace(/^https?:\/\//i, '') };
  }

  function buildText(f) {
    var text = f.body == null ? '' : String(f.body);
    if (!trim(text)) return { error: TYPES.text.empty };
    return { data: text, summary: trim(text) };
  }

  function buildWifi(f) {
    var ssid = f.ssid == null ? '' : String(f.ssid);
    if (!trim(ssid)) return { error: TYPES.wifi.empty };
    var security = f.security === 'WEP' || f.security === 'nopass' ? f.security : 'WPA';
    var password = f.password == null ? '' : String(f.password);
    if (security !== 'nopass' && !password) {
      return { error: 'Type the WiFi password, or choose “No password”.' };
    }
    var data = 'WIFI:T:' + security + ';S:' + escapeWifi(ssid) + ';';
    if (security !== 'nopass') data += 'P:' + escapeWifi(password) + ';';
    if (f.hidden) data += 'H:true;';
    data += ';';
    return { data: data, summary: trim(ssid) };
  }

  function buildContact(f) {
    var name = trim(f.name);
    var phone = trim(f.phone);
    var email = trim(f.email);
    if (!name && !phone && !email) return { error: TYPES.contact.empty };
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { error: 'That email does not look right. Check it and try again.' };
    }
    var parts = name.split(/\s+/).filter(Boolean);
    var last = parts.length > 1 ? parts.pop() : '';
    var first = parts.join(' ');
    var lines = ['BEGIN:VCARD', 'VERSION:3.0'];
    lines.push('N:' + escapeVcard(last) + ';' + escapeVcard(first) + ';;;');
    lines.push('FN:' + escapeVcard(name || phone || email));
    if (phone) lines.push('TEL;TYPE=CELL:' + escapeVcard(phone));
    if (email) lines.push('EMAIL:' + escapeVcard(email));
    lines.push('END:VCARD');
    return { data: lines.join('\n'), summary: name || phone || email };
  }

  function buildWhatsapp(f) {
    var raw = trim(f.phone);
    if (!raw) return { error: TYPES.whatsapp.empty };
    var digits = raw.replace(/^00/, '').replace(/\D/g, '');
    if (digits.length < 7 || digits.length > 15) {
      return { error: 'Type a full phone number with the country code, like +1 555 123 4567.' };
    }
    var url = 'https://wa.me/' + digits;
    var message = trim(f.message);
    if (message) url += '?text=' + encodeURIComponent(message);
    return { data: url, summary: '+' + digits };
  }

  function parseCoordinate(value) {
    var text = trim(value).replace(',', '.');
    if (!/^[-+]?\d+(\.\d+)?$/.test(text)) return NaN;
    return parseFloat(text);
  }

  function buildLocation(f) {
    var latText = trim(f.lat);
    var lngText = trim(f.lng);
    if (!latText || !lngText) return { error: TYPES.location.empty };
    var lat = parseCoordinate(latText);
    var lng = parseCoordinate(lngText);
    if (isNaN(lat) || lat < -90 || lat > 90) return { error: 'Latitude must be a number from -90 to 90.' };
    if (isNaN(lng) || lng < -180 || lng > 180) return { error: 'Longitude must be a number from -180 to 180.' };
    var q = lat + ',' + lng;
    return { data: 'https://www.google.com/maps/search/?api=1&query=' + q, summary: q };
  }

  var BUILDERS = {
    link: buildLink,
    text: buildText,
    wifi: buildWifi,
    contact: buildContact,
    whatsapp: buildWhatsapp,
    location: buildLocation
  };

  /** Returns { data, summary } or { error } for a type and its field values. */
  function build(type, fields) {
    var builder = BUILDERS[type];
    if (!builder) return { error: 'Unknown QR code type.' };
    return builder(fields || {});
  }

  // ---- Color helpers ----

  function hexToRgb(hex) {
    var h = String(hex).replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }

  function luminance(hex) {
    var c = hexToRgb(hex);
    var ch = [c.r, c.g, c.b].map(function (v) {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
  }

  function contrastRatio(a, b) {
    var la = luminance(a);
    var lb = luminance(b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  }

  window.QRContent = {
    TYPES: TYPES,
    build: build,
    luminance: luminance,
    contrastRatio: contrastRatio
  };
})();
