// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProfileIdentityCard } from './ProfileIdentityCard';
import { FULL_NAME_RULE_MESSAGE } from './validation.js';

afterEach(() => {
  cleanup();
});

describe('ProfileIdentityCard', () => {
  it('shows the mobile number read-only and labelled as the login ID', () => {
    render(
      <ProfileIdentityCard
        fullName="Priya Menon"
        mobile="9876543210"
        saving={false}
        loading={false}
        onSave={vi.fn()}
      />,
    );

    const mobile = screen.getByLabelText('Mobile number');
    expect(mobile).toHaveValue('9876543210');
    expect(mobile).toBeDisabled();
    expect(screen.getByText('Mobile number is your login ID and cannot be changed.')).toBeInTheDocument();
  });

  it('saves the edited name, normalised', () => {
    const onSave = vi.fn();
    render(
      <ProfileIdentityCard
        fullName="Priya Menon"
        mobile="9876543210"
        saving={false}
        loading={false}
        onSave={onSave}
      />,
    );

    fireEvent.change(screen.getByLabelText('Full name'), { target: { value: '  Alex QA  ' } });
    fireEvent.submit(screen.getByTestId('profile-screen-profile-identity-log-out-form'));

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith('Alex QA');
  });

  it('refuses to save a blank name and says why', () => {
    const onSave = vi.fn();
    render(
      <ProfileIdentityCard
        fullName="Priya Menon"
        mobile="9876543210"
        saving={false}
        loading={false}
        onSave={onSave}
      />,
    );

    fireEvent.change(screen.getByLabelText('Full name'), { target: { value: '   ' } });
    fireEvent.submit(screen.getByTestId('profile-screen-profile-identity-log-out-form'));

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText(FULL_NAME_RULE_MESSAGE)).toBeInTheDocument();
    expect(screen.getByLabelText('Full name')).toHaveAttribute('aria-invalid', 'true');
  });

  it('locks the form while a save is in flight', () => {
    render(
      <ProfileIdentityCard
        fullName="Priya Menon"
        mobile="9876543210"
        saving={true}
        loading={false}
        onSave={vi.fn()}
      />,
    );

    expect(screen.getByTestId('profile-screen-profile-identity-log-out-save')).toBeDisabled();
    expect(screen.getByLabelText('Full name')).toBeDisabled();
  });
});
