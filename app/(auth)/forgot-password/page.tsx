import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export default function ForgotPasswordPage() {
  return (
    <>
      <h2 className="mb-6 text-center text-2xl font-bold text-lingo-text">
        Forgot password?
      </h2>
      <ForgotPasswordForm />
    </>
  );
}
