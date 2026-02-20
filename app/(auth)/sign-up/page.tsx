import { SignUpForm } from "@/components/auth/sign-up-form";

export const metadata = { title: "Sign Up — OpenLingo" };

export default function SignUpPage() {
  return (
    <>
      <h2 className="mb-6 text-center text-2xl font-bold text-lingo-text">
        Start learning for free!
      </h2>
      <SignUpForm />
    </>
  );
}
