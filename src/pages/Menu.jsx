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
  ticket,
} from "../https";
import CheckoutDialog from "../components/checkout/CheckoutDialog";

const TODAY = new Date().toISOString().slice(0, 10);

// Regroupe les items d'un menu par course_type
const groupByCourse = (items = []) =>
    items.reduce((acc, it) => {
      const key = (it.course_type || "AUTRE").toUpperCase();
      acc[key] = acc[key] || [];
      acc[key].push(it);
      return acc;
    }, {});

export default function Menu() {
  // ⚠️ On lit l’ID du resto dans Redux (ex: s.user.restaurantId)
  const restaurantIdFromUser = useSelector((s) => s.user?.restaurantId);
  const RESTAURANT_ID = restaurantIdFromUser || 1; // fallback sécurisé

  const [currentOrder, setCurrentOrder] = useState(null);
  const [dishes, setDishes] = useState([]);
  const [menus, setMenus] = useState([]);
  const [lines, setLines] = useState([]);
  const [discount, setDiscount] = useState({ amount: "0.00", percent: "0.00" });
  const [showCheckout, setShowCheckout] = useState(false);
  const [loading, setLoading] = useState(true);

  // map rapide: dishId -> dish
  const dishById = useMemo(() => {
    const map = new Map();
    for (const d of dishes) map.set(d.id, d);
    return map;
  }, [dishes]);

  useEffect(() => {
    document.title = "Veg'N Bio | Menu";
  }, []);

  useEffect(() => {
    // recharge quand le resto change (changement d’utilisateur)
    (async () => {
      try {
        setLoading(true);
        // 1) plats actifs
        const dishList = await getDishes({ is_active: "true" });
        setDishes(dishList);

        // 2) menus du jour pour ce restaurant
        const menuList = await getMenus({ restaurant: RESTAURANT_ID, date: TODAY });
        // Si besoin d’afficher uniquement les menus publiés
        setMenus((menuList || []).filter((m) => m.is_published !== false));
      } finally {
        setLoading(false);
      }
    })();
  }, [RESTAURANT_ID]);

  // Synchronise la colonne "Commande" depuis le ticket (vérité serveur)
  const syncFromTicket = async (orderId) => {
    const { data: t } = await ticket(orderId);
    const safeItems = Array.isArray(t?.items) ? t.items : [];
    const normalized = safeItems
        .map((it, i) => ({
          id: it.id ?? it.item_id ?? it.pk ?? `tmp-${Date.now()}-${i}`,
          dish: it.dish ?? null,
          name:
              it.label ??
              it.name ??
              it.dish_name ??
              it.title ??
              it.product_name ??
              "Article",
          unit_price: Number(
              it.unit_price ?? it.price ?? it.unitPrice ?? it.amount_ht ?? 0
          ),
          quantity: Number(it.quantity ?? it.qty ?? 1),
          status: (it.status ?? "ACTIVE").toUpperCase(),
          is_void: Boolean(it.is_void) || Boolean(it.is_deleted),
        }))
        .filter(
            (it) =>
                !it.is_void &&
                it.status !== "VOID" &&
                it.status !== "CANCELLED" &&
                it.status !== "DELETED"
        );

    setLines(normalized);
    setCurrentOrder((prev) =>
        prev
            ? { ...prev, total_due: t.total_due, paid_amount: t.paid_amount }
            : prev
    );
  };

  const ensureOrder = async () => {
    if (currentOrder?.id) return currentOrder.id;
    const { data } = await addOrder({ restaurant: RESTAURANT_ID, note: "Sur place" });
    setCurrentOrder(data);
    setLines([]);
    await syncFromTicket(data.id);
    return data.id;
  };

  const add = async (dish) => {
    const orderId = await ensureOrder();
    await addItem(orderId, { dish: dish.id, unit_price: dish.price, quantity: 1 });
    await syncFromTicket(orderId);
  };

  const addFromMenuItem = async (menuItem) => {
    const d = dishById.get(menuItem.dish);
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
        {/* Colonne gauche : menus du jour + plats à la carte */}
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
                                      const dish = dishById.get(it.dish);
                                      const title = dish?.name || "(Plat indisponible)";
                                      const price =
                                          dish?.price != null
                                              ? Number(dish.price).toFixed(2) + " €"
                                              : "—";
                                      const allergens = (dish?.allergens || [])
                                          .map((a) => a.label)
                                          .join(", ");

                                      return (
                                          <button
                                              key={it.id}
                                              onClick={() => dish && addFromMenuItem(it)}
                                              className="w-full text-left p-3 rounded bg-[#1a1a1a] hover:bg-[#151515] border border-[#2a2a2a]"
                                              disabled={!dish}
                                              title={
                                                !dish
                                                    ? "Plat non disponible"
                                                    : "Ajouter à la commande"
                                              }
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
                      <div
                          key={l.id}
                          className="flex items-center justify-between gap-3"
                      >
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
