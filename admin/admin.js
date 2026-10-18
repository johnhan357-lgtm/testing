/**
 * Admin Panel & Visual CMS Client Controller
 * Manages authentication, live CMS drafts, publishing workflow, custom links, and document registry.
 */

document.addEventListener("DOMContentLoaded", () => {
  let authToken = sessionStorage.getItem("admin_token") || null;
  let draftConfig = null;
  let cachedRecords = [];

  // =========================================================================
  // 1. AUTHENTICATION & LOGIN
  // =========================================================================
  const loginOverlay = document.getElementById("loginOverlay");
  const loginForm = document.getElementById("loginForm");
  const loginUser = document.getElementById("loginUser");
  const loginPass = document.getElementById("loginPass");
  const loginAlert = document.getElementById("loginAlert");
  const adminApp = document.getElementById("adminApp");
  const btnLogout = document.getElementById("btnLogout");
  const loggedUserBadge = document.getElementById("loggedUserBadge");

  async function checkAuth() {
    try {
      const res = await apiFetch('/api/admin/me');
      if (res.ok) {
        const data = await res.json();
        if (data.authenticated) {
          onLoginSuccess(data.username);
          return;
        }
      }
    } catch {}
    showLogin();
  }

  function showLogin() {
    if (loginOverlay) loginOverlay.style.display = "flex";
    if (adminApp) adminApp.style.display = "none";
  }

  function onLoginSuccess(username) {
    if (loginOverlay) loginOverlay.style.display = "none";
    if (adminApp) adminApp.style.display = "flex";
    if (loggedUserBadge) loggedUserBadge.textContent = `Logged in as ${username || 'admin'}`;
    initDashboard();
  }

  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      loginAlert.style.display = "none";

      try {
        const res = await fetch('/api/admin/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: loginUser.value.trim(), password: loginPass.value })
        });
        const data = await res.json();

        if (res.ok && data.success) {
          authToken = data.token;
          sessionStorage.setItem("admin_token", authToken);
          onLoginSuccess(data.username);
          showToast("Welcome to Portal Admin CMS", "success");
        } else {
          loginAlert.textContent = data.message || "Invalid credentials.";
          loginAlert.style.display = "block";
        }
      } catch (err) {
        loginAlert.textContent = "Server connection error.";
        loginAlert.style.display = "block";
      }
    });
  }

  if (btnLogout) {
    btnLogout.addEventListener("click", async () => {
      try {
        await apiFetch('/api/admin/logout', { method: 'POST' });
      } catch {}
      sessionStorage.removeItem("admin_token");
      authToken = null;
      window.location.reload();
    });
  }

  // Wrapper for authenticated fetch
  function apiFetch(url, options = {}) {
    options.headers = options.headers || {};
    if (authToken) {
      options.headers['Authorization'] = `Bearer ${authToken}`;
    }
    return fetch(url, options);
  }

  // =========================================================================
  // 2. DASHBOARD & TAB SWITCHING
  // =========================================================================
  let currentActiveTab = "tab-overview";
  const tabPanes = document.querySelectorAll(".tab-pane");

  function switchTab(targetId) {
    currentActiveTab = targetId;
    tabPanes.forEach(p => p.classList.remove("active"));
    const targetPane = document.getElementById(targetId);
    if (targetPane) targetPane.classList.add("active");

    const sidebarNav = document.getElementById("adminSidebarNav");
    if (sidebarNav) {
      sidebarNav.querySelectorAll(".nav-tab-btn").forEach(btn => {
        if (btn.getAttribute("data-tab") === targetId) {
          btn.classList.add("active");
        } else {
          btn.classList.remove("active");
        }
      });
    }
  }

  async function initDashboard() {
    await loadAdminSidebarNav();
    await loadDraftConfig();
    await checkPublishingStatus();
    await loadRecords();
  }

  // =========================================================================
  // 3. DRAFT & PUBLISHING WORKFLOW (Rule 4)
  // =========================================================================
  const statusPill = document.getElementById("statusPill");
  const lastPublishedLabel = document.getElementById("lastPublishedLabel");
  const btnSaveDraft = document.getElementById("btnSaveDraft");
  const btnPublishLive = document.getElementById("btnPublishLive");
  const btnDiscardDraft = document.getElementById("btnDiscardDraft");

  async function checkPublishingStatus() {
    try {
      const res = await apiFetch('/api/admin/config/status');
      if (res.ok) {
        const data = await res.json();
        updateStatusPill(data.hasDraftChanges, data.lastPublishedAt);
      }
    } catch (err) {
      console.error(err);
    }
  }

  function updateStatusPill(hasDraftChanges, lastPublishedAt) {
    if (hasDraftChanges) {
      statusPill.className = "status-pill pill-draft";
      statusPill.innerHTML = `<span>●</span> Draft Changes Pending (Unpublished)`;
    } else {
      statusPill.className = "status-pill pill-published";
      statusPill.innerHTML = `<span>●</span> All Changes Published`;
    }
    if (lastPublishedAt && lastPublishedLabel) {
      const pubDate = new Date(lastPublishedAt);
      lastPublishedLabel.textContent = `Live since: ${pubDate.toLocaleTimeString()} (${pubDate.toLocaleDateString()})`;
    }
  }

  async function loadDraftConfig() {
    try {
      const res = await apiFetch('/api/admin/config/draft');
      if (res.ok) {
        draftConfig = await res.json();
        populateFormFromConfig(draftConfig);
      }
    } catch (err) {
      showToast("Failed to load draft configuration", "error");
    }
  }

  function populateFormFromConfig(cfg) {
    if (!cfg) return;

    // Tab 2: Branding
    if (cfg.branding) {
      document.getElementById("cfgAuthorityName").value = cfg.branding.authorityName || "";
      document.getElementById("cfgAuthoritySubtitle").value = cfg.branding.authoritySubtitle || "";

      if (cfg.branding.logoType === 'custom_image') {
        document.getElementById("radioLogoCustom").checked = true;
      } else {
        document.getElementById("radioLogoDefault").checked = true;
      }
      handleLogoRadioToggle();

      const logoImg = document.getElementById("logoPreviewImg");
      const logoText = document.getElementById("logoStatusText");
      if (cfg.branding.logoUrl) {
        logoImg.src = cfg.branding.logoUrl;
        logoImg.style.display = "block";
        logoText.textContent = "Custom logo active.";
      } else {
        logoImg.style.display = "none";
        logoText.textContent = "No custom logo uploaded.";
      }

      if (cfg.branding.socialLinks) {
        document.getElementById("cfgSocialFb").value = cfg.branding.socialLinks.facebook || "";
        document.getElementById("cfgSocialIg").value = cfg.branding.socialLinks.instagram || "";
        document.getElementById("cfgSocialTw").value = cfg.branding.socialLinks.twitter || "";
        document.getElementById("cfgSocialLi").value = cfg.branding.socialLinks.linkedin || "";
      }
    }

    // Tab 3: Navigation
    renderNavItemsTable(cfg.navigation || []);

    // Tab 4: Content
    if (cfg.hero) {
      document.getElementById("cfgHeroTitle").value = cfg.hero.title || "";
      document.getElementById("cfgHeroSubtitle").value = cfg.hero.subtitle || "";
    }
    if (cfg.verificationCard) {
      document.getElementById("cfgCardHeading").value = cfg.verificationCard.heading || "";
      document.getElementById("cfgDocLabel").value = cfg.verificationCard.docNumberLabel || "";
      document.getElementById("cfgDocPlaceholder").value = cfg.verificationCard.docNumberPlaceholder || "";
      document.getElementById("cfgDateLabel").value = cfg.verificationCard.docDateLabel || "";
      document.getElementById("cfgVerifyBtnText").value = cfg.verificationCard.verifyButtonText || "";
      document.getElementById("cfgClearBtnText").value = cfg.verificationCard.clearButtonText || "";
      document.getElementById("cfgSupportEmail").value = cfg.verificationCard.supportEmail || "";
    }

    // Tab 6: Notice Modal
    if (cfg.noticeModal) {
      document.getElementById("cfgNoticeEnabled").checked = cfg.noticeModal.enabled !== false;
      document.getElementById("cfgNoticeTitle").value = cfg.noticeModal.title || "";
      document.getElementById("cfgNoticeBodyEn").value = cfg.noticeModal.bodyEnglish || "";
      document.getElementById("cfgNoticeBodyReg").value = cfg.noticeModal.bodyRegional || "";
      document.getElementById("cfgNoticeBtnText").value = cfg.noticeModal.confirmButtonText || "";
    }

    // Tab 7: Floating & Footer
    if (cfg.floatingFeedback) {
      document.getElementById("cfgFeedbackEnabled").checked = cfg.floatingFeedback.enabled !== false;
      document.getElementById("cfgFeedbackLabel").value = cfg.floatingFeedback.label || "";
      document.getElementById("cfgFeedbackAction").value = cfg.floatingFeedback.actionType || "dialog";
      document.getElementById("cfgFeedbackUrl").value = cfg.floatingFeedback.customUrl || "";
      toggleFeedbackUrlField();
    }
    if (cfg.footer) {
      document.getElementById("cfgFooterCopyright").value = cfg.footer.copyrightText || "";
      renderFooterLinksTable(cfg.footer.links || []);
    }

    // Certificate View Settings
    if (cfg.certificateView) {
      const cv = cfg.certificateView;
      const elPageTitle = document.getElementById("cfgCertPageTitle");
      const elBreadcrumb = document.getElementById("cfgCertBreadcrumb");
      const elIssuer = document.getElementById("cfgCertIssuerStatement");
      const elSummary = document.getElementById("cfgCertSummaryTemplate");
      const elWatermark = document.getElementById("cfgCertWatermark");
      const elConvTitle = document.getElementById("cfgCertConventionTitle");
      const elConvSub = document.getElementById("cfgCertConventionSubtitle");
      const elCountry = document.getElementById("cfgCertCountry");
      const elSignatory = document.getElementById("cfgCertSignatory");
      const elDisclaimer = document.getElementById("cfgCertDisclaimer");
      const elVerifyUrl = document.getElementById("cfgCertVerifyUrl");
      const elEnablePdf = document.getElementById("cfgCertEnablePdf");

      if (elPageTitle) elPageTitle.value = cv.pageTitle || "QR Code Verification Apostille Certificate";
      if (elBreadcrumb) elBreadcrumb.value = cv.breadcrumbText || "Home / Apostille verification";
      if (elIssuer) elIssuer.value = cv.issuerStatement || "This apostille certificate is issued by Ministry of Foreign Affairs Pakistan.";
      if (elSummary) elSummary.value = cv.summaryTemplate || "This apostille refers to {category} and issued on {date} and is Approved by {authority}";
      if (elWatermark) elWatermark.value = cv.watermarkText || "GOVTOFPAKISTAN";
      if (elConvTitle) elConvTitle.value = cv.conventionTitle || "APOSTILLE";
      if (elConvSub) elConvSub.value = cv.conventionSubtitle || "(Convention de La Haye du 5 October 1961)";
      if (elCountry) elCountry.value = cv.defaultCountry || "Pakistan";
      if (elSignatory) elSignatory.value = cv.defaultSignatory || "Ali Faraz";
      if (elDisclaimer) elDisclaimer.value = cv.disclaimerText || "";
      if (elVerifyUrl) elVerifyUrl.value = cv.verificationUrlText || "";
      if (elEnablePdf) elEnablePdf.checked = cv.enablePdfViewer !== false;
    }

    // Tab 8: Theme
    if (cfg.theme) {
      syncColor("cfgColorPrimary", cfg.theme.primaryGreen || "#01411c");
      syncColor("cfgColorDark", cfg.theme.primaryGreenDark || "#003316");
      syncColor("cfgColorFooter", cfg.theme.footerDark || "#1e2225");
      syncColor("cfgColorBg", cfg.theme.bgLight || "#f8f9fb");
    }
  }

  function gatherConfigFromForm() {
    const updated = JSON.parse(JSON.stringify(draftConfig || {}));

    // Branding
    updated.branding = updated.branding || {};
    updated.branding.authorityName = document.getElementById("cfgAuthorityName").value.trim();
    updated.branding.authoritySubtitle = document.getElementById("cfgAuthoritySubtitle").value.trim();
    updated.branding.logoType = document.querySelector('input[name="logoTypeRadio"]:checked')?.value || "default_svg";
    updated.branding.socialLinks = {
      facebook: document.getElementById("cfgSocialFb").value.trim(),
      instagram: document.getElementById("cfgSocialIg").value.trim(),
      twitter: document.getElementById("cfgSocialTw").value.trim(),
      linkedin: document.getElementById("cfgSocialLi").value.trim()
    };

    // Hero
    updated.hero = {
      title: document.getElementById("cfgHeroTitle").value.trim(),
      subtitle: document.getElementById("cfgHeroSubtitle").value.trim()
    };

    // Verification Card
    updated.verificationCard = {
      heading: document.getElementById("cfgCardHeading").value.trim(),
      docNumberLabel: document.getElementById("cfgDocLabel").value.trim(),
      docNumberPlaceholder: document.getElementById("cfgDocPlaceholder").value.trim(),
      docDateLabel: document.getElementById("cfgDateLabel").value.trim(),
      verifyButtonText: document.getElementById("cfgVerifyBtnText").value.trim(),
      clearButtonText: document.getElementById("cfgClearBtnText").value.trim(),
      supportEmail: document.getElementById("cfgSupportEmail").value.trim(),
      helpText: `If you need further help email ${document.getElementById("cfgSupportEmail").value.trim()} with the certificate number and date`
    };

    // Apostille Certificate View
    const elPageTitle = document.getElementById("cfgCertPageTitle");
    if (elPageTitle) {
      updated.certificateView = {
        pageTitle: elPageTitle.value.trim() || "QR Code Verification Apostille Certificate",
        breadcrumbText: (document.getElementById("cfgCertBreadcrumb")?.value || "").trim() || "Home / Apostille verification",
        issuerStatement: (document.getElementById("cfgCertIssuerStatement")?.value || "").trim(),
        summaryTemplate: (document.getElementById("cfgCertSummaryTemplate")?.value || "").trim(),
        watermarkText: (document.getElementById("cfgCertWatermark")?.value || "").trim() || "GOVTOFPAKISTAN",
        conventionTitle: (document.getElementById("cfgCertConventionTitle")?.value || "").trim() || "APOSTILLE",
        conventionSubtitle: (document.getElementById("cfgCertConventionSubtitle")?.value || "").trim(),
        defaultCountry: (document.getElementById("cfgCertCountry")?.value || "").trim() || "Pakistan",
        certifiedWord: "Certified",
        signatoryOfficer: (document.getElementById("cfgCertSignatory")?.value || "").trim() || "Ali Faraz",
        defaultSignatory: (document.getElementById("cfgCertSignatory")?.value || "").trim() || "Ali Faraz",
        disclaimerText: (document.getElementById("cfgCertDisclaimer")?.value || "").trim(),
        verificationUrlText: (document.getElementById("cfgCertVerifyUrl")?.value || "").trim(),
        enablePdfViewer: document.getElementById("cfgCertEnablePdf") ? document.getElementById("cfgCertEnablePdf").checked : true,
        defaultPdfFileName: updated.certificateView?.defaultPdfFileName || "wLb2mwU18B98yhP5HgPkdE365DWUOhgJCl0djEsH.pdf",
        defaultPdfUrl: updated.certificateView?.defaultPdfUrl || "/uploads/wLb2mwU18B98yhP5HgPkdE365DWUOhgJCl0djEsH.pdf"
      };
    }

    // Notice Modal
    updated.noticeModal = {
      enabled: document.getElementById("cfgNoticeEnabled").checked,
      title: document.getElementById("cfgNoticeTitle").value.trim(),
      bodyEnglish: document.getElementById("cfgNoticeBodyEn").value.trim(),
      bodyRegional: document.getElementById("cfgNoticeBodyReg").value.trim(),
      confirmButtonText: document.getElementById("cfgNoticeBtnText").value.trim()
    };

    // Floating Action & Footer
    updated.floatingFeedback = {
      enabled: document.getElementById("cfgFeedbackEnabled").checked,
      label: document.getElementById("cfgFeedbackLabel").value.trim(),
      actionType: document.getElementById("cfgFeedbackAction").value,
      customUrl: document.getElementById("cfgFeedbackUrl").value.trim()
    };

    updated.footer = updated.footer || {};
    updated.footer.copyrightText = document.getElementById("cfgFooterCopyright").value.trim();

    // Theme
    updated.theme = {
      primaryGreen: document.getElementById("cfgColorPrimary").value.trim(),
      primaryGreenDark: document.getElementById("cfgColorDark").value.trim(),
      primaryGreenLight: adjustColorBrightness(document.getElementById("cfgColorPrimary").value.trim(), 20),
      footerDark: document.getElementById("cfgColorFooter").value.trim(),
      bgLight: document.getElementById("cfgColorBg").value.trim()
    };

    return updated;
  }

  // Save Draft Action (Rule 4: Does NOT alter live site)
  if (btnSaveDraft) {
    btnSaveDraft.addEventListener("click", async () => {
      draftConfig = gatherConfigFromForm();
      try {
        const res = await apiFetch('/api/admin/config/draft', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(draftConfig)
        });
        if (res.ok) {
          showToast("Draft saved successfully. Live public website remains unchanged.", "success");
          await checkPublishingStatus();
        } else {
          showToast("Failed to save draft.", "error");
        }
      } catch (err) {
        showToast("Error saving draft.", "error");
      }
    });
  }

  // Publish to Live Site Action (Rule 4: Validates, creates snapshot, updates public site)
  if (btnPublishLive) {
    btnPublishLive.addEventListener("click", async () => {
      draftConfig = gatherConfigFromForm();
      try {
        // Save draft first
        await apiFetch('/api/admin/config/draft', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(draftConfig)
        });

        // Trigger publish
        const res = await apiFetch('/api/admin/config/publish', { method: 'POST' });
        const data = await res.json();

        if (res.ok && data.success) {
          showToast("Changes published to live website!", "success");
          await checkPublishingStatus();
        } else {
          showToast(data.message || "Publishing failed. Live site was preserved.", "error");
        }
      } catch (err) {
        showToast("Publishing connection error.", "error");
      }
    });
  }

  // Discard Draft Action
  if (btnDiscardDraft) {
    btnDiscardDraft.addEventListener("click", async () => {
      if (!confirm("Are you sure you want to discard your draft? All unsaved changes will be reset to match the currently published website.")) {
        return;
      }
      try {
        const res = await apiFetch('/api/admin/config/discard', { method: 'POST' });
        if (res.ok) {
          showToast("Draft discarded. Reset to live published version.", "success");
          await loadDraftConfig();
          await checkPublishingStatus();
        }
      } catch (err) {
        showToast("Failed to discard draft.", "error");
      }
    });
  }

  // =========================================================================
  // 4. LOGO UPLOAD & RADIO TOGGLE
  // =========================================================================
  const logoRadios = document.querySelectorAll('input[name="logoTypeRadio"]');
  const uploadSection = document.getElementById("customLogoUploadSection");
  const logoFileInput = document.getElementById("logoFileInput");

  logoRadios.forEach(r => r.addEventListener("change", handleLogoRadioToggle));

  function handleLogoRadioToggle() {
    const isCustom = document.getElementById("radioLogoCustom")?.checked;
    if (uploadSection) {
      uploadSection.style.display = isCustom ? "block" : "none";
    }
  }

  if (logoFileInput) {
    logoFileInput.addEventListener("change", async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      if (file.size > 2 * 1024 * 1024) {
        alert("File size exceeds 2MB limit.");
        logoFileInput.value = "";
        return;
      }

      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const res = await apiFetch('/api/admin/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fileData: reader.result, fileName: file.name })
          });
          const data = await res.json();

          if (res.ok && data.success) {
            draftConfig.branding = draftConfig.branding || {};
            draftConfig.branding.logoUrl = data.fileUrl;
            draftConfig.branding.logoType = 'custom_image';
            document.getElementById("radioLogoCustom").checked = true;

            const logoImg = document.getElementById("logoPreviewImg");
            logoImg.src = data.fileUrl;
            logoImg.style.display = "block";
            document.getElementById("logoStatusText").textContent = `Uploaded: ${data.fileName}`;
            showToast("Custom logo uploaded. Click 'Save Draft' or 'Publish' to persist.", "success");
            await checkPublishingStatus();
          } else {
            showToast(data.message || "Upload failed.", "error");
          }
        } catch {
          showToast("Network error uploading file.", "error");
        }
      };
      reader.readAsDataURL(file);
    });
  }

  // =========================================================================
  // 5. NAVIGATION & EXTERNAL LINKS MANAGER (Rule 3)
  // =========================================================================
  const navTableBody = document.getElementById("navItemsTableBody");
  const btnAddNavItem = document.getElementById("btnAddNavItem");
  const navItemModal = document.getElementById("navItemModal");
  const navItemForm = document.getElementById("navItemForm");
  const navModalTitle = document.getElementById("navModalTitle");
  const navItemIndex = document.getElementById("navItemIndex");
  const navItemLabel = document.getElementById("navItemLabel");
  const navItemGroup = document.getElementById("navItemGroup");
  const navItemUrl = document.getElementById("navItemUrl");
  const navItemTarget = document.getElementById("navItemTarget");
  const navItemEnabled = document.getElementById("navItemEnabled");

  function renderNavItemsTable(navItems) {
    if (!navTableBody) return;
    navTableBody.innerHTML = "";

    navItems.forEach((item, index) => {
      const row = document.createElement("tr");
      const groupBadge = item.group ? `<span style="font-size: 0.75rem; color: #6b7280; display: block;">${escapeHtml(item.group)}</span>` : '';
      row.innerHTML = `
        <td style="font-weight: 600; color: #6b7280;">#${index + 1}</td>
        <td>
          <div style="font-weight: 600;">${escapeHtml(item.label)}</div>
          ${groupBadge}
        </td>
        <td style="font-family: monospace; font-size: 0.85rem; color: #065f46;">
          <a href="${escapeHtml(item.url)}" target="_blank" style="color: inherit; text-decoration: none;">
            ${escapeHtml(item.url)}
          </a>
        </td>
        <td>
          <span style="font-size: 0.8rem; background: #e5e7eb; padding: 2px 8px; border-radius: 4px;">
            ${item.target === '_blank' ? 'New Tab' : 'Same Tab'}
          </span>
        </td>
        <td>
          <label style="cursor: pointer;">
            <input type="checkbox" class="nav-toggle-enabled" data-index="${index}" ${item.enabled !== false ? 'checked' : ''}>
          </label>
        </td>
        <td style="text-align: right;">
          <button class="btn-secondary btn-nav-up" data-index="${index}" style="padding: 4px 8px;" title="Move Up" ${index === 0 ? 'disabled' : ''}>▲</button>
          <button class="btn-secondary btn-nav-down" data-index="${index}" style="padding: 4px 8px;" title="Move Down" ${index === navItems.length - 1 ? 'disabled' : ''}>▼</button>
          <button class="btn-secondary btn-nav-edit" data-index="${index}" style="padding: 4px 8px;">Edit</button>
          <button class="btn-danger btn-nav-del" data-index="${index}" style="padding: 4px 8px;">✕</button>
        </td>
      `;
      navTableBody.appendChild(row);
    });

    // Attach event listeners
    navTableBody.querySelectorAll(".nav-toggle-enabled").forEach(cb => {
      cb.addEventListener("change", (e) => {
        const idx = parseInt(e.target.dataset.index, 10);
        draftConfig.navigation[idx].enabled = e.target.checked;
        showToast("Navigation status updated in draft.", "success");
      });
    });

    navTableBody.querySelectorAll(".btn-nav-up").forEach(btn => {
      btn.addEventListener("click", () => {
        const idx = parseInt(btn.dataset.index, 10);
        if (idx > 0) {
          const temp = draftConfig.navigation[idx];
          draftConfig.navigation[idx] = draftConfig.navigation[idx - 1];
          draftConfig.navigation[idx - 1] = temp;
          renderNavItemsTable(draftConfig.navigation);
        }
      });
    });

    navTableBody.querySelectorAll(".btn-nav-down").forEach(btn => {
      btn.addEventListener("click", () => {
        const idx = parseInt(btn.dataset.index, 10);
        if (idx < draftConfig.navigation.length - 1) {
          const temp = draftConfig.navigation[idx];
          draftConfig.navigation[idx] = draftConfig.navigation[idx + 1];
          draftConfig.navigation[idx + 1] = temp;
          renderNavItemsTable(draftConfig.navigation);
        }
      });
    });

    navTableBody.querySelectorAll(".btn-nav-edit").forEach(btn => {
      btn.addEventListener("click", () => {
        const idx = parseInt(btn.dataset.index, 10);
        const item = draftConfig.navigation[idx];
        navModalTitle.textContent = "Edit Navigation Link";
        navItemIndex.value = idx;
        navItemLabel.value = item.label;
        if (navItemGroup) navItemGroup.value = item.group || "";
        navItemUrl.value = item.url;
        navItemTarget.value = item.target || "_self";
        navItemEnabled.checked = item.enabled !== false;
        navItemModal.classList.add("active");
      });
    });

    navTableBody.querySelectorAll(".btn-nav-del").forEach(btn => {
      btn.addEventListener("click", () => {
        const idx = parseInt(btn.dataset.index, 10);
        if (confirm(`Delete navigation item "${draftConfig.navigation[idx].label}"?`)) {
          draftConfig.navigation.splice(idx, 1);
          renderNavItemsTable(draftConfig.navigation);
          showToast("Navigation item removed from draft.", "success");
        }
      });
    });
  }

  if (btnAddNavItem) {
    btnAddNavItem.addEventListener("click", () => {
      navModalTitle.textContent = "Add Navigation Link / Button";
      navItemIndex.value = "";
      navItemForm.reset();
      if (navItemGroup) navItemGroup.value = "";
      navItemEnabled.checked = true;
      navItemModal.classList.add("active");
    });
  }

  if (navItemForm) {
    navItemForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const idxStr = navItemIndex.value;
      draftConfig.navigation = draftConfig.navigation || [];

      const newItem = {
        id: `nav-${Date.now()}`,
        label: navItemLabel.value.trim(),
        group: navItemGroup ? navItemGroup.value.trim() : "",
        url: navItemUrl.value.trim(),
        target: navItemTarget.value,
        enabled: navItemEnabled.checked
      };

      if (idxStr !== "") {
        const idx = parseInt(idxStr, 10);
        newItem.id = draftConfig.navigation[idx].id || newItem.id;
        draftConfig.navigation[idx] = newItem;
        showToast("Navigation link updated in draft.", "success");
      } else {
        draftConfig.navigation.push(newItem);
        showToast("New navigation link added to draft.", "success");
      }

      navItemModal.classList.remove("active");
      renderNavItemsTable(draftConfig.navigation);
    });
  }

  // =========================================================================
  // 6. FOOTER LINKS MANAGER (FULL MODAL, EDIT, REORDER & CUSTOM URLS)
  // =========================================================================
  const footerLinksTableBody = document.getElementById("footerLinksTableBody");
  const btnAddFooterLink = document.getElementById("btnAddFooterLink");
  const footerLinkModal = document.getElementById("footerLinkModal");
  const footerLinkModalTitle = document.getElementById("footerLinkModalTitle");
  const footerLinkForm = document.getElementById("footerLinkForm");
  const footerLinkIndex = document.getElementById("footerLinkIndex");
  const footerLinkLabel = document.getElementById("footerLinkLabel");
  const footerLinkUrl = document.getElementById("footerLinkUrl");
  const footerLinkTarget = document.getElementById("footerLinkTarget");
  const footerLinkEnabled = document.getElementById("footerLinkEnabled");

  function renderFooterLinksTable(links) {
    if (!footerLinksTableBody) return;
    footerLinksTableBody.innerHTML = "";

    links.forEach((link, idx) => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td style="font-weight: 600; color: #6b7280;">#${idx + 1}</td>
        <td>
          <div style="font-weight: 600;">${escapeHtml(link.label)}</div>
        </td>
        <td style="font-family: monospace; font-size: 0.85rem; color: #065f46;">
          <a href="${escapeHtml(link.url)}" target="_blank" style="color: inherit; text-decoration: none;">
            ${escapeHtml(link.url)}
          </a>
        </td>
        <td>
          <span style="font-size: 0.8rem; background: #e5e7eb; padding: 2px 8px; border-radius: 4px;">
            ${link.target === '_blank' ? 'New Tab' : 'Same Tab'}
          </span>
        </td>
        <td>
          <label style="cursor: pointer;">
            <input type="checkbox" class="foot-toggle-enabled" data-index="${idx}" ${link.enabled !== false ? 'checked' : ''}>
          </label>
        </td>
        <td style="text-align: right;">
          <button type="button" class="btn-secondary btn-foot-up" data-index="${idx}" style="padding: 4px 8px;" title="Move Up" ${idx === 0 ? 'disabled' : ''}>▲</button>
          <button type="button" class="btn-secondary btn-foot-down" data-index="${idx}" style="padding: 4px 8px;" title="Move Down" ${idx === links.length - 1 ? 'disabled' : ''}>▼</button>
          <button type="button" class="btn-secondary btn-foot-edit" data-index="${idx}" style="padding: 4px 8px;">Edit</button>
          <button type="button" class="btn-danger btn-foot-del" data-index="${idx}" style="padding: 4px 8px;">✕</button>
        </td>
      `;
      footerLinksTableBody.appendChild(row);
    });

    // Toggle enabled checkbox listener
    footerLinksTableBody.querySelectorAll(".foot-toggle-enabled").forEach(cb => {
      cb.addEventListener("change", (e) => {
        const idx = parseInt(e.target.dataset.index, 10);
        draftConfig.footer = draftConfig.footer || {};
        draftConfig.footer.links = draftConfig.footer.links || [];
        draftConfig.footer.links[idx].enabled = e.target.checked;
        showToast("Footer link status updated in draft.", "success");
      });
    });

    // Move Up
    footerLinksTableBody.querySelectorAll(".btn-foot-up").forEach(btn => {
      btn.addEventListener("click", () => {
        const idx = parseInt(btn.dataset.index, 10);
        if (idx > 0) {
          const temp = draftConfig.footer.links[idx];
          draftConfig.footer.links[idx] = draftConfig.footer.links[idx - 1];
          draftConfig.footer.links[idx - 1] = temp;
          renderFooterLinksTable(draftConfig.footer.links);
        }
      });
    });

    // Move Down
    footerLinksTableBody.querySelectorAll(".btn-foot-down").forEach(btn => {
      btn.addEventListener("click", () => {
        const idx = parseInt(btn.dataset.index, 10);
        if (idx < draftConfig.footer.links.length - 1) {
          const temp = draftConfig.footer.links[idx];
          draftConfig.footer.links[idx] = draftConfig.footer.links[idx + 1];
          draftConfig.footer.links[idx + 1] = temp;
          renderFooterLinksTable(draftConfig.footer.links);
        }
      });
    });

    // Edit Link (Opens modal pre-filled with current link values)
    footerLinksTableBody.querySelectorAll(".btn-foot-edit").forEach(btn => {
      btn.addEventListener("click", () => {
        const idx = parseInt(btn.dataset.index, 10);
        const item = draftConfig.footer.links[idx];
        if (!footerLinkModal) return;
        footerLinkModalTitle.textContent = "Edit Footer Link";
        footerLinkIndex.value = idx;
        footerLinkLabel.value = item.label || "";
        footerLinkUrl.value = item.url || "";
        footerLinkTarget.value = item.target || "_self";
        footerLinkEnabled.checked = item.enabled !== false;
        footerLinkModal.classList.add("active");
      });
    });

    // Delete Link
    footerLinksTableBody.querySelectorAll(".btn-foot-del").forEach(btn => {
      btn.addEventListener("click", () => {
        const idx = parseInt(btn.dataset.index, 10);
        if (confirm(`Delete footer link "${draftConfig.footer.links[idx].label}"?`)) {
          draftConfig.footer.links.splice(idx, 1);
          renderFooterLinksTable(draftConfig.footer.links);
          showToast("Footer link removed from draft.", "success");
        }
      });
    });
  }

  if (btnAddFooterLink) {
    btnAddFooterLink.addEventListener("click", () => {
      if (!footerLinkModal) return;
      footerLinkModalTitle.textContent = "Add Footer Navigation Link";
      footerLinkIndex.value = "";
      footerLinkForm.reset();
      footerLinkUrl.value = "https://";
      footerLinkTarget.value = "_blank";
      footerLinkEnabled.checked = true;
      footerLinkModal.classList.add("active");
    });
  }

  if (footerLinkForm) {
    footerLinkForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const idxStr = footerLinkIndex.value;
      draftConfig.footer = draftConfig.footer || {};
      draftConfig.footer.links = draftConfig.footer.links || [];

      const newItem = {
        id: `foot-${Date.now()}`,
        label: footerLinkLabel.value.trim(),
        url: footerLinkUrl.value.trim(),
        target: footerLinkTarget.value,
        enabled: footerLinkEnabled.checked
      };

      if (idxStr !== "") {
        const idx = parseInt(idxStr, 10);
        newItem.id = draftConfig.footer.links[idx].id || newItem.id;
        draftConfig.footer.links[idx] = newItem;
        showToast("Footer link updated in draft.", "success");
      } else {
        draftConfig.footer.links.push(newItem);
        showToast("New footer link added to draft.", "success");
      }

      footerLinkModal.classList.remove("active");
      renderFooterLinksTable(draftConfig.footer.links);
    });
  }

  function toggleFeedbackUrlField() {
    const action = document.getElementById("cfgFeedbackAction").value;
    const urlField = document.getElementById("cfgFeedbackUrlField");
    if (urlField) urlField.style.display = action === "custom_link" ? "block" : "none";
  }
  const feedbackActionSelect = document.getElementById("cfgFeedbackAction");
  if (feedbackActionSelect) feedbackActionSelect.addEventListener("change", toggleFeedbackUrlField);

  // =========================================================================
  // 7. DOCUMENT REGISTRY CRUD (Rule 5: Authoritative Server Lookup)
  // =========================================================================
  const recordsTableBody = document.getElementById("recordsTableBody");
  const recordSearchInput = document.getElementById("recordSearchInput");
  const recordStatusFilter = document.getElementById("recordStatusFilter");
  const btnAddNewRecord = document.getElementById("btnAddNewRecord");
  const recordModal = document.getElementById("recordModal");
  const recordForm = document.getElementById("recordForm");
  const recordModalTitle = document.getElementById("recordModalTitle");

  const statTotalVerified = document.getElementById("statTotalVerified");
  const statTotalFlagged = document.getElementById("statTotalFlagged");

  async function loadRecords() {
    const q = recordSearchInput ? recordSearchInput.value.trim() : "";
    const status = recordStatusFilter ? recordStatusFilter.value : "ALL";

    try {
      const res = await apiFetch(`/api/admin/records?q=${encodeURIComponent(q)}&status=${status}`);
      if (res.ok) {
        cachedRecords = await res.json();
        renderRecordsTable(cachedRecords);
        updateRecordStats(cachedRecords);
      }
    } catch {
      showToast("Failed to load document records.", "error");
    }
  }

  function updateRecordStats(records) {
    const verified = records.filter(r => r.status === 'VERIFIED').length;
    const flagged = records.filter(r => r.status === 'EXPIRED' || r.status === 'REVOKED').length;
    if (statTotalVerified) statTotalVerified.textContent = verified;
    if (statTotalFlagged) statTotalFlagged.textContent = flagged;
  }

  function renderRecordsTable(records) {
    if (!recordsTableBody) return;
    recordsTableBody.innerHTML = "";

    if (records.length === 0) {
      recordsTableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #6b7280; padding: 25px;">No matching documents registered.</td></tr>`;
      return;
    }

    records.forEach(rec => {
      const row = document.createElement("tr");
      let statusClass = "badge-verified";
      if (rec.status === 'EXPIRED') statusClass = "badge-expired";
      if (rec.status === 'REVOKED') statusClass = "badge-revoked";
      if (rec.status === 'SUSPENDED') statusClass = "badge-suspended";

      const pdfBadge = (rec.pdfFileName || rec.pdfUrl)
        ? `<a href="${rec.pdfUrl || ('/uploads/' + rec.pdfFileName)}" target="_blank" class="badge-pdf" style="display: inline-block; padding: 2px 7px; background: #e0f2fe; color: #0369a1; border-radius: 4px; font-size: 0.75rem; font-weight: 700; text-decoration: none;">PDF ↗</a>`
        : `<span style="color: #94a3b8; font-size: 0.75rem;">None</span>`;

      row.innerHTML = `
        <td style="font-weight: 700; font-family: monospace; color: #111827;">${escapeHtml(rec.docNumber)}</td>
        <td style="font-weight: 600;">${escapeHtml(rec.documentCategory || rec.documentType || "Personal Document")}</td>
        <td style="color: #4b5563;">${escapeHtml(rec.sealOf || rec.issuingAuthority)}</td>
        <td style="white-space: nowrap;">${escapeHtml(rec.issueDate)}</td>
        <td><span class="badge-status ${statusClass}">${rec.status}</span></td>
        <td>${pdfBadge}</td>
        <td style="text-align: right; white-space: nowrap;">
          <button class="btn-secondary btn-copy-qr" data-doc="${escapeHtml(rec.docNumber)}" data-date="${escapeHtml(rec.issueDate)}" style="padding: 4px 8px;" title="Copy QR Verification Link">
            🔗 QR Link
          </button>
          <button class="btn-secondary btn-rec-edit" data-id="${rec.id}" style="padding: 4px 8px;">Edit</button>
          <button class="btn-danger btn-rec-del" data-id="${rec.id}" style="padding: 4px 8px;">✕</button>
        </td>
      `;
      recordsTableBody.appendChild(row);
    });

    // Copy QR Verification Link
    recordsTableBody.querySelectorAll(".btn-copy-qr").forEach(btn => {
      btn.addEventListener("click", () => {
        const doc = btn.dataset.doc;
        const date = btn.dataset.date;
        const url = `${window.location.origin}/index.html?doc=${encodeURIComponent(doc)}&date=${encodeURIComponent(date)}`;
        navigator.clipboard.writeText(url).then(() => {
          showToast(`Copied QR link for ${doc}`, "success");
        }).catch(() => {
          prompt("Copy this QR Verification Link:", url);
        });
      });
    });

    // Edit Record
    recordsTableBody.querySelectorAll(".btn-rec-edit").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.id;
        const rec = cachedRecords.find(r => r.id === id);
        if (!rec) return;

        recordModalTitle.textContent = "Edit Apostille / Document Certificate";
        document.getElementById("recordId").value = rec.id;
        document.getElementById("recDocNumber").value = rec.docNumber || "";
        document.getElementById("recApplicant").value = rec.applicantName || "";
        document.getElementById("recDocCategory").value = rec.documentCategory || rec.documentType || "Personal Document";
        document.getElementById("recCountry").value = rec.country || "Pakistan";
        document.getElementById("recSignedBy").value = rec.signedBy || "N/A";
        document.getElementById("recCapacity").value = rec.capacity || "Registrar";
        document.getElementById("recSealOf").value = rec.sealOf || "Preston University";
        document.getElementById("recIssuePlace").value = rec.issuePlace || "Lahore Pakistan";
        document.getElementById("recIssueDate").value = rec.issueDate || "";
        document.getElementById("recExpiryDate").value = rec.expiryDate || "";
        document.getElementById("recAuthority").value = rec.issuingAuthority || "Ministry of Foreign Affairs";
        document.getElementById("recSignatoryOfficer").value = rec.signatoryOfficer || "Ali Faraz";
        document.getElementById("recDocType").value = rec.documentType || "Other Documents";
        document.getElementById("recStatus").value = rec.status || "VERIFIED";
        document.getElementById("recPdfFileName").value = rec.pdfFileName || "";
        document.getElementById("recPdfUrl").value = rec.pdfUrl || "";
        document.getElementById("recNotes").value = rec.notes || "";
        recordModal.classList.add("active");
      });
    });

    // Delete Record
    recordsTableBody.querySelectorAll(".btn-rec-del").forEach(btn => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.id;
        if (!confirm("Are you sure you want to permanently delete this document record?")) return;

        try {
          const res = await apiFetch(`/api/admin/records/${id}`, { method: 'DELETE' });
          if (res.ok) {
            showToast("Document deleted successfully.", "success");
            await loadRecords();
          } else {
            showToast("Failed to delete record.", "error");
          }
        } catch {
          showToast("Network error deleting record.", "error");
        }
      });
    });
  }

  if (recordSearchInput) recordSearchInput.addEventListener("input", debounce(loadRecords, 300));
  if (recordStatusFilter) recordStatusFilter.addEventListener("change", loadRecords);

  if (btnAddNewRecord) {
    btnAddNewRecord.addEventListener("click", () => {
      recordModalTitle.textContent = "Register New Apostille / Document Certificate";
      document.getElementById("recordId").value = "";
      recordForm.reset();
      document.getElementById("recCountry").value = "Pakistan";
      document.getElementById("recDocCategory").value = "Personal Document";
      document.getElementById("recSignedBy").value = "N/A";
      document.getElementById("recCapacity").value = "Registrar";
      document.getElementById("recSealOf").value = "Preston University";
      document.getElementById("recIssuePlace").value = "Lahore Pakistan";
      document.getElementById("recAuthority").value = "Ministry of Foreign Affairs";
      document.getElementById("recSignatoryOfficer").value = "Ali Faraz";
      document.getElementById("recDocType").value = "Other Documents";
      document.getElementById("recIssueDate").value = new Date().toISOString().split("T")[0];
      document.getElementById("recPdfFileName").value = "wLb2mwU18B98yhP5HgPkdE365DWUOhgJCl0djEsH.pdf";
      document.getElementById("recPdfUrl").value = "/uploads/wLb2mwU18B98yhP5HgPkdE365DWUOhgJCl0djEsH.pdf";
      recordModal.classList.add("active");
    });
  }

  // Handle PDF Upload in Record Modal
  const recPdfFileInput = document.getElementById("recPdfFileInput");
  if (recPdfFileInput) {
    recPdfFileInput.addEventListener("change", async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      if (!file.name.toLowerCase().endsWith('.pdf')) {
        showToast("Please select a PDF document.", "error");
        return;
      }
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          showToast("Uploading document PDF...", "info");
          const res = await apiFetch('/api/admin/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fileName: file.name,
              fileData: reader.result
            })
          });
          const data = await res.json();
          if (res.ok && data.success) {
            document.getElementById("recPdfFileName").value = file.name;
            document.getElementById("recPdfUrl").value = data.fileUrl;
            showToast("Document PDF uploaded successfully.", "success");
          } else {
            showToast(data.message || "Failed to upload PDF.", "error");
          }
        } catch {
          showToast("Network error uploading PDF.", "error");
        }
      };
      reader.readAsDataURL(file);
    });
  }

  if (recordForm) {
    recordForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const recId = document.getElementById("recordId").value;
      const payload = {
        docNumber: document.getElementById("recDocNumber").value.trim(),
        applicantName: document.getElementById("recApplicant").value.trim(),
        documentCategory: document.getElementById("recDocCategory").value.trim(),
        country: document.getElementById("recCountry").value.trim(),
        signedBy: document.getElementById("recSignedBy").value.trim(),
        capacity: document.getElementById("recCapacity").value.trim(),
        sealOf: document.getElementById("recSealOf").value.trim(),
        issuePlace: document.getElementById("recIssuePlace").value.trim(),
        issueDate: document.getElementById("recIssueDate").value,
        expiryDate: document.getElementById("recExpiryDate").value,
        issuingAuthority: document.getElementById("recAuthority").value.trim(),
        signatoryOfficer: document.getElementById("recSignatoryOfficer").value.trim(),
        documentType: document.getElementById("recDocType").value.trim(),
        status: document.getElementById("recStatus").value,
        pdfFileName: document.getElementById("recPdfFileName").value.trim(),
        pdfUrl: document.getElementById("recPdfUrl").value.trim(),
        notes: document.getElementById("recNotes").value.trim()
      };

      try {
        let res;
        if (recId) {
          res = await apiFetch(`/api/admin/records/${recId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
        } else {
          res = await apiFetch('/api/admin/records', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
        }

        const data = await res.json();
        if (res.ok && data.success) {
          recordModal.classList.remove("active");
          showToast(recId ? "Document updated." : "Document registered.", "success");
          await loadRecords();
        } else {
          showToast(data.message || "Failed to save document.", "error");
        }
      } catch {
        showToast("Network error saving document.", "error");
      }
    });
  }

  // =========================================================================
  // 8. THEME & COLOR PICKER CONTROLS
  // =========================================================================
  function syncColor(textInputId, initialVal) {
    const textEl = document.getElementById(textInputId);
    const pickerEl = document.getElementById(`${textInputId}Picker`);
    if (textEl && pickerEl) {
      textEl.value = initialVal;
      pickerEl.value = initialVal.length === 7 ? initialVal : "#01411c";

      pickerEl.addEventListener("input", () => { textEl.value = pickerEl.value; });
      textEl.addEventListener("input", () => {
        if (/^#[0-9A-Fa-f]{6}$/.test(textEl.value)) {
          pickerEl.value = textEl.value;
        }
      });
    }
  }

  const btnResetTheme = document.getElementById("btnResetThemeDefaults");
  if (btnResetTheme) {
    btnResetTheme.addEventListener("click", () => {
      syncColor("cfgColorPrimary", "#01411c");
      syncColor("cfgColorDark", "#003316");
      syncColor("cfgColorFooter", "#1e2225");
      syncColor("cfgColorBg", "#f8f9fb");
      showToast("Colors reset to default green palette.", "success");
    });
  }

  // =========================================================================
  // 9. ADMIN SECURITY & PASSWORD
  // =========================================================================
  const passwordChangeForm = document.getElementById("passwordChangeForm");
  if (passwordChangeForm) {
    passwordChangeForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const currentPassword = document.getElementById("currentPassword").value;
      const newPassword = document.getElementById("newPassword").value;
      const confirmPassword = document.getElementById("confirmPassword").value;

      if (newPassword !== confirmPassword) {
        alert("New passwords do not match.");
        return;
      }

      try {
        const res = await apiFetch('/api/admin/change-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ currentPassword, newPassword })
        });
        const data = await res.json();
        if (res.ok && data.success) {
          showToast("Password updated successfully.", "success");
          passwordChangeForm.reset();
        } else {
          showToast(data.message || "Failed to update password.", "error");
        }
      } catch {
        showToast("Error updating password.", "error");
      }
    });
  }

  // =========================================================================
  // 10. ADMIN PANEL SIDEBAR MANAGER (Dedicated Admin Navigation System)
  // =========================================================================
  let adminNavData = { items: [] };
  const adminSidebarNav = document.getElementById("adminSidebarNav");
  const adminNavTableBody = document.getElementById("adminNavTableBody");
  const btnAddAdminNavItem = document.getElementById("btnAddAdminNavItem");
  const btnResetAdminNav = document.getElementById("btnResetAdminNav");
  const adminNavModal = document.getElementById("adminNavModal");
  const adminNavForm = document.getElementById("adminNavForm");
  const adminNavModalTitle = document.getElementById("adminNavModalTitle");
  const adminNavIndex = document.getElementById("adminNavIndex");
  const adminNavId = document.getElementById("adminNavId");
  const adminNavType = document.getElementById("adminNavType");
  const adminNavLabel = document.getElementById("adminNavLabel");
  const adminNavGroup = document.getElementById("adminNavGroup");
  const adminNavUrl = document.getElementById("adminNavUrl");
  const adminNavUrlContainer = document.getElementById("adminNavUrlContainer");
  const adminNavTarget = document.getElementById("adminNavTarget");
  const adminNavTargetContainer = document.getElementById("adminNavTargetContainer");
  const adminNavEnabled = document.getElementById("adminNavEnabled");

  async function loadAdminSidebarNav() {
    try {
      const res = await apiFetch('/api/admin/sidebar');
      if (res.ok) {
        adminNavData = await res.json();
        renderAdminSidebar();
        renderAdminNavTable();
      }
    } catch (err) {
      console.error('Failed to load admin sidebar navigation:', err);
    }
  }

  function renderAdminSidebar() {
    if (!adminSidebarNav) return;
    adminSidebarNav.innerHTML = "";

    const activeItems = (adminNavData.items || []).filter(item => item.enabled !== false);
    let lastGroup = null;

    activeItems.forEach(item => {
      // Group header
      if (item.group && item.group.trim() !== "" && item.group !== lastGroup) {
        const groupEl = document.createElement("li");
        groupEl.className = "sidebar-group-heading";
        groupEl.textContent = item.group;
        adminSidebarNav.appendChild(groupEl);
        lastGroup = item.group;
      }

      const li = document.createElement("li");
      if (item.type === 'custom_link') {
        const link = document.createElement("a");
        link.className = "nav-tab-btn";
        link.href = item.url;
        link.target = item.target || "_self";
        link.textContent = `${item.label} ↗`;
        li.appendChild(link);
      } else {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "nav-tab-btn";
        btn.setAttribute("data-tab", item.targetTab);
        btn.textContent = item.label;
        if (item.targetTab === currentActiveTab) {
          btn.classList.add("active");
        }
        btn.addEventListener("click", () => {
          switchTab(item.targetTab);
        });
        li.appendChild(btn);
      }
      adminSidebarNav.appendChild(li);
    });
  }

  function renderAdminNavTable() {
    if (!adminNavTableBody) return;
    adminNavTableBody.innerHTML = "";

    const items = adminNavData.items || [];
    items.forEach((item, index) => {
      const row = document.createElement("tr");
      const isCustom = item.type === 'custom_link';
      const targetDisplay = isCustom ? escapeHtml(item.url) : `Pane: ${escapeHtml(item.targetTab)}`;
      const typeBadge = isCustom 
        ? `<span style="font-size: 0.75rem; background: #e0e7ff; color: #3730a3; padding: 2px 8px; border-radius: 4px; font-weight: 600;">Custom Link</span>`
        : `<span style="font-size: 0.75rem; background: #f3f4f6; color: #374151; padding: 2px 8px; border-radius: 4px; font-weight: 600;">Built-in Tab</span>`;

      row.innerHTML = `
        <td style="font-weight: 600; color: #6b7280;">#${index + 1}</td>
        <td style="color: #6b7280; font-size: 0.85rem;">${escapeHtml(item.group || '—')}</td>
        <td style="font-weight: 600; color: #111827;">${escapeHtml(item.label)}</td>
        <td>${typeBadge}</td>
        <td style="font-family: monospace; font-size: 0.82rem; color: #065f46;">${targetDisplay}</td>
        <td>
          <label style="cursor: pointer;">
            <input type="checkbox" class="admin-nav-toggle-visible" data-index="${index}" ${item.enabled !== false ? 'checked' : ''}>
          </label>
        </td>
        <td style="text-align: right; white-space: nowrap;">
          <button type="button" class="btn-secondary btn-admin-nav-up" data-index="${index}" style="padding: 4px 8px;" title="Move Up" ${index === 0 ? 'disabled' : ''}>▲</button>
          <button type="button" class="btn-secondary btn-admin-nav-down" data-index="${index}" style="padding: 4px 8px;" title="Move Down" ${index === items.length - 1 ? 'disabled' : ''}>▼</button>
          <button type="button" class="btn-secondary btn-admin-nav-edit" data-index="${index}" style="padding: 4px 8px;">Edit</button>
          ${isCustom 
            ? `<button type="button" class="btn-danger btn-admin-nav-del" data-index="${index}" style="padding: 4px 8px;">✕</button>`
            : `<button type="button" class="btn-secondary" style="padding: 4px 8px; opacity: 0.5; cursor: not-allowed;" title="Built-in tabs cannot be deleted, only hidden" disabled>🔒</button>`
          }
        </td>
      `;
      adminNavTableBody.appendChild(row);
    });

    // Event listeners
    adminNavTableBody.querySelectorAll(".admin-nav-toggle-visible").forEach(cb => {
      cb.addEventListener("change", async (e) => {
        const idx = parseInt(e.target.dataset.index, 10);
        adminNavData.items[idx].enabled = e.target.checked;
        await saveAdminSidebarNav();
        renderAdminSidebar();
        showToast(`Tab "${adminNavData.items[idx].label}" visibility updated.`);
      });
    });

    adminNavTableBody.querySelectorAll(".btn-admin-nav-up").forEach(btn => {
      btn.addEventListener("click", async () => {
        const idx = parseInt(btn.dataset.index, 10);
        if (idx > 0) {
          const temp = adminNavData.items[idx];
          adminNavData.items[idx] = adminNavData.items[idx - 1];
          adminNavData.items[idx - 1] = temp;
          await saveAdminSidebarNav();
          renderAdminSidebar();
          renderAdminNavTable();
        }
      });
    });

    adminNavTableBody.querySelectorAll(".btn-admin-nav-down").forEach(btn => {
      btn.addEventListener("click", async () => {
        const idx = parseInt(btn.dataset.index, 10);
        if (idx < adminNavData.items.length - 1) {
          const temp = adminNavData.items[idx];
          adminNavData.items[idx] = adminNavData.items[idx + 1];
          adminNavData.items[idx + 1] = temp;
          await saveAdminSidebarNav();
          renderAdminSidebar();
          renderAdminNavTable();
        }
      });
    });

    adminNavTableBody.querySelectorAll(".btn-admin-nav-edit").forEach(btn => {
      btn.addEventListener("click", () => {
        const idx = parseInt(btn.dataset.index, 10);
        const item = adminNavData.items[idx];
        adminNavModalTitle.textContent = item.type === 'custom_link' ? "Edit Custom Sidebar Link" : "Edit Admin Tab";
        adminNavIndex.value = idx;
        adminNavId.value = item.id;
        adminNavType.value = item.type;
        adminNavLabel.value = item.label;
        adminNavGroup.value = item.group || "";
        adminNavEnabled.checked = item.enabled !== false;

        if (item.type === 'custom_link') {
          adminNavUrlContainer.style.display = "block";
          adminNavTargetContainer.style.display = "block";
          adminNavUrl.value = item.url || "";
          adminNavTarget.value = item.target || "_self";
          adminNavUrl.required = true;
        } else {
          adminNavUrlContainer.style.display = "none";
          adminNavTargetContainer.style.display = "none";
          adminNavUrl.required = false;
        }

        adminNavModal.classList.add("active");
      });
    });

    adminNavTableBody.querySelectorAll(".btn-admin-nav-del").forEach(btn => {
      btn.addEventListener("click", async () => {
        const idx = parseInt(btn.dataset.index, 10);
        const item = adminNavData.items[idx];
        if (confirm(`Remove custom sidebar link "${item.label}"?`)) {
          adminNavData.items.splice(idx, 1);
          await saveAdminSidebarNav();
          renderAdminSidebar();
          renderAdminNavTable();
          showToast("Custom link removed.");
        }
      });
    });
  }

  async function saveAdminSidebarNav() {
    try {
      const res = await apiFetch('/api/admin/sidebar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(adminNavData)
      });
      return res.ok;
    } catch (err) {
      showToast("Error saving admin sidebar settings.", "error");
      return false;
    }
  }

  if (btnAddAdminNavItem) {
    btnAddAdminNavItem.addEventListener("click", () => {
      adminNavModalTitle.textContent = "Add Custom Sidebar Link";
      adminNavIndex.value = "";
      adminNavId.value = `custom-nav-${Date.now()}`;
      adminNavType.value = "custom_link";
      adminNavForm.reset();
      adminNavUrlContainer.style.display = "block";
      adminNavTargetContainer.style.display = "block";
      adminNavUrl.required = true;
      adminNavEnabled.checked = true;
      adminNavModal.classList.add("active");
    });
  }

  if (btnResetAdminNav) {
    btnResetAdminNav.addEventListener("click", async () => {
      if (!confirm("Are you sure you want to restore all default admin tabs and groups? Any custom tabs/order will be reset.")) return;
      try {
        const res = await apiFetch('/api/admin/sidebar/reset', { method: 'POST' });
        if (res.ok) {
          const data = await res.json();
          adminNavData = data.data || { items: [] };
          renderAdminSidebar();
          renderAdminNavTable();
          showToast("Default admin sidebar restored successfully.");
        }
      } catch {
        showToast("Error restoring default sidebar.", "error");
      }
    });
  }

  if (adminNavForm) {
    adminNavForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const idxStr = adminNavIndex.value;
      const isCustom = adminNavType.value === 'custom_link';

      const itemData = {
        label: adminNavLabel.value.trim(),
        group: adminNavGroup.value.trim(),
        enabled: adminNavEnabled.checked
      };

      if (isCustom) {
        itemData.type = "custom_link";
        itemData.url = adminNavUrl.value.trim();
        itemData.target = adminNavTarget.value;
      }

      if (idxStr !== "") {
        const idx = parseInt(idxStr, 10);
        adminNavData.items[idx] = {
          ...adminNavData.items[idx],
          ...itemData
        };
      } else {
        adminNavData.items.push({
          id: adminNavId.value || `custom-nav-${Date.now()}`,
          ...itemData
        });
      }

      const ok = await saveAdminSidebarNav();
      if (ok) {
        adminNavModal.classList.remove("active");
        renderAdminSidebar();
        renderAdminNavTable();
        showToast("Admin sidebar updated.");
      }
    });
  }

  // Modal close handlers
  document.querySelectorAll("[data-close-modal]").forEach(btn => {
    btn.addEventListener("click", () => {
      const modalId = btn.getAttribute("data-close-modal");
      const modal = document.getElementById(modalId);
      if (modal) modal.classList.remove("active");
    });
  });

  // Helpers
  function showToast(message, type = "success") {
    const container = document.getElementById("toastContainer");
    if (!container) return;
    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<span>${type === 'success' ? '✓' : '⚠'}</span> <span>${escapeHtml(message)}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(50px)';
      setTimeout(() => toast.remove(), 250);
    }, 3500);
  }

  function escapeHtml(str) {
    if (!str) return "";
    return String(str).replace(/[&<>"']/g, m => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[m]);
  }

  function adjustColorBrightness(hex, percent) {
    let num = parseInt(hex.replace("#", ""), 16),
      amt = Math.round(2.55 * percent),
      R = (num >> 16) + amt,
      G = (num >> 8 & 0x00FF) + amt,
      B = (num & 0x0000FF) + amt;
    return "#" + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
      (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
      (B < 255 ? B < 1 ? 0 : B : 255)).toString(16).slice(1);
  }

  function debounce(func, wait) {
    let timeout;
    return function (...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  }

  // Check auth on load
  checkAuth();
});
