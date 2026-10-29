import firebaseRulesPlugin from '@firebase/eslint-plugin-security-rules';

export default [
  {
    ignores: [
      'dist/**/*',
      'node_modules/**/*',
      '.agents/**/*',
      '.claude/**/*',
      'agent/**/*',
    ],
  },
  firebaseRulesPlugin.configs['flat/recommended'],
];
