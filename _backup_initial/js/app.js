/**
 * Document Verification Portal - Client-Side Controller
 * Handles modal display, form submission, QR code URL parameter parsing, and result view.
 */

document.addEventListener("DOMContentLoaded", () => {
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

  // Output elements
  const resDocNumber = document.getElementById("resDocNumber");
  const resDate = document.getElementById("resDate");

  // =========================================================================
  // 1. ANNOUNCEMENT NOTICE MODAL
  // =========================================================================
  // Show modal once per session
  const noticeDismissed = sessionStorage.getItem("notice_dismissed");
  if (!noticeDismissed && noticeModal) {
    setTimeout(() => {
      noticeModal.classList.add("active");
    }, 400);
  }

  function dismissNotice() {
    if (noticeModal) {
      noticeModal.classList.remove("active");
      sessionStorage.setItem("notice_dismissed", "true");
    }
  }

  if (closeModalBtn) closeModalBtn.addEventListener("click", dismissNotice);
  if (modalAcknowledgeBtn) modalAcknowledgeBtn.addEventListener("click", dismissNotice);

  // Close modal on background click
  if (noticeModal) {
    noticeModal.addEventListener("click", (e) => {
      if (e.target === noticeModal) {
        dismissNotice();
      }
    });
  }

  // =========================================================================
  // 2. URL QUERY PARAMETER HANDLING (For QR Code Scans)
  // Example: ?doc=ADG-HYUI-QRTY-BGHN&date=2026-10-18
  // =========================================================================
  const urlParams = new URLSearchParams(window.location.search);
  const paramDoc = urlParams.get("doc") || urlParams.get("id") || urlParams.get("cert");
  const paramDate = urlParams.get("date");

  if (paramDoc) {
    docNumberInput.value = paramDoc;
    if (paramDate) {
      docDateInput.value = paramDate;
    } else {
      // Default to today if date not specified
      docDateInput.value = new Date().toISOString().split("T")[0];
    }
    // Auto-trigger verification if scanned via QR
    executeVerification(paramDoc, docDateInput.value);
  }

  // =========================================================================
  // 3. FORM ACTIONS
  // =========================================================================
  if (verificationForm) {
    verificationForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const docNum = docNumberInput.value.trim();
      const docDate = docDateInput.value;

      if (!docNum || !docDate) {
        alert("Please provide both Certificate Number and Date.");
        return;
      }

      executeVerification(docNum, docDate);
    });
  }

  function executeVerification(docNum, dateVal) {
    // Show loading state
    btnVerify.disabled = true;
    const originalText = btnVerify.textContent;
    btnVerify.textContent = "Verifying...";

    setTimeout(() => {
      btnVerify.disabled = false;
      btnVerify.textContent = originalText;

      // Populate result details
      if (resDocNumber) resDocNumber.textContent = docNum.toUpperCase();
      if (resDate) {
        try {
          const parsed = new Date(dateVal);
          resDate.textContent = parsed.toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "short",
            year: "numeric"
          });
        } catch {
          resDate.textContent = dateVal;
        }
      }

      // Display result view
      resultCard.style.display = "block";
      resultCard.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 600);
  }

  // Clear data handler
  if (btnClear) {
    btnClear.addEventListener("click", () => {
      verificationForm.reset();
      resultCard.style.display = "none";
      docNumberInput.focus();
    });
  }

  // Search again handler
  if (btnSearchAgain) {
    btnSearchAgain.addEventListener("click", () => {
      resultCard.style.display = "none";
      verificationForm.reset();
      searchCard.scrollIntoView({ behavior: "smooth" });
      docNumberInput.focus();
    });
  }

  // =========================================================================
  // 4. FEEDBACK BUTTON
  // =========================================================================
  if (btnFeedback) {
    btnFeedback.addEventListener("click", () => {
      const feedback = prompt("Please enter your feedback or inquiry:");
      if (feedback && feedback.trim()) {
        alert("Thank you! Your feedback has been submitted to the support desk.");
      }
    });
  }
});
