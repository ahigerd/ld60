export function getQueryParam(key, def = '') {
  return decodeURIComponent((location.search.match(new RegExp('[?&]' + key + '=([^&]*)')) || [null, def])[1]);
}

export default {
};
