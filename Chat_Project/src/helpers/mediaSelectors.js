export const selectMediaUrl = (state, mediaKey) => {
  if (!mediaKey) return undefined;
  const byConv = state.files.byKey;
  for (const files of Object.values(byConv)) {
    const found = files.find(f => f.media_key === mediaKey);
    if (found && found.expiresAt > Date.now()) {

      return found.media_url;
    }
  }
  return undefined; // expired veya yok
};