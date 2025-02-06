export function add(a: number, b: number) {
  log(`add(${a}, ${b})`)
  return a + b
}

log('example-dependency 2') // try to change this line
