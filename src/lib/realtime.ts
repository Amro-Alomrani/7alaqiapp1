type Listener = (data: any) => void;

class EventBus {
  private listeners = new Map<string, Set<Listener>>();

  on(event: string, fn: Listener) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(fn);
    return () => this.listeners.get(event)?.delete(fn);
  }

  emit(event: string, data?: any) {
    this.listeners.get(event)?.forEach(fn => fn(data));
    this.listeners.get('*')?.forEach(fn => fn({ event, data }));
  }

  off(event: string, fn: Listener) {
    this.listeners.get(event)?.delete(fn);
  }
}

export const eventBus = new EventBus();

const activeTimers = new Map<string, number[]>();

function addTimer(bookingId: string, timerId: number) {
  if (!activeTimers.has(bookingId)) activeTimers.set(bookingId, []);
  activeTimers.get(bookingId)!.push(timerId);
}

export function cancelBookingTimers(bookingId: string) {
  const timers = activeTimers.get(bookingId);
  if (timers) {
    timers.forEach(id => clearTimeout(id));
    activeTimers.delete(bookingId);
  }
}

export function simulateBarberAccept(bookingId: string, delayMs = 3000) {
  const t1 = window.setTimeout(() => {
    eventBus.emit('booking_status', { bookingId, status: 'accepted' });
    const t2 = window.setTimeout(() => {
      eventBus.emit('booking_status', { bookingId, status: 'preparing' });
    }, 5000);
    addTimer(bookingId, t2);
  }, delayMs);
  addTimer(bookingId, t1);
}

export function simulateBarberProgress(bookingId: string) {
  const t1 = window.setTimeout(() => {
    eventBus.emit('booking_status', { bookingId, status: 'your_turn' });
  }, 8000);
  addTimer(bookingId, t1);
  const t2 = window.setTimeout(() => {
    eventBus.emit('booking_status', { bookingId, status: 'in_progress' });
  }, 15000);
  addTimer(bookingId, t2);
  const t3 = window.setTimeout(() => {
    eventBus.emit('booking_status', { bookingId, status: 'completed' });
    activeTimers.delete(bookingId);
  }, 30000);
  addTimer(bookingId, t3);
}
