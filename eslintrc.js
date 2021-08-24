module.exports = {
    root: true,
    env: {
        'jest/globals': true
    },
    parser: '@typescript-eslint/parser',
    plugins: [
        '@typescript-eslint',
        'jest',
        'prettier'
    ],
    extends: [
        'plugin:@typescript-eslint/recommended',
        'airbnb-typescript/base',
        'plugin:jest/recommended',
        'prettier'
    ],
    rules: {
        "no-shadow": "off",
        "@typescript-eslint/no-shadow": ["error"],
        "no-use-before-define": "off",
        "@typescript-eslint/no-use-before-define": ["error", {functions: false}],
        "prettier/prettier": ["error", {"singleQuote": true}]
    }
};
