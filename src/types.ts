import { EventEmitter } from "eventemitter3";
import { Validator } from "lizod";
import { HyperObject } from "./hyper-object";
import { HyperObjectQuery } from "./hyper-object-query";
import { StorebleSnapshot } from "./hyper-store";

export type HyperProps<T extends HyperObject<any>> = T extends HyperObject<infer P> ? P : never;

export type HyperEvents<T extends HyperObject<any>> = T extends HyperObject<any, infer E, any>
  ? E
  : never;

export type HyperSnapshot<T extends HyperObject<any>> = T extends HyperObject<any, {}, infer S>
  ? S
  : never;

export type HyperConstructor<Hyper extends HyperObject<any, any, any> = HyperObject<any, {}, any>> =
  (abstract new (id: string, props: HyperProps<Hyper>) => Hyper) & {
    type: string;
    schema: Validator<HyperProps<Hyper>>;
    query: () => HyperObjectQuery<Hyper>;
    _eventemitter: EventEmitter;
    restore: (snapshot: StorebleSnapshot) => Hyper;
  };
