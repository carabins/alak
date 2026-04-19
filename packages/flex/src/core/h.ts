export function h(tag: any, props: any, ...children: any[]) {
  // 1. Normalize children
  const flatChildren = children.flat(Infinity).filter(c => c != null && c !== false);

  // 2. Props defaults
  const finalProps = props || {};
  if (flatChildren.length > 0) {
    finalProps.children = flatChildren;
  }

  // 3. String tags (POJO for testing / DOM mode later)
  if (typeof tag === 'string') {
    return {
      _tag: tag,
      ...finalProps
    };
  }

  // 4. Component Factory (Function or Class)
  if (typeof tag === 'function') {
    // Try calling as function first. If it fails with "Class constructor", use new.
    try {
        // Warning: Some classes might NOT throw if called without new (old transpilation),
        // but would return undefined or garbage.
        // However, standard ES6 classes WILL throw.
        // If it's a simple function component, it returns the object immediately.
        const res = tag(finalProps);
        
        // Safety check: if result is undefined but it was supposed to be a class instance...
        // Actually, React function components return objects (VDOM), we return Pixi DisplayObjects.
        // If a class is called as function (in loose mode), it usually returns undefined.
        if (res === undefined && tag.prototype) {
             return new tag(finalProps);
        }
        return res;
    } catch (e: any) {
        // Catch "Class constructor Foo cannot be invoked without 'new'" (Chrome)
        // Catch "class constructors must be invoked with 'new'" (Firefox/Safari)
        const msg = e.message || '';
        if (msg.includes("cannot be invoked without 'new'") || msg.includes("must be invoked with 'new'")) {
            return new tag(finalProps);
        }
        throw e; // Rethrow real errors
    }
  }

  throw new Error(`Invalid tag type: ${typeof tag}`);
}

export function Fragment(props: any) {
  return props.children;
}
