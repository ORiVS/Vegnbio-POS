import React, { useEffect } from "react";
import { FaSearch } from "react-icons/fa";
import OrderList from "./OrderList";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { enqueueSnackbar } from "notistack";
import { getOrders } from "../../https";

const RecentOrders = () => {
  // ✅ getOrders() renvoie déjà un tableau normalisé ([], [..])
  const { data: orders = [], isError, error, isLoading } = useQuery({
    queryKey: ["orders"],
    queryFn: () => getOrders(),
    placeholderData: keepPreviousData,
  });

  useEffect(() => {
    if (isError) {
      const msg =
          error?.response?.data?.message || "Something went wrong while loading orders.";
      enqueueSnackbar(msg, { variant: "error" });
    }
  }, [isError, error]);

  return (
      <div className="px-8 mt-6">
        <div className="bg-[#1a1a1a] w-full h-[450px] rounded-lg">
          <div className="flex justify-between items-center px-6 py-4">
            <h1 className="text-[#f5f5f5] text-lg font-semibold tracking-wide">
              Recent Orders
            </h1>
            <a href="#" className="text-[#025cca] text-sm font-semibold">
              View all
            </a>
          </div>

          <div className="flex items-center gap-4 bg-[#1f1f1f] rounded-[15px] px-6 py-4 mx-6">
            <FaSearch className="text-[#f5f5f5]" />
            <input
                type="text"
                placeholder="Search recent orders"
                className="bg-[#1f1f1f] outline-none text-[#f5f5f5]"
            />
          </div>

          {/* Order list */}
          <div className="mt-4 px-6 overflow-y-scroll h-[300px] scrollbar-hide">
            {isLoading ? (
                <p className="text-gray-500">Loading…</p>
            ) : orders.length > 0 ? (
                orders.map((order) => (
                    <OrderList key={order.id ?? order._id} order={order} />
                ))
            ) : (
                <p className="col-span-3 text-gray-500">No orders available</p>
            )}
          </div>
        </div>
      </div>
  );
};

export default RecentOrders;
