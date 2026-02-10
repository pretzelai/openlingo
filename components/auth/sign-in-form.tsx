"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";

export function SignInForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await signIn.email({ email, password });
    setLoading(false);

    if (result.error) {
      setError(result.error.message || "Sign in failed");
    } else {
      router.push("/learn");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        label="Email"
        type="email"
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <Input
        label="Password"
        type="password"
        placeholder="Your password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />
      {error && (
        <p className="text-sm text-lingo-red font-medium">{error}</p>
      )}
      <Button type="submit" loading={loading} className="w-full">
        Sign In
      </Button>
      <p className="text-center text-sm text-lingo-text-light">
        Don&apos;t have an account?{" "}
        <Link href="/sign-up" className="font-bold text-lingo-blue hover:underline">
          Sign Up
        </Link>
      </p>
    </form>
  );
}
