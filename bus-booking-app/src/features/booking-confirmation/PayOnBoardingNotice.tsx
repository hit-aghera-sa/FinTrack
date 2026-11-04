import { payOnBoardingMessage } from '../../messages/index.js';
import './styles.css';

/**
 * THE PAY-ON-BOARDING NOTICE — the one place the app states an amount still to be handed over.
 *
 * No money moves through this product, so this sentence is the whole of "payment" a traveller sees.
 * The wording and the rupee formatting come from the shared message catalogue, so the ticket, the
 * confirmation screen and anywhere else this notice appears can never drift apart.
 */
export interface PayOnBoardingNoticeProps {
  /** The whole booking's fare, in whole rupees. */
  totalFare: number;
}

export function PayOnBoardingNotice({ totalFare }: PayOnBoardingNoticeProps): JSX.Element {
  return (
    <p
      className="notice notice-success bc-notice"
      role="status"
      data-testid="booking-confirmed-pay-on-boarding-screen-notice"
    >
      <span className="bc-notice-label">Pay on boarding</span>
      <span className="bc-notice-text">{payOnBoardingMessage(totalFare)}</span>
    </p>
  );
}

export default PayOnBoardingNotice;
