const fs = require('fs');
const files = [
  'components/BubbleMap.tsx',
  'components/StatsBar.tsx',
  'components/TickerTape.tsx',
  'components/TokenTable.tsx',
  'components/Orderbook.tsx',
];
files.forEach(f => {
  let c = fs.readFileSync(f, 'utf8');
  c = c.replace(/d\.priceChange24h\.toFixed/g, '(d.priceChange24h ?? 0).toFixed');
  c = c.replace(/t\.priceChange24h\.toFixed/g, '(t.priceChange24h ?? 0).toFixed');
  c = c.replace(/injToken\.priceChange24h\.toFixed/g, '(injToken.priceChange24h ?? 0).toFixed');
  c = c.replace(/token\.priceChange24h\.toFixed/g, '(token.priceChange24h ?? 0).toFixed');
  c = c.replace(/level\.quantity\.toFixed/g, '(level.quantity ?? 0).toFixed');
  c = c.replace(/ob\.depthRatioBid\.toFixed/g, '(ob.depthRatioBid ?? 0).toFixed');
  c = c.replace(/\(100 - ob\.depthRatioBid\)\.toFixed/g, '(100 - (ob.depthRatioBid ?? 0)).toFixed');
  fs.writeFileSync(f, c);
  console.log('patched:', f);
});
console.log('all done');