"use client";

import { useEffect } from "react";
import posthog from "posthog-js";

export function PostHogIdentify({
  userId,
  email,
  name,
}: {
  userId: string;
  email?: string | null;
  name?: string | null;
}) {
  useEffect(() => {
    posthog.identify(userId, {
      email: email ?? undefined,
      name: name ?? undefined,
    });
  }, [userId, email, name]);

  return null;
}
