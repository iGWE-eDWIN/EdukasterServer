const path = require('path');
const util = require('util');

const routePaths = [
  './src/routes/auth',
  './src/routes/users',
  './src/routes/tutors',
  './src/routes/question',
  './src/routes/wallet',
  './src/routes/subcription',
  './src/routes/solution',
  './src/routes/booking',
  './src/routes/session',
  './src/routes/bank',
  './src/routes/subscriber',
];

for (const rp of routePaths) {
  try {
    const router = require(path.resolve(rp));
    console.log('\n=== Router:', rp, 'type=', typeof router, ' ===');
    if (!router || !router.stack) {
      console.log('  Not an express router or has no stack');
      continue;
    }
    router.stack.forEach((layer, i) => {
      const route = layer.route;
      if (route) {
        const methods = Object.keys(route.methods).join(',');
        console.log(`  [${i}] route path: ${route.path} methods: ${methods}`);
      } else if (layer.name === 'router') {
        console.log(`  [${i}] nested router, regexp: ${layer.regexp}`);
      } else {
        console.log(`  [${i}] middleware, name: ${layer.name}, regexp: ${layer.regexp}`);
      }
    });
  } catch (err) {
    console.error('Error loading router', rp, err && err.stack ? err.stack : err);
  }
}
