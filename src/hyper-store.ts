import { SuperJSONObject } from "superjson/dist/types";
import { QuerySnapshot } from "./hyper-object-query";

export type StorebleSnapshot = { id: string; type: string } & SuperJSONObject;

export abstract class HyperStore {
  abstract init(): Promise<void>;
  abstract close(): Promise<void>;

  abstract saveObjects(objects: StorebleSnapshot[]): Promise<void>;
  abstract deleteObjects(objects: StorebleSnapshot[]): Promise<void>;
  abstract findObjectsByIds(ids: Readonly<string[]>): Promise<StorebleSnapshot[]>;
  abstract executeQueries(queries: Readonly<QuerySnapshot[]>): Promise<StorebleSnapshot[][]>;
  abstract countQueries(queries: Readonly<QuerySnapshot[]>): Promise<number[]>;
}
