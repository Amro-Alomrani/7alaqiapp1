export function notificationRoute(data: { bookingId?: string; postId?: string; type?: string } | undefined, barber: boolean): string {
  if (data?.bookingId) {
    if (data.type === 'message') return `${barber ? '/barber/chat/' : '/booking-chat/'}${encodeURIComponent(data.bookingId)}`;
    return barber ? '/barber/bookings' : '/booking-status';
  }
  return data?.postId ? '/feed' : '/notifications';
}
