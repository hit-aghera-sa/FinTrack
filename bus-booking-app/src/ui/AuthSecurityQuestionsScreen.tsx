// src/screens/AuthSecurityQuestionsScreen.tsx
//
// THE APPROVED LOOK OF /auth/security-questions — converted mechanically from the Mockup Preview the client
// signed off. Every class, word and element here is theirs. This file is FIXED: behaviour belongs in
// the container beside it, which decides what to show while data loads, when it is empty, and when it
// fails. Changing the markup here changes what the client approved.
export function AuthSecurityQuestionsScreen(): JSX.Element {
  return (
    <div data-screen="/auth/security-questions">


  <div className="page-header">{' '}<div>{' '}<div className="page-eyebrow">Sign up</div>{' '}<h1 className="page-title">Security questions</h1>{' '}<p className="page-description">Choose a security question you'll use to recover your account if you forget your password.</p>{' '}</div>{' '}</div>{' '}<div className="card">{' '}<div className="card-body">{' '}<ul className="list-rows">{' '}<li className="list-row">{' '}<div className="list-row-text"><span className="list-row-title">What is your mother's first name?</span></div>{' '}<button type="button" className="chip" aria-pressed="true" data-toast="Done — this is a preview, so nothing is saved.">Selected</button>{' '}</li>{' '}<li className="list-row">{' '}<div className="list-row-text"><span className="list-row-title">What was the name of your first school?</span></div>{' '}<button type="button" className="chip" data-toast="Security question selected">Choose</button>{' '}</li>{' '}<li className="list-row">{' '}<div className="list-row-text"><span className="list-row-title">What is your favourite food?</span></div>{' '}<button type="button" className="chip" data-toast="Security question selected">Choose</button>{' '}</li>{' '}<li className="list-row">{' '}<div className="list-row-text"><span className="list-row-title">In which city were you born?</span></div>{' '}<button type="button" className="chip" data-toast="Security question selected">Choose</button>{' '}</li>{' '}</ul>{' '}</div>{' '}<div className="card-footer">{' '}<button type="button" className="button button-secondary" data-goto="/signup">Back</button>{' '}<button type="button" className="button button-primary" data-goto="/signup">Continue</button>{' '}</div>{' '}</div>


    </div>
  );
}

export default AuthSecurityQuestionsScreen;
