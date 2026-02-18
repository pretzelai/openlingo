import { SignInForm } from "@/components/auth/sign-in-form";

export const metadata = { title: "Sign In — ClaudeLingo" };

export default function SignInPage() {
  return (
    <>
      <h2 className="mb-6 text-center text-2xl font-bold text-lingo-text">
        Welcome back!
      </h2>
      <SignInForm />
    </>
  );
}
