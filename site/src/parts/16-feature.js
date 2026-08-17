/* Автоматично добавени връзки при разделянето на монолита. */
import { saveState } from './09-backend-integraciya.js';
import { Activity } from './14-data-service.js';
import { updateTopicProgress } from './17-feature.js';

/* =============================================================================
   FEATURE — VIDEOS per topic
   Videos are stored in state.videos (admin-editable) and can be YouTube/Vimeo/MP4.
   ============================================================================= */
function getVideo(subjId, topicIdx) {
  if (!state.videos[subjId]) return null;
  return state.videos[subjId][topicIdx] || null;
}
function setVideo(subjId, topicIdx, videoData) {
  if (!state.videos[subjId]) state.videos[subjId] = {};
  state.videos[subjId][topicIdx] = Object.assign({}, state.videos[subjId][topicIdx] || {}, videoData);
  saveState();
}
function markVideoWatched(subjId, topicIdx) {
  const v = getVideo(subjId, topicIdx);
  if (!v) return;
  setVideo(subjId, topicIdx, { watched: true, watchedAt: Date.now() });
  updateTopicProgress(subjId, topicIdx, 'video', true);
  if (typeof Activity !== 'undefined') Activity.log('video.watched', subjId, { topicIdx });
}
function videoEmbedUrl(url) {
  if (!url) return '';
  // YouTube
  let m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{11})/);
  if (m) return 'https://www.youtube.com/embed/' + m[1] + '?rel=0';
  // Vimeo
  m = url.match(/vimeo\.com\/(\d+)/);
  if (m) return 'https://player.vimeo.com/video/' + m[1];
  return url; // direct MP4 or other
}
function videoIsEmbed(url) {
  if (!url) return false;
  return /youtube\.com|youtu\.be|vimeo\.com/.test(url);
}

export { getVideo, markVideoWatched, setVideo, videoEmbedUrl, videoIsEmbed };
