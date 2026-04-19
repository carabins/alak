export function isIQ(v: any): boolean {
  return v && v.__q === true;
}

export function bindProp(target: any, key: string, value: any) {
  // 1. Static value
  if (!isIQ(value)) {
    target[key] = value;
    return;
  }

  // 2. Reactive value (Quark)
  // Subscribe
  const unsub = value.up((v: any) => {
    target[key] = v;
  });

  // Auto-cleanup if target supports it (Pixi DisplayObject)
  if (typeof target.once === 'function') {
    target.once('destroy', unsub);
  }
}

export function bindProps(target: any, props: any) {
  // console.log(`Binding props to ${target.constructor.name}:`, Object.keys(props));
  for (const k in props) {
    if (k === 'children') continue;
    // if (k === 'horizontalAlign') console.log(`  - Binding horizontalAlign=${props[k]}`);
    bindProp(target, k, props[k]);
  }
}
