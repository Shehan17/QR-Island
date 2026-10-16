# QR Island 🏝️

A free, simple QR code maker that runs in your browser. No sign-up and no server: everything happens on your device.

**How it works:** pick a type → style it → download.

## Features

- **6 QR types**
  - **Link**: any website (adds `https://` for you)
  - **Text**: any message
  - **WiFi**: network name, password and security type (WPA, WEP or none). Scanning joins the network.
  - **Contact**: name, phone and email (saved as a vCard)
  - **WhatsApp**: phone number and an optional message
  - **Location**: latitude and longitude, opens in Google Maps (or tap "Use my current location")
- **Live preview** that updates as you type or change the style
- **Style**: QR color, background color, dot shape (square, rounded, dots) and a logo in the center
- **Ready color sets**: Ocean Blue, Sunset Orange and Palm Green
- **Scan check**: a green "Good, this will scan" message, or a red warning when the colors have low contrast, the QR color is lighter than the background, or the logo is too big
- **Text under the QR**: add a label like "Scan me"
- **Download** as PNG (for sharing) or SVG (sharp at any size, for printing)
- **My QR Codes**: save codes on this device (localStorage), then open, edit, download or delete them
- **Scan**: read a QR code with your phone camera, or from a photo
- **Light and dark mode**, mobile-first design

## Tech

Plain HTML, CSS and JavaScript. There is no build step and no backend.

- [qr-code-styling](https://github.com/kozakdenys/qr-code-styling) 1.9.2 (MIT) makes the QR codes
- [html5-qrcode](https://github.com/mebjas/html5-qrcode) 2.3.8 (Apache-2.0) reads them. It only loads when you open the scanner.

Both libraries are in `vendor/`, so the app doesn't depend on a CDN.

```
index.html          the page
css/styles.css      styles, light and dark themes
js/qr-content.js    turns form fields into QR text (WiFi, vCard, WhatsApp, Maps) and checks color contrast
js/app.js           preview, style, downloads, saved codes, scanner, theme
assets/favicon.svg  island icon
vendor/             third-party libraries and their licenses
```

## Run locally

Serve the folder with any static web server, for example:

```sh
npx http-server .
# or
python3 -m http.server 8000
```

Then open the address it prints. The camera only works on `https://` pages or on `localhost`.

## Deploy to GitHub Pages

The repo comes with a workflow (`.github/workflows/pages.yml`) that publishes the site.

1. Push the code to the `main` branch.
2. On GitHub, go to **Settings → Pages** and set **Source** to **GitHub Actions**.
3. The workflow runs on every push to `main`. You can also start it by hand from the **Actions** tab. Your site will be at `https://<your-user>.github.io/<repo-name>/`.

All paths are relative, so the app works from a project subfolder like `/QR-Island/`.

## Privacy

QR codes are made in your browser. Saved codes and your theme choice stay in this browser's localStorage, and nothing is uploaded.
