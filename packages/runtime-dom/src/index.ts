import { nodeOps } from "./nodeOps";
import patchProp from "./patchProp";

import { createRenderer } from "@vue/runtime-core";
// 将节点操作和属性操作合并在一起
const renderOptions = Object.assign({ patchProp }, nodeOps);

let renderer;
// 惰性创建渲染器，render 和 createApp 共享同一个 renderer，避免重复创建
function ensureRenderer() {
  if (!renderer) {
    renderer = createRenderer(renderOptions);
  }
  return renderer;
}

// render方法采用domapi来进行渲染
export const render = (vnode, container) => {
  return ensureRenderer().render(vnode, container);
};

// createApp(App).mount('#app')
export const createApp = (...args) => {
  // app 实例的创建在 runtime-core 的 createAppAPI 中（跨平台）
  const app = ensureRenderer().createApp(...args);

  const { mount } = app;
  // 重写 mount：处理平台相关的容器解析（选择器字符串 -> 真实元素）
  app.mount = (containerOrSelector) => {
    const container = normalizeContainer(containerOrSelector);
    if (!container) return;

    // 挂载前清空容器中的内容
    container.innerHTML = "";

    const proxy = mount(container);
    container.setAttribute("data-v-app", ""); // 标记该容器已被 vue 应用挂载
    return proxy;
  };

  return app;
};

function normalizeContainer(container) {
  if (typeof container === "string") {
    // '#app' -> div#app 元素
    return document.querySelector(container);
  }
  return container;
}

export * from "@vue/runtime-core";
