import { NotificationsService } from './notifications.service';

/** The apps open a screen from the notification's type, so the caller's data.type must reach the phone. */
describe('NotificationsService.sendPush', () => {
  const setup = () => {
    const created: any[] = [];
    const prisma = {
      notification: { create: jest.fn(async ({ data }: any) => { created.push(data); return { id: 'n1', ...data }; }) },
      notificationPreference: { findUnique: jest.fn(async () => null) },
    };
    const service = new NotificationsService(prisma as any);
    const delivered: any[] = [];
    jest.spyOn(service as any, 'deliver').mockImplementation(async (_user: any, payload: any) => { delivered.push(payload); });
    return { service, created, delivered };
  };

  it('keeps the booking type for the push and the inbox', async () => {
    const { service, created, delivered } = setup();
    await service.sendPush('u1', { title: 'Payment received', body: 'x', data: { type: 'booking:payment_collected', bookingId: 'b1' } });
    expect(delivered[0].data).toEqual({ type: 'booking:payment_collected', bookingId: 'b1', notificationId: 'n1' });
    expect(created[0].type).toBe('booking:payment_collected');
  });

  it('uses the category when the data has no type', async () => {
    const { service, created, delivered } = setup();
    await service.sendPush('u1', { title: 't', body: 'x' }, { type: 'partner_rejected' });
    expect(delivered[0].data.type).toBe('partner_rejected');
    expect(created[0].type).toBe('partner_rejected');
  });

  it("files it under the category but still pushes the data's own type", async () => {
    const { service, created, delivered } = setup();
    await service.sendPush('u1', { title: 't', body: 'x', data: { type: 'job:direct_request', bookingId: 'b2' } }, { type: 'booking.direct_request' });
    expect(created[0].type).toBe('booking.direct_request');
    expect(delivered[0].data.type).toBe('job:direct_request');
  });

  it("falls back to 'system' when neither is given", async () => {
    const { service, created, delivered } = setup();
    await service.sendPush('u1', { title: 't', body: 'x' });
    expect(created[0].type).toBe('system');
    expect(delivered[0].data.type).toBe('system');
  });
});
