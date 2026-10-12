import { forwardRef, type ButtonHTMLAttributes } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** "primary" for the main action of a page or form, "danger" for delete. Defaults to "secondary". */
  variant?: ButtonVariant;
  /** A smaller button, for the actions of a table row. */
  small?: boolean;
}

/**
 * The class names of a button, for giving a `<Link>` the same look:
 * `<Link to={newTaskPath} className={buttonClass('primary')}>Add todo</Link>`.
 */
export function buttonClass(variant: ButtonVariant = 'secondary', small = false): string {
  return 'button button-' + variant + (small ? ' button-small' : '');
}

/**
 * A button. `type` defaults to "button", so a button inside a form never submits it by accident -
 * pass `type="submit"` on the one that should.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', small = false, type = 'button', className, ...rest },
  ref,
) {
  const classes = buttonClass(variant, small) + (className !== undefined ? ' ' + className : '');
  return <button ref={ref} type={type} className={classes} {...rest} />;
});
