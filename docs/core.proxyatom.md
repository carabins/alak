<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [core](./core.md) &gt; [ProxyAtom](./core.proxyatom.md)

## ProxyAtom interface

Контейнер прокси-атома

<b>Signature:</b>

```typescript
export interface ProxyAtom<T> 
```

## Remarks

Прокси-атом, расширяет функцию-контейнер атом.

## Properties

|  Property | Type | Description |
|  --- | --- | --- |
|  [id](./core.proxyatom.id.md) | <code>string</code> | Идентификатор, вернёт <code>uid</code> если не был задан [ProxyAtom.setId()](./core.proxyatom.setid.md) |
|  [isAsync](./core.proxyatom.isasync.md) | <code>Boolean</code> | Является ли уставленный добытчик [ProxyAtom.useGetter()](./core.proxyatom.usegetter.md) асинхронным |
|  [isAwaiting](./core.proxyatom.isawaiting.md) | <code>Boolean</code> | Находится ли атом в процессе получения значения от асинхронного добытчика [ProxyAtom.useGetter()](./core.proxyatom.usegetter.md) |
|  [isComposite](./core.proxyatom.iscomposite.md) | <code>boolean</code> | Вернёт <code>true</code> при наличии функции-добытчика |
|  [isEmpty](./core.proxyatom.isempty.md) | <code>boolean</code> | Вернёт <code>true</code> при отсутствующем значении в контейнере |
|  [name](./core.proxyatom.name.md) | <code>string</code> | Имя заданное [ProxyAtom.setName()](./core.proxyatom.setname.md) |
|  [uid](./core.proxyatom.uid.md) | <code>string</code> | Уникальный идентификатор генерируется при создании. |
|  [value](./core.proxyatom.value.md) | <code>T</code> | Текущее значение контейнера |

## Methods

|  Method | Description |
|  --- | --- |
|  [addMeta(metaName, value)](./core.proxyatom.addmeta.md) | Добавить мета-данные |
|  [clear()](./core.proxyatom.clear.md) | Удалить связи всех функций-получателей, слушателей, и очистить значение контейнера |
|  [clearValue()](./core.proxyatom.clearvalue.md) | Очистить значение контейнера |
|  [cloneValue()](./core.proxyatom.clonevalue.md) | Создать дубликат значение |
|  [decay()](./core.proxyatom.decay.md) | Удалить все свойства, функции и ссылки, [ProxyAtom](./core.proxyatom.md) |
|  [down(receiver)](./core.proxyatom.down.md) | Удалить функцию-получатель |
|  [fmap(fun)](./core.proxyatom.fmap.md) | Применить функцию к значению в контейнере |
|  [getMeta(metaName)](./core.proxyatom.getmeta.md) | Получить мета-данные по имени |
|  [hasMeta(metaName)](./core.proxyatom.hasmeta.md) | Проверить на наличие мета-данных |
|  [injectOnce(targetObject, key)](./core.proxyatom.injectonce.md) | Передаёт значение контейнера в ключ объекта |
|  [is(compareValue)](./core.proxyatom.is.md) | Проверить значение контейнера на соответствие |
|  [next(receiver)](./core.proxyatom.next.md) | Добавить функцию-получатель и передать значение со следующего обновления |
|  [offAwait(listener)](./core.proxyatom.offawait.md) | Удалить слушатель изменения асинхронного состояния |
|  [onAwait(listener)](./core.proxyatom.onawait.md) | Добавить слушатель изменения асинхронного состояния функции добычи значения [ProxyAtom.useGetter()](./core.proxyatom.usegetter.md) |
|  [once(receiver)](./core.proxyatom.once.md) | Передать один раз в функцию-получатель значение контейнера, текущее если оно есть или как появится |
|  [resend()](./core.proxyatom.resend.md) | Повторно отправить значение всем функциям-получателям |
|  [setId(id)](./core.proxyatom.setid.md) | Установить идентификатор |
|  [setName(name)](./core.proxyatom.setname.md) | Установить имя |
|  [up(receiver)](./core.proxyatom.up.md) | Добавить функцию-получатель обновлений значения контейнера и передать текущее значение контейнера, если оно есть |
|  [upFalse(receiver)](./core.proxyatom.upfalse.md) | Добавить функцию-получатель значений равных <code>false</code> после приведения значения к типу <code>boolean</code> методом <code>!value</code> |
|  [upNone(receiver)](./core.proxyatom.upnone.md) | Добавить функцию-получатель значений равных <code>null</code> и <code>undefined</code> |
|  [upSome(receiver)](./core.proxyatom.upsome.md) | Добавить функцию-получатель значений не равных <code>null</code> и <code>undefined</code> |
|  [upSomeFalse(receiver)](./core.proxyatom.upsomefalse.md) | Добавить функцию-получатель значений равных <code>false</code> после приведения значения к типу <code>boolean</code> методом <code>!value</code> за исключением <code>null</code> и <code>undefined</code> |
|  [upTrue(receiver)](./core.proxyatom.uptrue.md) | Добавить функцию-получатель значений равных <code>true</code> после приведения значения к типу <code>boolean</code> методом <code>!!value</code> |
|  [useGetter(getter, isAsync)](./core.proxyatom.usegetter.md) | Использовать функцию-добытчик значения контейнера |
|  [useOnceGet(getter, isAsync)](./core.proxyatom.useonceget.md) | Использовать функцию-добытчик только один раз |
|  [useWrapper(wrapper, isAsync)](./core.proxyatom.usewrapper.md) | Использовать функцию-обёртку Каждое новое обновление значение контейнера атома, всегда будет проходить сперва через функцию-обёртку |
