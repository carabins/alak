import {BuildPackage} from "~/scripts/BuildPackage";
import fs from "fs";

export default (p: BuildPackage) => {
  fs.unlinkSync(p.artPatch)
}
