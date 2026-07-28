"use client";

import { useMemo } from "react";
import { Provider } from "react-redux";
import { makeStore } from "@/redux/store";

let store: ReturnType<typeof makeStore> | undefined;

function getStore() {
  if (!store) {
    store = makeStore();
  }
  return store;
}

export default function StoreProvider({ children }: { children: React.ReactNode }) {
  const storeInstance = useMemo(() => getStore(), []);
  return <Provider store={storeInstance}>{children}</Provider>;
}
