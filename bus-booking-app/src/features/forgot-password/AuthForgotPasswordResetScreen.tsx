// src/screens/AuthForgotPasswordResetScreen.tsx
//
// THE APPROVED LOOK OF /auth/forgot-password/reset — converted mechanically from the Mockup Preview the client
// signed off. Every class, word and element here is theirs. This file is FIXED: behaviour belongs in
// the container beside it, which decides what to show while data loads, when it is empty, and when it
// fails. Changing the markup here changes what the client approved.
export function AuthForgotPasswordResetScreen(): JSX.Element {
  return (
    <div data-screen="/auth/forgot-password/reset">


  <div className="auth-shell">{' '}<div className="auth-card">{' '}<div className="auth-brand">{' '}<div className="sidebar-mark">Bus Booking App</div>{' '}<span>Bus Booking</span>{' '}</div>{' '}<h1 className="auth-title">Forgot password</h1>{' '}<div className="notice notice-success">{' '}<svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 6 9 17l-5-5"></path></svg>
        Answer confirmed. Choose a new password.
      </div>{' '}<div className="form">{' '}<div className="field">{' '}<label className="field-label" htmlFor="forgot-reset-password">New password</label>{' '}<input className="input" id="forgot-reset-password" type="password" placeholder="At least 8 characters, letters and digits" />{' '}</div>{' '}<div className="field">{' '}<label className="field-label" htmlFor="forgot-reset-confirm">Confirm new password</label>{' '}<input className="input" id="forgot-reset-confirm" type="password" placeholder="Re-enter new password" />{' '}</div>{' '}</div>{' '}<div className="form-actions">{' '}<button type="button" className="button button-secondary" data-goto="/auth/forgot-password/question">Back</button>{' '}<button type="button" className="button button-primary" data-goto="/search">Set password & log in</button>{' '}</div>{' '}</div>{' '}</div>


    </div>
  );
}

export default AuthForgotPasswordResetScreen;
