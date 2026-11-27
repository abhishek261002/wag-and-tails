import { customerHistory, customerHistoryNote } from './customer-history.js';

describe('customer timeline notes', () => {
  it('hides who released a job and why', () => {
    for (const note of ['Released by the partner: Asha K: the customer was rude', 'Partner removed: Asha K: bike broke down']) {
      expect(customerHistoryNote(note)).toBe('We are finding you another partner.');
    }
  });
  it('hides why a visit was stopped and which staff member closed it', () => {
    expect(customerHistoryNote('Stopped: dog bit me')).toBe('The visit was stopped. Our team will contact you.');
    expect(customerHistoryNote('Completed at the desk by Ravi (cash)')).toBe('Completed by our team.');
  });
  it('keeps ordinary notes and empty ones', () => {
    expect(customerHistory([{ note: 'Job completed' }, { note: null }])).toEqual([{ note: 'Job completed' }, { note: null }]);
  });
});
