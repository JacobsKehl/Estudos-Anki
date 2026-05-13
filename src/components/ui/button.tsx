import * as React from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "outline" | "ghost" | "link" | "secondary";
  size?: "default" | "sm" | "lg" | "icon";
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", asChild = false, ...props }, ref) => {
    const variants = {
      default: "bg-accent text-accent-foreground hover:bg-accent/90 shadow-sm",
      outline: "border border-border bg-transparent hover:bg-muted/10",
      ghost: "hover:bg-muted/10",
      link: "text-accent underline-offset-4 hover:underline",
      secondary: "bg-sage-light text-accent hover:bg-sage-light/80 shadow-sm",
    };

    const sizes = {
      default: "h-10 px-4 py-2",
      sm: "h-8 px-3 text-xs",
      lg: "h-12 px-8 text-lg",
      icon: "h-10 w-10",
    };

    const combinedClassName = cn(
      "inline-flex items-center justify-center rounded-xl text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/20 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]",
      variants[variant],
      sizes[size],
      className
    );

    if (asChild && React.isValidElement(props.children)) {
      const child = props.children as React.ReactElement<any>;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { children: _, ...rest } = props;
      return React.cloneElement(child, {
        ...rest,
        className: cn(combinedClassName, child.props?.className),
        ref: ref,
      });
    }

return (
  <button
    ref={ref}
    className={combinedClassName}
    {...props}
  />
);
  }
);
Button.displayName = "Button";

export { Button };

