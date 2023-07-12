import simpleGit from 'simple-git'
import { Project } from '~/scripts/common/project'

export function initGit(projects: Record<string, Project>) {
  const git = simpleGit()

  let list = []
  return {
    async changes() {
      const z = await git.status()
      list = z.files.map((f) => {
        const parts = f.path.split(['/'])
        if (parts.length > 1) {
          const p = projects[parts[1]]
          p && p.changes.push(f.path)
        }
        return f.path
      })
    },
    async commit() {
      await this.changes()
      const res = await git.add('-A')
      console.log({ res })
      // git.commit("z",{})
    },
  }
}
