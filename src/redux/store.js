import { configureStore } from "@reduxjs/toolkit";
import user from "./slices/userSlice";
import customer from "./slices/customerSlice";
import cart from "./slices/cartSlice";

export default configureStore({ reducer: { user, customer, cart } });
