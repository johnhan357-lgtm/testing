/**
 * Admin Panel & Visual CMS Client Controller
 * Manages authentication, live CMS drafts, publishing workflow, custom links, and document registry.
 */

document.addEventListener("DOMContentLoaded", () => {
  let authToken = sessionStorage.getItem("admin_token") || null;
  let draftConfig = null;
  let cachedRecords = [];

  // =========================================================================
  // TYPOGRAPHY & FONT CHANGER ENGINE
  // =========================================================================
  const FONT_MAP = {
    "Plus Jakarta Sans": "'Plus Jakarta Sans', sans-serif",
    "Times": "'Times New Roman', Times, serif",
    "Poppins": "'Poppins', sans-serif",
    "Fair": "'Playfair Display', 'Fair', Georgia, serif",
    "Helvetica": "'Helvetica Neue', Helvetica, Arial, sans-serif"
  };

  const AVAILABLE_FONTS = [
    { id: "Plus Jakarta Sans", name: "Plus Jakarta Sans", css: "'Plus Jakarta Sans', sans-serif" },
    { id: "Times", name: "Times", css: "'Times New Roman', Times, serif" },
    { id: "Poppins", name: "Poppins", css: "'Poppins', sans-serif" },
    { id: "Fair", name: "Fair", css: "'Playfair Display', serif" },
    { id: "Helvetica", name: "Helvetica", css: "'Helvetica Neue', Helvetica, Arial, sans-serif" }
  ];

  function setupFieldFontSelectors() {
    const targetInputs = document.querySelectorAll(
      '.tab-pane input[type="text"]:not([readonly]), .tab-pane input[type="email"], .tab-pane textarea, #recordModal input[type="text"]:not([readonly])'
    );

    targetInputs.forEach(input => {
      if (input.type === "color" || input.type === "file") return;
      if (input.readOnly && !input.id.startsWith("cfg")) return;
      if (input.id === "cfgColorPrimary" || input.id === "cfgColorDark" || input.id === "cfgColorFooter" || input.id === "cfgColorBg") return;
      if (input.id === "cfgFooterLogoUrl" || input.id === "cfgCertSignatureUrl" || input.id === "qgSignatureUrl" || input.id === "recSignatureUrl" || input.id === "cfgNoticeLogoUrl") return;

      const parentField = input.closest('.form-field');
      if (!parentField) return;

      // Check if already created
      if (parentField.querySelector('.field-font-picker')) return;

      const label = parentField.querySelector('label.form-label') || parentField.querySelector('label');
      if (!label) return;

      const headerRow = document.createElement('div');
      headerRow.className = 'field-font-header-row';
      headerRow.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; flex-wrap: wrap; gap: 6px;';

      label.style.marginBottom = '0';
      label.parentNode.insertBefore(headerRow, label);
      headerRow.appendChild(label);

      const fontPill = document.createElement('div');
      fontPill.className = 'font-picker-pill';
      fontPill.style.cssText = 'display: inline-flex; align-items: center; gap: 4px; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 4px; padding: 2px 7px;';

      const fontPillLabel = document.createElement('span');
      fontPillLabel.textContent = 'Font:';
      fontPillLabel.style.cssText = 'color: #64748b; font-weight: 700; text-transform: uppercase; font-size: 0.68rem;';
      fontPill.appendChild(fontPillLabel);

      const select = document.createElement('select');
      select.className = 'field-font-picker';
      select.dataset.fieldId = input.id;
      select.style.cssText = 'font-size: 0.78rem; border: none; background: transparent; color: #1e293b; font-weight: 600; cursor: pointer; outline: none; padding: 1px 2px;';

      const defaultOpt = document.createElement('option');
      defaultOpt.value = '';
      defaultOpt.textContent = 'Default Font';
      select.appendChild(defaultOpt);

      AVAILABLE_FONTS.forEach(f => {
        const opt = document.createElement('option');
        opt.value = f.id;
        opt.textContent = f.name;
        opt.style.fontFamily = f.css;
        select.appendChild(opt);
      });

      // Update editable bar font immediately on change
      select.addEventListener('change', () => {
        const chosen = select.value;
        if (chosen && FONT_MAP[chosen]) {
          input.style.fontFamily = FONT_MAP[chosen];
        } else {
          input.style.fontFamily = '';
        }
      });

      fontPill.appendChild(select);
      headerRow.appendChild(fontPill);
    });
  }

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
    if (!draftConfig) {
      initDashboard();
    }
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

  // Wrapper for authenticated fetch with automatic 401 handling
  async function apiFetch(url, options = {}) {
    options.headers = options.headers || {};
    if (authToken) {
      options.headers['Authorization'] = `Bearer ${authToken}`;
    }
    const res = await fetch(url, options);
    if (res.status === 401 && !url.includes('/api/admin/login') && !url.includes('/api/admin/me')) {
      authToken = null;
      sessionStorage.removeItem("admin_token");
      if (loginOverlay) loginOverlay.style.display = "flex";
      if (loginAlert) {
        loginAlert.textContent = "Your session expired or was reset. Please log in to authorize and save your changes.";
        loginAlert.style.display = "block";
      }
    }
    return res;
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

    setupFieldFontSelectors();

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

    setupFieldFontSelectors();

    // Tab 2: Branding
    if (cfg.branding) {
      document.getElementById("cfgAuthorityName").value = cfg.branding.authorityName || "";
      document.getElementById("cfgAuthoritySubtitle").value = cfg.branding.authoritySubtitle || "";

      // Logo Click Destination URL & Target
      const logoLinkUrl = cfg.branding.logoLinkUrl || "https://apostille.mofa.gov.pk/";
      const logoLinkTarget = cfg.branding.logoLinkTarget || "_self";
      const cfgLogoLinkUrlEl = document.getElementById("cfgLogoLinkUrl");
      if (cfgLogoLinkUrlEl) cfgLogoLinkUrlEl.value = logoLinkUrl;
      const cfgLogoLinkTargetEl = document.getElementById("cfgLogoLinkTarget");
      if (cfgLogoLinkTargetEl) cfgLogoLinkTargetEl.value = logoLinkTarget;

      const tabNavLogoLinkDisplayEl = document.getElementById("tabNavLogoLinkDisplay");
      if (tabNavLogoLinkDisplayEl) tabNavLogoLinkDisplayEl.textContent = logoLinkUrl;

      // Direct Logo Image URL & Upload
      const logoUrl = cfg.branding.logoUrl || "/uploads/logo_1792329381447.svg";
      const cfgLogoUrlEl = document.getElementById("cfgLogoUrl");
      if (cfgLogoUrlEl) cfgLogoUrlEl.value = logoUrl;

      if (cfg.branding.logoType === 'custom_image' || logoUrl) {
        document.getElementById("radioLogoCustom").checked = true;
      } else {
        document.getElementById("radioLogoDefault").checked = true;
      }
      handleLogoRadioToggle();

      const logoImg = document.getElementById("logoPreviewImg");
      const logoText = document.getElementById("logoStatusText");
      if (logoUrl) {
        logoImg.src = logoUrl;
        logoImg.style.display = "block";
        logoText.textContent = "Custom logo active: " + logoUrl;
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
      const helpVal = (cfg.verificationCard.helpText !== undefined && cfg.verificationCard.helpText !== null)
        ? cfg.verificationCard.helpText
        : (cfg.verificationCard.supportEmail ? `If you need further help email ${cfg.verificationCard.supportEmail} with the certificate number and date` : "");
      const helpInput = document.getElementById("cfgHelpText");
      if (helpInput) helpInput.value = helpVal;
    }

    // Tab 6: Notice Modal
    if (cfg.noticeModal) {
      document.getElementById("cfgNoticeEnabled").checked = cfg.noticeModal.enabled !== false;
      const alwaysShowEl = document.getElementById("cfgNoticeAlwaysShow");
      if (alwaysShowEl) alwaysShowEl.checked = cfg.noticeModal.alwaysShowOnRefresh !== false;
      const showDirectEl = document.getElementById("cfgNoticeShowOnDirectVerify");
      if (showDirectEl) showDirectEl.checked = cfg.noticeModal.showOnDirectVerify === true;

      const portalTitleEl = document.getElementById("cfgNoticePortalTitle");
      if (portalTitleEl) portalTitleEl.value = cfg.noticeModal.portalTitle || "";
      const portalSubEl = document.getElementById("cfgNoticePortalSub");
      if (portalSubEl) portalSubEl.value = cfg.noticeModal.portalSub || "";

      document.getElementById("cfgNoticeTitle").value = cfg.noticeModal.title || "";
      document.getElementById("cfgNoticeBodyEn").value = cfg.noticeModal.bodyEnglish || "";
      document.getElementById("cfgNoticeBodyReg").value = cfg.noticeModal.bodyRegional || "";
      document.getElementById("cfgNoticeBtnText").value = cfg.noticeModal.confirmButtonText || "";

      // Notice Logo / Emblem
      const noticeLogoType = cfg.noticeModal.logoType || "default_svg";
      const radNoticeDef = document.getElementById("radioNoticeLogoDefault");
      const radNoticeBrand = document.getElementById("radioNoticeLogoBrand");
      const radNoticeCust = document.getElementById("radioNoticeLogoCustom");
      if (noticeLogoType === "custom_image" && radNoticeCust) radNoticeCust.checked = true;
      else if (noticeLogoType === "use_brand_logo" && radNoticeBrand) radNoticeBrand.checked = true;
      else if (radNoticeDef) radNoticeDef.checked = true;

      const noticeLogoUrlInput = document.getElementById("cfgNoticeLogoUrl");
      if (noticeLogoUrlInput) noticeLogoUrlInput.value = cfg.noticeModal.logoUrl || "";
      const noticeLogoPrev = document.getElementById("noticeLogoPreview");
      if (noticeLogoPrev) noticeLogoPrev.src = cfg.noticeModal.logoUrl || "";

      handleNoticeLogoRadioToggle();
      updateNoticeLivePreview();
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
      if (document.getElementById("cfgFooterAuthorityName")) {
        document.getElementById("cfgFooterAuthorityName").value = cfg.footer.authorityName || "";
      }
      if (document.getElementById("cfgFooterAuthoritySubtitle")) {
        document.getElementById("cfgFooterAuthoritySubtitle").value = cfg.footer.authoritySubtitle || "";
      }
      document.getElementById("cfgFooterCopyright").value = cfg.footer.copyrightText || "";

      // Footer Logo
      const footerLogoType = cfg.footer.logoType || "default_svg";
      const radFooterDef = document.getElementById("radioFooterLogoDefault");
      const radFooterCust = document.getElementById("radioFooterLogoCustom");
      if (footerLogoType === "custom_image") {
        if (radFooterCust) radFooterCust.checked = true;
      } else {
        if (radFooterDef) radFooterDef.checked = true;
      }
      handleFooterLogoRadioToggle();

      const footerLogoUrlInput = document.getElementById("cfgFooterLogoUrl");
      const footerLogoPrevImg = document.getElementById("footerLogoPreviewImg");
      const footerLogoStatusText = document.getElementById("footerLogoStatusText");
      if (cfg.footer.logoUrl) {
        if (footerLogoUrlInput) footerLogoUrlInput.value = cfg.footer.logoUrl;
        if (footerLogoPrevImg) {
          footerLogoPrevImg.src = cfg.footer.logoUrl;
          footerLogoPrevImg.style.display = "block";
        }
        if (footerLogoStatusText) footerLogoStatusText.textContent = `Current Logo: ${cfg.footer.logoUrl}`;
      } else {
        if (footerLogoUrlInput) footerLogoUrlInput.value = "";
        if (footerLogoPrevImg) footerLogoPrevImg.style.display = "none";
        if (footerLogoStatusText) footerLogoStatusText.textContent = "No custom footer logo uploaded yet.";
      }

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
      const elStatusText = document.getElementById("cfgCertStatusText");
      if (elStatusText) elStatusText.value = cv.statusBadgeText || "Document Certificate Verified";
      if (elBreadcrumb) elBreadcrumb.value = cv.breadcrumbText || "Home / Apostille verification";
      if (elIssuer) elIssuer.value = cv.issuerStatement || "This apostille certificate is issued by Ministry of Foreign Affairs Pakistan.";
      if (elSummary) elSummary.value = cv.summaryTemplate || "This apostille refers to {category} and issued on {date} and is Approved by {authority}";
      if (elWatermark) elWatermark.value = cv.watermarkText || "GOVTOFPAKISTAN";
      if (elConvTitle) elConvTitle.value = cv.conventionTitle || "APOSTILLE";
      if (elConvSub) elConvSub.value = cv.conventionSubtitle || "(Convention de La Haye du 5 October 1961)";
      if (elCountry) elCountry.value = cv.defaultCountry || "Pakistan";
      if (elSignatory) elSignatory.value = cv.defaultSignatory || "Ali Faraz";
      const elCertSigUrl = document.getElementById("cfgCertSignatureUrl");
      const elCertSigPrev = document.getElementById("cfgCertSigPreview");
      const sigVal = cv.signatureUrl || "/uploads/signature_ali_faraz_clean.png";
      if (elCertSigUrl) elCertSigUrl.value = sigVal;
      if (elCertSigPrev) elCertSigPrev.src = sigVal;
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
      const gFontEl = document.getElementById("cfgGlobalFont");
      if (gFontEl) gFontEl.value = cfg.theme.globalFont || "";
    }

    // Populate Field Fonts
    if (cfg.fieldFonts && typeof cfg.fieldFonts === 'object') {
      Object.keys(cfg.fieldFonts).forEach(fieldId => {
        const picker = document.querySelector(`.field-font-picker[data-field-id="${fieldId}"]`);
        const targetInput = document.getElementById(fieldId);
        const fontName = cfg.fieldFonts[fieldId];
        if (picker && fontName) {
          picker.value = fontName;
          if (targetInput && FONT_MAP[fontName]) {
            targetInput.style.fontFamily = FONT_MAP[fontName];
          }
        }
      });
    }
  }

  function gatherConfigFromForm() {
    const updated = JSON.parse(JSON.stringify(draftConfig || {}));

    // Branding
    updated.branding = updated.branding || {};
    updated.branding.authorityName = document.getElementById("cfgAuthorityName").value.trim();
    updated.branding.authoritySubtitle = document.getElementById("cfgAuthoritySubtitle").value.trim();
    updated.branding.logoType = document.querySelector('input[name="logoTypeRadio"]:checked')?.value || "default_svg";
    updated.branding.logoUrl = (document.getElementById("cfgLogoUrl")?.value || "").trim() || updated.branding.logoUrl || "/uploads/logo_1792329381447.svg";
    updated.branding.logoLinkUrl = (document.getElementById("cfgLogoLinkUrl")?.value || "").trim() || "https://apostille.mofa.gov.pk/";
    updated.branding.logoLinkTarget = document.getElementById("cfgLogoLinkTarget")?.value || "_self";
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
    const cfgHelpInput = document.getElementById("cfgHelpText");
    const supportEmailVal = document.getElementById("cfgSupportEmail").value.trim();
    let customHelpVal = cfgHelpInput ? cfgHelpInput.value.trim() : "";
    if (!customHelpVal && supportEmailVal) {
      customHelpVal = `If you need further help email ${supportEmailVal} with the certificate number and date`;
    }

    updated.verificationCard = {
      heading: document.getElementById("cfgCardHeading").value.trim(),
      docNumberLabel: document.getElementById("cfgDocLabel").value.trim(),
      docNumberPlaceholder: document.getElementById("cfgDocPlaceholder").value.trim(),
      docDateLabel: document.getElementById("cfgDateLabel").value.trim(),
      verifyButtonText: document.getElementById("cfgVerifyBtnText").value.trim(),
      clearButtonText: document.getElementById("cfgClearBtnText").value.trim(),
      supportEmail: supportEmailVal,
      helpText: customHelpVal
    };

    // Apostille Certificate View
    const elPageTitle = document.getElementById("cfgCertPageTitle");
    if (elPageTitle) {
      updated.certificateView = {
        pageTitle: elPageTitle.value.trim() || "QR Code Verification Apostille Certificate",
        statusBadgeText: (document.getElementById("cfgCertStatusText")?.value || "").trim() || "Document Certificate Verified",
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
        signatureUrl: (document.getElementById("cfgCertSignatureUrl")?.value || "").trim() || "/uploads/signature_ali_faraz_clean.png",
        disclaimerText: (document.getElementById("cfgCertDisclaimer")?.value || "").trim(),
        verificationUrlText: (document.getElementById("cfgCertVerifyUrl")?.value || "").trim(),
        enablePdfViewer: document.getElementById("cfgCertEnablePdf") ? document.getElementById("cfgCertEnablePdf").checked : true,
        defaultPdfFileName: updated.certificateView?.defaultPdfFileName || "wLb2mwU18B98yhP5HgPkdE365DWUOhgJCl0djEsH.pdf",
        defaultPdfUrl: updated.certificateView?.defaultPdfUrl || "/uploads/wLb2mwU18B98yhP5HgPkdE365DWUOhgJCl0djEsH.pdf"
      };
    }

    // Notice Modal
    const radNoticeBrand = document.getElementById("radioNoticeLogoBrand");
    const radNoticeCust = document.getElementById("radioNoticeLogoCustom");
    let noticeLogoType = "default_svg";
    if (radNoticeCust && radNoticeCust.checked) noticeLogoType = "custom_image";
    else if (radNoticeBrand && radNoticeBrand.checked) noticeLogoType = "use_brand_logo";

    let noticeLogoUrl = (document.getElementById("cfgNoticeLogoUrl")?.value || "").trim();
    if (radNoticeCust && radNoticeCust.checked && !noticeLogoUrl) {
      noticeLogoUrl = updated.branding?.logoUrl || "/uploads/logo_1792329381447.svg";
    }

    updated.noticeModal = {
      enabled: document.getElementById("cfgNoticeEnabled").checked,
      alwaysShowOnRefresh: document.getElementById("cfgNoticeAlwaysShow") ? document.getElementById("cfgNoticeAlwaysShow").checked : true,
      showOnDirectVerify: document.getElementById("cfgNoticeShowOnDirectVerify") ? document.getElementById("cfgNoticeShowOnDirectVerify").checked : false,
      portalTitle: (document.getElementById("cfgNoticePortalTitle")?.value || "").trim() || "Ministry of Foreign Affairs",
      portalSub: (document.getElementById("cfgNoticePortalSub")?.value || "").trim() || "Government of Pakistan",
      logoType: noticeLogoType,
      logoUrl: noticeLogoUrl,
      title: document.getElementById("cfgNoticeTitle").value.trim() || "IMPORTANT NOTICE",
      bodyEnglish: document.getElementById("cfgNoticeBodyEn").value.trim(),
      bodyRegional: document.getElementById("cfgNoticeBodyReg").value.trim(),
      confirmButtonText: document.getElementById("cfgNoticeBtnText").value.trim() || "Acknowledge & Proceed"
    };

    // Floating Action & Footer
    updated.floatingFeedback = {
      enabled: document.getElementById("cfgFeedbackEnabled").checked,
      label: document.getElementById("cfgFeedbackLabel").value.trim(),
      actionType: document.getElementById("cfgFeedbackAction").value,
      customUrl: document.getElementById("cfgFeedbackUrl").value.trim()
    };

    updated.footer = updated.footer || {};
    if (document.getElementById("cfgFooterAuthorityName")) {
      updated.footer.authorityName = document.getElementById("cfgFooterAuthorityName").value.trim();
    }
    if (document.getElementById("cfgFooterAuthoritySubtitle")) {
      updated.footer.authoritySubtitle = document.getElementById("cfgFooterAuthoritySubtitle").value.trim();
    }
    updated.footer.copyrightText = document.getElementById("cfgFooterCopyright").value.trim();
    updated.footer.logoType = document.querySelector('input[name="footerLogoTypeRadio"]:checked')?.value || "default_svg";
    updated.footer.logoUrl = (document.getElementById("cfgFooterLogoUrl")?.value || "").trim();

    // Theme
    updated.theme = {
      primaryGreen: document.getElementById("cfgColorPrimary").value.trim(),
      primaryGreenDark: document.getElementById("cfgColorDark").value.trim(),
      primaryGreenLight: adjustColorBrightness(document.getElementById("cfgColorPrimary").value.trim(), 20),
      footerDark: document.getElementById("cfgColorFooter").value.trim(),
      bgLight: document.getElementById("cfgColorBg").value.trim(),
      globalFont: document.getElementById("cfgGlobalFont") ? document.getElementById("cfgGlobalFont").value : ""
    };

    // Gather Field Fonts
    updated.fieldFonts = {};
    document.querySelectorAll('.field-font-picker').forEach(picker => {
      const fieldId = picker.dataset.fieldId;
      const fontVal = picker.value;
      if (fieldId && fontVal) {
        updated.fieldFonts[fieldId] = fontVal;
      }
    });

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

        // Trigger publish (passing draftConfig directly so serverless receives it without depending on disk)
        const res = await apiFetch('/api/admin/config/publish', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(draftConfig)
        });
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

            const logoUrlInput = document.getElementById("cfgLogoUrl");
            if (logoUrlInput) logoUrlInput.value = data.fileUrl;

            const logoImg = document.getElementById("logoPreviewImg");
            if (logoImg) {
              logoImg.src = data.fileUrl;
              logoImg.style.display = "block";
            }
            document.getElementById("logoStatusText").textContent = `Uploaded: ${data.fileName}`;
            if (typeof markDraftDirty === 'function') markDraftDirty();
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

  // Direct Logo URL Input Listener
  const cfgLogoUrlInput = document.getElementById("cfgLogoUrl");
  if (cfgLogoUrlInput) {
    cfgLogoUrlInput.addEventListener("input", (e) => {
      const val = e.target.value.trim();
      const logoImg = document.getElementById("logoPreviewImg");
      if (logoImg) {
        logoImg.src = val || "/uploads/logo_1792329381447.svg";
        logoImg.style.display = "block";
      }
      if (val) {
        const custRadio = document.getElementById("radioLogoCustom");
        if (custRadio) custRadio.checked = true;
        handleLogoRadioToggle();
      }
      if (typeof markDraftDirty === 'function') markDraftDirty();
    });
  }

  // Update Tab 3 indicator when cfgLogoLinkUrl is edited in Tab 2
  const cfgLogoLinkUrlInput = document.getElementById("cfgLogoLinkUrl");
  if (cfgLogoLinkUrlInput) {
    cfgLogoLinkUrlInput.addEventListener("input", (e) => {
      const val = e.target.value.trim();
      const tabNavDisplay = document.getElementById("tabNavLogoLinkDisplay");
      if (tabNavDisplay) tabNavDisplay.textContent = val || "https://apostille.mofa.gov.pk/";
      if (typeof markDraftDirty === 'function') markDraftDirty();
    });
  }

  const cfgLogoLinkTargetEl = document.getElementById("cfgLogoLinkTarget");
  if (cfgLogoLinkTargetEl) {
    cfgLogoLinkTargetEl.addEventListener("change", () => {
      if (typeof markDraftDirty === 'function') markDraftDirty();
    });
  }

  // Quick jump button from Tab 3 to Tab 2 Logo config
  const btnGoToLogoLinkConfig = document.getElementById("btnGoToLogoLinkConfig");
  if (btnGoToLogoLinkConfig) {
    btnGoToLogoLinkConfig.addEventListener("click", () => {
      const brandTabBtn = document.querySelector('[data-tab="tab-branding"]');
      if (brandTabBtn) brandTabBtn.click();
      const linkInput = document.getElementById("cfgLogoLinkUrl");
      if (linkInput) {
        linkInput.focus();
        linkInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
  }

  // Footer Logo Controls
  const footerLogoRadios = document.querySelectorAll('input[name="footerLogoTypeRadio"]');
  const customFooterLogoUploadSection = document.getElementById("customFooterLogoUploadSection");
  const footerLogoFileInput = document.getElementById("footerLogoFileInput");

  footerLogoRadios.forEach(r => r.addEventListener("change", handleFooterLogoRadioToggle));

  function handleFooterLogoRadioToggle() {
    const isCustom = document.getElementById("radioFooterLogoCustom")?.checked;
    if (customFooterLogoUploadSection) {
      customFooterLogoUploadSection.style.display = isCustom ? "block" : "none";
    }
  }

  if (footerLogoFileInput) {
    footerLogoFileInput.addEventListener("change", async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      if (file.size > 2 * 1024 * 1024) {
        alert("File size exceeds 2MB limit.");
        footerLogoFileInput.value = "";
        return;
      }

      const reader = new FileReader();
      reader.onload = async () => {
        try {
          showToast("Uploading footer logo...", "info");
          const res = await apiFetch('/api/admin/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fileData: reader.result, fileName: file.name, fileType: 'logo' })
          });
          const data = await res.json();
          if (res.ok && data.success) {
            const footerLogoUrlInput = document.getElementById("cfgFooterLogoUrl");
            if (footerLogoUrlInput) footerLogoUrlInput.value = data.fileUrl;
            const logoImg = document.getElementById("footerLogoPreviewImg");
            if (logoImg) {
              logoImg.src = data.fileUrl;
              logoImg.style.display = "block";
            }
            const statusText = document.getElementById("footerLogoStatusText");
            if (statusText) statusText.textContent = `Uploaded: ${data.fileName}`;
            showToast("Footer logo uploaded. Click 'Save Draft' or 'Publish' to persist.", "success");
            await checkPublishingStatus();
          } else {
            showToast(data.message || "Upload failed.", "error");
          }
        } catch {
          showToast("Network error uploading footer logo.", "error");
        }
      };
      reader.readAsDataURL(file);
    });
  }

  const cfgFooterLogoUrlInput = document.getElementById("cfgFooterLogoUrl");
  if (cfgFooterLogoUrlInput) {
    cfgFooterLogoUrlInput.addEventListener("input", (e) => {
      const val = e.target.value.trim();
      const logoImg = document.getElementById("footerLogoPreviewImg");
      if (logoImg) {
        if (val) {
          logoImg.src = val;
          logoImg.style.display = "block";
        } else {
          logoImg.style.display = "none";
        }
      }
    });
  }

  // Handle Support Email & Help Text sync
  const cfgSupportEmailEl = document.getElementById("cfgSupportEmail");
  const cfgHelpTextEl = document.getElementById("cfgHelpText");
  if (cfgSupportEmailEl && cfgHelpTextEl) {
    cfgSupportEmailEl.addEventListener("input", (e) => {
      const email = e.target.value.trim();
      const currentHelp = cfgHelpTextEl.value.trim();
      if (!currentHelp || currentHelp.startsWith("If you need further help email ")) {
        cfgHelpTextEl.value = email ? `If you need further help email ${email} with the certificate number and date` : "";
      }
    });
  }

  // Handle Certificate Settings Default Signature Upload
  const cfgCertSigFileInput = document.getElementById("cfgCertSigFileInput");
  if (cfgCertSigFileInput) {
    cfgCertSigFileInput.addEventListener("change", async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          showToast("Uploading default signature...", "info");
          const res = await apiFetch('/api/admin/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fileName: file.name,
              fileData: reader.result,
              fileType: 'signature'
            })
          });
          const data = await res.json();
          if (res.ok && data.success) {
            document.getElementById("cfgCertSignatureUrl").value = data.fileUrl;
            const prev = document.getElementById("cfgCertSigPreview");
            if (prev) prev.src = data.fileUrl;
            showToast("Default signature uploaded. Click 'Save Draft' or 'Publish' to persist.", "success");
            await checkPublishingStatus();
          } else {
            showToast(data.message || "Failed to upload signature.", "error");
          }
        } catch {
          showToast("Network error uploading signature.", "error");
        }
      };
      reader.readAsDataURL(file);
    });
  }

  const cfgCertSigUrlInput = document.getElementById("cfgCertSignatureUrl");
  if (cfgCertSigUrlInput) {
    cfgCertSigUrlInput.addEventListener("input", (e) => {
      const prev = document.getElementById("cfgCertSigPreview");
      if (prev && e.target.value.trim()) prev.src = e.target.value.trim();
    });
  }

  // =========================================================================
  // NOTICE MODAL LOGO, PREVIEW & TEST POPUP HANDLERS
  // =========================================================================
  const noticeLogoRadios = document.querySelectorAll('input[name="noticeLogoType"]');
  noticeLogoRadios.forEach(r => r.addEventListener("change", handleNoticeLogoRadioToggle));

  function handleNoticeLogoRadioToggle() {
    const isCustom = document.getElementById("radioNoticeLogoCustom")?.checked;
    const uploadRow = document.getElementById("noticeCustomLogoUploadRow");
    if (uploadRow) uploadRow.style.display = isCustom ? "flex" : "none";
    if (typeof markDraftDirty === 'function') markDraftDirty();
    updateNoticeLivePreview();
  }

  const noticeLogoFileInput = document.getElementById("noticeLogoFileInput");
  if (noticeLogoFileInput) {
    noticeLogoFileInput.addEventListener("change", async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      if (file.size > 2 * 1024 * 1024) {
        alert("File size exceeds 2MB limit.");
        noticeLogoFileInput.value = "";
        return;
      }
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          showToast("Uploading notice logo...", "info");
          const res = await apiFetch('/api/admin/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fileData: reader.result, fileName: file.name, fileType: 'logo' })
          });
          const data = await res.json();
          if (res.ok && data.success) {
            const urlInput = document.getElementById("cfgNoticeLogoUrl");
            if (urlInput) urlInput.value = data.fileUrl;
            const prev = document.getElementById("noticeLogoPreview");
            if (prev) prev.src = data.fileUrl;
            
            // Auto-select custom logo radio button
            const custRadio = document.getElementById("radioNoticeLogoCustom");
            if (custRadio) custRadio.checked = true;
            handleNoticeLogoRadioToggle();
            updateNoticeLivePreview();
            if (typeof markDraftDirty === 'function') markDraftDirty();
            showToast("Notice logo uploaded. Click 'Save Draft' or 'Publish' to persist.", "success");
            await checkPublishingStatus();
          } else {
            showToast(data.message || "Upload failed.", "error");
          }
        } catch {
          showToast("Network error uploading notice logo.", "error");
        }
      };
      reader.readAsDataURL(file);
    });
  }

  const cfgNoticeLogoUrlInput = document.getElementById("cfgNoticeLogoUrl");
  if (cfgNoticeLogoUrlInput) {
    cfgNoticeLogoUrlInput.addEventListener("input", (e) => {
      const val = e.target.value.trim();
      const prev = document.getElementById("noticeLogoPreview");
      if (prev) prev.src = val;
      if (val) {
        const custRadio = document.getElementById("radioNoticeLogoCustom");
        if (custRadio) custRadio.checked = true;
        handleNoticeLogoRadioToggle();
      }
      if (typeof markDraftDirty === 'function') markDraftDirty();
      updateNoticeLivePreview();
    });
  }

  // Bind live preview updating to all notice inputs
  [
    "cfgNoticePortalTitle", "cfgNoticePortalSub", "cfgNoticeTitle",
    "cfgNoticeBodyEn", "cfgNoticeBodyReg", "cfgNoticeBtnText"
  ].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("input", () => {
      if (typeof markDraftDirty === 'function') markDraftDirty();
      updateNoticeLivePreview();
    });
  });

  function updateNoticeLivePreview() {
    const portalTitle = document.getElementById("cfgNoticePortalTitle")?.value.trim() || document.getElementById("cfgAuthorityName")?.value.trim() || "Ministry of Foreign Affairs";
    const portalSub = document.getElementById("cfgNoticePortalSub")?.value.trim() || document.getElementById("cfgAuthoritySubtitle")?.value.trim() || "Government of Pakistan";
    const badgeTitle = document.getElementById("cfgNoticeTitle")?.value.trim() || "IMPORTANT NOTICE";
    const bodyEn = document.getElementById("cfgNoticeBodyEn")?.value.trim() || "Dear Applicants, please visit the verification authority centers only on your scheduled appointment date...";
    const bodyReg = document.getElementById("cfgNoticeBodyReg")?.value.trim() || "محترم درخواست گزاران، برائے کرم تصدیقی دستاویزات کے لیے اپنی مقررہ تاریخ اور وقت پر تشریف لائیں۔";
    const btnText = document.getElementById("cfgNoticeBtnText")?.value.trim() || "Acknowledge & Proceed";

    const prevPortalTitle = document.getElementById("prevNoticePortalTitle");
    const prevPortalSub = document.getElementById("prevNoticePortalSub");
    const prevTitle = document.getElementById("prevNoticeTitle");
    const prevBodyEn = document.getElementById("prevNoticeBodyEn");
    const prevBodyReg = document.getElementById("prevNoticeBodyReg");
    const prevBtn = document.getElementById("prevNoticeBtn");
    const prevEmblem = document.getElementById("prevNoticeEmblem");

    if (prevPortalTitle) prevPortalTitle.textContent = portalTitle;
    if (prevPortalSub) prevPortalSub.textContent = portalSub;
    if (prevTitle) prevTitle.textContent = badgeTitle;
    if (prevBodyEn) prevBodyEn.innerHTML = escapeHtml(bodyEn).replace(/\n/g, '<br>');
    if (prevBodyReg) prevBodyReg.textContent = bodyReg;
    if (prevBtn) prevBtn.textContent = btnText;

    if (prevEmblem) {
      const isCustom = document.getElementById("radioNoticeLogoCustom")?.checked;
      const isBrand = document.getElementById("radioNoticeLogoBrand")?.checked;
      const customUrl = document.getElementById("cfgNoticeLogoUrl")?.value.trim();
      const brandLogoUrl = draftConfig?.branding?.logoUrl || document.getElementById("logoPreviewImg")?.src || "/uploads/logo_1792329381447.svg";

      if (isCustom && customUrl) {
        prevEmblem.innerHTML = `<img src="${customUrl}" alt="Emblem" style="max-height: 100%; max-width: 100%; object-fit: contain;">`;
      } else if (isBrand && brandLogoUrl) {
        prevEmblem.innerHTML = `<img src="${brandLogoUrl}" alt="Emblem" style="max-height: 100%; max-width: 100%; object-fit: contain;">`;
      } else {
        prevEmblem.innerHTML = `<svg viewBox="0 0 100 100" width="36" height="36" fill="none" stroke="#01411C" stroke-width="2.5"><path d="M50 10 L82 24 V50 C82 72 50 90 50 90 C50 90 18 72 18 50 V24 Z" fill="rgba(1, 65, 28, 0.08)" stroke="#01411C" stroke-width="3"/><path d="M50 28 L54 36 L63 37 L56 43 L58 52 L50 47 L42 52 L44 43 L37 37 L46 36 Z" fill="#01411C"/><path d="M30 65 Q50 78 70 65" stroke="#01411C" stroke-width="3"/></svg>`;
      }
    }
  }

  // Test Notice Modal Button
  const btnTestNoticeModal = document.getElementById("btnTestNoticeModal");
  if (btnTestNoticeModal) {
    btnTestNoticeModal.addEventListener("click", showTestNoticeModalPopup);
  }

  function showTestNoticeModalPopup() {
    const portalTitle = document.getElementById("cfgNoticePortalTitle")?.value.trim() || document.getElementById("cfgAuthorityName")?.value.trim() || "Ministry of Foreign Affairs";
    const portalSub = document.getElementById("cfgNoticePortalSub")?.value.trim() || document.getElementById("cfgAuthoritySubtitle")?.value.trim() || "Government of Pakistan";
    const badgeTitle = document.getElementById("cfgNoticeTitle")?.value.trim() || "IMPORTANT NOTICE";
    const bodyEn = document.getElementById("cfgNoticeBodyEn")?.value.trim() || "Dear Applicants, please visit the verification authority centers only on your scheduled appointment date...";
    const bodyReg = document.getElementById("cfgNoticeBodyReg")?.value.trim() || "محترم درخواست گزاران، برائے کرم تصدیقی دستاویزات کے لیے اپنی مقررہ تاریخ اور وقت پر تشریف لائیں۔";
    const btnText = document.getElementById("cfgNoticeBtnText")?.value.trim() || "Acknowledge & Proceed";

    const isCustom = document.getElementById("radioNoticeLogoCustom")?.checked;
    const isBrand = document.getElementById("radioNoticeLogoBrand")?.checked;
    const customUrl = document.getElementById("cfgNoticeLogoUrl")?.value.trim();
    const brandLogoUrl = draftConfig?.branding?.logoUrl || document.getElementById("logoPreviewImg")?.src || "/uploads/logo_1792329381447.svg";

    let emblemHtml = `<svg viewBox="0 0 100 100" width="46" height="46" fill="none" stroke="#01411C" stroke-width="2.5"><path d="M50 10 L82 24 V50 C82 72 50 90 50 90 C50 90 18 72 18 50 V24 Z" fill="rgba(1, 65, 28, 0.08)" stroke="#01411C" stroke-width="3"/><path d="M50 28 L54 36 L63 37 L56 43 L58 52 L50 47 L42 52 L44 43 L37 37 L46 36 Z" fill="#01411C"/><path d="M30 65 Q50 78 70 65" stroke="#01411C" stroke-width="3"/></svg>`;
    if (isCustom && customUrl) {
      emblemHtml = `<img src="${customUrl}" alt="Emblem" style="max-height: 48px; max-width: 48px; object-fit: contain;">`;
    } else if (isBrand && brandLogoUrl) {
      emblemHtml = `<img src="${brandLogoUrl}" alt="Emblem" style="max-height: 48px; max-width: 48px; object-fit: contain;">`;
    }

    let testModal = document.getElementById("adminTestNoticeModalOverlay");
    if (!testModal) {
      testModal = document.createElement("div");
      testModal.id = "adminTestNoticeModalOverlay";
      testModal.style.cssText = "position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.65); z-index: 99999; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(2px);";
      document.body.appendChild(testModal);
    }

    testModal.innerHTML = `
      <div style="background: #ffffff; border-radius: 12px; width: 100%; max-width: 520px; padding: 32px 30px; position: relative; box-shadow: 0 20px 30px rgba(0,0,0,0.2); text-align: center; margin: 16px;">
        <button type="button" id="adminCloseTestModalBtn" style="position: absolute; top: 12px; right: 14px; background: none; border: none; font-size: 1.6rem; cursor: pointer; color: #64748b; line-height: 1;">&times;</button>
        <div style="width: 56px; height: 56px; margin: 0 auto 10px auto; display: flex; align-items: center; justify-content: center;">
          ${emblemHtml}
        </div>
        <div style="font-size: 1.05rem; font-weight: 700; color: #01411C;">${escapeHtml(portalTitle)}</div>
        <div style="font-size: 0.85rem; color: #64748b; margin-bottom: 12px;">${escapeHtml(portalSub)}</div>
        <div style="display: inline-block; background: #FEF3C7; color: #92400E; font-size: 0.82rem; font-weight: 700; padding: 4px 14px; border-radius: 9999px; letter-spacing: 0.5px; margin-bottom: 14px;">${escapeHtml(badgeTitle)}</div>
        <div style="font-size: 0.88rem; color: #334155; line-height: 1.6; margin-bottom: 14px; text-align: left;">${escapeHtml(bodyEn).replace(/\n/g, '<br>')}</div>
        <div style="font-size: 0.95rem; color: #01411C; line-height: 1.6; margin-bottom: 20px; direction: rtl; text-align: right;">${escapeHtml(bodyReg)}</div>
        <button type="button" id="adminAcknowledgeTestModalBtn" style="background: #01411C; color: #ffffff; padding: 10px 24px; border-radius: 6px; font-size: 0.95rem; font-weight: 600; border: none; cursor: pointer;">${escapeHtml(btnText)}</button>
      </div>
    `;

    testModal.style.display = "flex";
    const closeBtn = document.getElementById("adminCloseTestModalBtn");
    const ackBtn = document.getElementById("adminAcknowledgeTestModalBtn");
    const close = () => { testModal.style.display = "none"; };
    if (closeBtn) closeBtn.onclick = close;
    if (ackBtn) ackBtn.onclick = close;
    testModal.onclick = (e) => { if (e.target === testModal) close(); };
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
        const recSig = rec.signatureUrl || "/uploads/signature_ali_faraz_clean.png";
        document.getElementById("recSignatureUrl").value = recSig;
        const recSigPrev = document.getElementById("recSigPreview");
        if (recSigPrev) recSigPrev.src = recSig;
        document.getElementById("recNotes").value = rec.notes || "";
        recordModal.classList.add("active");
        setupFieldFontSelectors();
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
      document.getElementById("recSignatureUrl").value = "/uploads/signature_ali_faraz_clean.png";
      const recSigPrev = document.getElementById("recSigPreview");
      if (recSigPrev) recSigPrev.src = "/uploads/signature_ali_faraz_clean.png";
      recordModal.classList.add("active");
      setupFieldFontSelectors();
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

  // Handle Signature Upload in Record Modal
  const recSigFileInput = document.getElementById("recSigFileInput");
  if (recSigFileInput) {
    recSigFileInput.addEventListener("change", async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          showToast("Uploading signature...", "info");
          const res = await apiFetch('/api/admin/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fileName: file.name,
              fileData: reader.result,
              fileType: 'signature'
            })
          });
          const data = await res.json();
          if (res.ok && data.success) {
            document.getElementById("recSignatureUrl").value = data.fileUrl;
            const prev = document.getElementById("recSigPreview");
            if (prev) prev.src = data.fileUrl;
            showToast("Signature uploaded successfully.", "success");
          } else {
            showToast(data.message || "Failed to upload signature.", "error");
          }
        } catch {
          showToast("Network error uploading signature.", "error");
        }
      };
      reader.readAsDataURL(file);
    });
  }

  const recSigUrlInput = document.getElementById("recSignatureUrl");
  if (recSigUrlInput) {
    recSigUrlInput.addEventListener("input", (e) => {
      const prev = document.getElementById("recSigPreview");
      if (prev && e.target.value.trim()) prev.src = e.target.value.trim();
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
        signatureUrl: (document.getElementById("recSignatureUrl")?.value || "").trim() || "/uploads/signature_ali_faraz_clean.png",
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
          if (data.record) {
            displayGeneratedCertificateLink(data.record);
          }
        } else {
          showToast(data.message || "Failed to save document.", "error");
        }
      } catch {
        showToast("Network error saving document.", "error");
      }
    });
  }

  // =========================================================================
  // QUICK CERTIFICATE GENERATOR & INSTANT QR SHARE BOX
  // =========================================================================
  function generateRandomApostilleId() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const randPart = (len) => Array.from({length: len}, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    return `APO-${randPart(4)}-${randPart(4)}-${randPart(4)}`;
  }

  function displayGeneratedCertificateLink(rec) {
    const resultBox = document.getElementById("certGeneratedResultBox");
    const numEl = document.getElementById("genResultDocNum");
    const urlInput = document.getElementById("genResultUrlInput");
    const openCertBtn = document.getElementById("btnOpenGenCert");
    const openPdfBtn = document.getElementById("btnOpenGenPdf");
    const qrContainer = document.getElementById("genResultQrCode");

    if (!resultBox || !rec) return;

    const pubUrl = `${window.location.origin}/index.html?doc=${encodeURIComponent(rec.docNumber)}&date=${encodeURIComponent(rec.issueDate)}`;

    if (numEl) numEl.textContent = rec.docNumber;
    if (urlInput) urlInput.value = pubUrl;
    if (openCertBtn) openCertBtn.href = pubUrl;

    if (openPdfBtn) {
      const pdfUrl = rec.pdfUrl || (rec.pdfFileName ? `/uploads/${rec.pdfFileName}` : "");
      if (pdfUrl) {
        openPdfBtn.href = pdfUrl;
        openPdfBtn.style.display = "inline-block";
      } else {
        openPdfBtn.style.display = "none";
      }
    }

    if (qrContainer) {
      qrContainer.innerHTML = "";
      if (typeof renderQRCodeSVG === 'function') {
        qrContainer.innerHTML = renderQRCodeSVG(pubUrl, 110, 110);
      } else {
        const qrImg = document.createElement("img");
        qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=110x110&data=${encodeURIComponent(pubUrl)}`;
        qrImg.style.width = "100%";
        qrImg.style.height = "100%";
        qrContainer.appendChild(qrImg);
      }
    }

    resultBox.style.display = "block";
    resultBox.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const btnRandomDocNum = document.getElementById("btnRandomDocNum");
  if (btnRandomDocNum) {
    btnRandomDocNum.addEventListener("click", () => {
      const docInput = document.getElementById("qgDocNumber");
      if (docInput) {
        docInput.value = generateRandomApostilleId();
        showToast(`Generated ID: ${docInput.value}`, "info");
      }
    });
  }

  const quickGenFileInput = document.getElementById("quickGenFileInput");
  if (quickGenFileInput) {
    quickGenFileInput.addEventListener("change", async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      if (!file.name.toLowerCase().endsWith('.pdf')) {
        showToast("Only PDF documents are allowed.", "error");
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        showToast("PDF file exceeds 10MB limit.", "error");
        return;
      }

      const statusEl = document.getElementById("quickGenFileStatus");
      if (statusEl) statusEl.textContent = `Uploading ${file.name}...`;

      const reader = new FileReader();
      reader.onload = async () => {
        try {
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
            document.getElementById("quickGenPdfFileName").value = file.name;
            document.getElementById("quickGenPdfUrl").value = data.fileUrl;
            if (statusEl) {
              statusEl.innerHTML = `<span style="color: #059669; font-weight: 700;">✓ Ready:</span> ${file.name}`;
            }
            showToast("Document PDF uploaded.", "success");
          } else {
            if (statusEl) statusEl.textContent = "Upload failed.";
            showToast(data.message || "PDF upload failed.", "error");
          }
        } catch {
          if (statusEl) statusEl.textContent = "Upload network error.";
          showToast("Network error uploading PDF.", "error");
        }
      };
      reader.readAsDataURL(file);
    });
  }

  // Handle Quick Generator Signature Upload
  const qgSigFileInput = document.getElementById("qgSigFileInput");
  if (qgSigFileInput) {
    qgSigFileInput.addEventListener("change", async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          showToast("Uploading signature...", "info");
          const res = await apiFetch('/api/admin/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fileName: file.name,
              fileData: reader.result,
              fileType: 'signature'
            })
          });
          const data = await res.json();
          if (res.ok && data.success) {
            document.getElementById("qgSignatureUrl").value = data.fileUrl;
            const prev = document.getElementById("qgSigPreview");
            if (prev) prev.src = data.fileUrl;
            showToast("Signature uploaded successfully.", "success");
          } else {
            showToast(data.message || "Failed to upload signature.", "error");
          }
        } catch {
          showToast("Network error uploading signature.", "error");
        }
      };
      reader.readAsDataURL(file);
    });
  }

  const qgSigUrlInput = document.getElementById("qgSignatureUrl");
  if (qgSigUrlInput) {
    qgSigUrlInput.addEventListener("input", (e) => {
      const prev = document.getElementById("qgSigPreview");
      if (prev && e.target.value.trim()) prev.src = e.target.value.trim();
    });
  }

  const quickGenForm = document.getElementById("quickGenForm");
  if (quickGenForm) {
    quickGenForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const submitBtn = document.getElementById("btnQuickGenSubmit");
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Creating Certificate...";
      }

      const payload = {
        docNumber: document.getElementById("qgDocNumber").value.trim().toUpperCase(),
        applicantName: document.getElementById("qgApplicant").value.trim(),
        documentCategory: document.getElementById("qgDocCategory").value.trim(),
        country: document.getElementById("qgCountry").value.trim() || "Pakistan",
        signedBy: document.getElementById("qgSignedBy").value.trim() || "N/A",
        capacity: document.getElementById("qgCapacity").value.trim() || "Registrar",
        sealOf: document.getElementById("qgSealOf").value.trim() || "Preston University",
        issuePlace: document.getElementById("qgIssuePlace").value.trim() || "Lahore Pakistan",
        issueDate: document.getElementById("qgIssueDate").value,
        expiryDate: "",
        issuingAuthority: document.getElementById("qgAuthority").value.trim() || "Ministry of Foreign Affairs",
        signatoryOfficer: document.getElementById("qgSignatoryOfficer").value.trim() || "Ali Faraz",
        signatureUrl: (document.getElementById("qgSignatureUrl")?.value || "").trim() || "/uploads/signature_ali_faraz_clean.png",
        documentType: document.getElementById("qgDocCategory").value.trim(),
        status: document.getElementById("qgStatus").value || "VERIFIED",
        pdfFileName: document.getElementById("quickGenPdfFileName").value.trim(),
        pdfUrl: document.getElementById("quickGenPdfUrl").value.trim(),
        notes: "Generated via Admin Certificate Template"
      };

      try {
        const res = await apiFetch('/api/admin/records', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (res.ok && data.success) {
          showToast("Certificate generated & link ready!", "success");
          await loadRecords();
          displayGeneratedCertificateLink(data.record);
        } else {
          showToast(data.message || "Failed to generate certificate.", "error");
        }
      } catch {
        showToast("Network error generating certificate.", "error");
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = "⚡ Create Certificate & Generate Link";
        }
      }
    });
  }

  const btnCopyGenUrl = document.getElementById("btnCopyGenUrl");
  if (btnCopyGenUrl) {
    btnCopyGenUrl.addEventListener("click", () => {
      const urlInput = document.getElementById("genResultUrlInput");
      if (urlInput && urlInput.value) {
        navigator.clipboard.writeText(urlInput.value).then(() => {
          showToast("Verification link copied to clipboard!", "success");
        }).catch(() => {
          prompt("Copy this Verification Link:", urlInput.value);
        });
      }
    });
  }

  const btnCloseGenBox = document.getElementById("btnCloseGenBox");
  if (btnCloseGenBox) {
    btnCloseGenBox.addEventListener("click", () => {
      const box = document.getElementById("certGeneratedResultBox");
      if (box) box.style.display = "none";
    });
  }

  const btnToggleGenForm = document.getElementById("btnToggleGenForm");
  if (btnToggleGenForm && quickGenForm) {
    btnToggleGenForm.addEventListener("click", () => {
      if (quickGenForm.style.display === "none") {
        quickGenForm.style.display = "block";
        btnToggleGenForm.textContent = "▲ Hide Generator";
      } else {
        quickGenForm.style.display = "none";
        btnToggleGenForm.textContent = "▼ Show Generator";
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
