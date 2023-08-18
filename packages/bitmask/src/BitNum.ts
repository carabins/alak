export default function BitNum<F extends ReadonlyArray<string>>(flags: F) {
  const bitNum = {}
  flags.forEach((v, i) => {
    bitNum[v] = 1 << i
  })
  return bitNum as RoArrayToRecord<F>
}
