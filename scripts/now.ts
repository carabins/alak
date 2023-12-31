import fs from "fs";
import {Const} from "~/scripts/common/constants";
import {initProject, Project} from "~/scripts/common/project";

export const versions = {} as Record<string, string>
export const projects = {} as Record<string, Project>


fs.readdirSync(Const.PACKAGES).forEach((f) => {
  const p = initProject(f)
  if (p) {
    p.id = f
    projects[f] = p
    versions[p.packageJson.name] = p.packageJson.version
  }
})
