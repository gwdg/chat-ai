import { configureStore } from "@reduxjs/toolkit";
import { persistReducer, persistStore } from "redux-persist";
import storage from "redux-persist/lib/storage";
import rootReducer from "../reducers/index";

const persistConfig = {
  key: "root",
  storage,
};

const persistedReducer = persistReducer(persistConfig, rootReducer);

// Create the Redux store with the persisted reducer and custom middleware
export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false, // Ignore checking non-serializable values
    }),
});

// Create the persistor object to persist the Redux store
export const persistor = persistStore(store);

export default store;
