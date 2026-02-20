import Link from "next/link";
import { getSession } from "@/lib/auth-server";
import { redirect } from "next/navigation";
import { DEFAULT_PATH } from "@/lib/constants";

export default async function LandingPage() {
  const session = await getSession();
  if (session) redirect(DEFAULT_PATH);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-lingo-bg px-4">
      <div className="max-w-lg text-center">
        <h1 className="text-6xl font-black text-lingo-green mb-4">OpenLingo</h1>
        <p className="text-xl text-lingo-text-light mb-2">
          The free, fun, and effective way to learn a new language!
        </p>
        <p className="text-base text-lingo-text-light mb-8">
          Keep your streak and master a new language the fun way!
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/sign-up"
            className="inline-flex items-center justify-center rounded-2xl bg-lingo-green px-8 py-3 text-lg font-bold uppercase text-white border-b-4 border-lingo-green-dark hover:bg-lingo-green/90 transition-colors"
          >
            Get Started
          </Link>
          <Link
            href="/sign-in"
            className="inline-flex items-center justify-center rounded-2xl bg-white px-8 py-3 text-lg font-bold uppercase text-lingo-green border-2 border-lingo-border hover:bg-lingo-gray/30 transition-colors"
          >
            I Already Have an Account
          </Link>
        </div>
      </div>
    </div>
  );
}
