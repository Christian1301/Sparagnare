"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { occursInMonth } from "@/lib/finance";
import MonthlyTrendChart from "@/components/MonthlyTrendChart";
import {
  addTransaction, deleteTransaction, addCategory, deleteCategory,
  createSharedWallet, inviteMember, removeMember, signOut,
  stopRecurring, deleteWallet, leaveWallet,
} from "@/app/actions";

const MONTHS = ["Gennaio","Febbraio","Marzo","Aprile","Maggio","Giugno","Luglio","Agosto","Settembre","Ottobre","Novembre","Dicembre"];
const PALETTE = ["#2F6F62","#C9A227","#8B5E3C","#6B5B95","#B5473D","#5B6B73","#3F6C87","#9C6B30"];

function formatEUR(n: number) {
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(n || 0);
}

export default function Dashboard({ wallets, userId, userEmail }: { wallets: any[]; userId: string; userEmail: string }) {
  const supabase = createClient();
  const [walletList, setWalletList] = useState(wallets);
  const [activeWalletId, setActiveWalletId] = useState(wallets[0]?.id ?? null);
  const [categories, setCategories] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cursor, setCursor] = useState(() => { const d = new Date(); return { year: d.getFullYear(), month: d.getMonth() }; });

  const [addMenu, setAddMenu] = useState<null | "choose" | "income" | "expense">(null);
  const [savingTx, setSavingTx] = useState(false);
  const [showCatManager, setShowCatManager] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [showNewWallet, setShowNewWallet] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [stoppingId, setStoppingId] = useState<string | null>(null);
  const [confirmingWalletAction, setConfirmingWalletAction] = useState(false);

  const activeWallet = walletList.find((w) => w.id === activeWalletId);

  const loadWalletData = useCallback(async (walletId: string) => {
    setLoading(true);
    const [
      { data: cats, error: catsError },
      { data: txs, error: txsError },
      { data: mems, error: memsError },
    ] = await Promise.all([
      supabase.from("categories").select("*").eq("wallet_id", walletId).order("name"),
      supabase.from("transactions").select("*").eq("wallet_id", walletId).order("date", { ascending: false }),
      supabase.from("wallet_members").select("user_id, role, profiles(email, display_name)").eq("wallet_id", walletId),
    ]);
    const loadError = catsError || txsError || memsError;
    if (loadError) {
      setError("Impossibile caricare i dati del portafoglio. Riprova tra poco.");
    }
    setCategories(cats || []);
    setTransactions(txs || []);
    setMembers(mems || []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    if (activeWalletId) loadWalletData(activeWalletId);
  }, [activeWalletId, loadWalletData]);

  const monthIncome = useMemo(() => transactions.filter((t) => t.type === "income" && occursInMonth(t, cursor)), [transactions, cursor]);
  const monthExpenses = useMemo(() => transactions.filter((t) => t.type === "expense" && occursInMonth(t, cursor)), [transactions, cursor]);
  const totalIncome = monthIncome.reduce((s, t) => s + Number(t.amount), 0);
  const totalExpenses = monthExpenses.reduce((s, t) => s + Number(t.amount), 0);
  const balance = totalIncome - totalExpenses;

  function catFor(id: string | null) {
    return categories.find((c) => c.id === id) || { name: "—", color: "#999" };
  }

  function shiftMonth(delta: number) {
    setCursor((cur) => {
      let m = cur.month + delta, y = cur.year;
      if (m < 0) { m = 11; y -= 1; } if (m > 11) { m = 0; y += 1; }
      return { year: y, month: m };
    });
  }

  async function handleAddTransaction(type: "income" | "expense", form: any) {
    if (savingTx) return; // evita doppio invio (es. doppio tap su mobile)
    const amt = parseFloat(String(form.amount).replace(",", "."));
    if (!amt || amt <= 0) return;
    setSavingTx(true);
    try {
      const { error } = await addTransaction({
        walletId: activeWalletId!,
        type,
        amount: amt,
        categoryId: type === "expense" ? form.categoryId : null,
        description: form.description.trim(),
        date: form.date,
        isRecurring: form.recurring,
      });
      if (error) setError(error);
      else { setAddMenu(null); loadWalletData(activeWalletId!); }
    } finally {
      setSavingTx(false);
    }
  }

  async function handleDelete(id: string) {
    const { error } = await deleteTransaction(id);
    if (error) setError(error);
    else loadWalletData(activeWalletId!);
    setConfirmingId(null);
  }

  async function handleAddCategory(name: string) {
    if (!name.trim()) return;
    const usedColors = new Set(categories.map((c) => c.color));
    const color = PALETTE.find((p) => !usedColors.has(p)) ?? PALETTE[categories.length % PALETTE.length];
    const { error } = await addCategory(activeWalletId!, name.trim(), color);
    if (error) setError(error);
    else loadWalletData(activeWalletId!);
  }

  async function handleDeleteCategory(id: string) {
    const { error } = await deleteCategory(id);
    if (error) setError(error);
    else loadWalletData(activeWalletId!);
  }

  async function handleCreateWallet(name: string) {
    const { error, wallet } = await createSharedWallet(name);
    if (error) { setError(error); return; }
    const newWallet = { ...wallet, role: "owner" };
    setWalletList((w) => [...w, newWallet]);
    setActiveWalletId(newWallet.id);
    setShowNewWallet(false);
  }

  async function handleInvite(email: string) {
    const { error } = await inviteMember(activeWalletId!, email);
    if (error) setError(error);
    else { setError(""); loadWalletData(activeWalletId!); }
  }

  async function handleStopRecurring(id: string) {
    // Interrompe la voce ricorrente a partire dal mese attualmente
    // visualizzato: l'ultima occorrenza resta il mese precedente.
    let endMonth = cursor.month - 1, endYear = cursor.year;
    if (endMonth < 0) { endMonth = 11; endYear -= 1; }
    const lastDay = new Date(endYear, endMonth + 1, 0).getDate();
    const endDate = `${endYear}-${String(endMonth + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
    const { error } = await stopRecurring(id, endDate);
    if (error) setError(error);
    else loadWalletData(activeWalletId!);
    setStoppingId(null);
  }

  async function handleDeleteWallet() {
    const { error } = await deleteWallet(activeWalletId!);
    if (error) { setError(error); return; }
    const remaining = walletList.filter((w) => w.id !== activeWalletId);
    setWalletList(remaining);
    setActiveWalletId(remaining[0]?.id ?? null);
    setShowMembers(false);
    setConfirmingWalletAction(false);
  }

  async function handleLeaveWallet() {
    const { error } = await leaveWallet(activeWalletId!);
    if (error) { setError(error); return; }
    const remaining = walletList.filter((w) => w.id !== activeWalletId);
    setWalletList(remaining);
    setActiveWalletId(remaining[0]?.id ?? null);
    setShowMembers(false);
    setConfirmingWalletAction(false);
  }

  const sortedIncome = [...monthIncome].sort((a, b) => a.date.localeCompare(b.date));
  const sortedExpenses = [...monthExpenses].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="max-w-md mx-auto min-h-screen pb-16">
      {/* Wallet tabs */}
      <div className="safe-top sticky top-0 z-10 bg-paper/95 backdrop-blur-sm flex items-center gap-2 px-5 pt-4 pb-2 overflow-x-auto border-b border-line">
        {walletList.map((w) => (
          <button
            key={w.id}
            onClick={() => setActiveWalletId(w.id)}
            className={`shrink-0 px-3.5 py-2 rounded-lg text-sm font-semibold ${
              w.id === activeWalletId ? "bg-ink text-paper" : "bg-line text-muted"
            }`}
          >
            {w.name}
          </button>
        ))}
        <button
          onClick={() => setShowNewWallet(true)}
          className="shrink-0 px-3 py-2 rounded-lg text-sm border border-line text-muted"
        >
          + Portafoglio
        </button>
        <button onClick={() => signOut()} className="ml-auto shrink-0 text-xs text-muted underline pr-1">
          Esci
        </button>
      </div>

      {/* Summary */}
      <div className="px-5 pt-4 pb-2">
        <div className="flex items-center justify-between">
          <button onClick={() => shiftMonth(-1)} aria-label="Mese precedente" className="text-muted w-10 h-10 flex items-center justify-center text-lg active:bg-line rounded-full transition-colors">‹</button>
          <div className="text-sm text-muted">{MONTHS[cursor.month]} {cursor.year}</div>
          <button onClick={() => shiftMonth(1)} aria-label="Mese successivo" className="text-muted w-10 h-10 flex items-center justify-center text-lg active:bg-line rounded-full transition-colors">›</button>
        </div>
        <div className={`font-serif text-4xl font-semibold text-center mt-1 ${balance >= 0 ? "text-ink" : "text-rust"}`}>
          {formatEUR(balance)}
        </div>
        <div className="flex justify-center gap-5 mt-1.5 text-sm">
          <span className="text-teal">+ {formatEUR(totalIncome)}</span>
          <span className="text-rust">– {formatEUR(totalExpenses)}</span>
        </div>
        {activeWallet?.is_shared && (
          <button onClick={() => setShowMembers(true)} className="block mx-auto mt-2 text-xs text-muted underline">
            Persone con accesso ({members.length})
          </button>
        )}
      </div>

      {error && (
        <div className="mx-5 my-2 bg-red-50 text-rust text-sm px-3 py-2 rounded-lg flex justify-between">
          <span>{error}</span>
          <button onClick={() => setError("")}>✕</button>
        </div>
      )}

      {loading ? (
        <div className="text-center text-sm text-muted py-10">Carico i dati…</div>
      ) : (
        <>
          <section className="px-5 pt-3 pb-1 border-t border-line mt-1">
            <MonthlyTrendChart transactions={transactions} cursor={cursor} />
          </section>

          <section className="px-5 pt-2">
            <div className="text-sm font-semibold text-muted mb-2">Entrate</div>
            {sortedIncome.length === 0 && <div className="text-sm text-muted pb-2">Nessuna entrata questo mese.</div>}
            {sortedIncome.map((t) => (
              <TxRow key={t.id} tx={t} label={t.description || "Entrata"}
                sub={t.is_recurring ? "Ricorrente" : new Date(t.date + "T00:00:00").toLocaleDateString("it-IT", { day: "numeric", month: "short" })}
                amountColor="text-teal" sign="+" confirmingId={confirmingId} setConfirmingId={setConfirmingId}
                stoppingId={stoppingId} setStoppingId={setStoppingId}
                onStopRecurring={() => handleStopRecurring(t.id)}
                onDelete={() => handleDelete(t.id)} />
            ))}
          </section>

          <section className="px-5 pt-4">
            <div className="text-sm font-semibold text-muted mb-2">Uscite</div>
            {sortedExpenses.length === 0 && <div className="text-sm text-muted pb-2">Nessuna uscita questo mese.</div>}
            {sortedExpenses.map((t) => {
              const cat = catFor(t.category_id);
              return (
                <TxRow key={t.id} tx={t} label={t.description || cat.name}
                  sub={`${cat.name}${t.is_recurring ? " · Ricorrente" : " · " + new Date(t.date + "T00:00:00").toLocaleDateString("it-IT", { day: "numeric", month: "short" })}`}
                  dot={cat.color} amountColor="text-rust" sign="–"
                  confirmingId={confirmingId} setConfirmingId={setConfirmingId}
                  stoppingId={stoppingId} setStoppingId={setStoppingId}
                  onStopRecurring={() => handleStopRecurring(t.id)}
                  onDelete={() => handleDelete(t.id)} />
              );
            })}
          </section>

          <div className="px-5 pt-4">
            <button onClick={() => setShowCatManager(true)} className="text-sm text-muted underline">
              Gestisci categorie
            </button>
          </div>
        </>
      )}

      {/* FAB */}
      {!loading && !addMenu && (
        <div className="fixed inset-x-0 bottom-0 z-10 flex justify-center pointer-events-none safe-bottom">
          <div className="relative w-full max-w-md h-0">
            <button
              onClick={() => setAddMenu("choose")}
              aria-label="Aggiungi"
              className="pointer-events-auto absolute bottom-6 right-5 w-14 h-14 rounded-full bg-gold text-ink shadow-lg flex items-center justify-center text-2xl leading-none active:scale-95 transition-transform"
            >
              +
            </button>
          </div>
        </div>
      )}

      {addMenu === "choose" && (
        <Sheet onClose={() => setAddMenu(null)}>
          <div className="text-base font-semibold mb-3">Cosa vuoi aggiungere?</div>
          <button onClick={() => setAddMenu("income")} className="w-full flex items-center gap-2.5 px-3.5 py-3 rounded-lg border border-line bg-white text-[15px] mb-2">
            <span className="text-teal">＋</span> Entrata
          </button>
          <button onClick={() => setAddMenu("expense")} className="w-full flex items-center gap-2.5 px-3.5 py-3 rounded-lg border border-line bg-white text-[15px]">
            <span className="text-rust">－</span> Uscita
          </button>
        </Sheet>
      )}

      {addMenu === "income" && (
        <TransactionForm
          title="Nuova entrata"
          categories={null}
          saving={savingTx}
          onClose={() => setAddMenu(null)}
          onSubmit={(form: any) => handleAddTransaction("income", form)}
        />
      )}

      {addMenu === "expense" && (
        <TransactionForm
          title="Nuova uscita"
          categories={categories}
          saving={savingTx}
          onClose={() => setAddMenu(null)}
          onSubmit={(form: any) => handleAddTransaction("expense", form)}
        />
      )}

      {showCatManager && (
        <Sheet onClose={() => setShowCatManager(false)} title="Categorie">
          <CategoryManagerBody categories={categories} onAdd={handleAddCategory} onDelete={handleDeleteCategory} />
        </Sheet>
      )}

      {showMembers && activeWallet && (
        <Sheet
          onClose={() => { setShowMembers(false); setConfirmingWalletAction(false); }}
          title="Persone con accesso"
        >
          <MembersBody
            members={members}
            userId={userId}
            isOwner={activeWallet.owner_id === userId}
            onInvite={handleInvite}
            onRemove={async (uid: string) => { await removeMember(activeWalletId!, uid); loadWalletData(activeWalletId!); }}
            onDeleteWallet={handleDeleteWallet}
            onLeaveWallet={handleLeaveWallet}
            confirmingWalletAction={confirmingWalletAction}
            setConfirmingWalletAction={setConfirmingWalletAction}
          />
        </Sheet>
      )}

      {showNewWallet && (
        <Sheet onClose={() => setShowNewWallet(false)} title="Nuovo portafoglio condiviso">
          <NewWalletBody onCreate={handleCreateWallet} />
        </Sheet>
      )}
    </div>
  );
}

function TxRow({
  tx, label, sub, dot, amountColor, sign, onDelete, confirmingId, setConfirmingId,
  stoppingId, setStoppingId, onStopRecurring,
}: any) {
  const confirming = confirmingId === tx.id;
  const stopping = stoppingId === tx.id;
  return (
    <div className="border-b border-line">
      <div className="flex items-center gap-2.5 py-2.5">
        {dot ? <div className="w-2 h-2 rounded-full shrink-0" style={{ background: dot }} /> : <div className="w-2" />}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate flex items-center gap-1">
            {label} {tx.is_recurring && <span className="text-muted text-xs">↻</span>}
          </div>
          <div className="text-xs text-muted">{sub}</div>
        </div>
        <div className={`font-serif font-semibold text-[15px] whitespace-nowrap ${amountColor}`}>
          {sign} {formatEUR(Number(tx.amount))}
        </div>
        {confirming ? (
          <div className="flex gap-1">
            <button onClick={onDelete} className="bg-rust text-white rounded px-2 py-1 text-xs">Elimina</button>
            <button onClick={() => setConfirmingId(null)} className="border border-line rounded px-2 py-1 text-xs">Annulla</button>
          </div>
        ) : (
          <div className="flex items-center -mr-1.5">
            {tx.is_recurring && onStopRecurring && (
              <button onClick={() => setStoppingId(tx.id)} title="Interrompi ricorrenza" aria-label="Interrompi ricorrenza" className="text-muted w-9 h-9 flex items-center justify-center active:bg-line rounded-full transition-colors">⏸</button>
            )}
            <button onClick={() => setConfirmingId(tx.id)} aria-label="Elimina" className="text-muted w-9 h-9 flex items-center justify-center active:bg-line rounded-full transition-colors">🗑</button>
          </div>
        )}
      </div>
      {stopping && (
        <div className="flex items-center justify-between gap-2 pb-2.5 -mt-1 text-xs">
          <span className="text-muted">Interrompi la ricorrenza da questo mese in poi?</span>
          <div className="flex gap-1 shrink-0">
            <button onClick={onStopRecurring} className="bg-ink text-paper rounded px-2 py-1">Conferma</button>
            <button onClick={() => setStoppingId(null)} className="border border-line rounded px-2 py-1">Annulla</button>
          </div>
        </div>
      )}
    </div>
  );
}

function Sheet({ children, onClose, title }: any) {
  return (
    <div className="sheet-backdrop fixed inset-0 bg-ink/40 flex items-end justify-center z-20" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="sheet-panel safe-bottom bg-paper w-full max-w-md rounded-t-2xl p-5 pt-3 relative max-h-[85vh] overflow-y-auto">
        <div className="w-9 h-1 rounded-full bg-line mx-auto mb-3" />
        {title && (
          <div className="flex justify-between items-center mb-3.5">
            <div className="text-base font-semibold">{title}</div>
            <button onClick={onClose} aria-label="Chiudi" className="-mr-2 w-9 h-9 flex items-center justify-center text-muted">✕</button>
          </div>
        )}
        {!title && (
          <button onClick={onClose} aria-label="Chiudi" className="absolute top-2 right-3 w-9 h-9 flex items-center justify-center text-muted">✕</button>
        )}
        {children}
      </div>
    </div>
  );
}

function TransactionForm({ title, categories, onClose, onSubmit, saving }: any) {
  const [form, setForm] = useState({
    amount: "", categoryId: categories?.[0]?.id ?? null, description: "",
    date: new Date().toISOString().slice(0, 10), recurring: false,
  });
  return (
    <Sheet onClose={onClose} title={title}>
      <form
        onSubmit={(e) => { e.preventDefault(); if (!saving) onSubmit(form); }}
        className="flex flex-col gap-3"
      >
        <input autoFocus inputMode="decimal" placeholder="Importo (€)" value={form.amount}
          onChange={(e) => setForm({ ...form, amount: e.target.value })}
          className="border border-line rounded-lg px-3 py-2.5 text-sm bg-white outline-none" required />

        {categories && (
          <div className="flex gap-1.5 flex-wrap">
            {categories.map((c: any) => (
              <button type="button" key={c.id} onClick={() => setForm({ ...form, categoryId: c.id })}
                className="px-3 py-1.5 rounded-full text-sm"
                style={{
                  border: form.categoryId === c.id ? `2px solid ${c.color}` : "1px solid #D8D2C2",
                  background: form.categoryId === c.id ? `${c.color}1A` : "transparent",
                }}>
                {c.name}
              </button>
            ))}
          </div>
        )}

        <input placeholder="Descrizione (opzionale)" value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          className="border border-line rounded-lg px-3 py-2.5 text-sm bg-white outline-none" />

        <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })}
          className="border border-line rounded-lg px-3 py-2.5 text-sm bg-white outline-none" required />

        <button type="button" onClick={() => setForm({ ...form, recurring: !form.recurring })}
          className="flex items-center gap-2 border border-line rounded-lg px-3 py-2.5 text-sm text-left">
          <span className={`w-[18px] h-[18px] rounded border border-line flex items-center justify-center ${form.recurring ? "bg-gold" : ""}`}>
            {form.recurring && "✓"}
          </span>
          Si ripete ogni mese
        </button>

        <button type="submit" disabled={saving} className="bg-ink text-paper rounded-lg py-2.5 text-sm font-semibold active:opacity-80 transition-opacity disabled:opacity-50">
          {saving ? "Salvataggio..." : "Salva"}
        </button>
      </form>
    </Sheet>
  );
}

function CategoryManagerBody({ categories, onAdd, onDelete }: any) {
  const [name, setName] = useState("");
  return (
    <div>
      <div className="flex flex-col gap-1 max-h-[45vh] overflow-y-auto">
        {categories.map((c: any) => (
          <div key={c.id} className="flex items-center gap-2.5 py-1.5">
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: c.color }} />
            <div className="flex-1 text-sm">{c.name}</div>
            <button onClick={() => onDelete(c.id)} aria-label="Elimina categoria" className="text-muted w-9 h-9 flex items-center justify-center active:bg-line rounded-full transition-colors shrink-0">🗑</button>
          </div>
        ))}
      </div>
      <div className="flex gap-2 mt-3">
        <input placeholder="Nuova categoria" value={name} onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { onAdd(name); setName(""); } }}
          className="flex-1 border border-line rounded-lg px-3 py-2.5 text-sm bg-white outline-none" />
        <button onClick={() => { onAdd(name); setName(""); }} aria-label="Aggiungi categoria" className="bg-ink text-paper rounded-lg px-4 active:opacity-80 transition-opacity">✓</button>
      </div>
    </div>
  );
}

function MembersBody({
  members, userId, isOwner, onInvite, onRemove,
  onDeleteWallet, onLeaveWallet, confirmingWalletAction, setConfirmingWalletAction,
}: any) {
  const [email, setEmail] = useState("");
  return (
    <div>
      <div className="flex flex-col gap-2 mb-4">
        {members.map((m: any) => (
          <div key={m.user_id} className="flex items-center justify-between text-sm">
            <span>{m.profiles?.display_name || m.profiles?.email} {m.role === "owner" && "(proprietario)"}</span>
            {isOwner && m.user_id !== userId && (
              <button onClick={() => onRemove(m.user_id)} aria-label="Rimuovi persona" className="text-muted w-9 h-9 flex items-center justify-center active:bg-line rounded-full transition-colors shrink-0">🗑</button>
            )}
          </div>
        ))}
      </div>
      {isOwner && (
        <div className="flex gap-2">
          <input placeholder="Email da invitare" value={email} onChange={(e) => setEmail(e.target.value)}
            className="flex-1 border border-line rounded-lg px-3 py-2.5 text-sm bg-white outline-none" />
          <button onClick={() => { onInvite(email); setEmail(""); }} className="bg-ink text-paper rounded-lg px-4 text-sm active:opacity-80 transition-opacity">
            Invita
          </button>
        </div>
      )}
      <p className="text-xs text-muted mt-3">
        L&apos;invitato deve avere già un account su questa app con la stessa email.
      </p>

      <div className="mt-5 pt-4 border-t border-line">
        {confirmingWalletAction ? (
          <div className="flex flex-col gap-2">
            <p className="text-xs text-rust">
              {isOwner
                ? "Eliminare questo portafoglio? Tutte le categorie e le transazioni andranno perse."
                : "Uscire da questo portafoglio condiviso?"}
            </p>
            <div className="flex gap-2">
              <button
                onClick={isOwner ? onDeleteWallet : onLeaveWallet}
                className="bg-rust text-white rounded-lg py-2 text-sm flex-1"
              >
                {isOwner ? "Elimina portafoglio" : "Esci dal portafoglio"}
              </button>
              <button
                onClick={() => setConfirmingWalletAction(false)}
                className="border border-line rounded-lg py-2 text-sm flex-1"
              >
                Annulla
              </button>
            </div>
          </div>
        ) : (
          <button onClick={() => setConfirmingWalletAction(true)} className="text-xs text-rust underline">
            {isOwner ? "Elimina portafoglio" : "Esci dal portafoglio"}
          </button>
        )}
      </div>
    </div>
  );
}

function NewWalletBody({ onCreate }: any) {
  const [name, setName] = useState("");
  return (
    <div className="flex flex-col gap-3">
      <input placeholder="Nome (es. Famiglia)" value={name} onChange={(e) => setName(e.target.value)}
        className="border border-line rounded-lg px-3 py-2.5 text-sm bg-white outline-none" />
      <button onClick={() => onCreate(name)} className="bg-ink text-paper rounded-lg py-2.5 text-sm font-semibold active:opacity-80 transition-opacity">
        Crea portafoglio
      </button>
    </div>
  );
}
