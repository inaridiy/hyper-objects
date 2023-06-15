import DataLoader from "dataloader";
import superjson from "superjson";
import { QuerySnapshot } from "./hyper-object-query";
import { HyperStore, StorebleSnapshot } from "./hyper-store";

export class StoreManager {
  store: HyperStore;

  findIdDataloader: DataLoader<string, StorebleSnapshot>;
  queryDataloader: DataLoader<string, StorebleSnapshot[]>;
  countQueryDataloader: DataLoader<string, number>;

  constructor(store: HyperStore) {
    this.store = store;
    this.findIdDataloader = new DataLoader((ids) => store.findObjectsByIds(ids));
    this.queryDataloader = new DataLoader((queries) =>
      store.executeQueries(queries.map((q) => superjson.parse(q)))
    );
    this.countQueryDataloader = new DataLoader((queries) =>
      store.countQueries(queries.map((q) => superjson.parse(q)))
    );
  }

  async findObjectById(id: string): Promise<StorebleSnapshot | null> {
    const result = await this.findIdDataloader.load(id);
    this.findIdDataloader.clear(id);
    return result instanceof Error ? null : result;
  }

  async findObjectByIds(type: string, ids: string[]): Promise<(StorebleSnapshot | null)[]> {
    const storeIds = ids.map((id) => `${type}:${id}`);
    const results = await this.findIdDataloader.loadMany(storeIds);
    this.findIdDataloader.clearAll();
    return results.map((result) => (result instanceof Error ? null : result));
  }

  async executeQuery(query: QuerySnapshot): Promise<StorebleSnapshot[]> {
    const jsonStr = superjson.stringify(query);
    const result = await this.queryDataloader.load(jsonStr);
    this.queryDataloader.clear(jsonStr);
    return result;
  }

  async executeQueries(queries: QuerySnapshot[]): Promise<StorebleSnapshot[][]> {
    const results = await this.queryDataloader.loadMany(queries.map((q) => JSON.stringify(q)));
    this.queryDataloader.clearAll();
    return results.map((result) => (result instanceof Error ? [] : result));
  }

  async countQuery(query: QuerySnapshot): Promise<number> {
    const jsonStr = superjson.stringify(query);
    const result = await this.countQueryDataloader.load(jsonStr);
    this.countQueryDataloader.clear(jsonStr);
    return result;
  }

  async countQueries(queries: QuerySnapshot[]): Promise<number[]> {
    const results = await this.countQueryDataloader.loadMany(queries.map((q) => JSON.stringify(q)));
    this.countQueryDataloader.clearAll();
    return results.map((result) => (result instanceof Error ? 0 : result));
  }

  async saveObject(object: StorebleSnapshot): Promise<void> {
    //TODO: batch
    await this.store.saveObjects([object]);
  }

  async deleteObject(object: StorebleSnapshot): Promise<void> {
    //TODO: batch
    await this.store.deleteObjects([object]);
  }
}
