import {mixed, rune, saved, UnionModel} from "alak/index";
import {makeRune} from "@alaq/rune/index";

export default class BirdsModel extends UnionModel<any> {
  song = mixed(rune.wow(), saved("la-la-la"))
  notRune = {sym: {id: true}}
  rune = rune.ok(1)
  runic = mixed(rune.ok(), saved(makeRune(30)))
}
