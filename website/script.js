const header = document.querySelector(".site-header");
const revealItems = document.querySelectorAll(".reveal");
const languagePicker = document.querySelector("[data-language-picker]");
const languageTrigger = document.querySelector("#language-trigger");
const languageMenu = document.querySelector(".language-menu");
const feedbackForms = document.querySelectorAll("[data-feedback-form]");
const countedFields = document.querySelectorAll("[data-counted-field]");
const feedbackModal = document.querySelector("[data-feedback-modal]");
const feedbackModalConfirm = document.querySelector("[data-feedback-modal-confirm]");
const gatewayChoices = document.querySelectorAll(".gateway-choice");
const zoomImages = document.querySelectorAll("[data-zoom-image]");
const scenarioBoards = document.querySelectorAll("[data-scenario-board]");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

let headerIsScrolled = false;
let ticking = false;
let feedbackRedirectTimer;
let gatewayCloseTimer;
let imageLightbox;

const closeImageLightbox = () => {
  if (!imageLightbox) return;
  imageLightbox.hidden = true;
  imageLightbox.querySelector("img")?.removeAttribute("src");
};

const ensureImageLightbox = () => {
  if (imageLightbox) return imageLightbox;

  imageLightbox = document.createElement("div");
  imageLightbox.className = "image-lightbox";
  imageLightbox.hidden = true;
  imageLightbox.innerHTML = `
    <button class="image-lightbox-close" type="button" aria-label="Close image preview">&times;</button>
    <img alt="">
  `;
  document.body.append(imageLightbox);

  imageLightbox.addEventListener("click", closeImageLightbox);

  return imageLightbox;
};

const openImageLightbox = (image) => {
  const lightbox = ensureImageLightbox();
  const preview = lightbox.querySelector("img");
  preview.src = image.currentSrc || image.src;
  preview.alt = image.alt || "";
  lightbox.hidden = false;
  lightbox.querySelector(".image-lightbox-close")?.focus();
};

const activateGatewayChoice = (choice) => {
  window.clearTimeout(gatewayCloseTimer);
  gatewayChoices.forEach((item) => {
    item.classList.toggle("is-active", item === choice);
  });
};

const scheduleGatewayClose = () => {
  window.clearTimeout(gatewayCloseTimer);
  gatewayCloseTimer = window.setTimeout(() => {
    gatewayChoices.forEach((item) => item.classList.remove("is-active"));
  }, 600);
};

gatewayChoices.forEach((choice) => {
  choice.addEventListener("mouseenter", () => activateGatewayChoice(choice));
  choice.addEventListener("focusin", () => activateGatewayChoice(choice));
  choice.addEventListener("mouseleave", scheduleGatewayClose);
  choice.addEventListener("focusout", (event) => {
    if (choice.contains(event.relatedTarget)) return;
    scheduleGatewayClose();
  });
});

zoomImages.forEach((image) => {
  image.addEventListener("click", () => openImageLightbox(image));
  image.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    openImageLightbox(image);
  });
});

scenarioBoards.forEach((board) => {
  const tabs = Array.from(board.querySelectorAll("[data-scenario-target]"));
  const panels = Array.from(board.querySelectorAll("[data-scenario-panel]"));

  const activateScenario = (target) => {
    tabs.forEach((tab) => {
      const active = tab.dataset.scenarioTarget === target;
      tab.classList.toggle("is-active", active);
      tab.setAttribute("aria-selected", String(active));
    });
    panels.forEach((panel) => {
      const active = panel.dataset.scenarioPanel === target;
      panel.classList.toggle("is-active", active);
      panel.hidden = !active;
    });
  };

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => activateScenario(tab.dataset.scenarioTarget));
  });
});

const goHome = () => {
  window.location.href = "./";
};

const showFeedbackModal = () => {
  if (!feedbackModal) {
    goHome();
    return;
  }

  feedbackModal.hidden = false;
  feedbackModalConfirm?.focus();
  window.clearTimeout(feedbackRedirectTimer);
  feedbackRedirectTimer = window.setTimeout(goHome, 5000);
};

feedbackModalConfirm?.addEventListener("click", goHome);

const updateCounter = (field) => {
  const counter = field.parentElement?.querySelector("[data-field-counter]");
  const max = Number(field.dataset.countMax || field.maxLength || 0);
  if (!counter || !max) return;

  const length = field.value.length;
  counter.textContent = `${length} / ${max}`;
  counter.classList.toggle("is-near-limit", length >= Math.floor(max * 0.9));
};

countedFields.forEach((field) => {
  field.addEventListener("input", () => updateCounter(field));
  updateCounter(field);
});

if (languagePicker && languageTrigger && languageMenu) {
  const closeLanguageMenu = () => {
    languagePicker.classList.remove("is-open");
    languageTrigger.setAttribute("aria-expanded", "false");
    languageMenu.hidden = true;
  };

  const openLanguageMenu = () => {
    languagePicker.classList.add("is-open");
    languageTrigger.setAttribute("aria-expanded", "true");
    languageMenu.hidden = false;
  };

  languageTrigger.addEventListener("click", () => {
    if (languageMenu.hidden) {
      openLanguageMenu();
    } else {
      closeLanguageMenu();
    }
  });

  document.addEventListener("click", (event) => {
    if (languagePicker.contains(event.target)) return;
    closeLanguageMenu();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeLanguageMenu();
    }
  });
}

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeImageLightbox();
  }
});

feedbackForms.forEach((form) => {
  const waitingEmail = form.querySelector("[data-waiting-email]");
  const waitingSubmit = form.querySelector("[data-waiting-submit]");
  const status = form.querySelector("[data-form-status]");
  const statusText = (key, fallback) =>
    form.querySelector(`[data-feedback-status="${key}"]`)?.textContent.trim() || fallback;

  const setStatus = (message, state) => {
    if (!status) return;
    status.textContent = message;
    status.classList.toggle("is-success", state === "success");
    status.classList.toggle("is-error", state === "error");
  };

  const updateWaitingSubmit = () => {
    if (!waitingEmail || !waitingSubmit) return;
    waitingSubmit.disabled = !waitingEmail.validity.valid || waitingEmail.value.trim() === "";
  };

  waitingEmail?.addEventListener("input", updateWaitingSubmit);
  updateWaitingSubmit();

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submitButton = form.querySelector('button[type="submit"]');
    const formData = new FormData(form);

    if (formData.get("company")) return;
    if (waitingSubmit && waitingSubmit.disabled) return;

    const type = String(formData.get("type") || "");
    const message = String(formData.get("message") || "").trim();
    const email = String(formData.get("email") || "").trim();
    const customFeature = String(formData.get("customFeature") || "").trim();
    const features = formData.getAll("features");

    if (type === "feedback" && message.length === 0) {
      setStatus(statusText("emptyFeedback", "Please add a short note first."), "error");
      return;
    }

    if (type === "waiting_list" && features.length === 0 && customFeature.length === 0) {
      setStatus(statusText("emptyWaiting", "Pick a feature or add your own idea first."), "error");
      return;
    }

    const payload = {
      type,
      source: formData.get("source"),
      message,
      email,
      features,
      customFeature,
      locale: document.documentElement.lang || "en",
      pageUrl: window.location.href
    };

    submitButton.disabled = true;
    setStatus(statusText("sending", "Sending..."), "");

    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!response.ok) throw new Error("Request failed");

      form.reset();
      countedFields.forEach((field) => updateCounter(field));
      updateWaitingSubmit();
      setStatus(statusText("success", "Received. Thank you."), "success");
      showFeedbackModal();
    } catch {
      setStatus(statusText("error", "Could not send yet. Please try again later."), "error");
    } finally {
      if (submitButton !== waitingSubmit) {
        submitButton.disabled = false;
      }
      updateWaitingSubmit();
    }
  });
});

const updateHeader = () => {
  if (!header) return;

  const shouldBeScrolled = headerIsScrolled ? window.scrollY > 4 : window.scrollY > 28;
  if (shouldBeScrolled === headerIsScrolled) return;

  headerIsScrolled = shouldBeScrolled;
  header.classList.toggle("is-scrolled", headerIsScrolled);
};

updateHeader();
window.addEventListener(
  "scroll",
  () => {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(() => {
      updateHeader();
      ticking = false;
    });
  },
  { passive: true }
);

if (reduceMotion || !("IntersectionObserver" in window)) {
  revealItems.forEach((item) => item.classList.add("is-visible"));
} else {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    },
    { threshold: 0.12 }
  );

  revealItems.forEach((item) => observer.observe(item));
}

const faqItems = document.querySelectorAll(".faq-item");
faqItems.forEach((item) => {
  const question = item.querySelector(".faq-question");
  if (!question) return;
  question.addEventListener("click", () => {
    item.classList.toggle("is-open");
  });
});
