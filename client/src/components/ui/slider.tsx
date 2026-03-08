import * as React from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";

import { cn } from "@/lib/utils";

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

  // Track whether a drag is currently in progress so we can suppress
  // wheel-scroll value changes without interfering with pointer drags.
  const isDragging = React.useRef(false);

  // Prevent wheel events from accidentally changing the slider value.
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

  const handlePointerDown = React.useCallback(() => {
    isDragging.current = true;
  }, []);

  const handlePointerUp = React.useCallback(() => {
    isDragging.current = false;
  }, []);

  // Clean up drag state on document pointerup in case the pointer is released
  // outside the slider element.
  React.useEffect(() => {
    const handler = () => { isDragging.current = false; };
    document.addEventListener("pointerup", handler);
    return () => document.removeEventListener("pointerup", handler);
  }, []);

  return (
    <SliderPrimitive.Root
      ref={rootRef as React.Ref<HTMLSpanElement>}
      data-slot="slider"
      defaultValue={defaultValue}
      value={value}
      min={min}
      max={max}
      onValueChange={onValueChange}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      className={cn(
        "relative flex w-full touch-none items-center select-none data-[disabled]:opacity-50 data-[orientation=vertical]:h-full data-[orientation=vertical]:min-h-44 data-[orientation=vertical]:w-auto data-[orientation=vertical]:flex-col",
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
          className={cn(
            "border-primary ring-ring/50 block size-4 shrink-0 rounded-full border-2 bg-white shadow-sm transition-[color,box-shadow] hover:ring-4 focus-visible:ring-4 focus-visible:outline-hidden disabled:pointer-events-none disabled:opacity-50"
          )}
        />
      ))}
    </SliderPrimitive.Root>
  );
}

export { Slider };
