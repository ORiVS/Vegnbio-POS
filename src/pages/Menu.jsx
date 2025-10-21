// src/pages/Menu.jsx
import { useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import {
  addOrder,
  addItem,
  updateItem,
  removeItem,
  applyDiscount,
  getDishes,
  getMenus,
  getDishAvailability,
  ticket,
} from "../https";
import CheckoutDialog from "../components/checkout/CheckoutDialog";

// ────────────────────────────────────────────────────────────────────────────────
// DEBUG
// ────────────────────────────────────────────────────────────────────────────────
const DEBUG = true;
const dlog = (...args) => DEBUG && console.log("[POS]", ...args);
const dwarn = (...args) => DEBUG && console.warn("[POS]", ...args);
const dgroup = (label, fn) => {
  if (!DEBUG) return fn();
  console.groupCollapsed(`[POS] ${label}`);
  try { return fn(); } finally { console.groupEnd(); }
};

// Permet de jeter un coup d’œil depuis la console du navigateur
if (DEBUG && typeof window !== "undefined") {
  window.__POS_DEBUG__ = window.__POS_DEBUG__ || {};
}

// ────────────────────────────────────────────────────────────────────────────────
// Helpers généraux
// ────────────────────────────────────────────────────────────────────────────────

// Accepte soit {data: …} soit l’objet brut (selon l’impl du client HTTP)
const unwrap = (res) => (res && typeof res === "object" && "data" in res ? res.data : res);

// Date du jour (YYYY-MM-DD)
// Date du jour (YYYY-MM-DD) en ISO, indépendant de la locale
const TODAY = new Date().toISOString().slice(0, 10);

// Regroupe items de menu par course_type
const groupByCourse = (items = []) =>
    items.reduce((acc, it) => {
      const key = (it.course_type || "AUTRE").toUpperCase();
      (acc[key] ||= []).push(it);
      return acc;
    }, {});

// Labels FR
function labelCourse(key) {
  switch (String(key).toUpperCase()) {
    case "ENTREE": return "Entrées";
    case "PLAT": return "Plats";
    case "DESSERT": return "Desserts";
    case "BOISSON": return "Boissons";
    default: return key;
  }
}

// Normalisation d’un ticket (supporte champs variés)
function pickFirstArray(obj, keys = []) {
  for (const k of keys) {
    const v = obj?.[k];
    if (Array.isArray(v)) return v;
  }
  return [];
}
function num(v, d = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}
function normalizeTicket(raw) {
  if (!raw || typeof raw !== "object") {
    return { items: [], totals: { total_due: 0, paid_amount: 0 } };
  }
  const rawItems = pickFirstArray(raw, ["items", "lines", "order_items", "orderLines", "details"]);
  const items = rawItems
      .map((it, i) => {
        const id = it.id ?? it.item_id ?? it.line_id ?? it.pk ?? `tmp-${Date.now()}-${i}`;
        const dish = it.dish ?? it.dish_id ?? it.product ?? it.product_id ?? null;
        const name = it.label ?? it.name ?? it.dish_name ?? it.product_name ?? it.title ?? "Article";
        const unit_price = num(it.unit_price ?? it.price ?? it.unitPrice ?? it.amount_ht, 0);
        const quantity = num(it.quantity ?? it.qty ?? it.qte, 1);
        const status = String(it.status || "ACTIVE").toUpperCase();
        const is_void = Boolean(it.is_void || it.is_deleted || ["VOID", "CANCELLED", "DELETED"].includes(status));
        return { id, dish, name, unit_price, quantity, status, is_void };
      })
      .filter((it) => !it.is_void);

  const totals = {
    total_due: num(raw.total_due ?? raw.total ?? raw.totalDue, 0),
    paid_amount: num(raw.paid_amount ?? raw.paid ?? raw.paidAmount, 0),
  };
  return { items, totals };
}

// ────────────────────────────────────────────────────────────────────────────────

function ErrorBanner({ error, onClose }) {
  if (!error) return null;
  const msg =
      typeof error === "string"
          ? error
          : error?.message ||
          (typeof error?.data === "string" ? error.data : JSON.stringify(error?.data || {}));
  return (
      <div className="p-3 bg-red-600/10 text-red-400 rounded text-sm flex items-start justify-between gap-3">
        <div>
          <div className="font-medium mb-1">Erreur</div>
          <div className="opacity-90 whitespace-pre-wrap break-all">{msg}</div>
        </div>
        {onClose && (
            <button className="underline opacity-70 hover:opacity-100" onClick={onClose}>
              fermer
            </button>
        )}
      </div>
  );
}

export default function Menu() {
  const restaurantIdFromUser = useSelector((s) => s.user?.restaurantId);
  const RESTAURANT_ID = restaurantIdFromUser || 1;

  const [currentOrder, setCurrentOrder] = useState(null);
  const [lines, setLines] = useState([]);
  const [discount, setDiscount] = useState({ amount: "0.00", percent: "0.00" });

  const [dishes, setDishes] = useState([]);
  const [menus, setMenus] = useState([]);
  const [availSet, setAvailSet] = useState(() => new Set());
  const [loading, setLoading] = useState(true);
  const [showCheckout, setShowCheckout] = useState(false);

  const [err, setErr] = useState(null); // affiche l’erreur en haut
  const [last, setLast] = useState(null); // snapshot debug des dernières réponses

  const dishById = useMemo(() => {
    const map = new Map();
    dishes.forEach((d) => map.set(d.id, d));
    return map;
  }, [dishes]);

  const dishIdOf = (x) => (x && typeof x === "object" ? x.id : x);

  useEffect(() => { document.title = "Veg'N Bio | Menu"; }, []);

  // Charge plats/menus/disponibilités
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setErr(null);
        await dgroup("Bootstrap menus+dishes+availability", async () => {
          const [dishListRes, menuListRes, availListRes] = await Promise.all([
            getDishes({ is_active: "true" }),
            getMenus({ restaurant: RESTAURANT_ID, date: TODAY }),
            getDishAvailability({ restaurant: RESTAURANT_ID, date: TODAY }),
          ]);
          const dishList = unwrap(dishListRes);
          const menuList = unwrap(menuListRes);
          const availList = unwrap(availListRes);
          const truthyAvailable = (v) => v === true || v === 1 || v === "true";


          dlog("getDishes =>", dishList);
          dlog("getMenus =>", menuList);
          dlog("getDishAvailability =>", availList);

          setDishes(Array.isArray(dishList) ? dishList : []);
          setMenus((Array.isArray(menuList) ? menuList : []).filter((m) => m.is_published !== false));

          const ids = (Array.isArray(availList) ? availList : [])
              .filter((a) => truthyAvailable(a.is_available))
              .map((a) => dishIdOf(a.dish))   // ← convertit objet {id:…} → nombre
              .filter(Boolean);

          setAvailSet(new Set(ids));


          setLast({ stage: "bootstrap", dishList, menuList, availList });
          if (DEBUG) window.__POS_DEBUG__.bootstrap = { dishList, menuList, availList };
        });
      } catch (e) {
        setErr(e);
        dwarn("Bootstrap failed:", e);
      } finally {
        setLoading(false);
      }
    })();
  }, [RESTAURANT_ID]);

  // Récupération du ticket ⇒ maj panneau droit
  const syncFromTicket = async (orderId) => {
    return dgroup(`Ticket #${orderId}`, async () => {
      try {
        const tRes = await ticket(orderId);
        const t = unwrap(tRes);
        dlog("ticket() raw =>", t);
        const norm = normalizeTicket(t);
        dlog("ticket() normalized =>", norm);
        setLines(norm.items);
        setCurrentOrder((prev) =>
            prev
                ? { ...prev, total_due: norm.totals.total_due, paid_amount: norm.totals.paid_amount }
                : { id: orderId, ...norm.totals }
        );
        setLast({ stage: "ticket", raw: t, normalized: norm });
        if (DEBUG) window.__POS_DEBUG__.ticket = { raw: t, normalized: norm };
      } catch (e) {
        setErr(e);
        dwarn("ticket() failed:", e);
      }
    });
  };

  const ensureOrder = async () => {
    if (currentOrder?.id) return currentOrder.id;
    return dgroup("ensureOrder", async () => {
      try {
        setErr(null);
        const createdRes = await addOrder({ restaurant: RESTAURANT_ID, note: "Sur place" });
        const created = unwrap(createdRes);
        dlog("addOrder() =>", createdRes, "unwrapped:", created);
        if (!created?.id) {
          dwarn("addOrder() n’a pas retourné d’id !");
        }
        setCurrentOrder(created || null);
        setLines([]);
        setLast({ stage: "addOrder", raw: createdRes, unwrapped: created });
        if (DEBUG) window.__POS_DEBUG__.addOrder = { raw: createdRes, unwrapped: created };
        if (created?.id) await syncFromTicket(created.id);
        return created?.id;
      } catch (e) {
        setErr(e);
        dwarn("addOrder() failed:", e);
        return undefined;
      }
    });
  };

  // Ajout optimiste immédiat (UX)
  const optimisticAdd = (dish) => {
    setLines((prev) => {
      // si ligne déjà présente (même nom/prix), on incrémente
      const idx = prev.findIndex(
          (l) => l.name === (dish.name || "Article") && Number(l.unit_price) === Number(dish.price || 0)
      );
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], quantity: Number(copy[idx].quantity || 1) + 1 };
        return copy;
      }
      const tmp = {
        id: `tmp-${Date.now()}`,
        dish: dish.id,
        name: dish.name || "Article",
        unit_price: Number(dish.price) || 0,
        quantity: 1,
        status: "ACTIVE",
        is_void: false,
      };
      return [...prev, tmp];
    });
  };

  const add = async (dish) => {
    dgroup(`ADD dish #${dish?.id} ${dish?.name}`, async () => {
      const orderId = await ensureOrder();
      if (!orderId) return;
      // Ajout optimiste tout de suite (affichage immédiat)
      optimisticAdd(dish);
      try {
        const payload = { dish: dish.id, unit_price: dish.price, quantity: 1 };
        dlog("addItem payload =>", payload);
        const res = await addItem(orderId, payload);
        dlog("addItem() =>", res);
        setLast({ stage: "addItem", payload, response: res });
        if (DEBUG) window.__POS_DEBUG__.addItem = { payload, response: res };
      } catch (e) {
        setErr(e);
        dwarn("addItem() failed:", e);
      }
      // Quoi qu’il arrive, on resynchronise depuis le ticket
      await syncFromTicket(orderId);
    });
  };

  const addFromMenuItem = async (menuItem) => {
    const id = dishIdOf(menuItem.dish);
    const dish = dishById.get(id) || (typeof menuItem.dish === "object" ? menuItem.dish : null);
    const isAvailable = availSet.size === 0
  ? (dish?.is_active !== false)
  : (id && availSet.has(id));
    dlog("click menuItem =>", { id, dish, isAvailable });
    if (!id || !dish || !isAvailable) return;
    await add(dish);
  };

  const changeQty = async (line, qty) => {
    if (!currentOrder?.id) return;
    const newQty = Math.max(1, Number(qty || 1));
    dgroup(`UPDATE qty line #${line.id} -> ${newQty}`, async () => {
      try {
        await updateItem(currentOrder.id, line.id, { quantity: newQty });
      } catch (e) {
        setErr(e);
        dwarn("updateItem() failed:", e);
      }
      await syncFromTicket(currentOrder.id);
    });
  };

  const del = async (line) => {
    if (!currentOrder?.id) return;
    dgroup(`REMOVE line #${line.id}`, async () => {
      try {
        await removeItem(currentOrder.id, line.id);
      } catch (e) {
        setErr(e);
        dwarn("removeItem() failed:", e);
      }
      await syncFromTicket(currentOrder.id);
    });
  };

  const apply = async () => {
    if (!currentOrder?.id) return;
    dgroup(`APPLY discount ${discount.amount}€ | ${discount.percent}%`, async () => {
      try {
        await applyDiscount(currentOrder.id, {
          discount_amount: discount.amount,
          discount_percent: discount.percent,
        });
      } catch (e) {
        setErr(e);
        dwarn("applyDiscount() failed:", e);
      }
      await syncFromTicket(currentOrder.id);
    });
  };

  // Totaux affichés dans la colonne droite
  const localSubtotal = lines.reduce((acc, it) => acc + Number(it.unit_price || 0) * Number(it.quantity || 0), 0);
  const shownTotal = Number(currentOrder?.total_due ?? localSubtotal);
  const shownPaid  = Number(currentOrder?.paid_amount ?? 0);
  const shownLeft  = Math.max(0, shownTotal - shownPaid);

  return (
      <section className="p-8 grid grid-cols-12 gap-4">
        {/* Erreurs */}
        {err && (
            <div className="col-span-12">
              <ErrorBanner error={err} onClose={() => setErr(null)} />
            </div>
        )}

        {/* Colonne gauche */}
        <div className="col-span-12 lg:col-span-8 space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold">Menu du jour & Carte</h1>
            <button className="px-3 py-2 rounded bg-emerald-600/80 hover:bg-emerald-600" onClick={ensureOrder}>
              Nouvelle commande
            </button>
          </div>

          {/* Menus du jour */}
          <section className="border border-[#2a2a2a] rounded-lg overflow-hidden">
            <div className="px-4 py-3 bg-[#151515] font-medium">
              Menus du jour — {TODAY.split("-").reverse().join("/")}
            </div>
            <div className="p-4 space-y-6">
              {loading ? (
                  <div className="opacity-80 text-sm">Chargement des menus…</div>
              ) : menus.length === 0 ? (
                  <div className="opacity-60 text-sm">Aucun menu publié pour aujourd’hui.</div>
              ) : (
                  menus.map((m) => {
                    const groups = groupByCourse(m.items || []);
                    return (
                        <div key={m.id} className="space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="text-lg font-semibold">{m.title}</div>
                            <div className="text-xs opacity-70">
                              {m.start_date} → {m.end_date}
                            </div>
                          </div>

                          <div className="grid md:grid-cols-2 gap-4">
                            {Object.entries(groups).map(([course, items]) => (
                                <div key={course} className="border border-[#2a2a2a] rounded-lg">
                                  <div className="px-3 py-2 bg-[#111] text-xs uppercase tracking-wide opacity-80">
                                    {labelCourse(course)}
                                  </div>
                                  <div className="p-3 space-y-2">
                                    {items.map((it) => {
                                      const id = dishIdOf(it.dish);
                                      const dish = dishById.get(id) || (typeof it.dish === "object" ? it.dish : null);
                                      const isAvailable = availSet.size === 0
                                          ? (dish?.is_active !== false)
                                          : (id && availSet.has(id));

                                      const title = isAvailable && dish ? dish.name : "(Plat indisponible)";
                                      const price = isAvailable && dish?.price != null ? Number(dish.price).toFixed(2) + " €" : "—";
                                      const allergens = (dish?.allergens || []).map((a) => a.label).join(", ");

                                      return (
                                          <button
                                              key={it.id}
                                              onClick={() => isAvailable && dish && addFromMenuItem(it)}
                                              className={
                                                  "w-full text-left p-3 rounded border border-[#2a2a2a] " +
                                                  (isAvailable
                                                      ? "bg-[#1a1a1a] hover:bg-[#151515]"
                                                      : "bg-[#141414] opacity-60 cursor-not-allowed")
                                              }
                                              title={isAvailable && dish ? "Ajouter à la commande" : "Plat non disponible"}
                                              disabled={!isAvailable || !dish}
                                              aria-disabled={!isAvailable || !dish}
                                          >
                                            <div className="flex items-center justify-between">
                                              <div className="font-medium">{title}</div>
                                              <div className="text-sm opacity-80">{price}</div>
                                            </div>
                                            {allergens && <div className="text-xs opacity-70 mt-1">{allergens}</div>}
                                          </button>
                                      );
                                    })}
                                  </div>
                                </div>
                            ))}
                          </div>
                        </div>
                    );
                  })
              )}
            </div>
          </section>

          {/* À la carte */}
          <section>
            <div className="mb-3 text-sm opacity-80">Plats à la carte</div>
            {loading ? (
                <div className="opacity-80 text-sm">Chargement des plats…</div>
            ) : (
                <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-3">
                  {dishes.map((d) => (
                      <button
                          key={d.id}
                          onClick={() => add(d)}
                          className="text-left border border-[#2a2a2a] rounded-lg p-3 bg-[#1a1a1a] hover:bg-[#151515]"
                      >
                        <div className="flex items-center justify-between">
                          <div className="font-medium">{d.name}</div>
                          {d.is_vegan && (
                              <span className="text-[10px] px-2 py-0.5 rounded border border-emerald-600/50 text-emerald-400">
                        VEGAN
                      </span>
                          )}
                        </div>
                        <div className="text-sm opacity-80">{Number(d.price).toFixed(2)} €</div>
                        <div className="text-xs opacity-70 mt-1">{(d.allergens || []).map((a) => a.label).join(", ")}</div>
                        {d.description && <div className="text-xs opacity-60 mt-2 line-clamp-2">{d.description}</div>}
                      </button>
                  ))}
                  {dishes.length === 0 && <div className="opacity-60 text-sm">Aucun plat disponible.</div>}
                </div>
            )}
          </section>
        </div>

        {/* Colonne droite : commande */}
        <aside className="col-span-12 lg:col-span-4 space-y-3">
          <div className="p-4 rounded-lg border border-[#2a2a2a] bg-[#1a1a1a]">
            <div className="font-semibold mb-2">Commande</div>

            {!currentOrder && (
                <div className="text-sm opacity-70">Cliquez sur un plat pour créer une commande.</div>
            )}

            {currentOrder && (
                <div className="space-y-2">
                  {lines.map((l) => (
                      <div key={l.id} className="flex items-center justify-between gap-3">
                        <div>
                          <div className="font-medium">{l.name}</div>
                          <div className="text-xs opacity-70">{Number(l.unit_price).toFixed(2)} €</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                              type="number"
                              min={1}
                              value={l.quantity}
                              onChange={(e) => changeQty(l, Number(e.target.value))}
                              className="w-16 bg-[#121212] p-1 rounded"
                          />
                          <button
                              onClick={() => del(l)}
                              className="text-sm px-2 py-1 rounded bg-rose-600/80 hover:bg-rose-600"
                          >
                            Retirer
                          </button>
                        </div>
                      </div>
                  ))}

                  {/* Totaux visibles */}
                  <hr className="border-[#2a2a2a]" />
                  <div className="text-sm flex items-center justify-between">
                    <span className="opacity-80">Total (TTC)</span>
                    <span className="font-semibold">{shownTotal.toFixed(2)} €</span>
                  </div>
                  <div className="text-xs flex items-center justify-between opacity-80">
                    <span>Déjà payé</span>
                    <span>{shownPaid.toFixed(2)} €</span>
                  </div>
                  <div className="text-xs flex items-center justify-between opacity-80">
                    <span>Reste à payer</span>
                    <span>{shownLeft.toFixed(2)} €</span>
                  </div>

                  <div className="text-sm flex items-center gap-2 pt-1">
                    <input
                        className="bg-[#121212] p-2 rounded w-24"
                        placeholder="Remise €"
                        value={discount.amount}
                        onChange={(e) => setDiscount((s) => ({ ...s, amount: e.target.value }))}
                    />
                    <input
                        className="bg-[#121212] p-2 rounded w-24"
                        placeholder="Remise %"
                        value={discount.percent}
                        onChange={(e) => setDiscount((s) => ({ ...s, percent: e.target.value }))}
                    />
                    <button className="px-3 py-2 rounded bg-zinc-700 hover:bg-zinc-600" onClick={apply}>
                      Appliquer
                    </button>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                        className="flex-1 px-3 py-2 rounded bg-emerald-600/80 hover:bg-emerald-600"
                        onClick={() => setShowCheckout(true)}
                    >
                      Encaisser
                    </button>
                  </div>
                </div>
            )}
          </div>

        </aside>

        {/* Modale d’encaissement */}
        <CheckoutDialog
            open={showCheckout}
            order={currentOrder}
            onClose={() => setShowCheckout(false)}
            onSuccess={() => {
              setShowCheckout(false);
              if (currentOrder?.id) setTimeout(() => syncFromTicket(currentOrder.id), 250);
            }}
        />
      </section>
  );
}
