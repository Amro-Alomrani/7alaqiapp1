import test from 'node:test';
import assert from 'node:assert/strict';
import { getCurrentLocation } from '../src/lib/location.ts';
import { runLocationRequest } from '../src/lib/location-request.ts';

function browser(t, getCurrentPosition) {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { geolocation: { getCurrentPosition } } });
  t.after(() => {
    if (descriptor) Object.defineProperty(globalThis, 'navigator', descriptor);
    else delete globalThis.navigator;
  });
}

test('a provider that never calls back cannot leave location loading indefinitely', async t => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 100_000 });
  browser(t, () => {});
  const result = getCurrentLocation({ timeout: 8000, enableHighAccuracy: false });
  const rejected = assert.rejects(result, error => error.code === 3);
  t.mock.timers.tick(8000);
  await rejected;
});

test('precision fallback shares the total timeout and respects a fresh-location requirement', async t => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 100_000 });
  const calls = [];
  browser(t, (success, failure, options) => { calls.push(options); });
  const result = getCurrentLocation({ timeout: 8000, enableHighAccuracy: true, maximumAge: 0 });
  const rejected = assert.rejects(result, error => error.code === 3);
  t.mock.timers.tick(5200);
  await Promise.resolve(); await Promise.resolve();
  assert.equal(calls.length, 2);
  assert.equal(calls[1].enableHighAccuracy, false);
  assert.equal(calls[1].maximumAge, 0);
  assert.equal(calls[0].timeout + calls[1].timeout, 8000);
  t.mock.timers.tick(2800);
  await rejected;
});

test('denied permission fails immediately without another permission request', async t => {
  let calls = 0;
  browser(t, (success, failure) => { calls++; failure({ code: 1, message: 'Denied' }); });
  await assert.rejects(getCurrentLocation({ enableHighAccuracy: true }), error => error.code === 1);
  assert.equal(calls, 1);
});

test('real browser coordinate getters survive normalization and invalid coordinates are rejected', async t => {
  const coords = Object.create({ latitude: 31.9, longitude: 35.9, accuracy: 15, altitude: null, altitudeAccuracy: null, heading: null, speed: null });
  browser(t, success => success({ coords, timestamp: 1234 }));
  const position = await getCurrentLocation();
  assert.equal(position.coords.latitude, 31.9);
  assert.equal(position.coords.longitude, 35.9);
  assert.equal(position.timestamp, 1234);
  coords.latitude = 1000;
  await assert.rejects(getCurrentLocation(), error => error.code === 2);
});

test('cancelling a request prevents fallback and ignores a late provider success', async t => {
  let callback; let calls = 0;
  browser(t, success => { calls++; callback = success; });
  const controller = new AbortController();
  const result = getCurrentLocation({ enableHighAccuracy: true, signal: controller.signal });
  const rejected = assert.rejects(result, error => error.code === 2);
  controller.abort();
  await rejected;
  callback({ coords: { latitude: 31.9, longitude: 35.9, accuracy: 5, altitude: null, heading: null, speed: null }, timestamp: 0 });
  assert.equal(calls, 1);
});

test('a request already cancelled never starts the location provider', async () => {
  const controller = new AbortController(); controller.abort();
  let called = false;
  await assert.rejects(runLocationRequest(() => { called = true; return Promise.resolve({}); }, 8000, controller.signal));
  assert.equal(called, false);
});
