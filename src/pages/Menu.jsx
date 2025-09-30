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

// Date du jour en ISO "sv-SE" (YYYY-MM-DD)
const TODAY = new Date().toLocaleDateString("sv-SE");

// util – regroupe les items d’un menu par course_type
const groupByCourse = (items = []) =>
    items.reduce((acc, it) => {
      const key = (it.course_type || "AUTRE").toUpperCase();
      (acc[key] ||= []).push(it);
      return acc;
    }, {});

// util – map course -> label FR
function labelCourse(key) {
  switch (String(key).toUpperCase()) {
    case "ENTREE":
      return "Entrées";
    case "PLAT":
      return "Plats";
    case "DESSERT":
      return "Desserts";
    case "BOISSON":
      return "Boissons";
    default:
      return key;
  }
}

// ────────────────────────────────────────────────────────────────────────────────
// Normalisation robuste de la réponse ticket (différents back/implémentations)
// ────────────────────────────────────────────────────────────────────────────────
function pickFirstArray(obj, keys = []) {
  for (const k of keys) {
    const v = obj?.[k];
    if (Array.isArray(v)) return v;
  }
  return [];
}

function normNumber(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeTicket(raw) {
  if (!raw || typeof raw !== "object") {
    return { items: [], totals: { total_due: 0, paid_amount: 0 } };
  }

  // possibles conteneurs d’items selon les back-ends
  const rawItems = pickFirstArray(raw, [
    "items",
    "lines",
    "order_items",
    "orderItems",
    "details",
  ]);

  const items = rawItems
      .map((it, i) => {
        // essais multiples pour récupérer id/dish/nom/prix/qté
        const id =
            it.id ?? it.item_id ?? it.line_id ?? it.pk ?? `tmp-${Date.now()}-${i}`;
        const dish =
            it.dish ?? it.dish_id ?? it.product ?? it.product_id ?? null;
        const name =
            it.label ??
            it.name ??
            it.dish_name ??
            it.product_name ??
            it.title ??
            "Article";
        const unit_price =
            normNumber(
                it.unit_price ?? it.price ?? it.unitPrice ?? it.amount_ht,
                0
            );
        const quantity = normNumber(it.quantity ?? it.qty ?? it.qte, 1);
        const status = String(it.status || "ACTIVE").toUpperCase();
        const is_void = Boolean(it.is_void || it.is_deleted || status === "VOID" || status === "CANCELLED" || status === "DELETED");

        return { id, dish, name, unit_price, quantity, status, is_void };
      })
      .filter((it) => !it.is_void);

  const totals = {
    total_due: normNumber(raw.total_due ?? raw.total ?? raw.totalDue, 0),
    paid_amount: normNumber(raw.paid_amount ?? raw.paid ?? raw.paidAmount, 0),
  };

  return { items, totals };
}

// ────────────────────────────────────────────────────────────────────────────────

export default function Menu() {
  // id du resto depuis Redux (ex: s.user.restaurantId)
  const restaurantIdFromUser = useSelector((s) => s.user?.restaurantId);
  const RESTAURANT_ID = restaurantIdFromUser || 1; // fallback sûr

  const [currentOrder, setCurrentOrder] = useState(null);
  const [lines, setLines] = useState([]);
  const [discount, setDiscount] = useState({ amount: "0.00", percent: "0.00" });

  const [dishes, setDishes] = useState([]);
  const [menus, setMenus] = useState([]);
  const [availSet, setAvailSet] = useState(() => new Set());
  const [loading, setLoading] = useState(true);
  const [showCheckout, setShowCheckout] = useState(false);

  // map id -> dish
  const dishById = useMemo(() => {
    const map = new Map();
    dishes.forEach((d) => map.set(d.id, d));
    return map;
  }, [dishes]);

  // helpers
  const dishIdOf = (x) => (x && typeof x === "object" ? x.id : x);

  useEffect(() => {
    document.title = "Veg'N Bio | Menu";
  }, []);

  // charge menus/plats/disponibilités
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const [dishList, menuList, availList] = await Promise.all([
          getDishes({ is_active: "true" }),
          getMenus({ restaurant: RESTAURANT_ID, date: TODAY }),
          getDishAvailability({ restaurant: RESTAURANT_ID, date: TODAY }),
        ]);

        setDishes(Array.isArray(dishList) ? dishList : []);
        setMenus(
            (Array.isArray(menuList) ? menuList : []).filter(
                (m) => m.is_published !== false
            )
        );

        const ids = (Array.isArray(availList) ? availList : [])
            .filter((a) => a.is_available === true)
            .map((a) => a.dish);
        setAvailSet(new Set(ids));
      } finally {
        setLoading(false);
      }
    })();
  }, [RESTAURANT_ID]);

  // récup server → colonnes de droite
  const syncFromTicket = async (orderId) => {
    const { data: t } = await ticket(orderId);
    const norm = normalizeTicket(t);
    setLines(norm.items);
    setCurrentOrder((prev) =>
        prev
            ? { ...prev, total_due: norm.totals.total_due, paid_amount: norm.totals.paid_amount }
            : { id: orderId, ...norm.totals }
    );
  };

  const ensureOrder = async () => {
    if (currentOrder?.id) return currentOrder.id;
    const { data } = await addOrder({
      restaurant: RESTAURANT_ID,
      note: "Sur place",
    });
    setCurrentOrder(data);
    setLines([]);
    await syncFromTicket(data.id);
    return data.id;
  };

  // Ajout optimiste si le ticket ne renvoie pas les items
  const addOptimisticIfEmpty = (dish) => {
    setLines((prev) => {
      if (prev.length > 0) return prev;
      const tmpId = `tmp-${Date.now()}`;
      const line = {
        id: tmpId,
        dish: dish.id,
        name: dish.name || "Article",
        unit_price: Number(dish.price) || 0,
        quantity: 1,
        status: "ACTIVE",
        is_void: false,
      };
      return [line];
    });
  };

  const add = async (dish) => {
    const orderId = await ensureOrder();
    // payload tolérant : la plupart des APIs POS acceptent dish + unit_price + quantity
    await addItem(orderId, {
      dish: dish.id,
      unit_price: dish.price,
      quantity: 1,
    });
    await syncFromTicket(orderId);
    // si toujours vide (backend qui ne renvoie pas les lignes), on montre tout de suite
    setTimeout(() => addOptimisticIfEmpty(dish), 50);
  };

  const addFromMenuItem = async (menuItem) => {
    const id = dishIdOf(menuItem.dish);
    if (!id || !availSet.has(id)) return;
    const d =
        dishById.get(id) || (typeof menuItem.dish === "object" ? menuItem.dish : null);
    if (!d) return;
    await add(d);
  };

  const changeQty = async (line, qty) => {
    if (!currentOrder?.id) return;
    const newQty = Math.max(1, Number(qty || 1));
    await updateItem(currentOrder.id, line.id, { quantity: newQty });
    await syncFromTicket(currentOrder.id);
  };

  const del = async (line) => {
    if (!currentOrder?.id) return;
    await removeItem(currentOrder.id, line.id);
    await syncFromTicket(currentOrder.id);
  };

  const apply = async () => {
    if (!currentOrder?.id) return;
    await applyDiscount(currentOrder.id, {
      discount_amount: discount.amount,
      discount_percent: discount.percent,
    });
    await syncFromTicket(currentOrder.id);
  };

  return (
      <section className="p-8 grid grid-cols-12 gap-4">
        {/* Colonne gauche : menus + plats */}
        <div className="col-span-12 lg:col-span-8 space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold">Menu du jour & Carte</h1>
            <button
                className="px-3 py-2 rounded bg-emerald-600/80 hover:bg-emerald-600"
                onClick={ensureOrder}
            >
              Nouvelle commande
            </button>
          </div>

          {/* MENUS DU JOUR */}
          <section className="border border-[#2a2a2a] rounded-lg overflow-hidden">
            <div className="px-4 py-3 bg-[#151515] font-medium">
              Menus du jour — {TODAY.split("-").reverse().join("/")}
            </div>
            <div className="p-4 space-y-6">
              {loading ? (
                  <div className="opacity-80 text-sm">Chargement des menus…</div>
              ) : menus.length === 0 ? (
                  <div className="opacity-60 text-sm">
                    Aucun menu publié pour aujourd’hui.
                  </div>
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
                                <div
                                    key={course}
                                    className="border border-[#2a2a2a] rounded-lg"
                                >
                                  <div className="px-3 py-2 bg-[#111] text-xs uppercase tracking-wide opacity-80">
                                    {labelCourse(course)}
                                  </div>

                                  <div className="p-3 space-y-2">
                                    {items.map((it) => {
                                      const id = dishIdOf(it.dish);
                                      const dish =
                                          dishById.get(id) ||
                                          (typeof it.dish === "object" ? it.dish : null);
                                      const isAvailable = !!(id && availSet.has(id));

                                      const title =
                                          isAvailable && dish
                                              ? dish.name
                                              : "(Plat indisponible)";
                                      const price =
                                          isAvailable && dish?.price != null
                                              ? Number(dish.price).toFixed(2) + " €"
                                              : "—";
                                      const allergens = (dish?.allergens || [])
                                          .map((a) => a.label)
                                          .join(", ");

                                      return (
                                          <button
                                              key={it.id}
                                              onClick={() =>
                                                  isAvailable && dish && addFromMenuItem(it)
                                              }
                                              className={
                                                  "w-full text-left p-3 rounded border border-[#2a2a2a] " +
                                                  (isAvailable
                                                      ? "bg-[#1a1a1a] hover:bg-[#151515]"
                                                      : "bg-[#141414] opacity-60 cursor-not-allowed")
                                              }
                                              title={
                                                isAvailable && dish
                                                    ? "Ajouter à la commande"
                                                    : "Plat non disponible"
                                              }
                                              disabled={!isAvailable || !dish}
                                              aria-disabled={!isAvailable || !dish}
                                          >
                                            <div className="flex items-center justify-between">
                                              <div className="font-medium">{title}</div>
                                              <div className="text-sm opacity-80">
                                                {price}
                                              </div>
                                            </div>
                                            {allergens && (
                                                <div className="text-xs opacity-70 mt-1">
                                                  {allergens}
                                                </div>
                                            )}
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

          {/* PLATS À LA CARTE */}
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
                        <div className="text-sm opacity-80">
                          {Number(d.price).toFixed(2)} €
                        </div>
                        <div className="text-xs opacity-70 mt-1">
                          {(d.allergens || []).map((a) => a.label).join(", ")}
                        </div>
                        {d.description && (
                            <div className="text-xs opacity-60 mt-2 line-clamp-2">
                              {d.description}
                            </div>
                        )}
                      </button>
                  ))}
                  {dishes.length === 0 && (
                      <div className="opacity-60 text-sm">Aucun plat disponible.</div>
                  )}
                </div>
            )}
          </section>
        </div>

        {/* Colonne droite : commande */}
        <aside className="col-span-12 lg:col-span-4 space-y-3">
          <div className="p-4 rounded-lg border border-[#2a2a2a] bg-[#1a1a1a]">
            <div className="font-semibold mb-2">Commande</div>

            {!currentOrder && (
                <div className="text-sm opacity-70">
                  Cliquez sur un plat pour créer une commande.
                </div>
            )}

            {currentOrder && (
                <div className="space-y-2">
                  {lines.map((l) => (
                      <div key={l.id} className="flex items-center justify-between gap-3">
                        <div>
                          <div className="font-medium">{l.name}</div>
                          <div className="text-xs opacity-70">
                            {Number(l.unit_price).toFixed(2)} €
                          </div>
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

                  <hr className="border-[#2a2a2a]" />

                  <div className="text-sm flex items-center gap-2">
                    <input
                        className="bg-[#121212] p-2 rounded w-24"
                        placeholder="Remise €"
                        value={discount.amount}
                        onChange={(e) =>
                            setDiscount((s) => ({ ...s, amount: e.target.value }))
                        }
                    />
                    <input
                        className="bg-[#121212] p-2 rounded w-24"
                        placeholder="Remise %"
                        value={discount.percent}
                        onChange={(e) =>
                            setDiscount((s) => ({ ...s, percent: e.target.value }))
                        }
                    />
                    <button
                        className="px-3 py-2 rounded bg-zinc-700 hover:bg-zinc-600"
                        onClick={apply}
                    >
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
