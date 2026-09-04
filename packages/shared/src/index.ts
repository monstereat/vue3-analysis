export function isObject(value) {
  return typeof value === "object" && value !== null;
}

export function isFunction(value) {
  return typeof value == "function";
}
export function isString(value) {
  return typeof value == "string";
}
export * from "./shapeFlags";

const hasOwnProperty = Object.prototype.hasOwnProperty;
export const hasOwn = (value, key) => hasOwnProperty.call(value, key);

// 官方 isReservedProp：这些 props 是 vnode 的内部字段（key/ref/vnode 钩子），不作为 DOM attribute 处理
const reservedProps = new Set([
  "key",
  "ref",
  "ref_for",
  "ref_key",
  "onVnodeBeforeMount",
  "onVnodeMounted",
  "onVnodeBeforeUpdate",
  "onVnodeUpdated",
  "onVnodeBeforeUnmount",
  "onVnodeUnmounted",
]);
export const isReservedProp = (key) => reservedProps.has(key);

export * from "./patchFlags";
