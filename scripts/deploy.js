// eslint-disable-next-line @typescript-eslint/no-require-imports
const ghpages = require('gh-pages');

ghpages.publish(
  '.',
  {
    src: [
      'dist/**/*',
      'resources/**/*',
      'mail/**/*',
      'package.json',
      '.nvmrc',
      'pnpm-lock.yaml',
      'pnpm-workspace.yaml',
      '.env.example',
      'tsconfig.json',
    ],
    branch: 'dist',
  },
  (e) => {
    if (e) {
      console.log(e);
    }
  },
);
