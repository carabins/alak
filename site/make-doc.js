const {
  rmdir,
  existsSync,
  emptyDir,
  mkdirpSync,
  readJSON,
  writeJSON,
  writeJSONSync,
  readJSONSync,
} = require('fs-extra')
const path = require('path')

const { mkdirSync, readdirSync, readFileSync, readSync, renameSync, rmdirSync, unlinkSync, writeFileSync } = require(
  'fs')

const { log } = console

function ABox() {
  const values = {}
  const all = []
  return {
    each(key, iterator) {
      let ar = values[key]
      if (ar) {
        ar.forEach(iterator)
      }
    },
    mapValues(iterator) {
      return Object.values(values).map(iterator)
    },
    mapAll(iterator) {
      return all.map(iterator)
    },
    push(key, value) {
      all.push(value)
      let ar = values[key]
      if (ar) {
        ar.push(value)
      } else {
        values[key] = [value]
      }
    },
    removeAll(key) {
      delete values[key]
    },
    has(key) {
      return !!values[key]
    },
    get(key) {
      return values[key]
    },
    size() {
      return [all.length, Object.keys(values).length]
    },
    keys() {
      return Object.keys(values)
    },
    remove(key, value) {
      let ar = values[key]
      if (ar && ar.length) {
        ar.splice(ar.indexOf(value), 1)
      }
      if (!ar.length) {
        delete values[key]
      }
    },
  }
}


const homeDir = path.resolve('.')
const titleCode = /\##.*/

const dinoTitle = (title, id) => `---
id: ${id}
title: ${title}
---
`
const deleteLines = (string, n = 1) => {
  return string.replace(new RegExp(`(?:.*?\n){${n - 1}}(?:.*?\n)`), '')
}

const mergeTypes = {
  variable: true,
  type: true,
  'function': true,
}

async function make() {
  log('making documentation...')
  const docDir = path.resolve('../docs')
  console.log(docDir)
  const outApiDir = path.join(homeDir, 'docs', 'api')

  let topics = {}
  let subTopics = ABox()
  let subRedirect = []
  readdirSync(docDir).forEach(f => {
    let body = readFileSync(path.join(docDir, f), {
      encoding: 'Utf8',
    })
    body = body.replace(/<code>/g, '`')
    body = body.replace(/<\/code>/g, '`')
    body = body.replace(/&lt;/g, '<')
    body = body.replace(/&gt;/g, '>')
    body = body.replace(/&#124;/g, '|')
    const parts = f.split('.')
    const title = titleCode.exec(body)[0].slice(3)
    const type = title.split(' ')[1]
    if (parts.length > 3 || mergeTypes[type]) {
      const topicParts = parts.slice(0, parts.length - 2)
      const topicName = topicParts.join('.') + '.md'
      body = body.split('\n').slice(3).join('\n')
      body = body.replace(/## Parameters/g, '#### Parameters')
      body = body.replace(/## Remarks/g, '#### Remarks')
      body = body.replace(/## Remarks/g, '#### Remarks')

      if (parts.length == 4) {
        const t = title.split('.')
        t.shift()
        let subTitle = t.join('.')
        body = body.replace('## ' + title, '## ' + subTitle)
        subRedirect.push([
          new RegExp(f, 'g'),
          topicName + '#' + f.split('.')[2] + '-' + type,
        ])
      } else {
        subRedirect.push([
          new RegExp(f, 'g'),
          topicName + '#' + f.split('.')[1] + '-' + type
        ])
      }
      subTopics.push(topicName, body)
    } else {
      topics[f] = dinoTitle(title, f.replace('.md', '')) + body
    }
  })
  Object.keys(topics).forEach(topic => {
    subTopics.each(topic, subBody => {
      topics[topic] = topics[topic] + subBody
    })
  })

  await emptyDir(outApiDir)
  Object.keys(topics).forEach(topic => {
    let body = topics[topic]
    subRedirect.forEach(p => {
      body = body.replace(p[0], p[1])
    })
    console.log("api\\"+topic.split(".").slice(0,-1).join(".")+",")
    writeFileSync(path.join(outApiDir, topic), body)
  })
  writeFileSync(path.join(outApiDir, ".gitignore"), "*")
  log('documentation ready')
}

make()
