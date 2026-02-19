"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Image from "next/image";
import Link from "next/link";
import { DEFAULT_PATH } from "@/lib/constants";

export function SignInForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await signIn.email({ email, password });
    setLoading(false);

    if (result.error) {
      setError(result.error.message || "Sign in failed");
    } else {
      router.push(DEFAULT_PATH);
    }
  }

  async function handleGoogleSignIn() {
    setError("");
    setGoogleLoading(true);
    await signIn.social({
      provider: "google",
      callbackURL: DEFAULT_PATH,
    });
  }

  return (
    <div className="space-y-4">
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
      </form>

      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-lingo-border" />
        <span className="text-sm text-lingo-text-light uppercase tracking-wide">or</span>
        <div className="h-px flex-1 bg-lingo-border" />
      </div>

      <Button
        variant="outline"
        loading={googleLoading}
        onClick={handleGoogleSignIn}
        className="w-full"
      >
        <Image src="/google.svg" alt="" width={20} height={20} className="inline-block mr-2" />
        Sign in with Google
      </Button>

      <p className="text-center text-sm text-lingo-text-light">
        Don&apos;t have an account?{" "}
        <Link href="/sign-up" className="font-bold text-lingo-blue hover:underline">
          Sign Up
        </Link>
      </p>
    </div>
  );
}
