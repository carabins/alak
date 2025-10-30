import {N} from "@alaq/nucleus/index";

const [a, b, c]= [N(1),N(2), N(3)];
const [width, height]= [N(3), N(33)];

const area = N.from(width, height).strong((w, h) => w * h)
const average = N.from(a, b, c).strong((x, y, z) => (x + y + z) / 3)



// WEAK - для эффектов и мониторинга
const logger = N.from(area).weak((s) => {
  console.log('State changed:', s)
  return s
})
