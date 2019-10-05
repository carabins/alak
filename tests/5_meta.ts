import {test} from './ouput.shema'
import {A} from '../src'

test('meta', ({ plan, ok, end, pass, fail }) => {
  const flow = A()
  let flowId = 'my.newFlow.namespace'
  flow.setId(flowId)

  ok(flow.id == flowId, 'newFlow id')

  flow.addMeta("my")
  ok(flow.hasMeta("my"), "meta")

  flow.addMeta("a", {a:true})
  ok(flow.getMeta("a").a, "meta object")

  flow.clear()
  ok(flow.hasMeta("a") && flow.getMeta("a").a, "meta strength")

  flow.close()
  ok(!flow.hasMeta("a"), "meta end")

  plan(5)
  end()
})