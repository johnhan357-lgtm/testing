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
      if (brandTitleEl) brandTitleEl.textContent = cfg.branding.authorityName;
      if (brandSubtitleEl) brandSubtitleEl.textContent = cfg.branding.authoritySubtitle;

      // Handle custom uploaded logo or default SVG
      if (cfg.branding.logoType === 'custom_image' && cfg.branding.logoUrl && brandEmblemEl) {
        brandEmblemEl.innerHTML = `<img src="${cfg.branding.logoUrl}" alt="Brand Logo" style="max-height: 100%; max-width: 100%; object-fit: contain;">`;
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
      if (helpTextEl && cfg.verificationCard.helpText) {
        const email = cfg.verificationCard.supportEmail || 'support@verification-portal.org';
        helpTextEl.innerHTML = `If you need further help email <a href="mailto:${email}">${email}</a> with the certificate number and date`;
      }
    }

    // Apply Notice Modal Configuration
    if (cfg.noticeModal) {
      if (cfg.noticeModal.enabled === false) {
        if (noticeModal) noticeModal.style.display = 'none';
      } else {
        const modalTitle = document.getElementById("modalTitle");
        const modalBody = document.querySelector(".modal-body-text");
        const modalRegional = document.querySelector(".modal-regional-text");
        const modalBtn = document.getElementById("modalAcknowledgeBtn");

        if (modalTitle && cfg.noticeModal.title) modalTitle.textContent = cfg.noticeModal.title;
        if (modalBody && cfg.noticeModal.bodyEnglish) modalBody.innerHTML = cfg.noticeModal.bodyEnglish.replace(/\n/g, '<br>');
        if (modalRegional && cfg.noticeModal.bodyRegional) modalRegional.textContent = cfg.noticeModal.bodyRegional;
        if (modalBtn && cfg.noticeModal.confirmButtonText) modalBtn.textContent = cfg.noticeModal.confirmButtonText;

        // Auto display modal on first visit in session
        const noticeDismissed = sessionStorage.getItem("notice_dismissed");
        if (!noticeDismissed && noticeModal) {
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
        elWatermark.style.backgroundImage = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='240' height='75' viewBox='0 0 240 75'%3E%3Ctext x='10' y='42' transform='rotate(-20 120 37)' font-family='Arial, sans-serif' font-weight='800' font-size='13' fill='rgba(1, 65, 28, 0.055)' letter-spacing='2'%3E${wmText}%3C/text%3E%3C/svg%3E")`;
      }

      if (elPdfSection) {
        elPdfSection.style.display = cv.enablePdfViewer === false ? 'none' : '';
      }
    }
  }

  // =========================================================================
  // 2. MODAL CONTROLS
  // =========================================================================
  function dismissNotice() {
    if (noticeModal) {
      noticeModal.classList.remove("active");
      sessionStorage.setItem("notice_dismissed", "true");
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

      const data = await response.json();
      btnVerify.disabled = false;
      btnVerify.textContent = originalText;

      renderVerificationResult(data, docNum, dateVal);
    } catch (err) {
      console.error('[Verification Error]:', err);
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
      // Official Authentic Apostille Result View
      statusBadge.style.display = "none";
      if (apostilleContainer) apostilleContainer.style.display = "flex";
      if (attachedPdfSection && (!currentConfig || !currentConfig.certificateView || currentConfig.certificateView.enablePdfViewer !== false)) {
        attachedPdfSection.style.display = "block";
      }

      const rec = data.record;
      const formattedDate = formatDateDisplay(rec.issueDate);

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
      if (btnPdfDownload) btnPdfDownload.href = pdfUrl;

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
        guideEl.style.cssText = "padding: 20px; text-align: center; color: #4b5563; font-size: 0.95rem; line-height: 1.6;";
        resultCard.insertBefore(guideEl, resultCard.querySelector(".result-actions"));
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
  // 5. PDF VIEWER TOOLBAR CONTROLS
  // =========================================================================
  let pdfZoomLevel = 1.0;
  let pdfRotationDeg = 0;
  const btnPdfZoomIn = document.getElementById("btnPdfZoomIn");
  const btnPdfZoomOut = document.getElementById("btnPdfZoomOut");
  const btnPdfFit = document.getElementById("btnPdfFit");
  const btnPdfRotate = document.getElementById("btnPdfRotate");
  const btnPdfPrint = document.getElementById("btnPdfPrint");

  function updatePdfTransform() {
    const iframe = document.getElementById("pdfIframe");
    if (iframe) {
      iframe.style.transform = `scale(${pdfZoomLevel}) rotate(${pdfRotationDeg}deg)`;
      iframe.style.transformOrigin = "top center";
      iframe.style.transition = "transform 0.2s ease";
    }
  }

  if (btnPdfZoomIn) {
    btnPdfZoomIn.addEventListener("click", () => {
      pdfZoomLevel = Math.min(2.0, pdfZoomLevel + 0.15);
      updatePdfTransform();
    });
  }
  if (btnPdfZoomOut) {
    btnPdfZoomOut.addEventListener("click", () => {
      pdfZoomLevel = Math.max(0.6, pdfZoomLevel - 0.15);
      updatePdfTransform();
    });
  }
  if (btnPdfFit) {
    btnPdfFit.addEventListener("click", () => {
      pdfZoomLevel = 1.0;
      pdfRotationDeg = 0;
      updatePdfTransform();
    });
  }
  if (btnPdfRotate) {
    btnPdfRotate.addEventListener("click", () => {
      pdfRotationDeg = (pdfRotationDeg + 90) % 360;
      updatePdfTransform();
    });
  }
  if (btnPdfPrint) {
    btnPdfPrint.addEventListener("click", () => {
      const iframe = document.getElementById("pdfIframe");
      if (iframe && iframe.contentWindow) {
        try {
          iframe.contentWindow.print();
          return;
        } catch {}
      }
      window.print();
    });
  }

  if (btnFeedback) {
    btnFeedback.addEventListener("click", () => {
      if (currentConfig && currentConfig.floatingFeedback && currentConfig.floatingFeedback.actionType === 'custom_link') {
        const url = currentConfig.floatingFeedback.customUrl;
        if (url) {
          window.open(url, '_blank');
          return;
        }
      }
      const feedback = prompt("Please enter your feedback or inquiry:");
      if (feedback && feedback.trim()) {
        alert("Thank you! Your feedback has been received.");
      }
    });
  }

  // =========================================================================
  // 6. INITIALIZE & CHECK QR QUERY PARAMETERS
  // =========================================================================
  await loadPublishedConfig();

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
    // Auto-hide the manual search form when navigating via direct QR link
    if (searchCard) {
      searchCard.style.display = "none";
    }
    executeVerification(paramDoc, paramDate || "");
  }
});
