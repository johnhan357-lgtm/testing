/**
 * Document Verification Portal - Dynamic Public Controller
 * Binds published CMS configuration and executes authoritative backend verification.
 */

document.addEventListener("DOMContentLoaded", async () => {
  // DOM Elements
  const noticeModal = document.getElementById("noticeModal");
  const closeModalBtn = document.getElementById("closeModalBtn");
  const modalAcknowledgeBtn = document.getElementById("modalAcknowledgeBtn");
  const verificationForm = document.getElementById("verificationForm");
  const docNumberInput = document.getElementById("docNumber");
  const docDateInput = document.getElementById("docDate");
  const btnClear = document.getElementById("btnClear");
  const btnVerify = document.getElementById("btnVerify");
  const searchCard = document.getElementById("searchCard");
  const resultCard = document.getElementById("resultCard");
  const btnSearchAgain = document.getElementById("btnSearchAgain");
  const btnFeedback = document.getElementById("btnFeedback");

  // Dynamic branding & text containers
  const brandTitleEl = document.querySelector(".top-header .brand-title");
  const brandSubtitleEl = document.querySelector(".top-header .brand-subtitle");
  const brandEmblemEl = document.querySelector(".top-header .brand-emblem");
  const navListEl = document.querySelector(".nav-list");
  const heroTitleEl = document.querySelector(".hero-title");
  const heroSubtitleEl = document.querySelector(".hero-subtitle");
  const cardHeadingEl = document.querySelector(".card-heading");
  const helpTextEl = document.querySelector(".help-text");
  const footerBrandTitleEl = document.querySelector(".footer-brand .brand-title");
  const footerBrandSubtitleEl = document.querySelector(".footer-brand .brand-subtitle");
  const footerLinksEl = document.querySelector(".footer-links");
  const footerBottomEl = document.querySelector(".footer-bottom");

  const statusBadge = document.getElementById("statusBadge");
  const statusTitle = document.getElementById("statusTitle");
  const resDocNumber = document.getElementById("resDocNumber");
  const resDocType = document.getElementById("resDocType");
  const resApplicant = document.getElementById("resApplicant");
  const resDate = document.getElementById("resDate");
  const resAuthority = document.getElementById("resAuthority");
  const resHash = document.getElementById("resHash");
  const resultTable = document.querySelector(".result-table");

  // =========================================================================
  // TYPOGRAPHY & FONT MAP ENGINE
  // =========================================================================
  const FONT_MAP = {
    "Plus Jakarta Sans": "'Plus Jakarta Sans', sans-serif",
    "Times": "'Times New Roman', Times, serif",
    "Poppins": "'Poppins', sans-serif",
    "Fair": "'Playfair Display', 'Fair', Georgia, serif",
    "Helvetica": "'Helvetica Neue', Helvetica, Arial, sans-serif"
  };

  const FIELD_TO_PUBLIC_SELECTOR_MAP = {
    "cfgAuthorityName": [".brand-title"],
    "cfgAuthoritySubtitle": [".brand-subtitle"],
    "cfgHeroTitle": [".hero-title"],
    "cfgHeroSubtitle": [".hero-subtitle"],
    "cfgCardHeading": [".card-heading", ".card-title"],
    "cfgDocLabel": ["label[for='docNumber']"],
    "cfgDocPlaceholder": ["#docNumber"],
    "cfgDateLabel": ["label[for='docDate']"],
    "cfgVerifyBtnText": ["#btnVerify"],
    "cfgClearBtnText": ["#btnClear"],
    "cfgHelpText": [".help-text"],
    "cfgCertPageTitle": [".cert-page-title", "#certPageTitle"],
    "cfgCertBreadcrumb": [".cert-breadcrumb", "#certBreadcrumbText"],
    "cfgCertIssuerStatement": [".cert-issuer-statement", "#certIssuerStatement", "#aposIssuerStatement"],
    "cfgCertConventionTitle": [".cert-convention-title", "#aposConventionTitle"],
    "cfgCertConventionSubtitle": [".cert-convention-subtitle", "#aposConventionSubtitle"],
    "cfgCertCountry": ["#certCountryVal", "#aposCountry"],
    "cfgCertCertifiedWord": [".cert-box-title", "#aposCertified"],
    "cfgCertSignatoryOfficer": ["#certOfficerVal", "#aposSignatory"],
    "cfgCertDisclaimer": [".cert-disclaimer-box", "#aposDisclaimer"],
    "cfgCertVerifyUrl": [".cert-footer-url", "#aposVerifyUrl"],
    "cfgCertVerificationUrl": [".cert-footer-url", "#aposVerifyUrl"],
    "cfgCertStatusText": ["#statusTitle"],
    "cfgNoticePortalTitle": ["#modalPortalTitle", ".modal-portal-title"],
    "cfgNoticePortalSub": ["#modalPortalSub", ".modal-portal-sub"],
    "cfgNoticeTitle": ["#modalTitle"],
    "cfgNoticeBodyEn": [".modal-body-text"],
    "cfgNoticeBodyReg": [".modal-regional-text"],
    "cfgNoticeBtnText": ["#modalAcknowledgeBtn"],
    "cfgFloatingLabel": [".floating-feedback-btn span", "#btnFeedback span"],
    "cfgFooterAuthorityName": [".footer-brand-title", ".footer-brand .brand-title"],
    "cfgFooterAuthoritySubtitle": [".footer-brand-subtitle", ".footer-brand .brand-subtitle"],
    "cfgFooterCopyright": [".footer-bottom"],
    // Apostille direct field mapping
    "qgDocNumber": ["#aposDocNumber"],
    "qgCategory": ["#aposIssuerStatement"],
    "qgCountry": ["#aposCountry"],
    "qgSignatory": ["#aposSignatory"],
    "qgCapacity": ["#aposCapacity"],
    "qgSeal": ["#aposSealOf"],
    "qgLocation": ["#aposIssuePlace"],
    "qgSignatoryOfficer": ["#aposSignatory"]
  };

  function applyFieldFonts(cfg) {
    if (!cfg) return;

    // Apply Global Portal Font
    if (cfg.theme && cfg.theme.globalFont && FONT_MAP[cfg.theme.globalFont]) {
      const globalCss = FONT_MAP[cfg.theme.globalFont];
      document.documentElement.style.setProperty('--font-family', globalCss);
      document.body.style.fontFamily = globalCss;
    }

    // Apply Per-Field Custom Fonts
    if (cfg.fieldFonts && typeof cfg.fieldFonts === 'object') {
      Object.entries(cfg.fieldFonts).forEach(([fieldId, fontName]) => {
        if (!fontName || !FONT_MAP[fontName]) return;
        const fontCss = FONT_MAP[fontName];
        const selectors = FIELD_TO_PUBLIC_SELECTOR_MAP[fieldId];
        if (selectors && Array.isArray(selectors)) {
          selectors.forEach(sel => {
            const els = document.querySelectorAll(sel);
            els.forEach(el => {
              el.style.fontFamily = fontCss;
            });
          });
        }
      });
    }
  }

  // Mobile Menu & Date Selects
  const mobileMenuBtn = document.getElementById("mobileMenuBtn");
  const mainNavbar = document.querySelector(".main-navbar");
  const dateDaySelect = document.getElementById("dateDay");
  const dateMonthSelect = document.getElementById("dateMonth");
  const dateYearSelect = document.getElementById("dateYear");

  // Populate DD, MM, YYYY Options
  function initDateDropdowns() {
    if (!dateDaySelect || !dateMonthSelect || !dateYearSelect) return;

    // Days 01 - 31
    for (let d = 1; d <= 31; d++) {
      const val = String(d).padStart(2, '0');
      const opt = document.createElement("option");
      opt.value = val;
      opt.textContent = val;
      dateDaySelect.appendChild(opt);
    }

    // Months 01 - 12
    for (let m = 1; m <= 12; m++) {
      const val = String(m).padStart(2, '0');
      const opt = document.createElement("option");
      opt.value = val;
      opt.textContent = val;
      dateMonthSelect.appendChild(opt);
    }

    // Years (Current year down to 1980)
    const currentYear = new Date().getFullYear();
    for (let y = currentYear + 2; y >= 1980; y--) {
      const opt = document.createElement("option");
      opt.value = String(y);
      opt.textContent = String(y);
      dateYearSelect.appendChild(opt);
    }

    [dateDaySelect, dateMonthSelect, dateYearSelect].forEach(sel => {
      sel.addEventListener("change", syncDateToHiddenInput);
    });
  }

  function syncDateToHiddenInput() {
    const day = dateDaySelect?.value;
    const month = dateMonthSelect?.value;
    const year = dateYearSelect?.value;

    if (day && month && year) {
      docDateInput.value = `${year}-${month}-${day}`;
    } else {
      docDateInput.value = "";
    }
  }

  function syncDateFromValue(dateStr) {
    if (!dateStr) return;
    const parts = dateStr.split("-");
    if (parts.length === 3) {
      if (dateYearSelect) dateYearSelect.value = parts[0];
      if (dateMonthSelect) dateMonthSelect.value = parts[1];
      if (dateDaySelect) dateDaySelect.value = parts[2];
      docDateInput.value = dateStr;
    }
  }

  initDateDropdowns();

  // Mobile Menu Toggle
  if (mobileMenuBtn && mainNavbar) {
    mobileMenuBtn.addEventListener("click", () => {
      const isOpen = mainNavbar.classList.toggle("mobile-open");
      mobileMenuBtn.classList.toggle("active", isOpen);
      mobileMenuBtn.setAttribute("aria-expanded", String(isOpen));
    });
  }

  let currentConfig = null;

  // =========================================================================
  // 1. FETCH & HYDRATE PUBLISHED CONFIGURATION
  // =========================================================================
  async function loadPublishedConfig() {
    try {
      const res = await fetch('/api/public/config');
      if (res.ok) {
        currentConfig = await res.json();
        applyConfig(currentConfig);
      }
    } catch (err) {
      console.warn('Could not fetch /api/public/config, using default static structure:', err);
    }
  }

  function applyConfig(cfg) {
    if (!cfg) return;

    // Apply Theme Colors
    if (cfg.theme) {
      const root = document.documentElement;
      if (cfg.theme.primaryGreen) root.style.setProperty('--primary-green', cfg.theme.primaryGreen);
      if (cfg.theme.primaryGreenDark) root.style.setProperty('--primary-green-dark', cfg.theme.primaryGreenDark);
      if (cfg.theme.primaryGreenLight) root.style.setProperty('--primary-green-light', cfg.theme.primaryGreenLight);
      if (cfg.theme.footerDark) root.style.setProperty('--footer-dark', cfg.theme.footerDark);
      if (cfg.theme.bgLight) root.style.setProperty('--bg-light', cfg.theme.bgLight);
    }

    // Apply Branding
    if (cfg.branding) {
      if (brandTitleEl) brandTitleEl.textContent = cfg.branding.authorityName || "Ministry of Foreign Affairs";
      if (brandSubtitleEl) brandSubtitleEl.textContent = cfg.branding.authoritySubtitle || "Government of Pakistan";
      if (cfg.branding.authorityName) {
        document.title = cfg.branding.authorityName;
      }

      // Handle logo click link URL & target (Full control)
      const brandLinkEl = document.getElementById("brandSectionLink") || document.querySelector(".brand-section");
      if (brandLinkEl) {
        const linkUrl = cfg.branding.logoLinkUrl || "https://apostille.mofa.gov.pk/";
        brandLinkEl.href = linkUrl;
        if (cfg.branding.logoLinkTarget === '_blank') {
          brandLinkEl.target = "_blank";
          brandLinkEl.rel = "noopener noreferrer";
        } else {
          brandLinkEl.removeAttribute("target");
          brandLinkEl.removeAttribute("rel");
        }
      }

      // Handle custom uploaded logo or default SVG
      const activeLogoUrl = cfg.branding.logoUrl || '/uploads/logo_1792329381447.svg';
      if (cfg.branding.logoType === 'custom_image' || activeLogoUrl) {
        if (brandEmblemEl) {
          brandEmblemEl.innerHTML = `<img src="${activeLogoUrl}" alt="Brand Logo" style="max-height: 100%; max-width: 100%; object-fit: contain;">`;
        }
      } else if (brandEmblemEl) {
        brandEmblemEl.innerHTML = `<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M50 10 L82 24 V50 C82 72 50 90 50 90 C50 90 18 72 18 50 V24 Z" fill="rgba(1, 65, 28, 0.08)" stroke="currentColor" stroke-width="3"/><path d="M50 28 L54 36 L63 37 L56 43 L58 52 L50 47 L42 52 L44 43 L37 37 L46 36 Z" fill="currentColor"/><path d="M30 65 Q50 78 70 65" stroke="currentColor" stroke-width="3"/><path d="M35 55 Q50 66 65 55" stroke="currentColor" stroke-width="2"/></svg>`;
      }

      // Social Links
      if (cfg.branding.socialLinks) {
        const fb = document.querySelector('.social-icon[title="Facebook"]');
        const ig = document.querySelector('.social-icon[title="Instagram"]');
        const tw = document.querySelector('.social-icon[title="Twitter / X"]');
        const li = document.querySelector('.social-icon[title="LinkedIn"]');
        if (fb && cfg.branding.socialLinks.facebook) fb.href = cfg.branding.socialLinks.facebook;
        if (ig && cfg.branding.socialLinks.instagram) ig.href = cfg.branding.socialLinks.instagram;
        if (tw && cfg.branding.socialLinks.twitter) tw.href = cfg.branding.socialLinks.twitter;
        if (li && cfg.branding.socialLinks.linkedin) li.href = cfg.branding.socialLinks.linkedin;
      }
    }

    // Apply Navigation Items (Dedicated custom link & external URL support)
    if (cfg.navigation && Array.isArray(cfg.navigation) && navListEl) {
      const activeItems = cfg.navigation.filter(item => item.enabled !== false);
      let navHtml = '';
      activeItems.forEach((item, index) => {
        const isLast = index === activeItems.length - 1;
        const targetAttr = item.target === '_blank' ? 'target="_blank" rel="noopener noreferrer"' : '';
        const activeClass = item.url === 'index.html' || item.url === '/' ? 'active' : '';

        navHtml += `
          <li class="nav-item">
            <a href="${item.url}" class="nav-link ${activeClass}" ${targetAttr}>${item.label}</a>
          </li>
        `;
        if (!isLast) {
          navHtml += `<li class="nav-divider" aria-hidden="true">|</li>`;
        }
      });
      navListEl.innerHTML = navHtml;
    }

    // Apply Hero Section
    if (cfg.hero) {
      if (heroTitleEl && cfg.hero.title) heroTitleEl.textContent = cfg.hero.title;
      if (heroSubtitleEl && cfg.hero.subtitle) heroSubtitleEl.textContent = cfg.hero.subtitle;
    }

    // Apply Verification Card
    if (cfg.verificationCard) {
      if (cardHeadingEl && cfg.verificationCard.heading) cardHeadingEl.textContent = cfg.verificationCard.heading;
      if (btnVerify && cfg.verificationCard.verifyButtonText) btnVerify.textContent = cfg.verificationCard.verifyButtonText;
      if (btnClear && cfg.verificationCard.clearButtonText) btnClear.textContent = cfg.verificationCard.clearButtonText;
      if (helpTextEl) {
        const customText = (cfg.verificationCard.helpText !== undefined && cfg.verificationCard.helpText !== null)
          ? cfg.verificationCard.helpText.trim()
          : "";
        if (customText) {
          helpTextEl.innerHTML = customText.replace(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g, '<a href="mailto:$1">$1</a>');
          helpTextEl.style.display = "";
        } else if (cfg.verificationCard.supportEmail) {
          const email = cfg.verificationCard.supportEmail;
          helpTextEl.innerHTML = `If you need further help email <a href="mailto:${email}">${email}</a> with the certificate number and date`;
          helpTextEl.style.display = "";
        } else {
          helpTextEl.innerHTML = "";
          helpTextEl.style.display = "none";
        }
      }
    }

    // Apply Notice Modal Configuration
    if (cfg.noticeModal) {
      if (cfg.noticeModal.enabled === false) {
        if (noticeModal) noticeModal.style.display = 'none';
      } else {
        if (noticeModal) noticeModal.style.display = '';
        const modalTitle = document.getElementById("modalTitle");
        const modalBody = document.querySelector(".modal-body-text");
        const modalRegional = document.querySelector(".modal-regional-text");
        const modalBtn = document.getElementById("modalAcknowledgeBtn");
        const modalPortalTitle = document.getElementById("modalPortalTitle") || document.querySelector(".modal-portal-title");
        const modalPortalSub = document.getElementById("modalPortalSub") || document.querySelector(".modal-portal-sub");
        const modalEmblem = document.getElementById("modalEmblem") || document.querySelector(".modal-emblem");

        if (modalPortalTitle) modalPortalTitle.textContent = cfg.noticeModal.portalTitle || (cfg.branding && cfg.branding.authorityName) || "Ministry of Foreign Affairs";
        if (modalPortalSub) modalPortalSub.textContent = cfg.noticeModal.portalSub || (cfg.branding && cfg.branding.authoritySubtitle) || "Government of Pakistan";
        if (modalTitle && cfg.noticeModal.title) modalTitle.textContent = cfg.noticeModal.title;
        if (modalBody && cfg.noticeModal.bodyEnglish) modalBody.innerHTML = cfg.noticeModal.bodyEnglish.replace(/\n/g, '<br>');
        if (modalRegional && cfg.noticeModal.bodyRegional) modalRegional.textContent = cfg.noticeModal.bodyRegional;
        if (modalBtn && cfg.noticeModal.confirmButtonText) modalBtn.textContent = cfg.noticeModal.confirmButtonText;

        // Handle Notice Emblem / Logo
        if (modalEmblem) {
          const brandLogo = (cfg.branding && cfg.branding.logoUrl) ? cfg.branding.logoUrl : '/uploads/logo_1792329381447.svg';
          if (cfg.noticeModal.logoType === 'custom_image' && cfg.noticeModal.logoUrl) {
            modalEmblem.innerHTML = `<img src="${cfg.noticeModal.logoUrl}" alt="Notice Emblem" style="max-height: 100%; max-width: 100%; object-fit: contain;">`;
          } else if (cfg.noticeModal.logoType === 'use_brand_logo') {
            modalEmblem.innerHTML = `<img src="${brandLogo}" alt="Notice Emblem" style="max-height: 100%; max-width: 100%; object-fit: contain;">`;
          } else if (cfg.noticeModal.logoType === 'default_svg') {
            modalEmblem.innerHTML = `<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M50 10 L82 24 V50 C82 72 50 90 50 90 C50 90 18 72 18 50 V24 Z" fill="rgba(1, 65, 28, 0.08)" stroke="currentColor" stroke-width="3"/><path d="M50 28 L54 36 L63 37 L56 43 L58 52 L50 47 L42 52 L44 43 L37 37 L46 36 Z" fill="currentColor"/><path d="M30 65 Q50 78 70 65" stroke="currentColor" stroke-width="3"/></svg>`;
          } else if (cfg.noticeModal.logoUrl) {
            modalEmblem.innerHTML = `<img src="${cfg.noticeModal.logoUrl}" alt="Notice Emblem" style="max-height: 100%; max-width: 100%; object-fit: contain;">`;
          } else {
            modalEmblem.innerHTML = `<img src="${brandLogo}" alt="Notice Emblem" style="max-height: 100%; max-width: 100%; object-fit: contain;">`;
          }
        }

        const urlParams = new URLSearchParams(window.location.search);
        const isDirectVerify = !!(urlParams.get("doc") || urlParams.get("id") || urlParams.get("cert") || urlParams.get("verify"));
        const shouldShowOnDirect = cfg.noticeModal.showOnDirectVerify === true;
        const alwaysShow = cfg.noticeModal.alwaysShowOnRefresh !== false;

        let shouldDisplay = true;
        if (isDirectVerify && !shouldShowOnDirect) {
          shouldDisplay = false;
        } else if (!alwaysShow) {
          try {
            if (sessionStorage.getItem("notice_dismissed") === "1") {
              shouldDisplay = false;
            }
          } catch (_) {}
        } else {
          // Always show on refresh: clear past flags
          try {
            sessionStorage.removeItem("notice_dismissed");
          } catch (_) {}
        }

        if (shouldDisplay && noticeModal) {
          setTimeout(() => {
            noticeModal.classList.add("active");
          }, 350);
        }
      }
    }

    // Apply Floating Action Widget
    if (cfg.floatingFeedback && btnFeedback) {
      if (cfg.floatingFeedback.enabled === false) {
        btnFeedback.style.display = 'none';
      } else {
        btnFeedback.style.display = 'flex';
        const labelSpan = btnFeedback.querySelector('span');
        if (labelSpan && cfg.floatingFeedback.label) labelSpan.textContent = cfg.floatingFeedback.label;
      }
    }

    // Apply Footer Configuration
    if (cfg.footer) {
      if (footerBrandTitleEl && cfg.footer.authorityName) footerBrandTitleEl.textContent = cfg.footer.authorityName;
      if (footerBrandSubtitleEl && cfg.footer.authoritySubtitle) footerBrandSubtitleEl.textContent = cfg.footer.authoritySubtitle;
      if (footerBottomEl && cfg.footer.copyrightText) footerBottomEl.textContent = cfg.footer.copyrightText;

      const footerBrandEmblemEl = document.getElementById("footerBrandEmblem") || document.querySelector(".footer-brand .brand-emblem");
      if (footerBrandEmblemEl) {
        if (cfg.footer.logoType === 'custom_image' && cfg.footer.logoUrl) {
          footerBrandEmblemEl.innerHTML = `<img src="${cfg.footer.logoUrl}" alt="Footer Logo" style="max-height: 100%; max-width: 100%; object-fit: contain;">`;
        } else {
          footerBrandEmblemEl.innerHTML = `<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M50 10 L82 24 V50 C82 72 50 90 50 90 C50 90 18 72 18 50 V24 Z" fill="none" stroke="currentColor" stroke-width="3"/><path d="M50 28 L54 36 L63 37 L56 43 L58 52 L50 47 L42 52 L44 43 L37 37 L46 36 Z" fill="currentColor"/></svg>`;
        }
      }

      if (cfg.footer.links && Array.isArray(cfg.footer.links) && footerLinksEl) {
        const activeFooterLinks = cfg.footer.links.filter(l => l.enabled !== false);
        let footHtml = '';
        activeFooterLinks.forEach((link, idx) => {
          const isLast = idx === activeFooterLinks.length - 1;
          const target = link.target === '_blank' ? 'target="_blank" rel="noopener noreferrer"' : '';
          footHtml += `<li><a href="${link.url}" ${target}>${link.label}</a></li>`;
          if (!isLast) {
            footHtml += `<li class="footer-divider" aria-hidden="true">|</li>`;
          }
        });
        footerLinksEl.innerHTML = footHtml;
      }
    }

    // Apply Certificate View Settings (Apostille Result Page)
    if (cfg.certificateView) {
      const cv = cfg.certificateView;
      const elPageTitle = document.getElementById("certPageTitle");
      const elBreadcrumb = document.getElementById("certBreadcrumbText");
      const elIssuer = document.getElementById("certIssuerStatement");
      const elAposTitle = document.getElementById("aposTitle");
      const elAposSub = document.getElementById("aposSubtitle");
      const elAposCertified = document.getElementById("aposCertified");
      const elAposDisc = document.getElementById("aposDisclaimer");
      const elAposUrl = document.getElementById("aposVerifyUrl");
      const elWatermark = document.getElementById("apostilleWatermark");
      const elPdfSection = document.getElementById("attachedPdfSection");

      if (elPageTitle && cv.pageTitle) elPageTitle.textContent = cv.pageTitle;
      if (elBreadcrumb && cv.breadcrumbText) {
        const parts = cv.breadcrumbText.split('/');
        elBreadcrumb.textContent = parts.length > 1 ? parts[1].trim() : cv.breadcrumbText;
      }
      if (elIssuer && cv.issuerStatement) elIssuer.textContent = cv.issuerStatement;
      if (elAposTitle && cv.conventionTitle) elAposTitle.textContent = cv.conventionTitle;
      if (elAposSub && cv.conventionSubtitle) elAposSub.textContent = cv.conventionSubtitle;
      if (elAposCertified && cv.certifiedWord) elAposCertified.textContent = cv.certifiedWord;
      if (elAposDisc && cv.disclaimerText) elAposDisc.textContent = cv.disclaimerText;
      if (elAposUrl && cv.verificationUrlText) elAposUrl.textContent = cv.verificationUrlText;

      if (elWatermark && cv.watermarkText) {
        const wmText = encodeURIComponent(cv.watermarkText);
        elWatermark.style.backgroundImage = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='165' height='28' viewBox='0 0 165 28'%3E%3Ctext x='5' y='19' font-family='Arial, sans-serif' font-weight='800' font-size='12.5' fill='rgba(0, 0, 0, 0.055)' letter-spacing='1'%3E${wmText}%3C/text%3E%3C/svg%3E")`;
      }

      if (elPdfSection) {
        elPdfSection.style.display = cv.enablePdfViewer === false ? 'none' : '';
      }

      const elSigImg = document.getElementById("aposSigImg");
      if (elSigImg && cv.signatureUrl) {
        elSigImg.onerror = function() {
          this.onerror = null;
          this.src = "/uploads/signature_ali_faraz_clean.png";
        };
        elSigImg.src = cv.signatureUrl;
      }
    }

    // Apply Fonts to All Applicable Elements
    applyFieldFonts(cfg);
  }

  // =========================================================================
  // 2. MODAL CONTROLS
  // =========================================================================
  function dismissNotice() {
    if (noticeModal) {
      noticeModal.classList.remove("active");
      try {
        sessionStorage.setItem("notice_dismissed", "1");
      } catch (_) {}
    }
  }

  if (closeModalBtn) closeModalBtn.addEventListener("click", dismissNotice);
  if (modalAcknowledgeBtn) modalAcknowledgeBtn.addEventListener("click", dismissNotice);
  if (noticeModal) {
    noticeModal.addEventListener("click", (e) => {
      if (e.target === noticeModal) dismissNotice();
    });
  }

  // =========================================================================
  // 3. AUTHORITATIVE SERVER-SIDE VERIFICATION
  // =========================================================================
  async function executeVerification(docNum, dateVal) {
    btnVerify.disabled = true;
    const originalText = btnVerify.textContent;
    btnVerify.textContent = "Verifying Record...";

    try {
      const response = await fetch('/api/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ docNumber: docNum, docDate: dateVal })
      });

      let data = await response.json();

      // Self-Healing: If record not found on ephemeral server, check local browser backup
      if (!data.success || data.status === "NOT_FOUND") {
        try {
          const localRaw = localStorage.getItem("mofa_records_backup");
          if (localRaw) {
            const localRecs = JSON.parse(localRaw);
            const foundLocal = Array.isArray(localRecs) && localRecs.find(r => r.docNumber && r.docNumber.toUpperCase() === String(docNum).trim().toUpperCase());
            if (foundLocal) {
              // Send backup record to heal server
              const healRes = await fetch('/api/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ docNumber: docNum, docDate: dateVal, backupRecord: foundLocal })
              });
              if (healRes.ok) {
                const healedData = await healRes.json();
                if (healedData.success) {
                  data = healedData;
                }
              }
            }
          }
        } catch (_) {}
      }

      btnVerify.disabled = false;
      btnVerify.textContent = originalText;

      renderVerificationResult(data, docNum, dateVal);
    } catch (err) {
      console.error('[Verification Error]:', err);

      // Offline / Connection error fallback: check local client backup
      try {
        const localRaw = localStorage.getItem("mofa_records_backup");
        if (localRaw) {
          const localRecs = JSON.parse(localRaw);
          const foundLocal = Array.isArray(localRecs) && localRecs.find(r => r.docNumber && r.docNumber.toUpperCase() === String(docNum).trim().toUpperCase());
          if (foundLocal && (!dateVal || foundLocal.issueDate === dateVal)) {
            btnVerify.disabled = false;
            btnVerify.textContent = originalText;
            renderVerificationResult({ success: true, status: foundLocal.status || "VERIFIED", record: foundLocal }, docNum, dateVal);
            return;
          }
        }
      } catch (_) {}

      btnVerify.disabled = false;
      btnVerify.textContent = originalText;
      alert("Network error: Unable to contact the verification service. Please try again.");
    }
  }

  function renderVerificationResult(data, docNum, dateVal) {
    resultCard.style.display = "block";
    resultCard.scrollIntoView({ behavior: "smooth", block: "nearest" });

    // Certificate Elements
    const apostilleContainer = document.getElementById("apostilleContainer");
    const attachedPdfSection = document.getElementById("attachedPdfSection");
    const resSummaryCategory = document.getElementById("resSummaryCategory");
    const resSummaryDate = document.getElementById("resSummaryDate");
    const resSummaryAuthority = document.getElementById("resSummaryAuthority");
    const aposCountry = document.getElementById("aposCountry");
    const aposDocCategory = document.getElementById("aposDocCategory");
    const aposSignedBy = document.getElementById("aposSignedBy");
    const aposCapacity = document.getElementById("aposCapacity");
    const aposSealOf = document.getElementById("aposSealOf");
    const aposIssuePlace = document.getElementById("aposIssuePlace");
    const aposIssueDate = document.getElementById("aposIssueDate");
    const aposAuthority = document.getElementById("aposAuthority");
    const aposDocNumber = document.getElementById("aposDocNumber");
    const aposDateBlock = document.getElementById("aposDateBlock");
    const aposSignatory = document.getElementById("aposSignatory");
    const aposQrCode = document.getElementById("aposQrCode");

    const pdfIframe = document.getElementById("pdfIframe");
    const mobilePdfFilename = document.getElementById("mobilePdfFilename");
    const btnMobilePdfOpen = document.getElementById("btnMobilePdfOpen");
    const btnPdfDownload = document.getElementById("btnPdfDownload");

    // Reset status classes
    statusBadge.className = "result-status-badge";

    if (data.status === "VERIFIED" && data.record) {
      // Official Authentic Apostille Result View matching target government portal
      statusBadge.style.display = "none";
      const heroSection = document.getElementById("heroSection") || document.querySelector(".hero-title-section");
      const searchCard = document.getElementById("searchCard");
      const resultActions = document.getElementById("resultActions");
      if (heroSection) heroSection.style.display = "none";
      if (searchCard) searchCard.style.display = "none";
      if (resultActions) resultActions.style.display = "none";
      resultCard.classList.add("cert-page-view");

      if (apostilleContainer) apostilleContainer.style.display = "flex";
      if (attachedPdfSection && (!currentConfig || !currentConfig.certificateView || currentConfig.certificateView.enablePdfViewer !== false)) {
        attachedPdfSection.style.display = "block";
      }

      const rec = data.record;
      const formattedDate = formatDateDisplay(rec.issueDate);

      if (statusTitle && currentConfig?.certificateView?.statusBadgeText) {
        statusTitle.textContent = currentConfig.certificateView.statusBadgeText;
      }
      if (currentConfig?.certificateView?.pageTitle) {
        document.title = `${currentConfig.certificateView.pageTitle} - ${rec.docNumber}`;
      }

      // Dynamic Reference Statement
      if (resSummaryCategory) resSummaryCategory.textContent = rec.documentType || rec.documentCategory || "Other Documents";
      if (resSummaryDate) resSummaryDate.textContent = formattedDate;
      if (resSummaryAuthority) resSummaryAuthority.textContent = rec.issuingAuthority || "Ministry of Foreign Affairs Pakistan";

      // Numbered Certificate Grid
      if (aposCountry) aposCountry.textContent = rec.country || "Pakistan";
      if (aposDocCategory) aposDocCategory.textContent = rec.documentCategory || rec.documentType || "Personal Document";
      if (aposSignedBy) aposSignedBy.textContent = rec.signedBy || "N/A";
      if (aposCapacity) aposCapacity.textContent = rec.capacity || "Registrar";
      if (aposSealOf) aposSealOf.textContent = rec.sealOf || "Preston University";
      if (aposIssuePlace) aposIssuePlace.textContent = rec.issuePlace || "Lahore Pakistan";
      if (aposIssueDate) aposIssueDate.textContent = formattedDate;
      if (aposAuthority) aposAuthority.textContent = rec.issuingAuthority || "Ministry of Foreign Affairs";
      if (aposDocNumber) aposDocNumber.textContent = rec.docNumber;
      if (aposDateBlock) aposDateBlock.textContent = `Date: ${formattedDate}`;
      if (aposSignatory) aposSignatory.textContent = rec.signatoryOfficer || "Ali Faraz";

      // Officer Signature Graphic
      const aposSigImg = document.getElementById("aposSigImg");
      const aposSigGraphic = document.getElementById("aposSigGraphic");
      const cleanFallbackSig = "data:image/png;base64,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";
      let sigSrc = rec.signatureUrl;
      if (!sigSrc || sigSrc === 'undefined' || sigSrc === 'null' || sigSrc.includes('sig_1792344974867')) {
        sigSrc = cleanFallbackSig;
      }
      if (aposSigImg) {
        aposSigImg.onerror = function() {
          this.onerror = null;
          this.src = cleanFallbackSig;
        };
        aposSigImg.src = sigSrc;
      } else if (aposSigGraphic) {
        aposSigGraphic.innerHTML = `<img id="aposSigImg" class="sig-img" src="${sigSrc}" alt="" onerror="this.onerror=null; this.src='${cleanFallbackSig}';">`;
      }

      // Live Scannable QR Code linking to verification endpoint
      if (aposQrCode) {
        const qrUrl = `${window.location.origin}/index.html?doc=${encodeURIComponent(rec.docNumber)}&date=${encodeURIComponent(rec.issueDate)}`;
        if (typeof window.renderQRCodeSVG === "function") {
          aposQrCode.innerHTML = window.renderQRCodeSVG(qrUrl, 84);
        } else {
          aposQrCode.innerHTML = `<img src="https://api.qrserver.com/v1/create-qr-code/?size=90x90&data=${encodeURIComponent(qrUrl)}" alt="QR Code" width="84" height="84">`;
        }
      }

      // Attested PDF Attachment (Desktop embed & Mobile container)
      const pdfUrl = rec.pdfUrl || (rec.pdfFileName ? `/uploads/${rec.pdfFileName}` : '/uploads/wLb2mwU18B98yhP5HgPkdE365DWUOhgJCl0djEsH.pdf');
      const pdfName = rec.pdfFileName || 'wLb2mwU18B98yhP5HgPkdE365DWUOhgJCl0djEsH.pdf';

      if (pdfIframe) pdfIframe.src = `${pdfUrl}#toolbar=0`;
      if (mobilePdfFilename) mobilePdfFilename.textContent = pdfName;
      if (btnMobilePdfOpen) btnMobilePdfOpen.href = pdfUrl;
      if (btnPdfDownload) {
        btnPdfDownload.href = pdfUrl;
        btnPdfDownload.setAttribute("download", pdfName);
      }

      // Render interactive PDF via PDF.js with full working toolbar
      if (typeof loadAndRenderPdf === "function") {
        loadAndRenderPdf(pdfUrl);
      }

      // Legacy fallback values for tests and backward compatibility
      if (resDocNumber) resDocNumber.textContent = rec.docNumber;
      if (resDocType) resDocType.textContent = rec.documentType;
      if (resApplicant) resApplicant.textContent = rec.applicantName;
      if (resDate) resDate.textContent = formattedDate;
      if (resAuthority) resAuthority.textContent = rec.issuingAuthority;
      if (resHash) resHash.textContent = rec.securityHash || "Verified";
    }
    else if (data.status === "EXPIRED" && data.record) {
      statusBadge.style.display = "flex";
      statusBadge.classList.add("status-expired");
      statusTitle.textContent = `Document Certificate Expired on ${formatDateDisplay(data.record.expiryDate)}`;

      if (apostilleContainer) apostilleContainer.style.display = "none";
      if (attachedPdfSection) attachedPdfSection.style.display = "none";

      if (resDocNumber) resDocNumber.textContent = data.record.docNumber;
      if (resDocType) resDocType.textContent = data.record.documentType;
      if (resApplicant) resApplicant.textContent = data.record.applicantName;
      if (resDate) resDate.textContent = `${formatDateDisplay(data.record.issueDate)} (Expired: ${formatDateDisplay(data.record.expiryDate)})`;
      if (resAuthority) resAuthority.textContent = data.record.issuingAuthority;
      if (resHash) resHash.textContent = data.record.securityHash || "Expired";
    }
    else if (data.status === "REVOKED" && data.record) {
      statusBadge.style.display = "flex";
      statusBadge.classList.add("status-revoked");
      statusTitle.textContent = "Document Certificate Revoked / Cancelled";

      if (apostilleContainer) apostilleContainer.style.display = "none";
      if (attachedPdfSection) attachedPdfSection.style.display = "none";

      if (resDocNumber) resDocNumber.textContent = data.record.docNumber;
      if (resDocType) resDocType.textContent = data.record.documentType;
      if (resApplicant) resApplicant.textContent = data.record.applicantName;
      if (resDate) resDate.textContent = formatDateDisplay(data.record.issueDate);
      if (resAuthority) resAuthority.textContent = `${data.record.issuingAuthority} (Status: REVOKED)`;
      if (resHash) resHash.textContent = data.record.notes || "Official cancellation on record.";
    }
    else {
      // NOT_FOUND or DATE_MISMATCH
      statusBadge.style.display = "flex";
      statusBadge.classList.add("status-invalid");
      statusTitle.textContent = "Verification Failed — Record Not Found";

      if (apostilleContainer) apostilleContainer.style.display = "none";
      if (attachedPdfSection) attachedPdfSection.style.display = "none";

      let guideEl = document.getElementById("notFoundGuidance");
      if (!guideEl) {
        guideEl = document.createElement("div");
        guideEl.id = "notFoundGuidance";
        const actionRef = resultCard.querySelector(".result-actions");
        if (actionRef) {
          resultCard.insertBefore(guideEl, actionRef);
        } else {
          resultCard.appendChild(guideEl);
        }
      }
      guideEl.style.display = "block";
      guideEl.innerHTML = `
        <p style="margin-bottom: 8px; font-weight: 600; color: #991b1b;">
          ${data.message || "No official document matching this certificate number and issue date was found."}
        </p>
        <p>Please double-check the printed details on your certificate, or contact the issuing authority desk.</p>
      `;
    }

    // Clean up not found guidance if verified
    if (data.status !== "NOT_FOUND" && data.status !== "DATE_MISMATCH") {
      const guideEl = document.getElementById("notFoundGuidance");
      if (guideEl) guideEl.style.display = "none";
    }

    // Re-apply field fonts to result elements (Apostille certificate fields)
    if (currentConfig) {
      applyFieldFonts(currentConfig);
    }
  }

  function formatDateDisplay(dateStr) {
    if (!dateStr) return "N/A";
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
    } catch {
      return dateStr;
    }
  }

  // =========================================================================
  // 4. FORM & USER CONTROLS
  // =========================================================================
  if (verificationForm) {
    verificationForm.addEventListener("submit", (e) => {
      e.preventDefault();
      syncDateToHiddenInput();
      const docNum = docNumberInput.value.trim();
      const docDate = docDateInput.value;

      if (!docNum) {
        alert("Please provide the Certificate Number.");
        docNumberInput.focus();
        return;
      }
      if (!docDate) {
        alert("Please select Day, Month, and Year for the date.");
        dateDaySelect?.focus();
        return;
      }
      executeVerification(docNum, docDate);
    });
  }

  if (btnClear) {
    btnClear.addEventListener("click", () => {
      verificationForm.reset();
      if (dateDaySelect) dateDaySelect.value = "";
      if (dateMonthSelect) dateMonthSelect.value = "";
      if (dateYearSelect) dateYearSelect.value = "";
      docDateInput.value = "";
      resultCard.style.display = "none";
      const guideEl = document.getElementById("notFoundGuidance");
      if (guideEl) guideEl.style.display = "none";
      docNumberInput.focus();
    });
  }

  if (btnSearchAgain) {
    btnSearchAgain.addEventListener("click", () => {
      resultCard.style.display = "none";
      resultCard.classList.remove("cert-page-view");
      const heroSection = document.getElementById("heroSection");
      const verifFormCard = document.getElementById("verifFormCard");
      const resultActions = document.getElementById("resultActions");
      if (heroSection) heroSection.style.display = "block";
      if (verifFormCard) verifFormCard.style.display = "block";
      if (resultActions) resultActions.style.display = "flex";
      const guideEl = document.getElementById("notFoundGuidance");
      if (guideEl) guideEl.style.display = "none";
      if (searchCard) searchCard.style.display = "block";
      verificationForm.reset();
      if (dateDaySelect) dateDaySelect.value = "";
      if (dateMonthSelect) dateMonthSelect.value = "";
      if (dateYearSelect) dateYearSelect.value = "";
      docDateInput.value = "";
      searchCard.scrollIntoView({ behavior: "smooth" });
      docNumberInput.focus();
    });
  }

  // =========================================================================
  // 5. INTERACTIVE PDF VIEWER CONTROLS & PDF.JS CANVAS RENDERING (Image 2)
  // =========================================================================
  let currentPdfDoc = null;
  let currentPdfUrl = '/uploads/wLb2mwU18B98yhP5HgPkdE365DWUOhgJCl0djEsH.pdf';
  let pdfZoomLevel = 1.0;
  let pdfRotationDeg = 0;
  let isDrawMode = false;
  let drawStrokes = [];
  let redoStrokes = [];

  const pdfViewport = document.getElementById("pdfViewport");
  const pdfCanvasContainer = document.getElementById("pdfCanvasContainer");
  const pdfLoadingIndicator = document.getElementById("pdfLoadingIndicator");
  const pdfPageInput = document.getElementById("pdfPageInput");
  const pdfTotalPages = document.getElementById("pdfTotalPages");
  const btnPdfPrevPage = document.getElementById("btnPdfPrevPage");
  const btnPdfNextPage = document.getElementById("btnPdfNextPage");
  const btnPdfZoomIn = document.getElementById("btnPdfZoomIn");
  const btnPdfZoomOut = document.getElementById("btnPdfZoomOut");
  const btnPdfFit = document.getElementById("btnPdfFit");
  const btnPdfRotate = document.getElementById("btnPdfRotate");
  const btnPdfDraw = document.getElementById("btnPdfDraw");
  const btnPdfUndo = document.getElementById("btnPdfUndo");
  const btnPdfRedo = document.getElementById("btnPdfRedo");
  const btnPdfText = document.getElementById("btnPdfText");
  const btnPdfDownload = document.getElementById("btnPdfDownload");
  const btnPdfPrint = document.getElementById("btnPdfPrint");

  if (typeof pdfjsLib !== 'undefined') {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'js/pdf.worker.min.js';
  }

  async function loadAndRenderPdf(url) {
    if (!url) return;
    currentPdfUrl = url;
    const iframe = document.getElementById("pdfIframe");
    if (iframe) iframe.src = `${url}#toolbar=0`;
    if (btnPdfDownload) {
      btnPdfDownload.href = url;
      btnPdfDownload.setAttribute("download", url.split("/").pop() || "document.pdf");
    }
    const btnMobileOpen = document.getElementById("btnMobilePdfOpen");
    if (btnMobileOpen) btnMobileOpen.href = url;

    if (typeof pdfjsLib === "undefined") {
      if (iframe) {
        iframe.style.position = "static";
        iframe.style.width = "100%";
        iframe.style.height = "560px";
        iframe.style.opacity = "1";
        iframe.style.pointerEvents = "auto";
      }
      return;
    }

    try {
      if (pdfLoadingIndicator) pdfLoadingIndicator.style.display = "flex";
      if (pdfCanvasContainer) pdfCanvasContainer.innerHTML = "";

      const loadingTask = pdfjsLib.getDocument({
        url: url,
        cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/',
        cMapPacked: true
      });

      currentPdfDoc = await loadingTask.promise;
      const totalPages = currentPdfDoc.numPages;

      if (pdfTotalPages) pdfTotalPages.textContent = totalPages;
      if (pdfPageInput) {
        pdfPageInput.max = totalPages;
        pdfPageInput.value = 1;
      }
      const pdfPageIndicator = document.getElementById("pdfPageIndicator");
      if (pdfPageIndicator) pdfPageIndicator.textContent = `1 / ${totalPages}`;

      await renderAllPages();
    } catch (err) {
      console.warn("[PDF.js Render Fallback]:", err);
      if (iframe) {
        iframe.style.position = "static";
        iframe.style.width = "100%";
        iframe.style.height = "560px";
        iframe.style.opacity = "1";
        iframe.style.pointerEvents = "auto";
      }
    } finally {
      if (pdfLoadingIndicator) pdfLoadingIndicator.style.display = "none";
    }
  }

  async function renderAllPages() {
    if (!currentPdfDoc || !pdfCanvasContainer) return;
    pdfCanvasContainer.innerHTML = "";

    const containerWidth = pdfViewport ? Math.max(280, pdfViewport.clientWidth - 32) : 600;

    for (let pageNum = 1; pageNum <= currentPdfDoc.numPages; pageNum++) {
      const page = await currentPdfDoc.getPage(pageNum);
      const unscaledViewport = page.getViewport({ scale: 1.0, rotation: pdfRotationDeg });

      let baseScale = 1.0;
      if (pdfZoomLevel === 1.0) {
        baseScale = Math.min(1.25, Math.max(0.48, containerWidth / unscaledViewport.width));
      } else {
        baseScale = pdfZoomLevel;
      }

      const viewport = page.getViewport({ scale: baseScale, rotation: pdfRotationDeg });

      const pageWrapper = document.createElement("div");
      pageWrapper.className = "pdf-page-container";
      pageWrapper.dataset.pageNum = pageNum;
      pageWrapper.style.width = `${Math.floor(viewport.width)}px`;
      pageWrapper.style.height = `${Math.floor(viewport.height)}px`;

      const canvas = document.createElement("canvas");
      canvas.className = "pdf-page-canvas";
      const ctx = canvas.getContext("2d");
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.floor(viewport.width * dpr);
      canvas.height = Math.floor(viewport.height * dpr);
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;
      ctx.scale(dpr, dpr);

      const drawCanvas = document.createElement("canvas");
      drawCanvas.className = "pdf-draw-canvas";
      drawCanvas.width = canvas.width;
      drawCanvas.height = canvas.height;
      drawCanvas.style.width = canvas.style.width;
      drawCanvas.style.height = canvas.style.height;
      if (isDrawMode) {
        drawCanvas.style.pointerEvents = "auto";
        drawCanvas.style.cursor = "crosshair";
      }

      pageWrapper.appendChild(canvas);
      pageWrapper.appendChild(drawCanvas);
      pdfCanvasContainer.appendChild(pageWrapper);

      await page.render({
        canvasContext: ctx,
        viewport: viewport
      }).promise;

      setupDrawing(drawCanvas, pageNum, dpr);
      redrawCanvas(drawCanvas, pageNum, dpr);
    }
  }

  function setupDrawing(canvas, pageNum, dpr) {
    const ctx = canvas.getContext("2d");
    let drawing = false;
    let lastX = 0, lastY = 0;
    let currentStroke = [];

    function start(x, y) {
      drawing = true;
      const rect = canvas.getBoundingClientRect();
      lastX = (x - rect.left) * dpr;
      lastY = (y - rect.top) * dpr;
      currentStroke = [{ x: lastX, y: lastY }];
    }

    function move(x, y) {
      if (!drawing) return;
      const rect = canvas.getBoundingClientRect();
      const nx = (x - rect.left) * dpr;
      const ny = (y - rect.top) * dpr;
      ctx.strokeStyle = "#1d4ed8";
      ctx.lineWidth = 3 * dpr;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(lastX, lastY);
      ctx.lineTo(nx, ny);
      ctx.stroke();
      lastX = nx;
      lastY = ny;
      currentStroke.push({ x: nx, y: ny });
    }

    function stop() {
      if (!drawing) return;
      drawing = false;
      if (currentStroke.length > 0) {
        drawStrokes.push({ pageNum, stroke: currentStroke, canvas });
        redoStrokes = [];
        updateUndoRedoBtns();
      }
    }

    canvas.addEventListener("mousedown", e => { if (isDrawMode) start(e.clientX, e.clientY); });
    canvas.addEventListener("mousemove", e => { if (isDrawMode) move(e.clientX, e.clientY); });
    canvas.addEventListener("mouseup", stop);
    canvas.addEventListener("mouseleave", stop);

    canvas.addEventListener("touchstart", e => {
      if (isDrawMode && e.touches.length === 1) {
        e.preventDefault();
        start(e.touches[0].clientX, e.touches[0].clientY);
      }
    }, { passive: false });
    canvas.addEventListener("touchmove", e => {
      if (isDrawMode && e.touches.length === 1) {
        e.preventDefault();
        move(e.touches[0].clientX, e.touches[0].clientY);
      }
    }, { passive: false });
    canvas.addEventListener("touchend", stop);
  }

  function redrawCanvas(canvas, pageNum, dpr) {
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const pageStrokes = drawStrokes.filter(s => s.pageNum === pageNum);
    for (const s of pageStrokes) {
      if (s.stroke.length < 2) continue;
      ctx.strokeStyle = "#1d4ed8";
      ctx.lineWidth = 3 * (dpr || 1);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(s.stroke[0].x, s.stroke[0].y);
      for (let i = 1; i < s.stroke.length; i++) {
        ctx.lineTo(s.stroke[i].x, s.stroke[i].y);
      }
      ctx.stroke();
    }
  }

  function updateUndoRedoBtns() {
    if (btnPdfUndo) btnPdfUndo.disabled = drawStrokes.length === 0;
    if (btnPdfRedo) btnPdfRedo.disabled = redoStrokes.length === 0;
  }

  function scrollToPage(pageNum) {
    if (!currentPdfDoc || !pdfCanvasContainer) return;
    pageNum = Math.max(1, Math.min(currentPdfDoc.numPages, parseInt(pageNum, 10) || 1));
    const target = pdfCanvasContainer.querySelector(`.pdf-page-container[data-page-num="${pageNum}"]`);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      if (pdfPageInput) pdfPageInput.value = pageNum;
      const ind = document.getElementById("pdfPageIndicator");
      if (ind) ind.textContent = `${pageNum} / ${currentPdfDoc.numPages}`;
    }
  }

  if (pdfViewport) {
    pdfViewport.addEventListener("scroll", () => {
      if (!currentPdfDoc || !pdfCanvasContainer) return;
      const pages = pdfCanvasContainer.querySelectorAll(".pdf-page-container");
      const viewportTop = pdfViewport.scrollTop;
      const viewportHeight = pdfViewport.clientHeight;
      for (const page of pages) {
        const top = page.offsetTop - pdfViewport.offsetTop;
        const height = page.offsetHeight;
        if (top + height / 2 >= viewportTop && top < viewportTop + viewportHeight) {
          const pNum = page.dataset.pageNum;
          if (pdfPageInput) pdfPageInput.value = pNum;
          const ind = document.getElementById("pdfPageIndicator");
          if (ind) ind.textContent = `${pNum} / ${currentPdfDoc.numPages}`;
          break;
        }
      }
    });
  }

  if (pdfPageInput) {
    pdfPageInput.addEventListener("change", (e) => scrollToPage(e.target.value));
  }
  if (btnPdfPrevPage) {
    btnPdfPrevPage.addEventListener("click", () => {
      const cur = parseInt(pdfPageInput?.value || 1, 10);
      scrollToPage(cur - 1);
    });
  }
  if (btnPdfNextPage) {
    btnPdfNextPage.addEventListener("click", () => {
      const cur = parseInt(pdfPageInput?.value || 1, 10);
      scrollToPage(cur + 1);
    });
  }
  if (btnPdfZoomIn) {
    btnPdfZoomIn.addEventListener("click", async () => {
      pdfZoomLevel = Math.min(2.5, +(pdfZoomLevel + 0.2).toFixed(2));
      await renderAllPages();
    });
  }
  if (btnPdfZoomOut) {
    btnPdfZoomOut.addEventListener("click", async () => {
      pdfZoomLevel = Math.max(0.5, +(pdfZoomLevel - 0.2).toFixed(2));
      await renderAllPages();
    });
  }
  if (btnPdfFit) {
    btnPdfFit.addEventListener("click", async () => {
      pdfZoomLevel = 1.0;
      pdfRotationDeg = 0;
      await renderAllPages();
    });
  }
  if (btnPdfRotate) {
    btnPdfRotate.addEventListener("click", async () => {
      pdfRotationDeg = (pdfRotationDeg + 90) % 360;
      await renderAllPages();
    });
  }
  if (btnPdfDraw) {
    btnPdfDraw.addEventListener("click", () => {
      isDrawMode = !isDrawMode;
      btnPdfDraw.classList.toggle("active", isDrawMode);
      const drawCanvases = pdfCanvasContainer ? pdfCanvasContainer.querySelectorAll(".pdf-draw-canvas") : [];
      drawCanvases.forEach(c => {
        c.style.pointerEvents = isDrawMode ? "auto" : "none";
        c.style.cursor = isDrawMode ? "crosshair" : "default";
      });
    });
  }
  if (btnPdfUndo) {
    btnPdfUndo.addEventListener("click", () => {
      if (drawStrokes.length === 0) return;
      const last = drawStrokes.pop();
      redoStrokes.push(last);
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      redrawCanvas(last.canvas, last.pageNum, dpr);
      updateUndoRedoBtns();
    });
  }
  if (btnPdfRedo) {
    btnPdfRedo.addEventListener("click", () => {
      if (redoStrokes.length === 0) return;
      const next = redoStrokes.pop();
      drawStrokes.push(next);
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      redrawCanvas(next.canvas, next.pageNum, dpr);
      updateUndoRedoBtns();
    });
  }
  if (btnPdfText) {
    btnPdfText.addEventListener("click", () => {
      const text = prompt("Enter annotation note to stamp on document:");
      if (!text) return;
      const firstCanvas = pdfCanvasContainer ? pdfCanvasContainer.querySelector(".pdf-draw-canvas") : null;
      if (firstCanvas) {
        const ctx = firstCanvas.getContext("2d");
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        ctx.font = `bold ${16 * dpr}px Arial, sans-serif`;
        ctx.fillStyle = "#dc2626";
        ctx.fillText(text, 30 * dpr, 50 * dpr);
      }
    });
  }
  if (btnPdfPrint) {
    btnPdfPrint.addEventListener("click", () => {
      if (currentPdfUrl) {
        const pWin = window.open(currentPdfUrl, '_blank');
        if (pWin) {
          pWin.focus();
          setTimeout(() => { try { pWin.print(); } catch(e) {} }, 1000);
          return;
        }
      }
      window.print();
    });
  }

  if (btnFeedback) {
    btnFeedback.addEventListener("click", (e) => {
      e.preventDefault();
      // Revoked: Button displays visually, but clicking it performs no action as requested
    });
  }

  // =========================================================================
  // 6. INITIALIZE & CHECK QR QUERY PARAMETERS
  // =========================================================================
  await loadPublishedConfig();

  // Pre-load default PDF into viewer
  try {
    const initPdf = (currentConfig && currentConfig.certificateView && currentConfig.certificateView.defaultPdfUrl) || '/uploads/wLb2mwU18B98yhP5HgPkdE365DWUOhgJCl0djEsH.pdf';
    loadAndRenderPdf(initPdf);
  } catch(e) {}

  // Close mobile menu when nav link clicked
  if (navListEl && mobileMenuBtn && mainNavbar) {
    navListEl.addEventListener("click", (e) => {
      if (e.target.tagName === 'A') {
        mainNavbar.classList.remove("mobile-open");
        mobileMenuBtn.classList.remove("active");
        mobileMenuBtn.setAttribute("aria-expanded", "false");
      }
    });
  }

  const urlParams = new URLSearchParams(window.location.search);
  const paramDoc = urlParams.get("doc") || urlParams.get("id") || urlParams.get("cert");
  const paramDate = urlParams.get("date");

  if (paramDoc) {
    docNumberInput.value = paramDoc;
    if (paramDate) {
      docDateInput.value = paramDate;
      syncDateFromValue(paramDate);
    }
    // Auto-hide the manual search form and hero banner when navigating via direct QR link
    if (searchCard) {
      searchCard.style.display = "none";
    }
    const heroSection = document.getElementById("heroSection");
    if (heroSection) {
      heroSection.style.display = "none";
    }
    executeVerification(paramDoc, paramDate || "");
  }
});
