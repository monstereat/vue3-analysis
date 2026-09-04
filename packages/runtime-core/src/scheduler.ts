const queue = []; // 缓存当前要执行的队列
const pendingPostFlushCbs = []; // post 队列：mounted/updated 等钩子，等整棵树渲染完之后统一执行
let isFlushing = false;
const resolvePromise = Promise.resolve();

// 如果同时在一个组件中更新多个状态 job肯定是同一个
// 同时开启一个异步任务
export function queueJob(job) {
  if (!queue.includes(job)) {
    // 去重同名的
    queue.push(job); // 让任务入队列
  }
  if (!isFlushing) {
    isFlushing = true;
    resolvePromise.then(() => {
      isFlushing = false;
      const copy = queue.slice(0); // 先拷贝在执行
      queue.length = 0;
      copy.forEach((job) => job());
      // copy.length== 0 下一行代码是新加的
      flushPostFlushCbs(); // 与官方一致：所有 job 执行完后统一 flush post 队列（updated 等钩子）
    });
  }
}

// 官方 renderer 里叫 queuePostRenderEffect（内部转发到 scheduler 的 queuePostFlushCb）
// m/u 等钩子通过它进入 post 队列；官方在这里还会区分 Suspense 边界，本仓库无 Suspense 直接入队
export function queuePostRenderEffect(fn) {
  if (!pendingPostFlushCbs.includes(fn)) {
    // 去重：同一个钩子在一次 flush 前只会被收集一次
    pendingPostFlushCbs.push(fn);
  }
  if (!isFlushing) {
    // 官方 queueFlush：flush 已经在排队了就不重复排
    resolvePromise.then(flushPostFlushCbs);
  }
}

// 执行 post 队列：先去重拷贝再清空执行（官方同款）
// 执行期间新入队的钩子会随下一个微任务再执行，不会丢
export function flushPostFlushCbs() {
  if (pendingPostFlushCbs.length) {
    const deduped = [...new Set(pendingPostFlushCbs)];
    pendingPostFlushCbs.length = 0;
    deduped.forEach((cb) => cb());
  }
}
// 通过事件环的机制，延迟更新操作 先走宏任务-》微任务（更新操作）
