import { isFunction } from "@vue/shared";
import { createVnode } from "./createVnode";

// createApp 的实现在 runtime-core（跨平台），通过 createAppAPI 注入 render
// 这样 runtime-core 不依赖任何具体平台的渲染器，由调用方决定用什么 render
export function createAppAPI(render) {
  return function createApp(rootComponent, rootProps = null) {
    let isMounted = false;

    const app = {
      _component: rootComponent,
      _props: rootProps,
      _container: null,

      use(plugin, ...options) {
        if (plugin && isFunction(plugin.install)) {
          plugin.install(app, ...options);
        } else if (isFunction(plugin)) {
          plugin(app, ...options);
        }
        return app; // 支持链式调用 app.use(a).use(b)
      },

      mount(rootContainer) {
        if (!isMounted) {
          // 根组件 -> 根 vnode，交给注入进来的 render 去渲染
          const vnode = createVnode(rootComponent, rootProps);
          render(vnode, rootContainer);
          isMounted = true;
          app._container = rootContainer;
          // 返回根组件实例的代理，用户可以通过它访问根组件状态
          return vnode.component && vnode.component.proxy;
        }
      },

      unmount() {
        if (isMounted) {
          // render(null) 会卸载容器中当前的 vnode
          render(null, app._container);
          isMounted = false;
        }
      },
    };

    return app;
  };
}
