// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProfileLogOutCard } from './ProfileLogOutCard';

afterEach(() => {
  cleanup();
});

describe('ProfileLogOutCard', () => {
  it('ends the session when Log out is pressed', () => {
    const onLogOut = vi.fn();
    render(<ProfileLogOutCard busy={false} onLogOut={onLogOut} />);

    fireEvent.click(screen.getByRole('button', { name: 'Log out' }));

    expect(onLogOut).toHaveBeenCalledTimes(1);
  });

  it('says it is signing out and refuses a second press while it does', () => {
    const onLogOut = vi.fn();
    render(<ProfileLogOutCard busy={true} onLogOut={onLogOut} />);

    const button = screen.getByTestId('profile-screen-profile-identity-log-out-signout');
    expect(button).toBeDisabled();
    expect(button).toHaveTextContent('Logging out');

    fireEvent.click(button);
    expect(onLogOut).not.toHaveBeenCalled();
  });
});
