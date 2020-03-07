<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [atom](./atom.md) &gt; [Atom](./atom.atom.md) &gt; [useWrapper](./atom.atom.usewrapper.md)

## Atom.useWrapper() method

Использовать функцию-обёртку Каждое новое обновление значение контейнера атома, всегда будет проходить сперва через функцию-обёртку

<b>Signature:</b>

```typescript
useWrapper(wrapper: (newValue: T, prevValue: T) => T | Promise<T>, isAsync?: boolean): Atom<T>;
```

## Parameters

|  Parameter | Type | Description |
|  --- | --- | --- |
|  wrapper | <code>(newValue: T, prevValue: T) =&gt; T &#124; Promise&lt;T&gt;</code> | функция-обёртка |
|  isAsync | <code>boolean</code> | установить значение returns [Atom.isAsync](./atom.atom.isasync.md) |

<b>Returns:</b>

`Atom<T>`

[Atom](./atom.atom.md)
