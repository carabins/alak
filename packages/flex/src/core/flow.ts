import { Container } from 'pixi.js'
import { isIQ } from './bind'

export function Match(props: any) {
  const container = new Container();
  const value = props.value;
  
  // Normalize children
  const kids = Array.isArray(props.children) ? props.children : [props.children];
  const cases = kids.filter((c: any) => c && c._isCase);
  const def = kids.find((c: any) => c && c._isDefault);

  function update(val: any) {
    container.removeChildren();
    
    const match = cases.find((c: any) => {
      if (Array.isArray(c.is)) return c.is.includes(val);
      return c.is === val;
    });
    
    const target = match || def;
    
    if (target) {
      let content = target.children;
      // Support render props for lazy eval
      if (typeof content === 'function') content = content();
      
      if (Array.isArray(content)) {
        content.forEach((c: any) => c && container.addChild(c));
      } else if (content) {
        container.addChild(content);
      }
    }
  }

  if (isIQ(value)) {
    const unsub = value.up(update);
    container.once('destroy', unsub);
  } else {
    update(value);
  }

  return container;
}

export function Case(props: any) {
  return { _isCase: true, is: props.is, children: props.children };
}

export function Default(props: any) {
  return { _isDefault: true, children: props.children };
}

export function True(props: any) {
  return { _isCase: true, is: true, children: props.children };
}

export function False(props: any) {
  return { _isCase: true, is: false, children: props.children };
}
