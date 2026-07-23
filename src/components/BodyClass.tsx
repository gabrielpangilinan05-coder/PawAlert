"use client";

import { useEffect } from "react";

/** Adds a class to document.body for page-scoped CSS (matches PHP bodyClass). */
export function BodyClass({ name }: { name: string }) {
  useEffect(() => {
    document.body.classList.add(name);
    return () => {
      document.body.classList.remove(name);
    };
  }, [name]);
  return null;
}
