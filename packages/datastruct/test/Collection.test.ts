import {test} from 'tap'
import { IndexedVertexMap } from '../src/index'

test('IndexedVertexMap', (t) => {
    const ivm = IndexedVertexMap()
    ivm.push("one", 1)
    const indexOne = ivm.push("one", 11)
    ivm.forEach("one", (value, index) => {
        if (index == "0" || index == "1") {
            t.pass()
        }
    })

    t.ok(ivm.get("one").length === 2)

    ivm.remove("one", indexOne)
    t.ok(ivm.size("one") === 1)
    ivm.clearKey("one")
    t.ok(ivm.size("one") === 0)


    ivm.push("two", 2)
    ivm.clearAll()
    t.ok(ivm.size("two") === 0)
    t.ok(ivm.size("tree") === 0)

    t.end()
})


