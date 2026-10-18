/**
 * End-to-End Integration Test Suite
 * Verifies all requirements:
 * 1. Static endpoints
 * 2. Authoritative verification states (VERIFIED, EXPIRED, REVOKED, NOT_FOUND)
 * 3. Admin Authentication & session tokens
 * 4. Draft vs Publish workflow (isolation of draft, live update on publish)
 * 5. Navigation & external links integration
 * 6. Document Registry CRUD
 */

const http = require('http');

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

function del(endpoint, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(`${BASE_URL}${endpoint}`, {
      method: 'DELETE',
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


async function runTests() {
  console.log('====================================================');
  console.log('       RUNNING END-TO-END CMS INTEGRATION TESTS     ');
  console.log('====================================================\n');

  // Test 1: Static Endpoints
  console.log('[Test 1] Checking Static Routes...');
  const resHome = await get('/');
  if (resHome.status !== 200) throw new Error('Home route failed');
  const resAdmin = await get('/admin/');
  if (resAdmin.status !== 200) throw new Error('Admin route failed');
  console.log('✓ Public Portal (/) & Admin Dashboard (/admin/) return HTTP 200 OK');

  // Test 2: Authoritative Verification Engine (Rule 5)
  console.log('\n[Test 2] Testing Authoritative Verification States (Rule 5)...');
  
  // Valid
  const resValid = await post('/api/verify', { docNumber: 'ADG-HYUI-QRTY-BGHN', docDate: '2026-10-18' });
  if (resValid.data.status !== 'VERIFIED') throw new Error(`Expected VERIFIED, got ${resValid.data.status}`);
  console.log(`✓ Valid Certificate test: Status = ${resValid.data.status} (Holder: ${resValid.data.record.applicantName})`);

  // Expired
  const resExp = await post('/api/verify', { docNumber: 'EXP-2024-TEST-9981', docDate: '2024-01-15' });
  if (resExp.data.status !== 'EXPIRED') throw new Error(`Expected EXPIRED, got ${resExp.data.status}`);
  console.log(`✓ Expired Certificate test: Status = ${resExp.data.status} (Expired: ${resExp.data.record.expiryDate})`);

  // Revoked
  const resRvk = await post('/api/verify', { docNumber: 'RVK-8812-CANC-0012', docDate: '2025-05-20' });
  if (resRvk.data.status !== 'REVOKED') throw new Error(`Expected REVOKED, got ${resRvk.data.status}`);
  console.log(`✓ Revoked Certificate test: Status = ${resRvk.data.status} (Notes: ${resRvk.data.record.notes})`);

  // Not Found
  const resFake = await post('/api/verify', { docNumber: 'FAKE-INVALID-999', docDate: '2026-10-18' });
  if (resFake.data.status !== 'NOT_FOUND') throw new Error(`Expected NOT_FOUND, got ${resFake.data.status}`);
  console.log(`✓ Non-existent Certificate test: Status = ${resFake.data.status} (${resFake.data.message})`);

  // Date Mismatch
  const resMis = await post('/api/verify', { docNumber: 'ADG-HYUI-QRTY-BGHN', docDate: '2020-01-01' });
  if (resMis.data.status !== 'DATE_MISMATCH') throw new Error(`Expected DATE_MISMATCH, got ${resMis.data.status}`);
  console.log(`✓ Date Mismatch test: Status = ${resMis.data.status} (${resMis.data.message})`);

  // Test 3: Admin Auth (Rule 6)
  console.log('\n[Test 3] Testing Admin Authentication & Token Security (Rule 6)...');
  const badLogin = await post('/api/admin/login', { username: 'admin', password: 'wrongpassword' });
  if (badLogin.status !== 401) throw new Error('Expected 401 for bad password');
  console.log('✓ Rejected invalid login attempt with HTTP 401');

  const goodLogin = await post('/api/admin/login', { username: 'admin', password: 'admin123' });
  if (goodLogin.status !== 200 || !goodLogin.data.token) throw new Error('Valid login failed');
  const token = goodLogin.data.token;
  const authHeaders = { Authorization: `Bearer ${token}` };
  console.log(`✓ Successful admin login: Token generated (${token.substring(0, 12)}...)`);

  // Test 4: Draft vs Publish Workflow & External Links (Rules 3 & 4)
  console.log('\n[Test 4] Testing Draft vs Publish Workflow & External Links (Rules 3 & 4)...');
  
  // Get current draft
  const draftRes = await get('/api/admin/config/draft', authHeaders);
  const draft = draftRes.data;

  // Add a custom link pointing to an external website
  const testLabel = `Main Organization Portal - ${Date.now()}`;
  const externalLink = {
    id: `nav-test-${Date.now()}`,
    label: testLabel,
    url: 'https://myorganization.com/services',
    target: '_blank',
    enabled: true
  };
  draft.navigation.push(externalLink);

  // Save as Draft
  const saveRes = await post('/api/admin/config/draft', draft, authHeaders);
  if (!saveRes.data.success) throw new Error('Save draft failed');
  console.log('✓ Draft saved to draft storage.');

  // Check Public config before publish: MUST NOT have the external link
  const pubBefore = await get('/api/public/config');
  const hasLinkBefore = pubBefore.data.navigation.some(item => item.label === testLabel);
  if (hasLinkBefore) throw new Error('DRAFT ISOLATION BREACHED: Public site saw draft before publish!');
  console.log('✓ Verified Draft Isolation: Public website does NOT have the new link yet.');

  // Check status endpoint
  const statusRes = await get('/api/admin/config/status', authHeaders);
  if (!statusRes.data.hasDraftChanges) throw new Error('Expected hasDraftChanges to be true');
  console.log('✓ Publishing status indicator correctly flagged: hasDraftChanges = true');

  // Publish to Live Site
  const pubActionRes = await post('/api/admin/config/publish', {}, authHeaders);
  if (!pubActionRes.data.success) throw new Error('Publish live failed');
  console.log(`✓ Published draft to live site! Snapshot created: ${pubActionRes.data.snapshot}`);

  // Check Public config after publish: MUST HAVE the external link
  const pubAfter = await get('/api/public/config');
  const matchingLink = pubAfter.data.navigation.find(item => item.label === testLabel);
  if (!matchingLink || matchingLink.url !== 'https://myorganization.com/services') {
    throw new Error('Public site does not have the published external link!');
  }
  console.log(`✓ Verified Live Update: Public website now contains "${matchingLink.label}" -> ${matchingLink.url} (${matchingLink.target})`);

  // Test 5: Document Registry CRUD (Rule 5)
  console.log('\n[Test 5] Testing Document Registry CRUD & Auto-Verification...');
  const testCertNum = `ATTEST-${Date.now()}`;
  const newCert = {
    docNumber: testCertNum,
    applicantName: 'Fatima Zahra',
    documentType: 'Master of Engineering Degree Attestation',
    issueDate: '2026-10-18',
    expiryDate: '',
    issuingAuthority: 'National Directorate of Attestations',
    status: 'VERIFIED',
    notes: 'Document registered via Admin CMS integration test.'
  };

  const addRecRes = await post('/api/admin/records', newCert, authHeaders);
  if (!addRecRes.data.success) throw new Error('Failed to create new document record');
  console.log(`✓ Successfully registered new document in database: ${addRecRes.data.record.docNumber} (Holder: ${addRecRes.data.record.applicantName})`);

  // Immediately test public verification of this new document
  const verifyNew = await post('/api/verify', { docNumber: testCertNum, docDate: '2026-10-18' });
  if (verifyNew.data.status !== 'VERIFIED' || verifyNew.data.record.applicantName !== 'Fatima Zahra') {
    throw new Error('Public verification of new registered record failed!');
  }
  console.log(`✓ Public Verification confirmed: Status = ${verifyNew.data.status}, Name = ${verifyNew.data.record.applicantName}, Hash = ${verifyNew.data.record.securityHash}`);

  // Clean up: delete test record and restore clean navigation
  await del(`/api/admin/records/${addRecRes.data.record.id}`, authHeaders);
  const cleanDraftRes = await get('/api/admin/config/draft', authHeaders);
  const cleanDraft = cleanDraftRes.data;
  cleanDraft.navigation = cleanDraft.navigation.filter(item => !item.id.startsWith('nav-test-'));
  await post('/api/admin/config/draft', cleanDraft, authHeaders);
  await post('/api/admin/config/publish', {}, authHeaders);
  console.log('✓ Test record and temporary test navigation links cleaned up cleanly.');

  // Test 6: Persistence Check (Data files on disk)
  console.log('\n[Test 6] Verifying Data File Persistence on Disk...');
  const fs = require('fs');
  const path = require('path');
  const pubFile = path.join(__dirname, 'data', 'config.published.json');
  const recFile = path.join(__dirname, 'data', 'records.json');
  if (!fs.existsSync(pubFile) || !fs.existsSync(recFile)) throw new Error('Data files missing');
  console.log('✓ data/config.published.json and data/records.json exist and are safely persisted.');

  console.log('\n====================================================');
  console.log('     🎉 ALL END-TO-END INTEGRATION TESTS PASSED!    ');
  console.log('====================================================');
}

runTests().catch(err => {
  console.error('\n❌ TEST FAILED:', err.message);
  process.exit(1);
});
