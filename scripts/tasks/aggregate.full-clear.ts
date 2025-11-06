import {BuildPackage} from "~/scripts/BuildPackage";
import fs from "fs";

export default (p: BuildPackage[]) => {
  p.forEach(l=>{
    console.log(l);
    // fs.unlinkSync(l.artPatch)
  })
}
 
