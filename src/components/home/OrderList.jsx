// src/components/home/OrderList.jsx
import React from "react";
import { FaCheckDouble, FaLongArrowAltRight, FaCircle } from "react-icons/fa";
import { getAvatarName } from "../../utils";

// Normalise un order venant de Django ou de l'ancien MERN
function normalizeOrder(o = {}) {
    // Nom client (différents cas)
    const customerName =
        o.customerDetails?.name ||
        o.customer_name ||
        o.customer?.name ||
        o.customer ||
        "Client";

    // Nombre d’items
    const itemsCount =
        Array.isArray(o.items) ? o.items.length :
            Array.isArray(o.orderItems) ? o.orderItems.length :
                o.items_count ?? 0;

    // Table (si ta caisse Django a des tables)
    const tableNo =
        o.table?.tableNo ||
        o.table_number ||
        o.table ||
        "—";

    // Statut (mappe vers tes états)
    const status =
        o.status || o.orderStatus || "PENDING";

    // Couleurs de statut (vert vs jaune)
    const isReady = ["READY", "PAID", "COMPLETED"].includes(String(status).toUpperCase());

    return { customerName, itemsCount, tableNo, status, isReady };
}

const OrderList = ({ order }) => {
    const { customerName, itemsCount, tableNo, status, isReady } = normalizeOrder(order);

    return (
        <div className="flex items-center gap-5 mb-3">
            {/* Avatar lettre */}
            <button className="bg-green-600 p-3 text-xl font-bold rounded-lg text-white">
                {getAvatarName(customerName)}
            </button>

            <div className="flex items-center justify-between w-full">
                {/* Bloc client + items */}
                <div className="flex flex-col items-start gap-1">
                    <h1 className="text-[#f5f5f5] text-lg font-semibold tracking-wide">
                        {customerName}
                    </h1>
                    <p className="text-[#ababab] text-sm">
                        {itemsCount} {itemsCount > 1 ? "Items" : "Item"}
                    </p>
                </div>

                {/* Table */}
                <h1 className="text-green-600 font-semibold border border-green-600 rounded-lg p-1">
                    Table <FaLongArrowAltRight className="text-[#ababab] ml-2 inline" /> {tableNo}
                </h1>

                {/* Statut */}
                <div className="flex flex-col items-end gap-2">
                    {isReady ? (
                        <p className="text-green-600 bg-[#2e4a40] px-2 py-1 rounded-lg">
                            <FaCheckDouble className="inline mr-2" /> {status}
                        </p>
                    ) : (
                        <p className="text-yellow-600 bg-[#4a452e] px-2 py-1 rounded-lg">
                            <FaCircle className="inline mr-2" /> {status}
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default OrderList;
