import { errorCodeSchema } from '@courtly/contracts';
import { ApiException, ERROR_STATUS } from './api.exception';

describe('ApiException', () => {
  it('has a status for exactly the codes in the contract', () => {
    expect(Object.keys(ERROR_STATUS).sort()).toEqual(
      [...errorCodeSchema.options].sort(),
    );
  });

  it.each(errorCodeSchema.options)(
    'carries %s with a status from the map',
    (code) => {
      const exception = new ApiException(code, 'message');

      expect(exception.getStatus()).toBe(ERROR_STATUS[code]);
      expect(exception.getResponse()).toEqual({ code, message: 'message' });
    },
  );

  it('maps a slot conflict to 409 and a past booking to 422', () => {
    expect(ERROR_STATUS.SLOT_TAKEN).toBe(409);
    expect(ERROR_STATUS.BOOKING_IN_PAST).toBe(422);
  });
});
