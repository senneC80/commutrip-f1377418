import { BadgeCheck } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface VerifiedBadgeProps {
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

export default function VerifiedBadge({ size = 'sm', showLabel = false, className }: VerifiedBadgeProps) {
  const iconSize = size === 'lg' ? 'h-5 w-5' : size === 'md' ? 'h-4 w-4' : 'h-3.5 w-3.5';
  const textSize = size === 'lg' ? 'text-sm' : 'text-xs';

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              'inline-flex items-center gap-1 text-primary font-medium',
              textSize,
              className,
            )}
          >
            <BadgeCheck className={cn(iconSize, 'fill-primary/15')} />
            {showLabel && <span>CBT Verified</span>}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <p className="text-xs leading-relaxed">
            This community has been verified by CommuTrip as genuinely community-based:
            owned and operated by local people, with tourism revenue distributed within the community.
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
