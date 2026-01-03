import IQuarkCore from "./IQuarkCore";
import {DEDUP, IS_AWAKE, HAS_REALM_AND_EMIT, HAS_REALM_AWAKE, IS_EMPTY, SILENT, STATELESS} from "./flags";
import {quantumBus} from "./quantum-bus";

// Создаём специализированные функции для каждой комбинации флагов
const HANDLER_TABLE = []

function compileHandler(flags) {
  const code = [];

  // Генерируем оптимизированный код для конкретной комбинации
  if (flags & DEDUP) {
    code.push('if (quark.value === value) return;');
  }

  if (!(flags & STATELESS)) {
    code.push('quark.value = value;');
  }

  if (flags & SILENT) {
    return new Function('quark', 'value', code.join('\n'));
  }

  if ((flags & HAS_REALM_AWAKE) === HAS_REALM_AWAKE) {
    code.push(`
      quantumBus.emit(quark.realm, 'QUARK_AWAKE', {
        id: quark.id,
        value,
        quark,
      });
    `);
  }

  if (flags & IS_AWAKE) {
    code.push(`
      const listeners = quark._edges;
      for (let i = 0, len = listeners.length; i < len; i++) {
        listeners[i](value, quark);
      }
    `);
  }

  if ((flags & HAS_REALM_AND_EMIT) === HAS_REALM_AND_EMIT) {
    code.push(`
      quark._bus.emit('QUARK_CHANGE', {
        id: quark.id,
        value,
        quark,
      });
    `);
  }

  // Создаём специализированную функцию
  return new Function('quark', 'value', 'quantumBus', code.join('\n'));
}



export default function setValue<T>(quark: IQuarkCore, value: T): void {
  if (quark._pipeFn) {
    const transformed = quark._pipeFn(value);
    if (transformed === undefined) return;
    value = transformed;
  }

  let flags = quark._flags;

  if (flags & IS_EMPTY) {
    quark._flags &= ~IS_EMPTY;
    flags &= ~IS_EMPTY;
  }

  // Получаем прекомпилированный обработчик
  let handler = HANDLER_TABLE[flags]
  if (!HANDLER_TABLE[flags]) {
    handler = HANDLER_TABLE[flags] = compileHandler(flags)
  }


  if (handler) {
    handler(quark, value, quantumBus);
  }
}
