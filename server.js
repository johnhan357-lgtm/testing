/**
 * High-Performance, Zero-Dependency Node.js Backend Server
 * Online Document Verification Portal & Visual CMS
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { URL } = require('url');

const PORT = process.env.PORT || 3000;
const ROOT_DIR = __dirname;
const DATA_DIR = path.join(ROOT_DIR, 'data');
const UPLOADS_DIR = path.join(ROOT_DIR, 'uploads');
const HISTORY_DIR = path.join(DATA_DIR, 'config.history');

// Ensure required directories exist (with serverless read-only guard)
[DATA_DIR, UPLOADS_DIR, HISTORY_DIR].forEach(dir => {
  try {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  } catch (err) {
    // Read-only filesystem in serverless environments (e.g. Vercel)
  }
});

// Paths to persistent data files
const DRAFT_CONFIG_FILE = path.join(DATA_DIR, 'config.draft.json');
const PUBLISHED_CONFIG_FILE = path.join(DATA_DIR, 'config.published.json');
const RECORDS_FILE = path.join(DATA_DIR, 'records.json');
const AUTH_FILE = path.join(DATA_DIR, 'auth.json');
const ADMIN_NAV_FILE = path.join(DATA_DIR, 'admin-nav.json');
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');
const CLOUD_CONFIG_FILE = path.join(DATA_DIR, 'cloud-config.json');

// Default Cloud Persistence Configuration
const DEFAULT_CLOUD_CONFIG = {
  githubToken: process.env.GITHUB_TOKEN || process.env.GH_TOKEN || "",
  githubRepo: process.env.GITHUB_REPO || "johnhan357-lgtm/testing",
  githubBranch: process.env.GITHUB_BRANCH || "main",
  githubFilePath: "data/records.json",
  autoCommit: true,
  kvRestApiUrl: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "",
  kvRestApiToken: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || "",
  lastSyncedAt: null,
  lastSyncStatus: "idle",
  lastSyncMessage: ""
};

function getCloudConfig() {
  const saved = readJsonSafe(CLOUD_CONFIG_FILE, {});
  return {
    ...DEFAULT_CLOUD_CONFIG,
    ...saved,
    githubToken: saved.githubToken || process.env.GITHUB_TOKEN || process.env.GH_TOKEN || "",
    githubRepo: saved.githubRepo || process.env.GITHUB_REPO || "johnhan357-lgtm/testing",
    githubBranch: saved.githubBranch || process.env.GITHUB_BRANCH || "main",
    kvRestApiUrl: saved.kvRestApiUrl || process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "",
    kvRestApiToken: saved.kvRestApiToken || process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || ""
  };
}

function saveCloudConfig(updates) {
  const current = getCloudConfig();
  const merged = { ...current, ...updates };
  atomicWriteJson(CLOUD_CONFIG_FILE, merged);
  return merged;
}

function httpsRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ statusCode: res.statusCode, headers: res.headers, body: data ? JSON.parse(data) : null, raw: data });
        } catch {
          resolve({ statusCode: res.statusCode, headers: res.headers, body: data, raw: data });
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('HTTPS request timed out'));
    });
    if (postData) {
      req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
    }
    req.end();
  });
}

// GitHub Auto-Commit to Git Repository (Makes data permanent across Vercel redeploys)
async function commitRecordsToGitHub(records, commitMsg = "Auto-sync records update [skip ci]") {
  const cfg = getCloudConfig();
  if (!cfg.githubToken || !cfg.githubRepo) {
    return { success: false, reason: "GitHub Token or Repo not configured." };
  }

  const [owner, repo] = cfg.githubRepo.split('/');
  if (!owner || !repo) {
    return { success: false, reason: "Invalid repository format. Must be owner/repo." };
  }

  const filePath = cfg.githubFilePath || "data/records.json";
  const branch = cfg.githubBranch || "main";

  try {
    // 1. Get current file SHA from GitHub
    const getOptions = {
      hostname: 'api.github.com',
      path: `/repos/${owner}/${repo}/contents/${filePath}?ref=${branch}`,
      method: 'GET',
      headers: {
        'User-Agent': 'MOFA-Apostille-Portal',
        'Authorization': `token ${cfg.githubToken}`,
        'Accept': 'application/vnd.github.v3+json'
      },
      timeout: 10000
    };

    const getRes = await httpsRequest(getOptions);
    let currentSha = null;
    if (getRes.statusCode === 200 && getRes.body && getRes.body.sha) {
      currentSha = getRes.body.sha;
    }

    // 2. Commit updated file to GitHub repo
    const contentBase64 = Buffer.from(JSON.stringify(records, null, 2), 'utf8').toString('base64');
    const putPayload = {
      message: commitMsg,
      content: contentBase64,
      branch: branch
    };
    if (currentSha) {
      putPayload.sha = currentSha;
    }

    const putOptions = {
      hostname: 'api.github.com',
      path: `/repos/${owner}/${repo}/contents/${filePath}`,
      method: 'PUT',
      headers: {
        'User-Agent': 'MOFA-Apostille-Portal',
        'Authorization': `token ${cfg.githubToken}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      timeout: 15000
    };

    const putRes = await httpsRequest(putOptions, putPayload);
    if (putRes.statusCode === 200 || putRes.statusCode === 201) {
      const commitSha = putRes.body?.commit?.sha || "ok";
      saveCloudConfig({
        lastSyncedAt: new Date().toISOString(),
        lastSyncStatus: "success",
        lastSyncMessage: `Committed ${records.length} records to GitHub (commit ${commitSha.substring(0, 7)})`
      });
      return { success: true, commitSha };
    } else {
      const errMsg = putRes.body?.message || `GitHub HTTP ${putRes.statusCode}`;
      saveCloudConfig({
        lastSyncedAt: new Date().toISOString(),
        lastSyncStatus: "error",
        lastSyncMessage: errMsg
      });
      return { success: false, reason: errMsg };
    }
  } catch (err) {
    saveCloudConfig({
      lastSyncedAt: new Date().toISOString(),
      lastSyncStatus: "error",
      lastSyncMessage: err.message
    });
    return { success: false, reason: err.message };
  }
}

// Upstash / Vercel KV REST persistence
async function syncToKV(records) {
  const cfg = getCloudConfig();
  if (!cfg.kvRestApiUrl || !cfg.kvRestApiToken) return { success: false };

  try {
    const targetUrl = `${cfg.kvRestApiUrl.replace(/\/+$/, '')}/set/mofa_records`;
    const url = new URL(targetUrl);
    const isHttps = url.protocol === 'https:';
    const lib = isHttps ? https : http;

    const payload = JSON.stringify(records);
    return new Promise((resolve) => {
      const req = lib.request({
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname + url.search,
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${cfg.kvRestApiToken}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        },
        timeout: 8000
      }, res => {
        resolve({ success: res.statusCode >= 200 && res.statusCode < 300 });
      });
      req.on('error', () => resolve({ success: false }));
      req.on('timeout', () => { req.destroy(); resolve({ success: false }); });
      req.write(payload);
      req.end();
    });
  } catch {
    return { success: false };
  }
}

async function fetchFromKV() {
  const cfg = getCloudConfig();
  if (!cfg.kvRestApiUrl || !cfg.kvRestApiToken) return null;

  try {
    const targetUrl = `${cfg.kvRestApiUrl.replace(/\/+$/, '')}/get/mofa_records`;
    const url = new URL(targetUrl);
    const isHttps = url.protocol === 'https:';
    const lib = isHttps ? https : http;

    return new Promise((resolve) => {
      const req = lib.request({
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname + url.search,
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${cfg.kvRestApiToken}`
        },
        timeout: 8000
      }, res => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          try {
            const parsed = JSON.parse(body);
            if (parsed && parsed.result) {
              const recs = typeof parsed.result === 'string' ? JSON.parse(parsed.result) : parsed.result;
              if (Array.isArray(recs)) return resolve(recs);
            }
          } catch {}
          resolve(null);
        });
      });
      req.on('error', () => resolve(null));
      req.on('timeout', () => { req.destroy(); resolve(null); });
      req.end();
    });
  } catch {
    return null;
  }
}

// Background Cloud Sync dispatcher
function syncRecordsToCloud(records) {
  const cfg = getCloudConfig();
  if (cfg.kvRestApiUrl && cfg.kvRestApiToken) {
    syncToKV(records).catch(err => console.error('[KV Sync Error]:', err.message));
  }
  if (cfg.githubToken && cfg.githubRepo && cfg.autoCommit) {
    commitRecordsToGitHub(records).catch(err => console.error('[GitHub Sync Error]:', err.message));
  }
}

// GitHub Auto-Commit for CMS published config
async function commitConfigFileToGitHub(config, commitMsg = "Auto-sync published config [skip ci]") {
  const cfg = getCloudConfig();
  if (!cfg.githubToken || !cfg.githubRepo) return { success: false };

  const [owner, repo] = cfg.githubRepo.split('/');
  if (!owner || !repo) return { success: false };

  const filePath = "data/config.published.json";
  const branch = cfg.githubBranch || "main";

  try {
    const getOptions = {
      hostname: 'api.github.com',
      path: `/repos/${owner}/${repo}/contents/${filePath}?ref=${branch}`,
      method: 'GET',
      headers: {
        'User-Agent': 'MOFA-Apostille-Portal',
        'Authorization': `token ${cfg.githubToken}`,
        'Accept': 'application/vnd.github.v3+json'
      },
      timeout: 10000
    };
    const getRes = await httpsRequest(getOptions);
    let currentSha = null;
    if (getRes.statusCode === 200 && getRes.body && getRes.body.sha) {
      currentSha = getRes.body.sha;
    }

    const contentBase64 = Buffer.from(JSON.stringify(config, null, 2), 'utf8').toString('base64');
    const putPayload = { message: commitMsg, content: contentBase64, branch: branch };
    if (currentSha) putPayload.sha = currentSha;

    const putOptions = {
      hostname: 'api.github.com',
      path: `/repos/${owner}/${repo}/contents/${filePath}`,
      method: 'PUT',
      headers: {
        'User-Agent': 'MOFA-Apostille-Portal',
        'Authorization': `token ${cfg.githubToken}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      timeout: 15000
    };
    const putRes = await httpsRequest(putOptions, putPayload);
    return { success: putRes.statusCode === 200 || putRes.statusCode === 201 };
  } catch (err) {
    return { success: false, reason: err.message };
  }
}

async function syncConfigToKV(config) {
  const cfg = getCloudConfig();
  if (!cfg.kvRestApiUrl || !cfg.kvRestApiToken) return { success: false };

  try {
    const targetUrl = `${cfg.kvRestApiUrl.replace(/\/+$/, '')}/set/mofa_config`;
    const url = new URL(targetUrl);
    const isHttps = url.protocol === 'https:';
    const lib = isHttps ? https : http;

    const payload = JSON.stringify(config);
    return new Promise((resolve) => {
      const req = lib.request({
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname + url.search,
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${cfg.kvRestApiToken}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        },
        timeout: 8000
      }, res => resolve({ success: res.statusCode >= 200 && res.statusCode < 300 }));
      req.on('error', () => resolve({ success: false }));
      req.on('timeout', () => { req.destroy(); resolve({ success: false }); });
      req.write(payload);
      req.end();
    });
  } catch {
    return { success: false };
  }
}

async function fetchConfigFromKV() {
  const cfg = getCloudConfig();
  if (!cfg.kvRestApiUrl || !cfg.kvRestApiToken) return null;

  try {
    const targetUrl = `${cfg.kvRestApiUrl.replace(/\/+$/, '')}/get/mofa_config`;
    const url = new URL(targetUrl);
    const isHttps = url.protocol === 'https:';
    const lib = isHttps ? https : http;

    return new Promise((resolve) => {
      const req = lib.request({
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname + url.search,
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${cfg.kvRestApiToken}`
        },
        timeout: 8000
      }, res => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          try {
            const parsed = JSON.parse(body);
            if (parsed && parsed.result) {
              const c = typeof parsed.result === 'string' ? JSON.parse(parsed.result) : parsed.result;
              if (c && typeof c === 'object') return resolve(c);
            }
          } catch {}
          resolve(null);
        });
      });
      req.on('error', () => resolve(null));
      req.on('timeout', () => { req.destroy(); resolve(null); });
      req.end();
    });
  } catch {
    return null;
  }
}

function syncConfigToCloud(config) {
  const cfg = getCloudConfig();
  if (cfg.kvRestApiUrl && cfg.kvRestApiToken) {
    syncConfigToKV(config).catch(err => console.error('[KV Config Sync Error]:', err.message));
  }
  if (cfg.githubToken && cfg.githubRepo && cfg.autoCommit) {
    commitConfigFileToGitHub(config).catch(err => console.error('[GitHub Config Sync Error]:', err.message));
  }
}

function normalizeDate(str) {
  if (!str) return "";
  const clean = String(str).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean;
  const parts = clean.split(/[-/]/);
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      const y = parts[0];
      const m = String(parts[1]).padStart(2, '0');
      const d = String(parts[2]).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
  }
  try {
    const d = new Date(clean);
    if (!isNaN(d.getTime())) {
      return d.toISOString().split('T')[0];
    }
  } catch {}
  return clean;
}

let isCloudSyncChecked = false;
async function ensureCloudSync() {
  if (isCloudSyncChecked) return;
  isCloudSyncChecked = true;
  try {
    const kvRecords = await fetchFromKV();
    if (kvRecords && Array.isArray(kvRecords) && kvRecords.length > 0) {
      const diskRecords = readJsonSafe(RECORDS_FILE, []);
      if (kvRecords.length >= diskRecords.length) {
        atomicWriteJson(RECORDS_FILE, kvRecords);
        console.log(`[Cloud Persistence] Restored ${kvRecords.length} records from Upstash KV.`);
      }
    }
    const kvConfig = await fetchConfigFromKV();
    if (kvConfig && kvConfig.branding) {
      atomicWriteJson(PUBLISHED_CONFIG_FILE, kvConfig);
      atomicWriteJson(DRAFT_CONFIG_FILE, kvConfig);
      console.log('[Cloud Persistence] Restored published config from Upstash KV.');
    }
  } catch (err) {
    console.warn('[Cloud Persistence] Cloud sync check error:', err.message);
  }
}

// Default Admin Sidebar Configuration (Separate from public website navigation)
const DEFAULT_ADMIN_NAV = {
  items: [
    { id: "admin-tab-overview", label: "Overview", type: "built_in", targetTab: "tab-overview", enabled: true, group: "Core Management" },
    { id: "admin-tab-branding", label: "Branding & Identity", type: "built_in", targetTab: "tab-branding", enabled: true, group: "Public Website" },
    { id: "admin-tab-navigation", label: "Public Navigation & Links", type: "built_in", targetTab: "tab-navigation", enabled: true, group: "Public Website" },
    { id: "admin-tab-content", label: "Page Texts & Form", type: "built_in", targetTab: "tab-content", enabled: true, group: "Public Website" },
    { id: "admin-tab-records", label: "Document Registry (CRUD)", type: "built_in", targetTab: "tab-records", enabled: true, group: "Verification System" },
    { id: "admin-tab-notice", label: "Notice Modal", type: "built_in", targetTab: "tab-notice", enabled: true, group: "Public Website" },
    { id: "admin-tab-footer", label: "Floating Action & Footer", type: "built_in", targetTab: "tab-footer", enabled: true, group: "Public Website" },
    { id: "admin-tab-theme", label: "Theme & Colors", type: "built_in", targetTab: "tab-theme", enabled: true, group: "Public Website" },
    { id: "admin-tab-sidebar-mgr", label: "Admin Sidebar Manager", type: "built_in", targetTab: "tab-admin-sidebar", enabled: true, group: "Admin Settings" },
    { id: "admin-tab-security", label: "Admin Security", type: "built_in", targetTab: "tab-security", enabled: true, group: "Admin Settings" }
  ]
};

function initAdminNav() {
  if (!fs.existsSync(ADMIN_NAV_FILE)) {
    atomicWriteJson(ADMIN_NAV_FILE, DEFAULT_ADMIN_NAV);
  }
}

// In-memory active session tokens: token -> { username, expiresAt }
const activeSessions = new Map();
const SESSION_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours
const SERVER_SECRET = process.env.SESSION_SECRET || 'mofa-apostille-portal-secret-key-2026';

// =========================================================================
// ATOMIC FILE STORAGE HELPERS (Safe against serverless EROFS)
// =========================================================================
// In-memory cache store for serverless execution
const memoryStore = new Map();
const IS_SERVERLESS = process.env.VERCEL === '1' || process.env.AWS_LAMBDA_FUNCTION_NAME !== undefined;

function getTmpPath(filePath) {
  if (!IS_SERVERLESS) return null;
  try {
    const filename = path.basename(filePath);
    return path.join('/tmp', filename);
  } catch {
    return null;
  }
}

function atomicWriteJson(filePath, data) {
  // Always update in-memory cache immediately
  memoryStore.set(filePath, data);

  let success = false;
  // 1. Try writing to primary path (local environment)
  try {
    const tempPath = `${filePath}.tmp.${Date.now()}.${Math.random().toString(36).substring(2, 7)}`;
    const content = JSON.stringify(data, null, 2);
    fs.writeFileSync(tempPath, content, 'utf8');
    fs.renameSync(tempPath, filePath);
    success = true;
  } catch (err) {
    // Read-only filesystem in serverless environments (e.g. Vercel)
  }

  // 2. Also mirror to /tmp in serverless environment
  if (IS_SERVERLESS) {
    try {
      const tmpPath = getTmpPath(filePath);
      if (tmpPath) {
        fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf8');
        success = true;
      }
    } catch (err) {}
  }

  return success;
}

function readJsonSafe(filePath, fallback = {}) {
  // 1. Check in-memory cache first
  if (memoryStore.has(filePath)) {
    return memoryStore.get(filePath);
  }

  // 2. If in serverless environment, check /tmp override
  if (IS_SERVERLESS) {
    try {
      const tmpPath = getTmpPath(filePath);
      if (tmpPath && fs.existsSync(tmpPath)) {
        const content = fs.readFileSync(tmpPath, 'utf8');
        const parsed = JSON.parse(content);
        memoryStore.set(filePath, parsed);
        return parsed;
      }
    } catch (err) {}
  }

  // 3. Fallback to primary file on disk
  try {
    if (!fs.existsSync(filePath)) return fallback;
    const content = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(content);
    memoryStore.set(filePath, parsed);
    return parsed;
  } catch (err) {
    console.error(`Error reading ${filePath}:`, err.message);
    return fallback;
  }
}

// Session persistence across server restarts
function loadSessions() {
  const data = readJsonSafe(SESSIONS_FILE, {});
  const now = Date.now();
  for (const [token, sess] of Object.entries(data)) {
    if (sess && sess.expiresAt && sess.expiresAt > now) {
      activeSessions.set(token, sess);
    }
  }
}

function persistSessions() {
  const obj = {};
  const now = Date.now();
  for (const [token, sess] of activeSessions.entries()) {
    if (sess && sess.expiresAt && sess.expiresAt > now) {
      obj[token] = sess;
    }
  }
  atomicWriteJson(SESSIONS_FILE, obj);
}

// Stateless HMAC Session Token Generation & Verification (Vercel Multi-Lambda Safe)
function generateSessionToken(username) {
  const expiresAt = Date.now() + SESSION_DURATION_MS;
  const signature = crypto.createHmac('sha256', SERVER_SECRET).update(`${username}.${expiresAt}`).digest('hex');
  const token = `${username}.${expiresAt}.${signature}`;
  activeSessions.set(token, { username, expiresAt });
  persistSessions();
  return { token, username, expiresAt };
}

function verifyToken(token) {
  if (!token || typeof token !== 'string') return null;

  // 1. Check in-memory session (for local persistence / fast cache)
  const memSession = activeSessions.get(token);
  if (memSession && memSession.expiresAt > Date.now()) {
    return memSession;
  }

  // 2. Stateless HMAC verification (works seamlessly across all Vercel lambda instances)
  const parts = token.split('.');
  if (parts.length === 3) {
    const [username, expiresAtStr, signature] = parts;
    const expiresAt = parseInt(expiresAtStr, 10);
    if (!expiresAt || Date.now() > expiresAt) {
      return null;
    }
    const expectedSig = crypto.createHmac('sha256', SERVER_SECRET).update(`${username}.${expiresAtStr}`).digest('hex');
    const sigBuffer = Buffer.from(signature, 'hex');
    const expectedBuffer = Buffer.from(expectedSig, 'hex');
    if (sigBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
      const session = { username, expiresAt };
      activeSessions.set(token, session);
      return session;
    }
  }

  return null;
}

// =========================================================================
// PASSWORD HASHING (Zero external dependencies using crypto.scrypt)
// =========================================================================
const DEFAULT_AUTH = {
  username: "admin",
  salt: "d4789e62f271536bce09638e26171ad4",
  hash: "3ae0c95d5584cf9e6b1749b9630d7531b128956275bff9ecc50b0bc07ab0c5620af5153ee853099e28ff9a552b06eb8b3f33018a046426983a26d5edbe6c52f7",
  createdAt: "2026-10-18T13:12:55.579Z"
};

function getAuthData() {
  const fileData = readJsonSafe(AUTH_FILE, null);
  if (fileData && fileData.username && fileData.salt && fileData.hash) {
    return fileData;
  }
  return DEFAULT_AUTH;
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { hash, salt };
}

function verifyPassword(password, salt, storedHash) {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(storedHash, 'hex'));
}

// Initialize Auth Store (Default credentials: admin / admin123)
function initAuth() {
  if (!fs.existsSync(AUTH_FILE)) {
    atomicWriteJson(AUTH_FILE, DEFAULT_AUTH);
    console.log('[Auth] Initialized default admin credentials (User: admin / Pass: admin123). Please change in Admin Panel.');
  }
}

// =========================================================================
// DEFAULT PORTAL CONFIGURATION
// =========================================================================
const DEFAULT_CONFIG = {
  branding: {
    authorityName: "Ministry of Foreign Affairs",
    authoritySubtitle: "Government of Pakistan",
    logoType: "custom_image", // 'default_svg' or 'custom_image'
    logoUrl: "/uploads/logo_1792329381447.svg",
    logoLinkUrl: "https://apostille.mofa.gov.pk/",
    logoLinkTarget: "_self", // '_self' or '_blank'
    socialLinks: {
      facebook: "https://facebook.com",
      instagram: "https://instagram.com",
      twitter: "https://twitter.com",
      linkedin: "https://linkedin.com"
    }
  },
  theme: {
    primaryGreen: "#01411c",
    primaryGreenDark: "#003316",
    primaryGreenLight: "#0b5e2b",
    footerDark: "#1e2225",
    bgLight: "#f8f9fb",
    globalFont: ""
  },
  fieldFonts: {},
  navigation: [
    { id: "nav-1", label: "HOME", url: "#", target: "_self", enabled: true, isExternal: false },
    { id: "nav-2", label: "CHECKLIST", url: "#checklist", target: "_self", enabled: true, isExternal: false },
    { id: "nav-3", label: "DOCUMENTS", url: "#documents", target: "_self", enabled: true, isExternal: false },
    { id: "nav-4", label: "RECOGNIZED LIST", url: "#recognized", target: "_self", enabled: true, isExternal: false },
    { id: "nav-5", label: "FEE DETAILS", url: "#fees", target: "_self", enabled: true, isExternal: false },
    { id: "nav-6", label: "VERIFY ATTESTATION", url: "index.html", target: "_self", enabled: true, isExternal: false }
  ],
  hero: {
    title: "Verify an Official Document Certificate issued from the Verification Authority",
    subtitle: "Use this service if you want to verify either a paper or electronic certificate issued by the authority."
  },
  verificationCard: {
    heading: "Please Enter the required details below",
    docNumberLabel: "Certificate Number",
    docNumberPlaceholder: "eg: ADG-HYUI-QRTY-BGHN",
    docDateLabel: "Date",
    verifyButtonText: "Verify",
    clearButtonText: "Clear data",
    supportEmail: "support@verification-portal.org",
    helpText: "If you need further help email support@verification-portal.org with the certificate number and date"
  },
  noticeModal: {
    enabled: true,
    alwaysShowOnRefresh: true,
    showOnDirectVerify: false,
    portalTitle: "Ministry of Foreign Affairs",
    portalSub: "Government of Pakistan",
    logoType: "use_brand_logo",
    logoUrl: "/uploads/logo_1792329381447.svg",
    title: "IMPORTANT NOTICE",
    bodyEnglish: "Dear Applicants, please visit the verification authority centers only on your scheduled appointment date and time for document processing.\n\nYour documents will only be processed on the date of your appointment. Applicants arriving before or after the scheduled date may not be facilitated.",
    bodyRegional: "محترم درخواست گزاران، برائے کرم تصدیقی دستاویزات کے لیے اپنی مقررہ تاریخ اور وقت پر تشریف لائیں۔",
    confirmButtonText: "Acknowledge & Proceed"
  },
  floatingFeedback: {
    enabled: true,
    label: "Submit Feedback",
    actionType: "dialog", // 'dialog' or 'custom_link'
    customUrl: ""
  },
  footer: {
    authorityName: "Department of Verification & Legalization",
    authoritySubtitle: "Online Document Authentication Portal",
    logoType: "default_svg",
    logoUrl: "",
    links: [
      { id: "foot-1", label: "Authorized Courier Companies", url: "#courier", target: "_self", enabled: true },
      { id: "foot-2", label: "FAQ", url: "#faq", target: "_self", enabled: true },
      { id: "foot-3", label: "Contact Us", url: "#contact", target: "_self", enabled: true }
    ],
    copyrightText: "Copyright © 2026 Department of Verification & Legalization. All Rights Reserved."
  },
  certificateView: {
    pageTitle: "QR Code Verification Apostille Certificate",
    breadcrumbText: "Home / Apostille verification",
    issuerStatement: "This apostille certificate is issued by Ministry of Foreign Affairs Pakistan.",
    summaryTemplate: "This apostille refers to {category} and issued on {date} and is Approved by {authority}",
    watermarkText: "GOVTOFPAKISTAN",
    conventionTitle: "APOSTILLE",
    conventionSubtitle: "(Convention de La Haye du 5 October 1961)",
    defaultCountry: "Pakistan",
    certifiedWord: "Certified",
    disclaimerText: "This apostille is not intended for use in Pakistan. It solely confirms the authenticity of the signature, seal, or stamp on the attached Pakistan public document. Please note that it does not verify the authenticity of the underlying document.",
    verificationUrlText: "To verify this apostille, visit www.apostille.mofa.gov.pk",
    defaultSignatory: "Ali Faraz",
    enablePdfViewer: true
  },
  metadata: {
    lastSavedAt: new Date().toISOString(),
    lastPublishedAt: new Date().toISOString(),
    version: 1
  }
};

// Initialize Config Files
function initConfig() {
  if (!fs.existsSync(PUBLISHED_CONFIG_FILE)) {
    atomicWriteJson(PUBLISHED_CONFIG_FILE, DEFAULT_CONFIG);
  }
  if (!fs.existsSync(DRAFT_CONFIG_FILE)) {
    atomicWriteJson(DRAFT_CONFIG_FILE, DEFAULT_CONFIG);
  }
}

// =========================================================================
// INITIALIZE SEED DOCUMENT RECORDS
// =========================================================================
const SEED_RECORDS = [
  {
    id: "rec-1",
    docNumber: "ADG-HYUI-QRTY-BGHN",
    applicantName: "Muhammad Ahmed",
    documentType: "Official Educational Degree Attestation",
    issueDate: "2026-10-18",
    expiryDate: "",
    issuingAuthority: "Headquarters Directorate of Attestations",
    status: "VERIFIED", // VERIFIED, EXPIRED, REVOKED, SUSPENDED
    securityHash: "9f83ac12048bca61e945c78b4e1903",
    notes: "Verified against national attestation register.",
    createdAt: "2026-10-18T10:00:00Z"
  },
  {
    id: "rec-2",
    docNumber: "EXP-2024-TEST-9981",
    applicantName: "Sara Khan",
    documentType: "Temporary Police Character Clearance",
    issueDate: "2024-01-15",
    expiryDate: "2024-07-15",
    issuingAuthority: "Regional Security Verification Bureau",
    status: "EXPIRED",
    securityHash: "1e55ab76304d9892cfa72911b3ef20",
    notes: "Certificate has passed valid duration.",
    createdAt: "2024-01-15T10:00:00Z"
  },
  {
    id: "rec-3",
    docNumber: "RVK-8812-CANC-0012",
    applicantName: "Tariq Mahmood",
    documentType: "Commercial License Verification",
    issueDate: "2025-05-20",
    expiryDate: "",
    issuingAuthority: "Trade Regulatory Authority",
    status: "REVOKED",
    securityHash: "44da091c6bf9e01149e882a983b271",
    notes: "Revoked due to administrative compliance order #4492.",
    createdAt: "2025-05-20T12:00:00Z"
  }
];

function initRecords() {
  if (!fs.existsSync(RECORDS_FILE)) {
    atomicWriteJson(RECORDS_FILE, SEED_RECORDS);
  }
}

// =========================================================================
// HTTP SERVER & REQUEST PARSER
// =========================================================================
initAuth();
initConfig();
initRecords();
initAdminNav();
loadSessions();

function parseBody(req) {
  // 1. If Vercel or any serverless runtime pre-parsed the body
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
      return Promise.resolve(req.body);
    }
    if (Buffer.isBuffer(req.body)) {
      const str = req.body.toString('utf8');
      if (!str.trim()) return Promise.resolve({});
      try {
        return Promise.resolve(JSON.parse(str));
      } catch (e) {
        return Promise.resolve(str);
      }
    }
    if (typeof req.body === 'string') {
      if (!req.body.trim()) return Promise.resolve({});
      try {
        return Promise.resolve(JSON.parse(req.body));
      } catch (err) {
        return Promise.resolve(req.body);
      }
    }
  }

  // 2. Fallback to stream reading for standard Node.js server
  return new Promise((resolve, reject) => {
    if (req.complete) {
      return resolve({});
    }

    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 10 * 1024 * 1024) { // 10MB limit
        req.destroy();
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        resolve(body);
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store, no-cache, must-revalidate',
    'Access-Control-Allow-Origin': '*'
  });
  res.end(JSON.stringify(data));
}

// Session authentication checker
function authenticateAdmin(req) {
  const authHeader = req.headers['authorization'];
  let token = null;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else if (req.headers.cookie) {
    const cookies = Object.fromEntries(
      req.headers.cookie.split(';').map(c => {
        const parts = c.trim().split('=');
        return [parts[0], decodeURIComponent(parts.slice(1).join('='))];
      })
    );
    token = cookies['admin_session'];
  }

  if (!token) return null;
  return verifyToken(token);
}

// MIME types for static files
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf'
};

async function requestHandler(req, res) {
  // Ensure cloud persistence data is checked on cold start
  await ensureCloudSync();

  // Resolve effective request path (handles local, Vercel rewrites, and catch-all routes)
  let effectiveUrl = req.headers['x-matched-path'] || req.headers['x-vercel-matched-path'] || req.url;
  const tempUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  if (tempUrl.searchParams.has('__route')) {
    effectiveUrl = tempUrl.searchParams.get('__route');
    tempUrl.searchParams.delete('__route');
    const remaining = tempUrl.searchParams.toString();
    if (remaining) {
      effectiveUrl += (effectiveUrl.includes('?') ? '&' : '?') + remaining;
    }
  }

  const parsedUrl = new URL(effectiveUrl, `http://${req.headers.host || 'localhost'}`);
  // Also preserve query parameters from req.url
  if (req.url && req.url.includes('?')) {
    const origQuery = new URL(req.url, `http://${req.headers.host || 'localhost'}`).searchParams;
    for (const [k, v] of origQuery.entries()) {
      if (k !== '__route' && !parsedUrl.searchParams.has(k)) {
        parsedUrl.searchParams.set(k, v);
      }
    }
  }

  const pathname = parsedUrl.pathname;
  const method = req.method;

  // Handle CORS preflight
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    });
    return res.end();
  }

  // =========================================================================
  // PUBLIC APIS
  // =========================================================================

  // 1. Get Live Published Configuration (Public only ever sees published)
  if (pathname === '/api/public/config' && method === 'GET') {
    const published = readJsonSafe(PUBLISHED_CONFIG_FILE, DEFAULT_CONFIG);
    return sendJson(res, 200, published);
  }

  // 2. Authoritative Verification Endpoint (QR scan & Manual verification)
  if (pathname === '/api/verify' && method === 'POST') {
    try {
      const { docNumber, docDate, backupRecord } = await parseBody(req);
      if (!docNumber || !docDate) {
        return sendJson(res, 400, {
          success: false,
          status: "INVALID_INPUT",
          message: "Both Document Number and Issue Date are required for verification."
        });
      }

      const cleanDocNumber = String(docNumber).trim().toUpperCase();
      const cleanDate = String(docDate).trim();

      const records = readJsonSafe(RECORDS_FILE, []);
      let match = records.find(r => r.docNumber.toUpperCase() === cleanDocNumber);

      // Self-Healing Fallback: If not found on ephemeral server, but valid backupRecord provided from client cache
      if (!match && backupRecord && backupRecord.docNumber && String(backupRecord.docNumber).trim().toUpperCase() === cleanDocNumber) {
        match = {
          ...backupRecord,
          docNumber: cleanDocNumber,
          issueDate: backupRecord.issueDate || cleanDate
        };
        records.unshift(match);
        atomicWriteJson(RECORDS_FILE, records);
        syncRecordsToCloud(records);
        console.log(`[Auto-Heal] Successfully restored document ${cleanDocNumber} from client cache into server registry.`);
      }

      if (!match) {
        return sendJson(res, 200, {
          success: false,
          status: "NOT_FOUND",
          docNumber: cleanDocNumber,
          message: "No matching record was found in the official registry. Please check the document number and date."
        });
      }

      // Check date match if date is supplied (using normalized date comparison)
      if (cleanDate && normalizeDate(match.issueDate) !== normalizeDate(cleanDate)) {
        return sendJson(res, 200, {
          success: false,
          status: "DATE_MISMATCH",
          docNumber: cleanDocNumber,
          message: "The document number exists, but the provided date does not match the registered issue date."
        });
      }

      // Check expiration status against expiryDate if applicable
      let currentStatus = match.status;
      if (currentStatus === "VERIFIED" && match.expiryDate) {
        const now = new Date();
        const expiry = new Date(match.expiryDate);
        if (now > expiry) {
          currentStatus = "EXPIRED";
        }
      }

      // Return authoritative record details
      return sendJson(res, 200, {
        success: currentStatus === "VERIFIED",
        status: currentStatus, // VERIFIED, EXPIRED, REVOKED, SUSPENDED
        record: {
          docNumber: match.docNumber,
          applicantName: match.applicantName,
          documentType: match.documentType,
          issueDate: match.issueDate,
          expiryDate: match.expiryDate || null,
          issuingAuthority: match.issuingAuthority,
          securityHash: match.securityHash,
          status: currentStatus,
          notes: match.notes || "",
          // Extended Apostille Certificate fields
          country: match.country || "Pakistan",
          documentCategory: match.documentCategory || match.documentType || "Personal Document",
          signedBy: match.signedBy || "N/A",
          capacity: match.capacity || "Registrar",
          sealOf: match.sealOf || "Preston University",
          issuePlace: match.issuePlace || "Lahore Pakistan",
          signatoryOfficer: match.signatoryOfficer || "Ali Faraz",
          signatureUrl: match.signatureUrl || "/uploads/signature_ali_faraz_clean.png",
          pdfFileName: match.pdfFileName || "",
          pdfUrl: match.pdfUrl || ""
        }
      });
    } catch (err) {
      console.error('[Verify API Error]:', err);
      return sendJson(res, 500, { success: false, message: "Internal verification lookup failed." });
    }
  }

  // =========================================================================
  // ADMIN AUTHENTICATION APIS
  // =========================================================================
  if (pathname === '/api/admin/login' && method === 'POST') {
    try {
      const { username, password } = await parseBody(req);
      const auth = getAuthData();

      if (!auth || auth.username !== username || !verifyPassword(password, auth.salt, auth.hash)) {
        return sendJson(res, 401, { success: false, message: "Invalid administrator username or password." });
      }

      const { token } = generateSessionToken(username);

      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Set-Cookie': `admin_session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=86400`
      });
      return res.end(JSON.stringify({ success: true, token, username }));
    } catch (err) {
      console.error('[Login Error]:', err);
      return sendJson(res, 500, { success: false, message: "Login processing failed." });
    }
  }

  if (pathname === '/api/admin/logout' && method === 'POST') {
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      activeSessions.delete(authHeader.substring(7));
      persistSessions();
    }
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Set-Cookie': `admin_session=; Path=/; HttpOnly; Max-Age=0`
    });
    return res.end(JSON.stringify({ success: true }));
  }

  if (pathname === '/api/admin/me' && method === 'GET') {
    const session = authenticateAdmin(req);
    if (!session) return sendJson(res, 401, { authenticated: false });
    return sendJson(res, 200, { authenticated: true, username: session.username });
  }

  if (pathname === '/api/admin/change-password' && method === 'POST') {
    const session = authenticateAdmin(req);
    if (!session) return sendJson(res, 401, { message: "Unauthorized." });

    const { currentPassword, newPassword } = await parseBody(req);
    const auth = getAuthData();

    if (!verifyPassword(currentPassword, auth.salt, auth.hash)) {
      return sendJson(res, 400, { success: false, message: "Current password is incorrect." });
    }

    if (!newPassword || newPassword.length < 6) {
      return sendJson(res, 400, { success: false, message: "New password must be at least 6 characters long." });
    }

    const { hash, salt } = hashPassword(newPassword);
    auth.hash = hash;
    auth.salt = salt;
    auth.updatedAt = new Date().toISOString();
    atomicWriteJson(AUTH_FILE, auth);

    return sendJson(res, 200, { success: true, message: "Password updated successfully." });
  }

  // =========================================================================
  // ADMIN PANEL SIDEBAR CONFIGURATION APIS (Isolated from Public Navigation)
  // =========================================================================
  if (pathname.startsWith('/api/admin/sidebar')) {
    const session = authenticateAdmin(req);
    if (!session) return sendJson(res, 401, { message: "Unauthorized." });

    // GET /api/admin/sidebar
    if (pathname === '/api/admin/sidebar' && method === 'GET') {
      const navData = readJsonSafe(ADMIN_NAV_FILE, DEFAULT_ADMIN_NAV);
      return sendJson(res, 200, navData);
    }

    // POST /api/admin/sidebar (Save customized admin sidebar)
    if (pathname === '/api/admin/sidebar' && method === 'POST') {
      try {
        const payload = await parseBody(req);
        if (!payload || !Array.isArray(payload.items)) {
          return sendJson(res, 400, { success: false, message: "Invalid sidebar configuration format. 'items' array required." });
        }
        atomicWriteJson(ADMIN_NAV_FILE, payload);
        return sendJson(res, 200, { success: true, message: "Admin sidebar configuration saved successfully." });
      } catch (err) {
        return sendJson(res, 500, { success: false, message: "Failed to save admin sidebar configuration." });
      }
    }

    // POST /api/admin/sidebar/reset (Restore default admin tabs safely)
    if (pathname === '/api/admin/sidebar/reset' && method === 'POST') {
      atomicWriteJson(ADMIN_NAV_FILE, DEFAULT_ADMIN_NAV);
      return sendJson(res, 200, { success: true, message: "Admin sidebar successfully restored to default tabs.", data: DEFAULT_ADMIN_NAV });
    }
  }

  // =========================================================================
  // ADMIN CMS CONFIGURATION APIS (Draft, Publish, Rollback, Discard)
  // =========================================================================
  if (pathname.startsWith('/api/admin/config')) {
    const session = authenticateAdmin(req);
    if (!session) return sendJson(res, 401, { message: "Unauthorized." });

    // Status (Check if draft differs from published)
    if (pathname === '/api/admin/config/status' && method === 'GET') {
      const draft = readJsonSafe(DRAFT_CONFIG_FILE, DEFAULT_CONFIG);
      const published = readJsonSafe(PUBLISHED_CONFIG_FILE, DEFAULT_CONFIG);
      const hasChanges = JSON.stringify(draft) !== JSON.stringify(published);

      return sendJson(res, 200, {
        hasDraftChanges: hasChanges,
        lastSavedAt: draft.metadata?.lastSavedAt || null,
        lastPublishedAt: published.metadata?.lastPublishedAt || null
      });
    }

    // Get current working draft
    if (pathname === '/api/admin/config/draft' && method === 'GET') {
      const draft = readJsonSafe(DRAFT_CONFIG_FILE, DEFAULT_CONFIG);
      return sendJson(res, 200, draft);
    }

    // Save draft (DOES NOT TOUCH LIVE SITE)
    if (pathname === '/api/admin/config/draft' && method === 'POST') {
      try {
        const newDraft = await parseBody(req);
        newDraft.metadata = {
          ...newDraft.metadata,
          lastSavedAt: new Date().toISOString()
        };
        atomicWriteJson(DRAFT_CONFIG_FILE, newDraft);
        return sendJson(res, 200, { success: true, message: "Draft saved successfully. Live site remains unchanged." });
      } catch (err) {
        return sendJson(res, 500, { success: false, message: "Failed to save draft." });
      }
    }

    // Publish (Validates draft, creates snapshot backup, updates live site)
    if (pathname === '/api/admin/config/publish' && method === 'POST') {
      try {
        let draft = await parseBody(req);
        if (!draft || !draft.branding) {
          draft = readJsonSafe(DRAFT_CONFIG_FILE);
        }
        if (!draft || !draft.branding) {
          return sendJson(res, 400, { success: false, message: "Draft data is invalid or empty." });
        }

        // Snapshot current published version into history
        const currentPublished = readJsonSafe(PUBLISHED_CONFIG_FILE);
        const snapshotName = `config_${Date.now()}.json`;
        const snapshotPath = path.join(HISTORY_DIR, snapshotName);
        atomicWriteJson(snapshotPath, currentPublished);

        // Update published configuration
        const publishedData = {
          ...draft,
          metadata: {
            ...draft.metadata,
            lastPublishedAt: new Date().toISOString(),
            version: (currentPublished.metadata?.version || 1) + 1
          }
        };

        atomicWriteJson(PUBLISHED_CONFIG_FILE, publishedData);
        // Also sync draft metadata
        atomicWriteJson(DRAFT_CONFIG_FILE, publishedData);
        syncConfigToCloud(publishedData);

        return sendJson(res, 200, {
          success: true,
          message: "Changes published successfully to the live public website!",
          snapshot: snapshotName
        });
      } catch (err) {
        console.error('[Publish Error]:', err);
        return sendJson(res, 500, { success: false, message: "Publishing failed. Live site was preserved." });
      }
    }

    // Discard Draft (Resets draft back to published version)
    if (pathname === '/api/admin/config/discard' && method === 'POST') {
      const published = readJsonSafe(PUBLISHED_CONFIG_FILE, DEFAULT_CONFIG);
      atomicWriteJson(DRAFT_CONFIG_FILE, published);
      return sendJson(res, 200, { success: true, message: "Draft discarded. Reset to live version." });
    }

    // List rollback history snapshots
    if (pathname === '/api/admin/config/history' && method === 'GET') {
      const files = fs.readdirSync(HISTORY_DIR)
        .filter(f => f.endsWith('.json'))
        .sort()
        .reverse()
        .slice(0, 10);
      return sendJson(res, 200, files);
    }

    // Rollback to previous version
    if (pathname === '/api/admin/config/rollback' && method === 'POST') {
      const { snapshot } = await parseBody(req);
      let targetFile = null;

      if (snapshot) {
        targetFile = path.join(HISTORY_DIR, path.basename(snapshot));
      } else {
        const files = fs.readdirSync(HISTORY_DIR).filter(f => f.endsWith('.json')).sort().reverse();
        if (files.length > 0) targetFile = path.join(HISTORY_DIR, files[0]);
      }

      if (!targetFile || !fs.existsSync(targetFile)) {
        return sendJson(res, 404, { success: false, message: "No rollback snapshot found." });
      }

      const rollbackData = readJsonSafe(targetFile);
      rollbackData.metadata = {
        ...rollbackData.metadata,
        lastPublishedAt: new Date().toISOString(),
        rolledBackFrom: path.basename(targetFile)
      };

      atomicWriteJson(PUBLISHED_CONFIG_FILE, rollbackData);
      atomicWriteJson(DRAFT_CONFIG_FILE, rollbackData);

      return sendJson(res, 200, { success: true, message: "Successfully rolled back to previous published version." });
    }
  }

  // =========================================================================
  // ADMIN DOCUMENT RECORDS CRUD APIS
  // =========================================================================
  if (pathname.startsWith('/api/admin/records')) {
    const session = authenticateAdmin(req);
    if (!session) return sendJson(res, 401, { message: "Unauthorized." });

    const records = readJsonSafe(RECORDS_FILE, []);

    // GET /api/admin/records/export (Backup JSON Download)
    if (pathname === '/api/admin/records/export' && method === 'GET') {
      const filename = `mofa_records_backup_${new Date().toISOString().split('T')[0]}.json`;
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Access-Control-Allow-Origin': '*'
      });
      return res.end(JSON.stringify(records, null, 2));
    }

    // POST /api/admin/records/import (Restore / Batch Merge from Backup)
    if (pathname === '/api/admin/records/import' && method === 'POST') {
      try {
        const payload = await parseBody(req);
        const importedRecords = Array.isArray(payload) ? payload : (payload.records || []);
        if (!Array.isArray(importedRecords) || importedRecords.length === 0) {
          return sendJson(res, 400, { success: false, message: "Invalid backup format. Must be an array of records." });
        }

        const currentRecords = readJsonSafe(RECORDS_FILE, []);
        const mergedMap = new Map();

        // 1. Load current server records into map
        currentRecords.forEach(r => {
          if (r && r.docNumber) mergedMap.set(r.docNumber.toUpperCase(), r);
        });

        // 2. Merge imported records (preserve unique IDs, update existing or insert new)
        let addedCount = 0;
        let updatedCount = 0;
        importedRecords.forEach(r => {
          if (r && r.docNumber) {
            const key = r.docNumber.toUpperCase();
            if (mergedMap.has(key)) {
              mergedMap.set(key, { ...mergedMap.get(key), ...r });
              updatedCount++;
            } else {
              mergedMap.set(key, r);
              addedCount++;
            }
          }
        });

        const finalRecords = Array.from(mergedMap.values());
        atomicWriteJson(RECORDS_FILE, finalRecords);
        syncRecordsToCloud(finalRecords);

        return sendJson(res, 200, {
          success: true,
          message: `Restore complete! Successfully synchronized ${finalRecords.length} records (${addedCount} newly added, ${updatedCount} updated).`,
          count: finalRecords.length,
          records: finalRecords
        });
      } catch (err) {
        console.error('[Import Records Error]:', err);
        return sendJson(res, 500, { success: false, message: "Restore failed: " + err.message });
      }
    }

    // GET /api/admin/records (Search & Filter)
    if (pathname === '/api/admin/records' && method === 'GET') {
      const q = (parsedUrl.searchParams.get('q') || '').toLowerCase();
      const status = parsedUrl.searchParams.get('status');

      let filtered = records;
      if (q) {
        filtered = filtered.filter(r =>
          r.docNumber.toLowerCase().includes(q) ||
          r.applicantName.toLowerCase().includes(q) ||
          r.documentType.toLowerCase().includes(q)
        );
      }
      if (status && status !== 'ALL') {
        filtered = filtered.filter(r => r.status === status);
      }

      return sendJson(res, 200, filtered);
    }

    // POST /api/admin/records (Create)
    if (pathname === '/api/admin/records' && method === 'POST') {
      const data = await parseBody(req);
      if (!data.docNumber || !data.applicantName || !data.issueDate) {
        return sendJson(res, 400, { success: false, message: "Document Number, Applicant Name, and Issue Date are required." });
      }

      const cleanDocNum = data.docNumber.trim().toUpperCase();
      if (records.some(r => r.docNumber.toUpperCase() === cleanDocNum)) {
        return sendJson(res, 400, { success: false, message: `A document with number ${cleanDocNum} already exists.` });
      }

      const newRecord = {
        id: `rec-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        docNumber: cleanDocNum,
        applicantName: data.applicantName.trim(),
        documentType: data.documentType ? data.documentType.trim() : "Personal Document",
        documentCategory: data.documentCategory ? data.documentCategory.trim() : (data.documentType ? data.documentType.trim() : "Personal Document"),
        country: data.country ? data.country.trim() : "Pakistan",
        signedBy: data.signedBy ? data.signedBy.trim() : "N/A",
        capacity: data.capacity ? data.capacity.trim() : "Registrar",
        sealOf: data.sealOf ? data.sealOf.trim() : "Preston University",
        issuePlace: data.issuePlace ? data.issuePlace.trim() : "Lahore Pakistan",
        issueDate: data.issueDate.trim(),
        expiryDate: data.expiryDate ? data.expiryDate.trim() : "",
        issuingAuthority: data.issuingAuthority ? data.issuingAuthority.trim() : "Ministry of Foreign Affairs",
        signatoryOfficer: data.signatoryOfficer ? data.signatoryOfficer.trim() : "Ali Faraz",
        signatureUrl: data.signatureUrl ? data.signatureUrl.trim() : "/uploads/signature_ali_faraz_clean.png",
        pdfFileName: data.pdfFileName ? data.pdfFileName.trim() : "",
        pdfUrl: data.pdfUrl ? data.pdfUrl.trim() : "",
        status: data.status || "VERIFIED",
        securityHash: crypto.randomBytes(15).toString('hex'),
        notes: data.notes ? data.notes.trim() : "",
        createdAt: new Date().toISOString()
      };

      records.unshift(newRecord);
      atomicWriteJson(RECORDS_FILE, records);
      syncRecordsToCloud(records);
      return sendJson(res, 201, { success: true, record: newRecord });
    }

    // PUT /api/admin/records/:id (Update)
    const matchPut = pathname.match(/^\/api\/admin\/records\/([a-zA-Z0-9_-]+)$/);
    if (matchPut && method === 'PUT') {
      const recId = matchPut[1];
      const data = await parseBody(req);
      const index = records.findIndex(r => r.id === recId);

      if (index === -1) {
        return sendJson(res, 404, { success: false, message: "Record not found." });
      }

      const existing = records[index];
      const cleanDocNum = data.docNumber ? data.docNumber.trim().toUpperCase() : existing.docNumber;

      // Ensure no duplicate if docNumber changed
      if (cleanDocNum !== existing.docNumber && records.some(r => r.id !== recId && r.docNumber.toUpperCase() === cleanDocNum)) {
        return sendJson(res, 400, { success: false, message: `Document number ${cleanDocNum} is already in use.` });
      }

      records[index] = {
        ...existing,
        docNumber: cleanDocNum,
        applicantName: data.applicantName ? data.applicantName.trim() : existing.applicantName,
        documentType: data.documentType ? data.documentType.trim() : existing.documentType,
        documentCategory: data.documentCategory !== undefined ? data.documentCategory.trim() : (existing.documentCategory || existing.documentType),
        country: data.country !== undefined ? data.country.trim() : (existing.country || "Pakistan"),
        signedBy: data.signedBy !== undefined ? data.signedBy.trim() : (existing.signedBy || "N/A"),
        capacity: data.capacity !== undefined ? data.capacity.trim() : (existing.capacity || "Registrar"),
        sealOf: data.sealOf !== undefined ? data.sealOf.trim() : (existing.sealOf || "Preston University"),
        issuePlace: data.issuePlace !== undefined ? data.issuePlace.trim() : (existing.issuePlace || "Lahore Pakistan"),
        issueDate: data.issueDate ? data.issueDate.trim() : existing.issueDate,
        expiryDate: data.expiryDate !== undefined ? data.expiryDate.trim() : existing.expiryDate,
        issuingAuthority: data.issuingAuthority ? data.issuingAuthority.trim() : existing.issuingAuthority,
        signatoryOfficer: data.signatoryOfficer !== undefined ? data.signatoryOfficer.trim() : (existing.signatoryOfficer || "Ali Faraz"),
        signatureUrl: data.signatureUrl !== undefined ? data.signatureUrl.trim() : (existing.signatureUrl || "/uploads/signature_ali_faraz_clean.png"),
        pdfFileName: data.pdfFileName !== undefined ? data.pdfFileName.trim() : (existing.pdfFileName || ""),
        pdfUrl: data.pdfUrl !== undefined ? data.pdfUrl.trim() : (existing.pdfUrl || ""),
        status: data.status || existing.status,
        notes: data.notes !== undefined ? data.notes.trim() : existing.notes,
        updatedAt: new Date().toISOString()
      };

      atomicWriteJson(RECORDS_FILE, records);
      syncRecordsToCloud(records);
      return sendJson(res, 200, { success: true, record: records[index] });
    }

    // DELETE /api/admin/records/:id
    const matchDel = pathname.match(/^\/api\/admin\/records\/([a-zA-Z0-9_-]+)$/);
    if (matchDel && method === 'DELETE') {
      const recId = matchDel[1];
      const newRecords = records.filter(r => r.id !== recId);
      if (newRecords.length === records.length) {
        return sendJson(res, 404, { success: false, message: "Record not found." });
      }
      atomicWriteJson(RECORDS_FILE, newRecords);
      syncRecordsToCloud(newRecords);
      return sendJson(res, 200, { success: true, message: "Record deleted successfully." });
    }
  }

  // =========================================================================
  // ADMIN CLOUD PERSISTENCE & AUTO-SYNC APIS
  // =========================================================================
  if (pathname.startsWith('/api/admin/cloud-sync')) {
    const session = authenticateAdmin(req);
    if (!session) return sendJson(res, 401, { message: "Unauthorized." });

    if (pathname === '/api/admin/cloud-sync' && method === 'GET') {
      const cfg = getCloudConfig();
      return sendJson(res, 200, {
        githubRepo: cfg.githubRepo,
        githubBranch: cfg.githubBranch,
        githubFilePath: cfg.githubFilePath,
        autoCommit: cfg.autoCommit,
        hasGithubToken: !!cfg.githubToken,
        githubTokenMasked: cfg.githubToken ? `ghp_••••••••${cfg.githubToken.slice(-4)}` : "",
        kvRestApiUrl: cfg.kvRestApiUrl,
        hasKvToken: !!cfg.kvRestApiToken,
        kvTokenMasked: cfg.kvRestApiToken ? `••••••••${cfg.kvRestApiToken.slice(-4)}` : "",
        lastSyncedAt: cfg.lastSyncedAt,
        lastSyncStatus: cfg.lastSyncStatus,
        lastSyncMessage: cfg.lastSyncMessage
      });
    }

    if (pathname === '/api/admin/cloud-sync' && method === 'POST') {
      try {
        const data = await parseBody(req);
        const updates = {};

        if (data.githubToken !== undefined && !data.githubToken.includes('••••')) {
          updates.githubToken = data.githubToken.trim();
        }
        if (data.githubRepo !== undefined) updates.githubRepo = data.githubRepo.trim();
        if (data.githubBranch !== undefined) updates.githubBranch = data.githubBranch.trim();
        if (data.autoCommit !== undefined) updates.autoCommit = !!data.autoCommit;

        if (data.kvRestApiUrl !== undefined) updates.kvRestApiUrl = data.kvRestApiUrl.trim();
        if (data.kvRestApiToken !== undefined && !data.kvRestApiToken.includes('••••')) {
          updates.kvRestApiToken = data.kvRestApiToken.trim();
        }

        const saved = saveCloudConfig(updates);
        let syncResult = null;

        if (data.triggerSync) {
          const records = readJsonSafe(RECORDS_FILE, []);
          if (saved.githubToken && saved.githubRepo) {
            syncResult = await commitRecordsToGitHub(records, "Manual cloud sync from admin panel [skip ci]");
          }
          if (saved.kvRestApiUrl && saved.kvRestApiToken) {
            await syncToKV(records);
          }
        }

        return sendJson(res, 200, {
          success: true,
          message: syncResult && !syncResult.success ? `Settings saved, but sync failed: ${syncResult.reason}` : "Cloud persistence settings saved and synchronized!",
          config: {
            githubRepo: saved.githubRepo,
            githubBranch: saved.githubBranch,
            githubFilePath: saved.githubFilePath,
            autoCommit: saved.autoCommit,
            hasGithubToken: !!saved.githubToken,
            githubTokenMasked: saved.githubToken ? `ghp_••••••••${saved.githubToken.slice(-4)}` : "",
            kvRestApiUrl: saved.kvRestApiUrl,
            hasKvToken: !!saved.kvRestApiToken,
            kvTokenMasked: saved.kvRestApiToken ? `••••••••${saved.kvRestApiToken.slice(-4)}` : "",
            lastSyncedAt: saved.lastSyncedAt,
            lastSyncStatus: saved.lastSyncStatus,
            lastSyncMessage: saved.lastSyncMessage
          },
          syncResult
        });
      } catch (err) {
        console.error('[Cloud Sync API Error]:', err);
        return sendJson(res, 500, { success: false, message: "Failed to configure cloud sync: " + err.message });
      }
    }
  }

  // =========================================================================
  // ADMIN MEDIA UPLOAD API
  // =========================================================================
  if (pathname === '/api/admin/upload' && method === 'POST') {
    const session = authenticateAdmin(req);
    if (!session) return sendJson(res, 401, { message: "Unauthorized." });

    try {
      const data = await parseBody(req);
      if (!data.fileData || !data.fileName) {
        return sendJson(res, 400, { success: false, message: "fileData (base64) and fileName are required." });
      }

      // Extract base64 payload
      const matches = data.fileData.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      let buffer, mimeType;
      if (matches) {
        mimeType = matches[1];
        buffer = Buffer.from(matches[2], 'base64');
      } else {
        buffer = Buffer.from(data.fileData, 'base64');
        mimeType = 'application/octet-stream';
      }

      // Validate allowed extensions and MIME types
      const allowedExts = ['.png', '.jpg', '.jpeg', '.svg', '.webp', '.pdf'];
      const ext = path.extname(data.fileName).toLowerCase();
      if (!allowedExts.includes(ext)) {
        return sendJson(res, 400, { success: false, message: "Invalid file type. Allowed: PNG, JPG, JPEG, SVG, WEBP, PDF." });
      }

      // Max size: 10MB
      if (buffer.length > 10 * 1024 * 1024) {
        return sendJson(res, 400, { success: false, message: "File exceeds 10MB size limit." });
      }

      const isSignature = data.fileType === 'signature' || data.type === 'signature' || (data.fileName && data.fileName.toLowerCase().includes('sig'));
      const prefix = ext === '.pdf' ? 'doc_' : (isSignature ? 'sig_' : 'logo_');
      const safeName = `${prefix}${Date.now()}${ext}`;
      const destPath = path.join(UPLOADS_DIR, safeName);
      let fileUrl = `/uploads/${safeName}`;
      try {
        fs.writeFileSync(destPath, buffer);
        try {
          const pubDestPath = path.join(ROOT_DIR, 'public', 'uploads', safeName);
          fs.writeFileSync(pubDestPath, buffer);
        } catch (pubErr) {}
      } catch (fsErr) {
        // Safe fallback for serverless read-only filesystems (e.g. Vercel)
        console.warn('[Upload] Read-only disk detected. Writing to /tmp for serverless runtime.');
        try {
          fs.writeFileSync(path.join('/tmp', safeName), buffer);
        } catch (_) {}
        fileUrl = data.fileData.startsWith('data:') ? data.fileData : `data:${mimeType};base64,${data.fileData}`;
      }

      return sendJson(res, 200, {
        success: true,
        fileUrl: fileUrl,
        fileName: safeName
      });
    } catch (err) {
      console.error('[Upload Error]:', err);
      return sendJson(res, 500, { success: false, message: "Failed to upload file." });
    }
  }

  // =========================================================================
  // STATIC FILE SERVING (Preserving 100% of existing public site)
  // =========================================================================
  let cleanPath = pathname.replace(/\/+/g, '/');
  if (cleanPath === '' || cleanPath === '/') cleanPath = '/index.html';
  if (cleanPath === '/admin' || cleanPath === '/admin/') cleanPath = '/admin/index.html';

  let targetFile = path.join(ROOT_DIR, cleanPath);
  if (!fs.existsSync(targetFile) || !fs.statSync(targetFile).isFile()) {
    const pubFile = path.join(ROOT_DIR, 'public', cleanPath);
    if (fs.existsSync(pubFile) && fs.statSync(pubFile).isFile()) {
      targetFile = pubFile;
    } else if (IS_SERVERLESS && fs.existsSync(path.join('/tmp', path.basename(cleanPath))) && fs.statSync(path.join('/tmp', path.basename(cleanPath))).isFile()) {
      targetFile = path.join('/tmp', path.basename(cleanPath));
    } else if (cleanPath.startsWith('/uploads/sig_')) {
      const fallbackSig = path.join(ROOT_DIR, 'uploads', 'signature_ali_faraz_clean.png');
      if (fs.existsSync(fallbackSig) && fs.statSync(fallbackSig).isFile()) {
        targetFile = fallbackSig;
      }
    } else if (cleanPath.startsWith('/uploads/doc_')) {
      const fallbackDoc = path.join(ROOT_DIR, 'uploads', 'wLb2mwU18B98yhP5HgPkdE365DWUOhgJCl0djEsH.pdf');
      if (fs.existsSync(fallbackDoc) && fs.statSync(fallbackDoc).isFile()) {
        targetFile = fallbackDoc;
      }
    }
  }

  // Security check: ensure path is within ROOT_DIR or safe serverless /tmp
  const isAllowedPath = targetFile.startsWith(ROOT_DIR) || (IS_SERVERLESS && targetFile.startsWith('/tmp'));
  if (!isAllowedPath) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    return res.end('Access Denied');
  }

  if (fs.existsSync(targetFile) && fs.statSync(targetFile).isFile()) {
    const ext = path.extname(targetFile).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    const responseHeaders = { 'Content-Type': contentType };
    if (ext === '.pdf') {
      responseHeaders['Content-Disposition'] = 'inline';
    }
    res.writeHead(200, responseHeaders);
    fs.createReadStream(targetFile).pipe(res);
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('404 Not Found');
  }
}

const server = http.createServer(requestHandler);

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(`  Document Verification Portal & CMS Server Running     `);
    console.log(`  Public Portal: http://localhost:${PORT}/             `);
    console.log(`  Admin CMS:     http://localhost:${PORT}/admin/        `);
    console.log(`=======================================================`);
  });
}

module.exports = requestHandler;
