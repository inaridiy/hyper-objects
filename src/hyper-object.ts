import { EventEmitter } from "eventemitter3";
import { type Validator } from "lizod";
import type { SuperJSONObject } from "superjson/dist/types";
import { v4 as uuid } from "uuid";
import { HyperObjectQuery } from "./hyper-object-query";
import { StorebleSnapshot } from "./hyper-store";
import { getStoreManager } from "./setup";
import { HyperConstructor, HyperEvents, HyperProps } from "./types";

export type HyperPropsLike = SuperJSONObject;

export interface BaseHyperObjectProps {
  id: string;
  type: string;
}

//将来的にはObjectそのものを返却するようにする
export interface BaseHyperObjectEvents<T> {
  new: (hyperLike: T) => void;
  save: (hyper: T) => void;
  delete: (hyper: T) => void;
}

export abstract class HyperObject<
  ObjectProps extends HyperPropsLike,
  ObjectEvents extends object = {},
  ObjectSnapshot extends StorebleSnapshot = ObjectProps & BaseHyperObjectProps
> {
  readonly id: string;
  static type: string;
  readonly type: string = (this.constructor as HyperConstructor<this>).type;
  readonly schema: Validator<ObjectProps>;
  private static _eventemitter: EventEmitter = new EventEmitter();
  props: ObjectProps;

  static query<T extends HyperObject<any, any>>(
    this: new (...args: any[]) => T
  ): HyperObjectQuery<T> {
    return new HyperObjectQuery<T>(this as unknown as HyperConstructor<T>);
  }

  constructor(id: string, props: ObjectProps) {
    this.id = id;
    this.props = props;
    this.schema = (this.constructor as HyperConstructor<this>).schema; //気合の実装
  }

  snapshot(): Readonly<ObjectSnapshot> {
    const copy = {
      id: `${this.type}:${this.id}`,
      type: this.type,
      ...this.props,
    } as unknown as ObjectSnapshot;
    return Object.freeze(copy);
  }

  static restore<T extends HyperObject<any, any>>(
    this: new (...args: any[]) => T,
    snapshot: StorebleSnapshot
  ): T {
    const { id: storeId, type, ...props } = snapshot;
    const [_, id] = storeId.split(":");
    const thisType = (this as unknown as HyperConstructor<T>).type;
    if (type !== thisType) throw new Error(`Invalid type ${type} for ${thisType}`);

    return new this(id, props as HyperPropsLike) as T;
  }

  protected _validateAndTransform(props: ObjectProps): ObjectProps {
    if (!this.schema(props)) throw new Error(`Invalid props for ${this.type} ${this.id}`);
    return props;
  }

  validateAndTransform(props: ObjectProps): ObjectProps {
    return this._validateAndTransform(props);
  }

  static on<
    T extends HyperObject<any, any>,
    EventName extends keyof (BaseHyperObjectEvents<T> & HyperEvents<T>),
    Callback extends (
      ...args: Parameters<(BaseHyperObjectEvents<T> & HyperEvents<T>)[EventName]>
    ) => void
  >(this: new (...args: any[]) => T, event: EventName, callback: Callback) {
    const _this = this as unknown as HyperConstructor<T>;
    const thisType = _this.type;
    _this._eventemitter.on(`${thisType}:${event as string}`, callback as any);
  }

  //Refactor: ObjectEventsを使うようにする
  emit<EventName extends keyof BaseHyperObjectEvents<this>>(
    event: EventName,
    ...args: Parameters<BaseHyperObjectEvents<this>[EventName]>
  ) {
    const thisType = this.type;
    (this.constructor as HyperConstructor<this>)._eventemitter.emit(
      `${thisType}:${event as string}`,
      ...args
    );
  }

  static async new<T extends HyperObject<any, any>>(
    this: new (...args: any[]) => T,
    props: HyperProps<T>
  ): Promise<T> {
    const storeManager = getStoreManager();
    const id = uuid();
    const hyper = new this(id, props);
    await storeManager.saveObject(hyper.snapshot() as StorebleSnapshot);
    hyper.emit("new", hyper);
    return hyper;
  }

  async save() {
    const storeManager = getStoreManager();
    await storeManager.saveObject(this.snapshot());
    this.emit("save", this);
  }
  async delete() {
    const storeManager = getStoreManager();
    await storeManager.deleteObject(this.snapshot());
    this.emit("delete", this);
  }

  static async save<T extends HyperObject<any, any>>(this: new (...args: any[]) => T, hyper: T) {
    const storeManager = getStoreManager();
    await storeManager.saveObject(hyper.snapshot() as StorebleSnapshot);
    hyper.emit("save", hyper);
  }
  static async delete<T extends HyperObject<any, any>>(this: new (...args: any[]) => T, hyper: T) {
    const storeManager = getStoreManager();
    await storeManager.deleteObject(hyper.snapshot() as StorebleSnapshot);
    hyper.emit("delete", hyper);
  }
}
