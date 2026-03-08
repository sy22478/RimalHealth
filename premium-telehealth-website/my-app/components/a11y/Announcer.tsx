"use client";

import { useEffect, useState } from "react";

interface AnnouncerProps {
  /** The message to announce to screen readers. Update this value to trigger a new announcement. */
  message: string;
  /** "polite" queues after current speech; "assertive" interrupts immediately. Defaults to "polite". */
  politeness?: "polite" | "assertive";
}

/**
 * Invisible ARIA live region. Updates cause screen readers to read the new message.
 * Clear + re-set pattern ensures repeated identical messages are also announced.
 */
export function Announcer({ message, politeness = "polite" }: AnnouncerProps) {
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => {
    // Clear first so screen readers re-announce even if message text is identical
    const timer1 = setTimeout(() => setAnnouncement(""), 0);
    const timer2 = setTimeout(() => setAnnouncement(message), 100);
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [message]);

  return (
    <div
      role="status"
      aria-live={politeness}
      aria-atomic="true"
      className="sr-only"
    >
      {announcement}
    </div>
  );
}
