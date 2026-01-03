/**
 * Типы для стратегий атомов
 * Генерация всех возможных комбинаций ключей
 */

// Извлекаем первое слово и остаток
type SplitFirst<S extends string> =
  S extends `${infer First} ${infer Rest}`
    ? [First, Rest]
    : S extends ''
      ? ['', '']
      : [S, ''];

// Рекурсивно проверяем каждое слово
type ValidateEachWord<
  S extends string,
  Keys extends string
> = S extends ''
  ? true
  : SplitFirst<S> extends [infer First extends string, infer Rest extends string]
    ? First extends ''
      ? true
      : First extends Keys
        ? ValidateEachWord<Rest, Keys>
        : false
    : false;

// Генератор комбинаций ключей
type JoinTwo<A extends string, B extends string> = `${A} ${B}`;

type Combinations2<Keys extends string> = {
  [K1 in Keys]: {
    [K2 in Exclude<Keys, K1>]: JoinTwo<K1, K2>
  }[Exclude<Keys, K1>]
}[Keys];

type Combinations3<Keys extends string> = {
  [K1 in Keys]: {
    [K2 in Exclude<Keys, K1>]: {
      [K3 in Exclude<Keys, K1 | K2>]: `${K1} ${K2} ${K3}`
    }[Exclude<Keys, K1 | K2>]
  }[Exclude<Keys, K1>]
}[Keys];

/**
 * Генерирует все возможные комбинации ключей (до 3 ключей)
 * Поддерживает автокомплит в IDE!
 */
export type SpaceSeparatedKeys<T extends Record<string, any>> =
  | ""
  | (keyof T & string)
  | Combinations2<keyof T & string>
  | Combinations3<keyof T & string>;

/**
 * Строгая валидация (для проверки в runtime)
 */
export type ValidateKeyString<
  S extends string,
  T extends Record<string, any>
> = ValidateEachWord<S, keyof T & string> extends true
  ? S
  : never;

/**
 * Helper функция с валидацией
 */
export function deps<T extends Record<string, any>, S extends string>(
  _obj: T,
  str: ValidateKeyString<S, T>
): S {
  return str;
}

// ============= ПРИМЕРЫ ИСПОЛЬЗОВАНИЯ =============

type MyObject = {
  foo: number;
  bar: string;
  baz: boolean;
};

type AllCombinations = SpaceSeparatedKeys<MyObject>;

// ✅ Валидные варианты с автокомплитом:
const valid1: AllCombinations = "";
const valid2: AllCombinations = "foo";
const valid3: AllCombinations = "foo bar";
const valid4: AllCombinations = "bar foo";
const valid5: AllCombinations = "foo bar baz";
const valid6: AllCombinations = "baz bar foo";

type SomeStr = "one" | "two" | "three" | "four" | "five" | "six" | "seven" | "eight";
const nums:SomeStr = "siddd"

// ❌ Невалидные - будут ошибки:
const invalid1: AllCombinations = "invalid";
const invalid2: AllCombinations = "foo asd";

// ============= ДЛЯ ИСПОЛЬЗОВАНИЯ В ATOM =============

/**
 * Конфигурация стратегий для Atom
 */
// Строгая проверка - ТОЛЬКО значения из union
type StrictString<T extends string> = T extends any ? T : never;

export type StrategyOptions<
  T extends Record<string, any>,
  D extends SpaceSeparatedKeys<T> = SpaceSeparatedKeys<T>
> = {
  // Зависимости для вычисляемых свойств
  deps?: D;

  // Стратегия обновления
  strategy?: 'immediate' | 'debounced' | 'throttled' | 'lazy';

  // Задержка для debounced/throttled
  delay?: number;
};

export type StrategyConfig<T extends Record<string, any>> = {
  [K in keyof T]?: {
    deps?: SpaceSeparatedKeys<T>;
    strategy?: 'immediate' | 'debounced' | 'throttled' | 'lazy';
    delay?: number;
  }
};

// Пример
const config: StrategyConfig<MyObject> = {
  foo: {
    deps: "baz bar foo",     // ✅ автокомплит работает!
    strategy: 'debounced',
    delay: 300
  },
  bar: {
    deps: "baz",            // ✅ или пустая строка
  }
  // deps: "invalid"    // ❌ ошибка типа
};
