import { describe, expect, it } from 'vitest';
import { ApiError, offlineError } from '../../../api/index.js';
import { MESSAGES } from '../../../messages/index.js';
import { SAVE_FAILED_MESSAGE, describeProfileError } from './presenters.js';

describe('describeProfileError', () => {
  it('uses the no-internet sentence when the backend could not be reached', () => {
    expect(describeProfileError(offlineError())).toBe(MESSAGES.offline);
  });

  it("repeats the server's own refusal", () => {
    const refusal = new ApiError(400, 'invalid_request', 'Please enter a valid name.');
    expect(describeProfileError(refusal)).toBe('Please enter a valid name.');
  });

  it('falls back to a neutral sentence for anything else', () => {
    expect(describeProfileError({ nothing: 'useful' })).toBe(SAVE_FAILED_MESSAGE);
  });
});
