// Comprehensive test for axial UnoCSS plugin functionality
import { createGenerator } from 'unocss'
import { axial } from './src/index'

async function testAxialPlugin() {
  // Create UnoCSS generator with our axial plugin
  const generator = await createGenerator({
    presets: [],
    plugins: [
      axial()
    ]
  })

  // Test basic container classes
  console.log('Testing basic container classes...')
  const xGroupCSS = await generator.generate('x-group', { preflights: false })
  console.log('x-group CSS:', xGroupCSS.css)

  const yGroupCSS = await generator.generate('y-group', { preflights: false })
  console.log('y-group CSS:', yGroupCSS.css)

  // Test percentage modifiers
  console.log('\nTesting percentage modifiers...')
  const xPercent50CSS = await generator.generate('x-percent-50', { preflights: false })
  console.log('x-percent-50 CSS:', xPercent50CSS.css)

  const yPercent70CSS = await generator.generate('y-percent-70', { preflights: false })
  console.log('y-percent-70 CSS:', yPercent70CSS.css)

  // Test fixed modifiers
  console.log('\nTesting fixed modifiers...')
  const xFixedCSS = await generator.generate('x-fixed', { preflights: false })
  console.log('x-fixed CSS:', xFixedCSS.css)

  const yFixedCSS = await generator.generate('y-fixed', { preflights: false })
  console.log('y-fixed CSS:', yFixedCSS.css)

  // Test flex modifiers
  console.log('\nTesting flex modifiers...')
  const xFlex2CSS = await generator.generate('x-flex-2', { preflights: false })
  console.log('x-flex-2 CSS:', xFlex2CSS.css)

  const yFlex1CSS = await generator.generate('y-flex-1', { preflights: false })
  console.log('y-flex-1 CSS:', yFlex1CSS.css)

  // Test alignment classes
  console.log('\nTesting alignment classes...')
  const xCenterCSS = await generator.generate('x-center', { preflights: false })
  console.log('x-center CSS:', xCenterCSS.css)

  const yBetweenCSS = await generator.generate('y-between', { preflights: false })
  console.log('y-between CSS:', yBetweenCSS.css)

  // Test combined usage
  console.log('\nTesting combined usage...')
  const combinedCSS = await generator.generate('x-group x-between y-center x-percent-100', { preflights: false })
  console.log('Combined classes CSS:', combinedCSS.css)

  console.log('\nAll tests completed successfully!')
}

// Run the test
testAxialPlugin().catch(console.error)