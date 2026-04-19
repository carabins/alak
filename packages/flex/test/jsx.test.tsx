/** @jsx h */
/** @jsxFrag Fragment */
import { test, expect } from 'bun:test'
import { h, Fragment } from '../src/core/h'

// 1. Компонент-функция
function Box(props: any) {
  return {
    _tag: 'box',
    id: props.id,
    children: props.children
  }
}

test('JSX: Basic Element', () => {
  const el = <div id="1" /> as any
  expect(el._tag).toBe('div')
  expect(el.id).toBe('1')
})

test('JSX: Nested Components', () => {
  const el = (
    <Box id="root">
      <span />
      <Box id="nested" />
    </Box>
  ) as any

  expect(el._tag).toBe('box')
  expect(el.id).toBe('root')
  expect(el.children).toHaveLength(2)
  expect(el.children[0]._tag).toBe('span')
  expect(el.children[1]._tag).toBe('box')
  expect(el.children[1].id).toBe('nested')
})

test('JSX: Fragments', () => {
  const el = (
    <>
      <div />
      <span />
    </>
  ) as any

  expect(Array.isArray(el)).toBe(true)
  expect(el).toHaveLength(2)
  expect(el[0]._tag).toBe('div')
})
