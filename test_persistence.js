const http = require('http');

function request(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, headers: res.headers, body: data });
        }
      });
    });
    req.on('error', reject);
    if (postData) {
      req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
    }
    req.end();
  });
}

async function runTests() {
  console.log('--- Testing Persistence & Auto-Heal APIs ---');

  // 1. Admin Login to get token
  const loginRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/admin/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { username: 'admin', password: 'admin123' });

  let token = loginRes.body?.token;
  if (!token) {
    // Try default admin123
    const loginRes2 = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/admin/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { username: 'admin', password: 'password123' });
    token = loginRes2.body?.token;
  }

  console.log('Admin login status:', loginRes.status, 'token acquired:', !!token);
  if (!token) {
    throw new Error('Could not authenticate admin');
  }

  // 2. Test Export Records Backup
  const exportRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/admin/records/export',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  console.log('Export records status:', exportRes.status, 'isArray:', Array.isArray(exportRes.body), 'count:', exportRes.body?.length);
  if (exportRes.status !== 200 || !Array.isArray(exportRes.body)) {
    throw new Error('Export records API failed');
  }

  // 3. Test Import Records Backup (Restore)
  const testDocId = `TEST-PERSIST-${Date.now()}`;
  const importPayload = [
    ...exportRes.body,
    {
      id: `rec-${testDocId}`,
      docNumber: testDocId,
      applicantName: "Persistence Test User",
      documentType: "Master Degree Attestation",
      documentCategory: "Educational Document",
      country: "Pakistan",
      issueDate: "2026-10-27",
      status: "VERIFIED"
    }
  ];

  const importRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/admin/records/import',
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  }, importPayload);

  console.log('Import records status:', importRes.status, 'response:', importRes.body?.message);
  if (importRes.status !== 200 || !importRes.body?.success) {
    throw new Error('Import records API failed');
  }

  // 4. Test Cloud Sync Settings GET
  const cloudGetRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/admin/cloud-sync',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  console.log('Get Cloud Sync status:', cloudGetRes.status, 'repo:', cloudGetRes.body?.githubRepo);
  if (cloudGetRes.status !== 200 || !cloudGetRes.body?.githubRepo) {
    throw new Error('Get cloud sync failed');
  }

  // 5. Test Cloud Sync Settings POST
  const cloudPostRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/admin/cloud-sync',
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  }, {
    githubRepo: "johnhan357-lgtm/testing",
    githubBranch: "main",
    autoCommit: true
  });
  console.log('Save Cloud Sync status:', cloudPostRes.status, 'success:', cloudPostRes.body?.success);
  if (cloudPostRes.status !== 200 || !cloudPostRes.body?.success) {
    throw new Error('Save cloud sync failed');
  }

  // 6. Test Self-Healing Verification with backupRecord
  const healDocId = `HEAL-DOC-${Date.now()}`;
  const healVerifyRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/verify',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    docNumber: healDocId,
    docDate: "2026-10-27",
    backupRecord: {
      docNumber: healDocId,
      applicantName: "Healed Candidate",
      documentType: "Special Diplomatic Clearance",
      documentCategory: "Official Document",
      issueDate: "2026-10-27",
      status: "VERIFIED"
    }
  });

  console.log('Self-healing verify status:', healVerifyRes.status, 'verified:', healVerifyRes.body?.success, 'applicant:', healVerifyRes.body?.record?.applicantName);
  if (healVerifyRes.status !== 200 || !healVerifyRes.body?.success) {
    throw new Error('Self-healing verification failed');
  }

  // Clean up test document
  const deleteRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/admin/records/rec-${testDocId}`,
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  console.log('Test record cleanup status:', deleteRes.status);

  console.log('\n=== ALL PERSISTENCE TESTS PASSED 100% ===');
}

runTests().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
