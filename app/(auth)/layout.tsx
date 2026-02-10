export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-lingo-bg px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-black text-lingo-green">LingoClaw</h1>
          <p className="mt-2 text-lingo-text-light">Learn a language. Have fun.</p>
        </div>
        <div className="rounded-2xl bg-white border-2 border-lingo-border p-8">
          {children}
        </div>
      </div>
    </div>
  );
}
