import { BackendError } from '../_shared/google-admin.mjs';

export function memoryAdmin(seed = {}) {
  const documents = new Map();
  const users = new Map();
  const deletedUsers = new Set();
  let revision = 0;
  const snapshot = (path, data) => ({ path, data: structuredClone(data), updateTime: String(++revision) });
  for (const [path, data] of Object.entries(seed)) documents.set(path, snapshot(path, data));
  const get = async path => documents.has(path) ? structuredClone(documents.get(path)) : null;
  function check(path, options) {
    if (options.exists === false && documents.has(path)) throw new BackendError('aborted', 'exists');
    if (options.exists === true && !documents.has(path)) throw new BackendError('aborted', 'missing');
    if (options.updateTime && documents.get(path)?.updateTime !== options.updateTime) throw new BackendError('aborted', 'changed');
  }
  async function set(path, data, options = {}) {
    check(path, options);
    let updated = structuredClone(data);
    if (options.fields) {
      updated = { ...(documents.get(path)?.data || {}) };
      for (const key of options.fields) { if (data[key] === undefined) delete updated[key]; else updated[key] = structuredClone(data[key]); }
    }
    documents.set(path, snapshot(path, updated));
  }
  const direct = collection => [...documents.values()].filter(doc => doc.path.startsWith(collection + '/') && !doc.path.slice(collection.length + 1).includes('/')).sort((a, b) => a.path.localeCompare(b.path));
  const listWithMissing = collection => {
    const values = new Map(direct(collection).map(doc => [doc.path, doc]));
    for (const name of documents.keys()) {
      if (!name.startsWith(collection + '/')) continue;
      const path = `${collection}/${name.slice(collection.length + 1).split('/')[0]}`;
      if (!values.has(path)) values.set(path, { path, data: {} });
    }
    return [...values.values()].sort((a, b) => a.path.localeCompare(b.path));
  };
  return {
    documents, users, deletedUsers, get, set,
    updateWrite: (path, data, options = {}) => ({ path, data, options }),
    commit: async writes => {
      for (const write of writes) check(write.verify || write.delete || write.path, write.currentDocument || write.options || {});
      for (const write of writes) {
        if (write.verify) continue;
        if (write.delete) documents.delete(write.delete); else await set(write.path, write.data, write.options);
      }
    },
    remove: async path => { documents.delete(path); },
    query: async (collection, field, value, limit = 200, after = '') => structuredClone(direct(collection).filter(doc => doc.data[field] === value && doc.path > after).slice(0, limit)),
    due: async (collection, flag, time, limit = 20) => structuredClone(direct(collection).filter(doc => doc.data[flag] === true && doc.data.nextAttemptAt <= time).slice(0, limit)),
    expired: async (collection, time, limit = 20) => structuredClone(direct(collection).filter(doc => doc.data.expiresAt <= time).slice(0, limit)),
    activeUploads: async (uid, time) => direct('mediaUploadOperations').some(doc => doc.data.relatedUids?.includes(uid) && doc.data.expiresAt > time),
    collections: async (path, pageToken = '') => {
      const all = [...new Set([...documents.keys()].filter(name => name.startsWith(path + '/')).map(name => name.slice(path.length + 1).split('/')[0]))].sort().filter(name => name > pageToken);
      const collectionIds = all.slice(0, 100);
      return { collectionIds, nextPageToken: all.length > 100 ? collectionIds.at(-1) : undefined };
    },
    list: async (collection, limit = 100, pageToken = '') => {
      const all = listWithMissing(collection).filter(doc => doc.path > pageToken);
      const docs = all.slice(0, limit);
      return { docs: structuredClone(docs), nextPageToken: all.length > limit ? docs.at(-1).path : undefined };
    },
    fullName: path => path,
    authUpdate: async (uid, fields) => { users.set(uid, { ...users.get(uid), ...fields }); },
    authDelete: async uid => { deletedUsers.add(uid); users.delete(uid); },
    deleteLegacyPrefix: async () => 0,
  };
}
