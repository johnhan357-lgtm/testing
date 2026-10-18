const assert = require('assert');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:3000';

async function testFontChanger() {
  console.log("====================================================");
  console.log("       RUNNING FONT CHANGER & TYPOGRAPHY TESTS      ");
  console.log("====================================================");

  // 1. Authenticate Admin
  const loginRes = await fetch(`${BASE_URL}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' })
  });
  const loginData = await loginRes.json();
  assert(loginRes.ok && loginData.token, "Admin login failed");
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${loginData.token}`
  };
  console.log("✓ Admin authenticated successfully.");

  // 2. Fetch current draft
  const draftRes = await fetch(`${BASE_URL}/api/admin/config/draft`, { headers });
  const draft = await draftRes.json();
  assert(draftRes.ok, "Could not fetch draft config");

  // 3. Set custom fonts on editable fields and theme
  draft.theme.globalFont = "Plus Jakarta Sans";
  draft.fieldFonts = {
    "cfgHeroTitle": "Poppins",
    "cfgCertConventionTitle": "Fair",
    "cfgCertSignatoryOfficer": "Times",
    "cfgHelpText": "Helvetica"
  };

  const saveRes = await fetch(`${BASE_URL}/api/admin/config/draft`, {
    method: 'POST',
    headers,
    body: JSON.stringify(draft)
  });
  assert(saveRes.ok, "Saving draft with font configuration failed");
  console.log("✓ Draft saved with custom field fonts & global font.");

  // 4. Publish draft
  const pubRes = await fetch(`${BASE_URL}/api/admin/config/publish`, {
    method: 'POST',
    headers
  });
  assert(pubRes.ok, "Publishing draft failed");
  console.log("✓ Published draft to live website.");

  // 5. Fetch public config and assert fonts are active
  const pubConfigRes = await fetch(`${BASE_URL}/api/public/config`);
  const pubConfig = await pubConfigRes.json();
  assert.strictEqual(pubConfig.theme.globalFont, "Plus Jakarta Sans");
  assert.strictEqual(pubConfig.fieldFonts.cfgHeroTitle, "Poppins");
  assert.strictEqual(pubConfig.fieldFonts.cfgCertConventionTitle, "Fair");
  assert.strictEqual(pubConfig.fieldFonts.cfgCertSignatoryOfficer, "Times");
  assert.strictEqual(pubConfig.fieldFonts.cfgHelpText, "Helvetica");
  console.log("✓ Public configuration confirmed font mappings:");
  console.log("   - Global Font: Plus Jakarta Sans");
  console.log("   - Hero Title: Poppins");
  console.log("   - Convention Title: Fair (Playfair Display)");
  console.log("   - Signatory Officer: Times");
  console.log("   - Help Text: Helvetica");

  console.log("====================================================");
  console.log("   🎉 ALL FONT CHANGER TESTS PASSED SUCCESSFULLY!    ");
  console.log("====================================================");
}

testFontChanger().catch(err => {
  console.error("Test failed:", err);
  process.exit(1);
});
