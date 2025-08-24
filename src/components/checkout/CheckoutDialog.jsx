import { useEffect, useMemo, useState } from "react";
import { ticket, checkout } from "../../https";
import { fmt, toNum } from "../../utils/money";

/** Normalise la réponse du ticket pour être robuste aux variations d'API */
function normalizeTicket(raw) {
    if (!raw) return { items: [], total_due: 0, paid_amount: 0 };
    const root = raw.order ?? raw;

    const total_due = toNum(
        root.total_due ?? raw.total_due ?? root.totals?.total_due ?? raw.totals?.total_due
    );
    const paid_amount = toNum(
        root.paid_amount ?? raw.paid_amount ?? root.totals?.paid_amount ?? raw.totals?.paid_amount
    );

    const candidates =
        root.items ??
        raw.items ??
        root.lines ??
        raw.lines ??
        root.order_items ??
        raw.order_items ??
        [];

    const items = (Array.isArray(candidates) ? candidates : []).map((it, i) => {
        const id = it.id ?? it.item_id ?? it.pk ?? it.uuid ?? `tmp-${Date.now()}-${i}`;
        const name =
            it.label ??
            it.name ??
            it.dish_name ??
            it.title ??
            it.product_name ??
            it.dish?.name ??
            `Article #${id}`;
        const unit_price = toNum(it.unit_price ?? it.price ?? it.unitPrice ?? it.amount_ht ?? 0);
        const quantity = toNum(it.quantity ?? it.qty ?? 1);
        const status = (it.status ?? "ACTIVE").toUpperCase();
        const is_void =
            Boolean(it.is_void) ||
            Boolean(it.is_deleted) ||
            status === "VOID" ||
            status === "CANCELLED" ||
            status === "DELETED";
        return { id, name, unit_price, quantity, status, is_void };
    });

    return { items: items.filter((it) => !it.is_void), total_due, paid_amount };
}

// arrondi 2 déc.
const fix2 = (n) => Number((Math.round(Number(n || 0) * 100) / 100).toFixed(2));

export default function CheckoutDialog({
                                           open,
                                           onClose,
                                           order,               // { id, total_due?, paid_amount? }
                                           defaultMethod = "CASH",
                                           onSuccess
                                       }) {
    const [loading, setLoading] = useState(false);
    const [ticketData, setTicketData] = useState({ items: [], total_due: 0, paid_amount: 0 });
    const [method, setMethod] = useState(defaultMethod);
    const [error, setError] = useState("");

    // debug optionnel
    const [debugOpen, setDebugOpen] = useState(false);
    const [rawSnapshot, setRawSnapshot] = useState(null);

    // espèces : "montant donné" par le client (saisi)
    const [cashGivenText, setCashGivenText] = useState(""); // string de l'input
    const cashGiven = useMemo(() => toNum(cashGivenText || 0), [cashGivenText]);

    useEffect(() => {
        if (!open || !order?.id) return;
        setError("");
        setMethod(defaultMethod);
        setTicketData({ items: [], total_due: 0, paid_amount: 0 });
        setCashGivenText(""); // reset input
        setRawSnapshot(null);

        (async () => {
            try {
                setLoading(true);
                const { data } = await ticket(order.id);
                setRawSnapshot(data);
                setTicketData(normalizeTicket(data));
            } catch (e) {
                // fallback minimal : on affiche au moins les totaux connus
                setTicketData({
                    items: [],
                    total_due: toNum(order?.total_due),
                    paid_amount: toNum(order?.paid_amount),
                });
            } finally {
                setLoading(false);
            }
        })();
    }, [open, order?.id, defaultMethod]);

    if (!open) return null;

    // total local (affiché) = somme des sous-totaux
    const localTotal = ticketData.items.reduce(
        (acc, it) => acc + (toNum(it.unit_price) * toNum(it.quantity)),
        0
    );

    // due = total_dû serveur, sinon fallback local
    const due  = fix2(ticketData.total_due || localTotal);
    const paid = fix2(ticketData.paid_amount);
    const remaining = fix2(Math.max(0, due - paid));

    // --- CASH : on saisit "montant donné" par le client ---
    // montant encaissé = min(remaining, cashGiven)
    // rendu = max(0, cashGiven - remaining)
    const effectiveGiven   = (method === "CASH")
        ? (cashGivenText === "" ? remaining : cashGiven) // si vide → propose "exact"
        : 0;
    const cashToRecord     = (method === "CASH") ? fix2(Math.min(remaining, Math.max(0, effectiveGiven))) : 0;
    const cashChange       = (method === "CASH") ? fix2(Math.max(0, effectiveGiven - remaining)) : 0;
    const cashPartialLeft  = (method === "CASH") ? fix2(Math.max(0, remaining - effectiveGiven)) : 0;
    const isPartialCash    = method === "CASH" && effectiveGiven > 0 && effectiveGiven < remaining;

    const confirm = async () => {
        setError("");

        let amountToSend = 0;

        if (method === "CASH") {
            if (cashGivenText === "") {
                // pas saisi → "exact"
                amountToSend = remaining;
            } else {
                if (effectiveGiven <= 0) {
                    setError("Montant donné invalide.");
                    return;
                }
                amountToSend = cashToRecord; // <-- on enregistre SEULEMENT ce qu'on encaisse réellement
            }
            if (amountToSend <= 0) {
                setError("Rien à encaisser.");
                return;
            }
        } else {
            // Carte/En ligne : on envoie exactement le restant
            amountToSend = remaining;
            if (amountToSend <= 0) {
                setError("Rien à encaisser.");
                return;
            }
        }

        try {
            setLoading(true);
            await checkout(order.id, method, fix2(amountToSend));
            onSuccess?.({
                orderId: order.id,
                method,
                amount: fix2(amountToSend),
                cash_change: method === "CASH" ? cashChange : 0,
                cash_given: method === "CASH" ? effectiveGiven : 0,
                partial_left: method === "CASH" ? cashPartialLeft : 0
            });
            onClose?.();
        } catch (e) {
            setError("Échec de l'encaissement. Vérifie la connexion et réessaie.");
        } finally {
            setLoading(false);
        }
    };

    // boutons rapides espèces
    const fix = (n) => setCashGivenText(String(fix2(n)));
    const add = (n) => setCashGivenText((prev) => String(fix2(toNum(prev || 0) + n)));
    const setExact = () => fix(remaining);
    const clearCash = () => setCashGivenText("");

    return (
        <div className="fixed inset-0 z-[100]">
            {/* overlay */}
            <div className="absolute inset-0 bg-black/60" onClick={() => !loading && onClose?.()} />
            {/* modal */}
            <div className="absolute left-1/2 top-1/2 w-[780px] -translate-x-1/2 -translate-y-1/2
                      rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] p-6">
                <h2 className="text-xl font-semibold mb-1">Confirmer l’encaissement</h2>
                <p className="text-sm opacity-80 mb-4">Vérifie les montants avant de valider.</p>

                {/* Montants clés */}
                <div className="grid grid-cols-3 gap-3 mb-4">
                    <Info label="Total"       value={fmt(due)} />
                    <Info label="Déjà payé"   value={fmt(paid)} />
                    <Info label="Restant"     value={fmt(remaining)} />
                </div>

                {/* Détail du ticket */}
                <div className="mb-4 border border-[#2a2a2a] rounded">
                    <div className="px-3 py-2 text-sm bg-[#151515] font-medium">Détail du ticket</div>
                    <div className="max-h-44 overflow-auto">
                        {loading ? (
                            <div className="p-3 text-sm opacity-80">Chargement…</div>
                        ) : ticketData.items.length === 0 ? (
                            <div className="p-3 text-sm opacity-60">Aucun article actif dans le ticket.</div>
                        ) : (
                            <table className="w-full text-xs">
                                <thead>
                                <tr className="text-left">
                                    <th className="p-2">Article</th>
                                    <th className="p-2">PU</th>
                                    <th className="p-2">Qté</th>
                                    <th className="p-2">Sous-total</th>
                                </tr>
                                </thead>
                                <tbody>
                                {ticketData.items.map((it) => (
                                    <tr key={it.id} className="border-t border-[#2a2a2a]">
                                        <td className="p-2">{it.name}</td>
                                        <td className="p-2">{fmt(it.unit_price)}</td>
                                        <td className="p-2">{it.quantity}</td>
                                        <td className="p-2">{fmt(it.unit_price * it.quantity)}</td>
                                    </tr>
                                ))}
                                </tbody>
                            </table>
                        )}
                    </div>

                    {/* Debug optionnel */}
                    <div className="px-3 py-2">
                        <button
                            className="text-xs underline opacity-70 hover:opacity-100"
                            onClick={() => setDebugOpen((v) => !v)}
                        >
                            {debugOpen ? "Masquer les données brutes du ticket" : "Afficher les données brutes du ticket"}
                        </button>
                        {debugOpen && (
                            <pre className="mt-2 text-[10px] max-h-40 overflow-auto bg-[#111] p-2 rounded">
                {JSON.stringify(rawSnapshot ?? ticketData, null, 2)}
              </pre>
                        )}
                    </div>
                </div>

                {/* Méthode */}
                <div className="mb-4">
                    <div className="text-sm mb-2">Méthode de paiement</div>
                    <div className="flex flex-wrap gap-2">
                        <button
                            className={`px-3 py-2 rounded border ${method==="CASH" ? "border-emerald-500 bg-emerald-600/20" : "border-[#2a2a2a] bg-[#151515]"}`}
                            onClick={()=>setMethod("CASH")}
                            disabled={loading}
                        >Espèces</button>
                        <button
                            className={`px-3 py-2 rounded border ${method==="CARD" ? "border-emerald-500 bg-emerald-600/20" : "border-[#2a2a2a] bg-[#151515]"}`}
                            onClick={()=>setMethod("CARD")}
                            disabled={loading}
                        >Carte</button>
                    </div>
                </div>

                {/* Bloc espèces */}
                {method === "CASH" && (
                    <div className="mb-4 border border-[#2a2a2a] rounded p-3">
                        <div className="grid md:grid-cols-3 gap-3">
                            <Labeled>
                                <span>Montant à payer</span>
                                <div className="font-semibold">{fmt(remaining)}</div>
                            </Labeled>

                            <Labeled>
                                <span>Montant donné</span>
                                <input
                                    inputMode="decimal"
                                    className="w-full bg-[#111] border border-[#2a2a2a] rounded px-2 py-2"
                                    placeholder={String(remaining.toFixed(2))}
                                    value={cashGivenText}
                                    onChange={(e)=> setCashGivenText(e.target.value.replace(",", "."))}
                                />
                            </Labeled>

                            <Labeled>
                                <span>Rendu (estimé)</span>
                                <div className="font-semibold">{fmt(cashChange)}</div>
                            </Labeled>
                        </div>

                        {/* Résumé encaissement espèces */}
                        <div className="grid md:grid-cols-3 gap-3 mt-3 text-sm">
                            <Info label="Sera enregistré" value={fmt(cashToRecord)} />
                            <Info label="Rendu client"    value={fmt(cashChange)} />
                            <Info label="Reste à payer"   value={fmt(cashPartialLeft)} />
                        </div>

                        {/* Boutons rapides */}
                        <div className="mt-3 flex flex-wrap gap-2">
                            <Quick onClick={setExact}>Exact</Quick>
                            <Quick onClick={()=>add(5)}>+5</Quick>
                            <Quick onClick={()=>add(10)}>+10</Quick>
                            <Quick onClick={()=>add(20)}>+20</Quick>
                            <Quick onClick={()=>add(50)}>+50</Quick>
                            <Quick onClick={()=>add(100)}>+100</Quick>
                            <Quick onClick={clearCash}>Effacer</Quick>
                        </div>

                        {cashGivenText !== "" && isPartialCash && (
                            <div className="text-xs mt-2 opacity-80">
                                Paiement partiel de {fmt(effectiveGiven)} — Il restera {fmt(cashPartialLeft)} à encaisser.
                            </div>
                        )}
                    </div>
                )}

                {error && <div className="text-red-400 text-sm mb-3">{error}</div>}

                <div className="flex items-center justify-end gap-2">
                    <button className="px-3 py-2 rounded bg-zinc-700 hover:bg-zinc-600"
                            onClick={()=>onClose?.()}
                            disabled={loading}>Annuler</button>

                    <button className="px-3 py-2 rounded bg-emerald-600/90 hover:bg-emerald-600"
                            onClick={confirm}
                            disabled={loading || (method!=="CASH" && remaining<=0)}>
                        {loading
                            ? "Encaissement…"
                            : method === "CASH"
                                ? `Valider ${fmt(cashToRecord)}`
                                : `Encaisser ${fmt(remaining)}`
                        }
                    </button>
                </div>
            </div>
        </div>
    );
}

function Info({ label, value }){
    return (
        <div className="p-3 rounded-lg border border-[#2a2a2a] bg-[#151515]">
            <div className="text-xs opacity-70">{label}</div>
            <div className="text-base font-semibold">{value}</div>
        </div>
    );
}

function Labeled({ children }) {
    return (
        <div>
            <div className="text-xs opacity-70 mb-1">{children[0]}</div>
            <div>{children[1]}</div>
        </div>
    );
}

function Quick({ onClick, children }) {
    return (
        <button
            className="px-2 py-1 text-xs rounded border border-[#2a2a2a] bg-[#151515] hover:bg-[#222]"
            onClick={onClick}
            type="button"
        >
            {children}
        </button>
    );
}
