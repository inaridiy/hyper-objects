import { HyperObject } from "./hyper-object";
import { StorebleSnapshot } from "./hyper-store";
import { getStoreManager } from "./setup";
import { HyperConstructor, HyperProps } from "./types";

export type FilterOperator = "ids" | "eq" | "ne" | "gt" | "gte" | "lt" | "lte" | "in" | "nin";

/**
 * @default "text_comparison"
 */
export type NumableCastMode = "real_cast" | "text_comparison" | "speed" | "precise" | "none";

export type Filter = {
  operator: FilterOperator;
  field?: string;
  value?: any;
  /**
   * @default "text_comparison"
   */
  mode?: NumableCastMode;
};

export type Order = {
  field: string;
  direction: "asc" | "desc";
  mode: NumableCastMode;
};

export type QuerySnapshot = {
  type: string;
  filters: Filter[];
  orders: Order[];
  first?: boolean;
  limit?: number;
  offset?: number;
};

export type Fields<Hyper extends HyperObject<any, {}, any>> = keyof HyperProps<Hyper>;
export type FieldValue<
  Hyper extends HyperObject<any, any>,
  Field extends Fields<Hyper>
> = HyperProps<Hyper>[Field];

export class HyperObjectQuery<
  Hyper extends HyperObject<any, any, any>,
  First = false,
  Count = false,
  Result = First extends true ? Hyper | undefined : Count extends true ? number : Hyper[]
> implements PromiseLike<Result>
{
  private type: string;
  private hyperConstructor: HyperConstructor<Hyper>;
  private _filters: Filter[] = [];
  private _orders: Order[] = [];
  private _first?: First;
  private _count?: Count;
  private _limit?: number;
  private _offset?: number;

  constructor(hyperConstructor: HyperConstructor<Hyper>) {
    this.type = hyperConstructor.type;
    this.hyperConstructor = hyperConstructor;
  }

  id(id: string): HyperObjectQuery<Hyper, true, false> {
    this._first = true as First;
    this._filters.push({ operator: "ids", value: [id] });
    return this as unknown as HyperObjectQuery<Hyper, true, false>;
  }
  ids(ids: string[]): this {
    this._filters.push({ operator: "ids", value: ids });
    return this;
  }

  eq(field: Fields<Hyper>, value: FieldValue<Hyper, typeof field>): this {
    this._filters.push({ operator: "eq", field: field as string, value });
    return this;
  }

  ne(field: Fields<Hyper>, value: FieldValue<Hyper, typeof field>): this {
    this._filters.push({ operator: "ne", field: field as string, value });
    return this;
  }

  gt(field: Fields<Hyper>, value: bigint, mode: NumableCastMode): this;
  gt(field: Fields<Hyper>, value: FieldValue<Hyper, typeof field>): this;
  gt(
    field: Fields<Hyper>,
    value: FieldValue<Hyper, typeof field>,
    mode: NumableCastMode = "text_comparison"
  ): this {
    this._filters.push({ operator: "gt", field: field as string, value, mode });
    return this;
  }

  gte(field: Fields<Hyper>, value: bigint, mode: NumableCastMode): this;
  gte(field: Fields<Hyper>, value: FieldValue<Hyper, typeof field>): this;
  gte(
    field: Fields<Hyper>,
    value: FieldValue<Hyper, typeof field>,
    mode: NumableCastMode = "text_comparison"
  ): this {
    this._filters.push({
      operator: "gte",
      field: field as string,
      value,
      mode,
    });
    return this;
  }

  lt(field: Fields<Hyper>, value: bigint, mode: NumableCastMode): this;
  lt(field: Fields<Hyper>, value: FieldValue<Hyper, typeof field>): this;
  lt(
    field: Fields<Hyper>,
    value: FieldValue<Hyper, typeof field>,
    mode: NumableCastMode = "text_comparison"
  ): this {
    this._filters.push({ operator: "lt", field: field as string, value, mode });
    return this;
  }

  lte(field: Fields<Hyper>, value: bigint, mode: NumableCastMode): this;
  lte(field: Fields<Hyper>, value: FieldValue<Hyper, typeof field>): this;
  lte(
    field: Fields<Hyper>,
    value: FieldValue<Hyper, typeof field>,
    mode: NumableCastMode = "text_comparison"
  ): this {
    this._filters.push({
      operator: "lte",
      field: field as string,
      value,
      mode,
    });
    return this;
  }

  in(field: Fields<Hyper>, value: FieldValue<Hyper, typeof field>[]): this {
    this._filters.push({ operator: "in", field: field as string, value });
    return this;
  }

  nin(field: Fields<Hyper>, value: FieldValue<Hyper, typeof field>[]): this {
    this._filters.push({ operator: "nin", field: field as string, value });
    return this;
  }

  order(
    field: Fields<Hyper>,
    direction: "asc" | "desc",
    mode: NumableCastMode = "text_comparison"
  ): this {
    this._orders.push({ field: field as string, direction, mode });
    return this;
  }

  first(): HyperObjectQuery<Hyper, true, false> {
    this._first = true as First;
    return this as unknown as HyperObjectQuery<Hyper, true, false>;
  }

  count(): HyperObjectQuery<Hyper, false, true> {
    this._first = true as First;
    this._count = true as Count;
    return this as unknown as HyperObjectQuery<Hyper, false, true>;
  }

  limit(limit: number): this {
    this._limit = limit;
    return this;
  }

  offset(offset: number): this {
    this._offset = offset;
    return this;
  }

  snapshot(): QuerySnapshot {
    return {
      type: this.type,
      filters: this._filters,
      orders: this._orders,
      limit: this._limit,
      offset: this._offset,
    };
  }

  private async execute(): Promise<Result> {
    const storeManager = getStoreManager();
    const isOnlyIdFilter = this._filters.length === 1 && this._filters[0].operator === "ids";

    let results: StorebleSnapshot[] = [];
    let count = 0;
    if (this._count) {
      count = await storeManager.countQuery(this.snapshot());
    } else if (isOnlyIdFilter) {
      const ids = this._filters[0].value as string[];
      const res = await storeManager.findObjectByIds(this.type, ids);
      results = res.filter((r): r is StorebleSnapshot => Boolean(r));
    } else {
      results = await storeManager.executeQuery(this.snapshot());
    }

    const hyperObjects = results.map((result) => this.hyperConstructor.restore(result));

    if (this._count) {
      return count as unknown as Result;
    } else if (this._first) {
      return hyperObjects[0] as unknown as Result;
    } else {
      return hyperObjects as unknown as Result;
    }
  }

  then<TResult1 = Result, TResult2 = never>(
    onfulfilled?: ((value: Result) => TResult1 | PromiseLike<TResult1>) | null | undefined,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null | undefined
  ): PromiseLike<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }
}
