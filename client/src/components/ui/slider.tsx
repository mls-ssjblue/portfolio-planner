import * as React from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";

import { cn } from "@/lib/utils";

// How long (ms) the user must hold the thumb before the slider activates.
// This prevents accidental value changes during scroll.
const HOLD_DELAY_MS = 200;

function Slider({
  className,
  defaultValue,
  value,
  min = 0,
  max = 100,
  onValueChange,
  ...props
}: React.ComponentProps<typeof SliderPrimitive.Root>) {
  const _values = React.useMemo(
    () =>
      Array.isArray(value)
        ? value
        : Array.isArray(defaultValue)
          ? defaultValue
          : [min, max],
    [value, defaultValue, min, max]
  );

  // ── Press-and-hold gate (thumb only) ──────────────────────────────────────
  // The slider stays "locked" (inert) until the user long-presses the thumb.
  // Clicking/touching the track or moving before the timer fires cancels it.
  const [locked, setLocked] = React.useState(true);
  const holdTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const downOrigin = React.useRef<{ x: number; y: number } | null>(null);
  const thumbRefs = React.useRef<(HTMLSpanElement | null)[]>([]);

  const cancelHold = React.useCallback(() => {
    if (holdTimer.current) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
    downOrigin.current = null;
  }, []);

  const relock = React.useCallback(() => {
    cancelHold();
    setLocked(true);
  }, [cancelHold]);

  // Attach pointerdown listener to each thumb element so only thumb presses
  // start the hold timer. We use a ref-callback + effect approach.
  const handleThumbPointerDown = React.useCallback(
    (e: PointerEvent) => {
      if (e.button !== 0 && (e as any).pointerType !== "touch") return;
      downOrigin.current = { x: e.clientX, y: e.clientY };
      holdTimer.current = setTimeout(() => {
        setLocked(false);
        holdTimer.current = null;
      }, HOLD_DELAY_MS);
    },
    []
  );

  const handleThumbPointerMove = React.useCallback(
    (e: PointerEvent) => {
      if (!downOrigin.current) return;
      const dx = Math.abs(e.clientX - downOrigin.current.x);
      const dy = Math.abs(e.clientY - downOrigin.current.y);
      // If finger moves significantly before hold timer fires, cancel
      if (dy > 8 || dx > 24) {
        cancelHold();
      }
    },
    [cancelHold]
  );

  const handleThumbPointerUp = React.useCallback(() => {
    // Re-lock when thumb is released so next interaction starts fresh
    relock();
  }, [relock]);

  // Attach/detach listeners on thumb elements
  React.useEffect(() => {
    const thumbs = thumbRefs.current.filter(Boolean) as HTMLSpanElement[];
    thumbs.forEach((thumb) => {
      thumb.addEventListener("pointerdown", handleThumbPointerDown);
      thumb.addEventListener("pointermove", handleThumbPointerMove);
      thumb.addEventListener("pointerup", handleThumbPointerUp);
      thumb.addEventListener("pointerleave", handleThumbPointerUp);
      thumb.addEventListener("pointercancel", handleThumbPointerUp);
    });
    return () => {
      thumbs.forEach((thumb) => {
        thumb.removeEventListener("pointerdown", handleThumbPointerDown);
        thumb.removeEventListener("pointermove", handleThumbPointerMove);
        thumb.removeEventListener("pointerup", handleThumbPointerUp);
        thumb.removeEventListener("pointerleave", handleThumbPointerUp);
        thumb.removeEventListener("pointercancel", handleThumbPointerUp);
      });
    };
  }, [handleThumbPointerDown, handleThumbPointerMove, handleThumbPointerUp, _values.length]);

  // Also re-lock on any pointer-up on the document (catches edge cases where
  // the pointer leaves the thumb mid-drag).
  React.useEffect(() => {
    const handler = () => relock();
    document.addEventListener("pointerup", handler);
    return () => document.removeEventListener("pointerup", handler);
  }, [relock]);

  // Prevent wheel events from changing the value.
  const rootRef = React.useRef<HTMLSpanElement>(null);
  React.useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const block = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };
    el.addEventListener("wheel", block, { passive: false });
    return () => el.removeEventListener("wheel", block);
  }, []);

  return (
    <SliderPrimitive.Root
      ref={rootRef as React.Ref<HTMLSpanElement>}
      data-slot="slider"
      defaultValue={defaultValue}
      value={value}
      min={min}
      max={max}
      // While locked, suppress value changes so the slider is inert
      onValueChange={locked ? undefined : onValueChange}
      className={cn(
        "relative flex w-full touch-none items-center select-none data-[disabled]:opacity-50 data-[orientation=vertical]:h-full data-[orientation=vertical]:min-h-44 data-[orientation=vertical]:w-auto data-[orientation=vertical]:flex-col",
        // Visual feedback: dim slightly while locked
        locked ? "opacity-80" : "opacity-100",
        className
      )}
      {...props}
    >
      <SliderPrimitive.Track
        data-slot="slider-track"
        className={cn(
          "bg-muted relative grow overflow-hidden rounded-full data-[orientation=horizontal]:h-1 data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-1"
        )}
      >
        <SliderPrimitive.Range
          data-slot="slider-range"
          className={cn(
            "bg-primary absolute data-[orientation=horizontal]:h-full data-[orientation=vertical]:w-full"
          )}
        />
      </SliderPrimitive.Track>
      {Array.from({ length: _values.length }, (_, index) => (
        <SliderPrimitive.Thumb
          data-slot="slider-thumb"
          key={index}
          ref={(el) => { thumbRefs.current[index] = el; }}
          className={cn(
            "border-primary ring-ring/50 block size-4 shrink-0 rounded-full border-2 bg-white shadow-sm transition-[color,box-shadow,transform] hover:ring-4 focus-visible:ring-4 focus-visible:outline-hidden disabled:pointer-events-none disabled:opacity-50",
            // Scale up when active (unlocked) to give tactile feedback
            !locked && "scale-125 ring-4 ring-[oklch(0.75_0.12_75/30%)]"
          )}
        />
      ))}
    </SliderPrimitive.Root>
  );
}

export { Slider };
