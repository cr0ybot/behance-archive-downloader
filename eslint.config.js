const stylisticJs = require('@stylistic/eslint-plugin-js');

module.exports = [
	{
		plugins: {
			'@stylistic/js': stylisticJs,
		},
		rules: {
			'@stylistic/js/indent': ['error', 'tab'],
			'@stylistic/js/quotes': ['error', 'single'],
			'@stylistic/js/semi': ['error', 'always'],
			'@stylistic/js/space-before-function-paren': ['error', 'never'],
			'@stylistic/js/no-multiple-empty-lines': ['error', { max: 1 }],
			'@stylistic/js/no-trailing-spaces': 'error',
			'@stylistic/js/keyword-spacing': 'error',
			'@stylistic/js/comma-spacing': 'error',
			'@stylistic/js/space-infix-ops': 'error',
			'@stylistic/js/object-curly-spacing': ['error', 'always'],
			'@stylistic/js/array-bracket-spacing': ['error', 'never'],
			'@stylistic/js/block-spacing': 'error',
		}
	}
];
