import { mixed, tag, saved, UnionModel } from 'alak/index'
import { makeRune } from '@alaq/rune/index'

export default class BirdsModel extends UnionModel<any> {
  one = 1
  song = mixed<string>(tag.wow, saved, 'la-la-la')
  notTag = { sym: { id: true } }
  tagged = tag.ok(1)
  mixed = mixed(tag.ok, saved, 'mixedValue')
}
