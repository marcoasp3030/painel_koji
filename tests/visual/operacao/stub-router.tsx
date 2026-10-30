import { forwardRef, type ReactNode } from "react";

export const Link = forwardRef<
  HTMLAnchorElement,
  { to?: string; children?: ReactNode; className?: string; search?: unknown }
>(function Link({ to, children, ...rest }, ref) {
  return (
    <a ref={ref} href={typeof to === "string" ? to : "#"} {...rest}>
      {children}
    </a>
  );
});

export function useBlocker() {
  return { status: "idle" as const, proceed() {}, reset() {} };
}
