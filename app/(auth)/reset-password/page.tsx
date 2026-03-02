import { Suspense } from "react";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export default function ResetPasswordPage() {
  return (
    <>
      <h2 className="mb-6 text-center text-2xl font-bold text-lingo-text">
        Reset password
      </h2>
      <Suspense>
        <ResetPasswordForm />
      </Suspense>
    </>
  );
}
