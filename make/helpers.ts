import { existsSync } from 'fs-extra'
import { mkdirSync, rmdirSync } from 'fs'
import { exec } from 'child_process'
import * as path from 'path'

const chalk = require('chalk')
const { log } = console

export const info = (text) => log(chalk.green.bold(text))
export const log0 = (...text) => log(chalk.grey(...text))

export const prepare = async (path) => {
  if (existsSync(path)) rm(path)
  mkdirSync(path)
}

export const rm = (name) =>
  rmdirSync(name, {
    recursive: true,
  })

export const executeProcess = (command, cwd?) => {
  log(chalk.grey('execute process'), chalk.yellow(command))
  if (!cwd) cwd = path.resolve('.')
  let proc = exec(command, { cwd: cwd }, (error, stdout) => {})
  return proc
}
export const executeCommand = (command, cwd?) =>
  new Promise(async (done) => {
    if (!cwd) cwd = path.resolve('.')
    log(chalk.yellow('execute'), chalk.grey(command + ' in ' + cwd))
    const proc = exec(command, { cwd: cwd }, (error, stdout) => {
      if (error) {
        log(chalk.grey('Error:'), chalk.yellow(cwd))
        log(chalk.redBright(error))
        log(chalk.redBright(stdout))
        process.exit()
      }
      log(chalk.green('execute finish'), chalk.grey(command))
      done(stdout)
    })
    proc.stdout.pipe(process.stdout)
    proc.stderr.pipe(process.stderr)
  })
