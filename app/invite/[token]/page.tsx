import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getInvitePreview } from "@/app/actions";
import JoinInviteButton from "@/components/JoinInviteButton";

export default async function InvitePage({ params }: { params: { token: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const preview = await getInvitePreview(params.token);
  const expired = !!(preview.expiresAt && new Date(preview.expiresAt) < new Date());
  const invalid = !!preview.error || !!preview.revoked || expired;

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm text-center">
        <div className="font-serif text-3xl font-semibold text-ink mb-6">Sparagnare</div>

        {invalid ? (
          <div className="text-sm text-rust">
            {preview.revoked
              ? "Questo link di invito è stato revocato."
              : expired
              ? "Questo link di invito è scaduto."
              : "Link di invito non valido."}
          </div>
        ) : !user ? (
          <>
            <p className="text-sm text-muted mb-4">
              Accedi per unirti al portafoglio <strong>{preview.walletName}</strong>.
            </p>
            <Link
              href={`/login?redirect=${encodeURIComponent(`/invite/${params.token}`)}`}
              className="inline-block bg-ink text-paper rounded-lg px-5 py-2.5 text-sm font-semibold"
            >
              Accedi
            </Link>
          </>
        ) : (
          <>
            <p className="text-sm text-muted mb-4">
              Vuoi unirti al portafoglio <strong>{preview.walletName}</strong>?
            </p>
            <JoinInviteButton token={params.token} />
          </>
        )}
      </div>
    </div>
  );
}
