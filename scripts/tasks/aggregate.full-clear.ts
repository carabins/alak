import {BuildPackage} from "~/scripts/BuildPackage";
import fs from "fs-extra";

export default (p: BuildPackage[]) => {
  p.forEach(l=>{
    fs.removeSync(l.artPatch)
  })
}

