import { HyperStore } from "./hyper-store";
import { StoreManager } from "./store-manager";

let storeManager: StoreManager;

export const setupHyperObjects = async (store: HyperStore) => {
  await store.init();
  storeManager = new StoreManager(store);
};

export const getStoreManager = () => {
  if (!storeManager) throw new Error("storeManager is not initialized");
  return storeManager;
};
