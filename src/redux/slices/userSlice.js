import { createSlice } from "@reduxjs/toolkit";

const initialState = { _id:"", name:"", email:"", phone:"", role:"", isAuth:false };

const userSlice = createSlice({
    name: "user",
    initialState,
    reducers: {
        setUser:(s,a)=>{ const { _id,name,phone,email,role } = a.payload; Object.assign(s,{ _id,name,phone,email,role,isAuth:true }); },
        removeUser:(s)=>{ Object.assign(s, initialState); }
    }
});
export const { setUser, removeUser } = userSlice.actions;
export default userSlice.reducer;
