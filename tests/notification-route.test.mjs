import test from 'node:test';
import assert from 'node:assert/strict';
import { notificationRoute } from '../src/lib/notificationRoute.ts';
test('booking pushes open the recipient role screen, including barber requests', () => {
  assert.equal(notificationRoute({bookingId:'booking1',type:'booking_request'},true), '/barber/bookings');
  assert.equal(notificationRoute({bookingId:'booking1',type:'booking_update'},false), '/booking-status');
});
test('message pushes open the correct private conversation and escape the route ID', () => {
  assert.equal(notificationRoute({bookingId:'b/1',type:'message'},true), '/barber/chat/b%2F1');
  assert.equal(notificationRoute({bookingId:'b1',type:'message'},false), '/booking-chat/b1');
  assert.equal(notificationRoute(undefined,false), '/notifications');
});
