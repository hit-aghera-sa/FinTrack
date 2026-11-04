// src/screens/AuthForgotPasswordQuestionScreen.tsx
//
// THE APPROVED LOOK OF /auth/forgot-password/question — converted mechanically from the Mockup Preview the client
// signed off. Every class, word and element here is theirs. This file is FIXED: behaviour belongs in
// the container beside it, which decides what to show while data loads, when it is empty, and when it
// fails. Changing the markup here changes what the client approved.
export function AuthForgotPasswordQuestionScreen(): JSX.Element {
  return (
    <div data-screen="/auth/forgot-password/question">


  <div className="auth-shell">{' '}<div className="auth-card">{' '}<div className="auth-brand">{' '}<div className="sidebar-mark">Bus Booking App</div>{' '}<span>Bus Booking</span>{' '}</div>{' '}<h1 className="auth-title">Forgot password</h1>{' '}<div className="notice">{' '}<svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><path d="M12 16v-4m0-4h.01"></path></svg>
        Answer your security question to continue.
      </div>{' '}<div className="form">{' '}<div className="field">{' '}<label className="field-label" htmlFor="forgot-question-text">What is your mother's first name?</label>{' '}<input className="input" id="forgot-question-text" placeholder="Your answer" />{' '}</div>{' '}</div>{' '}<div className="form-actions">{' '}<button type="button" className="button button-secondary" data-goto="/forgot-password">Back</button>{' '}<button type="button" className="button button-primary" data-goto="/auth/forgot-password/verify">Continue</button>{' '}</div>{' '}<p className="auth-footnote">Remembered your password? <a className="text-link" data-goto="/login" href="#login">Log in</a></p>{' '}</div>{' '}</div>


    </div>
  );
}

export default AuthForgotPasswordQuestionScreen;
