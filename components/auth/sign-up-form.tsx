"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signUp } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { DEFAULT_PATH } from "@/lib/constants";

export function SignUpForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await signUp.email({ name, email, password });
    setLoading(false);

    if (result.error) {
      setError(result.error.message || "Sign up failed");
    } else {
      router.push(DEFAULT_PATH);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        label="Name"
        type="text"
        placeholder="Your name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
      />
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
        placeholder="Create a password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        minLength={8}
      />
      {error && (
        <p className="text-sm text-lingo-red font-medium">{error}</p>
      )}
      <Button type="submit" loading={loading} className="w-full">
        Create Account
      </Button>
      <p className="text-center text-sm text-lingo-text-light">
        Already have an account?{" "}
        <Link href="/sign-in" className="font-bold text-lingo-blue hover:underline">
          Sign In
        </Link>
      </p>
    </form>
  );
}
