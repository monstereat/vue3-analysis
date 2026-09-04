# @vue/runtime-dom

浏览器平台的运行时入口，提供 `createApp` 和 `render` 两个对外 API。核心职责：把平台无关的 `@vue/runtime-core` 和真实 DOM 操作（`nodeOps` + `patchProp`）组装到一起。

## 用法

```js
import { createApp, h, ref } from '@vue/runtime-dom';

const App = {
  setup() {
    const count = ref(0);
    return () => h('div', null, [
      h('span', null, 'count: ' + count.value),
      h('button', { onClick: () => count.value++ }, 'add'),
    ]);
  },
};

// mount 支持选择器字符串或真实 dom 元素
createApp(App).mount('#app');
// 等价于 render(h(App), document.querySelector('#app'))
```

## 入口链路

与官方 Vue 完全一致的三层结构：

```
createApp(App)                          runtime-dom/src/index.ts
  └─ ensureRenderer().createApp(App)     renderer 由 createRenderer 生成
       │                                 runtime-core/src/renderer.ts 返回 { render, createApp }
       └─ createAppAPI(render)           runtime-core/src/apiCreateApp.ts（跨平台，app 实例在这里创建）
            └─ 返回 app { use / mount / unmount }
  └─ app.mount('#app')                  runtime-dom 重写 mount，处理平台相关逻辑
       ├─ normalizeContainer            '#app' → div#app 真实元素
       ├─ container.innerHTML = ''      挂载前清空容器
       └─ mount(container)              调用 runtime-core 的原始 mount
            ├─ createVnode(App)          组件 → 根 vnode     runtime-core/src/createVnode.ts
            └─ render(vnode, container)  注入的 render
                 └─ patch(null, vnode, container)          runtime-core/src/renderer.ts
                      └─ mountComponent → setupRenderEffect → patch 子树
```

为什么这么拆？`createApp` 的核心逻辑（建 vnode、调 render、防重复挂载）是跨平台的，放 runtime-core；容器解析（`querySelector`）、清空容器、`data-v-app` 标记是浏览器特有的，放 runtime-dom。官方源码同样如此。

## 关键实现

### renderOptions 组装

```ts
const renderOptions = Object.assign({ patchProp }, nodeOps);
```

`nodeOps` 负责 DOM 的增删改查（`createElement`/`insert`/`remove`...），`patchProp` 负责属性更新（class/style/event/attr）。合并后交给 runtime-core 的 `createRenderer`，后者通过解构拿到的全是 `hostXxx` 前缀的函数，不关心具体平台——这就是跨平台能力的来源。

### ensureRenderer 惰性单例

```ts
let renderer;
function ensureRenderer() {
  if (!renderer) {
    renderer = createRenderer(renderOptions);
  }
  return renderer;
}
```

`createRenderer` 内部会创建大量闭包（patch、mountElement、diff 等），每次调用都重建一份是浪费。首次调用时创建一次，`render` 和 `createApp` 共享同一个 renderer 实例。官方 Vue 同样用 `ensureRenderer` 做懒加载，好处是引用 runtime-dom 但不调用 render 的场景（如 SSR 只用编译器）不会付出创建渲染器的成本。

### runtime-core：createAppAPI + createRenderer

`createRenderer` 返回 `render` 的同时返回 `createApp`，后者由 `createAppAPI(render)` 生成——依赖注入：runtime-core 不依赖任何具体渲染器，由 `createRenderer` 的调用方注入：

```ts
// renderer.ts
return {
  render,
  createApp: createAppAPI(render),
};
```

`createAppAPI` 返回 `createApp` 工厂，app 实例持有 `_component`/`_container`，`mount` 里建根 vnode 调 render 并用 `isMounted` 防重复挂载，返回根组件 proxy：

```ts
// apiCreateApp.ts
export function createAppAPI(render) {
  return function createApp(rootComponent, rootProps = null) {
    let isMounted = false;
    const app = {
      use(plugin, ...options) { /* install 约定，支持链式调用 */ },
      mount(rootContainer) {
        if (!isMounted) {
          const vnode = createVnode(rootComponent, rootProps);
          render(vnode, rootContainer);
          isMounted = true;
          app._container = rootContainer;
          return vnode.component && vnode.component.proxy;
        }
      },
      unmount() {
        if (isMounted) {
          render(null, app._container); // render(null) 卸载当前 vnode
          isMounted = false;
        }
      },
    };
    return app;
  };
}
```

### runtime-dom：createApp 包装与 mount 重写

runtime-dom 拿到 core 创建的 app 后重写 `mount`，叠加浏览器特有行为（官方同款）：

```ts
export const createApp = (...args) => {
  const app = ensureRenderer().createApp(...args);

  const { mount } = app;
  app.mount = (containerOrSelector) => {
    const container = normalizeContainer(containerOrSelector);
    if (!container) return;

    container.innerHTML = ""; // 挂载前清空容器内容
    const proxy = mount(container); // 调 core 的原始 mount
    container.setAttribute("data-v-app", ""); // 标记容器已被 vue 应用挂载
    return proxy;
  };

  return app;
};
```

`mount('#app')` 时 `normalizeContainer` 用 `querySelector` 把字符串解析成真实元素，传元素则原样透传。

## 与官方 Vue 的差异

结构与官方完全对齐（`apiCreateApp`/`createAppAPI`/`normalizeContainer`/`ensureRenderer` 同名同职责）。省略的部分：SSR hydration、`app.component`/`directive`/`mixin`/`provide` 全局注册（教学仓库的渲染器尚未消费全局 context）、`__DEV__` 警告、无 `render`/`template` 时用容器 innerHTML 作为模板（需运行时编译器）。

## 验证

`npm run dev`（scripts/dev.js 用 esbuild watch 打包）目前配置打包的是 compiler-core，改打包 runtime-dom 可用：

```bash
node scripts/dev.js runtime-dom -f esm
```
