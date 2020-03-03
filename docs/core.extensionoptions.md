<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [core](./core.md) &gt; [ExtensionOptions](./core.extensionoptions.md)

## ExtensionOptions interface

Опции расширения

<b>Signature:</b>

```typescript
export interface ExtensionOptions 
```

## Remarks

Содержит параметры расширения для методов и свойств атома. Доступ к атому из [функций обработчиков](./core.flowhandler.md) происходит через контекст `this`<!-- -->.

## Properties

|  Property | Type | Description |
|  --- | --- | --- |
|  [handlers](./core.extensionoptions.handlers.md) | <code>FlowHandlers</code> | [обработчики методов атома](./core.flowhandlers.md) |
|  [properties](./core.extensionoptions.properties.md) | <code>FlowHandlers</code> | [обработчики свойств атома](./core.flowhandlers.md) |
