import * as React from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "primary" | "outline" | "ghost" | "link" | "secondary" | "soft" | "destructive";
  size?: "default" | "sm" | "md" | "lg" | "icon" | "iconOnly";
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", asChild = false, ...props }, ref) => {
    const variants = {
      default: "bg-accent text-accent-foreground hover:bg-accent/90 shadow-sm",
      primary: "bg-accent text-accent-foreground hover:bg-accent/90 shadow-sm",
      secondary: "bg-sage-light text-accent hover:bg-sage-light/80 shadow-sm",
      soft: "bg-accent/10 text-accent hover:bg-accent/20 border border-transparent",
      outline: "border border-border bg-transparent hover:bg-muted/30 text-foreground",
      ghost: "hover:bg-muted/30 text-foreground/80 hover:text-foreground border-transparent",
      link: "text-accent underline-offset-4 hover:underline",
      destructive: "bg-red-50 text-red-600 hover:bg-red-100 border border-red-100",
    };

    const sizes = {
      default: "h-10 px-4 py-2",
      sm: "h-8 px-3 text-xs",
      md: "h-10 px-4 py-2",
      lg: "h-12 px-8 text-base",
      icon: "h-10 w-10",
      iconOnly: "h-10 w-10 p-0",
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

