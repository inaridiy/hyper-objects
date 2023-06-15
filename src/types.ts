import { Validator } from "lizod";
import { HyperObject } from "./hyper-object";
import { HyperObjectQuery } from "./hyper-object-query";
import { StorebleSnapshot } from "./hyper-store";

export type HyperProps<T extends HyperObject<any>> = T extends HyperObject<infer P> ? P : never;

export type HyperSnapshot<T extends HyperObject<any>> = T extends HyperObject<any, infer S>
  ? S
  : never;

export type HyperConstructor<Hyper extends HyperObject<any, any> = HyperObject<any, any>> =
  (abstract new (id: string, props: HyperProps<Hyper>) => Hyper) & {
    type: string;
    schema: Validator<HyperProps<Hyper>>;
    query: () => HyperObjectQuery<Hyper>;
    restore: (snapshot: StorebleSnapshot) => Hyper;
  };
