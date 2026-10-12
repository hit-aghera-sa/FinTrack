import { Button } from "../components/Button.js";
import "./tokens.css";
import "./ErrorBanner.css";

export interface ErrorBannerProps {
  message: string;
  onRetry?: () => void;
}

/**
 * The shared failure notice. The error state is carried by the heading text and
 * a glyph as well as by the accent colour, and the whole banner is announced as
 * an alert.
 */
export function ErrorBanner({ message, onRetry }: ErrorBannerProps): JSX.Element {
  return (
    <div className="ui-error-banner" role="alert">
      <span className="ui-error-banner__icon" aria-hidden="true">
        !
      </span>
      <div className="ui-error-banner__body">
        <p className="ui-error-banner__title">Something went wrong</p>
        <p className="ui-error-banner__message">{message}</p>
      </div>
      {onRetry ? (
        <div className="ui-error-banner__actions">
          <Button variant="secondary" onClick={onRetry}>
            Retry
          </Button>
        </div>
      ) : null}
    </div>
  );
}
