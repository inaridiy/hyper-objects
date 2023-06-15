import SQLite from "better-sqlite3";
import { Kysely, SqliteDialect, sql } from "kysely";
import superjson from "superjson";
import { SuperJSONObject } from "superjson/dist/types";
import { QuerySnapshot } from "../hyper-object-query";
import { HyperStore, StorebleSnapshot } from "../hyper-store";

export interface Database {
  hyper_objects: {
    id: string;
    type: string;
    json: string;
    meta: string | null;
  };
}

export class SQLiteStore extends HyperStore {
  db: Kysely<Database>;

  constructor(filename = ":memory:") {
    super();
    this.db = new Kysely<Database>({
      dialect: new SqliteDialect({
        database: new SQLite(filename),
      }),
    });
  }

  async init(): Promise<void> {
    await this.db.schema
      .createTable("hyper_objects")
      .ifNotExists()
      .addColumn("id", "text", (col) => col.primaryKey())
      .addColumn("type", "text")
      .addColumn("json", "json")
      .addColumn("meta", "json")
      .execute();
    await this.db.schema
      .createIndex("hyper_objects_type")
      .ifNotExists()
      .on("hyper_objects")
      .columns(["type"])
      .execute();
  }

  async close(): Promise<void> {
    await this.db.destroy();
  }

  async saveObjects(objects: StorebleSnapshot[]): Promise<void> {
    const insertValues = objects.map(({ id, type, ...obj }) => {
      const { json, meta } = superjson.serialize(obj);
      return {
        id,
        type,
        json: JSON.stringify(json),
        meta: JSON.stringify(meta),
      };
    });

    await this.db.replaceInto("hyper_objects").values(insertValues).execute();
  }

  async deleteObjects(objects: StorebleSnapshot[]): Promise<void> {
    const ids = objects.map(({ id }) => id);
    await this.db.deleteFrom("hyper_objects").where("id", "in", ids).execute();
  }

  async findObjectsByIds(ids: readonly string[]): Promise<StorebleSnapshot[]> {
    const rows = await this.db
      .selectFrom("hyper_objects")
      .selectAll()
      .where("id", "in", ids)
      .execute();
    return rows.map(({ id, type, json, meta }) => {
      const obj = superjson.deserialize({
        json: JSON.parse(json),
        meta: JSON.parse(meta || "{}"),
      }) as SuperJSONObject;
      return { id, type, ...obj };
    });
  }

  private _buildQuery(querySnapshot: QuerySnapshot) {
    let query = this.db
      .selectFrom("hyper_objects")
      .where("type", "=", querySnapshot.type);

    for (const filter of querySnapshot.filters) {
      let fieldValue =
        typeof filter.value === "number"
          ? filter.value
          : typeof filter.value === "bigint" &&
            (filter.mode === "real_cast" || filter.mode === "speed")
          ? sql`CAST(${filter.value.toString()} AS REAL)`
          : typeof filter.value === "bigint" &&
            (filter.mode === "text_comparison" || filter.mode === "precise")
          ? sql`(printf('%079s', ${filter.value.toString()}))` // 10^79 like 2^256
          : superjson.serialize(filter.value).json;

      const fieldSelector = `$.${filter.field}`;
      const fieldSelectSql =
        typeof filter.value !== "bigint" || !filter.mode
          ? sql`json_extract(json, ${fieldSelector})`
          : filter.mode === "real_cast" || filter.mode === "speed"
          ? sql`CAST(json_extract(json, ${fieldSelector}) AS REAL)`
          : filter.mode === "text_comparison" || filter.mode === "precise"
          ? sql`(printf('%079s', json_extract(json, ${fieldSelector})))` // 10^79 like 2^256
          : sql`json_extract(json, ${fieldSelector})`;

      switch (filter.operator) {
        case "eq":
          query = query.where(fieldSelectSql, "==", fieldValue);
          continue;
        case "ne":
          query = query.where(fieldSelectSql, "!=", fieldValue);
          continue;
        case "gt":
          query = query.where(fieldSelectSql, ">", fieldValue);
          continue;
        case "gte":
          query = query.where(fieldSelectSql, ">=", fieldValue);
          continue;
        case "lt":
          query = query.where(fieldSelectSql, "<", fieldValue);
          continue;
        case "lte":
          query = query.where(fieldSelectSql, "<=", fieldValue);
          continue;
        case "in":
          query = query.where(fieldSelectSql, "in", fieldValue);
          continue;
        case "nin":
          query = query.where(fieldSelectSql, "not in", fieldValue);
          continue;
      }
    }

    for (const order of querySnapshot.orders) {
      const fieldSelector = `$.${order.field}`;
      const fieldSelectSql =
        order.mode === "none" || !order.mode
          ? sql`json_extract(json, ${fieldSelector})`
          : order.mode === "real_cast" || order.mode === "speed"
          ? sql`CAST(json_extract(json, ${fieldSelector}) AS REAL)`
          : order.mode === "text_comparison" || order.mode === "precise"
          ? sql`(printf('%079s', json_extract(json, ${fieldSelector})))` // 10^79 like 2^256
          : sql`json_extract(json, ${fieldSelector})`;
      query = query.orderBy(fieldSelectSql, order.direction);
    }

    if (querySnapshot.limit) {
      query = query.limit(querySnapshot.limit);
    }

    if (querySnapshot.offset) {
      query = query.offset(querySnapshot.offset);
    }

    return query;
  }

  async executeQueries(
    querySnapshots: Readonly<QuerySnapshot[]>
  ): Promise<StorebleSnapshot[][]> {
    const queries = querySnapshots.map((q) => {
      let query = this._buildQuery(q).selectAll();
      return query;
    });

    const rowsList = await Promise.all(queries.map((q) => q.execute()));

    return rowsList.map((rows) =>
      rows.map(({ id, type, json, meta }) => {
        const obj = superjson.deserialize({
          json: JSON.parse(json),
          meta: JSON.parse(meta || "{}"),
        }) as SuperJSONObject;
        return { id, type, ...obj };
      })
    );
  }

  async countQueries(
    querySnapshots: Readonly<QuerySnapshot[]>
  ): Promise<number[]> {
    const queries = querySnapshots.map((q) => {
      let query = this._buildQuery(q).select([
        this.db.fn.count("id").as("count"),
      ]);
      return query;
    });

    const counts = await Promise.all(
      queries.map((q) => q.execute().then((rows) => Number(rows[0].count)))
    );

    return counts;
  }
}
