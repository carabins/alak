import type { UnoGenerator, Rule } from 'unocss'

// Define the axial UnoCSS plugin
export function axial() {
  return {
    name: '@alaq/axial',
    rules: [
      // Basic container classes
      [/^x-group$/, () => ({ display: 'flex', 'flex-direction': 'row' })],
      [/^y-group$/, () => ({ display: 'flex', 'flex-direction': 'column' })],

      // Percentage width/height modifiers
      ...generatePercentageRules('x', 'width'),
      ...generatePercentageRules('y', 'height'),

      // Fixed width/height modifiers
      [/^x-fixed$/, () => ({ 'flex-shrink': '0', 'flex-basis': 'auto' })],
      [/^y-fixed$/, () => ({ 'flex-shrink': '0', 'flex-basis': 'auto' })],

      // Flex grow modifiers
      [/^x-flex-(\d+)$/, ([, num]) => ({ 'flex-grow': num })],
      [/^y-flex-(\d+)$/, ([, num]) => ({ 'flex-grow': num })],

      // X-axis alignment classes (justify-content)
      [/^x-center$/, () => ({ 'justify-content': 'center' })],
      [/^x-start$/, () => ({ 'justify-content': 'flex-start' })],
      [/^x-end$/, () => ({ 'justify-content': 'flex-end' })],
      [/^x-between$/, () => ({ 'justify-content': 'space-between' })],
      [/^x-around$/, () => ({ 'justify-content': 'space-around' })],
      [/^x-evenly$/, () => ({ 'justify-content': 'space-evenly' })],

      // Y-axis alignment classes (align-items)
      [/^y-center$/, () => ({ 'align-items': 'center' })],
      [/^y-start$/, () => ({ 'align-items': 'flex-start' })],
      [/^y-end$/, () => ({ 'align-items': 'flex-end' })],
      [/^y-between$/, () => ({ 'align-items': 'space-between' })],
      [/^y-around$/, () => ({ 'align-items': 'space-around' })],
      [/^y-evenly$/, () => ({ 'align-items': 'space-evenly' })],
    ] as Rule[],
  }
}

// Helper function to generate percentage rules
function generatePercentageRules(axis: string, property: string) {
  const rules: Rule[] = []
  
  for (let i = 10; i <= 100; i += 10) {
    const pattern = new RegExp(`^${axis}-percent-${i}$`)
    rules.push([pattern, () => ({ [property]: `${i}%` })])
  }
  
  return rules
}

export default axial