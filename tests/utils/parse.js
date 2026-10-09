/** "$1,284,756.35" -> 1284756.35 ; "131" -> 131 */
function parseNumber(text) {
  const cleaned = String(text).replace(/[^0-9.-]/g, '');
  if (!cleaned) throw new Error(`Cannot parse a number from "${text}"`);
  return Number(cleaned);
}
module.exports = { parseNumber };
