const http = require('http');
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:3000';

function post(endpoint, data, headers = {}) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(data);
    const req = http.request(`${BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        ...headers
      }
    }, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function put(endpoint, data, headers = {}) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(data);
    const req = http.request(`${BASE_URL}${endpoint}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        ...headers
      }
    }, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function get(endpoint, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(`${BASE_URL}${endpoint}`, {
      method: 'GET',
      headers
    }, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function runApostilleTests() {
  console.log('====================================================');
  console.log('   RUNNING APOSTILLE VERIFICATION & CMS TESTS       ');
  console.log('====================================================\n');

  // Step 1: Verify Screenshot Document (APO-KTAQ-NWSP-VDSJ)
  console.log('[Step 1] Verifying Official Reference Document (APO-KTAQ-NWSP-VDSJ)...');
  const resApos = await post('/api/verify', {
    docNumber: 'APO-KTAQ-NWSP-VDSJ',
    docDate: '2026-06-09'
  });

  assert.strictEqual(resApos.status, 200, 'Verification HTTP status should be 200');
  assert.strictEqual(resApos.data.status, 'VERIFIED', 'Document status should be VERIFIED');
  const rec = resApos.data.record;
  assert.strictEqual(rec.docNumber, 'APO-KTAQ-NWSP-VDSJ');
  assert.strictEqual(rec.country, 'Pakistan');
  assert.strictEqual(rec.documentCategory, 'Personal Document');
  assert.strictEqual(rec.signedBy, 'N/A');
  assert.strictEqual(rec.capacity, 'Registrar');
  assert.strictEqual(rec.sealOf, 'Preston University');
  assert.strictEqual(rec.issuePlace, 'Lahore Pakistan');
  assert.strictEqual(rec.issueDate, '2026-06-09');
  assert.strictEqual(rec.issuingAuthority, 'Ministry of Foreign Affairs');
  assert.strictEqual(rec.signatoryOfficer, 'Ali Faraz');
  assert.strictEqual(rec.pdfFileName, 'wLb2mwU18B98yhP5HgPkdE365DWUOhgJCl0djEsH.pdf');
  console.log(`✓ Reference Document matched 100%:`);
  console.log(`   - Document: ${rec.docNumber} (${rec.documentCategory})`);
  console.log(`   - Origin: ${rec.country} | Signed By: ${rec.signedBy} | Capacity: ${rec.capacity}`);
  console.log(`   - Seal: ${rec.sealOf} | Location: ${rec.issuePlace}`);
  console.log(`   - Signatory Officer: ${rec.signatoryOfficer}`);
  console.log(`   - Attached Document: ${rec.pdfFileName}`);

  // Step 2: Verify Attached PDF is served properly
  console.log('\n[Step 2] Testing Attached PDF Download / Viewer Endpoint...');
  const resPdf = await get(`/uploads/${rec.pdfFileName}`);
  assert.strictEqual(resPdf.status, 200, 'PDF endpoint should return HTTP 200');
  assert(resPdf.data.startsWith('%PDF'), 'Returned file should be a valid PDF binary header');
  console.log(`✓ Attached PDF successfully served: /uploads/${rec.pdfFileName} (${resPdf.data.length} bytes)`);

  // Step 3: Verify QR Code Generator Library is served
  console.log('\n[Step 3] Checking Client-Side QR Generator Library...');
  const resQr = await get('/js/qrcode.min.js');
  assert.strictEqual(resQr.status, 200, 'qrcode.min.js should return HTTP 200');
  assert(resQr.data.includes('renderQRCodeSVG'), 'qrcode.min.js should contain renderQRCodeSVG');
  console.log('✓ QR Code generator client library is active and accessible.');

  // Step 4: Admin Authentication
  console.log('\n[Step 4] Authenticating Admin for CMS Configuration...');
  const loginRes = await post('/api/admin/login', { username: 'admin', password: 'admin123' });
  assert.strictEqual(loginRes.status, 200);
  const token = loginRes.data.token;
  const authHeaders = { Authorization: `Bearer ${token}` };
  console.log('✓ Admin authenticated successfully.');

  // Step 5: Verify Certificate View Settings in Config Draft & Published
  console.log('\n[Step 5] Checking Apostille Certificate View Settings in CMS...');
  const confRes = await get('/api/admin/config/draft', authHeaders);
  assert.strictEqual(confRes.status, 200);
  const cv = confRes.data.certificateView;
  assert(cv, 'certificateView should exist in draft config');
  assert.strictEqual(cv.conventionTitle, 'APOSTILLE');
  assert.strictEqual(cv.conventionSubtitle, '(Convention de La Haye du 5 October 1961)');
  assert.strictEqual(cv.defaultCountry, 'Pakistan');
  assert.strictEqual(cv.watermarkText, 'GOVTOFPAKISTAN');
  assert.strictEqual(cv.enablePdfViewer, true);
  console.log(`✓ Certificate CMS Configuration validated:`);
  console.log(`   - Title: ${cv.pageTitle}`);
  console.log(`   - Convention: ${cv.conventionTitle} ${cv.conventionSubtitle}`);
  console.log(`   - Watermark: ${cv.watermarkText} | PDF Viewer Enabled: ${cv.enablePdfViewer}`);

  // Step 6: Testing PDF Upload via Admin Media API
  console.log('\n[Step 6] Testing Admin PDF Upload via /api/admin/upload...');
  const dummyPdf = '%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\nxref\n0 2\ntrailer\n<< /Root 1 0 R >>\n%%EOF';
  const base64Pdf = Buffer.from(dummyPdf).toString('base64');
  const uploadRes = await post('/api/admin/upload', {
    fileName: 'test_certificate_document.pdf',
    fileData: `data:application/pdf;base64,${base64Pdf}`
  }, authHeaders);
  assert.strictEqual(uploadRes.status, 200, 'PDF upload should return HTTP 200');
  assert(uploadRes.data.success, 'PDF upload should succeed');
  assert(uploadRes.data.fileUrl.endsWith('.pdf'), 'Uploaded file should have .pdf extension');
  console.log(`✓ Admin PDF upload successful: ${uploadRes.data.fileUrl}`);

  // Step 7: Create a new Document Record with full Apostille fields
  console.log('\n[Step 7] Registering a new Document with full Apostille attributes...');
  const uniqueDoc = `APO-TEST-${Date.now()}`;
  const newDocRes = await post('/api/admin/records', {
    docNumber: uniqueDoc,
    applicantName: 'Zainab Bibi',
    documentCategory: 'Educational Degree',
    country: 'Pakistan',
    signedBy: 'N/A',
    capacity: 'Controller of Examinations',
    sealOf: 'University of Engineering and Technology',
    issuePlace: 'Peshawar Pakistan',
    issueDate: '2026-10-18',
    issuingAuthority: 'Ministry of Foreign Affairs',
    signatoryOfficer: 'Ali Faraz',
    documentType: 'Degree Attestation',
    status: 'VERIFIED',
    pdfFileName: 'wLb2mwU18B98yhP5HgPkdE365DWUOhgJCl0djEsH.pdf',
    pdfUrl: '/uploads/wLb2mwU18B98yhP5HgPkdE365DWUOhgJCl0djEsH.pdf',
    notes: 'Created via automated Apostille integration test'
  }, authHeaders);

  assert.strictEqual(newDocRes.status, 201, 'Record creation should return HTTP 201');
  const createdRecord = newDocRes.data.record;
  assert.strictEqual(createdRecord.docNumber, uniqueDoc);
  console.log(`✓ Registered new document: ${uniqueDoc} (${createdRecord.sealOf})`);

  // Step 8: Verify the newly registered document through the public verification endpoint
  console.log('\n[Step 8] Verifying newly registered document through public verification API...');
  const verifyNewRes = await post('/api/verify', {
    docNumber: uniqueDoc,
    docDate: '2026-10-18'
  });
  assert.strictEqual(verifyNewRes.status, 200);
  assert.strictEqual(verifyNewRes.data.status, 'VERIFIED');
  assert.strictEqual(verifyNewRes.data.record.capacity, 'Controller of Examinations');
  assert.strictEqual(verifyNewRes.data.record.sealOf, 'University of Engineering and Technology');
  console.log(`✓ Public verification confirmed for ${uniqueDoc}: Status = VERIFIED`);

  // Clean up: delete test record and temporary uploaded file
  await get(`/api/admin/records`, authHeaders);
  const delRes = await new Promise((resolve) => {
    const req = http.request(`${BASE_URL}/api/admin/records/${createdRecord.id}`, {
      method: 'DELETE',
      headers: authHeaders
    }, res => resolve({ status: res.statusCode }));
    req.end();
  });
  assert.strictEqual(delRes.status, 200, 'Test record should be deleted cleanly');
  const uploadedPath = path.join(__dirname, uploadRes.data.fileUrl.replace(/^\//, ''));
  if (fs.existsSync(uploadedPath)) {
    try { fs.unlinkSync(uploadedPath); } catch {}
  }
  console.log(`✓ Test record and temporary upload cleaned up.`);

  console.log('\n====================================================');
  console.log('   🎉 ALL APOSTILLE VERIFICATION TESTS PASSED!      ');
  console.log('====================================================');
}

runApostilleTests().catch(err => {
  console.error('\n❌ Test Failed:', err);
  process.exit(1);
});
