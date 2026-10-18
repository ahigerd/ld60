export function getQueryParam(key, def = '') {
  return decodeURIComponent((location.search.match(new RegExp('[?&]' + key + '=([^&]*)')) || [null, def])[1]);
}

const VIEW_HEIGHT = 360;
const ASPECT_RATIO = 16/9;
const PIXEL_SCALE = 6;

export default {
  debug: !!getQueryParam("debug"),
  smoothing: true,
  gravity: 0.03,
  width: VIEW_HEIGHT * ASPECT_RATIO,
  height: VIEW_HEIGHT,
  widthPx: VIEW_HEIGHT * ASPECT_RATIO * PIXEL_SCALE,
  heightPx: VIEW_HEIGHT * PIXEL_SCALE,
};
