// src/screens/SignupScreen.tsx
//
// THE APPROVED LOOK OF /signup — converted mechanically from the Mockup Preview the client
// signed off. Every class, word and element here is theirs. This file is FIXED: behaviour belongs in
// the container beside it, which decides what to show while data loads, when it is empty, and when it
// fails. Changing the markup here changes what the client approved.
export function SignupScreen(): JSX.Element {
  return (
    <div data-screen="/signup">


  <div className="auth-shell">{' '}<div className="auth-card">{' '}<div className="auth-brand">{' '}<div className="sidebar-mark">Bus Booking App</div>
        Bus Booking
      </div>{' '}<h1 className="auth-title">Sign up</h1>{' '}<div className="form">{' '}<div className="field">{' '}<label className="field-label" htmlFor="signup-name">Full name</label>{' '}<input className="input" id="signup-name" type="text" placeholder="e.g. Aisha Kapoor" />{' '}</div>{' '}<div className="field">{' '}<label className="field-label" htmlFor="signup-mobile">Mobile number</label>{' '}<input className="input" id="signup-mobile" type="tel" placeholder="10-digit mobile number" />{' '}</div>{' '}<div className="form-row">{' '}<div className="field">{' '}<label className="field-label" htmlFor="signup-password">Password</label>{' '}<input className="input" id="signup-password" type="password" placeholder="At least 8 characters" />{' '}</div>{' '}<div className="field">{' '}<label className="field-label" htmlFor="signup-confirm">Confirm password</label>{' '}<input className="input" id="signup-confirm" type="password" placeholder="Re-enter password" />{' '}</div>{' '}</div>{' '}<div className="field">{' '}<label className="field-label" htmlFor="signup-question">Security question</label>{' '}<select className="input" id="signup-question">{' '}<option>What is your mother's first name?</option>{' '}<option>What was the name of your first school?</option>{' '}<option>What is your favourite food?</option>{' '}<option>In which city were you born?</option>{' '}</select>{' '}</div>{' '}<div className="field">{' '}<label className="field-label" htmlFor="signup-answer">Security answer</label>{' '}<input className="input" id="signup-answer" type="text" placeholder="Your answer" />{' '}</div>{' '}<div className="form-actions">{' '}<button type="button" className="button button-primary button-large" data-goto="/search">Sign up</button>{' '}</div>{' '}</div>{' '}<p className="auth-footnote">Already have an account? <button type="button" className="text-link" data-goto="/login">Log in</button></p>{' '}</div>{' '}</div>


    </div>
  );
}

export default SignupScreen;
