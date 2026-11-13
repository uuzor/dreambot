"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";

/** A thin marquee strip. Zolo uses these as connective tissue between
 *  sections; here it carries the live-market line instead of a logo wall. */
export function Marquee({
  items,
  reverse = false,
  className,
}: {
  items: string[];
  reverse?: boolean;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const doubled = [...items, ...items];

  return (
    <div
      className={`relative flex overflow-hidden border-y border-line py-4 ${className ?? ""}`}
      style={{
        maskImage:
          "linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent)",
      }}
    >
      <div
        className={`flex shrink-0 items-center gap-10 pr-10 ${
          reduce ? "" : reverse ? "animate-marquee-rev" : "animate-marquee"
        }`}
      >
        {doubled.map((item, i) => (
          <span key={i} className="flex items-center gap-10 whitespace-nowrap">
            <span className="font-mono text-[12px] tracking-wide text-dim">{item}</span>
            <span className="h-1 w-1 rounded-full bg-line-2" />
          </span>
        ))}
      </div>
    </div>
  );
}

/** A number that counts up once, on mount. Used for the hero stats. */
export function CountUp({
  to,
  suffix = "",
  prefix = "",
  decimals = 0,
  duration = 1400,
}: {
  to: number;
  suffix?: string;
  prefix?: string;
  decimals?: number;
  duration?: number;
}) {
  const reduce = useReducedMotion();
  const [value, setValue] = useState(reduce ? to : 0);

  useEffect(() => {
    if (reduce) return;
    let frame = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min((t - start) / duration, 1);
      // easeOutExpo, so the number settles rather than stopping dead.
      const eased = p === 1 ? 1 : 1 - Math.pow(2, -10 * p);
      setValue(to * eased);
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [to, duration, reduce]);

  return (
    <span className="tnum">
      {prefix}
      {value.toFixed(decimals)}
      {suffix}
    </span>
  );
}

/** Fade-and-rise on scroll into view, staggered by index. */
export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.65, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
