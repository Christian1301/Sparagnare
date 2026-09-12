"use client";

import { useState } from "react";
import { joinWalletByInvite } from "@/app/actions";

export default function JoinInviteButton({ token }: { token: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleJoin() {
    if (loading) return;
    setLoading(true);
    setError("");
    const { error } = await joinWalletByInvite(token);
    if (error) {
      setError(error);
      setLoading(false);
      return;
    }
    window.location.href = "/app";
  }

  return (
    <div>
      <button
        onClick={handleJoin}
        disabled={loading}
        className="bg-ink text-paper rounded-lg px-5 py-2.5 text-sm font-semibold disabled:opacity-60"
      >
        {loading ? "Un momento…" : "Entra nel portafoglio"}
      </button>
      {error && <div className="text-sm text-rust mt-3">{error}</div>}
    </div>
  );
}
