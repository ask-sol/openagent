import { useState, useEffect, useRef } from "react";

const STATUS_WORDS = [
  "Thinking",
  "Working",
  "Cooking",
  "Brewing",
  "Agent",
  "Crafting",
  "Conjuring",
  "Scheming",
  "Crunching",
  "Achieving",
  "Hacking",
  "Wiring",
  "Assembling",
  "Forging",
  "Spinning up",
  "Vibing",
  "Manifesting",
  "Plotting",
  "Engineering",
  "Synthesizing",
  "Calibrating",
  "Doing the thing",
  "On it",
  "Locked in",
  "In the zone",
  "Shipping",
  "Building",
  "Brainstorming",
  "Executing",
  "Figuring it out",
  "Making magic",
];

export function useStatusWord(active: boolean, intervalMs = 2200): string {
  const [word, setWord] = useState(() => STATUS_WORDS[Math.floor(Math.random() * STATUS_WORDS.length)]);
  const usedRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    if (!active) {
      usedRef.current.clear();
      return;
    }

    const pick = () => {
      if (usedRef.current.size >= STATUS_WORDS.length - 1) {
        usedRef.current.clear();
      }
      let idx: number;
      do {
        idx = Math.floor(Math.random() * STATUS_WORDS.length);
      } while (usedRef.current.has(idx));
      usedRef.current.add(idx);
      setWord(STATUS_WORDS[idx]);
    };

    pick();
    const timer = setInterval(pick, intervalMs);
    return () => clearInterval(timer);
  }, [active, intervalMs]);

  return word;
}
