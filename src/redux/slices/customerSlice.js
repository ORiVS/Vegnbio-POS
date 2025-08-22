import { createSlice } from "@reduxjs/toolkit";

const initialState = { orderId:"", customerName:"", customerPhone:"", guests:0, table:null };

const slice = createSlice({
    name:"customer", initialState,
    reducers:{
        setCustomer:(s,a)=>{ const { name, phone, guests } = a.payload; s.orderId = `${Date.now()}`; s.customerName=name; s.customerPhone=phone; s.guests=guests; },
        removeCustomer:(s)=>{ s.customerName=""; s.customerPhone=""; s.guests=0; s.table=null; },
        updateTable:(s,a)=>{ s.table = a.payload.table; }
    }
});
export const { setCustomer, removeCustomer, updateTable } = slice.actions;
export default slice.reducer;
