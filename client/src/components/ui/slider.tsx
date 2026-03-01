import * as React from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";

import { cn } from "@/lib/utils";

// How long (ms) the user must hold before the slider activates.
// This prevents accidental value changes during scroll.
const HOLD_DELAY_MS = 180;

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

  // ── Press-and-hold gate ────────────────────────────────────────────────────
  // We overlay a transparent capture div on top of the slider. On pointerdown
  // we start a timer; if the pointer is released or moves significantly before
  // the timer fires we cancel and let the event bubble as a scroll. Once the
  // timer fires we "unlock" the slider and re-dispatch the original event so
  // Radix can handle it normally.
  const [locked, setLocked] = React.useState(true);
  const holdTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const downEvent = React.useRef<{ x: number; y: number } | null>(null);

  const cancelHold = React.useCallback(() => {
    if (holdTimer.current) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
    downEvent.current = null;
    setLocked(true);
  }, []);

  const handleOverlayPointerDown = React.useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      // Only intercept primary button / single touch
      if (e.button !== 0 && e.pointerType !== "touch") return;
      downEvent.current = { x: e.clientX, y: e.clientY };
      holdTimer.current = setTimeout(() => {
        setLocked(false);
        holdTimer.current = null;
      }, HOLD_DELAY_MS);
    },
    []
  );

  const handleOverlayPointerMove = React.useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!downEvent.current) return;
      const dx = Math.abs(e.clientX - downEvent.current.x);
      const dy = Math.abs(e.clientY - downEvent.current.y);
      // If the finger moves more than 6px vertically before the hold timer
      // fires, treat it as a scroll and cancel.
      if (dy > 6 || dx > 20) {
        cancelHold();
      }
    },
    [cancelHold]
  );

  // Re-lock after pointer is released so the next interaction starts fresh.
  const handlePointerUp = React.useCallback(() => {
    cancelHold();
  }, [cancelHold]);

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
    <div
      className="relative w-full"
      onPointerDown={handleOverlayPointerDown}
      onPointerMove={handleOverlayPointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
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
          // Visual feedback: dim slightly while locked so the user knows it
          // isn't active yet
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
            className="border-primary ring-ring/50 block size-3.5 shrink-0 rounded-full border bg-white shadow-sm transition-[color,box-shadow] hover:ring-4 focus-visible:ring-4 focus-visible:outline-hidden disabled:pointer-events-none disabled:opacity-50"
          />
        ))}
      </SliderPrimitive.Root>
    </div>
  );
}

export { Slider };
