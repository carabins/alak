<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [atom](./atom.md) &gt; [Atom](./atom.atom.md) &gt; [useOnceGet](./atom.atom.useonceget.md)

## Atom.useOnceGet() method

Использовать функцию-добытчик только один раз

<b>Signature:</b>

```typescript
useOnceGet(getter: () => T | Promise<T>, isAsync?: boolean): Atom<T>;
```

## Parameters

|  Parameter | Type | Description |
|  --- | --- | --- |
|  getter | <code>() =&gt; T &#124; Promise&lt;T&gt;</code> | функция-добытчик |
|  isAsync | <code>boolean</code> | установить значение [Atom.isAsync](./atom.atom.isasync.md) |

<b>Returns:</b>

`Atom<T>`

[Atom](./atom.atom.md)
