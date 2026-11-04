// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { PayOnBoardingNotice } from './PayOnBoardingNotice';

afterEach(() => {
  cleanup();
});

describe('PayOnBoardingNotice', () => {
  it('states ₹1,200 for two ₹600 seats', () => {
    render(<PayOnBoardingNotice totalFare={600 + 600} />);
    expect(
      screen.getByText('Pay ₹1,200 in cash or UPI to the bus staff when boarding.'),
    ).not.toBeNull();
  });

  it('states the single-seat total', () => {
    render(<PayOnBoardingNotice totalFare={600} />);
    expect(screen.getByText('Pay ₹600 in cash or UPI to the bus staff when boarding.')).not.toBeNull();
  });

  it('labels the notice so the state is never colour alone', () => {
    render(<PayOnBoardingNotice totalFare={1200} />);
    expect(screen.getByText('Pay on boarding')).not.toBeNull();
  });
});
