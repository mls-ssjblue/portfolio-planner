import * as React from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";

import { cn } from "@/lib/utils";

// Minimum horizontal pixel movement before we commit to a drag interaction.
// This prevents accidental value changes when the user is scrolling vertically
// or merely resting a finger on the slider.
const DRAG_INTENT_THRESHOLD_PX = 6;

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

  // ── Drag-intent state ──────────────────────────────────────────────────────
  // We track the pointer's initial position so we can require a minimum
  // horizontal movement before treating the interaction as a slider drag.
  // Until intent is confirmed we suppress onValueChange entirely.
  const intentConfirmed = React.useRef(false);
  const pointerStart = React.useRef<{ x: number; y: number } | null>(null);
  const isDragging = React.useRef(false);
  const [isActive, setIsActive] = React.useState(false);

  // Pending value while intent is not yet confirmed (avoids jumps on commit).
  const pendingValue = React.useRef<number[] | null>(null);

  // Stable ref to the latest onValueChange so we can call it from effects
  // without stale-closure issues.
  const onValueChangeRef = React.useRef(onValueChange);
  React.useEffect(() => { onValueChangeRef.current = onValueChange; }, [onValueChange]);

  // ── Wheel-scroll blocker ───────────────────────────────────────────────────
  // Prevent mouse-wheel events from accidentally changing the slider value
  // when the user scrolls over it.
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

  // ── Global pointer-up cleanup ──────────────────────────────────────────────
  React.useEffect(() => {
    const cleanup = () => {
      if (isDragging.current) {
        // Flush any pending value that was held back during intent detection.
        if (pendingValue.current !== null) {
          onValueChangeRef.current?.(pendingValue.current);
          pendingValue.current = null;
        }
      }
      isDragging.current = false;
      intentConfirmed.current = false;
      pointerStart.current = null;
      setIsActive(false);
    };
    document.addEventListener("pointerup", cleanup);
    document.addEventListener("pointercancel", cleanup);
    return () => {
      document.removeEventListener("pointerup", cleanup);
      document.removeEventListener("pointercancel", cleanup);
    };
  }, []);

  // ── Pointer-move intent detection ─────────────────────────────────────────
  React.useEffect(() => {
    const handleMove = (e: PointerEvent) => {
      if (!isDragging.current || intentConfirmed.current) return;
      if (!pointerStart.current) return;

      const dx = Math.abs(e.clientX - pointerStart.current.x);
      const dy = Math.abs(e.clientY - pointerStart.current.y);

      // If the user has moved more vertically than horizontally, they are
      // scrolling — abandon this interaction entirely.
      if (dy > dx && dy > DRAG_INTENT_THRESHOLD_PX) {
        isDragging.current = false;
        intentConfirmed.current = false;
        pointerStart.current = null;
        pendingValue.current = null;
        setIsActive(false);
        return;
      }

      // Horizontal intent confirmed — flush the pending value.
      if (dx >= DRAG_INTENT_THRESHOLD_PX) {
        intentConfirmed.current = true;
        if (pendingValue.current !== null) {
          onValueChangeRef.current?.(pendingValue.current);
          pendingValue.current = null;
        }
      }
    };

    document.addEventListener("pointermove", handleMove);
    return () => document.removeEventListener("pointermove", handleMove);
  }, []);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handlePointerDown = React.useCallback((e: React.PointerEvent) => {
    isDragging.current = true;
    intentConfirmed.current = false;
    pointerStart.current = { x: e.clientX, y: e.clientY };
    pendingValue.current = null;
    setIsActive(true);
  }, []);

  const handlePointerUp = React.useCallback(() => {
    if (pendingValue.current !== null) {
      onValueChangeRef.current?.(pendingValue.current);
      pendingValue.current = null;
    }
    isDragging.current = false;
    intentConfirmed.current = false;
    pointerStart.current = null;
    setIsActive(false);
  }, []);

  // Gate value changes behind intent confirmation.
  const handleValueChange = React.useCallback((val: number[]) => {
    if (!isDragging.current) {
      // Keyboard-driven change — always pass through immediately.
      onValueChangeRef.current?.(val);
      return;
    }
    if (intentConfirmed.current) {
      onValueChangeRef.current?.(val);
    } else {
      // Buffer the value until intent is confirmed.
      pendingValue.current = val;
    }
  }, []);

  return (
    <SliderPrimitive.Root
      ref={rootRef as React.Ref<HTMLSpanElement>}
      data-slot="slider"
      defaultValue={defaultValue}
      value={value}
      min={min}
      max={max}
      // Use our gated handler instead of passing onValueChange directly.
      onValueChange={handleValueChange}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      className={cn(
        // touch-none prevents the browser from claiming the touch for scroll
        // while we are actively dragging the slider horizontally.
        "relative flex w-full touch-none items-center select-none data-[disabled]:opacity-50 data-[orientation=vertical]:h-full data-[orientation=vertical]:min-h-44 data-[orientation=vertical]:w-auto data-[orientation=vertical]:flex-col",
        className
      )}
      {...props}
    >
      <SliderPrimitive.Track
        data-slot="slider-track"
        className={cn(
          "bg-muted relative grow overflow-hidden rounded-full data-[orientation=horizontal]:h-1.5 data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-1.5",
          // Slightly thicker track makes it easier to tap on mobile.
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
          className={cn(
            // Base thumb styles
            "relative block shrink-0 rounded-full border-2 bg-white shadow-sm",
            "border-primary",
            // Size: slightly larger than default for easier grabbing
            "size-5",
            // Smooth transitions for ring and scale feedback
            "transition-[box-shadow,transform] duration-150",
            // Hover / focus ring
            "hover:ring-4 focus-visible:ring-4 focus-visible:outline-hidden ring-ring/50",
            // Active (dragging) state: bigger ring + slight scale-up
            isActive && "ring-4 ring-ring/60 scale-110",
            // Disabled
            "disabled:pointer-events-none disabled:opacity-50",
            // Enlarged invisible hit area via pseudo-element for mobile
            "after:absolute after:inset-[-12px] after:content-['']",
          )}
        />
      ))}
    </SliderPrimitive.Root>
  );
}

export { Slider };
