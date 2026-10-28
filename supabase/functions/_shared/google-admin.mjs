export class BackendError extends Error {
  constructor(code, message, details = {}) { super(message); this.code = code; Object.assign(this, details); }
}

export function encodeValue(value) {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(encodeValue) } };
  return { mapValue: { fields: encodeFields(value) } };
}
export function encodeFields(data) { return Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined).map(([key, value]) => [key, encodeValue(value)])); }
export function decodeValue(value) {
  if ('stringValue' in value) return value.stringValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return value.doubleValue;
  if ('booleanValue' in value) return value.booleanValue;
  if ('timestampValue' in value) return value.timestampValue;
  if ('arrayValue' in value) return (value.arrayValue.values || []).map(decodeValue);
  if ('mapValue' in value) return decodeFields(value.mapValue.fields || {});
  return null;
}
export function decodeFields(data) { return Object.fromEntries(Object.entries(data).map(([key, value]) => [key, decodeValue(value)])); }
const base64url = bytes => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const encode = value => base64url(new TextEncoder().encode(JSON.stringify(value)));

export function createGoogleAdmin({ projectId, getCredentials, fetchImpl = fetch }) {
  let tokenCache;
  let tokenPromise;
  const prefix = `projects/${projectId}/databases/(default)/documents`;
  const fullName = path => `${prefix}/${path}`;
  const doc = value => value?.name ? { path: value.name.slice(prefix.length + 1), data: decodeFields(value.fields || {}), updateTime: value.updateTime } : null;

  async function accessToken() {
    if (tokenCache?.expiresAt > Date.now() + 60_000) return tokenCache.token;
    if (tokenPromise) return tokenPromise;
    tokenPromise = (async () => {
      let credentials;
      try { credentials = JSON.parse(getCredentials()); } catch { throw new BackendError('failed-precondition', 'The server identity is not configured.'); }
      if (credentials.project_id !== projectId || !credentials.client_email || !credentials.private_key) throw new BackendError('failed-precondition', 'Invalid server identity.');
      const der = Uint8Array.from(atob(credentials.private_key.replace(/-----[^-]+-----/g, '').replace(/\s/g, '')), char => char.charCodeAt(0));
      const key = await crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
      const now = Math.floor(Date.now() / 1000);
      const unsigned = `${encode({ alg: 'RS256', typ: 'JWT' })}.${encode({ iss: credentials.client_email, scope: 'https://www.googleapis.com/auth/cloud-platform', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 })}`;
      const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned));
      const response = await fetchImpl('https://oauth2.googleapis.com/token', {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${base64url(new Uint8Array(signature))}` }),
        signal: AbortSignal.timeout(20_000),
      });
      if (!response.ok) throw new BackendError('unavailable', 'The server identity could not be verified.');
      const result = await response.json();
      tokenCache = { token: result.access_token, expiresAt: Date.now() + Number(result.expires_in) * 1000 };
      return tokenCache.token;
    })().finally(() => { tokenPromise = null; });
    return tokenPromise;
  }

  async function request(url, { method = 'GET', body, allow404 = false } = {}) {
    const response = await fetchImpl(url, { method,
      headers: { Authorization: `Bearer ${await accessToken()}`, ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(25_000),
    });
    if (allow404 && response.status === 404) return null;
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      const fcmCode = result?.error?.details?.find(value => value['@type']?.endsWith('google.firebase.fcm.v1.FcmError'))?.errorCode;
      throw new BackendError([409, 412].includes(response.status) ? 'aborted' : 'unavailable', `Server request failed (${response.status}).`, { status: response.status, fcmCode, userNotFound: result?.error?.message === 'USER_NOT_FOUND' });
    }
    return result;
  }

  const firestoreUrl = path => `https://firestore.googleapis.com/v1/${prefix}${path ? '/' + path.split('/').map(encodeURIComponent).join('/') : ''}`;
  const updateWrite = (path, data, { fields, exists, updateTime } = {}) => ({
    update: { name: fullName(path), fields: encodeFields(data) },
    ...(fields ? { updateMask: { fieldPaths: fields } } : {}),
    ...(updateTime ? { currentDocument: { updateTime } } : exists !== undefined ? { currentDocument: { exists } } : {}),
  });
  async function commit(writes) {
    if (!writes.length) return;
    return request(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:commit`, { method: 'POST', body: { writes } });
  }
  async function get(path) { return doc(await request(firestoreUrl(path), { allow404: true })); }
  async function set(path, data, options = {}) { return commit([updateWrite(path, data, options)]); }
  async function remove(path) { return request(firestoreUrl(path), { method: 'DELETE', allow404: true }); }
  async function query(collection, field, value, limit = 200, after) {
    const parts = collection.split('/');
    const collectionId = parts.pop();
    const parent = parts.length ? '/' + parts.map(encodeURIComponent).join('/') : '';
    const data = await request(`https://firestore.googleapis.com/v1/${prefix}${parent}:runQuery`, {
      method: 'POST', body: { structuredQuery: {
        from: [{ collectionId }], where: { fieldFilter: { field: { fieldPath: field }, op: 'EQUAL', value: encodeValue(value) } },
        orderBy: [{ field: { fieldPath: '__name__' }, direction: 'ASCENDING' }], limit,
        ...(after ? { startAt: { before: false, values: [{ referenceValue: fullName(after) }] } } : {}),
      } },
    });
    return data.filter(row => row.document).map(row => doc(row.document));
  }
  async function list(collection, pageSize = 100, pageToken) {
    const url = new URL(firestoreUrl(collection));
    url.searchParams.set('pageSize', String(pageSize));
    url.searchParams.set('showMissing', 'true');
    if (pageToken) url.searchParams.set('pageToken', pageToken);
    const result = await request(url.toString());
    return { docs: (result.documents || []).map(doc), nextPageToken: result.nextPageToken };
  }
  async function due(collection, flag, timestamp, limit = 20) {
    const rows = await request(`https://firestore.googleapis.com/v1/${prefix}:runQuery`, { method: 'POST', body: { structuredQuery: {
      from: [{ collectionId: collection }],
      where: { compositeFilter: { op: 'AND', filters: [
        { fieldFilter: { field: { fieldPath: flag }, op: 'EQUAL', value: { booleanValue: true } } },
        { fieldFilter: { field: { fieldPath: 'nextAttemptAt' }, op: 'LESS_THAN_OR_EQUAL', value: encodeValue(timestamp) } },
      ] } },
      orderBy: [{ field: { fieldPath: 'nextAttemptAt' }, direction: 'ASCENDING' }], limit,
    } } });
    return rows.filter(row => row.document).map(row => doc(row.document));
  }
  async function expired(collection, timestamp, limit = 20) {
    const rows = await request(`https://firestore.googleapis.com/v1/${prefix}:runQuery`, { method: 'POST', body: { structuredQuery: {
      from: [{ collectionId: collection }],
      where: { fieldFilter: { field: { fieldPath: 'expiresAt' }, op: 'LESS_THAN_OR_EQUAL', value: encodeValue(timestamp) } }, limit,
    } } });
    return rows.filter(row => row.document).map(row => doc(row.document));
  }
  async function activeUploads(uid, timestamp) {
    const rows = await request(`https://firestore.googleapis.com/v1/${prefix}:runQuery`, { method: 'POST', body: { structuredQuery: {
      from: [{ collectionId: 'mediaUploadOperations' }], where: { compositeFilter: { op: 'AND', filters: [
        { fieldFilter: { field: { fieldPath: 'relatedUids' }, op: 'ARRAY_CONTAINS', value: encodeValue(uid) } },
        { fieldFilter: { field: { fieldPath: 'expiresAt' }, op: 'GREATER_THAN', value: encodeValue(timestamp) } },
      ] } }, orderBy: [{ field: { fieldPath: 'expiresAt' }, direction: 'ASCENDING' }], limit: 1,
    } } });
    return rows.some(row => row.document);
  }
  async function collections(path, pageToken) {
    return request(`${firestoreUrl(path)}:listCollectionIds`, { method: 'POST', body: { pageSize: 100, ...(pageToken ? { pageToken } : {}) } });
  }
  async function authUpdate(uid, fields) {
    try { return await request(`https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts:update`, { method: 'POST', body: { localId: uid, ...fields } }); }
    catch (error) { if (error.userNotFound) return null; throw error; }
  }
  async function authDelete(uid) {
    try { await request(`https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts:delete`, { method: 'POST', body: { localId: uid } }); }
    catch (error) { if (!error.userNotFound) throw error; }
    const remaining = await request(`https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts:lookup`, { method: 'POST', body: { localId: [uid] } });
    if (remaining.users?.length) throw new BackendError('unavailable', 'Account deletion has not completed.');
  }
  async function sendPush(message) {
    return request(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, { method: 'POST', body: { message } });
  }
  async function deleteLegacyPrefix(bucket, folder, keepAlive = async () => {}) {
    await keepAlive();
    const url = new URL(`https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(bucket)}/o`);
    url.searchParams.set('prefix', folder + '/'); url.searchParams.set('maxResults', '50');
    const result = await request(url.toString(), { allow404: true });
    const items = result?.items || [];
    for (const item of items) { await keepAlive(); await request(`https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(bucket)}/o/${encodeURIComponent(item.name)}`, { method: 'DELETE', allow404: true }); }
    return items.length;
  }
  return { get, set, remove, query, due, expired, activeUploads, list, collections, commit, updateWrite, fullName, authUpdate, authDelete, sendPush, deleteLegacyPrefix };
}
