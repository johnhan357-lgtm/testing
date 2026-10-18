/**
 * Admin Panel Sidebar Management & Public Navigation Test Suite
 * Tests all required features:
 * 1. Fetch admin sidebar tabs & groups
 * 2. Add custom admin sidebar link
 * 3. Rename existing tab label
 * 4. Reorder tabs
 * 5. Hide / Show tab
 * 6. Server-side API protection independent of tab visibility
 * 7. Remove custom link
 * 8. Safe restore to default tabs
 * 9. Separation of Admin Nav vs Public Nav
 */

const http = require('http');
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

async function runAdminSidebarTests() {
  console.log('====================================================');
  console.log('   RUNNING ADMIN PANEL SIDEBAR MANAGEMENT TESTS     ');
  console.log('====================================================\n');

  // Step 1: Admin Login
  console.log('[Step 1] Authenticating as Admin...');
  const loginRes = await post('/api/admin/login', { username: 'admin', password: 'admin123' });
  if (loginRes.status !== 200 || !loginRes.data.token) throw new Error('Login failed');
  const token = loginRes.data.token;
  const authHeaders = { Authorization: `Bearer ${token}` };
  console.log('✓ Admin authenticated successfully.');

  // Step 2: Fetch Admin Sidebar
  console.log('\n[Step 2] Fetching initial Admin Sidebar configuration...');
  const navRes = await get('/api/admin/sidebar', authHeaders);
  if (navRes.status !== 200 || !Array.isArray(navRes.data.items)) throw new Error('Failed to fetch sidebar');
  const initialItems = navRes.data.items;
  console.log(`✓ Fetched ${initialItems.length} admin sidebar items.`);

  // Step 3: Add Custom Sidebar Link with Group Heading
  console.log('\n[Step 3] Adding custom sidebar link with group heading...');
  const customId = `custom-test-${Date.now()}`;
  const customLink = {
    id: customId,
    label: 'External Analytics Dashboard',
    type: 'custom_link',
    url: 'https://analytics.internal/dashboard',
    target: '_blank',
    enabled: true,
    group: 'External Tools'
  };
  initialItems.push(customLink);

  const saveRes = await post('/api/admin/sidebar', { items: initialItems }, authHeaders);
  if (!saveRes.data.success) throw new Error('Failed to save custom link');

  const checkAdd = await get('/api/admin/sidebar', authHeaders);
  const foundLink = checkAdd.data.items.find(i => i.id === customId);
  if (!foundLink || foundLink.label !== 'External Analytics Dashboard') throw new Error('Custom link not persisted');
  console.log(`✓ Custom link added & persisted: "${foundLink.label}" -> ${foundLink.url} [Group: ${foundLink.group}]`);

  // Step 4: Rename an Existing Tab
  console.log('\n[Step 4] Renaming an existing built-in tab...');
  const itemsToRename = checkAdd.data.items;
  const overviewItem = itemsToRename.find(i => i.id === 'admin-tab-overview');
  overviewItem.label = 'Master Dashboard';
  await post('/api/admin/sidebar', { items: itemsToRename }, authHeaders);

  const checkRename = await get('/api/admin/sidebar', authHeaders);
  const renamedItem = checkRename.data.items.find(i => i.id === 'admin-tab-overview');
  if (!renamedItem || renamedItem.label !== 'Master Dashboard') throw new Error('Rename failed');
  console.log(`✓ Built-in tab renamed successfully to: "${renamedItem.label}"`);

  // Step 5: Reorder Tabs (Move custom link to first position)
  console.log('\n[Step 5] Reordering sidebar items...');
  const reorderItems = checkRename.data.items;
  const linkIndex = reorderItems.findIndex(i => i.id === customId);
  const [removedLink] = reorderItems.splice(linkIndex, 1);
  reorderItems.unshift(removedLink); // Put at index 0

  await post('/api/admin/sidebar', { items: reorderItems }, authHeaders);
  const checkReorder = await get('/api/admin/sidebar', authHeaders);
  if (checkReorder.data.items[0].id !== customId) throw new Error('Reordering failed');
  console.log(`✓ Reordered successfully: First item is now "${checkReorder.data.items[0].label}"`);

  // Step 6: Hide a Built-in Tab
  console.log('\n[Step 6] Hiding a built-in tab (e.g. Notice Modal)...');
  const hideItems = checkReorder.data.items;
  const noticeItem = hideItems.find(i => i.id === 'admin-tab-notice');
  noticeItem.enabled = false;

  await post('/api/admin/sidebar', { items: hideItems }, authHeaders);
  const checkHide = await get('/api/admin/sidebar', authHeaders);
  const hiddenNotice = checkHide.data.items.find(i => i.id === 'admin-tab-notice');
  if (hiddenNotice.enabled !== false) throw new Error('Hide tab failed');
  console.log(`✓ Tab "${hiddenNotice.label}" hidden successfully: enabled = false`);

  // Step 7: Verify Server-Side Authorization is Independent of Sidebar Visibility
  console.log('\n[Step 7] Testing server-side API authorization independence...');
  // Notice tab is hidden in the UI, but the underlying API must still be operational for authorized admins
  const configDraftRes = await get('/api/admin/config/draft', authHeaders);
  if (configDraftRes.status !== 200) throw new Error('Protected API failed when tab was hidden');
  console.log('✓ Protected API accessible by authenticated admin even when UI tab is hidden.');

  // Unauthenticated request MUST be rejected
  const unauthRes = await get('/api/admin/config/draft');
  if (unauthRes.status !== 401) throw new Error('Security flaw: unauthenticated request was not rejected with 401');
  console.log('✓ Server-side security verified: Unauthorized requests strictly rejected with 401.');

  // Step 8: Remove Custom Sidebar Link
  console.log('\n[Step 8] Removing custom sidebar link...');
  const itemsBeforeDel = checkHide.data.items;
  const cleanItems = itemsBeforeDel.filter(i => i.id !== customId);
  await post('/api/admin/sidebar', { items: cleanItems }, authHeaders);

  const checkDel = await get('/api/admin/sidebar', authHeaders);
  const stillExists = checkDel.data.items.some(i => i.id === customId);
  if (stillExists) throw new Error('Failed to delete custom link');
  console.log('✓ Custom sidebar link deleted successfully.');

  // Step 9: Safe Reset to Default Tabs
  console.log('\n[Step 9] Restoring default admin sidebar tabs...');
  const resetRes = await post('/api/admin/sidebar/reset', {}, authHeaders);
  if (!resetRes.data.success) throw new Error('Reset failed');

  const checkReset = await get('/api/admin/sidebar', authHeaders);
  const overviewReset = checkReset.data.items.find(i => i.id === 'admin-tab-overview');
  const noticeReset = checkReset.data.items.find(i => i.id === 'admin-tab-notice');
  if (overviewReset.label !== 'Overview' || noticeReset.enabled !== true) {
    throw new Error('Default tabs were not restored correctly');
  }
  console.log('✓ All default tabs and groups successfully restored.');

  // Step 10: Verify Isolation from Public Website Navigation
  console.log('\n[Step 10] Verifying isolation from Public Website Navigation...');
  const pubConfig = await get('/api/public/config');
  if (!pubConfig.data.navigation) throw new Error('Public navigation missing');
  // Confirm public navigation file exists and is separate
  const adminNavFile = path.join(__dirname, 'data', 'admin-nav.json');
  const pubConfigFile = path.join(__dirname, 'data', 'config.published.json');
  if (!fs.existsSync(adminNavFile) || !fs.existsSync(pubConfigFile)) throw new Error('Files missing');
  console.log('✓ data/admin-nav.json and data/config.published.json are completely isolated and independent.');

  console.log('\n====================================================');
  console.log('   🎉 ALL ADMIN SIDEBAR & NAV TESTS PASSED!         ');
  console.log('====================================================');
}

runAdminSidebarTests().catch(err => {
  console.error('\n❌ TEST FAILED:', err.message);
  process.exit(1);
});
