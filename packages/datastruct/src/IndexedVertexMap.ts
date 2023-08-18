/**
 * Структура данных MappedArray
 * @remarks
 * @packageDocumentation
 */


export default function IndexedVertexMap<K extends string, T>() {
    const map = {} as Record<K, Record<string, T>>
    const indexCounter = {} as Record<K, number>

    const clearAll = obj =>{
        for (const prop of Object.getOwnPropertyNames(obj)) {
            delete obj[prop];
        }
    }
    return {
        push(key: K, value: T): string {
            if (!map[key]) {
                map[key] = {}
                if (!indexCounter[key]) {
                    indexCounter[key] = 0
                }
            }
            const index: string = "" + indexCounter[key]++
            map[key as string][index] = value
            return index
        },
        get(key: K): T[] {
            const o = map[key]
            if (o) {
                return Object.values(o)
            }
            return []
        },
        clearAll() {
            clearAll(map)
            clearAll(indexCounter)
        },
        clearKey(key: K) {
            delete map[key]
            delete indexCounter[key]
        },
        remove(key: K, index: string) {
            let o = map[key]
            if (o && o[index]) {
                delete o[index]
            }
        },
        forEach(key: K, iterator: (value: T, index: string) => void) {
            let o = map[key]
            if (o) {
                Object.keys(o).forEach(index => {
                    iterator(o[index], index)
                })
            }
        },
        has(key: K): boolean {
            return !!map[key]
        },
        size(key: string): number {
            if (map[key]) {
                return Object.keys(map[key]).length
            }
            return 0
        },
    }
}

