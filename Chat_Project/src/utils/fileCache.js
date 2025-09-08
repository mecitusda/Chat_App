// utils/fileCache.js
import localforage from 'localforage';
import { setFileCache } from '../store/filesSlice';

localforage.config({
  name: 'MyAppCache',
  storeName: 'files'
});

export async function getCachedFile(key, fetchFn, dispatch, reduxCache) {
  // Önce Redux
  if (reduxCache[key]) return reduxCache[key];

  // Sonra IndexedDB
  const cached = await localforage.getItem(key);
  if (cached) {
    dispatch(setFileCache({ key, url: cached }));
    return cached;
  }

  // Yoksa server'dan indir
  const fileBlob = await fetchFn(); // Presigned URL ile fetch
  const fileUrl = URL.createObjectURL(fileBlob);

  // Redux + IndexedDB'ye kaydet
  dispatch(setFileCache({ key, url: fileUrl }));
  await localforage.setItem(key, fileUrl);

  return fileUrl;
}
