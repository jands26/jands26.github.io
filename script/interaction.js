/* =========================================================
       CORE STORY ENGINE & STATE CONFIGURATION
    ========================================================= */
const slides = Array.from(document.querySelectorAll(".story-slide"));
const progressBarContainer = document.getElementById("progressBarContainer");
const chapterBadge = document.getElementById("chapterBadge");
const pauseIndicator = document.getElementById("pauseIndicator");
const audioToggleBtn = document.getElementById("audioToggleBtn");
const bgAudio = document.getElementById("bgAudio");
const startStoryBtn = document.getElementById("startStoryBtn");
const replayBtn = document.getElementById("replayBtn");
const preloaderScreen = document.getElementById("preloaderScreen");
const preloaderBarFill = document.getElementById("preloaderBarFill");
const preloaderPercent = document.getElementById("preloaderPercent");
let isPreloading = true; // Prevents slides and timers from advancing during preload

let currentSlideIndex = 0;
let isPaused = false;
let slideTimer = null;
let progressInterval = null;
let slideStartTime = 0;
let elapsedTimeOnSlide = 0;
let slideDuration = 6000;
let isMusicPlaying = false;
let audioContext = null; // Lightweight Web Audio synthesizer fallback

// Create progress segments matching slide count
progressBarContainer.innerHTML = "";
slides.forEach((_, idx) => {
  const segment = document.createElement("div");
  segment.className = "progress-segment";
  const fill = document.createElement("div");
  fill.className = "progress-segment-fill";
  fill.id = `fill-${idx}`;
  segment.appendChild(fill);
  progressBarContainer.appendChild(segment);
});

function showSlide(index) {
  if (index < 0) index = 0;
  if (index >= slides.length) index = slides.length - 1;

  // Clear existing active slide & timers
  clearTimeout(slideTimer);
  clearInterval(progressInterval);

  // Stop previous video if exists
  const prevVideo = slides[currentSlideIndex].querySelector("video");
  if (prevVideo) {
    try {
      prevVideo.pause();
    } catch (e) {}
  }

  slides.forEach((slide, idx) => {
    slide.classList.remove("active");
    const fill = document.getElementById(`fill-${idx}`);
    if (idx < index) {
      fill.style.width = "100%";
    } else if (idx > index) {
      fill.style.width = "0%";
    }
  });

  currentSlideIndex = index;
  const activeSlide = slides[currentSlideIndex];
  activeSlide.classList.add("active");

  // Update Top Chapter Pill
  chapterBadge.textContent =
    activeSlide.getAttribute("data-chapter") || "Our Story";

  // Determine duration (allow videos to drive length if longer)
  const configuredDuration =
    parseInt(activeSlide.getAttribute("data-duration"), 10) || 6000;
  const activeVideo = activeSlide.querySelector("video");

  // Check if video exists and has a source in <source> or src
  const hasVideoSource =
    activeVideo &&
    (activeVideo.src ||
      (activeVideo.querySelector("source") &&
        activeVideo.querySelector("source").src));

  if (hasVideoSource) {
    // Ensure video is muted for mobile autoplay policy compliance
    activeVideo.muted = true;
    activeVideo.currentTime = 0;

    // Helper to launch timer once true duration is known
    const startVideoSlide = () => {
      if (!isNaN(activeVideo.duration) && activeVideo.duration > 0.5) {
        // Dynamic duration: video length + 200ms padding
        slideDuration = Math.round(activeVideo.duration * 1000) + 200;
      } else {
        slideDuration = configuredDuration;
      }
      activeVideo
        .play()
        .catch((err) => console.log("Video play deferred:", err));
      elapsedTimeOnSlide = 0;
      startSlideTimer();
    };

    // If metadata (duration) is already loaded:
    if (activeVideo.readyState >= 1) {
      startVideoSlide();
    } else {
      // Otherwise wait for duration metadata to load before starting timer
      activeVideo.addEventListener("loadedmetadata", startVideoSlide, {
        once: true,
      });
      // Fallback if network stalls
      setTimeout(() => {
        if (!slideTimer && elapsedTimeOnSlide === 0) {
          startVideoSlide();
        }
      }, 800);
    }
  } else {
    slideDuration = configuredDuration;
    elapsedTimeOnSlide = 0;
    startSlideTimer();
  }
}

function startSlideTimer() {
  if (isPreloading) return;
  slideStartTime = Date.now() - elapsedTimeOnSlide;
  const targetFill = document.getElementById(`fill-${currentSlideIndex}`);

  progressInterval = setInterval(() => {
    if (!isPaused) {
      elapsedTimeOnSlide = Date.now() - slideStartTime;
      const percentage = Math.min(
        100,
        (elapsedTimeOnSlide / slideDuration) * 100,
      );
      if (targetFill) {
        targetFill.style.width = `${percentage}%`;
      }

      if (elapsedTimeOnSlide >= slideDuration) {
        clearInterval(progressInterval);
        nextSlide();
      }
    }
  }, 30);
}

function nextSlide() {
  if (currentSlideIndex < slides.length - 1) {
    showSlide(currentSlideIndex + 1);
  } else {
    // Reached the end; hold on final card
    clearTimeout(slideTimer);
    clearInterval(progressInterval);
    const lastFill = document.getElementById(`fill-${slides.length - 1}`);
    if (lastFill) lastFill.style.width = "100%";
  }
}

function prevSlide() {
  if (elapsedTimeOnSlide > 1500) {
    // If slide has played more than 1.5s, restart current slide
    showSlide(currentSlideIndex);
  } else if (currentSlideIndex > 0) {
    showSlide(currentSlideIndex - 1);
  } else {
    showSlide(0);
  }
}

function pausePlayback(showIndicator = true) {
  if (isPaused) return;
  isPaused = true;
  if (showIndicator && pauseIndicator) {
    pauseIndicator.classList.add("visible");
  }

  const activeVideo = slides[currentSlideIndex].querySelector("video");
  if (activeVideo) {
    try {
      activeVideo.pause();
    } catch (e) {}
  }
}

function resumePlayback() {
  if (!isPaused) return;
  isPaused = false;
  pauseIndicator.classList.remove("visible");
  slideStartTime = Date.now() - elapsedTimeOnSlide;

  const activeVideo = slides[currentSlideIndex].querySelector("video");
  if (activeVideo) {
    try {
      activeVideo.play().catch(() => {});
    } catch (e) {}
  }
}

function togglePause() {
  if (isPaused) {
    resumePlayback();
  } else {
    pausePlayback();
  }
}

const zoneLeft = document.getElementById("zoneLeft");
const zoneRight = document.getElementById("zoneRight");

// Prevent hold-to-pause from intercepting clicks on left/right zones, buttons, or quizzes
let holdTimeout = null;
let isHolding = false;
const appShell = document.getElementById("appShell");

function startHold(e) {
  // Ignore tap zones, quiz options, buttons, and interactive cards
  if (
    e.target.closest("#zoneLeft") ||
    e.target.closest("#zoneRight") ||
    e.target.closest(".quiz-option") ||
    e.target.closest("button")
  ) {
    return;
  }

  clearTimeout(holdTimeout);
  holdTimeout = setTimeout(() => {
    isHolding = true;
    pausePlayback(true);
  }, 250);
}

function endHold() {
  clearTimeout(holdTimeout);
  if (isHolding) {
    isHolding = false;
    resumePlayback();
  }
}

// Touch events for mobile hold
appShell.addEventListener("touchstart", startHold, { passive: true });
appShell.addEventListener("touchend", endHold);
appShell.addEventListener("touchcancel", endHold);

// Mouse events for desktop hold
appShell.addEventListener("mousedown", startHold);
appShell.addEventListener("mouseup", endHold);

// Left & Right Navigation Clicks
if (zoneLeft) {
  zoneLeft.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (isPaused) resumePlayback();
    prevSlide();
  });
}

if (zoneRight) {
  zoneRight.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (isPaused) resumePlayback();
    nextSlide();
  });
}

// Keyboard support for desktop navigation
window.addEventListener("keydown", (e) => {
  if (e.code === "ArrowRight" || e.code === "Space") {
    nextSlide();
  } else if (e.code === "ArrowLeft") {
    prevSlide();
  }
});

function toggleAudio() {
  if (isMusicPlaying) {
    pauseAudio();
  } else {
    playAudio();
  }
}

function playAudio() {
  if (bgAudio.src && bgAudio.src !== window.location.href) {
    bgAudio
      .play()
      .then(() => {
        isMusicPlaying = true;
        audioToggleBtn.classList.add("playing");
      })
      .catch(() => {
        playAmbientSynthChime();
      });
  } else {
    // Fallback: Web Audio API dreamy synth progression
    playAmbientSynthChime();
  }
}

function pauseAudio() {
  if (bgAudio.src) bgAudio.pause();
  isMusicPlaying = false;
  audioToggleBtn.classList.remove("playing");
}

// Gentle synthesizer chime for when local audio file hasn't been set yet
function playAmbientSynthChime() {
  try {
    if (!audioContext) {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioContext.state === "suspended") {
      audioContext.resume();
    }
    const notes = [261.63, 329.63, 392.0, 523.25]; // C - E - G - C warm arpeggio
    notes.forEach((freq, i) => {
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, audioContext.currentTime + i * 0.22);
      gain.gain.setValueAtTime(0.001, audioContext.currentTime + i * 0.22);
      gain.gain.exponentialRampToValueAtTime(
        0.08,
        audioContext.currentTime + i * 0.22 + 0.1,
      );
      gain.gain.exponentialRampToValueAtTime(
        0.0001,
        audioContext.currentTime + i * 0.22 + 1.2,
      );
      osc.connect(gain);
      gain.connect(audioContext.destination);
      osc.start(audioContext.currentTime + i * 0.22);
      osc.stop(audioContext.currentTime + i * 0.22 + 1.3);
    });
    isMusicPlaying = true;
    audioToggleBtn.classList.add("playing");
    setTimeout(() => {
      if (!bgAudio.src || bgAudio.paused) {
        isMusicPlaying = false;
        audioToggleBtn.classList.remove("playing");
      }
    }, 1800);
  } catch (err) {
    console.warn("Audio not available", err);
  }
}

audioToggleBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  toggleAudio();
});

startStoryBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  playAudio();
  nextSlide();
});

replayBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  showSlide(0);
});

window.handleQuizAnswer = function (
  element,
  isCorrect,
  feedbackBoxId,
  feedbackMessage,
) {
  // Pause automatic story progression so she can read the answer
  pausePlayback(false);

  const parentSlide = element.closest(".story-slide");
  const allOptions = parentSlide.querySelectorAll(".quiz-option");

  allOptions.forEach((opt) => {
    opt.style.pointerEvents = "none"; // prevent re-tapping
    if (opt.getAttribute("data-correct") === "true") {
      opt.classList.add("correct");
    } else {
      opt.classList.add("incorrect");
    }
  });

  const feedbackBox = document.getElementById(feedbackBoxId);
  if (feedbackBox) {
    feedbackBox.innerHTML = `<span>${feedbackMessage}</span>`;
    feedbackBox.style.borderColor = isCorrect
      ? "var(--sage-green)"
      : "var(--crimson-red)";
  }

  if (isCorrect && window.confetti) {
    // Romantic pastel confetti burst
    confetti({
      particleCount: 50,
      spread: 60,
      origin: { y: 0.65 },
      colors: ["#E8A598", "#879883", "#8B2635", "#FAF7F2"],
    });
  }

  // Resume story automatically after 4 seconds if untouched
  setTimeout(() => {
    resumePlayback();
  }, 4000);
};

function preloadAllAssets(onComplete) {
  // 1. Collect all unique image URLs
  const imgElements = Array.from(document.querySelectorAll(".story-slide img"));
  const imageUrls = Array.from(
    new Set(
      imgElements
        .map((img) => img.getAttribute("src"))
        .filter((src) => src && src.trim() !== ""),
    ),
  );

  // 2. Collect all video elements and ensure they do not play during preloading
  const videoElements = Array.from(
    document.querySelectorAll(".story-slide video"),
  );
  videoElements.forEach((vid) => {
    vid.preload = "auto";
    vid.pause();
    vid.currentTime = 0;
  });

  const totalItems = imageUrls.length + videoElements.length;
  let loadedItems = 0;

  if (totalItems === 0) {
    onComplete();
    return;
  }

  const updateProgress = () => {
    loadedItems++;
    const percent = Math.min(100, Math.round((loadedItems / totalItems) * 100));
    if (preloaderBarFill) preloaderBarFill.style.width = `${percent}%`;
    if (preloaderPercent) preloaderPercent.textContent = `${percent}%`;

    if (loadedItems >= totalItems) {
      setTimeout(() => {
        onComplete();
      }, 400); // Brief pause at 100% so it feels smooth
    }
  };

  // Preload Images
  imageUrls.forEach((url) => {
    const img = new Image();
    img.onload = updateProgress;
    img.onerror = updateProgress; // Advance even if an image fails so user isn't stuck
    img.src = url;
  });

  // Preload Videos (wait until ready to play through or first frame loaded)
  videoElements.forEach((video) => {
    if (video.readyState >= 3) {
      updateProgress();
    } else {
      const onVideoReady = () => {
        video.removeEventListener("canplaythrough", onVideoReady);
        video.removeEventListener("loadeddata", onVideoReady);
        video.removeEventListener("error", onVideoReady);
        video.pause();
        updateProgress();
      };

      video.addEventListener("canplaythrough", onVideoReady, { once: true });
      video.addEventListener("loadeddata", onVideoReady, { once: true });
      video.addEventListener("error", onVideoReady, { once: true });
      video.load();
    }
  });

  // Fallback safety timeout: if slow mobile connection stalls on a large video, dismiss after 12s
  setTimeout(() => {
    if (loadedItems < totalItems) {
      onComplete();
    }
  }, 12000);
}

window.onload = function () {
  // Prepare slide 0 visuals without starting timers or videos
  showSlide(0);
  pausePlayback(false);

  preloadAllAssets(() => {
    isPreloading = false;
    if (preloaderScreen) {
      preloaderScreen.classList.add("fade-out");
      setTimeout(() => {
        preloaderScreen.style.display = "none";
        // Unpause and launch slide 0 timer cleanly
        resumePlayback();
      }, 600);
    }
  });
};
