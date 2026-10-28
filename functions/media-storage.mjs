const PUBLIC_BUCKET = 'halaqi-media';
const PRIVATE_BUCKET = 'halaqi-chat';
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

class MediaStorageError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

function objectPath(value) {
  if (typeof value !== 'string' || !value || value.length > 1024
    || /[\\\u0000-\u001f\u007f]/.test(value)) {
    throw new MediaStorageError('invalid-argument', 'A valid image path is required.');
  }
  const parts = value.split('/');
  if (parts.length < 3 || parts.some(part => !part || part === '.' || part === '..')) {
    throw new MediaStorageError('invalid-argument', 'A valid image path is required.');
  }
  return { path: value, parts, bucket: parts[0] === 'chats' ? PRIVATE_BUCKET : PUBLIC_BUCKET };
}

function createMediaStorage({ projectUrl, getSecret, getBooking, fetchImpl = fetch }) {
  const origin = new URL(projectUrl).origin;
  const encodedPath = path => path.split('/').map(encodeURIComponent).join('/');

  async function api(path, options = {}) {
    const secret = getSecret();
    if (!secret) throw new MediaStorageError('failed-precondition', 'Image storage is not configured.');
    let response;
    try {
      response = await fetchImpl(`${origin}/storage/v1${path}`, {
        ...options,
        headers: {
          apikey: secret,
          // Legacy service-role keys are JWTs; new sb_secret keys belong only
          // on apikey and must never be sent as bearer JWTs.
          ...(secret.startsWith('eyJ') ? { Authorization: `Bearer ${secret}` } : {}),
          ...(options.body ? { 'Content-Type': 'application/json' } : {}),
          ...options.headers,
        },
        signal: AbortSignal.timeout(25_000),
      });
    } catch {
      throw new MediaStorageError('unavailable', 'Image storage could not be reached. Retry shortly.');
    }
    if (!response.ok) {
      throw new MediaStorageError('unavailable', `Image storage request failed (${response.status}).`);
    }
    const text = await response.text();
    return text ? JSON.parse(text) : null;
  }

  async function authorize(uid, pathValue, operation) {
    if (!uid) throw new MediaStorageError('unauthenticated', 'Sign in to access images.');
    const target = objectPath(pathValue);
    if (target.bucket === PRIVATE_BUCKET) {
      const [type, bookingId, fileName] = target.parts;
      if (type !== 'chats' || target.parts.length !== 3 || bookingId.length > 128) {
        throw new MediaStorageError('invalid-argument', 'A valid booking image is required.');
      }
      const booking = await getBooking(bookingId);
      if (!booking || ![booking.customerUid, booking.barberId].includes(uid)) {
        throw new MediaStorageError('permission-denied', 'Only booking participants can access this image.');
      }
      if (operation !== 'read' && !fileName.startsWith(`${uid}-`)) {
        throw new MediaStorageError('permission-denied', 'You can only change your own images.');
      }
      target.participants = [booking.customerUid, booking.barberId];
    } else if (!['users', 'barbers', 'posts'].includes(target.parts[0]) || target.parts[1] !== uid) {
      throw new MediaStorageError('permission-denied', 'You can only change your own images.');
    }
    return target;
  }

  function signedUrl(relative) {
    if (typeof relative !== 'string' || !relative.startsWith('/object/')) {
      throw new MediaStorageError('internal', 'Image storage returned an invalid link.');
    }
    return `${origin}/storage/v1${relative}`;
  }

  async function createUpload(uid, { path, size, contentType }) {
    const target = await authorize(uid, path, 'upload');
    if (!Number.isInteger(size) || size <= 0 || size > MAX_IMAGE_BYTES
      || typeof contentType !== 'string' || !/^image\/[a-z0-9.+-]+$/i.test(contentType)) {
      throw new MediaStorageError('invalid-argument', 'Choose an image up to 10 MB.');
    }
    const data = await api(`/object/upload/sign/${target.bucket}/${encodedPath(target.path)}`, {
      method: 'POST', body: '{}',
    });
    const token = new URL(signedUrl(data?.url)).searchParams.get('token');
    if (!token) throw new MediaStorageError('internal', 'Image storage returned no upload permission.');
    return { bucket: target.bucket, path: target.path, token };
  }

  async function createDownload(uid, { bucket, path }) {
    const target = await authorize(uid, path, 'read');
    if (bucket !== PRIVATE_BUCKET || target.bucket !== PRIVATE_BUCKET) {
      throw new MediaStorageError('invalid-argument', 'A private booking image is required.');
    }
    const data = await api(`/object/sign/${bucket}/${encodedPath(path)}`, {
      method: 'POST', body: JSON.stringify({ expiresIn: 3600 }),
    });
    return { url: signedUrl(data?.signedURL), expiresIn: 3600 };
  }

  async function remove(uid, { bucket, path }) {
    const target = await authorize(uid, path, 'delete');
    if (bucket !== target.bucket) throw new MediaStorageError('invalid-argument', 'Invalid image bucket.');
    await api(`/object/${bucket}`, { method: 'DELETE', body: JSON.stringify({ prefixes: [path] }) });
    return { status: 'deleted' };
  }

  async function removePrefix(bucket, prefix) {
    const files = [];
    async function visit(folder, depth = 0) {
      if (depth > 20) throw new MediaStorageError('internal', 'Image storage folder depth exceeded.');
      for (let offset = 0; ; offset += 100) {
        const entries = await api(`/object/list/${bucket}`, {
          method: 'POST',
          body: JSON.stringify({ prefix: folder, limit: 100, offset, sortBy: { column: 'name', order: 'asc' } }),
        });
        if (!Array.isArray(entries)) throw new MediaStorageError('internal', 'Invalid image listing.');
        for (const entry of entries) {
          if (typeof entry.name !== 'string' || !entry.name || ['.', '..'].includes(entry.name) || entry.name.includes('/')) {
            throw new MediaStorageError('internal', 'Invalid image listing entry.');
          }
          const child = `${folder}/${entry.name}`;
          if (entry.id == null) await visit(child, depth + 1);
          else files.push(child);
        }
        if (entries.length < 100) break;
      }
    }
    await visit(prefix);
    for (let index = 0; index < files.length; index += 100) {
      await api(`/object/${bucket}`, { method: 'DELETE', body: JSON.stringify({ prefixes: files.slice(index, index + 100) }) });
    }
    return files.length;
  }

  async function removeAccountMedia(uid, bookingIds) {
    for (const kind of ['users', 'barbers', 'posts']) await removePrefix(PUBLIC_BUCKET, `${kind}/${uid}`);
    for (const bookingId of new Set(bookingIds)) await removePrefix(PRIVATE_BUCKET, `chats/${bookingId}`);
  }

  async function removePrefixBatch(bucket, prefix, limit = 50, keepAlive = async () => {}) {
    if (![PUBLIC_BUCKET, PRIVATE_BUCKET].includes(bucket)) throw new MediaStorageError('invalid-argument', 'Invalid image bucket.');
    const files = [];
    async function visit(folder, depth = 0) {
      if (depth > 20) throw new MediaStorageError('internal', 'Image folder depth exceeded.');
      for (let offset = 0; files.length < limit; offset += 100) {
        await keepAlive();
        const entries = await api(`/object/list/${bucket}`, { method: 'POST', body: JSON.stringify({ prefix: folder, limit: 100, offset, sortBy: { column: 'name', order: 'asc' } }) });
        for (const entry of entries) {
          if (typeof entry.name !== 'string' || ['.', '..'].includes(entry.name) || entry.name.includes('/')) throw new MediaStorageError('internal', 'Invalid image listing.');
          const child = `${folder}/${entry.name}`;
          if (entry.id == null) await visit(child, depth + 1); else files.push(child);
          if (files.length >= limit) break;
        }
        if (entries.length < 100) break;
      }
    }
    await visit(prefix);
    if (files.length) { await keepAlive(); await api(`/object/${bucket}`, { method: 'DELETE', body: JSON.stringify({ prefixes: files }) }); }
    return files.length;
  }

  async function uploadFile(uid, { path, contentType, bytes }) {
    const target = await authorize(uid, path, 'upload');
    if (!bytes?.byteLength || bytes.byteLength > MAX_IMAGE_BYTES || !/^image\/[a-z0-9.+-]+$/i.test(contentType)) {
      throw new MediaStorageError('invalid-argument', 'Choose an image up to 10 MB.');
    }
    await api(`/object/${target.bucket}/${encodedPath(target.path)}`, {
      method: 'POST', body: bytes, headers: { 'Content-Type': contentType, 'x-upsert': 'false' },
    });
    return { bucket: target.bucket, path: target.path };
  }
  async function discardUpload(bucket, path) {
    const target = objectPath(path);
    if (bucket !== target.bucket) throw new MediaStorageError('invalid-argument', 'Invalid image bucket.');
    await api(`/object/${bucket}`, { method: 'DELETE', body: JSON.stringify({ prefixes: [path] }) });
  }
  return { createUpload, createDownload, remove, removeAccountMedia, removePrefixBatch, uploadFile,
    validateUploadPath: (uid, path) => authorize(uid, path, 'upload'), discardUpload };
}

export { createMediaStorage, MediaStorageError, PUBLIC_BUCKET, PRIVATE_BUCKET };
