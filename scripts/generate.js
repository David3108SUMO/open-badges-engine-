const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const QRCode = require('qrcode');
const puppeteer = require('puppeteer');

async function run() {
  const payloadRaw = process.env.CLIENT_PAYLOAD;
  const privateKeyPem = process.env.PRIVATE_KEY;

  if (!payloadRaw || !privateKeyPem) {
    console.error("Fehler: Payload oder Private Key fehlt!");
    process.exit(1);
  }

  const data = JSON.parse(payloadRaw);
  const credId = data.credentialId;
  const repoOwner = process.env.REPO_OWNER;
  const repoName = process.env.REPO_NAME;
  const verifyUrl = `https://${repoOwner}.github.io/${repoName}/?id=${credId}`;

  // 1. QR Code mit Kontrast erzeugen
  const qrDataUrl = await QRCode.toDataURL(verifyUrl, {
    margin: 1,
    width: 250,
    color: { dark: '#005938', light: '#ffffff' }
  });

  // 2. SVG Badge aus templates laden
  let customBadgeSvg = '';
  const badgePath = path.join(__dirname, '../templates/badge.svg');
  if (fs.existsSync(badgePath)) {
    customBadgeSvg = fs.readFileSync(badgePath, 'utf8');
  }

  // 3. Kryptographische Signatur erstellen (ECDSA SHA-256)
  const credentialSubject = {
    id: `urn:uuid:${credId}`,
    recipientName: data.recipientName,
    achievementName: data.courseName,
    issuedAt: data.completionDate || new Date().toISOString()
  };

  const sign = crypto.createSign('SHA256');
  sign.update(JSON.stringify(credentialSubject));
  sign.end();
  const signature = sign.sign(privateKeyPem, 'base64');

  const fullCredential = {
    "@context": ["https://www.w3.org/ns/credentials/v2"],
    "id": `urn:uuid:${credId}`,
    "type": ["VerifiableCredential", "CourseCompletionCertificate"],
    "issuer": {
      "id": `https://${repoOwner}.github.io/${repoName}/.well-known/public.pem`,
      "name": "DEKRA Akademie GmbH"
    },
    "validFrom": credentialSubject.issuedAt,
    "credentialSubject": credentialSubject,
    "proof": {
      "type": "JsonWebSignature2020",
      "verificationMethod": `https://${repoOwner}.github.io/${repoName}/.well-known/public.pem`,
      "signature": signature
    }
  };

  // Ordner anlegen
  const outDirData = path.join(__dirname, '../data');
  const outDirCerts = path.join(__dirname, '../certs');
  [outDirData, outDirCerts].forEach(d => fs.mkdirSync(d, { recursive: true }));
  fs.writeFileSync(path.join(outDirData, `${credId}.json`), JSON.stringify(fullCredential, null, 2));

  // 4. HTML Template für DIN A4 Hochformat
  const formattedDate = new Date(credentialSubject.issuedAt).toLocaleDateString("de-DE", {
    day: "2-digit", month: "2-digit", year: "numeric"
  });

  const certificateHtml = `
  <!DOCTYPE html>
  <html lang="de">
  <head>
    <meta charset="UTF-8">
    <style>
      @page { size: A4 portrait; margin: 0; }
      * { box-sizing: border-box; }
      body {
        margin: 0; padding: 0; width: 210mm; height: 297mm;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
        color: #1a1a1a; position: relative; background: #ffffff;
        -webkit-print-color-adjust: exact;
      }
      .top-wave {
        position: absolute; top: 0; left: 0; width: 105mm; height: 110mm;
        background: #005938; border-bottom-right-radius: 95mm;
        clip-path: polygon(0 0, 100% 0, 100% 45%, 70% 100%, 0 100%); z-index: 1;
      }
      .top-wave-accent {
        position: absolute; top: 0; left: 0; width: 75mm; height: 45mm;
        background: #50a625; border-bottom-right-radius: 40mm; z-index: 2;
      }
      .cert-heading {
        position: absolute; top: 55mm; left: 15mm; font-size: 32px;
        font-weight: 800; color: #ffffff; z-index: 3;
      }
      .header-right {
        position: absolute; top: 16mm; right: 18mm;
        display: flex; flex-direction: column; align-items: flex-end; gap: 8px; z-index: 10;
      }
      .custom-badge-container { width: 46mm; height: auto; }
      .custom-badge-container svg { width: 100%; height: auto; }
      .content {
        position: absolute; top: 120mm; left: 25mm; right: 25mm;
        text-align: center; z-index: 10;
      }
      .recipient-name { font-size: 26px; font-weight: 700; color: #005938; margin-bottom: 8px; }
      .subtext { font-size: 13px; color: #333333; margin-bottom: 12px; }
      .course-name { font-size: 17px; font-weight: 800; color: #111111; line-height: 1.35; margin-bottom: 12px; }
      .academy-text { font-size: 12px; color: #333333; margin-bottom: 25px; }
      .footer-left {
        position: absolute; bottom: 20mm; left: 25mm; font-size: 10.5px; color: #333333; z-index: 10;
      }
      .cert-id { font-family: monospace; font-size: 9px; color: #666666; margin-top: 4px; }
      .bottom-wave {
        position: absolute; bottom: 0; right: 0; width: 95mm; height: 85mm;
        background: #005938; clip-path: polygon(100% 0, 0 100%, 100% 100%);
        display: flex; flex-direction: column; align-items: flex-end; justify-content: flex-end;
        padding: 12mm; color: #ffffff; text-align: center; z-index: 10;
      }
      .bottom-wave .qr-title { font-size: 9.5px; margin-bottom: 8px; line-height: 1.2; }
      .bottom-wave img { width: 32mm; height: 32mm; border-radius: 4px; background: #ffffff; padding: 2px; }
    </style>
  </head>
  <body>
    <div class="top-wave-accent"></div>
    <div class="top-wave"></div>
    <div class="cert-heading">Zertifikat</div>

    <div class="header-right">
      ${customBadgeSvg ? `<div class="custom-badge-container">${customBadgeSvg}</div>` : ''}
    </div>

    <div class="content">
      <div class="recipient-name">${data.recipientName}</div>
      <div class="subtext">hat am Seminar / an der Weiterbildung</div>
      <div class="course-name">${data.courseName}</div>
      <div class="academy-text">der DEKRA Akademie GmbH am ${formattedDate} erfolgreich teilgenommen.</div>
    </div>

    <div class="footer-left">
      <div>Stuttgart, ${formattedDate}</div>
      <div class="cert-id">${credId}</div>
    </div>

    <div class="bottom-wave">
      <div class="qr-title">Seminarinhalte und<br>Verifizierung:</div>
      <img src="${qrDataUrl}" alt="QR Code"/>
    </div>
  </body>
  </html>
  `;

  // 5. PDF rendern via Puppeteer
  const browser = await puppeteer.launch({
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setContent(certificateHtml, { waitUntil: 'networkidle0' });
  await page.pdf({
    path: path.join(outDirCerts, `${credId}.pdf`),
    format: 'A4',
    landscape: false,
    printBackground: true
  });
  await browser.close();

  console.log(`✓ Zertifikat certs/${credId}.pdf und data/${credId}.json erfolgreich erstellt.`);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
