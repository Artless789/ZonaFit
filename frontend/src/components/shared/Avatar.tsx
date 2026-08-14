import { cn } from '../../utils/cn';

export interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  src?: string;
  fallback: string;
}

export function Avatar({ className, src, fallback, ...props }: AvatarProps) {
  return (
    <div
      className={cn(
        "relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full bg-border-light flex-align-center justify-center text-text-secondary font-medium",
        className
      )}
      {...props}
    >
      {src ? (
        <img
          src={src}
          alt="Avatar"
          className="aspect-square h-full w-full object-cover"
        />
      ) : (
        <span className="flex h-full w-full items-center justify-center uppercase">
          {fallback.substring(0, 2)}
        </span>
      )}
    </div>
  );
}
