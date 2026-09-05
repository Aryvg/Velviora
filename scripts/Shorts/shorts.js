import { setupSidebarVisibility } from '../general/sidebar-visibility.js';
import { menuesContainerComponent } from '../general/menues-container.js';
import { sharedSidebarSections } from '../general/sidebarSharedContent.js';
import { setupShortsMenus } from './shortsMenus.js';
import { setupNotificationDropdown } from '../notification/notificationDropdown.js';
import { setupProfileDropdown } from '../account/profileDropdown.js';
import { getAccessToken, applyAdminNavVisibility } from '../auth.js';
import { initShortsComments } from './shortsComment.js';
import { initPresence } from '../presence.js';
import { populateNotificationBadge, populateProfileButton } from '../general/Header.js';
import { setupCreateButton } from '../general/setupCreateButton.js';

window.addEventListener('pageshow', (event) => {
  if (event.persisted) {
    populateNotificationBadge();
    populateProfileButton();
  }
});

document.querySelector('.menues-main-container').innerHTML = menuesContainerComponent;

const movingSidebar = document.querySelector('.moving-sidebar');
if (movingSidebar) {
  movingSidebar.innerHTML = sharedSidebarSections;
  applyAdminNavVisibility();
}

populateNotificationBadge();
populateProfileButton();
setupNotificationDropdown();
setupProfileDropdown();
setupSidebarVisibility();
setupShortsMenus();
initPresence();

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', setupCreateButton, { once: true });
} else {
  setupCreateButton();
}

async function fetchShorts(requestedShortId = null) {
  const token = await getAccessToken();
  const headers = token ? { Authorization: 'Bearer ' + token } : {};
  const response = await fetch('https://valviorabackend2.onrender.com/aggregatedShortsApi', { headers });
  if (response.status === 204) return [];
  if (!response.ok) throw new Error(`Failed to load shorts: ${response.status}`);

  const shorts = await response.json();
  const visibleShorts = Array.isArray(shorts)
    ? shorts.filter(item => !Boolean(item.isBanned)).reverse()
    : [];

  if (!requestedShortId || visibleShorts.some(s => s.shortId === requestedShortId)) {
    return visibleShorts;
  }

  try {
    const [summaryRes, contentRes] = await Promise.all([
      fetch('https://valviorabackend2.onrender.com/shortsSummaryApi', { headers }),
      fetch('https://valviorabackend2.onrender.com/shortsContentApi', { headers })
    ]);

    if (!summaryRes.ok || !contentRes.ok) return visibleShorts;

    const summaries = await summaryRes.json();
    const contents = await contentRes.json();
    const contentMap = new Map((Array.isArray(contents) ? contents : []).map(item => [item.shortId, item]));

    const merged = (Array.isArray(summaries) ? summaries : []).map((item) => {
      const content = contentMap.get(item.shortId) || {};
      return {
        ...item,
        ...content,
        shortId: item.shortId,
        title: item.title || content.title || '',
        thumbnail: item.thumbnail || '',
        videoUrl: content.videoUrl || '',
        channelId: item.channelId || content.channelId || '',
        channelName: content.channelName || '',
        ProfilePicture: content.ProfilePicture || '',
        Likes: content.Likes || 0,
        Dislikes: content.Dislikes || 0,
        userReaction: null
      };
    });

    return merged.filter(item => !Boolean(item.isBanned)).reverse();
  } catch (err) {
    console.warn('Fallback Shorts merge failed:', err);
    return visibleShorts;
  }
}

function getShortIdFromUrl() {
  return new URLSearchParams(window.location.search).get('shortId');
}

function renderShorts(shorts) {
  shortsFeed = Array.isArray(shorts) ? shorts : [];
  const container = document.querySelector('.short-video');
  container.innerHTML = shortsFeed.map(short => `
    <div class="shorts-video-container" data-short-id="${short.shortId}" data-channel-id="${short.channelId}">
      <div class="shorts-video-wrapper">
        <video class="shorts-video" width="400">
          <source src="${short.videoUrl}" type="video/mp4">
        </video>
        <div class="shorts-progress">
          <div class="shorts-progress-track"><div class="shorts-progress-fill"></div></div>
        </div>
        <div class="shorts-controls">
          <img src="images/play-button-arrowhead.png" class="control-btn js-play">
          <img src="images/volume-up.png" class="control-btn js-volume">
        </div>
        <div class="shorts-video-description-container">
          <div class="vi-pro">
            <img src="${short.ProfilePicture}" class="shorts-pro-image">
            <div class="shorts-pro-title">${short.channelName}</div>
            <button class="subscribe-btn" data-channel-id="${short.channelId}">Subscribe</button>
          </div>
          <div class="shorts-vi-des">${short.title}</div>
          <div class="shorts-vi-views js-view-count">${formatShortViews(short.views)}</div>
        </div>
      </div>
      <div class="shorts-details-container">
        <div class="shortd">
          <div class="d ${short.userReaction === 'like' ? 'shorts-liked' : ''}"><img src="images/126473.png" class="shorts-like-image"></div>
          <div class="shorts-text">${short.Likes}</div>
        </div>
        <div class="shortd">
          <div class="d ${short.userReaction === 'dislike' ? 'shorts-disliked' : ''}"><img src="images/dont-like.png" class="shorts-dislike-image"></div>
          <div class="shorts-text">${short.Dislikes}</div>
        </div>
        <div class="shortd">
          <div class="d co67g-open-btn"><img src="images/comment.png" class="shorts-comment-image"></div>
          <div class="shorts-text js-comment-count">0</div>
        </div>
        <div class="shortd">
          <div class="d"><img src="images/share.png" class="shorts-share-image"></div>
          <div class="shorts-text">Share</div>
        </div>
        <div class="pro-shorts"><img src="${short.ProfilePicture}" class="shorts-pro-image"></div>
      </div>
    </div>
  `).join('');
}

function truncateProTitles() {
  document.querySelectorAll('.shorts-pro-title').forEach(function(el) {
    if (!el || typeof el.textContent !== 'string') return;
    const text = el.textContent.trim();
    if (text.length > 8) {
      el.textContent = text.slice(0, 8) + '...';
    }
  });
}

function playShortAt(index) {
  const containers = document.querySelectorAll('.shorts-video-container');
  containers.forEach((container, i) => {
    const v = container.querySelector('.shorts-video');
    const p = container.querySelector('.js-play');
    if (!v) return;
    const volBtn = container.querySelector('.js-volume');
    if (i === index) {
      v.muted = false;
      v.play().then(() => {
        if (p) p.src = 'images/pause.png';
        if (volBtn) volBtn.src = 'images/volume-up.png';
      }).catch(() => {
        v.muted = true;
        if (volBtn) volBtn.src = 'images/mute.png';
        v.play().catch(() => {});
        if (p) p.src = 'images/pause.png';
      });
    } else {
      v.pause();
      if (p) p.src = 'images/play-button-arrowhead.png';
    }
  });
}

async function recordShortView(container, shortId) {
  const token = await getAccessToken();
  if (!token) return;

  try {
    const res = await fetch('https://valviorabackend2.onrender.com/shortsSummaryApi', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + token
      },
      body: JSON.stringify({ shortId, Views: 1 })
    });

    if (!res.ok) throw new Error(`Short view update failed: ${res.status}`);

    const data = await res.json().catch(() => null);
    const nextViews = typeof data?.views === 'number' ? data.views : null;
    if (nextViews !== null) {
      const currentShort = shortsFeed.find((item) => item.shortId === shortId);
      if (currentShort) currentShort.views = nextViews;
      updateShortViewCount(container, nextViews);
    }
  } catch (err) {
    console.warn('Failed to record short view', err);
  }
}

function initShortsInteractions() {
  const shortContainers = document.querySelectorAll('.shorts-video-container');

  shortContainers.forEach((container, index) => {
    const video = container.querySelector('.shorts-video');
    const playBtn = container.querySelector('.js-play');
    const volumeBtn = container.querySelector('.js-volume');
    let isMuted = false;

    if (!video) return;
    video.loop = true;
    video.muted = isMuted;
    if (volumeBtn) volumeBtn.src = isMuted ? 'images/mute.png' : 'images/volume-up.png';

    if (index === 0) {
      video.play().then(() => {
        if (playBtn) playBtn.src = 'images/pause.png';
      }).catch(() => {
        video.muted = true;
        if (volumeBtn) volumeBtn.src = 'images/mute.png';
        video.play().catch(() => {});
        if (playBtn) playBtn.src = 'images/pause.png';
      });
    }

    if (playBtn) {
      playBtn.addEventListener('click', () => {
        if (video.paused) {
          video.play();
          playBtn.src = 'images/pause.png';
        } else {
          video.pause();
          playBtn.src = 'images/play-button-arrowhead.png';
        }
      });
    }

    if (volumeBtn) {
      volumeBtn.addEventListener('click', () => {
        isMuted = !isMuted;
        video.muted = isMuted;
        volumeBtn.src = isMuted ? 'images/mute.png' : 'images/volume-up.png';
      });
    }

    const shortId = container.dataset.shortId;
    let shortViewTracked = false;

    const handleShortTimeUpdate = () => {
      if (shortViewTracked || !video || !shortId) return;
      if (video.currentTime >= SHORTS_VIEW_SECONDS) {
        shortViewTracked = true;
        video.removeEventListener('timeupdate', handleShortTimeUpdate);
        recordShortView(container, shortId);
      }
    };

    video.addEventListener('timeupdate', handleShortTimeUpdate);

    const likeBtn = container.querySelector('.shorts-like-image')?.closest('.d');
    const dislikeBtn = container.querySelector('.shorts-dislike-image')?.closest('.d');

    async function sendShortReaction(reaction) {
      const token = await getAccessToken();
      if (!token) { console.warn('Must be logged in to react'); return; }
      try {
        const res = await fetch(`https://valviorabackend2.onrender.com/aggregatedShortsApi/${shortId}/${reaction}`, {
          method: 'PUT',
          headers: { Authorization: 'Bearer ' + token }
        });
        if (!res.ok) throw new Error(`Reaction failed: ${res.status}`);
        const data = await res.json();

        likeBtn.parentElement.querySelector('.shorts-text').textContent = data.Likes;
        dislikeBtn.parentElement.querySelector('.shorts-text').textContent = data.Dislikes;
        likeBtn.classList.toggle('shorts-liked', data.userReaction === 'like');
        dislikeBtn.classList.toggle('shorts-disliked', data.userReaction === 'dislike');
      } catch (err) {
        console.error(err);
      }
    }

    likeBtn?.addEventListener('click', () => sendShortReaction('like'));
    dislikeBtn?.addEventListener('click', () => sendShortReaction('dislike'));

    const subscribeBtn = container.querySelector('.subscribe-btn');
    if (subscribeBtn) {
      subscribeBtn.setAttribute('role', 'button');
      subscribeBtn.setAttribute('tabindex', '0');
      subscribeBtn.setAttribute('aria-pressed', 'false');

      subscribeBtn.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          subscribeBtn.click();
        }
      });

      subscribeBtn.addEventListener('click', async () => {
        const channelId = subscribeBtn.dataset.channelId;
        const token = await getAccessToken();
        if (!token) { console.warn('Must be logged in to subscribe'); return; }

        try {
          const res = await fetch('https://valviorabackend2.onrender.com/channelApi', {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Authorization: 'Bearer ' + token
            },
            body: JSON.stringify({ channelId, subscribe: 1 })
          });
          if (!res.ok) throw new Error(`Subscribe failed: ${res.status}`);
          const data = await res.json();

          document.querySelectorAll(`.subscribe-btn[data-channel-id="${channelId}"]`).forEach(btn => {
            btn.dataset.subscribed = data.subscribed ? 'true' : 'false';
            btn.textContent = data.subscribed ? 'Subscribed' : 'Subscribe';
            btn.setAttribute('aria-pressed', String(!!data.subscribed));
          });
          localStorage.setItem(`subscribed:${channelId}`, data.subscribed ? '1' : '0');
          notifySubscriptionChange(channelId, !!data.subscribed);
        } catch (err) {
          console.error(err);
        }
      });
    }

    video.addEventListener('click', () => {
      if (suppressNextShortTap) {
        suppressNextShortTap = false;
        return;
      }
      if (playBtn) playBtn.click();
    });

    const progressFill = container.querySelector('.shorts-progress-fill');
    const progressTrack = container.querySelector('.shorts-progress-track');
    video.addEventListener('timeupdate', () => {
      if (!progressFill || !video.duration) return;
      const pct = (video.currentTime / video.duration) * 100;
      progressFill.style.width = pct + '%';
    });
    video.addEventListener('loadedmetadata', () => {
      if (!progressFill) return;
      progressFill.style.width = '0%';
    });
    if (progressTrack) {
      progressTrack.addEventListener('click', (e) => {
        if (!video.duration) return;
        const rect = progressTrack.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const pct = Math.max(0, Math.min(1, x / rect.width));
        video.currentTime = pct * video.duration;
      });
    }
  });
}

function notifySubscriptionChange(channelId, subscribed) {
  if (typeof document === 'undefined') return;
  document.dispatchEvent(new CustomEvent('subscription-state-changed', {
    detail: { channelId, subscribed }
  }));
}

async function syncSubscribeButtons() {
  const token = await getAccessToken();
  const headers = token ? { Authorization: 'Bearer ' + token } : {};
  const channelIds = [...new Set([...document.querySelectorAll('.subscribe-btn')].map(btn => btn.dataset.channelId))];

  await Promise.all(channelIds.map(async (channelId) => {
    const res = await fetch(`https://valviorabackend2.onrender.com/channelApi/${channelId}`, { headers });
    if (!res.ok) return;
    const data = await res.json();
    document.querySelectorAll(`.subscribe-btn[data-channel-id="${channelId}"]`).forEach(btn => {
      btn.dataset.subscribed = data.subscribed ? 'true' : 'false';
      btn.textContent = data.subscribed ? 'Subscribed' : 'Subscribe';
      btn.setAttribute('aria-pressed', String(!!data.subscribed));
    });
    localStorage.setItem(`subscribed:${channelId}`, data.subscribed ? '1' : '0');
    notifySubscriptionChange(channelId, !!data.subscribed);
  }));
}

async function loadCommentCounts(shorts) {
  await Promise.all(shorts.map(async (short) => {
    try {
      const token = await getAccessToken();
      const headers = token ? { Authorization: 'Bearer ' + token } : {};
      const response = await fetch(`https://valviorabackend2.onrender.com/commentApi?contentId=${encodeURIComponent(short.shortId)}`, { headers });
      if (!response.ok) return;
      const comments = await response.json();
      const total = comments.reduce((sum, c) => sum + 1 + (c.replies?.length || 0), 0);
      const countEl = document.querySelector(`[data-short-id="${short.shortId}"] .js-comment-count`);
      if (countEl) countEl.textContent = total;
    } catch (err) {
      console.error('Failed to load comment count', err);
    }
  }));
}

let currentIndex = 0;
let shortsFeed = [];
let suppressNextShortTap = false;
const SHORTS_VIEW_SECONDS = 3;

function formatShortViews(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 'No views';
  if (n >= 1000000) return `${(n / 1000000).toFixed(1).replace(/\.0$/, '')}M views`;
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}K views`;
  return `${n} views`;
}

function updateShortViewCount(container, count) {
  const countEl = container?.querySelector('.js-view-count');
  if (countEl) {
    countEl.textContent = formatShortViews(count);
  }
}

function updateShortPosition({ syncUrl = true } = {}) {
  const allShorts = document.querySelectorAll('.shorts-video-container');
  allShorts.forEach((el, idx) => {
    if (idx === currentIndex) {
      el.classList.add('active');
    } else {
      el.classList.remove('active');
    }
  });
  playShortAt(currentIndex);

  if (!syncUrl) return;

  const activeShort = allShorts[currentIndex];
  const activeShortId = activeShort?.dataset.shortId;
  if (activeShortId) {
    const url = new URL(window.location.href);
    url.searchParams.set('shortId', activeShortId);
    history.replaceState(null, '', url.toString());
  }
}

function initArrowNavigation() {
  const allShorts = document.querySelectorAll('.shorts-video-container');
  const totalShorts = allShorts.length;
  document.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown') {
      if (currentIndex < totalShorts - 1) {
        currentIndex++;
        updateShortPosition();
      }
    }
    if (event.key === 'ArrowUp') {
      if (currentIndex > 0) {
        currentIndex--;
        updateShortPosition();
      }
    }
  });
  window.addEventListener('resize', updateShortPosition);
}

function initTouchNavigation() {
  const feed = document.querySelector('.short-video');
  if (!feed || !('ontouchstart' in window || navigator.maxTouchPoints > 0)) return;

  let startX = 0;
  let startY = 0;
  let hasMoved = false;

  const handleTouchStart = (event) => {
    const touch = event.touches[0];
    if (!touch) return;
    startX = touch.clientX;
    startY = touch.clientY;
    hasMoved = false;
  };

  const handleTouchMove = (event) => {
    if (event.touches.length !== 1) return;
    const touch = event.touches[0];
    const deltaX = touch.clientX - startX;
    const deltaY = touch.clientY - startY;

    if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > 8) {
      hasMoved = true;
      event.preventDefault();
    }
  };

  const handleTouchEnd = (event) => {
    if (!event.changedTouches.length) return;
    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - startX;
    const deltaY = touch.clientY - startY;
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    if (hasMoved && absY > absX && absY > 50) {
      suppressNextShortTap = true;
      if (deltaY < 0 && currentIndex < shortsFeed.length - 1) {
        currentIndex++;
        updateShortPosition();
      } else if (deltaY > 0 && currentIndex > 0) {
        currentIndex--;
        updateShortPosition();
      }
    }

    hasMoved = false;
  };

  feed.addEventListener('touchstart', handleTouchStart, { passive: true });
  feed.addEventListener('touchmove', handleTouchMove, { passive: false });
  feed.addEventListener('touchend', handleTouchEnd, { passive: true });
}

function initSharePopup() {
  const shareOverlay = document.querySelector('.shorts-share-overlay');
  const shareUrlInput = document.querySelector('.shorts-share-url-input');
  const shareCloseBtn = document.querySelector('.shorts-share-close');
  const shareCopyBtn = document.querySelector('.shorts-share-copy-btn');
  if (!shareOverlay) return;

  document.addEventListener('click', (e) => {
    const shareIcon = e.target.closest('.shorts-share-image');
    if (!shareIcon) return;
    const container = shareIcon.closest('[data-short-id]');
    const shortId = container?.dataset.shortId;
    if (!shortId) return;

    const urlObj = new URL(window.location.href);
    urlObj.searchParams.set('shortId', shortId);
    urlObj.hash = '';
    shareUrlInput.value = urlObj.toString();
    shareOverlay.style.display = 'flex';
  });

  shareCloseBtn?.addEventListener('click', () => { shareOverlay.style.display = 'none'; });
  shareOverlay.addEventListener('click', (e) => {
    if (e.target === shareOverlay) shareOverlay.style.display = 'none';
  });

  shareCopyBtn?.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(shareUrlInput.value);
    } catch (err) {
      shareUrlInput.select();
      document.execCommand('copy');
    }
    const original = shareCopyBtn.textContent;
    shareCopyBtn.textContent = 'Copied!';
    setTimeout(() => { shareCopyBtn.textContent = original; }, 1500);
  });
}

async function init() {
  try {
    const requestedShortId = getShortIdFromUrl();
    const shorts = await fetchShorts(requestedShortId);
    renderShorts(shorts);
    truncateProTitles();
    initShortsInteractions();
    syncSubscribeButtons();
    initShortsComments();
    initSharePopup();
    initArrowNavigation();
    initTouchNavigation();

    let startIndex = 0;

    if (requestedShortId) {
      const foundIndex = shorts.findIndex(s => s.shortId === requestedShortId);

      if (foundIndex === -1) {
        console.error(
          `[ShortsPage] shortId "${requestedShortId}" was requested via the URL but is NOT present ` +
          `in the Shorts feed response (${shorts.length} shorts returned).`
        );
      } else {
        startIndex = foundIndex;
      }
    }

    currentIndex = startIndex;
    updateShortPosition();

    loadCommentCounts(shorts);
  } catch (err) {
    console.error('Failed to load shorts feed:', err);
    document.querySelector('.short-video').innerHTML = '<p>Failed to load shorts. Please try again.</p>';
  }
}

const menu = document.querySelector('.menu');
const sidebar = document.querySelector('.moving-sidebar');
if (menu) {
  menu.addEventListener('click', () => {
    if (sidebar.style.display === 'block') {
      sidebar.style.display = 'none';
    } else {
      sidebar.style.display = 'block';
    }
  });
}

document.querySelector('.search-con')?.addEventListener('click', () => {
  document.querySelector('.search-containers').style.display = 'flex';
  document.querySelector('.youtube-header').style.display = 'none';
});

const closeSearchBtn = document.querySelector('.close-search-overlay');
if (closeSearchBtn) {
  closeSearchBtn.addEventListener('click', () => {
    document.querySelector('.search-containers').style.display = 'none';
    document.querySelector('.youtube-header').style.display = '';
  });
}

init();
