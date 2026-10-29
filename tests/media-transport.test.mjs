import test from 'node:test';
import assert from 'node:assert/strict';
import { transferImage } from '../src/lib/mediaTransport.ts';
test('image transfer preserves bytes and validates the persisted object reference', async () => {
  const image = new Blob(['image fixture'], {type:'image/png'});
  const result = await transferImage('https://example.invalid/upload', {'Content-Type':'image/png'}, image, async (_url, init) => {
    assert.equal(init.method, 'POST'); assert.equal(await init.body.text(), 'image fixture');
    return Response.json({bucket:'halaqi-media',path:'users/uid/a.png',url:'https://example.invalid/a.png'});
  });
  assert.equal(result.path, 'users/uid/a.png');
});
test('rejected uploads never report success or expose provider details', async () => {
  await assert.rejects(transferImage('https://example.invalid', {}, new Blob(['a']), async () => Response.json({error:{code:'permission-denied',message:'private provider details'}},{status:403})), error => error.statusCode === '403' && error.code === 'permission-denied' && !error.message.includes('private'));
  await assert.rejects(transferImage('https://example.invalid', {}, new Blob(['a']), async () => Response.json({url:'incomplete'})), error => error.code === 'storage/invalid-response');
});
test('an unresponsive transfer is aborted once and never automatically retried', async () => {
  let attempts = 0;
  await assert.rejects(transferImage('https://example.invalid', {}, new Blob(['a']), async (_url, {signal}) => {
    attempts++;
    return new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new DOMException('Aborted','AbortError')), {once:true}));
  }, 10), error => error.code === 'storage/retry-limit-exceeded');
  assert.equal(attempts, 1);
});
