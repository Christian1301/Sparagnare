"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setInfo("");
    setLoading(true);

    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setError(error.message === "Invalid login credentials"
          ? "Email o password non corrette."
          : error.message);
      } else {
        router.push("/app");
        router.refresh();
      }
    } else {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) {
        setError(error.message);
      } else {
        setInfo("Controlla la tua email per confermare la registrazione.");
      }
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="font-serif text-3xl font-semibold text-ink">Sparagnare</div>
          <div className="text-sm text-muted mt-1">
            {mode === "signin" ? "Accedi al tuo bilancio" : "Crea un nuovo account"}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            type="email"
            required
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="border border-line rounded-lg px-3 py-2.5 text-sm bg-white outline-none"
          />
          <input
            type="password"
            required
            minLength={6}
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="border border-line rounded-lg px-3 py-2.5 text-sm bg-white outline-none"
          />

          {error && <div className="text-sm text-rust">{error}</div>}
          {info && <div className="text-sm text-teal">{info}</div>}

          <button
            type="submit"
            disabled={loading}
            className="bg-ink text-paper rounded-lg py-2.5 text-sm font-semibold mt-1 disabled:opacity-60"
          >
            {loading ? "Un momento…" : mode === "signin" ? "Accedi" : "Registrati"}
          </button>
        </form>

        <button
          onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setError(""); setInfo(""); }}
          className="text-sm text-muted underline mt-4 block mx-auto"
        >
          {mode === "signin" ? "Non hai un account? Registrati" : "Hai già un account? Accedi"}
        </button>
      </div>
    </div>
  );
}
