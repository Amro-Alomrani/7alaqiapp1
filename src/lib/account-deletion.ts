import { backendRequest } from './supabase';

const KEY = 'halaqi_account_deletion_job';
interface DeletionJob { jobId: string; jobToken: string; createdAt: number }

function savedJob(): DeletionJob | null {
  try {
    const job = JSON.parse(localStorage.getItem(KEY) || 'null');
    return job && typeof job.jobId === 'string' && typeof job.jobToken === 'string' ? job : null;
  } catch { return null; }
}

export function hasPendingAccountDeletion() { return Boolean(savedJob()); }

export async function deleteOwnAccount(): Promise<{ status: 'deleted' }> {
  let job = savedJob();
  if (!job) {
    const prepared = await backendRequest<{ jobId: string; jobToken: string }>('prepare-account-deletion');
    job = { ...prepared, createdAt: Date.now() };
    // This scoped capability lets the user check/resume the same deletion job
    // after Firebase disables the account or the app is reopened.
    localStorage.setItem(KEY, JSON.stringify(job));
  }
  try {
    await backendRequest('confirm-account-deletion', { jobId: job.jobId, jobToken: job.jobToken }, false);
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && ['failed-precondition', 'not-found'].includes(String(error.code))) localStorage.removeItem(KEY);
    throw error;
  }
  const until = Date.now() + 20_000;
  do {
    const result = await backendRequest<{ status: 'deleted' | 'pending' | 'failed' }>('account-deletion-status', { jobId: job.jobId, jobToken: job.jobToken }, false).catch(error => {
      if (error?.code === 'not-found') localStorage.removeItem(KEY);
      throw error;
    });
    if (result.status === 'deleted') { localStorage.removeItem(KEY); return { status: 'deleted' }; }
    if (result.status === 'failed') throw Object.assign(new Error('Deletion needs a retry.'), { code: 'deletion/failed' });
    if (Date.now() >= until) break;
    await new Promise(resolve => setTimeout(resolve, 1800));
  } while (Date.now() < until);
  throw Object.assign(new Error('Deletion is continuing on the server.'), { code: 'deletion/pending' });
}
