import { useEffect, useRef, useState } from "react";

/**
 * Locally-authoritative text input with a debounced "apply" callback.
 *
 * The raw keystrokes the user types are always the source of truth for the field,
 * so a slow re-render (URL/search-param sync, refetch) can never overwrite
 * in-flight characters. Only the applied value is debounced.
 */
export function useDebouncedTextInput(
  externalValue: string,
  apply: (value: string) => void,
  delay = 250,
) {
  const [value, setValue] = useState(externalValue);
  const applyRef = useRef(apply);
  applyRef.current = apply;
  /** Last value we pushed outward — lets us ignore the echo coming back. */
  const lastApplied = useRef(externalValue);
  const dirty = useRef(false);

  // One-way sync: adopt external changes only when they did not originate here.
  useEffect(() => {
    if (externalValue === lastApplied.current) return;
    lastApplied.current = externalValue;
    dirty.current = false;
    setValue(externalValue);
  }, [externalValue]);

  useEffect(() => {
    if (!dirty.current) return;
    const id = setTimeout(() => {
      if (value === lastApplied.current) return;
      lastApplied.current = value;
      dirty.current = false;
      applyRef.current(value);
    }, delay);
    return () => clearTimeout(id);
  }, [value, delay]);

  return {
    value,
    onChange: (next: string) => {
      dirty.current = true;
      setValue(next);
    },
  };
}
